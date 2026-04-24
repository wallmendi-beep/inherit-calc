export const determineActiveRank = (targetHeirs) => {
  let hasRank1 = false;
  let hasRank2 = false;
  let hasRank3 = false;
  let hasSpouse = false;

  targetHeirs.forEach((heir) => {
    if (heir.relation === 'son' || heir.relation === 'daughter') hasRank1 = true;
    else if (heir.relation === 'parent') hasRank2 = true;
    else if (heir.relation === 'sibling') hasRank3 = true;
    else if (heir.relation === 'wife' || heir.relation === 'husband' || heir.relation === 'spouse') hasSpouse = true;
  });

  if (hasRank1) return 1;
  if (hasRank2) return 2;
  if (hasSpouse) return -1;
  if (hasRank3) return 3;
  return 0;
};

const isMarriedAtDate = (heir, distributionDate, { isBefore }) => {
  let isMarried = heir.isSameRegister === false;

  if (heir.marriageDate && distributionDate) {
    isMarried = !isBefore(distributionDate, heir.marriageDate);
  }
  if (heir.restoreDate && distributionDate && !isBefore(distributionDate, heir.restoreDate)) {
    isMarried = false;
  }

  return isMarried;
};

export const assignHeirShare = (
  heir,
  {
    activeRank,
    distributionDate,
    inheritedDate,
    isBefore,
    isDisqualifiedOrLost,
    isSubstitution,
    law,
    node,
    hojuContext,
    canApplyHojuBonus,
    getHojuBonusReason,
  }
) => {
  const isSpouse = heir.relation === 'wife' || heir.relation === 'husband' || heir.relation === 'spouse';
  const isPredeceased = heir.isDeceased && heir.deathDate && isBefore(heir.deathDate, distributionDate);
  let modifierReason = '';

  if (activeRank === 1 && (heir.relation === 'parent' || heir.relation === 'sibling')) {
    return { shareWeight: 0, exclusionReason: '?좎닚??吏곴퀎鍮꾩냽) ?곸냽?몄씠 議댁옱?섏뿬 ?곸냽沅??놁쓬', modifierReason };
  }
  if (activeRank === 2 && heir.relation === 'sibling') {
    return { shareWeight: 0, exclusionReason: '?좎닚??吏곴퀎議댁냽) ?곸냽?몄씠 議댁옱?섏뿬 ?곸냽沅??놁쓬', modifierReason };
  }
  if (activeRank === -1 && heir.relation === 'sibling') {
    return { shareWeight: 0, exclusionReason: '諛곗슦???⑤룆 ?곸냽?쇰줈 ?뺤젣?먮ℓ ?곸냽沅??놁쓬', modifierReason };
  }
  if (heir.isExcluded && heir.exclusionOption === 'remarried') {
    return { shareWeight: 0, exclusionReason: '??듭긽??媛쒖떆 ???ы샎?쇰줈 ?명븳 ?곸냽沅??뚮㈇', modifierReason };
  }

  if (isSpouse && isDisqualifiedOrLost && !isBefore(inheritedDate, '2024-04-25')) {
    return { shareWeight: 0, exclusionReason: '媛쒖젙 誘쇰쾿???곕씪 寃곌꺽/?곸떎?먯쓽 諛곗슦?먮뒗 ??듭긽??遺덇?', modifierReason };
  }
  if (isSpouse && isPredeceased) {
    return { shareWeight: 0, exclusionReason: `${heir.deathDate} ?쇱긽?띿씤蹂대떎 癒쇱? ?щ쭩`, modifierReason };
  }
  if (node.id !== 'root' && heir.relation === 'husband' && isSubstitution) {
    if (isBefore(node.deathDate, '1991-01-01')) {
      return { shareWeight: 0, exclusionReason: '1991???댁쟾 泥??щ쭩?쇰줈 ?ъ쐞 ??듭긽?띻텒 ?놁쓬', modifierReason };
    }
    if (law === '1960' || law === '1979') {
      return { shareWeight: 0, exclusionReason: '1991???댁쟾 ?쇱긽?띿씤 ?щ쭩?쇰줈 ?⑦렪 ??듦텒 ?놁쓬', modifierReason };
    }
    return { shareWeight: 1.5, exclusionReason: '', modifierReason: '남편 5할 가산' };
  }

  if (heir.relation === 'wife' || (heir.relation === 'spouse' && node.relation === 'son')) {
    if (law === '1991' || law === '1979') {
      return { shareWeight: 1.5, exclusionReason: '', modifierReason: '처(배우자) 5할 가산' };
    }
    if (activeRank === 2) {
      return { shareWeight: 1.0, exclusionReason: '', modifierReason: '처 균분 (직계존속과 동순위)' };
    }
    return { shareWeight: 0.5, exclusionReason: '', modifierReason: '처 감산 (직계비속의 1/2)' };
  }

  if (heir.relation === 'husband' || (heir.relation === 'spouse' && node.relation === 'daughter')) {
    if (law === '1991') {
      return { shareWeight: 1.5, exclusionReason: '', modifierReason: '남편(배우자) 5할 가산' };
    }
    return { shareWeight: 1.0, exclusionReason: '', modifierReason };
  }

  if (law === '1991') {
    return { shareWeight: 1.0, exclusionReason: '', modifierReason };
  }

  const effectiveRelation = heir.relation === 'sibling' ? (heir._origRelation || 'son') : heir.relation;
  const displayRelation = heir._origRelation || heir.relation;

  if (law === '1979') {
    if (effectiveRelation === 'daughter') {
      if (!isMarriedAtDate(heir, distributionDate, { isBefore })) {
        return { shareWeight: 1.0, exclusionReason: '', modifierReason };
      }
      modifierReason = displayRelation === 'sibling'
        ? '?먮ℓ 異쒓?? 媛먯궛 (?⑥옄??1/4)'
        : '異쒓?? 媛먯궛 (?⑥옄??1/4)';
      return { shareWeight: 0.25, exclusionReason: '', modifierReason };
    }

    if (effectiveRelation === 'son') {
      if (heir.relation !== 'sibling' && canApplyHojuBonus({ heir, law, context: hojuContext })) {
        return { shareWeight: 1.5, exclusionReason: '', modifierReason: getHojuBonusReason({ context: hojuContext }) };
      }
      return { shareWeight: 1.0, exclusionReason: '', modifierReason };
    }

    return { shareWeight: 1.0, exclusionReason: '', modifierReason };
  }

  if (effectiveRelation === 'daughter') {
    if (!isMarriedAtDate(heir, distributionDate, { isBefore })) {
      modifierReason = displayRelation === 'sibling'
        ? '?먮ℓ ?ъ옄 媛먯궛 (?⑥옄??1/2)'
        : '?ъ옄 媛먯궛 (?⑥옄??1/2)';
      return { shareWeight: 0.5, exclusionReason: '', modifierReason };
    }
    modifierReason = displayRelation === 'sibling'
      ? '?먮ℓ 異쒓?? 媛먯궛 (?⑥옄??1/4)'
      : '異쒓?? 媛먯궛 (?⑥옄??1/4)';
    return { shareWeight: 0.25, exclusionReason: '', modifierReason };
  }

  if (effectiveRelation === 'son') {
    if (heir.relation !== 'sibling' && canApplyHojuBonus({ heir, law, context: hojuContext })) {
      return { shareWeight: 1.5, exclusionReason: '', modifierReason: getHojuBonusReason({ context: hojuContext }) };
    }
    return { shareWeight: 1.0, exclusionReason: '', modifierReason };
  }

  return { shareWeight: 1.0, exclusionReason: '', modifierReason };
};
