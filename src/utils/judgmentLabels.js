import { isBefore } from '../engine/utils';

export const formatKoreanDate = (date) => {
  if (!date) return '';
  const [year, month, day] = String(date).split('-');
  if (!year) return '';
  if (!month || !day) return `${year}년`;
  return `${year}년 ${month}월 ${day}일`;
};

const getName = (person = {}) => person.name || '이름 미상';

export const formatModifierLabel = (modifierReason = '', person = {}) => {
  const text = modifierReason || '';
  if (!text) return '';

  if (text.includes('호주')) {
    if (text.includes('대습')) return '대습 호주가산';
    return '호주상속 5할 가산';
  }
  if (text.includes('처') && text.includes('감산')) return '처 감산(남자의 1/2)';
  if (text.includes('처') && text.includes('가산')) return '처(배우자) 5할 가산';
  if (text.includes('남편') && text.includes('가산')) return '남편(배우자) 5할 가산';
  if (text.includes('여자') && text.includes('감산')) return '동일가적 여자, 감산(남자의 1/2)';
  if (text.includes('출가') || (text.includes('감산') && person.isSameRegister === false)) {
    const date = formatKoreanDate(person.marriageDate);
    return date
      ? `${date} 혼인, 비동일가적, 감산(남자의 1/4)`
      : '비동일가적, 감산(남자의 1/4)';
  }
  if (text.includes('가산')) return text.replace(/\s+/g, ' ').trim();
  if (text.includes('감산')) return text.replace(/\s+/g, ' ').trim();
  return text.replace(/\s+/g, ' ').trim();
};

export const formatExclusionLabel = (exclusionReason = '', person = {}, eventDate = '') => {
  const text = exclusionReason || '';
  if (text.includes('1991년 이전 처 사망') || person.exclusionOption === 'blocked_husband_substitution') {
    return '1991년 이전 처 사망(대습상속 불가)';
  }
  if (text.includes('1991년 이전 피상속인 사망')) {
    return '1991년 이전 상속개시(남편 대습 불가)';
  }
  if (text.includes('개정 민법') && text.includes('대습상속 불가')) {
    return '결격/상실자 배우자(대습상속 불가)';
  }
  if (text.includes('대습상속 개시 전 재혼') || person.exclusionOption === 'remarried') {
    const date = formatKoreanDate(person.remarriageDate);
    return `${date ? `${date} ` : ''}재혼(대습상속 불가)`;
  }
  if (person.exclusionOption === 'renounce') return '상속포기';
  if (person.exclusionOption === 'lost') return '상속권 상실';
  if (person.exclusionOption === 'disqualified' || person.exclusionOption === 'unworthy') return '상속결격';
  if (text.includes('선순위(직계비속)')) return '선순위 직계비속 존재';
  if (text.includes('선순위(직계존속)')) return '선순위 직계존속 존재';
  if (text.includes('배우자 단독 상속')) return '배우자 단독 상속';

  if (person.divorceDate && eventDate && !isBefore(eventDate, person.divorceDate)) {
    return `${formatKoreanDate(person.divorceDate)} 이혼(상속권 없음)`;
  }
  if (person.remarriageDate && eventDate && !isBefore(eventDate, person.remarriageDate)) {
    return `${formatKoreanDate(person.remarriageDate)} 재혼(상속권 없음)`;
  }
  if (person.deathDate && eventDate && isBefore(person.deathDate, eventDate)) {
    return `${formatKoreanDate(person.deathDate)} 선사망(상속권 없음)`;
  }
  if (text.includes('피상속인보다 먼저 사망')) {
    const date = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return `${formatKoreanDate(date || person.deathDate)} 선사망(상속권 없음)`;
  }
  return text.replace(/\s+/g, ' ').trim() || '상속권 없음';
};

export const formatJudgmentLabel = (dist, eventDate = '', fallback = '균분') => {
  if (!dist) return fallback;
  if (dist.ex) return formatExclusionLabel(dist.ex, dist.h, eventDate);
  const mod = formatModifierLabel(dist.mod, dist.h);
  return mod || fallback;
};

export const formatJudgmentSummary = (dist, eventDate = '') => {
  const name = getName(dist?.h);
  return `[${name}] ${formatJudgmentLabel(dist, eventDate)}`;
};

export const formatRegisterNote = (person = {}) => {
  if (person.isSameRegister !== false) return '';
  const date = formatKoreanDate(person.marriageDate);
  return date ? `${date} 혼인, 비동일가적` : '비동일가적';
};
