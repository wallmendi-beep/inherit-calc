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
