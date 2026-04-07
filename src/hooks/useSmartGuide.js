import { useMemo } from 'react';
import { isBefore, getLawEra } from '../engine/utils';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = []) => {
  return useMemo(() => {
    if (activeTab !== 'input' || !tree) {
      return { showGlobalWarning: false, showAutoCalcNotice: false, globalMismatchReasons: [], autoCalculatedNames: [], smartGuides: [], noSurvivors: false, hasActionItems: false };
    }

    const uniqueGuidesMap = new Map();
    let noSurvivors = false;

    // 💡 중앙 정밀 분석 엔진
    const analyzeNode = (node, parentPersonId, parentDeathDate) => {
      if (!node) return;

      const effectiveDate = parentDeathDate || tree.deathDate; // 이 사람의 진짜 상속 개시일

      // [Rule 1] 다중 배우자 감지
      const spouses = (node.heirs || []).filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded);
      if (spouses.length > 1) {
        uniqueGuidesMap.set(`multi-spouse-${node.personId}`, {
          uniqueKey: `multi-spouse-${node.personId}`,
          targetTabId: node.personId, // 🎯 내 자식(배우자)을 지우려면 '내 탭'으로 이동!
          type: 'mandatory',
          text: `[${node.name || '이름없음'}]님의 유효한 배우자가 2명 이상입니다. 1명만 남기고 나머지는 스위치를 조작해 제외해 주세요.`
        });
      }

      // [Rule 2] 호주 누락 감지 (여성 피상속인 예외 완벽 적용)
      if (node.isDeceased && node.heirs && node.heirs.length > 0) {
        const isFemale = ['wife', 'daughter', 'mother', 'sister', '처', '배우자'].includes(node.relation) || node.gender === 'female';
        if (!isFemale || node.isHoju) {
          const hasHoju = node.heirs.some(h => h.isHoju && !h.isExcluded);
          const needsHoju = getLawEra(node.deathDate) !== '1991';
          if (needsHoju && !hasHoju) {
            uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
              uniqueKey: `missing-hoju-${node.personId}`,
              targetTabId: node.personId, // 🎯 내 자식 중 호주를 골라야 하니 '내 탭'으로 이동!
              type: 'mandatory',
              text: `[${node.name || '이름없음'}]님의 상속인 중 호주상속인이 없습니다. 호주 스위치를 켜주세요.`
            });
          }
        }
      }

      // [Rule 3] 선사망 스위치 수동 조작 경고 (대습상속)
      const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
      if (parentPersonId && node.deathDate && effectiveDate && isBefore(node.deathDate, effectiveDate) && !isSpouse) {
        if (!node.isExcluded) {
          uniqueGuidesMap.set(`mismatch-predeceased-${node.personId}`, {
            uniqueKey: `mismatch-predeceased-${node.personId}`,
            targetTabId: parentPersonId, // 🎯 '내 스위치'는 부모 탭에 있으므로 '부모 탭'으로 이동!
            type: 'mandatory',
            text: `[${node.name || '이름없음'}]님의 사망일자(${node.deathDate})가 상속개시일(${effectiveDate})보다 빠릅니다. 스위치를 조작하여 [상속권 없음]으로 변경해 주세요.`
          });
        }
      }

      // [Rule 4] 출가녀 논리 불일치
      if (parentPersonId && node.relation === 'daughter' && node.marriageDate && effectiveDate) {
        if (isBefore(node.marriageDate, effectiveDate) && node.isSameRegister !== false && !node.isExcluded) {
          uniqueGuidesMap.set(`mismatch-married-${node.personId}`, {
            uniqueKey: `mismatch-married-${node.personId}`,
            targetTabId: parentPersonId, // 🎯 스위치는 부모 탭에 있음!
            type: 'mandatory',
            text: `[${node.name || '이름없음'}]님은 상속개시일 이전에 혼인하셨습니다. 스위치를 [출가]로 변경해 주세요.`
          });
        }
      }

      // [Rule 5] AI 혼인/복적 홍보 카드 (정문자 케이스)
      if (parentPersonId && node.relation === 'daughter' && !node.marriageDate && !node.isExcluded) {
        uniqueGuidesMap.set(`auto-calc-${node.personId}`, {
          uniqueKey: `auto-calc-${node.personId}`,
          targetTabId: parentPersonId, // 🎯 혼인 연혁을 입력하려면 부모 탭의 톱니바퀴를 눌러야 함!
          type: 'recommended',
          text: `💡 [${node.name || '이름없음'}]님의 혼인 복적 연혁을 클릭하여 세부 입력하시면, 복잡한 계산을 AI가 대신합니다.`
        });
      }

      // 하위 자녀 재귀 스캔
      if (node.heirs) {
        const nextEffectiveDate = (node.deathDate && !isBefore(node.deathDate, effectiveDate)) ? node.deathDate : effectiveDate;
        node.heirs.forEach(child => analyzeNode(child, node.personId, nextEffectiveDate));
      }
    };

    analyzeNode(tree, null, null);

    // 상속인 전멸 체크
    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // 우선순위 정렬 (필수 경고가 최상단으로)
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
