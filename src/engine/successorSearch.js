export const findHeirsByName = (root, targetName, excludeId) => {
  if (!targetName || targetName.trim() === '') return null;

  let found = null;

  const search = (node) => {
    if (found) return;
    if (node.id !== excludeId && node.name === targetName && node.heirs && node.heirs.length > 0) {
      found = node.heirs;
      return;
    }
    if (node.heirs) node.heirs.forEach(search);
  };

  search(root);
  return found;
};

const findParent = (current, targetId) => {
  if (!current?.heirs) return null;
  if (current.heirs.some((heir) => heir.id === targetId)) return current;

  for (const heir of current.heirs) {
    const parent = findParent(heir, targetId);
    if (parent) return parent;
  }

  return null;
};

export const findGlobalSuccessors = (tree, targetNode) => {
  const parentNode = findParent(tree, targetNode?.id);
  if (!parentNode) return [];

  const survivingSpouse = (parentNode.heirs || []).filter((heir) =>
    ['wife', 'husband', 'spouse'].includes(heir.relation)
    && !heir.isDeceased
    && !heir.isExcluded
  );
  if (survivingSpouse.length > 0) return survivingSpouse;

  return (parentNode.heirs || [])
    .filter((heir) =>
      heir.id !== targetNode.id
      && ['son', 'daughter'].includes(heir.relation)
      && (!heir.isExcluded || ['predeceased', 'disqualified', 'lost'].includes(heir.exclusionOption))
    )
    .map((heir) => ({ ...heir, relation: 'sibling', _origRelation: heir.relation }));
};
