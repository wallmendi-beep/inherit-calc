import { useMemo } from 'react';
import { getLawEra } from '../engine/utils';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input' || !tree) {
      return { showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [], smartGuides: [], noSurvivors: false, hasActionItems: false };
    }

    const uniqueGuidesMap = new Map();
    let noSurvivors = false;

    // 헬퍼: 현재 노드의 부모 노드 찾기
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

    // 1. 포기/결격 개별 적용 (권고)
    const checkIndependentExclusionGuide = (node, level = 0) => {
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption)) {
        const parentNode = findParentNodeInHook(tree, node.id);
        const parentTabId = parentNode ? parentNode.personId : 'root';
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          targetTabId: parentTabId, // 스위치 조작 위치인 부모 탭으로 유도
          text: `[${node.name}] ${optionText}가 적용되었습니다. 타 피상속인(배우자 등) 탭에서도 별도로 제외 처리해 주세요.`,
          level, relation: node.relation
        });
      }
      if (node.heirs) node.heirs.forEach(h => checkIndependentExclusionGuide(h, level + 1));
    };

    // 2. 입력 주의 및 팁 (권고)
    const checkGuideNode = (node, level = 0) => {
      if (node.id !== 'root') {
        const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
        
        // 계자녀 혼입 주의
        if (node.remarriageDate) {
          uniqueGuidesMap.set(`remarried-tip-${node.personId}`, { 
            id: node.id, uniqueKey: `remarried-tip-${node.personId}`, type: 'recommended', 
            targetTabId: node.personId, // 하위 추가 시 주의이므로 본인 탭
            text: `[${node.name}] 재혼(${node.remarriageDate}) 연혁이 있습니다. 하위 입력 시 전 배우자의 자녀(계자녀)가 섞이지 않도록 주의해 주세요.`, 
            level, relation: node.relation 
          });
        }
        
        // 무자녀 대습 자동 제외 안내
        if (node.isDeceased && (!node.heirs || node.heirs.length === 0) && !isSpouse) {
            uniqueGuidesMap.set(`no-heir-excl-${node.personId}`, {
               id: node.id, uniqueKey: `no-heir-excl-${node.personId}`, type: 'recommended',
               targetTabId: node.personId, // 자녀 추가를 유도하므로 본인 탭
               text: `[${node.name}] 하위 대습상속인이 없어 상속에서 자동 제외되었습니다. 생존 자녀가 있다면 추가해 주세요.`,
               level, relation: node.relation
            });
        }
      }

      // 연쇄 호주 승계 팁
      if (getLawEra(tree.deathDate) !== '1991' && node.isHoju && node.isDeceased) {
          const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
          if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
              uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
                  id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended',
                  targetTabId: node.personId, // 자식 호주를 지정해야 하므로 본인 탭
                  text: `[대습 팁] 장남 및 장손이 연쇄적으로 호주를 승계한다면, 두 사람 모두 [호주상속] 켬 상태를 유지해 주시길 권장합니다.`,
                  level, relation: node.relation
              });
          }
      }

      if (node.heirs) node.heirs.forEach(h => checkGuideNode(h, level + 1));
    };

    checkIndependentExclusionGuide(tree, 0);
    checkGuideNode(tree, 0);

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    const smartGuides = Array.from(uniqueGuidesMap.values());

    return {
      showGlobalWarning: false,
      showAutoCalcNotice: false,
      globalMismatchReasons: [],
      autoCalculatedNames: [],
      smartGuides,
      noSurvivors,
      hasActionItems: smartGuides.some(g => g.type === 'mandatory')
    };
  }, [tree, finalShares, activeTab, warnings]);
};