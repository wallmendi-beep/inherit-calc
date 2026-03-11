/**
 * 그래프 기반 상속 데이터 모델 유틸리티
 * 
 * 데이터 구조:
 * - people: 인물 목록 (각 인물은 고유 id 보유)
 * - relationships: 관계 목록 (parentId, childId, type)
 * 
 * 이 구조를 통해 동일 인물이 여러 상속 체인에 참조되어
 * 지분 합산이 자동으로 이루어집니다.
 */

// ──────────────────────────────────────────────
// 타입 상수
// ──────────────────────────────────────────────
export const REL_TYPES = {
  SPOUSE: 'spouse',
  CHILD: 'child',
};

// ──────────────────────────────────────────────
// 새 인물 생성
// ──────────────────────────────────────────────
export const createPerson = (overrides = {}) => ({
  id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  name: '',
  gender: 'male',
  isDeceased: false,
  deathDate: '',
  isHoju: false,
  isSameRegister: true,
  marriageDate: '',
  isRemarried: false,
  remarriageDate: '',
  ...overrides,
});

// ──────────────────────────────────────────────
// 그래프 데이터 헬퍼
// ──────────────────────────────────────────────

/** 특정 인물의 직접 상속인(자녀+배우자) 반환 */
export const getDirectHeirs = (personId, rels, people) => {
  return rels
    .filter(r => r.parentId === personId)
    .map(r => {
      const person = people.find(p => p.id === r.childId);
      return person ? { ...person, relationType: r.type, relationRole: r.role } : null;
    })
    .filter(Boolean);
};

/** 특정 인물의 배우자 반환 */
export const getSpouses = (personId, rels, people) => {
  return rels
    .filter(r => r.parentId === personId && r.type === REL_TYPES.SPOUSE)
    .map(r => people.find(p => p.id === r.childId))
    .filter(Boolean);
};

/** 특정 인물의 자녀 반환 */
export const getChildren = (personId, rels, people) => {
  return rels
    .filter(r => r.parentId === personId && r.type === REL_TYPES.CHILD)
    .map(r => people.find(p => p.id === r.childId))
    .filter(Boolean);
};

/** 사망한 모든 인물 목록 반환 (피상속인 포함) */
export const getAllDeceasedPersons = (people) => {
  return people.filter(p => p.isDeceased || p.isRoot);
};

/** 상속 계산용 트리 구조 빌드 (기존 inheritance.js 호환) */
export const buildLegacyTree = (graphData) => {
  const { people = [], relationships = [], caseNo, shareN, shareD } = graphData;
  const root = people.find(p => p.isRoot);
  if (!root) return null;

  const buildNode = (personId, role, depth = 0) => {
    if (depth > 10) return null; // 무한 루프 방지
    const person = people.find(p => p.id === personId);
    if (!person) return null;

    // 이 인물의 상속인(배우자+자녀) 가져오기
    const heirRels = relationships.filter(r => r.parentId === personId);
    const heirs = heirRels
      .map(r => {
        const heirPerson = people.find(p => p.id === r.childId);
        if (!heirPerson) return null;
        // 관계 역할 결정
        let relation = r.role || 'son';
        return buildNode(r.childId, relation, depth + 1);
      })
      .filter(Boolean);

    return {
      id: person.isRoot ? 'root' : person.id,
      name: person.name,
      gender: person.gender || 'male',
      isDeceased: person.isDeceased || person.isRoot,
      deathDate: person.deathDate || '',
      relation: role || 'son',
      isHoju: person.isHoju || false,
      isSameRegister: person.isSameRegister !== false,
      marriageDate: person.marriageDate || '',
      isRemarried: person.isRemarried || false,
      remarriageDate: person.remarriageDate || '',
      heirs,
    };
  };

  const treeNode = buildNode(root.id, null);
  if (!treeNode) return null;

  return {
    ...treeNode,
    caseNo: caseNo || '',
    shareN: shareN || 1,
    shareD: shareD || 1,
  };
};

// ──────────────────────────────────────────────
// 새 그래프 데이터 초기화
// ──────────────────────────────────────────────
export const createEmptyGraph = () => ({
  caseNo: '',
  shareN: 1,
  shareD: 1,
  people: [
    createPerson({ id: 'root', isRoot: true, isDeceased: true, name: '', gender: 'male' })
  ],
  relationships: [],
});
