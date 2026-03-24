import { math, getLawEra, isBefore } from './utils.js';

export const calculateInheritance = (tree, propertyValue) => {
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  
  const traverse = (node, inN, inD, inheritedDate, visitedIds = []) => {
    if (visitedIds.includes(node.id)) {
      warnings.push(`순차상속 순환 참조가 발생하여 ${node.name || '상속인'}의 지분 전이가 중단되었습니다.`);
      return;
    }
    const currentVisited = [...visitedIds, node.id];

    // 유효성 검사: 피상속인/선사망자 사망일 누락 확인
    if (node.isDeceased && !node.deathDate) {
      warnings.push(`${node.name || '이름 미입력'} 님의 사망일자가 입력되지 않았습니다.`);
    }

    if (!node.isDeceased || node.id === 'root') {
      if (node.id !== 'root') results.push({ name: node.name, n: inN, d: inD, relation: node.relation });
      if (!node.isDeceased) return;
    }

    let isSubstitution = false;
    let distributionDate = inheritedDate;

    if (node.id !== 'root' && node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
      distributionDate = node.deathDate;
    } else if (node.id !== 'root' && node.isDeceased && node.deathDate) {
      isSubstitution = true;
    }

    if (!node.heirs || node.heirs.length === 0) {
      if (isSubstitution || node.id === 'root') return;

      if (node.relation === 'son' || node.relation === 'daughter') {
         const parents = tree.heirs.filter(th => (th.relation === 'wife' || th.relation === 'husband' || th.relation === 'spouse') && (!th.isDeceased || !isBefore(th.deathDate, distributionDate)));
         const virtualHeirs = [];
         
         if (parents.length > 0) {
            parents.forEach((p, idx) => {
              virtualHeirs.push({ ...p, id: p.id, relation: 'parent' });
            });
         } else {
            const siblings = tree.heirs.filter(th => th.id !== node.id && (th.relation === 'son' || th.relation === 'daughter'));
            if (siblings.length > 0) {
              siblings.forEach((s, idx) => {
                virtualHeirs.push({ ...s, id: s.id, relation: 'sibling' });
              });
            } else { return; }
         }
         node.heirs = virtualHeirs;
      } else { return; }
    }
    
    const law = getLawEra(distributionDate);
    appliedLaws.add(law);

    let total = 0;
    
    // 순위 판별 (1순위:자녀, 2순위:존속, 3순위:형제)
    let hasRank1 = false, hasRank2 = false, hasRank3 = false, hasSpouse = false;
    node.heirs.forEach(h => {
      if (h.relation === 'son' || h.relation === 'daughter') hasRank1 = true;
      else if (h.relation === 'parent') hasRank2 = true;
      else if (h.relation === 'sibling') hasRank3 = true;
      else if (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') hasSpouse = true;
    });

    let activeRank = 0;
    if (hasRank1) activeRank = 1;
    else if (hasRank2) activeRank = 2;
    else if (hasSpouse) activeRank = -1; // 배우자 단독 (1,2순위 없고 형제자매만 있을 때 형제 배제가능)
    else if (hasRank3) activeRank = 3;
    
    node.heirs.forEach(h => {
      if (h.isRemarried && !h.remarriageDate) {
        warnings.push(`${h.name || '이름 미입력'} 님의 재혼일자가 입력되지 않아 대습상속권 유지를 판단할 수 없습니다.`);
      }

      const isSp = h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse';
      const isPre = h.isDeceased && h.deathDate && isBefore(h.deathDate, distributionDate);
      let modifier = ''; 

      // 상속 순위 탈락 처리
      let skipped = false;
      if (activeRank === 1 && (h.relation === 'parent' || h.relation === 'sibling')) {
        h.r = 0; h.ex = '선순위(직계비속) 상속인이 존재하여 상속권 없음'; skipped = true;
      } else if (activeRank === 2 && h.relation === 'sibling') {
        h.r = 0; h.ex = '선순위(직계존속) 상속인이 존재하여 상속권 없음'; skipped = true;
      } else if (activeRank === -1 && h.relation === 'sibling') {
        h.r = 0; h.ex = '배우자 단독 상속으로 형제자매 상속권 없음'; skipped = true;
      }

      if (skipped) { /* 이미 처리됨 */ }
      else if (isSp && isPre) { h.r = 0; h.ex = `${h.deathDate} 피상속인보다 먼저 사망`; }
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
      } else if (h.relation === 'wife' || (h.relation === 'spouse' && node.relation === 'son')) { 
         if (law === '1991' || law === '1979') { h.r = 1.5; modifier = '처(배우자) 5할 가산'; }
         else { h.r = 0.5; modifier = '처 감산 (자녀의 1/2)'; } 
      } else if (h.relation === 'husband' || (h.relation === 'spouse' && node.relation === 'daughter')) {
         if (law === '1991') { h.r = 1.5; modifier = '남편(배우자) 5할 가산'; }
         else { h.r = 1.0; } 
      } else {
         if (law === '1991') {
           h.r = 1.0;
         } else if (law === '1979') {
           if (h.relation === 'daughter') {
             if (h.isSameRegister !== false) { h.r = 1.0; }
             else { h.r = 0.25; modifier = '출가녀 감산 (아들의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju && (!isSubstitution || node.isHoju)) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         } else { // 1960년 구법
           if (h.relation === 'daughter') {
             if (h.isSameRegister !== false) { h.r = 0.5; modifier = '여자 감산 (남자의 1/2)'; }
             else { h.r = 0.25; modifier = '출가녀 감산 (남자의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju && (!isSubstitution || node.isHoju)) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
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
      childrenToTraverse.forEach(child => { traverse(child.h, child.nn, child.nd, distributionDate, currentVisited); });
    }
  };

  const initN = Math.max(1, Number(tree.shareN) || 1);
  const initD = Math.max(1, Number(tree.shareD) || 1);
  traverse(tree, initN, initD, tree.deathDate, []);
  
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
