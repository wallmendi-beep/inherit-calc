import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';

// 紐⑤뱢 ?덈꺼 ?곸닔: tree媛 null?닿굅??鍮꾩뼱?덉쓣 ????긽 ?숈씪??李몄“瑜?諛섑솚??
const EMPTY_GUIDE_STATE = {
  showGlobalWarning: false,
  showAutoCalcNotice: false,
  globalMismatchReasons: [],
  autoCalculatedNames: [],
  smartGuides: [],
  noSurvivors: false,
  hasActionItems: false,
  auditActionItems: [],
  repairHints: [],
};

export const useSmartGuide = (tree, finalShares, activeTab, warnings, transitShares, importIssues) => {
  return useMemo(() => {
    if (!tree) {
      return EMPTY_GUIDE_STATE;
    }
    const isInputMode = activeTab === 'input';

    // [v4.32] 珥덇린 ?곹깭(湲곗큹 ?뺣낫 誘몄엯?? 理쒖슦??媛?대뱶
    if (!tree.name?.trim() || !tree.deathDate) {
      return {
        showGlobalWarning: false,
        showAutoCalcNotice: false,
        globalMismatchReasons: [],
        autoCalculatedNames: [],
        smartGuides: [{
          id: 'initial-step',
          uniqueKey: 'initial-step',
          type: 'mandatory',
          text: '피상속인 이름과 사망일자를 먼저 입력해 주세요.',
          targetTabId: 'root'
        }],
        noSurvivors: false,
        hasActionItems: true,
        auditActionItems: [],
        repairHints: ['피상속인 이름과 사망일자를 입력하면 상속 가이드가 시작됩니다.'],
      };
    }

    const audit = auditInheritanceResult({ 
      tree, 
      finalShares: finalShares || {}, 
      transitShares: transitShares || [], 
      warnings: warnings || [] 
    });

    const uniqueGuidesMap = new Map();
    const groupedPredeceasedMissingMap = new Map();
    const groupedDirectMissingMap = new Map();
    const groupedNextOrderFemaleMap = new Map();
    let noSurvivors = false;

    // ?ы띁 ?⑥닔 1: 遺紐??몃뱶 李얘린
    const findParentNodeInHook = (root, targetId) => {
      if (root.heirs && root.heirs.some(h => h.id === targetId)) return root;
      if (root.heirs) {
        for (const h of root.heirs) {
          const p = findParentNodeInHook(h, targetId);
          if (p) return p;
        }
      }
      return null;
    };

    // ?ы띁 ?⑥닔 2: ?뱀젙 ?몃뱶 李얘린
    const findNodeInHook = (root, targetPersonId, targetNodeId) => {
      if (!root) return null;
      if ((targetPersonId && root.personId === targetPersonId) || (targetNodeId && root.id === targetNodeId)) return root;
      for (const child of root.heirs || []) {
        const found = findNodeInHook(child, targetPersonId, targetNodeId);
        if (found) return found;
      }
      return null;
    };

    // ?ы띁 ?⑥닔 3: 援ъ“???ㅻ쪟 媛먯? (?먯떇 ?먮━??遺紐???
    const checkStructuralError = (node) => {
      const invalidHeirs = (node.heirs || []).filter(h => ['parent', 'sibling'].includes(h.relation));
      invalidHeirs.forEach(h => {
        uniqueGuidesMap.set(`struct-err-${h.id}`, {
          id: h.id,
          uniqueKey: `struct-err-${h.id}`,
          type: 'mandatory',
          action: 'delete',
          text: `[${h.name || '이름 미상'}]이(가) [${node.name || '부모'}]의 하위 위치에 '부모/형제' 관계로 잘못 입력되어 있습니다. 아래 [삭제] 버튼으로 제거해 주세요.`,
          targetTabId: 'tree',
          targetNodeId: h.id,
          parentNodeId: node.id
        });
      });
      if (node.heirs) node.heirs.forEach(checkStructuralError);
    };

    // ?ы띁 ?⑥닔 4: 媛쒕퀎 ?쒖쇅 ?곹깭 ?덈궡
    const checkIndependentExclusionGuide = (node) => {
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          text: `[${node.name}]은(는) ${optionText} 처리되었습니다. 동일인이 다른 사건에도 있으면 그 사건에서의 제외 여부를 다시 확인해 주세요.`
        });
      }
      if (node.heirs) node.heirs.forEach(checkIndependentExclusionGuide);
    };

    // ?ы띁 ?⑥닔 5: 以묐났 諛곗슦??寃??
    const checkDuplicateSpouseGuide = (node) => {
      const spouses = (node.heirs || []).filter((h) => {
        if (!['wife', 'husband', 'spouse'].includes(h.relation)) return false;
        if (h.isExcluded === true) return false;
        if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
        return true;
      });
      if (spouses.length > 1) {
        const spouseNames = spouses.map((spouse) => spouse.name || '이름 미상');
        uniqueGuidesMap.set(`multi-spouse-${node.personId || node.id}`, {
          id: node.id,
          uniqueKey: `multi-spouse-${node.personId || node.id}`,
          targetTabId: node.personId || node.id || 'root',
          type: 'mandatory',
          text: `[${node.name || '이름 미상'}]에게 유효 배우자가 중복 입력되어 있습니다. 현재 배우자: [${spouseNames.join('], [')}]. 실제 상속받는 1명만 남기고 나머지는 제외 처리해 주세요.`,
        });
      }
      if (node.heirs) node.heirs.forEach(checkDuplicateSpouseGuide);
    };

    // ?ы띁 ?⑥닔 6: ?몃뱶蹂?媛?대뱶 ?앹꽦 (硫붿씤 濡쒖쭅)
    const checkGuideNode = (node, parentDate) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';
      const effectiveDate = node.deathDate || tree.deathDate;
      const isBlockedHusbandSubstitution = node.exclusionOption === 'blocked_husband_substitution';
      const isHardExcluded = node.isExcluded && [
        'lost', 'disqualified', 'remarried', 'renounce', 'blocked_husband_substitution'
      ].includes(node.exclusionOption || '');
      const hasConfirmedNoSuccessors = !!node.successorStatus;
      const isLegacyFemale = getLawEra(effectiveDate) !== '1991' && node.relation === 'daughter';

      if (hasConfirmedNoSuccessors && parentNode && getLawEra(effectiveDate) !== '1991') {
        const siblingCandidates = (parentNode.heirs || []).filter((h) => h.id !== node.id && ['son', 'daughter'].includes(h.relation));
        const femaleCandidatesNeedingReview = siblingCandidates.filter((h) => {
          if (h.relation !== 'daughter') return false;
          if (h.isExcluded) return false;
          if (h.marriageDate || h.divorceDate || h.restoreDate) return false;
          if (h.isSameRegister === false) return false;
          return true;
        });
        if (femaleCandidatesNeedingReview.length > 0) {
          const groupKey = `next-order-female:${node.personId || node.id}`;
          const current = groupedNextOrderFemaleMap.get(groupKey) || {
            decedentName: node.name || '해당 사건',
            // ?ъ꽦 ?뺤젣?먮ℓ??parentNode???먯떇?대?濡?parentNode ??뿉???섏젙
            targetTabId: parentTabId,
            names: [],
          };
          femaleCandidatesNeedingReview.forEach((candidate) => current.names.push(candidate.name || '?대쫫 誘몄긽'));
          groupedNextOrderFemaleMap.set(groupKey, current);
        }
      }

      if ((node.isDeceased || node.id === 'root') && !isHardExcluded) {
        const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
        if (node.id !== 'root' && node.isDeceased && node.deathDate && activeHeirs.length === 0 && !hasConfirmedNoSuccessors) {
          const compareDate = parentDate || tree.deathDate;
          const isPre = compareDate ? isBefore(node.deathDate, compareDate) : false;
          const isChild = ['son', 'daughter'].includes(node.relation);
          const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);

          if (isPre) {
            if (isChild) {
              const groupKey = parentNode?.personId || parentNode?.id || 'root';
              const current = groupedPredeceasedMissingMap.get(groupKey) || {
                parentName: parentNode?.name || tree.name || '현재 계보',
                targetTabId: groupKey,
                firstTargetTabId: node.personId || node.id,
                names: [],
              };
              current.names.push(node.name || '?대쫫 誘몄긽');
              groupedPredeceasedMissingMap.set(groupKey, current);
            }
          } else {
            const contextName = parentNode?.name || tree.name || '현재 계보';
            const groupKey = `${parentNode?.personId || parentNode?.id || 'root'}:${isSpouse ? 'spouse' : 'general'}`;
            const current = groupedDirectMissingMap.get(groupKey) || {
              parentName: contextName,
              targetTabId: parentNode?.personId || parentNode?.id || 'root',
              firstTargetTabId: node.personId || node.id,
              names: [],
              isSpouseGroup: isSpouse,
            };
            current.names.push(node.name || '?대쫫 誘몄긽');
            groupedDirectMissingMap.set(groupKey, current);
          }
        }
        if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
          uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
            id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
            text: `[${node.name || '이름 미상'}]은(는) 사망자로 표시되어 있지만 사망일이 없습니다.`
          });
        }

        const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
        const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들', 'husband'].includes(node.relation));
        if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
          const deathYear = (effectiveDate || '').slice(0, 4);
        uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
            id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory', navigationMode: 'event',
            text: `[${node.name || '이름 미상'}] 사건은 구법(${deathYear}년 사망) 적용 대상입니다. 1차 상속인 중 호주상속인을 지정해 주세요.`
          });
        }

        if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased && !isBlockedHusbandSubstitution) {
          const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
          if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
            uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
              id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended', navigationMode: 'event',
              targetTabId: node.personId,
              text: `[${node.name || '해당 인물'}] 사건은 호주상속 검토 대상입니다. 1차 상속인의 호주상속/재산상속 구분을 확인해 주세요.`
            });
          }
        }

        if (isLegacyFemale && !hasConfirmedNoSuccessors) {
          if (!node.marriageDate && node.isSameRegister !== false) {
            uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
              id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
              targetTabId: parentTabId,
              text: `[${node.name || '이름 미상'}]은(는) 구법 적용 대상 여성 상속인입니다. 혼인 여부에 따라 결과가 달라질 수 있으니, 혼인·이혼·복적 정보를 확인해 주세요.`
            });
          }
        }
      }

      if (node.heirs) {
        const nextParentDate = (node.deathDate && parentDate && isBefore(parentDate, node.deathDate)) ? node.deathDate : parentDate;
        node.heirs.forEach(h => checkGuideNode(h, nextParentDate));
      }
    };

    // 媛?대뱶 寃???ㅽ뻾
    checkStructuralError(tree);
    checkIndependentExclusionGuide(tree);
    checkDuplicateSpouseGuide(tree);
    if (tree.heirs) tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate));

    // 洹몃９?붾맂 媛?대뱶??泥섎━
    groupedPredeceasedMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 1紐낆씠硫??대떦 ?щ쭩??蹂몄씤 ??쑝濡? ?щ윭 紐낆씠硫?遺紐???쑝濡??대룞
      const navTarget = uniqueNames.length === 1 ? group.firstTargetTabId : group.targetTabId;
      uniqueGuidesMap.set(`grouped-missing-substitution-${key}`, {
        id: key, uniqueKey: `grouped-missing-substitution-${key}`, targetTabId: navTarget, type: 'mandatory', navigationMode: 'event',
        text: `${group.parentName} 사건에서 선사망 상속인의 대습상속 검토가 필요합니다: [${uniqueNames.join('], [')}]. 실제로 배우자 또는 직계비속이 있는 사람만 선택해 대습상속인을 입력해 주세요.`, 
      });
    });

    groupedDirectMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 1紐낆씠硫??대떦 ?щ쭩??蹂몄씤 ??쑝濡? ?щ윭 紐낆씠硫?遺紐???쑝濡??대룞
      const navTarget = uniqueNames.length === 1 ? group.firstTargetTabId : group.targetTabId;
      uniqueGuidesMap.set(`grouped-direct-missing-${key}`, {
        id: navTarget, uniqueKey: `grouped-direct-missing-${key}`, targetTabId: navTarget, type: 'mandatory', navigationMode: 'event',
        text: group.isSpouseGroup
          ? `${group.parentName} 사건에서 후속 상속 검토가 필요한 배우자가 있습니다: [${uniqueNames.join('], [')}]. 후속 상속인을 입력하거나 '추가 상속인 없음' 확정 버튼을 눌러 주세요.`
          : `${group.parentName} 사건에서 후속 상속 검토가 필요한 사람이 있습니다: [${uniqueNames.join('], [')}]. 후속 상속인을 입력하거나 '후속 상속인 없음' 확정 버튼을 눌러 주세요.`, 
      });
    });

    groupedNextOrderFemaleMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      uniqueGuidesMap.set(`next-order-female-${key}`, {
        id: group.targetTabId, uniqueKey: `next-order-female-${key}`, targetTabId: group.targetTabId, type: 'recommended', navigationMode: 'event',
        text: `${group.decedentName} 사건은 차순위 상속 검토가 필요합니다. 여성 형제자매 중 동일가적 여부 확인이 필요한 사람이 있습니다: [${uniqueNames.join('], [')}]. 미혼이 확실하면 동일가적으로 두고, 그렇지 않으면 혼인·이혼·복적 정보를 입력해 주세요.`, 
      });
    });

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // 遺덈윭?ㅺ린 ?댁뒋 泥섎━
    (importIssues || []).forEach((issue) => {
      const linkedNode = findNodeInHook(tree, issue.personId, issue.nodeId);
      if (issue.code === 'missing-descendants' && linkedNode && (((linkedNode.heirs || []).length > 0) || !!linkedNode.successorStatus)) {
        return;
      }
      const isLegacyHojuInputCase = issue.code === 'missing-descendants' && linkedNode && !linkedNode.successorStatus && getLawEra(linkedNode.deathDate || tree.deathDate) !== '1991' && ['son', 'husband'].includes(linkedNode.relation);
      const personKey = issue.personId || issue.nodeId || 'root';
      const key = `import-${issue.code}-${personKey}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.nodeId || personKey, uniqueKey: key, personId: issue.personId || '', targetTabId: issue.targetTabId || personKey, targetNodeId: issue.nodeId || '', name: issue.personName || null,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          navigationMode: isLegacyHojuInputCase ? 'event' : 'auto',
          text: isLegacyHojuInputCase
            ? `[${issue.personName || linkedNode?.name || '이름 미상'}] 사건은 호주상속 검토가 필요합니다. 불러오기로 상속인을 확인한 뒤, 호주상속인을 지정해 주세요.`
            : `${issue.message} 입력값을 확인하고 저장한 뒤 계속 진행해 주세요.`,
        });
      }
    });

    // ?붿쭊 寃쎄퀬 ??SmartGuide ?듯빀 (auto-sibling-redistribution ??
    (warnings || []).forEach((warning) => {
      if (warning.code !== 'auto-sibling-redistribution') return;
      const key = `engine-${warning.code}-${warning.personId || warning.targetTabId || 'root'}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: warning.personId || warning.id,
          uniqueKey: key,
          type: 'recommended',
          text: warning.text,
          targetTabId: warning.targetTabId || warning.personId,
          personId: warning.personId || '',
        });
      }
    });

    const smartGuides = Array.from(uniqueGuidesMap.values());
    const globalMismatchReasons = audit.issues.map((issue) => ({
      id: issue.targetTabId || issue.personId || issue.id || 'root',
      text: issue.text,
    }));

    return {
      showGlobalWarning: !isInputMode && audit.issues.length > 0,
      showAutoCalcNotice: false, 
      globalMismatchReasons, 
      autoCalculatedNames: [],
      smartGuides,
      noSurvivors,
      hasActionItems: smartGuides.length > 0 || (!isInputMode && audit.issues.length > 0),
      auditActionItems: !isInputMode ? (audit.entityIssues || []) : [],
      repairHints: !isInputMode ? (audit.repairHints || []) : [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares, importIssues]);
};
