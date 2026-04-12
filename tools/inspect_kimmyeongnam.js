import fs from 'fs';
import { normalizeImportedTree } from '../src/utils/treeDomain.js';

const raw = JSON.parse(fs.readFileSync('./inherit_source/kimhyeokjo_test.json', 'utf8'));
const tree = normalizeImportedTree(raw);

function findByName(node, name) {
  if (node.name === name) return node;
  for (const heir of node.heirs || []) {
    const found = findByName(heir, name);
    if (found) return found;
  }
  return null;
}

const names = ['김명남', '윤우영', '윤정희', '윤방자', '윤숙자', '윤우성'];
const out = {};
for (const name of names) {
  const node = findByName(tree, name);
  out[name] = node
    ? {
        relation: node.relation,
        isHoju: node.isHoju,
        isSameRegister: node.isSameRegister,
        marriageDate: node.marriageDate,
        deathDate: node.deathDate,
        isExcluded: node.isExcluded,
        exclusionOption: node.exclusionOption,
      }
    : null;
}

fs.writeFileSync('./inherit_source/inspect_kimmyeongnam.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote inherit_source/inspect_kimmyeongnam.json');
