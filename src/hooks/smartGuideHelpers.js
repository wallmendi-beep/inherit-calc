import { getLawEra } from '../engine/utils';

export const buildSpouseDirectGuideText = (group, names) => {
  if (group.spouseRelation === 'wife') {
    return names.length === 1
      ? `후속 상속 미확정 — [${names[0]}] 사건. 추가 자녀가 있으면 입력, 없으면 '없음 확정'을 눌러 주세요.`
      : `후속 상속 미확정 — [${group.parentName}] 배우자별 자녀 확인: [${names.join('], [')}].`;
  }
  if (group.spouseRelation === 'husband') {
    return names.length === 1
      ? `후속 상속 미확정 — [${names[0]}] 사건. 자녀 범위를 확인하고 입력해 주세요.`
      : `후속 상속 미확정 — [${group.parentName}] 남편별 자녀 확인: [${names.join('], [')}].`;
  }
  return names.length === 1
    ? `후속 상속 미확정 — [${names[0]}] 사건. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요.`
    : `후속 상속 미확정 — [${group.parentName}] 배우자별 후속 상속 확인: [${names.join('], [')}].`;
};

export const buildLegacyStepchildReviewGuide = (wifeNode, husbandNode, missingChildNames) => {
  if (missingChildNames.length === 0) return null;
  if (missingChildNames.length === 1) {
    return `계모자 관계 확인 — [${missingChildNames[0]}]이 [${husbandNode.name || '남편'}]의 자녀로 입력됨. 구법상 [${wifeNode.name || '처'}] 사건의 상속인에 포함될 수 있습니다.`;
  }
  return `계모자 관계 확인 — [${wifeNode.name || '처'}] 사건 미포함 자녀([${husbandNode.name || '남편'}]): [${missingChildNames.join('], [')}]. 구법상 상속인에 포함될 수 있습니다.`;
};

export const collectLegacyStepchildGuideEntries = (tree) => {
  const entries = [];

  const walk = (node) => {
    if (!node?.heirs?.length) return;

    node.heirs.forEach((child) => {
      if (child?.relation === 'husband') {
        const wifeReferenceNode =
          node.relation === 'wife'
            ? node
            : (node.heirs || []).find((sibling) => sibling.id !== child.id && ['wife', 'spouse'].includes(sibling.relation)) || node;
        const wifeEstateDate = node.deathDate || tree.deathDate;
        if (getLawEra(wifeEstateDate) === '1991') {
          walk(child);
          return;
        }
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
