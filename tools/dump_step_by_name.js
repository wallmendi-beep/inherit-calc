import fs from 'fs';
import { normalizeImportedTree } from '../src/utils/treeDomain.js';
import { calculateInheritance } from '../src/engine/inheritance.js';

const targetName = process.argv[2];
if (!targetName) {
  console.error('usage: node tools/dump_step_by_name.js <name>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync('./inherit_source/kimhyeokjo_test.json', 'utf8'));
const tree = normalizeImportedTree(raw);
const result = calculateInheritance(tree);
const step = (result.calcSteps || []).find((item) => item?.dec?.name === targetName);

fs.writeFileSync(
  `./inherit_source/dump_${targetName}.json`,
  JSON.stringify(step ?? null, null, 2),
  'utf8'
);

console.log(step ? `dumped ${targetName}` : `not found: ${targetName}`);
