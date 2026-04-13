export const HOJU_BASIS_TEXT = '실무상 대법원 90마772, 등기선례 제8-187호 취지를 반영했습니다.';

export const isHojuBonusModifier = (modifier = '') => (
  typeof modifier === 'string'
  && (modifier.includes('호주상속 5할 가산') || modifier.includes('대습 호주가산'))
);

export const extractHojuBonusNotices = (calcSteps = []) => {
  const seen = new Set();
  const notices = [];

  calcSteps.forEach((step) => {
    (step?.dists || []).forEach((dist) => {
      if (!dist?.h || !isHojuBonusModifier(dist.mod)) return;
      const personId = dist.h.personId || dist.h.id;
      const key = [personId, step.dec?.name || '', dist.mod || ''].join('::');
      if (seen.has(key)) return;
      seen.add(key);

      const isSubstitution = (dist.mod || '').includes('대습 호주가산');
      const recipientName = dist.h.name || '해당 상속인';
      const decedentName = step.dec?.name || '피상속인';

      notices.push({
        personId,
        recipientName,
        decedentName,
        modifier: dist.mod || '',
        title: isSubstitution
          ? `${recipientName}은(는) ${decedentName} 상속 단계에서 대습 호주가산으로 계산되었습니다.`
          : `${recipientName}은(는) ${decedentName} 상속 단계에서 호주상속 5할 가산으로 계산되었습니다.`,
        basis: HOJU_BASIS_TEXT,
      });
    });
  });

  return notices;
};

export const buildHojuBonusPersonMap = (calcSteps = []) => {
  const map = new Map();

  extractHojuBonusNotices(calcSteps).forEach((notice) => {
    if (!map.has(notice.personId)) map.set(notice.personId, []);
    map.get(notice.personId).push(notice);
  });

  return map;
};
