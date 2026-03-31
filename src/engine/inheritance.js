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

    let isSubstitution = false;
    let distributionDate = inheritedDate;
    let isDisqualifiedOrLost = false;

    if (node.id !== 'root' && node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
      distributionDate = node.deathDate;
    } else if (node.id !== 'root' && node.isDeceased && node.deathDate) {
      isSubstitution = true;
    }
    
    if (node.id !== 'root' && node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) {
      isSubstitution = true;
      isDisqualifiedOrLost = true; 
      distributionDate = inheritedDate; 
    }

    const law = getLawEra(distributionDate); 

    // 💡 최종 픽스: 하위 상속인이 전원 제외된 대습상속 가지를 소급 제외하되, '동명이인 참조 노드'의 자식들까지 정확히 불러와서 검사함
    const isRenounced = (h, contextDate) => {
      // 1. 본인이 직접 스위치가 꺼진 경우
      if (h.isExcluded) return true; 

      // 2. 본인이 선사망자(또는 결격/상실자)인 경우 하위 상속인 생존 여부 검사
      const isPre = h.isDeceased && h.deathDate && contextDate && isBefore(h.deathDate, contextDate);
      const isDisqualified = h.isExcluded && (h.exclusionOption === 'lost' || h.exclusionOption === 'disqualified');
      
      if (isPre || isDisqualified) {
        let children = h.heirs || [];
        
        // 💡 충돌 방지: 복제 노드라서 자식이 비어있다면, 트리에서 원본 자식들을 빌려와서 검사
        if (children.length === 0 && h.name) {
          const borrowed = findHeirsByName(tree, h.name, h.id);
          if (borrowed) children = borrowed;
        }

        // 빌려와봤는데도 진짜로 자식이 없으면 이 가지는 죽은 것
        if (children.length === 0) return true;

        // 자식이 있다면, 그 자식들이 모두 '제외' 처리되었는지 재귀적으로 검사
        const validHeirs = children.filter(child => !isRenounced(child, h.deathDate || contextDate));
        
        // 자식들이 살아있지만 모두 제외(포기) 상태라면 이 가지도 죽은 것으로 처리 (지분 블랙홀 방지)
        if (validHeirs.length === 0) return true;
      }
      return false;
    };

    const isSubstitutionTrigger = (h) => 
      h.isDeceased || (h.isExcluded && (h.exclusionOption === 'disqualified' || h.exclusionOption === 'lost'));

    // 💡 유효성 검사 (입력 누락 방지 가이드)
    if (!node.isExcluded) {
      if (node.isDeceased && !node.deathDate) {
        warnings.push(`${node.name || '이름 미입력'} 님의 사망일자가 입력되지 않았습니다.`);
      }
      if (node.id !== 'root' && node.isDeceased && node.deathDate && isBefore(node.deathDate, inheritedDate)) {
        const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
        if (activeHeirs.length === 0) {
          warnings.push(`선사망자 '${node.name}'의 대습상속인이 누락되었습니다. 상속인이 없다면 스위치를 꺼주세요.`);
        }
      }
    }

    if (!node.isDeceased && !(node.isExcluded && node.exclusionOption === 'lost') || node.id === 'root') {
      if (node.id !== 'root') results.push({ id: node.id, personId: node.personId, name: node.name, n: inN, d: inD, relation: node.relation });
      if (!node.isDeceased && !(node.isExcluded && node.exclusionOption === 'lost')) return;
    }

    // 현재 노드가 분배 제외 대상이면 더 이상 하위 계산을 하지 않음 (블랙홀 차단)
    if (isRenounced(node, inheritedDate)) return;

    let targetHeirs = (node.heirs || []).filter(h => !isRenounced(h, distributionDate)); 

    // [2023년 전원합의체 판례 및 실무 반영] 
    // 본래 상속인이어야 할 자녀가 모두 포기한 경우의 처리
    const originalChildren = (node.heirs || []).filter(h => h.relation === 'son' || h.relation === 'daughter');
    const renouncedChildrenCount = originalChildren.filter(isRenounced).length;
    const isAllChildrenRenounced = originalChildren.length > 0 && renouncedChildrenCount === originalChildren.length;
    
    const spouseInHeirs = (node.heirs || []).find(h => (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && !isRenounced(h));

    if (isAllChildrenRenounced) {
      if (spouseInHeirs && law === '1991') {
        // 배우자가 있는 경우 -> 배우자 단독 상속 처리
        targetHeirs = [spouseInHeirs];
      } else if (!spouseInHeirs) {
        // 배우자가 없는 경우 -> 그 다음 직계비속(손자녀)이 본위상속
        let grandchildren = [];
        originalChildren.forEach(child => {
           if (child.heirs) {
              grandchildren = grandchildren.concat(child.heirs.filter(h => !isRenounced(h)));
           }
        });
        if (grandchildren.length > 0) targetHeirs = grandchildren;
      }
    }

    // 2. 대습상속/재상속 하위 탐색 자동 참조 로직
    if (targetHeirs.length === 0 && isSubstitutionTrigger(node) && node.id !== 'root') {
      const borrowed = findHeirsByName(tree, node.name, node.id);
      if (borrowed && borrowed.length > 0) {
        targetHeirs = borrowed.filter(h => !isRenounced(h));
      }
    }

    // 3. 하위 상속인이 전혀 없는 경우 (가상 상속인 배분 단계)
    if (targetHeirs.length === 0) {
      if (node.id === 'root') return;

      // 재혼이나 상속권 소멸 명시 시 배분 로직 건너뜀 (지분 0 처리)
      if (node.isExcluded && (node.exclusionOption === 'no_heir' || node.exclusionOption === 'remarried')) {
        results.push({ id: node.id, personId: node.personId, name: node.name, n: 0, d: 1, relation: node.relation });
        return; 
      }

      // 🚨 [버그 수정]: 대습상속(선사망) 또는 결격/상실인 경우, 하위 상속인이 없다면
      // 부모나 형제에게 지분을 억지로 넘기지 않고 여기서 계산을 즉시 중단합니다.
      // 💡 핵심 픽스: 계산을 멈추기 전에, 사망자 본인의 주머니(유령 지분)를 0으로 비워줍니다!
      if (!node.isExcluded) {
        return;
      }
      const isSubstitution = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'disqualified' || node.exclusionOption === 'lost'));
      if (isSubstitution) {
        results.push({ id: node.id, personId: node.personId, name: node.name, n: 0, d: 1, relation: node.relation });
        return; 
      }
      // 💡 핵심 픽스: 피상속인의 직계뿐만 아니라, 손자/증손자 등 어떤 계층에서든 부모와 형제자매를 추적하여 지분 누수를 완벽 차단!
      if (node.relation === 'son' || node.relation === 'daughter') {        let parentNode = null;
        if (tree.heirs.some(th => th.id === node.id)) parentNode = tree;
        else {
          const findP = (curr) => {
            if (curr.heirs && curr.heirs.some(h => h.id === node.id)) parentNode = curr;
            else (curr.heirs || []).forEach(findP);
          };
          findP(tree);
        }
        
        if (parentNode && parentNode.heirs) {
          const virtualHeirs = [];
          const survivingSpouses = parentNode.heirs.filter(th => 
            (th.relation === 'wife' || th.relation === 'husband' || th.relation === 'spouse') && 
            (!th.isDeceased || !isBefore(th.deathDate, distributionDate)) &&
            !isRenounced(th, distributionDate)
          );
          survivingSpouses.forEach(p => virtualHeirs.push({ ...p, id: p.id, relation: 'parent' }));
          
          if (virtualHeirs.length === 0) {
            const siblings = parentNode.heirs.filter(th => 
              th.id !== node.id && 
              (th.relation === 'son' || th.relation === 'daughter') &&
              !isRenounced(th, distributionDate)
            );
            if (siblings.length > 0) {
              siblings.forEach(s => virtualHeirs.push({ ...s, id: s.id, relation: 'sibling' }));
            } else { return; }
          }
          targetHeirs = virtualHeirs;
        } else { return; }
      } else if (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse') {
          let parentNode = null;
          const findParent = (curr) => {
             if (curr.heirs && curr.heirs.some(h => h.id === node.id)) { parentNode = curr; } 
             else { for (const child of curr.heirs || []) findParent(child); }
          };
          findParent(tree);
          
          if (parentNode && parentNode.heirs) {
             const children = parentNode.heirs.filter(th => th.id !== node.id && (th.relation === 'son' || th.relation === 'daughter') && !isRenounced(th, distributionDate));
             const virtualHeirs = [];
             children.forEach(c => { virtualHeirs.push({ ...c, id: c.id, relation: c.relation }); });
             
             if (virtualHeirs.length > 0) {
               targetHeirs = virtualHeirs;
             } else { return; }
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
      } else if (h.isExcluded && h.exclusionOption === 'remarried') {
        h.r = 0; h.ex = '대습상속 개시 전 재혼으로 인한 상속권 소멸'; skipped = true;
      }

      if (skipped) { /* 이미 처리됨 */ }
      else if (isSp && isDisqualifiedOrLost && !isBefore(inheritedDate, '2024-04-25')) {
        h.r = 0; h.ex = '개정 민법에 따라 결격/상실자의 배우자는 대습상속 불가'; 
      }
      else if (isSp && isPre) { h.r = 0; h.ex = `${h.deathDate} 피상속인보다 먼저 사망`; }
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
  
  // 📊 후처리: 동일 인물의 계산 step 병합 (personId 기준)
  const mergedSteps = [];
  const stepByPersonId = {}; // 🔑 personId 기준으로 병합
  
  steps.forEach(step => {
    const pId = step.dec?.personId;
    if (!pId || step.dec?.id === 'root') {
      mergedSteps.push(step);
      return;
    }
    
    if (!stepByPersonId[pId]) {
      step.mergeSources = [{ from: step.parentDecName || '피상속인', n: step.inN, d: step.inD }];
      stepByPersonId[pId] = step;
      mergedSteps.push(step);
    } else {
      const existing = stepByPersonId[pId];
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
    // 🔑 personId 기준으로 최종 합산
    const ex = merged.find(m => m.personId === r.personId);
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
  tree.heirs.forEach((h, idx) => { if (!h.isDeceased) categoryMap[h.personId] = { type: 'direct', order: idx }; });

  // 재귀적 가계 줄기 분류
  const buildCategory = (node, branchRoot, order) => {
    if (!node.heirs) return;
    node.heirs.forEach(h => {
      if (!h.isDeceased && h.name && h.name.trim() !== '') {
        if (!categoryMap[h.personId]) {
          categoryMap[h.personId] = { type: 'sub', ancestor: branchRoot, order: order };
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
      categoryMap[h.personId] = { type: 'direct', order: idx };
    }
  });

  const directShares = [];
  const subMap = {};

  merged.forEach(m => {
    const cat = categoryMap[m.personId];
    if (!cat || cat.type === 'direct') { directShares.push(m); } 
    else {
      const ancPId = cat.ancestor.personId;
      if (!subMap[ancPId]) subMap[ancPId] = { ancestor: cat.ancestor, order: cat.order, shares: [] };
      subMap[ancPId].shares.push(m);
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