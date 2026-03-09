import { math, getLawEra, isBefore } from './utils.js';

export const calculateInheritance = (tree, propertyValue) => {
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  
  const traverse = (node, inN, inD, inheritedDate) => {
    // 유효성 검사: 피상속인/선사망자 사망일 누락 확인
    if (node.isDeceased && !node.deathDate) {
      warnings.push(`${node.name || '이름 미입력'} 님의 사망일자가 입력되지 않았습니다.`);
    }

    if (!node.isDeceased || node.id === 'root') {
      if (node.id !== 'root') results.push({ name: node.name, n: inN, d: inD, relation: node.relation });
      if (!node.isDeceased) return;
    }
    if (!node.heirs || node.heirs.length === 0) return;

    let isSubstitution = false;
    let distributionDate = inheritedDate;

    if (node.id !== 'root' && node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
      distributionDate = node.deathDate;
    } else if (node.id !== 'root' && node.isDeceased && node.deathDate) {
      isSubstitution = true;
    }
    
    const law = getLawEra(distributionDate);
    appliedLaws.add(law);

    let total = 0;
    
    node.heirs.forEach(h => {
      // 유효성 검사: 재혼자 재혼일 누락 확인
      if (h.isRemarried && !h.remarriageDate) {
        warnings.push(`${h.name || '이름 미입력'} 님의 재혼일자가 입력되지 않아 대습상속권 유지를 판단할 수 없습니다.`);
      }

      const isSp = h.relation === 'wife' || h.relation === 'husband';
      const isPre = h.isDeceased && h.deathDate && isBefore(h.deathDate, distributionDate);
      let modifier = ''; 

      if (isSp && isPre) { h.r = 0; h.ex = `${h.deathDate} 피상속인보다 먼저 사망`; }
      else if (isSp && node.id !== 'root' && h.isRemarried && h.remarriageDate && isBefore(h.remarriageDate, distributionDate) && law === '1991') { 
        h.r = 0; h.ex = '상속 개시 전 재혼 (1991년 이후 대습상속권 소멸)'; 
      }
      else if (node.id !== 'root' && h.relation === 'husband' && isSubstitution) {
        // (나-①) 처의 사망일자가 91.1.1. 전이면 남편의 대습상속권 없음
        if (isBefore(node.deathDate, '1991-01-01')) {
          h.r = 0; h.ex = '1991년 이전 처 사망으로 사위 대습상속권 없음';
        } else if (law === '1960' || law === '1979') {
          h.r = 0; h.ex = '1991년 이전 피상속인 사망으로 남편 대습권 없음';
        } else {
          h.r = 1.5; modifier = '남편 5할 가산';
        }
      } else if (h.relation === 'wife') { 
         if (law === '1991' || law === '1979') { h.r = 1.5; modifier = '처 5할 가산'; }
         else { h.r = 0.5; modifier = '처 감산 (자녀의 1/2)'; } 
      } else if (h.relation === 'husband') {
         // 직접 상속 시
         if (law === '1991') { h.r = 1.5; modifier = '남편 5할 가산'; }
         else { h.r = 1.0; } 
      } else {
         if (law === '1991') {
           h.r = 1.0;
         } else if (law === '1979') {
           if (h.relation === 'daughter') {
             if (h.isSameRegister !== false) { h.r = 1.0; }
             else { h.r = 0.25; modifier = '출가녀 감산 (아들의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         } else { // 1960년 구법
           if (h.relation === 'daughter') {
             if (h.isSameRegister !== false) { h.r = 0.5; modifier = '여자 감산 (남자의 1/2)'; }
             else { h.r = 0.25; modifier = '출가녀 감산 (남자의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         }
      }
      h.modifierReason = modifier; 
      total += h.r;
    });

    if (total > 0) {
      const step = { dec: node, inN, inD, dists: [], lawEra: law };
      const childrenToTraverse = [];

      node.heirs.forEach(h => {
        if (h.r === 0) { 
          step.dists.push({ h, n: 0, d: 1, sn: 0, sd: 1, ex: h.ex, mod: h.modifierReason }); 
        } else {
          const [sn, sd] = math.simplify(h.r * 100, total * 100);
          const [nn, nd] = math.multiply(inN, inD, sn, sd);
          step.dists.push({ h, n: nn, d: nd, sn, sd, mod: h.modifierReason });
          childrenToTraverse.push({ h, nn, nd });
        }
      });
      steps.push(step);
      childrenToTraverse.forEach(child => { traverse(child.h, child.nn, child.nd, distributionDate); });
    }
  };

  const initN = Math.max(1, Number(tree.shareN) || 1);
  const initD = Math.max(1, Number(tree.shareD) || 1);
  traverse(tree, initN, initD, tree.deathDate);
  
  const merged = [];
  results.forEach(r => {
    const ex = merged.find(m => m.name === r.name);
    if (ex) { 
      const [nn, nd] = math.add(ex.n, ex.d, r.n, r.d); 
      ex.n = nn; ex.d = nd; 
    } else { merged.push({...r}); }
  });

  let commonD = 1;
  merged.forEach(m => { if (m.n > 0) commonD = math.lcm(commonD, m.d); });
  merged.forEach(m => {
    if (m.n === 0) { m.un = 0; m.ud = commonD; } 
    else { const multiplier = commonD / m.d; m.un = m.n * multiplier; m.ud = commonD; }
  });

  const categoryMap = {};
  tree.heirs.forEach((h, idx) => { if (!h.isDeceased) categoryMap[h.name] = { type: 'direct', order: idx }; });
  tree.heirs.forEach((h, idx) => {
    if (h.isDeceased && h.relation !== 'wife' && h.relation !== 'husband') {
      const traverseSub = (node) => {
        if (!node.isDeceased && !categoryMap[node.name]) categoryMap[node.name] = { type: 'sub', ancestor: h, order: idx };
        if (node.heirs) node.heirs.forEach(traverseSub);
      };
      if (h.heirs) h.heirs.forEach(traverseSub);
    }
  });
  tree.heirs.forEach((h, idx) => {
    if (h.isDeceased && (h.relation === 'wife' || h.relation === 'husband')) {
      const traverseSub = (node) => {
        if (!node.isDeceased && !categoryMap[node.name]) categoryMap[node.name] = { type: 'sub', ancestor: h, order: idx };
        if (node.heirs) node.heirs.forEach(traverseSub);
      };
      if (h.heirs) h.heirs.forEach(traverseSub);
    }
  });

  const directShares = [];
  const subMap = {};

  merged.forEach(m => {
    const cat = categoryMap[m.name];
    if (!cat || cat.type === 'direct') { directShares.push(m); } 
    else {
      const ancId = cat.ancestor.id;
      if (!subMap[ancId]) subMap[ancId] = { ancestor: cat.ancestor, order: cat.order, shares: [] };
      subMap[ancId].shares.push(m);
    }
  });

  const subGroups = Object.values(subMap).sort((a, b) => a.order - b.order);
  
  return {
    finalShares: { direct: directShares, subGroups: subGroups },
    calcSteps: steps,
    warnings: Array.from(new Set(warnings)),
    appliedLaws: Array.from(appliedLaws).sort()
  };
};
