import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';

// 모듈 레벨 상수: tree가 null이거나 비어있을 때 항상 동일한 참조를 반환해
// App.jsx의 useMemo([guideInfo.smartGuides])가 불필요하게 재실행되지 않도록 한다.
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
          text: '사건번호와 피상속인의 기본정보를 먼저 입력해 주세요.',
          targetTabId: 'root'
        }],
        noSurvivors: false,
        hasActionItems: true,
        auditActionItems: [],
        repairHints: ['피상속인 이름과 사망일자를 입력하면 상속 가이드가 시작됩니다.'],
      };
    }

    const audit = auditInheritanceResult({ tree, finalShares: finalShares || {}, transitShares: transitShares || [], warnings: warnings || [] });

    const uniqueGuidesMap = new Map();
    const groupedPredeceasedMissingMap = new Map();
    const groupedDirectMissingMap = new Map();
    let noSurvivors = false;

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

    const checkIndependentExclusionGuide = (node, level = 0) => {
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          // 동일인 처리 문맥 알림용: targetTabId는 두지 않고 텍스트 가이드만 보여준다.
          text: `[${node.name}]은(는) ${optionText} 처리되었습니다. 동일인이 다른 단계에도 있으면 그 단계에서도 제외 여부를 확인해 주세요.`,
          level, relation: node.relation
        });
      }
      if (node.heirs) node.heirs.forEach(h => checkIndependentExclusionGuide(h, level + 1));
    };

    const checkDuplicateSpouseGuide = (node, level = 0) => {
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
          level,
          text: `[${node.name || '이름 없음'}]에게 유효 배우자가 중복 입력되어 있습니다. 현재 배우자 [${spouseNames.join('], [')}]. 실제 상속받는 1명만 남기고 나머지는 제외 처리해 주세요.`,
        });
      }

      if (node.heirs) node.heirs.forEach((h) => checkDuplicateSpouseGuide(h, level + 1));
    };

    const checkGuideNode = (node, parentDate, level = 0) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';

      const effectiveDate = node.deathDate || tree.deathDate;
      const isBlockedHusbandSubstitution = node.exclusionOption === 'blocked_husband_substitution';
      const isHardExcluded = node.isExcluded && [
        'lost',
        'disqualified',
        'remarried',
        'renounce',
        'blocked_husband_substitution',
      ].includes(node.exclusionOption || '');
      const hasConfirmedNoSuccessors = !!node.successorStatus;

      // 아래 단계에서는 본인 하위 탭이 따로 생성되므로, 하위 가계도 중복 검사는 생략한다.
      if ((node.isDeceased || node.id === 'root') && !isHardExcluded) {
          const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
          if (node.id !== 'root' && node.isDeceased && node.deathDate && activeHeirs.length === 0 && !hasConfirmedNoSuccessors) {
            const compareDate = parentDate || tree.deathDate;
            const isPredeceased = compareDate ? isBefore(node.deathDate, compareDate) : false;
            const isChild = ['son', 'daughter'].includes(node.relation);
            const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);

            let guideText = '';

            if (isPredeceased) {
              if (isChild) {
                const groupKey = parentNode?.personId || parentNode?.id || 'root';
                const current = groupedPredeceasedMissingMap.get(groupKey) || {
                  parentName: parentNode?.name || tree.name || '현재 계보',
                  targetTabId: groupKey,
                  names: [],
                };
                current.names.push(node.name || '이름 미상');
                groupedPredeceasedMissingMap.set(groupKey, current);
                guideText = '';
              } else if (isSpouse) {
                guideText = '';
              }
            } else {
              const contextName = parentNode?.name || tree.name || '현재 계보';
              const groupKey = `${parentNode?.personId || parentNode?.id || 'root'}:${isSpouse ? 'spouse' : 'general'}`;
              const current = groupedDirectMissingMap.get(groupKey) || {
                parentName: contextName,
                targetTabId: parentNode?.personId || parentNode?.id || 'root',
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
          // 1. 배우자 중복 검사
          const spouses = (node.heirs || []).filter((h) => {
              if (!['wife', 'husband', 'spouse'].includes(h.relation)) return false;
              if (h.isExcluded) return false;
              if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
              return true;
          });
          if (spouses.length > 1) {
              uniqueGuidesMap.set(`multi-spouse-${node.personId}`, {
                  id: node.id, uniqueKey: `multi-spouse-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '이름 없음'}]에게 유효 배우자가 중복 입력되어 있습니다. 실제 상속받을 1명 외에는 제외 처리해 주세요.`
              });
          }

          // 2. 구법 호주상속 여부 검사
          const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
          const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들'].includes(node.relation));
          if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
              uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '이름 없음'}] 단계는 구법(${effectiveDate}년 사망) 적용 대상입니다. 1차 상속인 중 호주상속인을 확인해 주세요.`
              });
          }

          // 3. 대습 호주상속 연계 검사(장남/장손 계열)
          if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased && !isBlockedHusbandSubstitution) {
              const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
              if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
                  uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
                      id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended',
                      targetTabId: node.personId,
                      text: `[${node.name || '해당 인물'}] 단계는 대습 호주상속 검토 대상일 수 있습니다. 1차 상속인의 호주상속/재산상속 토글을 확인해 주세요.`,
                      level, relation: node.relation
                  });
              }
          }

          // 4. 구법 딸의 혼인/동일가적 정보가 비어 있을 때 확인 요청
          if (getLawEra(effectiveDate) !== '1991' && node.relation === 'daughter') {
              if (!node.marriageDate && node.isSameRegister !== false) {
                  uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
                      id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
                      targetTabId: parentTabId,
                      text: `[${node.name || '이름 미상'}]은(는) 구법(1990년 이전) 적용 대상 딸입니다. 혼인 여부에 따라 지분이 달라지므로, 기혼이면 혼인일자를 입력하고 미혼 또는 복적 상태면 동일가적 여부를 확인해 주세요.`,
                      level, relation: node.relation
                  });
              }
          }
      }

      if (node.heirs) {
        const nextParentDate = (node.deathDate && parentDate && isBefore(parentDate, node.deathDate)) ? node.deathDate : parentDate;
        node.heirs.forEach(h => checkGuideNode(h, nextParentDate, level + 1));
      }
    };

    checkIndependentExclusionGuide(tree, 0);
    checkDuplicateSpouseGuide(tree, 0);
    if (tree.heirs) { tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate, 0)); }

    groupedPredeceasedMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      uniqueGuidesMap.set(`grouped-missing-substitution-${key}`, {
        id: key,
        uniqueKey: `grouped-missing-substitution-${key}`,
        targetTabId: group.targetTabId,
        type: 'mandatory',
        code: 'grouped-missing-substitution',
        text: `선사망 상속인 중 대습상속인이 입력되지 않은 사람이 있습니다: [${uniqueNames.join('], [')}]. 실제로 배우자 또는 직계비속이 있는 사람만 선택해 대습상속인을 입력해 주세요.`,
      });
    });

    groupedDirectMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      uniqueGuidesMap.set(`grouped-direct-missing-${key}`, {
        id: group.targetTabId,
        uniqueKey: `grouped-direct-missing-${key}`,
        targetTabId: group.targetTabId,
        type: 'mandatory',
        code: 'grouped-direct-missing',
        text: group.isSpouseGroup
          ? `후속 상속인이 직접 입력되지 않은 배우자가 있습니다: [${uniqueNames.join('], [')}]. 필요한 경우 후속 상속인을 입력하고, 미입력 시 [${group.parentName}] 계보 기준 자동 분배 여부를 확인해 주세요.`
          : `직접 입력된 후속 상속인이 없는 사람이 있습니다: [${uniqueNames.join('], [')}]. 필요한 경우 후속 상속인을 입력하고, 그렇지 않으면 자동 분배 결과를 확인해 주세요.`,
      });
    });

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // [v3.1.4] 감사 엔진 이슈를 스마트 가이드에 통합
    (audit.entityIssues || []).forEach((issue) => {
      const personId = issue.personId || issue.id;
      const key = `audit-${issue.code}-${personId}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.id || personId,
          uniqueKey: key,
          personId: personId,
          targetTabId: issue.targetTabId || personId || 'root',
          name: issue.name || null,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          text: issue.text,
          code: issue.code,
          displayTargets: issue.displayTargets || ['guide'],
        });
      }
    });

    (importIssues || []).forEach((issue) => {
      const personKey = issue.personId || issue.nodeId || 'root';
      const key = `import-${issue.code}-${personKey}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.nodeId || personKey,
          uniqueKey: key,
          personId: issue.personId || '',
          targetTabId: issue.targetTabId || personKey,
          targetNodeId: issue.nodeId || '',
          name: issue.personName || null,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          text: `${issue.message} 불러오기 직후 입력값을 확인하고 저장한 뒤 계속 진행해 주세요.`,
          code: `import-${issue.code}`,
          displayTargets: ['guide'],
        });
      }
    });

    const smartGuides = Array.from(uniqueGuidesMap.values());
    
    // UI 표시용으로 필터링된 리스트 생성
    const mandatoryGuides = smartGuides.filter(g => g.type === 'mandatory');
    const recommendedGuides = smartGuides.filter(g => g.type === 'recommended');

    const globalMismatchReasons = audit.issues.map((issue) => ({
      id: issue.targetTabId || issue.personId || issue.id || 'root',
      text: issue.text,
    }));

    return {
      showGlobalWarning: audit.issues.length > 0, 
      showAutoCalcNotice: false, 
      globalMismatchReasons, 
      autoCalculatedNames: [],
      smartGuides, // 전체 리스트(SmartGuidePanel에서 추가 필터링)
      noSurvivors,
      hasActionItems: smartGuides.length > 0 || audit.issues.length > 0,
      auditActionItems: [], // smartGuides로 통합했으므로 빈 배열 반환
      repairHints: audit.repairHints || [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares, importIssues]);
};
