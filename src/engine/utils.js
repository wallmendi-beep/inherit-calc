export const math = {
  gcd: (a, b) => {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    if (b === 0) return a; return math.gcd(b, a % b);
  },
  lcm: (a, b) => {
    if (a === 0 || b === 0) return 0;
    return (a / math.gcd(a, b)) * b;
  },
  simplify: (n, d) => {
    if (n === 0) return [0, 1];
    const nInt = Math.round(n); const dInt = Math.round(d);
    const g = math.gcd(Math.abs(nInt), Math.abs(dInt));
    return [nInt / g, dInt / g];
  },
  multiply: (n1, d1, n2, d2) => math.simplify(n1 * n2, d1 * d2),
  add: (n1, d1, n2, d2) => {
    if (n1 === 0) return [n2, d2];
    if (n2 === 0) return [n1, d1];
    const commonD = d1 * d2;
    const newN = (n1 * d2) + (n2 * d1);
    return math.simplify(newN, commonD);
  }
};

export const relStr = { 
  'wife': '처', 
  'husband': '남편', 
  'son': '아들', 
  'daughter': '딸', 
  'sibling': '형제자매',
  'child': '자녀',
  'parent': '직계존속'
};

// 💡 사용자님 기획: 1991년 이후 개정 민법 적용 시 '자녀', '배우자' 명칭 자동 전환
export const getRelStr = (relation, deathDate) => {
  // 사망일자가 1991-01-01 이후인지 판단 (남녀 평등 상속 시대)
  const isModern = deathDate && !isBefore(deathDate, '1991-01-01');

  switch (relation) {
    case 'wife': 
      return isModern ? '배우자' : '처';
    case 'husband': 
      return isModern ? '배우자' : '남편';
    case 'spouse': 
      return '배우자';
    case 'son': 
      return isModern ? '자녀' : '아들';
    case 'daughter': 
      return isModern ? '자녀' : '딸';
    case 'sibling': 
      return '형제자매';
    case 'parent': 
      return '직계존속';
    default: 
      return relation;
  }
};

export const getLawEra = (deathDate) => {
  if (!deathDate || deathDate.length < 4) return '1991';
  const year = parseInt(deathDate.split('-')[0], 10);
  if (year < 1979) return '1960';
  if (year < 1991) return '1979';
  return '1991';
};

export const isBefore = (d1, d2) => {
  if (!d1 || !d2 || d1.length < 10 || d2.length < 10) return false;
  return new Date(d1) < new Date(d2);
};

export const formatKorDate = (dStr) => {
  if (!dStr || dStr.length !== 10) return dStr;
  const [y, m, d] = dStr.split('-');
  return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
};

export const formatMoney = (val) => {
  if (!val) return '';
  return Number(val).toLocaleString('ko-KR');
};
