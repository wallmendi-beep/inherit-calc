import { getLawEra, isBefore } from '../engine/utils';

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
    return `계모자 관계 확인 — [${wifeNode.name || '처'}]의 배우자 [${husbandNode.name || '남편'}]에게 자녀 [${missingChildNames[0]}]이 입력되어 있습니다. [${missingChildNames[0]}]은 [${wifeNode.name || '처'}]와 계모자 관계일 수 있으므로, 구법상 [${wifeNode.name || '처'}] 사건의 상속인 포함 여부를 확인해 주세요.`;
  }
  return `계모자 관계 확인 — [${wifeNode.name || '처'}]의 배우자 [${husbandNode.name || '남편'}]에게 자녀 [${missingChildNames.join('], [')}]이 입력되어 있습니다. 이들은 [${wifeNode.name || '처'}]와 계모자 관계일 수 있으므로, 구법상 [${wifeNode.name || '처'}] 사건의 상속인 포함 여부를 확인해 주세요.`;
};

export const buildPostMarriageFamilyReviewGuide = (wifeNode, husbandNode, spouseNames, childNames) => {
  const wifeName = wifeNode.name || '처';
  const husbandName = husbandNode.name || '남편';
  const spouseText = spouseNames.length > 0 ? `[${spouseNames.join('], [')}]` : '다른 배우자';
  const childText = childNames.length > 0 ? `[${childNames.join('], [')}]` : '그 자녀';
  return `후혼 가족관계 확인 — [${husbandName}] 아래에 ${spouseText} 및 ${childText}이 입력되어 있습니다. ${spouseText}은(는) [${wifeName}] 사망 후 혼인한 배우자로 보입니다. ${childText}이 [${wifeName}] 사망 당시 출생자 또는 태아였는지 확인하고, 해당하지 않으면 [${wifeName}] 사건에서는 제외해 주세요.`;
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
        const postMarriageSpouses = (child.heirs || []).filter(
          (grandChild) =>
            ['wife', 'husband', 'spouse'].includes(grandChild.relation) &&
            grandChild.marriageDate &&
            wifeEstateDate &&
            isBefore(wifeEstateDate, grandChild.marriageDate)
        );
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
          const postMarriageSpouseNames = Array.from(
            new Set(postMarriageSpouses.map((spouse) => spouse.name || '이름 미상'))
          );
          const isPostMarriageFamilyCase = postMarriageSpouseNames.length > 0;
          entries.push({
            key: `${isPostMarriageFamilyCase ? 'post-marriage-family' : 'legacy-stepchild'}-${node.personId || node.id}-${child.personId || child.id}`,
            targetTabId: child.personId || child.id || node.personId || node.id || 'root',
            relatedEventTabId: node.personId || node.id || 'root',
            personId: child.personId || child.id,
            targetNodeId: missingChildren[0]?.id || missingChildren[0]?.personId,
            targetNodeIds: missingChildren
              .flatMap((grandChild) => [grandChild.id, grandChild.personId])
              .filter(Boolean),
            text: isPostMarriageFamilyCase
              ? buildPostMarriageFamilyReviewGuide(wifeReferenceNode, child, postMarriageSpouseNames, missingChildNames)
              : buildLegacyStepchildReviewGuide(wifeReferenceNode, child, missingChildNames),
            actionLabel: '확인',
          });
        }
      }
      walk(child);
    });
  };

  walk(tree);
  return entries;
};
