import { isBefore } from '../engine/utils';
import { getInitialTree } from './initialData';

// 1️⃣ 저장(마이그레이션) 엔진: 상태값은 버리고 오직 절대 '팩트(Fact)'만 중앙 창고에 보관
export const migrateToVault = (oldTree) => {
  const vault = {
    meta: {
      caseNo: oldTree.caseNo || '',
      rootPersonId: oldTree.personId || oldTree.id || 'root',
      targetShareN: oldTree.shareN || 1,
      targetShareD: oldTree.shareD || 1,
    },
    persons: {},
    relationships: {}
  };

  const traverse = (node, parentId = null) => {
    if (!node) return;
    const pId = node.personId || node.id || `p_${Math.random().toString(36).substr(2,9)}`;
    if (node.id === 'root') vault.meta.rootPersonId = pId;

    if (!vault.persons[pId]) {
      vault.persons[pId] = {
        id: pId, name: node.name || '', isDeceased: !!node.isDeceased,
        deathDate: node.deathDate || '', marriageDate: node.marriageDate || '',
        remarriageDate: node.remarriageDate || '', gender: node.gender || ''
      };
    }

    if (parentId) {
      if (!vault.relationships[parentId]) vault.relationships[parentId] = [];
      vault.relationships[parentId].push({
        targetId: pId, relation: node.relation || 'son',
        isExcluded: !!node.isExcluded, exclusionOption: node.exclusionOption || '',
        isHoju: !!node.isHoju, isSameRegister: node.isSameRegister !== false
      });
    }

    if (node.heirs) node.heirs.forEach(h => traverse(h, pId));
  };

  traverse(oldTree);
  return vault;
};

// 2️⃣ 조립(파생) 엔진: 팩트를 실시간 맥락(상속 개시일 등)과 결합하여 트리 구조 생성
export const buildTreeFromVault = (vault) => {
  if (!vault) return getInitialTree();
  const { rootPersonId } = vault.meta;
  const rootPerson = vault.persons[rootPersonId];
  if (!rootPerson) return getInitialTree();

  const buildNode = (personId, effectiveDate, visited = new Set()) => {
    const person = vault.persons[personId];
    if (!person || visited.has(personId)) return null;
    const newVisited = new Set(visited);
    newVisited.add(personId);

    const node = { ...person, heirs: [] };
    const links = vault.relationships[personId] || [];

    links.forEach(link => {
      const childPerson = vault.persons[link.targetId];
      const nextEffectiveDate = (childPerson?.deathDate && !isBefore(childPerson.deathDate, effectiveDate)) 
                                ? childPerson.deathDate : effectiveDate;
                                
      const childNode = buildNode(link.targetId, nextEffectiveDate, newVisited);
      if (childNode) {
        childNode.id = `n_${personId}_${link.targetId}`;
        childNode.relation = link.relation;
        childNode.isHoju = link.isHoju;
        
        const isPreDeceased = childNode.deathDate && effectiveDate && isBefore(childNode.deathDate, effectiveDate);
        const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(childNode.relation);
        const isDaughter = ['daughter', '딸'].includes(childNode.relation);

        childNode.isExcluded = link.isExcluded;
        childNode.exclusionOption = link.exclusionOption;

        if (isPreDeceased && !isSpouseType) {
          childNode.isExcluded = true; 
          childNode.exclusionOption = 'predeceased'; 
        }
        
        if (isDaughter && childNode.marriageDate && effectiveDate && isBefore(childNode.marriageDate, effectiveDate)) {
          childNode.isSameRegister = false; 
        } else {
          childNode.isSameRegister = link.isSameRegister;
        }

        node.heirs.push(childNode);
      }
    });
    return node;
  };

  const tree = buildNode(rootPersonId, rootPerson.deathDate);
  if (tree) {
    tree.caseNo = vault.meta.caseNo;
    tree.shareN = vault.meta.targetShareN;
    tree.shareD = vault.meta.targetShareD;
  }
  return tree || getInitialTree();
};

export const preprocessTree = (n, parentDate, parentNode) => {
  if (!n) return null;
  const isSpouse = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(n.relation);
  let isExcluded = !!n.isExcluded;
  let exclusionOption = n.exclusionOption || '';
  if (n.isDeceased && n.deathDate && parentDate && isBefore(n.deathDate, parentDate) && !isSpouse) {
    isExcluded = true; exclusionOption = 'predeceased';
  }
  const processed = { ...n, isExcluded, exclusionOption, parentNode };
  if (n.heirs) processed.heirs = n.heirs.map(h => preprocessTree(h, n.isDeceased ? n.deathDate : parentDate, processed)).filter(Boolean);
  return processed;
};
