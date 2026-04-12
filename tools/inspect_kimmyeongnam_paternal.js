import fs from 'fs';
import { normalizeImportedTree } from '../src/utils/treeDomain.js';
import { calculateInheritance } from '../src/engine/inheritance.js';

const raw = JSON.parse(fs.readFileSync('./inherit_source/kimhyeokjo_test.json', 'utf8'));
const tree = normalizeImportedTree(raw);
const result = calculateInheritance(tree);

const kimMyeongNamStep = (result.calcSteps || []).find((step) => step?.dec?.name === '김명남');
const sourceBreakdowns = kimMyeongNamStep?.sourceBreakdowns || [];
const paternalBreakdown = sourceBreakdowns.find(
  (source) => source.from === '김혁조' && source.inN === 1 && source.inD === 15
);

const summary = {
  mergeSources: kimMyeongNamStep?.mergeSources || [],
  paternalBreakdown,
  expectedPaternal: [
    { name: '윤우영', share: '5016/579150', note: '11/165 계통 중 윤우영 가지 총지분' },
    { name: '윤정희', share: '3366/579150', note: '11/165 계통 중 윤정희 본인지분' },
    { name: '윤방자', share: '1122/579150', note: '11/165 계통 중 윤방자 가지 총지분' },
    { name: '윤숙자', share: '1683/579150', note: '11/165 계통 중 윤숙자 가지 총지분' },
    { name: '윤우성', share: '13464/579150', note: '11/165 계통 중 윤우성 본인지분' },
    { name: '윤종옥', share: '0', note: '1991년 전 선사망 딸의 남편 대습 불가' },
  ],
};

fs.writeFileSync(
  './inherit_source/kimmyeongnam_paternal_compare.json',
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('Wrote inherit_source/kimmyeongnam_paternal_compare.json');
