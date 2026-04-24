import { isBefore } from '../engine/utils';

export const COMPLETED_SUCCESSOR_STATUSES = new Set([
  'confirmed_no_substitute_heirs',
  'confirmed_no_spouse_descendants',
  'confirmed_no_additional_heirs',
]);

export const hasCompletedSuccessorStatus = (node) =>
  !!node?.successorStatus && COMPLETED_SUCCESSOR_STATUSES.has(node.successorStatus);

export const isPredeceasedSpouseNode = (node, inheritedDate) => {
  if (!node) return false;
  if (!['wife', 'husband', 'spouse'].includes(node.relation)) return false;
  if (!node.deathDate || !inheritedDate) return false;
  return isBefore(node.deathDate, inheritedDate);
};

export const isMissingHeirNode = (node, inheritedDate) => {
  if (!node || node.id === 'root') return false;
  if (!node.isDeceased) return false;
  if (node.isExcluded === true) return false;
  if (hasCompletedSuccessorStatus(node)) return false;
  if ((node.heirs || []).length > 0) return false;
  if (isPredeceasedSpouseNode(node, inheritedDate)) return false;
  return true;
};

export const collectMissingHeirNames = (tree) => {
  if (!tree) return [];
  const names = [];

  const walk = (node, currentInheritedDate) => {
    if (isMissingHeirNode(node, currentInheritedDate)) {
      names.push(node.name || '이름 미상');
    }
    (node.heirs || []).forEach((child) => walk(child, node.deathDate || currentInheritedDate));
  };

  walk(tree, tree.deathDate || '');
  return names;
};

export const hasMissingHeirsInTree = (tree) => collectMissingHeirNames(tree).length > 0;
