import {
  isEligibleSubstitutionHeir,
  isRenouncedHeir,
  isSpouseRelation,
  isSubstitutionTrigger,
} from './eligibility.js';
import { mergeCalcSteps } from './calcTrace.js';
import { assignHeirShare, determineActiveRank } from './distribution.js';
import { auditInheritanceResult } from './inheritanceAudit.js';
import { findGlobalSuccessors, findHeirsByName } from './successorSearch.js';
import {
  buildIneligibleSubstitutionWarning,
  buildInheritanceCycleWarning,
  buildMissingPrimaryHojuWarning,
  dedupeWarnings,
} from './warningFactory.js';
import { math, getLawEra, isBefore } from './utils.js';

export const calculateInheritance = (tree, _propertyValue, options = {}) => {
  const includeCalcSteps = options.includeCalcSteps !== false;
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  const hojuSelectionWarned = new Set();
  const substitutionBranchWarned = new Set();

  const getPersonKey = (person) => {
    if (!person) return '';
    return person.personId || person.id || `${person.name || ''}::${person.relation || ''}`;
  };

  const pushWarning = ({
    code = 'engine-warning',
    severity = 'warning',
    blocking = false,
    id = null,
    personId = null,
    targetTabId = null,
    text = '',
  }) => {
    warnings.push({
      code,
      severity,
      blocking,
      id,
      personId,
      targetTabId: targetTabId || personId || id || null,
      text,
    });
  };

  const getHojuBonusContext = ({ node, isSubstitution, parentDecName }) => {
    const relation = node?.relation || '';
    const isRootStage = node?.id === 'root';
    const isFemaleDeceased = ['wife', 'daughter'].includes(relation);
    const isSpouseEstate = ['wife', 'husband', 'spouse'].includes(relation);
    const nodeAllowsHoju = isRootStage || !!node?.isHoju;
    const primaryHojuSuccessor =
      (node?.heirs || []).find((heir) => heir?.isPrimaryHojuSuccessor)
      || (node?.heirs || []).find((heir) => heir?.isHoju)
      || null;

    return {
      sourceName: parentDecName || '피상속인',
      isRootStage,
      isSubstitution,
      isFemaleDeceased,
      isSpouseEstate,
      nodeAllowsHoju,
      primaryHojuSuccessor,
      // 여성 피상속인 본인 재산 단계에서는 자동 가산을 막고,
      // 배우자 경유 후 별도 재산 단계는 이후 판정 함수에서 다시 열어둘 수 있게 분리한다.
      blocksDirectFemaleEstateBonus: isFemaleDeceased && !isSubstitution,
    };
  };

  const canApplyHojuBonus = ({ heir, law, context }) => {
    if (!heir || heir.relation !== 'son') return false;
    if (!(law === '1960' || law === '1979')) return false;
    if (context.blocksDirectFemaleEstateBonus) return false;
    if (!context.nodeAllowsHoju) return false;
    if (!context.primaryHojuSuccessor) return false;
    return (context.primaryHojuSuccessor.personId || context.primaryHojuSuccessor.id) === (heir.personId || heir.id);
  };

  const getHojuBonusReason = ({ context }) => (
    context.isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'
  );

  const warnIneligibleSubstitutionBranch = (node, contextDate, children = []) => {
    const warningKey = `${getPersonKey(node)}::${contextDate || ''}`;
    if (!warningKey || substitutionBranchWarned.has(warningKey)) return;
    substitutionBranchWarned.add(warningKey);

    pushWarning(buildIneligibleSubstitutionWarning({
      node,
      contextDate,
      children,
      getPersonKey,
    }));
  };

  //  parentPersonId를 추가하여 현재 어떤 탭(부모)을 처리 중인지 추적합니다.
  const traverse = (node, inN, inD, inheritedDate, visitedIds = [], parentDecName = '피상속인') => {
    if (visitedIds.includes(node.id)) {
      pushWarning(buildInheritanceCycleWarning({ node }));
      return;
    }
    const currentVisited = [...visitedIds, node.id];

    let isSubstitution = false;
    let distributionDate = inheritedDate;
    let isDisqualifiedOrLost = false;

    if (node.id !== 'root' && node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
      distributionDate = node.deathDate;
    } else if (node.id !== 'root' && node.isDeceased && node.deathDate) {
      isSubstitution = true;
    }
    
    if (node.id !== 'root' && node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) {
      isSubstitution = true;
      isDisqualifiedOrLost = true; 
      distributionDate = inheritedDate; 
    }

    const law = getLawEra(distributionDate); 

    //  최종 진화: 1순위 가지 멸절 시 2순위/3순위로의 자동 이전을 완벽하게 제어하는 스마트 필터
    const isRenounced = (h, contextDate) => isRenouncedHeir(h, contextDate, {
      isBefore,
      isSpouseRelation,
      getQualifiedSubstitutionHeirs,
    });

    const getQualifiedSubstitutionHeirs = (target, contextDate, emitWarning = false) => {
      let children = target.heirs || [];

      if (children.length === 0 && target.name) {
        const borrowed = findHeirsByName(tree, target.name, target.id);
        if (borrowed) children = borrowed;
      }

      if (
        target.isExcluded
        && (target.exclusionOption === 'lost' || target.exclusionOption === 'disqualified')
        && !isBefore(tree.deathDate || contextDate, '2024-04-25')
      ) {
        children = children.filter((child) => !isSpouseRelation(child.relation));
      }

      const activeChildren = children.filter((child) => !isRenounced(child, contextDate));
      const qualifiedChildren = activeChildren.filter((child) => isEligibleSubstitutionHeir(child, target, contextDate, { isBefore }));

      if (emitWarning && activeChildren.length > 0 && qualifiedChildren.length === 0) {
        warnIneligibleSubstitutionBranch(target, contextDate, activeChildren);
      }

      return qualifiedChildren;
    };

    if (!node.isExcluded) {
      if (node.isDeceased && !node.deathDate) {
        //  피상속인(root)은 App.jsx의 smartGuides에서 이미 처리하므로 여기서는 일반 상속인만 체크
        if (node.id !== 'root') {
          warnings.push({ id: node.id, text: `[${node.name || '이름 미상'}]의 사망일자가 입력되지 않았습니다.` });
        }
      }
      if (node.id !== 'root' && node.isDeceased && node.deathDate && isBefore(node.deathDate, inheritedDate)) {
        const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
        if (activeHeirs.length === 0) {
          // [v4.12] 하위 데이터가 없으면 전역 추적을 시작하므로 경고를 경감하거나 자동 배분됨을 안내
          // warnings.push({ id: node.id, text: `[${node.name}] 사망(${node.deathDate})에 따른 하위 상속인 정보가 없습니다.` });
        }
      }
    }

    if (!node.isDeceased && !(node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) || node.id === 'root') {
      if (node.id !== 'root') {
        results.push({
          id: node.id,
          personId: getPersonKey(node),
          name: node.name,
          n: inN,
          d: inD,
          relation: node._origRelation || node.relation,
          isDeceased: !!node.isDeceased,
        });
      }
      if (!node.isDeceased && !isDisqualifiedOrLost) return;
    }

    if (isDisqualifiedOrLost) {
      results.push({
        id: node.id,
        personId: getPersonKey(node),
        name: node.name,
        n: 0,
        d: 1,
        relation: node._origRelation || node.relation,
        isDeceased: !!node.isDeceased,
      });
    }

    if (isRenounced(node, inheritedDate)) return;

    let targetHeirs = (node.heirs || []).filter(h => !isRenounced(h, distributionDate)); 

    if (isDisqualifiedOrLost && !isBefore(tree.deathDate || distributionDate, '2024-04-25')) {
      targetHeirs = targetHeirs.filter(h => !isSpouseRelation(h.relation));
    }
    const originalChildren = (node.heirs || []).filter(h => h.relation === 'son' || h.relation === 'daughter');
    const renouncedChildrenCount = originalChildren.filter(isRenounced).length;
    const isAllChildrenRenounced = originalChildren.length > 0 && renouncedChildrenCount === originalChildren.length;
    const spouseInHeirs = (node.heirs || []).find(h => (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && !isRenounced(h));

    if (isAllChildrenRenounced) {
      if (spouseInHeirs && law === '1991') {
        targetHeirs = [spouseInHeirs];
      } else if (!spouseInHeirs) {
        let grandchildren = [];
        originalChildren.forEach(child => {
           if (child.heirs) grandchildren = grandchildren.concat(child.heirs.filter(h => !isRenounced(h)));
        });
        if (grandchildren.length > 0) targetHeirs = grandchildren;
      }
    }

    if (targetHeirs.length === 0 && isSubstitutionTrigger(node, { isSpouseRelation }) && node.id !== 'root') {
      const borrowed = findHeirsByName(tree, node.name, node.id);
      if (borrowed && borrowed.length > 0) {
        targetHeirs = borrowed.filter(h => !isRenounced(h));
      }
    }

    // [v4.12] 전역 계보 추적 엔진: 여전히 상속인이 없다면 법정 순위(부모/형제)로 자동 이전
    // ※ successorStatus === 'confirmed_no_substitute_heirs': 사용자가 명시적으로 "후속 상속인 없음"을
    //   확정한 경우 자동 탐색을 건너뜀. 이를 무시하면 엔진이 형제자매를 자동 배분하여 의도치 않은 결과 발생.
    if (targetHeirs.length === 0 && !isSubstitution && node.id !== 'root' && !isRenounced(node, inheritedDate) && node.successorStatus !== 'confirmed_no_substitute_heirs') {
      const globalSuccessors = findGlobalSuccessors(tree, node).filter(h => !isRenounced(h, distributionDate));
      if (globalSuccessors.length > 0) {
        // 구민법 시대에 출가녀 감산 대상 자매가 있으면 이름 목록 추가
        let reducedNote = '';
        if (law !== '1991') {
          const reducedNames = globalSuccessors.filter(s => {
            if (s._origRelation !== 'daughter') return false;
            let isMarried = s.isSameRegister === false;
            if (s.marriageDate && distributionDate) isMarried = !isBefore(distributionDate, s.marriageDate);
            if (s.restoreDate && distributionDate && !isBefore(distributionDate, s.restoreDate)) isMarried = false;
            return isMarried;
          }).map(s => `[${s.name || '이름 미상'}]`);
          if (reducedNames.length > 0) {
            reducedNote = ` ${reducedNames.join(', ')}은(는) 비동일가적으로 감산되었습니다.`;
          }
        }
        pushWarning({
          code: 'auto-sibling-redistribution',
          severity: 'info',
          blocking: false,
          id: node.id,
          personId: node.personId || node.id,
          targetTabId: node.personId || node.id,
          text: `[${node.name || '이름 미상'}]의 후속 상속인이 없어 형제자매(차순위)에게 자동 분배되었습니다. 실제 상속인과 다를 경우 해당 탭에서 후속 상속인을 직접 입력해 주세요.${reducedNote}`,
        });
      }
      targetHeirs = globalSuccessors;
    }

    if (targetHeirs.length === 0) {
      if (node.id === 'root') return;

      if (!node.isExcluded) {
        const isSubstitution = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);
        if (isSubstitution) return; 
        
        results.push({
          id: node.id,
          personId: getPersonKey(node),
          name: node.name,
          n: inN,
          d: inD,
          relation: node._origRelation || node.relation,
          isDeceased: !!node.isDeceased,
        });
        return; 
      }
      return; 
    }
    
    appliedLaws.add(law);

    const hojuContext = getHojuBonusContext({ node, isSubstitution, parentDecName });
    if (
      hojuContext.nodeAllowsHoju &&
      (law === '1960' || law === '1979') &&
      !hojuContext.primaryHojuSuccessor &&
      node.exclusionOption !== 'blocked_husband_substitution'
    ) {
      const warningKey = node.id || getPersonKey(node);
      if (warningKey && !hojuSelectionWarned.has(warningKey)) {
        hojuSelectionWarned.add(warningKey);
        pushWarning(buildMissingPrimaryHojuWarning({ node, getPersonKey }));
      }
    }

    let total = 0;
    const activeRank = determineActiveRank(targetHeirs);
    
    targetHeirs.forEach(h => {
      const share = assignHeirShare(h, {
        activeRank,
        distributionDate,
        inheritedDate,
        isBefore,
        isDisqualifiedOrLost,
        isSubstitution,
        law,
        node,
        hojuContext,
        canApplyHojuBonus,
        getHojuBonusReason,
      });

      h.r = share.shareWeight;
      h.ex = share.exclusionReason;
      h.modifierReason = share.modifierReason;
      
      if (h.r !== undefined) {
         total += h.r;
      }
    });

    if (total > 0) {
      const step = includeCalcSteps ? { dec: node, inN, inD, dists: [], lawEra: law, parentDecName } : null;
      const childrenToTraverse = [];

      targetHeirs.forEach(h => {
        if (h.r === 0 || h.r === undefined) {
          if (step) step.dists.push({ h, n: 0, d: 1, sn: 0, sd: 1, rSnap: 0, ex: h.ex, mod: h.modifierReason });
        } else {
          const [sn, sd] = math.simplify(h.r * 100, total * 100);
          const [nn, nd] = math.multiply(inN, inD, sn, sd);
          // rSnap: 계산 시점의 h.r 스냅샷 보존 (이후 traverse가 h.r을 덮어써도 merge에서 올바른 값 사용)
          if (step) step.dists.push({ h, n: nn, d: nd, sn, sd, rSnap: h.r, mod: h.modifierReason });
          childrenToTraverse.push({ h, nn, nd });
        }
      });
      if (step) steps.push(step);
      childrenToTraverse.forEach(child => { 
        traverse(child.h, child.nn, child.nd, distributionDate, currentVisited, node.name || '피상속인'); 
      });
    }
  };

  const initN = Math.max(1, Number(tree.shareN) || 1);
  const initD = Math.max(1, Number(tree.shareD) || 1);
  traverse(tree, initN, initD, tree.deathDate, []);
  
  const { mergedSteps, stepByPersonId } = mergeCalcSteps(steps, { getPersonKey, math });
  steps = mergedSteps;
  
  const mergedAll = [];
  results.forEach(r => {
    const ex = mergedAll.find(m => m.personId === r.personId);
    if (ex) { 
      const [nn, nd] = math.add(ex.n, ex.d, r.n, r.d); 
      ex.n = nn; ex.d = nd; 
    } else { mergedAll.push({...r}); }
  });

  const transitShares = mergedAll
    .filter((m) => m.isDeceased && m.n > 0)
    .map((m) => ({ ...m }));

  const merged = mergedAll.filter((m) => !m.isDeceased && m.n > 0);

  let commonD = 1;
  merged.forEach(m => { if (m.n > 0) commonD = math.lcm(commonD, m.d); });
  merged.forEach(m => {
    if (m.n === 0) { m.un = 0; m.ud = commonD; } 
    else { const multiplier = commonD / m.d; m.un = m.n * multiplier; m.ud = commonD; }
  });

  const categoryMap = {};
  tree.heirs.forEach((h, idx) => {
    if (!h.isDeceased) categoryMap[getPersonKey(h)] = { type: 'direct', order: idx };
  });

  const buildCategory = (node, branchRoot, order) => {
    if (!node.heirs) return;
      node.heirs.forEach(h => {
        if (!h.isDeceased && h.name && h.name.trim() !== '') {
          const personKey = getPersonKey(h);
          if (!categoryMap[personKey]) {
            categoryMap[personKey] = {
              type: 'sub',
              ancestor: branchRoot,
              ancestorKey: getPersonKey(branchRoot),
              order: order,
            };
          }
        }
        if (h.isDeceased) {
        buildCategory(h, branchRoot, order);
      }
    });
  };

  tree.heirs.forEach((h, idx) => {
    const isBloodPillar = !(h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse');
    
    if (h.isDeceased && isBloodPillar) {
      buildCategory(h, h, idx);
    } else if (!h.isDeceased) {
      categoryMap[getPersonKey(h)] = { type: 'direct', order: idx };
    }
  });

  const directShares = [];
  const subMap = {};

  merged.forEach(m => {
    const cat = categoryMap[m.personId];
    if (!cat || cat.type === 'direct') { directShares.push(m); } 
    else {
      const ancestorKey = cat.ancestorKey || getPersonKey(cat.ancestor);
      if (!subMap[ancestorKey]) subMap[ancestorKey] = { ancestor: cat.ancestor, order: cat.order, shares: [] };
      subMap[ancestorKey].shares.push(m);
    }
  });

  const subGroups = Object.values(subMap).sort((a, b) => a.order - b.order);
  
  //  중복 에러 제거 (객체 형태 지원)
  const uniqueWarnings = dedupeWarnings(warnings);

  const finalShares = { direct: directShares, subGroups: subGroups };

  Object.values(subMap).forEach((group) => {
    const ancestorKey = getPersonKey(group.ancestor);
    const ancestorStep = stepByPersonId[ancestorKey];
    if (ancestorStep?.mergeSources) {
      group.sourceBreakdown = {
        mergeSources: ancestorStep.mergeSources,
        sourceBreakdowns: ancestorStep.sourceBreakdowns || [],
      };
    }
  });

  const integrity = auditInheritanceResult({
    tree,
    finalShares,
    transitShares,
    warnings: uniqueWarnings,
  });
  const blockingIssues = integrity.blockingIssues || [];
  const repairHints = integrity.repairHints || [];

  let status = 'success';
  if (!tree?.deathDate) {
    status = 'blocked';
  } else if (blockingIssues.length > 0) {
    status = integrity.hasTotalMismatch ? 'partial' : 'blocked';
  } else if (uniqueWarnings.length > 0) {
    status = 'partial';
  }

  return {
    status,
    finalShares,
    transitShares,
    calcSteps: includeCalcSteps ? steps : [],
    issues: integrity.issues,
    blockingIssues,
    repairHints,
    integrity,
    warnings: uniqueWarnings, //  업그레이드된 에러 배열 내보내기
    appliedLaws: Array.from(appliedLaws).sort()
  };
};
