import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input' || !tree) {
      return { showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [], smartGuides: [], noSurvivors: false, hasActionItems: false };
    }

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
      // 피상속인보다 명백히 먼저 사망한 사람의 '상속포기/결격'은 과거 파일의 버그 데이터이므로 경고를 띄우지 않음
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const parentNode = findParentNodeInHook(tree, node.id);
        const parentTabId = parentNode ? parentNode.personId : 'root';
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          targetTabId: parentTabId,
          text: `[${node.name}] ${optionText}가 적용되었습니다. 타 피상속인 탭에서도 별도로 제외 처리해 주세요.`,
          level, relation: node.relation
        });
      }
      if (node.heirs) node.heirs.forEach(h => checkIndependentExclusionGuide(h, level + 1));
    };

    const checkGuideNode = (node, parentDate, level = 0) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';

      if (node.id !== 'root') {
        const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);

        // 🚨 무자녀 사망자 가이드 분리 (대습상속 vs 재상속)
        if (node.isDeceased && (!node.heirs || node.heirs.length === 0) && !isSpouse) {
            const isPredeceased = node.deathDate && parentDate && isBefore(node.deathDate, parentDate);
            
            if (isPredeceased) {
                // 대습상속 (선사망)
                uniqueGuidesMap.set(`no-heir-excl-${node.personId}`, {
                   id: node.id, uniqueKey: `no-heir-excl-${node.personId}`, type: 'recommended',
                   targetTabId: parentTabId,
                   text: `[${node.name}] 하위 대습상속인이 없어 상속에서 제외되었습니다. 생존 자녀가 있다면 추가해 주세요.`,
                   level, relation: node.relation
                });
            } else {
                // 재상속 (후사망)
                uniqueGuidesMap.set(`re-inherit-tip-${node.personId}`, {
                   id: node.id, uniqueKey: `re-inherit-tip-${node.personId}`, type: 'recommended',
                   targetTabId: node.personId, 
                   text: `[${node.name}] 하위 상속인 부재로 본인의 지분이 배우자/직계존속/형제자매 등에게 승계(재상속)됩니다. 상세 분배 내역은 계산표를 확인하세요.`,
                   level, relation: node.relation
                });
            }
        }
      }

      const effectiveDate = node.deathDate || tree.deathDate;
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
    return {
      showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [],
      smartGuides, noSurvivors, hasActionItems: smartGuides.some(g => g.type === 'mandatory')
    };
  }, [tree, finalShares, activeTab, warnings]);
};