import { getLawEra } from '../engine/utils';

export const buildSpouseDirectGuideText = (group, names) => {
  if (group.spouseRelation === 'wife') {
    return names.length === 1
      ? `[${names[0]}] 사건의 추가 자녀 여부를 확인해 주세요.`
      : `${group.parentName} 사건의 배우자별 추가 자녀 여부를 확인해 주세요: [${names.join('], [')}].`;
  }
  if (group.spouseRelation === 'husband') {
    return names.length === 1
      ? `[${names[0]}] 사건의 자녀 범위를 확인해 주세요.`
      : `${group.parentName} 사건의 남편별 자녀 범위를 확인해 주세요: [${names.join('], [')}].`;
  }
  return names.length === 1
    ? `[${names[0]}] 사건의 후속 상속 구성을 확인해 주세요.`
    : `${group.parentName} 사건의 배우자별 후속 상속 구성을 확인해 주세요: [${names.join('], [')}].`;
};

export const buildLegacyStepchildReviewGuide = (wifeNode, husbandNode, missingChildNames) => {
  if (missingChildNames.length === 0) return null;
  if (missingChildNames.length === 1) {
    return `[${missingChildNames[0]}]은(는) [${husbandNode.name || '남편'}]의 자녀로 입력되어 있습니다. 1991년 이전에는 계모자관계에 따라 [${wifeNode.name || '처'}] 사건의 상속인에 포함될 수 있으니 확인 바랍니다.`;
  }
  return `1991년 이전 사건입니다. [${wifeNode.name || '처'}] 사건에 포함되지 않은 [${husbandNode.name || '남편'}]의 자녀가 있습니다: [${missingChildNames.join('], [')}]. 계모자관계에 따라 상속인에 포함될 수 있으니 확인 바랍니다.`;
};

export const collectLegacyStepchildGuideEntries = (tree) => {
  const entries = [];

  const walk = (node) => {
    if (!node?.heirs?.length) return;

    node.heirs.forEach((child) => {
      if (
        child?.relation === 'husband' &&
        getLawEra(child.deathDate || node.deathDate || tree.deathDate) !== '1991'
      ) {
        const wifeReferenceNode =
          node.relation === 'wife'
            ? node
            : (node.heirs || []).find((sibling) => sibling.id !== child.id && ['wife', 'spouse'].includes(sibling.relation)) || node;
        const husbandChildren = (child.heirs || []).filter((grandChild) => ['son', 'daughter'].includes(grandChild.relation));
        const wifeChildPersonIds = new Set(
          (node.heirs || [])
            .filter((sibling) => ['son', 'daughter'].includes(sibling.relation))
            .map((sibling) => sibling.personId || sibling.id)
            .filter(Boolean)
        );
        const missingChildren = husbandChildren.filter((grandChild) => {
          const personKey = grandChild.personId || grandChild.id;
          return personKey && !wifeChildPersonIds.has(personKey);
        });

        if (missingChildren.length > 0) {
          const missingChildNames = Array.from(
            new Set(missingChildren.map((grandChild) => grandChild.name || '이름 미상'))
          );
          entries.push({
            key: `legacy-stepchild-${node.personId || node.id}-${child.personId || child.id}`,
            targetTabId: node.personId || node.id || 'root',
            personId: child.personId || child.id,
            text: buildLegacyStepchildReviewGuide(wifeReferenceNode, child, missingChildNames),
          });
        }
      }
      walk(child);
    });
  };

  walk(tree);
  return entries;
};
