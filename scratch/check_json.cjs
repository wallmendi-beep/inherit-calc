const fs = require('fs');
const data = JSON.parse(fs.readFileSync('inherit_source/GPT_김혁조_상속지분계산_2026-04-08.json', 'utf8'));

const personIds = new Map();
const duplicates = [];

function traverse(node, path = []) {
  if (!node) return;
  const pId = node.personId || node.id;
  
  if (path.includes(pId)) {
    console.error(`CYCLE DETECTED: ${pId} is an ancestor of itself! Path: ${path.join(' -> ')} -> ${pId}`);
  }
  
  if (personIds.has(pId)) {
    personIds.get(pId).push(node.name);
  } else {
    personIds.set(pId, [node.name]);
  }
  
  if (node.heirs) {
    node.heirs.forEach(h => traverse(h, [...path, pId]));
  }
}

traverse(data);

console.log('--- Duplicate personId check ---');
for (let [id, names] of personIds.entries()) {
  if (names.length > 1) {
    console.log(`ID: ${id}, Names: ${names.join(', ')}`);
  }
}
