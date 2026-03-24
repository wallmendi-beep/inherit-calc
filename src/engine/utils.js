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

export const getRelStr = (relation, deathDate) => {
  const law = getLawEra(deathDate);
  if (law === '1991') {
    if (relation === 'parent') return '직계존속';
    if (relation === 'son' || relation === 'daughter') return relStr['child'];
    if (relation === 'wife' || relation === 'husband' || relation === 'spouse') return '배우자';
  }
  return relStr[relation] || relation;
}

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
