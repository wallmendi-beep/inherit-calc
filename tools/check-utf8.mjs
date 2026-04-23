import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'tests', 'tools'];
const TARGET_EXTS = new Set(['.js', '.jsx', '.mjs', '.md']);
const suspiciousPatterns = [/\uFFFD/g, /\?\?\?/g];

const findings = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!TARGET_EXTS.has(extname(fullPath))) continue;
    const content = readFileSync(fullPath, 'utf8');
    const matches = suspiciousPatterns
      .map((pattern) => ({ pattern: pattern.toString(), count: (content.match(pattern) || []).length }))
      .filter((item) => item.count > 0);

    if (matches.length > 0) {
      findings.push({
        file: fullPath.replace(`${ROOT}\\`, ''),
        matches,
      });
    }
  }
};

TARGET_DIRS.forEach((dir) => walk(join(ROOT, dir)));

if (findings.length > 0) {
  console.error('Potential UTF-8 / mojibake findings detected:');
  findings.forEach((finding) => {
    const details = finding.matches.map((match) => `${match.pattern} x${match.count}`).join(', ');
    console.error(`- ${finding.file}: ${details}`);
  });
  process.exit(1);
}

console.log('No suspicious UTF-8 / mojibake patterns detected in scanned files.');
