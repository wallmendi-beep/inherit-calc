import { useMemo } from 'react';
import { isBefore, getLawEra } from '../engine/utils';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input' || !tree) {
      return { showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [], smartGuides: [], noSurvivors: false, hasActionItems: false };
    }

    const uniqueGuidesMap = new Map();
    let noSurvivors = false;

    // 💡 [지능형 판례 분석기] 3단계 필터링 엔진
    const analyzeNode = (node, parentPersonId, parentRelation) => {
      if (!node) return;

      // =======================================================
      // 🚨 1단계 필터: 물리적/상식적 모순 검증 (오염된 데이터 차단)
      // =======================================================
      
      // 모순 1. 아들의 남편? 딸의 처? (성별-관계 교차 검증)
      const isParentSon = ['son', '아들'].includes(parentRelation);
      const isParentDaughter = ['daughter', '딸'].includes(parentRelation);
      const isChildHusband = ['husband', '남편'].includes(node.relation);
      const isChildWife = ['wife', '처', '아내'].includes(node.relation);

      if ((isParentSon && isChildHusband) || (isParentDaughter && isChildWife)) {
        uniqueGuidesMap.set(`semantic-gender-${node.personId}`, {
          uniqueKey: `semantic-gender-${node.personId}`,
          targetTabId: parentPersonId,
          type: 'mandatory',
          text: `🚨 [${node.name || '이름없음'}]님의 관계설정이 이상합니다. (상위: ${parentRelation}, 본인: ${node.relation}) 성별과 관계를 올바르게 수정해 주세요.`
        });
      }

      // 모순 2. 태어나기도 전에 결혼? 사망 후 결혼?
      if (node.marriageDate && node.deathDate && !isBefore(node.marriageDate, node.deathDate)) {
        uniqueGuidesMap.set(`semantic-time-${node.personId}`, {
          uniqueKey: `semantic-time-${node.personId}`,
          targetTabId: parentPersonId || node.personId,
          type: 'mandatory',
          text: `🚨 [${node.name || '이름없음'}]님의 혼인일자가 사망일자보다 늦습니다. 날짜 오타를 확인해 주세요.`
        });
      }

      // =======================================================
      // 🏛️ 2단계 필터: 시대별 법리 적용 검증 (Law Era)
      // =======================================================
      
      if (node.isDeceased && node.heirs && node.heirs.length > 0) {
        const isFemale = ['wife', 'daughter', 'mother', 'sister', '처', '배우자'].includes(node.relation) || node.gender === 'female';
        
        // 피상속인 본인의 개별 사망 시점(Law Era)을 적용하여 호주 필요 여부 확인
        const lawEra = getLawEra(node.deathDate);
        const needsHoju = lawEra !== '1991'; 

        // 여성이 아니거나 직접 호주였던 경우에만 호주상속인 확인
        if (!isFemale || node.isHoju) {
          const hasHoju = node.heirs.some(h => h.isHoju && !h.isExcluded);
          if (needsHoju && !hasHoju) {
            uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
              uniqueKey: `missing-hoju-${node.personId}`,
              targetTabId: node.personId, 
              type: 'mandatory',
              text: `⚖️ [${node.name || '이름없음'}]님의 상속개시일(${node.deathDate}) 법령상 호주상속인이 필요합니다. 하위 자녀 중 호주 스위치를 켜주세요.`
            });
          }
        }
      }

      // =======================================================
      // 💡 3단계 필터: 시스템이 조작할 수 없는 행동 유도
      // =======================================================
      
      // 유도 1. 다중 배우자 (누가 진짜 배우자인지 인간이 선택해야 함)
      const spouses = (node.heirs || []).filter(h => ['wife', 'husband', 'spouse', '처', '남편'].includes(h.relation) && !h.isExcluded);
      if (spouses.length > 1) {
        uniqueGuidesMap.set(`multi-spouse-${node.personId}`, {
          uniqueKey: `multi-spouse-${node.personId}`,
          targetTabId: node.personId, 
          type: 'mandatory',
          text: `👥 [${node.name || '이름없음'}]님의 유효한 배우자가 2명 이상입니다. 1명만 남기고 나머지는 스위치를 조작해 제외해 주세요.`
        });
      }

      // 유도 2. 혼인 연혁 AI 자동 계산 유도
      if (parentPersonId && ['daughter', '딸'].includes(node.relation) && !node.marriageDate && !node.isExcluded) {
        uniqueGuidesMap.set(`auto-calc-${node.personId}`, {
          uniqueKey: `auto-calc-${node.personId}`,
          targetTabId: parentPersonId,
          type: 'recommended',
          text: `🤖 [${node.name || '이름없음'}]님의 혼인 복적 연혁(톱니바퀴)을 클릭하여 입력하시면, 복잡한 신분 변동 계산을 AI가 대신합니다.`
        });
      }

      // 하위 순회 (재귀)
      if (node.heirs) {
        node.heirs.forEach(child => analyzeNode(child, node.personId, node.relation));
      }
    };

    analyzeNode(tree, null, null);

    // 상속인 전멸 체크
    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
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
  }, [tree, finalShares, activeTab, warnings]);
};
