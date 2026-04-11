import { calculateInheritance } from '../src/engine/inheritance.js';
import fs from 'fs';

const caseData = JSON.parse(fs.readFileSync('./inherit_source/case_김시환_상속지분계산_2026-04-10.json', 'utf8'));

const result = calculateInheritance(caseData);

console.log("=== 최종 상속 지분 (상세) ===");
const logShares = (shares) => {
    shares.forEach(s => {
        console.log(`${s.name} (${s.relation}): ${s.n}/${s.d} (${s.un}/${s.ud})`);
    });
};

console.log("--- 직계 ---");
logShares(result.finalShares.direct);
console.log("--- 계보 ---");
result.finalShares.subGroups.forEach(group => {
    console.log(`[${group.ancestor.name} 가계]`);
    logShares(group.shares);
});

console.log("\n=== 중간 전의 지분 (Transit) ===");
result.transitShares.forEach(s => {
    const totalDist = result.calcSteps.filter(step => step.dec && (step.dec.personId === s.personId)).reduce((sum, step) => {
        return sum + step.dists.reduce((s2, d) => s2 + d.n / d.d, 0);
    }, 0);
    console.log(`${s.name} (${s.relation}): ${s.n}/${s.d} (분배 합계: ${totalDist})`);
});

console.log("\n=== 감지된 경고 (Warnings) ===");
result.warnings.forEach(w => {
    console.log(`[${w.code}] ${w.text}`);
});

console.log("\n=== 감지된 이슈 (Issues) ===");
result.issues.filter(i => i.severity === 'error' || i.severity === 'warning').forEach(i => {
    console.log(`[${i.code}] ${i.text}`);
});
