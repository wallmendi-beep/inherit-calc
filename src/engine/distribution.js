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
    return { shareWeight: 0, exclusionReason: '선순위(직계비속) 상속인이 존재하여 상속권 없음', modifierReason };
  }
  if (activeRank === 2 && heir.relation === 'sibling') {
    return { shareWeight: 0, exclusionReason: '선순위(직계존속) 상속인이 존재하여 상속권 없음', modifierReason };
  }
  if (activeRank === -1 && heir.relation === 'sibling') {
    return { shareWeight: 0, exclusionReason: '배우자 단독 상속으로 형제자매 상속권 없음', modifierReason };
  }
  if (heir.isExcluded && heir.exclusionOption === 'remarried') {
    return { shareWeight: 0, exclusionReason: '대습상속 개시 전 재혼으로 인한 상속권 소멸', modifierReason };
  }

  if (isSpouse && isDisqualifiedOrLost && !isBefore(inheritedDate, '2024-04-25')) {
    return { shareWeight: 0, exclusionReason: '개정 민법에 따라 결격/상실자의 배우자는 대습상속 불가', modifierReason };
  }
  if (isSpouse && isPredeceased) {
    return { shareWeight: 0, exclusionReason: `${heir.deathDate} 피상속인보다 먼저 사망`, modifierReason };
  }
  if (node.id !== 'root' && heir.relation === 'husband' && isSubstitution) {
    if (isBefore(node.deathDate, '1991-01-01')) {
      return { shareWeight: 0, exclusionReason: '1991년 이전 처 사망으로 사위 대습상속권 없음', modifierReason };
    }
    if (law === '1960' || law === '1979') {
      return { shareWeight: 0, exclusionReason: '1991년 이전 피상속인 사망으로 남편 대습권 없음', modifierReason };
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

  if (law === '1979') {
    if (effectiveRelation === 'daughter') {
      if (!isMarriedAtDate(heir, distributionDate, { isBefore })) {
        return { shareWeight: 1.0, exclusionReason: '', modifierReason };
      }
      modifierReason = heir.relation === 'sibling'
        ? '자매 출가녀 감산 (남자의 1/4)'
        : '출가녀 감산 (남자의 1/4)';
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
      modifierReason = heir.relation === 'sibling'
        ? '자매 여자 감산 (남자의 1/2)'
        : '여자 감산 (남자의 1/2)';
      return { shareWeight: 0.5, exclusionReason: '', modifierReason };
    }
    modifierReason = heir.relation === 'sibling'
      ? '자매 출가녀 감산 (남자의 1/4)'
      : '출가녀 감산 (남자의 1/4)';
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
