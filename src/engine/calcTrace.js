export const toSourceBreakdown = (step, { getPersonKey }) => ({
  from: step.parentDecName || '피상속인',
  lawEra: step.lawEra,
  inN: step.inN,
  inD: step.inD,
  inheritedDate: step.inheritedDate || '',
  distributionDate: step.distributionDate || step.dec?.deathDate || '',
  isSubstitution: !!step.isSubstitution,
  dists: (step.dists || []).map((dist) => ({
    personId: getPersonKey(dist.h),
    name: dist.h?.name || '',
    relation: dist.h?.relation || '',
    n: dist.n,
    d: dist.d,
    sn: dist.sn,
    sd: dist.sd,
    ex: dist.ex || '',
    mod: dist.mod || '',
  })),
});

export const mergeCalcSteps = (steps, { getPersonKey, math }) => {
  const mergedSteps = [];
  const stepByPersonId = {};
  const stepByTraceKey = {};

  steps.forEach((step) => {
    const personKey = getPersonKey(step.dec);
    const traceDate = step.distributionDate || step.dec?.deathDate || '';
    const traceKey = `${personKey}::${traceDate}::${step.isSubstitution ? 'sub' : 'own'}`;
    if (!personKey || step.dec?.id === 'root') {
      mergedSteps.push(step);
      return;
    }

    if (!stepByTraceKey[traceKey]) {
      step.mergeSources = [{ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD }];
      step.sourceBreakdowns = [toSourceBreakdown(step, { getPersonKey })];
      stepByTraceKey[traceKey] = step;
      if (!stepByPersonId[personKey]) stepByPersonId[personKey] = step;
      mergedSteps.push(step);
      return;
    }

    const existing = stepByTraceKey[traceKey];
    existing.mergeSources.push({ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD });
    existing.sourceBreakdowns = existing.sourceBreakdowns || [];
    existing.sourceBreakdowns.push(toSourceBreakdown(step, { getPersonKey }));

    const [newN, newD] = math.add(existing.inN, existing.inD, step.inN, step.inD);
    existing.inN = newN;
    existing.inD = newD;

    const total = existing.dists.reduce((sum, dist) => sum + (dist.rSnap ?? dist.h?.r ?? 0), 0);
    if (total <= 0) return;

    existing.dists = existing.dists.map((dist) => {
      const ratio = dist.rSnap ?? dist.h?.r ?? 0;
      if (ratio === 0) return { ...dist, n: 0, d: 1, sn: 0, sd: 1 };

      const [sn, sd] = math.simplify(ratio * 100, total * 100);
      const [nn, nd] = math.multiply(newN, newD, sn, sd);
      return { ...dist, n: nn, d: nd, sn, sd };
    });
  });

  return { mergedSteps, stepByPersonId };
};
