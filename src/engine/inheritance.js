import { math, getLawEra, isBefore } from './utils.js';

export const calculateInheritance = (tree, propertyValue) => {
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  
  // 동명 노드의 상속인 정보를 참조하기 위한 헬퍼: 트리 전체에서 같은 이름을 가진 다른 노드의 heirs를 찾아주는 함수
  const findHeirsByName = (root, targetName, excludeId) => {
    if (!targetName || targetName.trim() === '') return null;
    let found = null;
    const search = (n) => {
      if (found) return;
      if (n.id !== excludeId && n.name === targetName && n.heirs && n.heirs.length > 0) {
        found = n.heirs;
        return;
      }
      if (n.heirs) n.heirs.forEach(search);
    };
    search(root);
    return found;
  };

  const traverse = (node, inN, inD, inheritedDate, visitedIds = [], parentDecName = '피상속인') => {
    if (visitedIds.includes(node.id)) {
      warnings.push(`순차상속 순환 참조가 발생하여 ${node.name || '상속인'}의 지분 전이가 중단되었습니다.`);
      return;
    }
    const currentVisited = [...visitedIds, node.id];

    // 유효성 검사: 피상속인/선사망자 사망일 누락 확인
    if (node.isDeceased && !node.deathDate) {
      warnings.push(`${node.name || '이름 미입력'} 님의 사망일자가 입력되지 않았습니다.`);
    }

    if (!node.isDeceased && !(node.isExcluded && node.exclusionOption === 'lost') || node.id === 'root') {
      if (node.id !== 'root') results.push({ id: node.id, name: node.name, n: inN, d: inD, relation: node.relation });
      if (!node.isDeceased && !(node.isExcluded && node.exclusionOption === 'lost')) return;
    }

    let isSubstitution = false;
    let distributionDate = inheritedDate;

    if (node.id !== 'root' && node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
      distributionDate = node.deathDate;
    } else if (node.id !== 'root' && node.isDeceased && node.deathDate) {
      isSubstitution = true;
    }
    
    // 상속권 상실의 경우: (고의 상속결격과 동일하게) 선사망과 같이 취급하여 대습상속을 발동시킴
    if (node.id !== 'root' && node.isExcluded && node.exclusionOption === 'lost') {
      isSubstitution = true;
      distributionDate = inheritedDate; // 상속권 상실은 피상속인의 사망 시점(상속개시일)에 함께 소급효가 발생하므로, 대습상속 개시일은 상속개시일이 됨
    }

    // ★ FIX 1: ReferenceError 방지를 위해 getLawEra 위치를 위로 끌어올림
    const law = getLawEra(distributionDate); 

    // 상속포기(renounce) 판별 헬퍼
    const isRenounced = (h) => h.isExcluded && (!h.exclusionOption || h.exclusionOption === 'renounce');

    let targetHeirs = (node.heirs || []).filter(h => !isRenounced(h)); // 상속포기자 제외

    // [2023년 전원합의체 판례 및 실무 반영] 
    // 본래 상속인이어야 할 자녀가 모두 포기한 경우의 처리
    const originalChildren = (node.heirs || []).filter(h => h.relation === 'son' || h.relation === 'daughter');
    const renouncedChildrenCount = originalChildren.filter(isRenounced).length;
    const isAllChildrenRenounced = originalChildren.length > 0 && renouncedChildrenCount === originalChildren.length;
    
    const spouseInHeirs = (node.heirs || []).find(h => (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && !isRenounced(h));

    if (isAllChildrenRenounced) {
      if (spouseInHeirs && law === '1991') {
        // 배우자가 있는 경우 -> 2023 전원합의체(2020그42)에 따라 배우자 단독 상속 처리 (하위 탐색 중단)
        targetHeirs = [spouseInHeirs];
      } else if (!spouseInHeirs) {
        // ★ FIX 2: 배우자가 없는 경우 -> 민법 제1000조 1항 1호에 따라 그 다음 직계비속(손자녀)이 본위상속
        let grandchildren = [];
        originalChildren.forEach(child => {
           if (child.heirs) {
              // 손자녀 중에서도 상속포기자는 제외하고 수집
              grandchildren = grandchildren.concat(child.heirs.filter(h => !isRenounced(h)));
           }
        });
        if (grandchildren.length > 0) {
           targetHeirs = grandchildren;
        }
      }
    }

    // 불러오기 복사본처럼 heirs가 비어있는 사망 노드라면, 동명의 원본 노드에서 heirs를 자동 참조
    if (targetHeirs.length === 0 && (node.isDeceased || (node.isExcluded && node.exclusionOption === 'lost')) && node.id !== 'root') {
      const borrowed = findHeirsByName(tree, node.name, node.id);
      if (borrowed && borrowed.length > 0) {
        targetHeirs = borrowed.filter(h => !isRenounced(h));
      }
    }

    if (targetHeirs.length === 0) {
      if (isSubstitution || node.id === 'root') return;

      const isDirectChildOfRoot = tree.heirs.some(th => th.id === node.id);

      if (isDirectChildOfRoot && (node.relation === 'son' || node.relation === 'daughter')) {
         // 직계존속(부모) 찾기
         const parents = tree.heirs.filter(th => 
           (th.relation === 'wife' || th.relation === 'husband' || th.relation === 'spouse') && 
           (!th.isDeceased || !isBefore(th.deathDate, distributionDate)) &&
           !isRenounced(th)
         );
         
         const virtualHeirs = [];
         
         if (parents.length > 0) {
            parents.forEach((p) => {
              // 1991년 이후 계모자 상속은 사용자가 부모를 별도로 입력하므로 코어 로직에서는 패스
              virtualHeirs.push({ ...p, id: p.id, relation: 'parent' });
            });
         }
         
         if (virtualHeirs.length === 0) {
            // 부모가 없거나 모두 상속결격/사망/포기 시 형제자매로 이동
            const siblings = tree.heirs.filter(th => 
              th.id !== node.id && 
              (th.relation === 'son' || th.relation === 'daughter') &&
              !isRenounced(th)
            );
            if (siblings.length > 0) {
              siblings.forEach((s) => {
                virtualHeirs.push({ ...s, id: s.id, relation: 'sibling' });
              });
            } else { return; }
         }
         targetHeirs = virtualHeirs;
      } else if (!isDirectChildOfRoot && (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse')) {
          let parentNode = null;
          const findParent = (curr) => {
             if (curr.heirs && curr.heirs.some(h => h.id === node.id)) { parentNode = curr; } 
             else { for (const child of curr.heirs || []) findParent(child); }
          };
          findParent(tree);
          if (parentNode && parentNode.heirs) {
             const children = parentNode.heirs.filter(th => th.id !== node.id && (th.relation === 'son' || th.relation === 'daughter') && !isRenounced(th));
             const virtualHeirs = [];
             children.forEach(c => { virtualHeirs.push({ ...c, id: c.id, relation: c.relation }); });
             if (virtualHeirs.length > 0) targetHeirs = virtualHeirs;
             else return;
          } else { return; }
      } else { return; }
    }
    
    appliedLaws.add(law);

    let total = 0;
    
    // 순위 판별 (1순위:자녀, 2순위:존속, 3순위:형제)
    let hasRank1 = false, hasRank2 = false, hasRank3 = false, hasSpouse = false;
    targetHeirs.forEach(h => {
      if (h.relation === 'son' || h.relation === 'daughter') hasRank1 = true;
      else if (h.relation === 'parent') hasRank2 = true;
      else if (h.relation === 'sibling') hasRank3 = true;
      else if (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') hasSpouse = true;
    });

    let activeRank = 0;
    if (hasRank1) activeRank = 1;
    else if (hasRank2) activeRank = 2;
    // 2023 판례나 일반 실무에서 1,2순위가 전혀 없는 경우 배우자 단독
    else if (hasSpouse) activeRank = -1; 
    else if (hasRank3) activeRank = 3;
    
    targetHeirs.forEach(h => {
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
         else {
           // 1960년 구민법: 직계존속과 공동상속 시 균분, 직계비속과 공동상속 시 1/2 감산
           if (activeRank === 2) { h.r = 1.0; modifier = '처 균분 (직계존속과 동순위)'; }
           else { h.r = 0.5; modifier = '처 감산 (직계비속의 1/2)'; }
         } 
      } else if (h.relation === 'husband' || (h.relation === 'spouse' && node.relation === 'daughter')) {
         if (law === '1991') { h.r = 1.5; modifier = '남편(배우자) 5할 가산'; }
         else { h.r = 1.0; } 
      } else {
         if (law === '1991') {
           h.r = 1.0;
         } else if (law === '1979') {
           if (h.relation === 'daughter') {
             // 제적일(marriageDate)이 있는 경우 피상속인 사망일과 비교하여 자동 판정
             let isMarried = h.isSameRegister === false;
             if (h.marriageDate && distributionDate) {
               isMarried = !isBefore(distributionDate, h.marriageDate);
             }

             if (!isMarried) { h.r = 1.0; }
             else { h.r = 0.25; modifier = '출가녀 감산 (아들의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju && (!isSubstitution || node.isHoju)) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         } else { // 1960년 구법
            if (h.relation === 'daughter') {
              // 제적일(marriageDate)이 있는 경우 피상속인 사망일과 비교하여 자동 판정
              let isMarried = h.isSameRegister === false;
              if (h.marriageDate && distributionDate) {
                isMarried = !isBefore(distributionDate, h.marriageDate);
              }

              if (!isMarried) { h.r = 0.5; modifier = '여자 감산 (남자의 1/2)'; }
              else { h.r = 0.25; modifier = '출가녀 감산 (남자의 1/4)'; }
           } else if (h.relation === 'son') {
             if (h.isHoju && (!isSubstitution || node.isHoju)) { h.r = 1.5; modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         }
      }
      
      if (h.r !== undefined) {
         h.modifierReason = modifier; 
         total += h.r;
      }
    });

    if (total > 0) {
      const step = { dec: node, inN, inD, dists: [], lawEra: law, parentDecName };
      const childrenToTraverse = [];

      targetHeirs.forEach(h => {
        if (h.r === 0 || h.r === undefined) { 
          step.dists.push({ h, n: 0, d: 1, sn: 0, sd: 1, ex: h.ex, mod: h.modifierReason }); 
        } else {
          const [sn, sd] = math.simplify(h.r * 100, total * 100);
          const [nn, nd] = math.multiply(inN, inD, sn, sd);
          step.dists.push({ h, n: nn, d: nd, sn, sd, mod: h.modifierReason });
          childrenToTraverse.push({ h, nn, nd });
        }
      });
      steps.push(step);
      childrenToTraverse.forEach(child => { traverse(child.h, child.nn, child.nd, distributionDate, currentVisited, node.name || '피상속인'); });
    }
  };

  const initN = Math.max(1, Number(tree.shareN) || 1);
  const initD = Math.max(1, Number(tree.shareD) || 1);
  traverse(tree, initN, initD, tree.deathDate, []);
  
  // 📊 후처리: 동일 인물의 계산 step 병합 (법원 계산기 방식)
  const mergedSteps = [];
  const stepById = {}; // 🔑 이름 대신 ID 기준으로 병합
  
  steps.forEach(step => {
    const id = step.dec?.id;
    if (!id || step.dec?.id === 'root') {
      mergedSteps.push(step);
      return;
    }
    
    if (!stepById[id]) {
      step.mergeSources = [{ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD }];
      stepById[id] = step;
      mergedSteps.push(step);
    } else {
      const existing = stepById[id];
      existing.mergeSources.push({ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD });
      
      const [newN, newD] = math.add(existing.inN, existing.inD, step.inN, step.inD);
      existing.inN = newN;
      existing.inD = newD;
      
      const total = existing.dists.reduce((sum, d) => sum + (d.h?.r || 0), 0);
      if (total > 0) {
        existing.dists = existing.dists.map(d => {
          if (d.h?.r === 0 || d.h?.r === undefined) return { ...d, n: 0, d: 1, sn: 0, sd: 1 };
          const [sn, sd] = math.simplify(d.h.r * 100, total * 100);
          const [nn, nd] = math.multiply(newN, newD, sn, sd);
          return { ...d, n: nn, d: nd, sn, sd };
        });
      }
    }
  });
  
  steps = mergedSteps;
  
  const merged = [];
  results.forEach(r => {
    // 🔑 이름이 아닌 ID 기준으로 합산 여부 결정
    const ex = merged.find(m => m.id === r.id);
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
  let subGroupOrder = 0;
  tree.heirs.forEach((h, idx) => { if (!h.isDeceased) categoryMap[h.id] = { type: 'direct', order: idx }; });

  // 재귀적 가계 줄기 분류
  const buildCategory = (node, branchRoot, order) => {
    if (!node.heirs) return;
    node.heirs.forEach(h => {
      if (!h.isDeceased && h.name && h.name.trim() !== '') {
        if (!categoryMap[h.id]) {
          categoryMap[h.id] = { type: 'sub', ancestor: branchRoot, order: order };
        }
      }
      if (h.isDeceased) {
        buildCategory(h, branchRoot, order);
      }
    });
  };

  tree.heirs.forEach((h, idx) => {
    const isBloodPillar = !(h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse');
    
    if (h.isDeceased && isBloodPillar) {
      buildCategory(h, h, idx);
    } else if (!h.isDeceased) {
      categoryMap[h.id] = { type: 'direct', order: idx };
    }
  });

  const directShares = [];
  const subMap = {};

  merged.forEach(m => {
    const cat = categoryMap[m.id];
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