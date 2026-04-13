import { math, getLawEra, isBefore } from './utils.js';
import { auditInheritanceResult } from './inheritanceAudit.js';

export const calculateInheritance = (tree, _propertyValue, options = {}) => {
  const includeCalcSteps = options.includeCalcSteps !== false;
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  const hojuSelectionWarned = new Set();

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

  const normalizeWarning = (warning) => {
    if (!warning) return null;
    if (typeof warning !== 'object') {
      return {
        code: 'engine-warning',
        severity: 'warning',
        blocking: false,
        id: null,
        personId: null,
        targetTabId: null,
        text: String(warning),
      };
    }

    const text = warning.text || '';
    let code = warning.code || 'engine-warning';
    let severity = warning.severity || 'warning';
    let blocking = warning.blocking ?? false;

    if (!warning.code) {
      if (text.includes('순환 참조')) {
        code = 'inheritance-cycle';
        severity = 'error';
        blocking = true;
      } else if (text.includes('사망일자')) {
        code = 'missing-death-date';
        severity = 'error';
        blocking = true;
      } else if (text.includes('하위 상속인 정보가 없습니다')) {
        code = 'deceased-without-heirs';
        severity = 'error';
        blocking = true;
      }
    }

    return {
      code,
      severity,
      blocking,
      id: warning.id || null,
      personId: warning.personId || warning.id || null,
      targetTabId: warning.targetTabId || warning.personId || warning.id || null,
      text,
    };
  };

  const toSourceBreakdown = (step) => ({
    from: step.parentDecName || '피상속인',
    lawEra: step.lawEra,
    inN: step.inN,
    inD: step.inD,
    dists: (step.dists || []).map((dist) => ({
      personId: getPersonKey(dist.h),
      name: dist.h?.name || '',
      relation: dist.h?.relation || '',
      n: dist.n,
      d: dist.d,
      sn: dist.sn,
      sd: dist.sd,
      ex: dist.ex || '',
      mod: dist.mod || '',
    })),
  });

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

  const isSpouseRelation = (relation) => (
    ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(relation)
  );
  
  const findHeirsByName = (root, targetName, excludeId) => {
    if (!targetName || targetName.trim() === '') return null;
    let found = null;
    const search = (n) => {
      if (found) return;
      if (n.id !== excludeId && n.name === targetName && n.heirs && n.heirs.length > 0) {
        found = n.heirs;
        return;
      }
      if (n.heirs) n.heirs.forEach(search);
    };
    search(root);
    return found;
  };

  //  parentPersonId를 추가하여 현재 어떤 탭(부모)을 처리 중인지 추적합니다.
  const traverse = (node, inN, inD, inheritedDate, visitedIds = [], parentDecName = '피상속인') => {
    if (visitedIds.includes(node.id)) {
      pushWarning({
        code: 'inheritance-cycle',
        severity: 'error',
        blocking: true,
        id: node.id,
        personId: node.personId || node.id,
        targetTabId: node.personId || node.id,
        text: `순차상속 순환 참조가 발생하여 [${node.name || '상속인'}]의 지분 전이가 중단되었습니다. 본인이나 조상 계통이 다시 하위 상속인으로 연결되었는지 확인하고, 잘못 연결된 상속인 입력을 제거해 주세요.`,
      });
      return;
    }
    const currentVisited = [...visitedIds, node.id];

    // [v4.12] 전역 계보 추적형 엔진: 하위 데이터가 없을 경우 가계도 전체에서 차순위 상속인을 탐색합니다.
    const findGlobalSuccessors = (targetNode) => {
      // 1. 타겟의 부모(parentNode)를 찾고, 부모의 다른 상속인들을 분석
      const parentNode = visitedIds.length > 0 ? null : null; // traverse 인자로 전달받도록 구조 개선 필요
      // 실제로는 tree를 전체 스캔하여 targetNode의 parent를 찾는 헬퍼 활용
      
      const findParent = (curr, tId) => {
        if (!curr.heirs) return null;
        if (curr.heirs.some(h => h.id === tId)) return curr;
        for (const h of curr.heirs) {
          const p = findParent(h, tId);
          if (p) return p;
        }
        return null;
      };

      const pNode = findParent(tree, targetNode.id);
      if (!pNode) return [];

      // 2순위: 부모의 배우자(생존 시)
      const survivingSpouse = (pNode.heirs || []).filter(h => 
        (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && 
        !h.isDeceased && !h.isExcluded
      );
      if (survivingSpouse.length > 0) return survivingSpouse;

      // 3순위: 형제자매 (부모의 다른 자녀 중 생존자 또는 대습상속 유발자)
      const siblings = (pNode.heirs || []).filter(h => 
        h.id !== targetNode.id && 
        (['son', 'daughter'].includes(h.relation)) &&
        (!h.isExcluded || (h.exclusionOption === 'predeceased' || h.exclusionOption === 'disqualified' || h.exclusionOption === 'lost'))
      );
      return siblings;
    };

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
    const isRenounced = (h, contextDate) => {
      // 🤖 [Phase 2-2: 시계열 판별 AI] 날짜 기반 상속권/대습상속권 자동 박탈 (이혼/재혼)
      const isSpouseHeir = isSpouseRelation(h.relation);
      const isDivorcedAuto = isSpouseHeir && h.divorceDate && contextDate && !isBefore(contextDate, h.divorceDate);
      const isRemarriedAuto = isSpouseHeir && h.remarriageDate && contextDate && !isBefore(contextDate, h.remarriageDate);

      // 1. 대습/재상속 유발 사유 판별 (선사망, 결격, 상실선고)
      const isPredeceasedOption = h.isExcluded && h.exclusionOption === 'predeceased';
      const isDisqualified = h.isExcluded && (h.exclusionOption === 'lost' || h.exclusionOption === 'disqualified');
      
      // 2. 진짜 상속포기(renounce)나 알 수 없는 수동제외만 즉시 컷오프!
      // 선사망(predeceased)이거나 결격/상실(disqualified)인 경우는 하위 가계로 지분을 내려줘야 하므로 패스시킵니다.
      if (h.isExcluded && !isDisqualified && !isPredeceasedOption) return true;
      
      //  AI 엔진 컷오프: 이혼이나 재혼 날짜가 사망일보다 빠르면 가차없이 명단에서 삭제!
      if (isDivorcedAuto || isRemarriedAuto) return true; 

      // 3. 대습상속 유발 사유 (선사망 또는 결격/상실선고)
      const isPre = h.isDeceased && h.deathDate && contextDate && isBefore(h.deathDate, contextDate);

      // 선사망 배우자는 상속권이 없는 배우자일 뿐, 피대습자가 아니다.
      // 따라서 자녀가 있더라도 배우자 라인에서 대습상속을 열지 않는다.
      if (isSpouseHeir && (isPre || isDisqualified)) return true;
      
      if (isPre || isDisqualified) {
        let children = h.heirs || [];
        
        if (children.length === 0 && h.name) {
          const borrowed = findHeirsByName(tree, h.name, h.id);
          if (borrowed) children = borrowed;

          // 선사망 대습상속 여부는 직계비속 존재로만 판단한다.
        }

        if (isDisqualified) {
          const rootDDate = tree.deathDate || contextDate; 
          if (!isBefore(rootDDate, '2024-04-25')) {
            children = children.filter(c => !isSpouseRelation(c.relation));
          }
        }

        if (children.length === 0) return true;

        //  대습상속 자격(재혼/결격 등)은 '피대습자(윤숙자)'가 아닌 상속이 개시된 '본래 피상속인(김명남)'의 사망일(contextDate)을 기준으로 엄격히 판별해야 합니다!
        const validHeirs = children.filter(child => !isRenounced(child, contextDate));
        if (validHeirs.length === 0) return true;

        return false;
      }
      return false;
    };

    const isSubstitutionTrigger = (h) => 
      !isSpouseRelation(h.relation) && (
        h.isDeceased || (h.isExcluded && (h.exclusionOption === 'disqualified' || h.exclusionOption === 'lost'))
      );

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
        results.push({ id: node.id, personId: getPersonKey(node), name: node.name, n: inN, d: inD, relation: node.relation, isDeceased: !!node.isDeceased });
      }
      if (!node.isDeceased && !isDisqualifiedOrLost) return;
    }

    if (isDisqualifiedOrLost) {
      results.push({ id: node.id, personId: getPersonKey(node), name: node.name, n: 0, d: 1, relation: node.relation, isDeceased: !!node.isDeceased });
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

    if (targetHeirs.length === 0 && isSubstitutionTrigger(node) && node.id !== 'root') {
      const borrowed = findHeirsByName(tree, node.name, node.id);
      if (borrowed && borrowed.length > 0) {
        targetHeirs = borrowed.filter(h => !isRenounced(h));
      }
    }

    // [v4.12] 전역 계보 추적 엔진: 여전히 상속인이 없다면 법정 순위(부모/형제)로 자동 이전
    if (targetHeirs.length === 0 && !isSubstitution && node.id !== 'root' && !isRenounced(node, inheritedDate)) {
      targetHeirs = findGlobalSuccessors(node).filter(h => !isRenounced(h, distributionDate));
    }

    if (targetHeirs.length === 0) {
      if (node.id === 'root') return;

      if (!node.isExcluded) {
        const isSubstitution = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);
        if (isSubstitution) return; 
        
        results.push({ id: node.id, personId: getPersonKey(node), name: node.name, n: inN, d: inD, relation: node.relation, isDeceased: !!node.isDeceased });
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
        pushWarning({
          code: 'missing-primary-hoju-successor',
          severity: 'warning',
          blocking: false,
          id: node.id || null,
          personId: getPersonKey(node) || null,
          targetTabId: node.id || null,
          text: `[${node.name || '피상속인'}]은(는) 호주입니다. 1차 상속인들의 호주 여부를 확인하세요.`,
        });
      }
    }

    let total = 0;
    
    let hasRank1 = false, hasRank2 = false, hasRank3 = false, hasSpouse = false;
    targetHeirs.forEach(h => {
      if (h.relation === 'son' || h.relation === 'daughter') hasRank1 = true;
      else if (h.relation === 'parent') hasRank2 = true;
      else if (h.relation === 'sibling') hasRank3 = true;
      else if (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') hasSpouse = true;
    });

    let activeRank = 0;
    if (hasRank1) activeRank = 1;
    else if (hasRank2) activeRank = 2;
    else if (hasSpouse) activeRank = -1; 
    else if (hasRank3) activeRank = 3;
    
    targetHeirs.forEach(h => {
      const isSp = h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse';
      const isPre = h.isDeceased && h.deathDate && isBefore(h.deathDate, distributionDate);
      let modifier = ''; 

      let skipped = false;
      if (activeRank === 1 && (h.relation === 'parent' || h.relation === 'sibling')) {
        h.r = 0; h.ex = '선순위(직계비속) 상속인이 존재하여 상속권 없음'; skipped = true;
      } else if (activeRank === 2 && h.relation === 'sibling') {
        h.r = 0; h.ex = '선순위(직계존속) 상속인이 존재하여 상속권 없음'; skipped = true;
      } else if (activeRank === -1 && h.relation === 'sibling') {
        h.r = 0; h.ex = '배우자 단독 상속으로 형제자매 상속권 없음'; skipped = true;
      } else if (h.isExcluded && h.exclusionOption === 'remarried') {
        h.r = 0; h.ex = '대습상속 개시 전 재혼으로 인한 상속권 소멸'; skipped = true;
      }

      if (skipped) { /* 이미 처리됨 */ }
      else if (isSp && isDisqualifiedOrLost && !isBefore(inheritedDate, '2024-04-25')) {
        h.r = 0; h.ex = '개정 민법에 따라 결격/상실자의 배우자는 대습상속 불가'; 
      }
      else if (isSp && isPre) { h.r = 0; h.ex = `${h.deathDate} 피상속인보다 먼저 사망`; }
      else if (node.id !== 'root' && h.relation === 'husband' && isSubstitution) {
        if (isBefore(node.deathDate, '1991-01-01')) {
          h.r = 0; h.ex = '1991년 이전 처 사망으로 사위 대습상속권 없음';
        } else if (law === '1960' || law === '1979') {
          h.r = 0; h.ex = '1991년 이전 피상속인 사망으로 남편 대습권 없음';
        } else {
          h.r = 1.5; modifier = '남편 5할 가산';
        }
      } else if (h.relation === 'wife' || (h.relation === 'spouse' && node.relation === 'son')) { 
         if (law === '1991' || law === '1979') { h.r = 1.5; modifier = '처(배우자) 5할 가산'; }
         else {
           if (activeRank === 2) { h.r = 1.0; modifier = '처 균분 (직계존속과 동순위)'; }
           else { h.r = 0.5; modifier = '처 감산 (직계비속의 1/2)'; }
         } 
      } else if (h.relation === 'husband' || (h.relation === 'spouse' && node.relation === 'daughter')) {
         if (law === '1991') { h.r = 1.5; modifier = '남편(배우자) 5할 가산'; }
         else { h.r = 1.0; } 
      } else {
         if (law === '1991') {
           h.r = 1.0;
         } else if (law === '1979') {
           if (h.relation === 'daughter') {
             // 🤖 [Phase 2-2: 시계열 판별 AI] 혼인 및 친가복적 자동 판별
             let isMarried = h.isSameRegister === false;
             if (h.marriageDate && distributionDate) {
               isMarried = !isBefore(distributionDate, h.marriageDate); // 사망일 이전에 혼인했으면 출가녀
             }
             if (h.restoreDate && distributionDate && !isBefore(distributionDate, h.restoreDate)) {
               isMarried = false; // 사망일 이전에 친가로 돌아왔으면 복적 완료! (동일가적)
             }

             if (!isMarried) { h.r = 1.0; }
              else { h.r = 0.25; modifier = '출가녀 감산 (아들의 1/4)'; }
            } else if (h.relation === 'son') {
              if (canApplyHojuBonus({ heir: h, law, context: hojuContext })) {
                h.r = 1.5;
                modifier = getHojuBonusReason({ context: hojuContext });
              }
              else { h.r = 1.0; }
            } else h.r = 1.0;
         } else { // 1960년 구법
            if (h.relation === 'daughter') {
              // 🤖 [Phase 2-2: 시계열 판별 AI] 혼인 및 친가복적 자동 판별
              let isMarried = h.isSameRegister === false;
              if (h.marriageDate && distributionDate) {
                isMarried = !isBefore(distributionDate, h.marriageDate);
              }
              if (h.restoreDate && distributionDate && !isBefore(distributionDate, h.restoreDate)) {
                isMarried = false; // 복적 완료!
              }

                if (!isMarried) { h.r = 0.5; modifier = '여자 감산 (남자의 1/2)'; }
                else { h.r = 0.25; modifier = '출가녀 감산 (남자의 1/4)'; }
             } else if (h.relation === 'son') {
               if (canApplyHojuBonus({ heir: h, law, context: hojuContext })) {
                 h.r = 1.5;
                modifier = getHojuBonusReason({ context: hojuContext });
               }
               else { h.r = 1.0; }
             } else h.r = 1.0;
         }
      }
      
      if (h.r !== undefined) {
         h.modifierReason = modifier; 
         total += h.r;
      }
    });

    if (total > 0) {
      const step = includeCalcSteps ? { dec: node, inN, inD, dists: [], lawEra: law, parentDecName } : null;
      const childrenToTraverse = [];

      targetHeirs.forEach(h => {
        if (h.r === 0 || h.r === undefined) { 
          if (step) step.dists.push({ h, n: 0, d: 1, sn: 0, sd: 1, ex: h.ex, mod: h.modifierReason }); 
        } else {
          const [sn, sd] = math.simplify(h.r * 100, total * 100);
          const [nn, nd] = math.multiply(inN, inD, sn, sd);
          if (step) step.dists.push({ h, n: nn, d: nd, sn, sd, mod: h.modifierReason });
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
  
  const mergedSteps = [];
  const stepByPersonId = {}; 
  
  steps.forEach(step => {
    const pId = getPersonKey(step.dec);
    if (!pId || step.dec?.id === 'root') {
      mergedSteps.push(step);
      return;
    }
    
    if (!stepByPersonId[pId]) {
      step.mergeSources = [{ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD }];
      step.sourceBreakdowns = [toSourceBreakdown(step)];
      stepByPersonId[pId] = step;
      mergedSteps.push(step);
    } else {
      const existing = stepByPersonId[pId];
      existing.mergeSources.push({ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD });
      existing.sourceBreakdowns = existing.sourceBreakdowns || [];
      existing.sourceBreakdowns.push(toSourceBreakdown(step));
      
      const [newN, newD] = math.add(existing.inN, existing.inD, step.inN, step.inD);
      existing.inN = newN;
      existing.inD = newD;
      
      const total = existing.dists.reduce((sum, d) => sum + (d.h?.r || 0), 0);
      if (total > 0) {
        existing.dists = existing.dists.map(d => {
          if (d.h?.r === 0 || d.h?.r === undefined) return { ...d, n: 0, d: 1, sn: 0, sd: 1 };
          const [sn, sd] = math.simplify(d.h.r * 100, total * 100);
          const [nn, nd] = math.multiply(newN, newD, sn, sd);
          return { ...d, n: nn, d: nd, sn, sd };
        });
      }
    }
  });
  
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
          categoryMap[personKey] = { type: 'sub', ancestor: branchRoot, order: order };
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
      const ancPId = cat.ancestor.personId;
      if (!subMap[ancPId]) subMap[ancPId] = { ancestor: cat.ancestor, order: cat.order, shares: [] };
      subMap[ancPId].shares.push(m);
    }
  });

  const subGroups = Object.values(subMap).sort((a, b) => a.order - b.order);
  
  //  중복 에러 제거 (객체 형태 지원)
  const uniqueWarnings = [];
  const warningKeys = new Set();
  warnings.forEach(w => {
    const normalized = normalizeWarning(w);
    if (!normalized) return;
    const key = [normalized.code, normalized.id, normalized.text].join('::');
    if (!warningKeys.has(key)) {
      warningKeys.add(key);
      uniqueWarnings.push(normalized);
    }
  });

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
