const fs = require('fs');
const path = require('path');

async function main() {
  const jsonPath = path.resolve(process.argv[2]);
  const mod = await import('file://' + path.resolve(__dirname, '..', 'src', 'engine', 'inheritance.js').replace(/\\/g, '/'));
  const { calculateInheritance } = mod;

  const tree = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const result = calculateInheritance(tree);

  const targets = new Set([
    '김일상',
    '이경숙',
    '김경희',
    '성남수',
    '성정아',
    '성영아',
    '성원교',
    '성현아',
    '김경진',
    '김화경',
    '김지훈',
    '김진수',
    '김혜경',
    '김윤겸',
    '김건호',
    '김민호',
  ]);

  const found = [];
  const seen = new Set();

  const walk = (value, trail = []) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...trail, `[${index}]`]));
      return;
    }

    if (!value || typeof value !== 'object') return;

    if (typeof value.name === 'string' && targets.has(value.name)) {
      const key = JSON.stringify({
        trail: trail.join('.'),
        name: value.name,
        n: value.n,
        d: value.d,
        un: value.un,
        ud: value.ud,
        sn: value.sn,
        sd: value.sd,
        relation: value.relation || value.h?.relation || '',
      });
      if (!seen.has(key)) {
        seen.add(key);
        found.push({
          trail: trail.join('.'),
          name: value.name,
          relation: value.relation || value.h?.relation || '',
          n: value.n,
          d: value.d,
          un: value.un,
          ud: value.ud,
          sn: value.sn,
          sd: value.sd,
          modifierReason: value.modifierReason || value.mod || '',
          text: value.text || '',
        });
      }
    }

    Object.entries(value).forEach(([k, v]) => walk(v, [...trail, k]));
  };

  walk(result);
  console.log(JSON.stringify(found, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
