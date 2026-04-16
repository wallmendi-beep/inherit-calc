import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';

// 모듈 레벨 상수: tree가 null이거나 비어있을 때 항상 동일한 참조를 반환해
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

    // [v4.32] 초기 상태(기초 정보 미입력) 최우선 가이드
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
          text: '피상속인의 이름과 사망일자를 먼저 입력해 주세요.',
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

    // 헬퍼 함수 1: 부모 노드 찾기
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

    // 헬퍼 함수 2: 특정 노드 찾기
    const findNodeInHook = (root, targetPersonId, targetNodeId) => {
      if (!root) return null;
      if ((targetPersonId && root.personId === targetPersonId) || (targetNodeId && root.id === targetNodeId)) return root;
      for (const child of root.heirs || []) {
        const found = findNodeInHook(child, targetPersonId, targetNodeId);
        if (found) return found;
      }
      return null;
    };

    // 헬퍼 함수 3: 구조적 오류 감지 (자식 자리에 부모 등)
    const checkStructuralError = (node) => {
      const invalidHeirs = (node.heirs || []).filter(h => ['parent', 'sibling'].includes(h.relation));
      invalidHeirs.forEach(h => {
        uniqueGuidesMap.set(`struct-err-${h.id}`, {
          id: h.id,
          uniqueKey: `struct-err-${h.id}`,
          type: 'mandatory',
          action: 'delete',
          text: `[${h.name || '이름 미상'}]이(가) [${node.name || '부모'}]의 하위 위치에 '부모/형제' 관계로 잘못 입력되었습니다. 아래 [삭제] 버튼으로 제거해 주세요.`,
          targetTabId: 'tree',
          targetNodeId: h.id,
          parentNodeId: node.id
        });
      });
      if (node.heirs) node.heirs.forEach(checkStructuralError);
    };

    // 헬퍼 함수 4: 개별 제외 상태 안내
    const checkIndependentExclusionGuide = (node) => {
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          text: `[${node.name}]은(는) ${optionText} 처리되었습니다. 동일인이 다른 단계에도 있으면 그 단계에서도 제외 여부를 확인해 주세요.`
        });
      }
      if (node.heirs) node.heirs.forEach(checkIndependentExclusionGuide);
    };

    // 헬퍼 함수 5: 중복 배우자 검사
    const checkDuplicateSpouseGuide = (node) => {
      const spouses = (node.heirs || []).filter((h) => {
        if (!['wife', 'husband', 'spouse'].includes(h.relation)) return false;
        if (h.isExcluded === true) return false;
        if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
        return true;
      });
      if (spouses.length > 1) {
        const spouseNames = spouses.map((spouse) => spouse.name || '이름 없음');
        uniqueGuidesMap.set(`multi-spouse-${node.personId || node.id}`, {
          id: node.id,
          uniqueKey: `multi-spouse-${node.personId || node.id}`,
          targetTabId: node.personId || node.id || 'root',
          type: 'mandatory',
          text: `[${node.name || '이름 없음'}]에게 유효 배우자가 중복 입력되어 있습니다. 현재 배우자 [${spouseNames.join('], [')}]. 실제 상속받는 1명만 남기고 나머지는 제외 처리해 주세요.`,
        });
      }
      if (node.heirs) node.heirs.forEach(checkDuplicateSpouseGuide);
    };

    // 헬퍼 함수 6: 노드별 가이드 생성 (메인 로직)
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
            // 여성 형제자매는 parentNode의 자식이므로 parentNode 탭에서 수정
            targetTabId: parentTabId,
            names: [],
          };
          femaleCandidatesNeedingReview.forEach((candidate) => current.names.push(candidate.name || '이름 미상'));
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
              current.names.push(node.name || '이름 미상');
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
            current.names.push(node.name || '이름 미상');
            groupedDirectMissingMap.set(groupKey, current);
          }
        }
        if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
          uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
            id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
            text: `[${node.name || '이름 미상'}]은(는) 사망자로 표시되어 있으나 사망일이 없습니다.`
          });
        }

        const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
        const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들', 'husband'].includes(node.relation));
        if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
          const deathYear = (effectiveDate || '').slice(0, 4);
          uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
            id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
            text: `[${node.name || '이름 없음'}] 단계는 구법(${deathYear}년 사망) 적용 대상입니다. 1차 상속인 중 호주상속인을 지정해 주세요.`
          });
        }

        if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased && !isBlockedHusbandSubstitution) {
          const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
          if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
            uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
              id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended',
              targetTabId: node.personId,
              text: `[${node.name || '해당 인물'}] 단계는 대습 호주상속 검토 대상일 수 있습니다. 1차 상속인의 호주상속/재산상속 토글을 확인해 주세요.`
            });
          }
        }

        if (isLegacyFemale && !hasConfirmedNoSuccessors) {
          if (!node.marriageDate && node.isSameRegister !== false) {
            uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
              id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
              targetTabId: parentTabId,
              text: `[${node.name || '이름 미상'}]은(는) 구법(1990년 이전) 적용 대상 딸입니다. 혼인 여부에 따라 지분이 달라지므로, 기혼이면 혼인일자를 입력하고 미혼 또는 복적 상태면 동일가적 여부를 확인해 주세요.`
            });
          }
        }
      }

      if (node.heirs) {
        const nextParentDate = (node.deathDate && parentDate && isBefore(parentDate, node.deathDate)) ? node.deathDate : parentDate;
        node.heirs.forEach(h => checkGuideNode(h, nextParentDate));
      }
    };

    // 가이드 검사 실행
    checkStructuralError(tree);
    checkIndependentExclusionGuide(tree);
    checkDuplicateSpouseGuide(tree);
    if (tree.heirs) tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate));

    // 그룹화된 가이드들 처리
    groupedPredeceasedMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 1명이면 해당 사망자 본인 탭으로, 여러 명이면 부모 탭으로 이동
      const navTarget = uniqueNames.length === 1 ? group.firstTargetTabId : group.targetTabId;
      uniqueGuidesMap.set(`grouped-missing-substitution-${key}`, {
        id: key, uniqueKey: `grouped-missing-substitution-${key}`, targetTabId: navTarget, type: 'mandatory',
        text: `선사망 상속인 중 대습상속인이 입력되지 않은 사람이 있습니다: [${uniqueNames.join('], [')}]. 실제로 배우자 또는 직계비속이 있는 사람만 선택해 대습상속인을 입력해 주세요.`,
      });
    });

    groupedDirectMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 1명이면 해당 사망자 본인 탭으로, 여러 명이면 부모 탭으로 이동
      const navTarget = uniqueNames.length === 1 ? group.firstTargetTabId : group.targetTabId;
      uniqueGuidesMap.set(`grouped-direct-missing-${key}`, {
        id: navTarget, uniqueKey: `grouped-direct-missing-${key}`, targetTabId: navTarget, type: 'mandatory',
        text: group.isSpouseGroup
          ? `후속 상속인이 직접 입력되지 않은 배우자가 있습니다: [${uniqueNames.join('], [')}]. 후속 상속인을 입력하거나, 없으면 '후속 상속인 없음' 확정 버튼을 눌러 주세요.`
          : `직접 입력된 후속 상속인이 없는 사람이 있습니다: [${uniqueNames.join('], [')}]. 후속 상속인을 입력하거나, 없으면 '후속 상속인 없음' 확정 버튼을 눌러 주세요.`,
      });
    });

    groupedNextOrderFemaleMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      uniqueGuidesMap.set(`next-order-female-${key}`, {
        id: group.targetTabId, uniqueKey: `next-order-female-${key}`, targetTabId: group.targetTabId, type: 'recommended',
        text: `[${group.decedentName}] 사건은 차순위 상속으로 진행됩니다. 여성 형제자매 중 동일가적 여부 확인이 필요한 사람이 있습니다: [${uniqueNames.join('], [')}]. 이미 미혼이 확실하면 동일가적으로 두고, 그렇지 않으면 혼인·이혼·복적 정보를 입력해 주세요.`,
      });
    });

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // 불러오기 이슈 처리
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
          text: isLegacyHojuInputCase
            ? `[${issue.personName || linkedNode?.name || '이름 미상'}] 단계는 호주상속 판단이 필요합니다. 데이터 입력 탭에서 상속인을 확인하고, 호주상속인을 지정해 주세요.`
            : `${issue.message} 입력값을 확인하고 저장한 뒤 계속 진행해 주세요.`,
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
