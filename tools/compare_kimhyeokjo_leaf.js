import fs from 'fs';
import { normalizeImportedTree } from '../src/utils/treeDomain.js';
import { calculateInheritance } from '../src/engine/inheritance.js';

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function simplify(n, d) {
  const g = gcd(n, d);
  return [n / g, d / g];
}

const raw = JSON.parse(fs.readFileSync('./inherit_source/kimhyeokjo_test.json', 'utf8'));
const tree = normalizeImportedTree(raw);
const result = calculateInheritance(tree);
const shares = [
  ...(result.finalShares?.direct || []),
  ...((result.finalShares?.subGroups || []).flatMap((group) => group.shares || [])),
].map((share) => ({
  name: share.name,
  actual: `${simplify(share.n, share.d).join('/')}`,
}));

const expected = {
  김경희: [64536, 6370650],
  윤성혜: [43024, 6370650],
  윤정희: [44046, 6370650],
  김관종: [14682, 6370650],
  조상범: [22023, 6370650],
  윤우성: [176184, 6370650],
  정서영: [1197, 291060],
  송양현: [714, 291060],
  조경래: [2052, 291060],
  정혜라: [1368, 291060],
  정영일: [4788, 291060],
  정인숙: [2352, 291060],
  정광윤: [4788, 291060],
  지한옥: [6318, 343035],
  옥혜정: [4212, 343035],
  옥숭훈: [9828, 343035],
  신양순: [273, 343035],
  김현진: [728, 343035],
  성정아: [259, 13860],
  김경진: [1036, 13860],
  김윤겸: [444, 13860],
  김건호: [296, 13860],
  김민호: [296, 13860],
  김경혜: [468, 7425],
  이혜경: [156, 7425],
  김지현: [104, 7425],
  김건수: [468, 7425],
};

const rows = Object.entries(expected).map(([name, [n, d]]) => {
  const expectedValue = simplify(n, d).join('/');
  const match = shares.find((share) => share.name === name);
  return {
    name,
    expected: expectedValue,
    actual: match?.actual || null,
    match: match?.actual === expectedValue,
  };
});

const output = {
  total: `${result.integrity.total.n}/${result.integrity.total.d}`,
  rows,
};

fs.writeFileSync('./inherit_source/kimhyeokjo_leaf_compare.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Wrote inherit_source/kimhyeokjo_leaf_compare.json');
