import { useMemo } from 'react';
import { isBefore } from '../engine/utils';
import { calculateInheritance } from '../engine/inheritance';
import { stripHojuBonusInputs, buildHojuBonusDiffs } from '../utils/hojuBonusCompare';

function preprocessTree(n, parentDate, parentNode, visited = new Set()) {
  const pId = n.personId || n.id;
  if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };
  const clone = { ...n };
  const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
  const newVisited = new Set(visited);
  newVisited.add(pId);
  if (clone.id !== 'root') {
    const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate);
    const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
    const hasHeirsInModel = clone.heirs && clone.heirs.length > 0;
    if (hasHeirsInModel && !(isPre && isSpouseType)) { clone.isExcluded = false; clone.exclusionOption = ''; }
    if (isPre && isSpouseType) { clone.isExcluded = true; clone.exclusionOption = 'predeceased'; }
  }
  if (clone.heirs) {
    clone.heirs = clone.heirs.map((h) => preprocessTree(h, clone.deathDate || refDate, clone, newVisited));
  }
  return clone;
}

export function useCalcResult(tree, propertyValue, activeTab) {
  return useMemo(() => {
    const calcTree = preprocessTree(tree, tree.deathDate, null);
    const shouldBuildCalcSteps = ['tree', 'summary', 'amount', 'acquisition'].includes(activeTab);
    const result = calculateInheritance(calcTree, propertyValue, { includeCalcSteps: shouldBuildCalcSteps });
    const shouldBuildCompare = ['summary'].includes(activeTab);
    const compareTree = shouldBuildCompare ? stripHojuBonusInputs(calcTree) : null;
    const compareResult = shouldBuildCompare
      ? calculateInheritance(compareTree, propertyValue, { includeCalcSteps: false })
      : null;
    return {
      ...result,
      compareFinalShares: compareResult?.finalShares || {},
      hojuBonusDiffs: shouldBuildCompare
        ? buildHojuBonusDiffs(result.finalShares || {}, compareResult?.finalShares || {})
        : [],
    };
  }, [tree, propertyValue, activeTab]);
}
