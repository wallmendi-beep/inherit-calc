export const HOJU_BASIS_TEXT = '실무상 대법원 90마772, 등기선례 제8-187호 취지를 반영했습니다.';

const SUBSTITUTION_HOJU_TEXT = '대습 호주가산';

export const isHojuBonusModifier = (modifier = '') => (
  typeof modifier === 'string' && modifier.includes(SUBSTITUTION_HOJU_TEXT)
);

export const extractHojuBonusNotices = (calcSteps = []) => {
  const seen = new Set();
  const notices = [];

  calcSteps.forEach((step) => {
    (step?.dists || []).forEach((dist) => {
      if (!dist?.h || !isHojuBonusModifier(dist.mod)) return;

      const personId = dist.h.personId || dist.h.id;
      const modifier = dist.mod || '';
      const key = [personId, step.dec?.name || '', modifier].join('::');
      if (seen.has(key)) return;
      seen.add(key);

      const recipientName = dist.h.name || '해당 상속인';
      const decedentName = step.dec?.name || '피상속인';

      notices.push({
        personId,
        recipientName,
        decedentName,
        modifier,
        title: `${recipientName}는 ${decedentName} 상속 단계에서 피대습자 관련 호주상속 가산을 반영하여 계산하였습니다.`,
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
