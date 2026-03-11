import { createPerson, REL_TYPES } from './graphModel';

/**
 * 기존 트리 구조(HeirNode)를 신규 그래프 모델(GraphData)로 변환
 */
export const migrateTreeToGraph = (legacyTree) => {
  let _idCounter = 0;
  const genId = (prefix = 'p') => prefix + '_mig_' + (++_idCounter) + '_' + Math.random().toString(36).substr(2, 4);

  const people = [];
  const relationships = [];

  const findOrCreate = (node, overrides = {}) => {
    // 이름이 같으면 동일인물로 간주 (간단한 매칭 로직)
    const existing = people.find(p => p.name && p.name === node.name && !p.isRoot);
    if (existing) {
      if (node.isDeceased && !existing.isDeceased) {
        existing.isDeceased = true;
        existing.deathDate = node.deathDate || '';
      }
      return existing;
    }

    const person = createPerson({
      id: genId(),
      name: node.name || '',
      gender: node.gender || (
        (node.relation === 'wife' || node.relation === 'daughter') ? 'female' : 'male'
      ),
      isDeceased: node.isDeceased || false,
      deathDate: node.deathDate || '',
      isHoju: node.isHoju || false,
      isSameRegister: node.isSameRegister !== false,
      marriageDate: node.marriageDate || '',
      isRemarried: node.isRemarried || false,
      remarriageDate: node.remarriageDate || '',
      ...overrides,
    });
    people.push(person);
    return person;
  };

  const traverseNode = (node, parentPersonId) => {
    const isSpouse = node.relation === 'wife' || node.relation === 'husband';
    const person = findOrCreate(node);

    const relType = isSpouse ? REL_TYPES.SPOUSE : REL_TYPES.CHILD;
    const relRole = node.relation || 'son';

    // 관계 추가
    const alreadyLinked = relationships.some(
      r => r.parentId === parentPersonId && r.childId === person.id
    );
    if (!alreadyLinked) {
      relationships.push({
        parentId: parentPersonId,
        childId: person.id,
        type: relType,
        role: relRole,
      });
    }

    // 자식 노드 순회
    if (node.heirs && node.heirs.length > 0) {
      node.heirs.forEach(heir => traverseNode(heir, person.id));
    }
  };

  // 피상속인(루트) 생성
  const rootPerson = createPerson({
    id: 'root',
    isRoot: true,
    name: legacyTree.name || '',
    gender: legacyTree.gender || 'male',
    isDeceased: true,
    deathDate: legacyTree.deathDate || '',
    isHoju: legacyTree.isHoju !== false,
  });
  people.push(rootPerson);

  // 상속인 순회
  if (legacyTree.heirs) {
    legacyTree.heirs.forEach(heir => traverseNode(heir, 'root'));
  }

  return {
    caseNo: legacyTree.caseNo || '',
    shareN: legacyTree.shareN || 1,
    shareD: legacyTree.shareD || 1,
    people,
    relationships,
  };
};

/**
 * 파일이 구 형식인지 확인
 */
export const isLegacyFormat = (data) => {
  return data && data.id === 'root' && Array.isArray(data.heirs) && !data.people;
};
