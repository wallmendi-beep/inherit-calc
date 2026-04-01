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

    // 💡 최종 진화: 1순위 가지 멸절 시 2순위/3순위로의 자동 이전을 완벽하게 제어하는 스마트 필터
    const isRenounced = (h, contextDate) => {
      // 1. 제외 사유 판별 (결격 또는 상실선고)
      const isDisqualified = h.isExcluded && (h.exclusionOption === 'lost' || h.exclusionOption === 'disqualified');
      
      // 2. 단순 상속포기/재혼/상속인없음 등은 지분 거부로 보아 즉시 제외 (형제들에게 재분배됨)
      if (h.isExcluded && !isDisqualified) return true;

      // 3. 대습상속 유발 사유 (선사망 또는 결격/상실선고)
      const isPre = h.isDeceased && h.deathDate && contextDate && isBefore(h.deathDate, contextDate);
      
      if (isPre || isDisqualified) {
        let children = h.heirs || [];
        
        // 동명이인 데이터 참조 (원본 자식 빌려오기)
        if (children.length === 0 && h.name) {
          const borrowed = findHeirsByName(tree, h.name, h.id);
          if (borrowed) children = borrowed;
        }

        // 🚨 [2024. 4. 25. 신법 핵심 로직] 결격/상실자의 배우자는 대습상속 원천 배제!
        if (isDisqualified) {
          const rootDDate = tree.deathDate || contextDate; 
          if (!isBefore(rootDDate, '2024-04-25')) {
            // 배우자(며느리, 사위, 제수 등)를 상속인 명단에서 가차 없이 삭제
            children = children.filter(c => !(['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(c.relation)));
          }
        }

        // 자녀도 없고, 배우자마저 신법으로 쫓겨나 아무도 남지 않았다면 이 가지(Branch)는 완전 멸절! -> 2순위, 3순위로 이전 유발
        if (children.length === 0) return true;

        // 남아있는 자식들이라도 모두 포기/결격 상태인지 재귀적 검사
        const validHeirs = children.filter(child => !isRenounced(child, h.deathDate || contextDate));
        if (validHeirs.length === 0) return true;

        // 유효한 대습상속인이 단 한 명이라도 존재하므로 이 가지는 대습상속 개시!
        return false;
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

    // 💡 수정 1: 결격/상실자의 경우 본인은 지분을 받지 않도록(results에 넣지 않음) 하고,
    // 계산을 중단하지 않고 하위 대습상속인에게 넘어가도록 로직 수정
    if (!node.isDeceased && !(node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) || node.id === 'root') {
      if (node.id !== 'root') {
        results.push({ id: node.id, personId: node.personId, name: node.name, n: inN, d: inD, relation: node.relation });
      }
      // 일반 생존자라면 여기서 종료하지만, 결격/상실자는 조기 종료하지 않고 하위 탐색을 계속함
      if (!node.isDeceased && !isDisqualifiedOrLost) return;
    }

    // 💡 수정 2: 결격/상실자 본인의 지분은 0으로 처리 (결과창에 0으로 뜨게 함)
    if (isDisqualifiedOrLost) {
      results.push({ id: node.id, personId: node.personId, name: node.name, n: 0, d: 1, relation: node.relation });
    }

    if (isRenounced(node, inheritedDate)) return;

    let targetHeirs = (node.heirs || []).filter(h => !isRenounced(h, distributionDate)); 

    // 💡 수정 3 [2024. 4. 25. 신법 적용]: 결격/상실자의 상속인을 계산할 때 배우자 차단 로직 추가
    if (isDisqualifiedOrLost && !isBefore(tree.deathDate || distributionDate, '2024-04-25')) {
      targetHeirs = targetHeirs.filter(h => !(['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(h.relation)));
    }
    const originalChildren = (node.heirs || []).filter(h => h.relation === 'son' || h.relation === 'daughter');
    const renouncedChildrenCount = originalChildren.filter(isRenounced).length;
    const isAllChildrenRenounced = originalChildren.length > 0 && renouncedChildrenCount === originalChildren.length;
    const spouseInHeirs = (node.heirs || []).find(h => (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && !isRenounced(h));

    if (isAllChildrenRenounced) {
      if (spouseInHeirs && law === '1991') {
        targetHeirs = [spouseInHeirs];
      } else if (!spouseInHeirs) {
        let grandchildren = [];
        originalChildren.forEach(child => {
           if (child.heirs) grandchildren = grandchildren.concat(child.heirs.filter(h => !isRenounced(h)));
        });
        if (grandchildren.length > 0) targetHeirs = grandchildren;
      }
    }

    if (targetHeirs.length === 0 && isSubstitutionTrigger(node) && node.id !== 'root') {
      const borrowed = findHeirsByName(tree, node.name, node.id);
      if (borrowed && borrowed.length > 0) {
        targetHeirs = borrowed.filter(h => !isRenounced(h));
      }
    }

    // 3. 하위 상속인이 전혀 없는 경우 (스마트 프루닝이 끝난 후의 최종 안전장치)
    if (targetHeirs.length === 0) {
      if (node.id === 'root') return;

      // 이미 isRenounced에 의해 걸러지지 않고 여기까지 내려왔다는 것은, 사용자가 스위치를 끄지 않은 생존/후사망 상태임을 의미.
      // 억지로 지분을 뺏지 않고 본인 주머니에 깔끔하게 보관합니다.
      if (!node.isExcluded) {
        const isSubstitution = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);
        if (isSubstitution) return; 
        
        results.push({ id: node.id, personId: node.personId, name: node.name, n: inN, d: inD, relation: node.relation });
        return; 
      }
      return; 
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