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

export const auditInheritanceResult = ({
  tree,
  finalShares,
  transitShares = [],
  warnings = [],
}) => {
  const allFinalShares = flattenFinalShares(finalShares);
  const resolvedTransitIds = collectResolvedTransitIds(finalShares?.subGroups || []);
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
  const hasWarnings = (warnings || []).length > 0;

  const issues = [];

  if (hasDeceasedInFinalShares) {
    issues.push({
      code: 'deceased-in-final-shares',
      severity: 'error',
      text: '사망자 지분이 최종 귀속 결과에 남아 있습니다. 재상속 또는 대습상속 전달이 끝까지 처리되지 않았을 수 있습니다.',
    });
  }

  if (unresolvedTransitShares.length > 0) {
    const names = unresolvedTransitShares.map((share) => share.name).filter(Boolean);
    issues.push({
      code: 'unresolved-transit-shares',
      severity: 'error',
      text: `사망자의 중간 귀속 지분이 남아 있습니다: ${names.join(', ') || '이름 미상'}`,
    });
  }

  if (hasTotalMismatch) {
    issues.push({
      code: 'final-total-mismatch',
      severity: 'error',
      text: `최종 귀속 지분 합계가 ${expectedD}분의 ${expectedN}이 아니라 ${totalD}분의 ${totalN}입니다.`,
    });
  }

  if (hasWarnings) {
    issues.push({
      code: 'engine-warnings-present',
      severity: 'warning',
      text: `계산 엔진이 확인이 필요한 경고 ${warnings.length}건을 감지했습니다.`,
    });
  }

  return {
    total: { n: totalN, d: totalD },
    expectedTotal: { n: expectedN, d: expectedD },
    hasDeceasedInFinalShares,
    unresolvedTransitShares,
    hasTotalMismatch,
    issues,
  };
};
