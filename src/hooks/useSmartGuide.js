import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';
import { isSpouseRelation } from '../engine/eligibility';
import { buildSpouseDirectGuideText, collectLegacyStepchildGuideEntries } from './smartGuideHelpers';

// 트리가 없을 때는 항상 같은 기본 상태 참조를 반환한다.
const EMPTY_GUIDE_STATE = {
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

export const useSmartGuide = (tree, finalShares, activeTab, warnings, transitShares, importIssues) => {
  return useMemo(() => {
    if (!tree) {
      return EMPTY_GUIDE_STATE;
    }
    const isInputMode = activeTab === 'input';

    // 초기 상태(기본 정보 미입력 시) 조기 반환
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
          text: '피상속인 이름과 사망일자를 먼저 입력해 주세요.',
          targetTabId: 'root'
        }],
        noSurvivors: false,
        hasActionItems: true,
        auditActionItems: [],
        repairHints: ['피상속인 이름과 사망일자를 입력하면 상속 가이드가 시작됩니다.'],
      };
    }

    const audit = auditInheritanceResult({ 
      tree, 
      finalShares: finalShares || {}, 
      transitShares: transitShares || [], 
      warnings: warnings || [] 
    });

    const uniqueGuidesMap = new Map();
    const groupedPredeceasedMissingMap = new Map();
    const groupedDirectMissingMap = new Map();
    const groupedNextOrderFemaleMap = new Map();
    let noSurvivors = false;

    // 보조 함수 1: 부모 노드 탐색
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

    // 보조 함수 2: 특정 노드 탐색
    const findNodeInHook = (root, targetPersonId, targetNodeId) => {
      if (!root) return null;
      if ((targetPersonId && root.personId === targetPersonId) || (targetNodeId && root.id === targetNodeId)) return root;
      for (const child of root.heirs || []) {
        const found = findNodeInHook(child, targetPersonId, targetNodeId);
        if (found) return found;
      }
      return null;
    };

    // 헬퍼 함수 3: 구조 오류 감지 (자식 아래 부모/형제 관계)
    const checkStructuralError = (node) => {
      const invalidHeirs = (node.heirs || []).filter(h => ['parent', 'sibling'].includes(h.relation));
        invalidHeirs.forEach(h => {
          uniqueGuidesMap.set(`struct-err-${h.id}`, {
            id: h.id,
            uniqueKey: `struct-err-${h.id}`,
            type: 'mandatory',
            navigationMode: 'event',
            text: `관계 오류 — [${h.name || '이름 미상'}]이 [${node.name || '부모'}] 아래에 '부모/형제'로 잘못 입력되어 있습니다. 관계를 수정하거나 삭제해 주세요.`,
            targetTabId: node.personId || node.id || 'root',
            targetNodeIds: [h.id, h.personId].filter(Boolean),
            targetNodeId: h.id,
            parentNodeId: node.id
          });
        });
      if (node.heirs) node.heirs.forEach(checkStructuralError);
    };

    // 보조 함수 4: 독립 제외 상태 점검
    const checkIndependentExclusionGuide = (node) => {
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const optionText = node.exclusionOption === 'renounce' ? '상속포기' : '상속결격';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          text: `${optionText} 확인 — [${node.name}]. 다른 사건에도 등장한다면 해당 사건에서도 제외 여부를 함께 검토해 주세요.`
        });
      }
      if (node.heirs) node.heirs.forEach(checkIndependentExclusionGuide);
    };

    // 보조 함수 5: 중복 배우자 점검
    const checkDuplicateSpouseGuide = (node) => {
      const spouses = (node.heirs || []).filter((h) => {
        if (!isSpouseRelation(h.relation)) return false;
        if (h.isExcluded === true) return false;
        if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
        return true;
      });
      if (spouses.length > 1) {
        const spouseNames = spouses.map((spouse) => spouse.name || '이름 미상');
        uniqueGuidesMap.set(`multi-spouse-${node.personId || node.id}`, {
          id: node.id,
          uniqueKey: `multi-spouse-${node.personId || node.id}`,
          targetTabId: node.personId || node.id || 'root',
          type: 'mandatory',
          text: `배우자 중복 — [${node.name || '이름 미상'}]: [${spouseNames.join('], [')}]. 실제 상속받는 1명만 남기고 나머지를 제외해 주세요.`,
        });
      }
      if (node.heirs) node.heirs.forEach(checkDuplicateSpouseGuide);
    };

    // 보조 함수 6-1: 재혼 배우자 자녀 범위 점검
    const checkRemarriedSpouseChildrenGuide = (node) => {
      const spouses = (node.heirs || []).filter(
        (h) => ['wife', 'husband', 'spouse'].includes(h.relation) && h.remarriageDate
      );
      spouses.forEach((spouse) => {
        const hasChildren = (spouse.heirs || []).some(
          (h) => ['son', 'daughter'].includes(h.relation)
        );
        if (!hasChildren) return;
        const key = `remarried-children-${spouse.personId || spouse.id}`;
        if (!uniqueGuidesMap.has(key)) {
          uniqueGuidesMap.set(key, {
            id: spouse.id,
            uniqueKey: key,
            targetTabId: spouse.personId || spouse.id,
            type: 'recommended',
            navigationMode: 'event',
            text: `재혼 자녀 범위 확인 — [${spouse.name || '해당 배우자'}]은 재혼 이력이 있습니다. 입력된 자녀가 현재 배우자와의 자녀인지 확인해 주세요.`,
          });
        }
      });
      if (node.heirs) node.heirs.forEach(checkRemarriedSpouseChildrenGuide);
    };

    // 보조 함수 6: 노드별 가이드 생성 (메인 루프)
    const checkGuideNode = (node, parentDate) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';
      const effectiveDate = node.deathDate || tree.deathDate;
      const isBlockedHusbandSubstitution = node.exclusionOption === 'blocked_husband_substitution';
      const isHardExcluded = node.isExcluded && [
        'lost', 'disqualified', 'remarried', 'renounce', 'blocked_husband_substitution'
      ].includes(node.exclusionOption || '');
      const hasConfirmedNoSuccessors = !!node.successorStatus;
      const isLegacyFemale = getLawEra(effectiveDate) !== '1991' && node.relation === 'daughter';

      if (hasConfirmedNoSuccessors && parentNode && getLawEra(effectiveDate) !== '1991') {
        const siblingCandidates = (parentNode.heirs || []).filter((h) => h.id !== node.id && ['son', 'daughter'].includes(h.relation));
        const femaleCandidatesNeedingReview = siblingCandidates.filter((h) => {
          if (h.relation !== 'daughter') return false;
          if (h.isExcluded) return false;
          if (h.marriageDate || h.divorceDate || h.restoreDate) return false;
          if (h.isSameRegister === false) return false;
          return true;
        });
        if (femaleCandidatesNeedingReview.length > 0) {
          const groupKey = `next-order-female:${node.personId || node.id}`;
          const current = groupedNextOrderFemaleMap.get(groupKey) || {
            decedentName: node.name || '해당 사건',
            // 여성 형제자매 검토 가이드는 부모 사건 단위로 묶는다.
            targetTabId: parentTabId,
            names: [],
          };
          femaleCandidatesNeedingReview.forEach((candidate) => current.names.push(candidate.name || '이름 미상'));
          groupedNextOrderFemaleMap.set(groupKey, current);
        }
      }

      if ((node.isDeceased || node.id === 'root') && !isHardExcluded) {
        const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
        if (node.id !== 'root' && node.isDeceased && node.deathDate && activeHeirs.length === 0 && !hasConfirmedNoSuccessors) {
          const compareDate = parentDate || tree.deathDate;
          const isPre = compareDate ? isBefore(node.deathDate, compareDate) : false;
          const isChild = ['son', 'daughter'].includes(node.relation);
          const isSpouse = isSpouseRelation(node.relation);

          if (isPre) {
            if (isChild) {
              const groupKey = parentNode?.personId || parentNode?.id || 'root';
              const current = groupedPredeceasedMissingMap.get(groupKey) || {
                parentName: parentNode?.name || tree.name || '현재 계보',
                targetTabId: groupKey,
                firstTargetTabId: node.personId || node.id,
                names: [],
                nodeIds: [],
              };
              current.names.push(node.name || '이름 미상');
              // node.id와 personId 모두 저장해 InputPanel에서 양쪽으로 매칭 가능하게 함
              if (node.id) current.nodeIds.push(node.id);
              if (node.personId && node.personId !== node.id) current.nodeIds.push(node.personId);
              groupedPredeceasedMissingMap.set(groupKey, current);
            }
          } else {
            const contextName = parentNode?.name || tree.name || '현재 계보';
            const spouseGroupKey = isSpouse ? `${node.relation || 'spouse'}` : 'general';
            const groupKey = `${parentNode?.personId || parentNode?.id || 'root'}:${spouseGroupKey}`;
            const current = groupedDirectMissingMap.get(groupKey) || {
              parentName: contextName,
              targetTabId: parentNode?.personId || parentNode?.id || 'root',
              firstTargetTabId: node.personId || node.id,
              names: [],
              isSpouseGroup: isSpouse,
              spouseRelation: isSpouse ? node.relation : null,
            };
            current.names.push(node.name || '이름 미상');
            groupedDirectMissingMap.set(groupKey, current);
          }
        }
        if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
          uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
            id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
            text: `사망일 누락 — [${node.name || '이름 미상'}]. 사망일을 입력해야 정확한 상속 계산이 가능합니다.`
          });
        }

        const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
        const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들', 'husband'].includes(node.relation));
        if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
          const deathYear = (effectiveDate || '').slice(0, 4);
        uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
            id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory', navigationMode: 'event',
            text: `호주 미지정 — [${node.name || '이름 미상'}] 사건 (${deathYear}년, 구법 적용). 1차 상속인 중 호주상속인을 지정해 주세요.`
          });
        }

        if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased && !isBlockedHusbandSubstitution) {
          const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
          if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
            uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
              id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended', navigationMode: 'event',
              targetTabId: node.personId,
              text: `호주 연속 확인 — [${node.name || '해당 인물'}] 사건. 1차 상속인 중 호주상속인 지정 여부를 확인해 주세요.`
            });
          }
        }

        if (isLegacyFemale && !hasConfirmedNoSuccessors) {
          if (!node.marriageDate && node.isSameRegister !== false) {
            uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
              id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
              targetTabId: parentTabId,
              text: `혼인 정보 확인 — [${node.name || '이름 미상'}] (구법 적용 여성). 혼인·이혼·복적 날짜를 입력하면 정확한 지분이 계산됩니다.`
            });
          }
        }
      }

      if (node.heirs) {
        const nextParentDate = (node.deathDate && parentDate && isBefore(parentDate, node.deathDate)) ? node.deathDate : parentDate;
        node.heirs.forEach(h => checkGuideNode(h, nextParentDate));
      }
    };

    // 가이드 규칙 실행
    checkStructuralError(tree);
    checkIndependentExclusionGuide(tree);
    checkDuplicateSpouseGuide(tree);
    checkRemarriedSpouseChildrenGuide(tree);
    if (tree.heirs) tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate));

    collectLegacyStepchildGuideEntries(tree).forEach((entry) => {
      if (uniqueGuidesMap.has(entry.key)) return;
      uniqueGuidesMap.set(entry.key, {
        id: entry.personId,
        uniqueKey: entry.key,
        type: 'recommended',
        navigationMode: entry.navigationMode || 'auto',
        targetTabId: entry.targetTabId,
        targetNodeId: entry.targetNodeId,
        targetNodeIds: entry.targetNodeIds || [],
        relatedEventTabId: entry.relatedEventTabId,
        actionLabel: entry.actionLabel,
        text: entry.text,
      });
    });

    // 수집된 가이드 처리
    groupedPredeceasedMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 대습상속 누락의 경우 항상 부모(피상속인) 사건 탭으로 이동해야 하위 대습상속인을 입력할 수 있습니다.
      const navTarget = group.targetTabId;
      uniqueGuidesMap.set(`grouped-missing-substitution-${key}`, {
        id: key, uniqueKey: `grouped-missing-substitution-${key}`, targetTabId: navTarget, type: 'mandatory', navigationMode: 'event',
        targetNodeIds: group.nodeIds || [],
        text: `대습상속 미확정 — [${group.parentName}] 사건의 선사망자: [${uniqueNames.join('], [')}]. 대습상속인 입력 또는 '없음 확정'을 눌러 주세요.`,
      });
    });

    groupedDirectMissingMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      // 단일 인원 or 배우자 그룹 → 본인 사건 탭
      // 복수 비-배우자 → 부모 사건 탭 (여러 명 동시 확인)
      const navTarget = (group.isSpouseGroup || uniqueNames.length === 1)
        ? group.firstTargetTabId
        : group.targetTabId;
      uniqueGuidesMap.set(`grouped-direct-missing-${key}`, {
        id: navTarget, uniqueKey: `grouped-direct-missing-${key}`, targetTabId: navTarget, type: 'mandatory', navigationMode: 'event',
        text: group.isSpouseGroup
          ? buildSpouseDirectGuideText(group, uniqueNames)
          : `후속 상속 미확정 — [${group.parentName}] 사건: [${uniqueNames.join('], [')}]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요.`,
      });
    });

    groupedNextOrderFemaleMap.forEach((group, key) => {
      const uniqueNames = Array.from(new Set(group.names));
      if (uniqueNames.length === 0) return;
      uniqueGuidesMap.set(`next-order-female-${key}`, {
        id: group.targetTabId, uniqueKey: `next-order-female-${key}`, targetTabId: group.targetTabId, type: 'recommended', navigationMode: 'event',
        text: `차순위 여성 검토 — [${group.decedentName}] 사건: [${uniqueNames.join('], [')}]. 미혼이면 그대로, 혼인력이 있으면 날짜를 입력해 주세요.`,
      });
    });

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // 가져오기 오류 처리
    (importIssues || []).forEach((issue) => {
      const linkedNode = findNodeInHook(tree, issue.personId, issue.nodeId);
      if (issue.code === 'missing-descendants' && linkedNode && (((linkedNode.heirs || []).length > 0) || !!linkedNode.successorStatus)) {
        return;
      }
      const isLegacyHojuInputCase = issue.code === 'missing-descendants' && linkedNode && !linkedNode.successorStatus && getLawEra(linkedNode.deathDate || tree.deathDate) !== '1991' && ['son', 'husband'].includes(linkedNode.relation);
      const personKey = issue.personId || issue.nodeId || 'root';
      const key = `import-${issue.code}-${personKey}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.nodeId || personKey, uniqueKey: key, personId: issue.personId || '', targetTabId: issue.targetTabId || personKey, targetNodeId: issue.nodeId || undefined, targetNodeIds: [issue.nodeId].filter(Boolean), name: issue.personName || null,
          code: issue.code,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          navigationMode: isLegacyHojuInputCase ? 'event' : 'auto',
          text: isLegacyHojuInputCase
            ? `호주상속 검토 — [${issue.personName || linkedNode?.name || '이름 미상'}] 사건. 상속인 확인 후 호주상속인을 지정해 주세요.`
            : issue.message,
        });
      }
    });

    // 엔진 경고 → SmartGuide 변환 (auto-sibling-redistribution)
    (warnings || []).forEach((warning) => {
      if (warning.code !== 'auto-sibling-redistribution') return;
      const linkedNode = findNodeInHook(tree, warning.personId, warning.targetTabId || warning.id);
      const warningText = linkedNode && ['wife', 'husband', 'spouse'].includes(linkedNode.relation)
        ? linkedNode.relation === 'wife'
          ? `[${linkedNode.name || '해당 배우자'}] 사건의 추가 자녀 여부를 다시 확인해 주세요.`
          : linkedNode.relation === 'husband'
            ? `[${linkedNode.name || '해당 배우자'}] 사건의 자녀 범위를 다시 확인해 주세요.`
            : `[${linkedNode.name || '해당 배우자'}] 사건의 후속 상속 구성을 다시 확인해 주세요.`
        : warning.text;
      const key = `engine-${warning.code}-${warning.personId || warning.targetTabId || 'root'}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: warning.personId || warning.id,
          uniqueKey: key,
          type: 'recommended',
          text: warningText,
          targetTabId: warning.targetTabId || warning.personId,
          personId: warning.personId || '',
        });
      }
    });

    const smartGuides = Array.from(uniqueGuidesMap.values());
    const globalMismatchReasons = audit.issues.map((issue) => ({
      id: issue.targetTabId || issue.personId || issue.id || 'root',
      text: issue.text,
    }));

    return {
      showGlobalWarning: !isInputMode && audit.issues.length > 0,
      showAutoCalcNotice: false, 
      globalMismatchReasons, 
      autoCalculatedNames: [],
      smartGuides,
      noSurvivors,
      hasActionItems: smartGuides.length > 0 || (!isInputMode && audit.issues.length > 0),
      auditActionItems: !isInputMode ? (audit.entityIssues || []) : [],
      repairHints: !isInputMode ? (audit.repairHints || []) : [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares, importIssues]);
};
