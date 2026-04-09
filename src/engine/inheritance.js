import { math, getLawEra, isBefore } from './utils.js';

export const calculateInheritance = (tree) => {
  let results = [];
  let steps = [];
  let warnings = [];
  let appliedLaws = new Set();
  
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

  //  parentPersonId를 추가하여 현재 어떤 탭(부모)을 처리 중인지 추적합니다.
  const traverse = (node, inN, inD, inheritedDate, visitedIds = [], parentDecName = '피상속인') => {
    if (visitedIds.includes(node.id)) {
      // 🚨 UI가 클릭 이벤트를 처리할 수 있도록 문자열 대신 객체(id 포함) 형태로 경고 전송
      warnings.push({ id: node.id, text: `순차상속 순환 참조가 발생하여 [${node.name || '상속인'}]의 지분 전이가 중단되었습니다.` });
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

    //  최종 진화: 1순위 가지 멸절 시 2순위/3순위로의 자동 이전을 완벽하게 제어하는 스마트 필터
    const isRenounced = (h, contextDate) => {
      // 🤖 [Phase 2-2: 시계열 판별 AI] 날짜 기반 상속권/대습상속권 자동 박탈 (이혼/재혼)
      const isDivorcedAuto = h.divorceDate && contextDate && !isBefore(contextDate, h.divorceDate);
      const isRemarriedAuto = h.remarriageDate && contextDate && !isBefore(contextDate, h.remarriageDate);

      // 1. 대습/재상속 유발 사유 판별 (선사망, 결격, 상실선고)
      const isPredeceasedOption = h.isExcluded && h.exclusionOption === 'predeceased';
      const isDisqualified = h.isExcluded && (h.exclusionOption === 'lost' || h.exclusionOption === 'disqualified');
      
      // 2. 진짜 상속포기(renounce)나 알 수 없는 수동제외만 즉시 컷오프!
      // 선사망(predeceased)이거나 결격/상실(disqualified)인 경우는 하위 가계로 지분을 내려줘야 하므로 패스시킵니다.
      if (h.isExcluded && !isDisqualified && !isPredeceasedOption) return true;
      
      //  AI 엔진 컷오프: 이혼이나 재혼 날짜가 사망일보다 빠르면 가차없이 명단에서 삭제!
      if (isDivorcedAuto || isRemarriedAuto) return true; 

      // 3. 대습상속 유발 사유 (선사망 또는 결격/상실선고)
      const isPre = h.isDeceased && h.deathDate && contextDate && isBefore(h.deathDate, contextDate);
      
      if (isPre || isDisqualified) {
        let children = h.heirs || [];
        
        if (children.length === 0 && h.name) {
          const borrowed = findHeirsByName(tree, h.name, h.id);
          if (borrowed) children = borrowed;
        }

        if (isDisqualified) {
          const rootDDate = tree.deathDate || contextDate; 
          if (!isBefore(rootDDate, '2024-04-25')) {
            children = children.filter(c => !(['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(c.relation)));
          }
        }

        if (children.length === 0) return true;

        //  대습상속 자격(재혼/결격 등)은 '피대습자(윤숙자)'가 아닌 상속이 개시된 '본래 피상속인(김명남)'의 사망일(contextDate)을 기준으로 엄격히 판별해야 합니다!
        const validHeirs = children.filter(child => !isRenounced(child, contextDate));
        if (validHeirs.length === 0) return true;

        return false;
      }
      return false;
    };

    const isSubstitutionTrigger = (h) => 
      h.isDeceased || (h.isExcluded && (h.exclusionOption === 'disqualified' || h.exclusionOption === 'lost'));

    if (!node.isExcluded) {
      if (node.isDeceased && !node.deathDate) {
        //  피상속인(root)은 App.jsx의 smartGuides에서 이미 처리하므로 여기서는 일반 상속인만 체크
        if (node.id !== 'root') {
          //  수정 완료: 내비게이션 엔진이 읽을 수 있도록 { id: node.id, text: "문구" } 형태로 보냅니다!
          warnings.push({ id: node.id, text: `[${node.name || '이름 미상'}]님의 사망일자가 입력되지 않았습니다.` });
        }
      }
      if (node.id !== 'root' && node.isDeceased && node.deathDate && isBefore(node.deathDate, inheritedDate)) {
        const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
        if (activeHeirs.length === 0) {
          //  여기도 완벽하게 객체 형태로 묶어서 보냅니다!
          warnings.push({ id: node.id, text: `[${node.name}] 사망(${node.deathDate})에 따른 하위 상속인 정보가 없습니다. 무자녀인 경우 고인의 부모/형제를 입력해 주세요.` });
        }
      }
    }

    if (!node.isDeceased && !(node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) || node.id === 'root') {
      if (node.id !== 'root') {
        results.push({ id: node.id, personId: node.personId, name: node.name, n: inN, d: inD, relation: node.relation });
      }
      if (!node.isDeceased && !isDisqualifiedOrLost) return;
    }

    if (isDisqualifiedOrLost) {
      results.push({ id: node.id, personId: node.personId, name: node.name, n: 0, d: 1, relation: node.relation });
    }

    if (isRenounced(node, inheritedDate)) return;

    let targetHeirs = (node.heirs || []).filter(h => !isRenounced(h, distributionDate)); 

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

    if (targetHeirs.length === 0) {
      if (node.id === 'root') return;

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
    else if (hasSpouse) activeRank = -1; 
    else if (hasRank3) activeRank = 3;
    
    targetHeirs.forEach(h => {
      const isSp = h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse';
      const isPre = h.isDeceased && h.deathDate && isBefore(h.deathDate, distributionDate);
      let modifier = ''; 

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
             // 🤖 [Phase 2-2: 시계열 판별 AI] 혼인 및 친가복적 자동 판별
             let isMarried = h.isSameRegister === false;
             if (h.marriageDate && distributionDate) {
               isMarried = !isBefore(distributionDate, h.marriageDate); // 사망일 이전에 혼인했으면 출가녀
             }
             if (h.restoreDate && distributionDate && !isBefore(distributionDate, h.restoreDate)) {
               isMarried = false; // 사망일 이전에 친가로 돌아왔으면 복적 완료! (동일가적)
             }

             if (!isMarried) { h.r = 1.0; }
             else { h.r = 0.25; modifier = '출가녀 감산 (아들의 1/4)'; }
           } else if (h.relation === 'son') {
             //  피상속인(node)이 여성이면 호주상속 가산(1.5)을 적용하지 않음 (대법원 판례 반영)
             const isFemaleDeceased = ['wife', 'daughter'].includes(node.relation);
             
             if (h.isHoju && !isFemaleDeceased && (!isSubstitution || node.isHoju)) { 
               h.r = 1.5; 
               modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; 
             }
             else { h.r = 1.0; }
           } else h.r = 1.0;
         } else { // 1960년 구법
            if (h.relation === 'daughter') {
              // 🤖 [Phase 2-2: 시계열 판별 AI] 혼인 및 친가복적 자동 판별
              let isMarried = h.isSameRegister === false;
              if (h.marriageDate && distributionDate) {
                isMarried = !isBefore(distributionDate, h.marriageDate);
              }
              if (h.restoreDate && distributionDate && !isBefore(distributionDate, h.restoreDate)) {
                isMarried = false; // 복적 완료!
              }

              if (!isMarried) { h.r = 0.5; modifier = '여자 감산 (남자의 1/2)'; }
              else { h.r = 0.25; modifier = '출가녀 감산 (남자의 1/4)'; }
           } else if (h.relation === 'son') {
             //  피상속인(node)이 여성이면 호주상속 가산(1.5)을 적용하지 않음 (대법원 판례 반영)
             const isFemaleDeceased = ['wife', 'daughter'].includes(node.relation);
             
             if (h.isHoju && !isFemaleDeceased && (!isSubstitution || node.isHoju)) { 
               h.r = 1.5; 
               modifier = isSubstitution ? '대습 호주가산 (선례 2-285호)' : '호주상속 5할 가산'; 
             }
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
      childrenToTraverse.forEach(child => { 
        traverse(child.h, child.nn, child.nd, distributionDate, currentVisited, node.name || '피상속인'); 
      });
    }
  };

  const initN = Math.max(1, Number(tree.shareN) || 1);
  const initD = Math.max(1, Number(tree.shareD) || 1);
  traverse(tree, initN, initD, tree.deathDate, []);
  
  const mergedSteps = [];
  const stepByPersonId = {}; 
  
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
  
  //  중복 에러 제거 (객체 형태 지원)
  const uniqueWarnings = [];
  const warningKeys = new Set();
  warnings.forEach(w => {
    const key = typeof w === 'string' ? w : w.text;
    if (!warningKeys.has(key)) {
      warningKeys.add(key);
      uniqueWarnings.push(w);
    }
  });

  return {
    finalShares: { direct: directShares, subGroups: subGroups },
    calcSteps: steps,
    warnings: uniqueWarnings, //  업그레이드된 에러 배열 내보내기
    appliedLaws: Array.from(appliedLaws).sort()
  };
};
