import fs from 'fs';
import { normalizeImportedTree } from '../src/utils/treeDomain.js';
import { calculateInheritance } from '../src/engine/inheritance.js';

const raw = JSON.parse(fs.readFileSync('./inherit_source/kimhyeokjo_test.json', 'utf8'));
const tree = normalizeImportedTree(raw);
const result = calculateInheritance(tree);

const kimMyeongNamStep = (result.calcSteps || []).find((step) => step?.dec?.name === '김명남');
const sourceBreakdowns = kimMyeongNamStep?.sourceBreakdowns || [];
const maternalBreakdown = sourceBreakdowns.find(
  (source) => source.from === '구수명' && source.inN === 2 && source.inD === 165
);

const summary = {
  mergeSources: kimMyeongNamStep?.mergeSources || [],
  maternalBreakdown,
  expectedMaternal: [
    { name: '윤우영', share: '8/1815', note: '4/11 of 2/165' },
    { name: '윤정희', share: '2/1815', note: '1/11 of 2/165' },
    { name: '윤방자', share: '2/1815', note: '1/11 of 2/165' },
    { name: '윤숙자', share: '2/1815', note: '1/11 of 2/165' },
    { name: '윤우성', share: '8/1815', note: '4/11 of 2/165' },
    { name: '윤종옥', share: '0', note: '1991년 전 선사망 딸의 남편 대습 불가' },
  ],
};

fs.writeFileSync(
  './inherit_source/kimmyeongnam_maternal_compare.json',
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('Wrote inherit_source/kimmyeongnam_maternal_compare.json');
