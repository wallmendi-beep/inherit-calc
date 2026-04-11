import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = [], transitShares = []) => {
  return useMemo(() => {
    if (!tree) {
      return {
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
    }

    const audit = auditInheritanceResult({ tree, finalShares, transitShares, warnings });

    const uniqueGuidesMap = new Map();
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
          // 🚨 제자리 부메랑 워프 제거: targetTabId 속성을 삭제하여 단순 알림판 역할만 수행
          text: `[${node.name}] ${optionText}가 적용되었습니다. 타 피상속인 탭에서도 별도로 제외 처리해 주세요.`,
          level, relation: node.relation
        });
      }
      if (node.heirs) node.heirs.forEach(h => checkIndependentExclusionGuide(h, level + 1));
    };

    const checkGuideNode = (node, parentDate, level = 0) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';

      const effectiveDate = node.deathDate || tree.deathDate;

      // 🚨 살아있는 사람은 본인의 하위 탭이 생성되지 않으므로 하위 가계도 검사를 생략함
      if (node.isDeceased || node.id === 'root') {
          const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
          if (node.id !== 'root' && node.isDeceased && node.deathDate && activeHeirs.length === 0) {
            const isPredeceased = isBefore(node.deathDate, tree.deathDate);
            const isChild = ['son', 'daughter', '아들', '딸'].includes(node.relation);
            const isSpouse = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);
            
            let guideText = `[${node.name || '이름 없음'}]은(는) 사망자로 입력되어 있으나 후속 상속인이 없습니다. 배우자/자녀/부모/형제 입력 여부를 확인해 주세요.`;

            if (isPredeceased) {
              if (isChild) {
                guideText = `[${node.name}]님은 피상속인보다 먼저 사망(선사망)했으나 대습상속인(비속/배우자)이 없습니다. 이 경우 상속권이 발생하지 않으므로 [상속권 없음] 상태로 확정해 주세요.`;
              } else if (isSpouse) {
                guideText = `피상속인보다 먼저 사망한 배우자([${node.name}])는 상속권이 발생하지 않습니다. [상속권 없음] 처리를 권장합니다.`;
              }
            } else {
              if (isChild) {
                guideText = `[${node.name}]님은 피상속인 사후 사망자(재상속)이나 자녀/배우자 정보가 없습니다. 무자녀인 경우 고인의 부모/형제를 입력하거나 [상속인 없음] 처리가 필요합니다.`;
              } else if (isSpouse) {
                guideText = `사망한 배우자([${node.name}])의 지분을 상속받을 후속 상속인(직계존속 등)이 없습니다. 지분 전이 경로를 확인해 주세요.`;
              }
            }

            uniqueGuidesMap.set(`missing-successors-${node.personId}`, {
              id: node.id, uniqueKey: `missing-successors-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
              text: guideText
            });
          }
          if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
              uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
                  text: `[${node.name || '?대쫫?놁쓬'}]은(는) 사망자로 표시되어 있으나 사망일이 없습니다.`
              });
          }
          // 1. 배우자 중복 검사
          const spouses = (node.heirs || []).filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded);
          if (spouses.length > 1) {
              uniqueGuidesMap.set(`multi-spouse-${node.personId}`, {
                  id: node.id, uniqueKey: `multi-spouse-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '이름없음'}] 유효 배우자가 중복 입력되었습니다. 실제 상속받을 1명 외에는 제외 처리해 주세요.`
              });
          }

          // 2. 구법 호주 지정 검사
          const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
          const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들'].includes(node.relation));
          if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
              uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '이름없음'}] 구법(${effectiveDate} 사망) 적용 대상입니다. 하위 상속인 중 호주상속인을 지정해 주세요.`
              });
          }

          // 3. 연쇄 호주 승계 팁 (장남/장손)
          if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased) {
              const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
              if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
                  uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
                      id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended',
                      targetTabId: node.personId,
                      text: `[대습 팁] 장남/장손 연쇄 호주 승계 시, 두 사람 모두 [호주상속] 켬 상태 유지를 권장합니다.`,
                      level, relation: node.relation
                  });
              }
          }

          // 4. [구법 데이터 공백 방지] 1990년 이전 사망건의 '딸'인데 혼인 정보가 전혀 없는 경우 확인 요청
          if (getLawEra(effectiveDate) !== '1991' && node.relation === 'daughter') {
              if (!node.marriageDate && node.isSameRegister !== false) {
                  uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
                      id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
                      targetTabId: parentTabId,
                      text: `[${node.name || '이름미상'}] 구법(1990년 이전) 적용 대상입니다. 출가(기혼) 여부에 따라 지분이 크게 달라지므로, 기혼인 경우 [혼인일자]를 입력하거나 [상속권 스위치] 옆의 [동일가적(출가)] 설정을 확인해 주세요.`,
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
    if (tree.heirs) { tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate, 0)); }

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    const smartGuides = Array.from(uniqueGuidesMap.values());
    const auditActionItems = (audit.entityIssues || []).map((issue) => ({
      id: issue.id || issue.personId || issue.targetTabId || issue.code,
      personId: issue.personId || null,
      targetTabId: issue.targetTabId || issue.personId || issue.id || 'root',
      name: issue.name || null,
      severity: issue.severity || 'warning',
      text: issue.text,
      code: issue.code,
      displayTargets: issue.displayTargets || ['guide'],
    }));
    const globalMismatchReasons = audit.issues.map((issue) => ({
      id: issue.targetTabId || issue.personId || issue.id || 'root',
      text: issue.text,
    }));
    return {
      showGlobalWarning: audit.issues.length > 0, showAutoCalcNotice: false, globalMismatchReasons, autoCalculatedNames: [],
      smartGuides,
      noSurvivors,
      hasActionItems: smartGuides.some(g => g.type === 'mandatory') || auditActionItems.length > 0,
      auditActionItems,
      repairHints: audit.repairHints || [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares]);
};
