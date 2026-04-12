const fs = require('fs');
const path = require('path');

async function main() {
  const jsonPath = path.resolve(process.argv[2]);
  const treeDomainPath = 'file://' + path.resolve(__dirname, '..', 'src', 'utils', 'treeDomain.js').replace(/\\/g, '/');
  const engineUtilsPath = 'file://' + path.resolve(__dirname, '..', 'src', 'engine', 'utils.js').replace(/\\/g, '/');
  const inheritancePath = 'file://' + path.resolve(__dirname, '..', 'src', 'engine', 'inheritance.js').replace(/\\/g, '/');

  const { normalizeImportedTree } = await import(treeDomainPath);
  const { isBefore, getLawEra } = await import(engineUtilsPath);
  const { calculateInheritance } = await import(inheritancePath);

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const tree = normalizeImportedTree(raw);

  const preprocessTree = (n, parentDate, parentNode, visited = new Set()) => {
    const pId = n.personId || n.id;
    if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };

    const clone = { ...n };
    const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
    const newVisited = new Set(visited);
    newVisited.add(pId);

    if (clone.id !== 'root') {
      if (clone.relation === 'daughter' && clone.marriageDate && refDate) {
        const lawEra = getLawEra(refDate);
        if (lawEra !== '1991') {
          const wasMarriedAtDeath = !isBefore(refDate, clone.marriageDate);
          clone.isSameRegister = !wasMarriedAtDeath;
          clone._isInferredRegister = true;
        }
      }

      const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate);
      const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
      const hasHeirsInModel = clone.heirs && clone.heirs.length > 0;

      if (hasHeirsInModel && !(isPre && isSpouseType)) {
        clone.isExcluded = false;
        clone.exclusionOption = '';
      }

      if (isPre && isSpouseType) {
        clone.isExcluded = true;
        clone.exclusionOption = 'predeceased';
      }

      const isDeadWithoutHeirs = clone.isDeceased && !hasHeirsInModel;

      if (isPre && isDeadWithoutHeirs) {
        clone.isExcluded = true;
        clone.exclusionOption = 'predeceased';
      } else if (!isPre && isDeadWithoutHeirs && parentNode && !clone.id.startsWith('auto_')) {
        clone.isExcluded = false;
        clone.exclusionOption = '';

        if (!isSpouseType) {
          const pHeirs = parentNode.heirs || [];
          const aliveAscendants = pHeirs.filter(
            (h) =>
              ['wife', 'husband', 'spouse'].includes(h.relation) &&
              (!h.isDeceased || (h.deathDate && !isBefore(h.deathDate, clone.deathDate))) &&
              !h.isExcluded
          );
          if (aliveAscendants.length > 0) {
            clone.heirs = aliveAscendants.map((asc) => ({ ...asc, id: `auto_${asc.id}`, relation: 'parent', heirs: [] }));
          } else {
            const siblings = pHeirs.filter(
              (h) => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded
            );
            if (siblings.length > 0) {
              clone.heirs = siblings.map((sib) => ({ ...sib, id: `auto_${sib.id}`, relation: 'sibling', heirs: [] }));
            }
          }
        } else {
          const stepChildren = parentNode.heirs.filter(
            (h) => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded
          );
          if (stepChildren.length > 0) {
            clone.heirs = stepChildren.map((child) => ({ ...child, id: `auto_${child.id}`, relation: child.relation, heirs: [] }));
          }
        }
      }
    }

    if (clone.heirs) {
      clone.heirs = clone.heirs.map((h) => preprocessTree(h, clone.deathDate || refDate, clone, newVisited));
    }
    return clone;
  };

  const calcTree = preprocessTree(tree, tree.deathDate, null);
  const result = calculateInheritance(calcTree);

  const spouseNodes = calcTree.heirs.filter((h) => ['wife', 'husband', 'spouse'].includes(h.relation));
  const groups = (result.finalShares.subGroups || []).map((g, idx) => ({
    idx,
    ancestor: g.ancestor?.name,
    relation: g.ancestor?.relation,
    mergeSources: g.sourceBreakdown?.mergeSources || [],
    shareNames: (g.shares || []).map((s) => s.name),
  }));

  console.log(
    JSON.stringify(
      {
        normalizedRootSpouses: tree.heirs
          .filter((h) => ['wife', 'husband', 'spouse'].includes(h.relation))
          .map((h) => ({
            name: h.name,
            deathDate: h.deathDate,
            isExcluded: h.isExcluded,
            exclusionOption: h.exclusionOption,
            heirs: (h.heirs || []).length,
          })),
        preprocessedRootSpouses: spouseNodes.map((h) => ({
          name: h.name,
          deathDate: h.deathDate,
          isExcluded: h.isExcluded,
          exclusionOption: h.exclusionOption,
          heirs: (h.heirs || []).map((x) => x.name),
        })),
        groups,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
