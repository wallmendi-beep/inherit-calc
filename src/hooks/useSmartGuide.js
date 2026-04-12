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

    // [v4.32] 초기 상태 (기초 정보 누락) 최우선 가이드
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
          text: "사건번호와 피상속인의 기본정보를 입력해주세요.",
          targetTabId: 'root'
        }],
        noSurvivors: false,
        hasActionItems: true,
        auditActionItems: [],
        repairHints: ["피상속인의 성명과 사망일자를 입력하시면 정교한 상속인 가이드가 시작됩니다."],
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

    const checkDuplicateSpouseGuide = (node, level = 0) => {
      const spouses = (node.heirs || []).filter(
        (h) => ['wife', 'husband', 'spouse'].includes(h.relation) && h.isExcluded !== true
      );

      if (spouses.length > 1) {
        const spouseNames = spouses.map((spouse) => spouse.name || '이름없음');
        uniqueGuidesMap.set(`multi-spouse-${node.personId || node.id}`, {
          id: node.id,
          uniqueKey: `multi-spouse-${node.personId || node.id}`,
          targetTabId: node.personId || node.id || 'root',
          type: 'mandatory',
          level,
          text: `[${node.name || '이름없음'}] 기준으로 유효 배우자가 중복 입력되어 있습니다. 현재 배우자: [${spouseNames.join('], [')}]. 실제 상속받는 1명을 제외하고 나머지는 제외 처리해 주세요.`,
        });
      }

      if (node.heirs) node.heirs.forEach((h) => checkDuplicateSpouseGuide(h, level + 1));
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
            
            let guideText = `[${node.name || '이름 미상'}]은 사망자로 입력되어 있으나 후속 상속인이 없습니다.`;

            if (isPredeceased) {
              if (isChild) {
                guideText = `[${node.name}]은 선사망자입니다. 하위에 대습상속인이 있다면 입력해 주세요. 입력 시 상속지분이 자동으로 계산됩니다.`;
              } else if (isSpouse) {
                guideText = `피상속인보다 먼저 사망한 배우자 [${node.name}]은 상속권이 발생하지 않습니다.`;
              }
            } else {
              // [v1.4] 예측형 안내: 차순위 상속인 실명 추적
            const findSuccessorNames = () => {
              if (isSpouse) {
                // [v3.1.5] 루트의 자녀(직계비속)를 전수 추출 (제외 여부 무관하게 실명 노출)
                const children = (tree.heirs || [])
                  .filter(h => ['son', 'daughter'].includes(h.relation))
                  .map(h => h.name)
                  .filter(Boolean);
                return children.length > 0 ? ` [${children.join('], [')}]` : "피상속인의 차순위 상속인";
              } else {
                const mother = (tree.heirs || []).find(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isDeceased && !h.isExcluded);
                if (mother) return `직계존속 [${mother.name}]`;
                const siblings = (tree.heirs || []).filter(h => h.id !== node.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded).map(h => h.name);
                return siblings.length > 0 ? `형제자매 [${siblings.join(', ')}]` : "피상속인의 차순위 상속인";
              }
            };
            const target = findSuccessorNames();
            guideText = `별도의 상속인을 입력하지 않으면 [${tree.name}]의 직계비속인 ${target}에게 상속지분이 자동으로 분배됩니다.\n\n${node.name}의 상속인이 아닌 사람이 있으면 '불러오기' 버튼으로 편집해 주세요.`;
            }

            uniqueGuidesMap.set(`missing-successors-${node.personId}`, {
              id: node.id, uniqueKey: `missing-successors-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
              text: guideText
            });
          }
          if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
              uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
                  text: `[${node.name || '이름 미상'}]은 사망자로 표시되어 있으나 사망일이 없습니다.`
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
    checkDuplicateSpouseGuide(tree, 0);
    if (tree.heirs) { tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate, 0)); }

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // [v3.1.4] 감사 엔진 이슈 통합 (entityIssues를 uniqueGuidesMap에 병합)
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

    const smartGuides = Array.from(uniqueGuidesMap.values());
    
    // UI 호환성을 위해 필터링된 리스트 생성
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
      smartGuides, // 전체 리스트 (SmartGuidePanel에서 내부 필터링함)
      noSurvivors,
      hasActionItems: smartGuides.length > 0 || audit.issues.length > 0,
      auditActionItems: [], // smartGuides로 통합되었으므로 빈 배열 리턴
      repairHints: audit.repairHints || [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares]);
};
