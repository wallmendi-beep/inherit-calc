import { math } from './utils.js';

const flattenGroupShares = (groups = [], bucket = []) => {
  groups.forEach((group) => {
    (group.shares || []).forEach((share) => bucket.push(share));
    if (group.subGroups?.length) flattenGroupShares(group.subGroups, bucket);
  });
  return bucket;
};

const flattenFinalShares = (finalShares) => {
  const all = [];
  (finalShares?.direct || []).forEach((share) => all.push(share));
  flattenGroupShares(finalShares?.subGroups || [], all);
  return all;
};

const collectResolvedTransitIds = (groups = [], resolved = new Set()) => {
  groups.forEach((group) => {
    if (group?.ancestor?.personId) resolved.add(group.ancestor.personId);
    if (group.subGroups?.length) collectResolvedTransitIds(group.subGroups, resolved);
  });
  return resolved;
};

const pushIssue = (issues, issue) => {
  issues.push({
    displayTargets: ['guide'],
    blocking: false,
    severity: 'warning',
    ...issue,
  });
};

const normalizeWarning = (warning) => {
  if (!warning) return null;
  if (typeof warning === 'string') {
    return {
      code: 'engine-warning',
      severity: 'warning',
      blocking: false,
      id: null,
      personId: null,
      targetTabId: null,
      text: warning,
    };
  }

  return {
    code: warning.code || 'engine-warning',
    severity: warning.severity || 'warning',
    blocking: !!warning.blocking,
    id: warning.id || null,
    personId: warning.personId || null,
    targetTabId: warning.targetTabId || warning.personId || warning.id || null,
    text: warning.text || '',
  };
};

