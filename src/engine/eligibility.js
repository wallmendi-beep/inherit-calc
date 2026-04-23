export const isSpouseRelation = (relation) => (
  ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(relation)
);

export const isEligibleSubstitutionHeir = (child, ancestor, contextDate, { isBefore }) => {
  if (!child) return false;

  const ancestorDeathDate = ancestor?.deathDate || null;
  const blocksHusbandSubstitution =
    (ancestorDeathDate && isBefore(ancestorDeathDate, '1991-01-01'))
    || (contextDate && isBefore(contextDate, '1991-01-01'));

  if (
    ancestor?.relation === 'daughter'
    && child.relation === 'husband'
    && blocksHusbandSubstitution
  ) {
    return false;
  }

  return true;
};

export const isSubstitutionTrigger = (heir, { isSpouseRelation: isSpouseRelationFn = isSpouseRelation } = {}) => (
  !isSpouseRelationFn(heir?.relation) && (
    heir?.isDeceased
    || (heir?.isExcluded && (heir?.exclusionOption === 'disqualified' || heir?.exclusionOption === 'lost'))
  )
);

export const isRenouncedHeir = (
  heir,
  contextDate,
  {
    isBefore,
    isSpouseRelation: isSpouseRelationFn = isSpouseRelation,
    getQualifiedSubstitutionHeirs,
  }
) => {
  const isSpouseHeir = isSpouseRelationFn(heir?.relation);
  const isDivorcedAuto = isSpouseHeir && heir?.divorceDate && contextDate && !isBefore(contextDate, heir.divorceDate);
  const isRemarriedAuto = isSpouseHeir && heir?.remarriageDate && contextDate && !isBefore(contextDate, heir.remarriageDate);

  const isPredeceasedOption = heir?.isExcluded && heir.exclusionOption === 'predeceased';
  const isDisqualified = heir?.isExcluded && (heir.exclusionOption === 'lost' || heir.exclusionOption === 'disqualified');

  if (heir?.isExcluded && !isDisqualified && !isPredeceasedOption) return true;
  if (isDivorcedAuto || isRemarriedAuto) return true;

  const isPre = heir?.isDeceased && heir?.deathDate && contextDate && isBefore(heir.deathDate, contextDate);

  if (isSpouseHeir && (isPre || isDisqualified)) return true;

  if (isPre || isDisqualified) {
    const validHeirs = getQualifiedSubstitutionHeirs(heir, contextDate, true);
    if (validHeirs.length === 0) return true;
    return false;
  }

  return false;
};
