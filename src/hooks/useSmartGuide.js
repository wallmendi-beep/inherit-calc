import { useMemo } from 'react';
import { math, isBefore, getRelStr, getLawEra } from '../engine/utils';

/**
 * 🧭 스마트 가이드 전용 분석 엔진 (Custom Hook)
 * 가계도 데이터와 계산 결과를 분석하여 필수/권고사항 및 지분 오류를 찾아냅니다.
 */
export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input') {
      return {
        showGlobalWarning: false,
        showAutoCalcNotice: false,
        globalMismatchReasons: [],
        autoCalculatedNames: [],
        smartGuides: [],
        noSurvivors: false,
        hasActionItems: false
      };
    }

    // 1. 기초 데이터 준비
    const law = getLawEra(tree.deathDate);
    const targetN = tree.shareN || 1;
    const targetD = tree.shareD || 1;
    const [simpleTargetN, simpleTargetD] = math.simplify(targetN, targetD);

    // 2. 내부 헬퍼 함수: 지분 합계 계산
    const calculateTotalSum = () => {
      let tn = 0, td = 1;
      const collect = (nodes) => {
        nodes.forEach(s => {
          if (s && s.n > 0) {
            const [nn, nd] = math.add(tn, td, s.n, s.d);
            tn = nn; td = nd;
          }
        });
      };
      collect(finalShares.direct || []);
      (finalShares.subGroups || []).forEach(g => collect(g.shares || []));
      return [tn, td];
    };

    // 3. 내부 헬퍼 함수: 대습상속 누락 상세 분석 (엔진 자동화로 인해 에러 로직 제거)
    const getDetailedMismatchReasons = (rootNode) => {
      return []; // 엔진이 선사망 무자녀를 자동 제외하므로 더 이상 에러가 아님
    };

    // 4. 내부 헬퍼 함수: 자동분배 및 누락 노드 추적
    const autoCalculatedNames = [];
    const missingHeirNames = [];
    const findMissingAndAutoNodes = (node, parentDeathDate) => {
      const pDeath = parentDeathDate || tree.deathDate;
      if (node.id !== 'root') {
        const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);
        const isPreDeceasedSpouse = isSpouseType && node.deathDate && pDeath && isBefore(node.deathDate, pDeath);
        const isPreDeceasedContext = node.deathDate && pDeath && isBefore(node.deathDate, pDeath);

        if (node.isDeceased && (!node.heirs || node.heirs.length === 0) && !node.isExcluded && !isPreDeceasedSpouse) {
          let hasVirtualHeirs = false;
          let autoCalcTarget = ''; 
          
          if (!isPreDeceasedContext) {
            // 자동분배 로직 (단순 사망 시)
            const parentNode = findParentNodeInHook(tree, node.id);
            if (parentNode && parentNode.heirs) {
              if (isSpouseType) {
                hasVirtualHeirs = parentNode.heirs.some(th => th.id !== node.id && ['son', 'daughter'].includes(th.relation) && !th.isExcluded);
                if (hasVirtualHeirs) autoCalcTarget = '직계비속(자녀)';
              } else if (['son', 'daughter'].includes(node.relation)) {
                const survivingSpouse = parentNode.heirs.some(th => 
                  ['wife', 'husband', 'spouse'].includes(th.relation) && 
                  (!th.isDeceased || !isBefore(th.deathDate, node.deathDate || pDeath)) && !th.isExcluded
                );
                if (survivingSpouse) {
                  hasVirtualHeirs = true; autoCalcTarget = '배우자(직계존속)';
                } else {
                  const siblings = parentNode.heirs.some(th => th.id !== node.id && ['son', 'daughter'].includes(th.relation) && !th.isExcluded);
                  if (siblings) { hasVirtualHeirs = true; autoCalcTarget = '형제자매'; }
                }
              }
            }
          }

          if (!hasVirtualHeirs) missingHeirNames.push(node.name || '이름 미상');
          else autoCalculatedNames.push({ name: node.name || '이름 미상', target: autoCalcTarget });
        }
      }
      if (node.heirs) node.heirs.forEach(h => findMissingAndAutoNodes(h, node.deathDate || pDeath));
    };

    // 5. 실행 및 결과 조립
    const [sumN, sumD] = calculateTotalSum();
    const globalMismatchReasons = getDetailedMismatchReasons(tree);
    findMissingAndAutoNodes(tree, tree.deathDate);

    // 중복 제거
    const uniqueAuto = [];
    const seenAuto = new Set();
    autoCalculatedNames.forEach(a => { if (!seenAuto.has(a.name)) { seenAuto.add(a.name); uniqueAuto.push(a); } });

    const showGlobalWarning = (sumN * targetD !== targetN * sumD) || globalMismatchReasons.length > 0;
    const showAutoCalcNotice = uniqueAuto.length > 0;
    const noSurvivors = (finalShares.direct.length === 0 && finalShares.subGroups.length === 0);

    // 6. 스마트 가이드 (필수/권고사항) 생성
    const smartGuides = [];

    // 💡 4. 권고사항 (Recommended): 상속포기/결격/상실의 개별성(독립성) 안내
    // (파라미터에 level = 0 추가)
    const checkIndependentExclusionGuide = (node, parentName, level = 0) => {
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified', 'lost'].includes(node.exclusionOption)) {
        const isDeadWithoutHeirs = node.isDeceased && (!node.heirs || node.heirs.length === 0);
        
        if (!isDeadWithoutHeirs) {
          let reasonText = '';
          if (node.exclusionOption === 'renounce') reasonText = '상속포기';
          else if (node.exclusionOption === 'disqualified') reasonText = '상속결격';
          else if (node.exclusionOption === 'lost') reasonText = '상속권 상실선고';

          smartGuides.push({
            id: node.id,
            type: 'recommended',
            text: `망 ${parentName}에 대한 [${node.name}]님의 ${reasonText} 처리가 적용되었습니다. ${reasonText}의 효력은 해당 피상속인에게만 개별적으로 미치므로, 다른 피상속인(배우자 등)의 상속에서도 제외되어야 할 사유가 있다면 해당 탭에서 별도로 스위치를 꺼주셔야 합니다.`,
            level, // 💡 정렬용 데이터 추가
            relation: node.relation // 💡 정렬용 데이터 추가
          });
        }
      }
      if (node.heirs) {
        node.heirs.forEach(h => checkIndependentExclusionGuide(h, node.name || '피상속인', level + 1));
      }
    };

    // (파라미터에 level = 0 추가)
    const checkGuideNode = (node, parentDate, level = 0) => {
      if (node.id === 'root') {
        if (!node.name || !node.deathDate) {
          smartGuides.push({ id: 'root', type: 'mandatory', text: '피상속인 기본정보(성함, 사망일자)를 먼저 입력해주세요.', level, relation: 'root' });
        }
      } else if (!node.isExcluded) {
        
        const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);

        if (node.isDeceased && node.deathDate && parentDate) {
          if (!isBefore(node.deathDate, parentDate)) {
            if (!node.heirs || node.heirs.length === 0) {
              // 💡 기계가 자동분배를 해냈는지 검사합니다.
              const parentNode = findParentNodeInHook(tree, node.id);
              const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);
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
                  // 💡 [추가됨] 배우자의 경우: 남편(아내)의 자녀들을 검사
                  const stepChildren = parentNode.heirs.filter(h => h.id !== node.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded);
                  if (stepChildren.length > 0) { canAutoCalc = true; autoTarget = '공동 자녀들'; }
                }
              }

              // 기계가 알아서 찾았다면 에러(🚨) 대신 권고/안내(💡)로 처리!
              if (canAutoCalc) {
                smartGuides.push({ 
                  id: `tab:${node.personId}`, 
                  type: 'recommended', 
                  text: `[${node.name}]님은 하위 상속인이 없어 시스템이 자동으로 ${autoTarget}에게 지분을 분배했습니다. 실제 재상속인 정보를 직접 입력하시려면 여기를 클릭하세요.`, 
                  level, 
                  relation: node.relation 
                });
              } else {
                if (isSpouseType) {
                  // 🚨 [추가됨] 배우자 전용 경고: 친정/본가 입력 유도 (법리적 대참사 방지)
                  smartGuides.push({ 
                    id: `tab:${node.personId}`, 
                    type: 'mandatory', 
                    text: `🚨 '${node.name}' 님의 상속인 정보가 없습니다. 무자녀라면 고인의 '친정(또는 본가) 식구들'을 상속인으로 직접 입력해야 합니다. (스위치를 끄면 지분이 타인에게 넘어가니 주의하세요)`, 
                    level, 
                    relation: node.relation 
                  });
                } else {
                  // 🚨 기존 일반 혈족 경고
                  smartGuides.push({ 
                    id: `tab:${node.personId}`, 
                    type: 'mandatory', 
                    text: `🚨 '${node.name}' 님의 재상속 정보가 없습니다. 대를 이을 사람이 없다면 스위치를 꺼주세요.`, 
                    level, 
                    relation: node.relation 
                  });
                }
              }
            }
          } else {
            // 💡 보완 1: 선사망(대습상속)인데 무자녀일 때, '배우자'는 대습상속 대상이 아니므로 안내를 생략합니다!
            if (!isSpouseType && (!node.heirs || node.heirs.length === 0)) {
              smartGuides.push({ 
                id: `tab:${node.personId}`, 
                type: 'recommended', 
                text: `[${node.name}]님은 선사망하셨으나 대습상속인이 없어 상속에서 자동 제외되었습니다. 만약 대습상속인(자녀/배우자)이 있다면 추가해주세요.`, 
                level, relation: node.relation 
              });
            }

            // 💡 사용자님 기획: 엄격한 3대 요건이 충족될 때만 구법 대습 호주상속 팁 노출
            if (['1960', '1979'].includes(law) && node.relation === 'son' && node.heirs && node.heirs.length > 0) {
              // 1. 동일 항렬 내 호주상속 체크 여부 확인 (장남이 아닌 다른 형제가 이미 호주인지 판별)
              const parentNode = findParentNodeInHook(tree, node.id);
              const hasSiblingHoju = parentNode?.heirs?.some(h => h.id !== node.id && h.isHoju) || false;
              
              // 2. 대습상속인(손자)의 호주상속 체크 여부 확인
              const isGrandsonHoju = node.heirs.some(h => h.relation === 'son' && h.isHoju);
              
              // 3. 최종 조건 검사 (동일 항렬 호주 없음 + 손자 호주 켜짐 + 본인(피대습자) 호주 꺼짐)
              if (!hasSiblingHoju && isGrandsonHoju && !node.isHoju) {
                smartGuides.push({
                  id: `tab:${node.personId}`,
                  type: 'recommended',
                  // 🚨 UI와의 중복을 막기 위해 💡 이모지 텍스트 완전 제거!
                  text: `[구법 대습상속 팁] '${node.name}'님이 장남이고 장손이 호주를 승계한다면, 부(父)와 자(子) 모두의 [호주상속] 스위치를 켜주세요. (선례 2-285호: 1.5배 중복 가산 자동 적용)`,
                  level,
                  relation: node.relation
                });
              }
            }
          }
        }
        
        // 과거 민법 딸 관련 권고
        if ((law === '1960' || law === '1979') && node.relation === 'daughter' && !node.marriageDate && !node.restoreDate) {
          smartGuides.push({ id: node.id, type: 'recommended', text: `'${node.name}' 님의 혼인/복적 연혁을 입력하면 복잡한 계산을 AI가 대신합니다.`, level, relation: node.relation });
        }

        // 💡 보완 2: 배우자가 피상속인(또는 피대습자) 사망 '전'에 재혼했다면 대습상속권 차단!
        if (isSpouseType && node.remarriageDate && parentDate) {
          if (isBefore(node.remarriageDate, parentDate)) {
            smartGuides.push({ 
              id: node.id, type: 'mandatory', 
              text: `🚨 [${node.name}]님은 피상속인 사망(${parentDate}) 전에 재혼하셨으므로 대습상속권이 소멸했습니다. 스위치를 눌러 [대습 개시 전 재혼]으로 제외 처리해주세요.`, 
              level, relation: node.relation 
            });
          }
        }

        // 💡 보완 3: 재혼 연혁이 있는 경우 이부/이복형제 혼입 주의 안내
        if (node.remarriageDate) {
          smartGuides.push({ 
            id: node.id, type: 'recommended', 
            text: `[${node.name}]님의 재혼 연혁이 존재합니다. 하위에 상속인을 추가할 때, 전 배우자의 혈연 자녀가 아닌 '재혼 후 출생한 자녀(계자녀)'가 포함되지 않도록 주의하세요.`, 
            level, relation: node.relation 
          });
        }
      }
      
      if (node.heirs) node.heirs.forEach(h => checkGuideNode(h, node.deathDate || parentDate, level + 1));
    };

    // 스캔 실행
    checkIndependentExclusionGuide(tree, tree.name || '피상속인', 0);
    checkGuideNode(tree, null, 0);

    // 💡 5. 스마트 가이드 중복 제거 및 최종 정렬 (Deduplication & Sorting)
    const uniqueGuidesMap = new Map();
    smartGuides.forEach(g => {
      // 💡 공백 및 특수문자 차이로 인한 중복 방지를 위해 trim 및 정규화 적용
      const key = g.text.replace(/\s+/g, '').trim(); 
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, { ...g, uniqueKey: g.text }); // uniqueKey는 원래 텍스트 유지
      }
    });
    const uniqueGuides = Array.from(uniqueGuidesMap.values());

    uniqueGuides.sort((a, b) => {
      // 1순위: 필수(mandatory)가 권고(recommended)보다 무조건 위로!
      if (a.type !== b.type) return a.type === 'mandatory' ? -1 : 1;
      
      // 2순위: 세대(level)가 가까운 순서대로 (1세대 -> 2세대 -> 3세대...)
      if (a.level !== b.level) return a.level - b.level;
      
      // 3순위: 같은 세대라면 배우자(wife, husband, spouse)가 1등, 나머지가 2등
      const getRelScore = (rel) => ['wife', 'husband', 'spouse'].includes(rel) ? 1 : 2;
      const aScore = getRelScore(a.relation);
      const bScore = getRelScore(b.relation);
      
      if (aScore !== bScore) return aScore - bScore;
      
      return 0; // 나머지는 가계도에 입력된 순서(형제 순서) 그대로 유지
    });

    const hasActionItems = noSurvivors || warnings.length > 0 || uniqueGuides.length > 0 || showGlobalWarning || showAutoCalcNotice;

    return {
      showGlobalWarning,
      showAutoCalcNotice,
      globalMismatchReasons,
      autoCalculatedNames: uniqueAuto,
      smartGuides: uniqueGuides, // 💡 압축이 완료된 가이드 배열을 내보냅니다.
      noSurvivors,
      hasActionItems
    };
  }, [tree, finalShares, activeTab, warnings]);
};

// 훅 내부에서 사용할 헬퍼 (트리 탐색)
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