export const auditInheritanceResult = ({
  tree,
  finalShares,
  transitShares = [],
  warnings = [],
}) => {
  const allFinalShares = flattenFinalShares(finalShares);
  const resolvedTransitIds = collectResolvedTransitIds(finalShares?.subGroups || []);
  const normalizedWarnings = (warnings || []).map(normalizeWarning).filter(Boolean);
  let totalN = 0;
  let totalD = 1;

  allFinalShares.forEach((share) => {
    if (share.n > 0) {
      [totalN, totalD] = math.add(totalN, totalD, share.n, share.d);
    }
  });

  const [expectedN, expectedD] = math.simplify(
    Math.max(1, Number(tree?.shareN) || 1),
    Math.max(1, Number(tree?.shareD) || 1)
  );

  const hasDeceasedInFinalShares = allFinalShares.some((share) => share.isDeceased);
  const unresolvedTransitShares = (transitShares || []).filter(
    (share) => share.n > 0 && !resolvedTransitIds.has(share.personId)
  );
  const hasTotalMismatch = totalN !== expectedN || totalD !== expectedD;
  const hasWarnings = normalizedWarnings.length > 0;

  const issues = [];

  // [v3.0.13] 가계도 계층성(항렬) 유효성 검사
  const auditRelationHierarchy = (node, path = []) => {
    if (!node || !node.heirs) return;
    const isDescendant = ['son', 'daughter'].includes(node.relation);
    
    node.heirs.forEach(h => {
      // 자녀(비속)의 하위에 부모(존속)나 방계가 오는 것은 데이터 입력 오류일 확률이 매우 높음
      if (isDescendant && h.relation === 'parent') {
        pushIssue(issues, {
          code: 'hierarchy-violation',
          severity: 'error',
          blocking: false, // 차단까지는 하지 않되 강한 경고
          id: h.id,
          personId: h.personId,
          text: `[${h.name || '상속인'}]님은 부모 관계로 설정되어 있으나, 자녀인 [${node.name}]님의 하위에 배치되어 있습니다. 가계도 계층을 확인해 주세요.`,
          displayTargets: ['guide', 'input']
        });
      }
      auditRelationHierarchy(h, [...path, node.name]);
    });
  };
  auditRelationHierarchy(tree);

  if (hasDeceasedInFinalShares) {
    pushIssue(issues, {
      code: 'deceased-in-final-shares',
      severity: 'error',
      blocking: true,
      text: '사망자 지분이 최종 귀속 결과에 남아 있습니다. 재상속 또는 대습상속 전달이 끝까지 처리되지 않았을 수 있습니다.',
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  unresolvedTransitShares.forEach((share) => {
    pushIssue(issues, {
      code: 'unresolved-transit-share',
      severity: 'error',
      blocking: true,
      id: share.id || share.personId,
      personId: share.personId,
      name: share.name || '이름 미상',
      relation: share.relation || '',
      shareN: share.n,
      shareD: share.d,
      targetTabId: share.personId || share.id || null,
      text: `[${share.name || '이름 미상'}]의 지분 ${share.d}분의 ${share.n}이 다음 상속인에게 아직 전달되지 않았습니다.`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  });

  if (unresolvedTransitShares.length > 0) {
    const names = unresolvedTransitShares.map((share) => share.name).filter(Boolean);
    pushIssue(issues, {
      code: 'unresolved-transit-shares-summary',
      severity: 'error',
      blocking: true,
      text: `사망자의 중간 귀속 지분이 남아 있습니다: ${names.join(', ') || '이름 미상'}`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  if (hasTotalMismatch) {
    pushIssue(issues, {
      code: 'final-total-mismatch',
      severity: 'error',
      blocking: true,
      text: `최종 귀속 지분 합계가 ${expectedD}분의 ${expectedN}이 아니라 ${totalD}분의 ${totalN}입니다.`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  normalizedWarnings.forEach((warning) => {
    pushIssue(issues, {
      ...warning,
      displayTargets: ['guide', 'input'],
    });
  });

  if (hasWarnings) {
    pushIssue(issues, {
      code: 'engine-warnings-present',
      severity: 'warning',
      blocking: false,
      text: `계산 엔진이 확인이 필요한 경고 ${warnings.length}건을 감지했습니다.`,
      displayTargets: ['guide', 'input'],
    });
  }

  const blockingIssues = issues.filter((issue) => issue.blocking);
  const repairHints = blockingIssues.map((issue) => {
    let hintText = issue.text;
    
    // [v4.1] 문제 코드별 맞춤형 해결 힌트 제공 (단순 현상 반복 방지)
    switch (issue.code) {
      case 'final-total-mismatch':
        hintText = '하위 계보 중 지분 배분이 누락된 곳이 있는지, 혹은 상속포기/결격자의 처리가 법령에 맞게 완결되었는지 확인해 주세요.';
        break;
      case 'deceased-in-final-shares':
        hintText = '사망자의 지분이 최종 결과에 남아 있습니다. 해당 사망자의 하위 상속인 입력 탭으로 이동하여 지분 전달을 마무리해 주세요.';
        break;
      case 'unresolved-transit-share':
        hintText = `[${issue.name || '이름 미상'}]님의 하위 계보를 생성하거나 상속인 없음 처리를 통해 잔여 지분 ${issue.shareD}분의 ${issue.shareN}을 배분해 주세요.`;
        break;
      case 'hierarchy-violation':
        hintText = '상위/하위 계보의 부모-자식 관계 설정이 법적으로 타당한지 확인하고 인물을 재배치해 주세요.';
        break;
      default:
        hintText = issue.personId ? `[${issue.name || '이름 미상'}]님의 입력 상태를 확인해 주세요.` : issue.text;
    }

    return {
      code: issue.code,
      personId: issue.personId || issue.id || null,
      name: issue.name || null,
      targetTabId: issue.targetTabId || issue.personId || issue.id || null,
      text: hintText,
    };
  });
  const entityIssues = issues.filter((issue) => issue.personId || issue.id);

  return {
    total: { n: totalN, d: totalD },
    expectedTotal: { n: expectedN, d: expectedD },
    hasDeceasedInFinalShares,
    unresolvedTransitShares,
    hasTotalMismatch,
    issues,
    entityIssues,
    blockingIssues,
    repairHints,
    hasBlockingIssues: blockingIssues.length > 0,
  };
};
