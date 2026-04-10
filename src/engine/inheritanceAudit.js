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
  const repairHints = blockingIssues.map((issue) => ({
    code: issue.code,
    personId: issue.personId || issue.id || null,
    name: issue.name || null,
    targetTabId: issue.targetTabId || issue.personId || issue.id || null,
    text: issue.personId
      ? `[${issue.name || '이름 미상'}] 입력을 확인해 주세요.`
      : issue.text,
  }));
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
