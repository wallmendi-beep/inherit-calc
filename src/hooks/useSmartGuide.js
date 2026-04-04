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

    // 3. 내부 헬퍼 함수: 대습상속 누락 상세 분석
    const getDetailedMismatchReasons = (rootNode) => {
      const reasons = [];
      const scan = (n, parentDate) => {
        if (n.id !== 'root') {
          const isSpouse = ['wife', 'husband', 'spouse'].includes(n.relation);
          const isPre = n.deathDate && parentDate && isBefore(n.deathDate, parentDate);
          const isPreSpouse = isSpouse && isPre;
          
          if ((!n.isExcluded && n.isDeceased && !isPreSpouse && isPre) && (!n.heirs || n.heirs.length === 0)) {
            reasons.push({
              id: n.id,
              text: `망 ${n.name}(${getRelStr(n.relation, parentDate)})의 대습상속인이 누락되었습니다. (미혼/무자녀인 경우 스위치를 꺼서 '상속권 없음' 처리해주세요)`
            });
          }
        }
        if (n.isExcluded && (n.exclusionOption === 'renounce' || !n.exclusionOption)) return;
        if (n.heirs) n.heirs.forEach(h => scan(h, n.deathDate || parentDate));
      };
      scan(rootNode, rootNode.deathDate);
      
      const unique = [];
      const seen = new Set();
      reasons.forEach(r => {
        if (!seen.has(r.text)) { seen.add(r.text); unique.push(r); }
      });
      return unique;
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
    const checkGuideNode = (node, parentDate) => {
      if (node.id === 'root') {
        if (!node.name || !node.deathDate) {
          smartGuides.push({ id: 'root', type: 'mandatory', text: '피상속인 기본정보(성함, 사망일자)를 먼저 입력해주세요.' });
        }
      } else if (!node.isExcluded) {
        if (node.isDeceased && node.deathDate && parentDate && !isBefore(node.deathDate, parentDate)) {
          if (!node.heirs || node.heirs.length === 0) {
            smartGuides.push({ id: node.id, type: 'mandatory', text: `'${node.name}' 님의 재상속 정보가 없습니다. 클릭하여 상속인을 추가하세요.` });
          }
        }
        if ((law === '1960' || law === '1979') && node.relation === 'daughter' && !node.marriageDate && !node.restoreDate) {
          smartGuides.push({ id: node.id, type: 'recommended', text: `'${node.name}' 님의 혼인/복적 연혁을 입력하면 복잡한 계산을 AI가 대신합니다.` });
        }
      }
      if (node.heirs) node.heirs.forEach(h => checkGuideNode(h, node.deathDate || parentDate));
    };
    checkGuideNode(tree, null);

    const hasActionItems = noSurvivors || warnings.length > 0 || smartGuides.length > 0 || showGlobalWarning || showAutoCalcNotice;

    return {
      showGlobalWarning,
      showAutoCalcNotice,
      globalMismatchReasons,
      autoCalculatedNames: uniqueAuto,
      smartGuides,
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
