import { math } from '../engine/utils';

const collectFinalShares = (finalShares = {}) => {
  const list = [];
  if (finalShares.direct) list.push(...finalShares.direct);
  if (finalShares.subGroups) {
    const walk = (group) => {
      list.push(...(group.shares || []));
      (group.subGroups || []).forEach(walk);
    };
    finalShares.subGroups.forEach(walk);
  }
  return list;
};

export const stripHojuBonusInputs = (node) => {
  if (!node) return node;
  return {
    ...node,
    isHoju: false,
    isPrimaryHojuSuccessor: false,
    heirs: (node.heirs || []).map(stripHojuBonusInputs),
  };
};

export const buildHojuBonusDiffs = (currentFinalShares = {}, compareFinalShares = {}) => {
  const currentList = collectFinalShares(currentFinalShares);
  const compareList = collectFinalShares(compareFinalShares);

  const currentMap = new Map(currentList.map((share) => [share.personId || share.id, share]));
  const compareMap = new Map(compareList.map((share) => [share.personId || share.id, share]));
  const keys = new Set([...currentMap.keys(), ...compareMap.keys()]);

  const diffs = [];
  keys.forEach((key) => {
    const current = currentMap.get(key);
    const compare = compareMap.get(key);
    const currentN = current?.n || 0;
    const currentD = current?.d || 1;
    const compareN = compare?.n || 0;
    const compareD = compare?.d || 1;

    if (currentN === compareN && currentD === compareD) return;

    const [deltaN, deltaD] = math.add(currentN, currentD, -compareN, compareD);
    diffs.push({
      personId: key,
      name: current?.name || compare?.name || '',
      relation: current?.relation || compare?.relation || '',
      currentN,
      currentD,
      compareN,
      compareD,
      deltaN,
      deltaD,
    });
  });

  return diffs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};
