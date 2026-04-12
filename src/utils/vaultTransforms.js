import { isBefore } from '../engine/utils';

export const migrateToVault = (oldTree) => {
  const vault = {
    meta: {
      caseNo: oldTree.caseNo || '',
      rootPersonId: oldTree.personId || oldTree.id || 'root',
      targetShareN: oldTree.shareN || 1,
      targetShareD: oldTree.shareD || 1,
    },
    persons: {},
    relationships: {},
  };

  const traverse = (node, parentId = null, visited = new Set()) => {
    if (!node) return;
    const nodeId = node.id || `n_${Math.random().toString(36).substr(2, 9)}`;
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const pId = node.personId || node.id || `p_${Math.random().toString(36).substr(2, 9)}`;
    if (node.id === 'root') vault.meta.rootPersonId = pId;

    if (!vault.persons[pId]) {
      vault.persons[pId] = {
        id: pId,
        name: node.name || '',
        isDeceased: !!node.isDeceased,
        deathDate: node.deathDate || '',
        _lastDeathDate: node._lastDeathDate || node.deathDate || '',
        marriageDate: node.marriageDate || '',
        remarriageDate: node.remarriageDate || '',
        divorceDate: node.divorceDate || '',
        restoreDate: node.restoreDate || '',
        gender: node.gender || '',
      };
    } else {
      const p = vault.persons[pId];
      if (!p.deathDate && node.deathDate) p.deathDate = node.deathDate;
      if (!p._lastDeathDate && (node._lastDeathDate || node.deathDate)) p._lastDeathDate = node._lastDeathDate || node.deathDate;
      if (!p.marriageDate && node.marriageDate) p.marriageDate = node.marriageDate;
      if (!p.divorceDate && node.divorceDate) p.divorceDate = node.divorceDate;
      if (!p.restoreDate && node.restoreDate) p.restoreDate = node.restoreDate;
      if (!p.name && node.name) p.name = node.name;
    }

    if (parentId) {
      if (!vault.relationships[parentId]) vault.relationships[parentId] = [];
      const isManualExclusion =
        !!node.isExcluded &&
        (
          node.exclusionOption === 'renounce' ||
          node.exclusionOption === 'disqualified' ||
          node.exclusionOption === 'predeceased' ||
          node.exclusionOption === 'lost' ||
          node.exclusionOption === 'remarried'
        );

      const existingLink = vault.relationships[parentId].find((link) => link.targetId === pId);
      if (!existingLink) {
        vault.relationships[parentId].push({
          targetId: pId,
          relation: node.relation || 'son',
          isExcluded: isManualExclusion ? true : !!node.isExcluded,
          exclusionOption: isManualExclusion ? node.exclusionOption : '',
          isHoju: !!node.isHoju,
          isPrimaryHojuSuccessor: !!node.isPrimaryHojuSuccessor,
          isSameRegister: node.isSameRegister !== false,
        });
      }
    }

    if (node.heirs) node.heirs.forEach((child) => traverse(child, pId));
  };

  traverse(oldTree);
  return vault;
};

export const buildTreeFromVault = (vault) => {
  if (!vault || !vault.meta) return null;
  const rootId = vault.meta.rootPersonId;
  const rootPerson = vault.persons[rootId];
  if (!rootPerson) return null;

  const buildNode = (personId, parentDeathDate = null, visited = new Set()) => {
    if (visited.has(personId)) return null;
    const newVisited = new Set(visited);
    newVisited.add(personId);
    const person = vault.persons[personId];
    if (!person) return null;

    const node = { ...person, personId, heirs: [] };
    if (personId === rootId) {
      node.caseNo = vault.meta.caseNo;
      node.shareN = vault.meta.targetShareN;
      node.shareD = vault.meta.targetShareD;
      node.id = 'root';
    }

    const effectiveDate = parentDeathDate || node.deathDate;
    const links = vault.relationships[personId] || [];

    links.forEach((link) => {
      const childPerson = vault.persons[link.targetId];
      const nextEffectiveDate =
        childPerson?.deathDate && !isBefore(childPerson.deathDate, effectiveDate)
          ? childPerson.deathDate
          : effectiveDate;

      const childNode = buildNode(link.targetId, nextEffectiveDate, newVisited);
      if (!childNode) return;

      childNode.id = `n_${personId}_${link.targetId}`;
      childNode.relation = link.relation;
      childNode.isHoju = link.isHoju;
      childNode.isPrimaryHojuSuccessor = !!link.isPrimaryHojuSuccessor;

      const isPreDeceased = childNode.deathDate && effectiveDate && isBefore(childNode.deathDate, effectiveDate);
      const isSpouseType = ['wife', 'husband', 'spouse'].includes(childNode.relation);
      const isDaughter = ['daughter'].includes(childNode.relation);

      childNode.isExcluded = link.isExcluded;
      childNode.exclusionOption = link.exclusionOption;

      if (!childNode.isDeceased && childNode.exclusionOption === 'predeceased') {
        childNode.isExcluded = false;
        childNode.exclusionOption = '';
      } else if (isPreDeceased && !isSpouseType) {
        if ((childNode.heirs || []).length > 0) {
          childNode.isExcluded = false;
          childNode.exclusionOption = '';
        } else {
          childNode.isExcluded = true;
          childNode.exclusionOption = 'predeceased';
        }
      } else if (childNode.isDeceased && childNode.deathDate && effectiveDate && !isPreDeceased) {
        // 후사망 상태는 과거 파생 predeceased 값을 남기지 않고 기본 ON으로 복원한다.
        childNode.isExcluded = false;
        childNode.exclusionOption = '';
      }

      if (isDaughter && childNode.marriageDate && effectiveDate && isBefore(childNode.marriageDate, effectiveDate)) {
        childNode.isSameRegister = false;
      } else {
        childNode.isSameRegister = link.isSameRegister;
      }

      node.heirs.push(childNode);
    });

    return node;
  };

  return buildNode(rootId, rootPerson.deathDate);
};

