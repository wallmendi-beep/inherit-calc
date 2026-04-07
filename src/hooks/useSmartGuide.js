import { useMemo } from 'react';
import { isBefore, getLawEra } from '../engine/utils';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input' || !tree) {
      return { showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [], smartGuides: [], noSurvivors: false, hasActionItems: false };
    }

    const uniqueGuidesMap = new Map();
    let noSurvivors = false;

    // 헬퍼 함수: 특정 노드의 부모 노드를 찾는 기능
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

    const law = getLawEra(tree.deathDate);

    // 4. 권고사항 (Recommended): 상속포기/결격/상실의 개별성(독립성) 안내
    const checkIndependentExclusionGuide = (node, parentName, level = 0) => {
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified', 'lost'].includes(node.exclusionOption)) {
        const isDeadWithoutHeirs = node.isDeceased && (!node.heirs || node.heirs.length === 0);
        
        if (!isDeadWithoutHeirs) {
          let reasonText = '';
          if (node.exclusionOption === 'renounce') reasonText = '상속포기';
          else if (node.exclusionOption === 'disqualified') reasonText = '상속결격';
          else if (node.exclusionOption === 'lost') reasonText = '상속권 상실선고';

          uniqueGuidesMap.set(`excl-${node.personId}`, {
            id: node.id,
            uniqueKey: `excl-${node.personId}`,
            type: 'recommended',
            text: `[${node.name}] ${reasonText} 처리가 적용되었습니다. 다른 피상속인의 탭에서도 별도로 스위치를 꺼주셔야 합니다.`,
            level, 
            relation: node.relation 
          });
        }
      }
      if (node.heirs) {
        node.heirs.forEach(h => checkIndependentExclusionGuide(h, node.name || '피상속인', level + 1));
      }
    };

    const checkGuideNode = (node, parentDate, level = 0) => {
      if (node.id === 'root') {
        if (!node.name || !node.deathDate) {
          uniqueGuidesMap.set('root-mandatory', { id: 'root', uniqueKey: 'root-mandatory', type: 'mandatory', text: '피상속인의 이름과 사망일자를 먼저 입력해 주세요.', level, relation: 'root' });
        }
      } else if (!node.isExcluded) {
        
        const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);

        if (node.isDeceased && node.deathDate && parentDate) {
          if (!isBefore(node.deathDate, parentDate)) {
            if (!node.heirs || node.heirs.length === 0) {
              const parentNode = findParentNodeInHook(tree, node.id);
              let canAutoCalc = false;
              let autoTarget = '';
              
              if (parentNode && parentNode.heirs) {
                if (!isSpouseType) {
                  const ascendants = parentNode.heirs.filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && (!h.isDeceased || isBefore(node.deathDate, h.deathDate)) && !h.isExcluded);
                  if (ascendants.length > 0) { canAutoCalc = true; autoTarget = '직계존속(어머니/아버지)'; }
                  else {
                    const siblings = parentNode.heirs.filter(h => h.id !== node.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded);
                    if (siblings.length > 0) { canAutoCalc = true; autoTarget = '형제자매'; }
                  }
                } else {
                  const stepChildren = parentNode.heirs.filter(h => h.id !== node.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded);
                  if (stepChildren.length > 0) { canAutoCalc = true; autoTarget = '공동 자녀들'; }
                }
              }

              if (canAutoCalc) {
                uniqueGuidesMap.set(`autocalc-${node.personId}`, { 
                  id: `tab:${node.personId}`, 
                  uniqueKey: `autocalc-${node.personId}`,
                  type: 'recommended', 
                  text: `[${node.name}] 하위 상속인이 없어 ${autoTarget}에게 자동 분배했습니다. 직접 입력하시려면 클릭해 주세요.`, 
                  level, 
                  relation: node.relation 
                });
              } else {
                if (isSpouseType) {
                  uniqueGuidesMap.set(`missing-${node.personId}`, { 
                    id: `tab:${node.personId}`, 
                    uniqueKey: `missing-${node.personId}`,
                    type: 'mandatory', 
                    text: `[${node.name}] 사망(${node.deathDate || '일자 미상'})에 따른 상속인 정보가 없습니다. 자녀가 없다면 고인의 본가/친정 식구를 입력해 주세요.`, 
                    level, 
                    relation: node.relation 
                  });
                } else {
                  uniqueGuidesMap.set(`missing-${node.personId}`, { 
                    id: `tab:${node.personId}`, 
                    uniqueKey: `missing-${node.personId}`,
                    type: 'mandatory', 
                    text: `[${node.name}] 사망(${node.deathDate || '일자 미상'})에 따른 재상속인 정보가 없습니다. 대를 이을 사람이 없다면 스위치를 꺼주세요.`, 
                    level, 
                    relation: node.relation 
                  });
                }
              }
            }
          } else {
            if (!isSpouseType && (!node.heirs || node.heirs.length === 0)) {
              uniqueGuidesMap.set(`no-daeseup-${node.personId}`, { 
                id: `tab:${node.personId}`, 
                uniqueKey: `no-daeseup-${node.personId}`,
                type: 'recommended', 
                text: `[${node.name}] 대습상속인이 없어 상속에서 자동 제외되었습니다. 자녀가 있다면 추가해 주세요.`, 
                level, relation: node.relation 
              });
            }

            if (['1960', '1979'].includes(law) && node.relation === 'son' && node.heirs && node.heirs.length > 0) {
              const parentNode = findParentNodeInHook(tree, node.id);
              const hasSiblingHoju = parentNode?.heirs?.some(h => h.id !== node.id && h.isHoju) || false;
              const isGrandsonHoju = node.heirs.some(h => h.relation === 'son' && h.isHoju);
              
              if (!hasSiblingHoju && isGrandsonHoju && !node.isHoju) {
                uniqueGuidesMap.set(`hoju-tip-${node.personId}`, {
                  id: `tab:${node.personId}`,
                  uniqueKey: `hoju-tip-${node.personId}`,
                  type: 'recommended',
                  text: `[팁] 장남과 장손이 연이어 호주를 승계한다면 두 사람 모두 호주 스위치를 켜주세요.`,
                  level,
                  relation: node.relation
                });
              }
            }
          }
        }
        
        if ((law === '1960' || law === '1979') && node.relation === 'daughter' && !node.marriageDate && !node.restoreDate) {
          uniqueGuidesMap.set(`daughter-tip-${node.personId}`, { id: node.id, uniqueKey: `daughter-tip-${node.personId}`, type: 'recommended', text: `[${node.name}] 혼인/복적 연혁(톱니바퀴)을 세부 입력하시면 AI가 지분을 자동 계산합니다.`, level, relation: node.relation });
        }

        if (isSpouseType && node.remarriageDate && parentDate) {
          if (isBefore(node.remarriageDate, parentDate)) {
            uniqueGuidesMap.set(`remarried-excl-${node.personId}`, { 
              id: node.id, uniqueKey: `remarried-excl-${node.personId}`, type: 'mandatory', 
              text: `[${node.name}] 피상속인 사망(${parentDate}) 이전에 재혼(${node.remarriageDate})하여 대습상속권이 소멸했습니다. 스위치를 꺼주세요.`, 
              level, relation: node.relation 
            });
          }
        }

        if (node.remarriageDate) {
          uniqueGuidesMap.set(`remarried-tip-${node.personId}`, { 
            id: node.id, uniqueKey: `remarried-tip-${node.personId}`, type: 'recommended', 
            text: `[${node.name}] 재혼 연혁(${node.remarriageDate})이 있습니다. 하위에 계자녀(전 배우자의 자녀)가 포함되지 않도록 주의해 주세요.`, 
            level, relation: node.relation 
          });
        }
      }
      
      if (node.heirs) node.heirs.forEach(h => checkGuideNode(h, node.deathDate || parentDate, level + 1));
    };

    checkIndependentExclusionGuide(tree, null, 0);
    checkGuideNode(tree, tree.deathDate, 0);

    // 상속인 전멸 체크 (전체 트리 재귀: 유효 상속인이 단 한 명도 없는 경우)
    const hasAnySurvivor = (node) => {
      if (node !== tree && !node.isExcluded) return true;
      return (node.heirs || []).some(hasAnySurvivor);
    };
    if (!tree.heirs || tree.heirs.length === 0 || !hasAnySurvivor(tree)) {
      noSurvivors = true;
    }

    // 우선순위 정렬 (필수 경고가 최상단)
    const finalGuides = Array.from(uniqueGuidesMap.values()).sort((a, b) => (a.type === 'mandatory' ? -1 : 1));

    return {
      showGlobalWarning: false,
      showAutoCalcNotice: false,
      globalMismatchReasons: [],
      autoCalculatedNames: [],
      smartGuides: finalGuides,
      noSurvivors,
      hasActionItems: finalGuides.length > 0 || noSurvivors
    };
  }, [tree, activeTab]);
};
