import { isBefore } from '../engine/utils.js';

const DERIVED_KEYS = new Set([
  'r',
  'ex',
  'modifierReason',
  'shareN',
  'shareD',
  'n',
  'd',
  'un',
  'ud',
  'calcSteps',
  'finalShares',
  'warnings',
  'appliedLaws',
]);

const ALLOWED_KEYS = new Set([
  'id',
  'personId',
  'name',
  'isDeceased',
  'deathDate',
  'marriageDate',
  'remarriageDate',
  'divorceDate',
  'restoreDate',
  'gender',
  'relation',
  'isExcluded',
  'exclusionOption',
  'isHoju',
  'isPrimaryHojuSuccessor',
  'isSameRegister',
  'heirs',
  'caseNo',
  'shareN',
  'shareD',
  '_lastDeathDate',
  '_lastMarriageDate',
  '_lastRemarriageDate',
  '_lastDivorceDate',
  '_lastRestoreDate',
]);

const PERSON_FIELDS = [
  'name',
  'isDeceased',
  'deathDate',
  'marriageDate',
  'remarriageDate',
  'divorceDate',
  'restoreDate',
  'gender',
];

const LINK_FIELDS = [
  'relation',
  'isExcluded',
  'exclusionOption',
  'isHoju',
  'isPrimaryHojuSuccessor',
  'isSameRegister',
];

const generateId = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 11);

const normalizeDateField = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const pruneDerivedFields = (node) => {
  const next = {};
  Object.entries(node || {}).forEach(([key, value]) => {
    if (DERIVED_KEYS.has(key)) return;
    next[key] = value;
  });
  return next;
};

const normalizeRelation = (relation, fallback = 'son') => {
  const map = {
    wife: 'wife',
    husband: 'husband',
    spouse: 'spouse',
    son: 'son',
    daughter: 'daughter',
    sibling: 'sibling',
    parent: 'parent',
  };
  return map[relation] || relation || fallback;
};

const toSafeName = (value) => (typeof value === 'string' ? value.trim() : '');

const createPersonId = () => generateId('p');
const createNodeId = () => generateId('n');

export const normalizeImportedTree = (rawTree) => {
  const visitedPersonIds = new Set();

  const sanitizeNode = (inputNode, parentDate = '', isRoot = false) => {
    // 화이트리스트 기반 필드 추출 (불필요한 데이터 제거)
    const base = {};
    Object.entries(inputNode || {}).forEach(([key, value]) => {
      if (ALLOWED_KEYS.has(key)) base[key] = value;
    });

    const personId = base.personId || (isRoot ? 'root' : generateId('p'));
    
    // [v3.0.13 중복 방지] 이미 처리된 ID가 또 나오면 (루트 제외) 자식 목록만 비우거나 처리 제외
    const isDuplicate = !isRoot && personId && visitedPersonIds.has(personId);
    if (personId) visitedPersonIds.add(personId);

    const nodeId = isRoot ? 'root' : (base.id || ('n_' + personId));
    const deathDate = normalizeDateField(base.deathDate);
    const marriageDate = normalizeDateField(base.marriageDate);
    const remarriageDate = normalizeDateField(base.remarriageDate);
    const divorceDate = normalizeDateField(base.divorceDate);
    const restoreDate = normalizeDateField(base.restoreDate);
    const refDate = parentDate || deathDate;
    const relation = isRoot ? 'root' : normalizeRelation(base.relation);
    
    const heirs = (Array.isArray(base.heirs) && !isDuplicate)
      ? base.heirs.map((child) => sanitizeNode(child, deathDate || refDate, false))
      : [];

    let exclusionOption = base.exclusionOption || '';
    let isExcluded = !!base.isExcluded;
    const isSpouseType = ['wife', 'husband', 'spouse'].includes(relation);
    const isPredeceased = deathDate && refDate && isBefore(deathDate, refDate);

    if (
      isSpouseType &&
      isExcluded &&
      exclusionOption === 'renounce' &&
      deathDate &&
      refDate &&
      !isBefore(deathDate, refDate)
    ) {
      // Imported JSON can carry stale manual exclusions from a prior UI state.
      // A spouse who dies on/after the inherited reference date is a post-deceased
      // spouse estate, not a renouncing heir, so clear the stale exclusion here.
      isExcluded = false;
      exclusionOption = '';
    } else if (isPredeceased && isSpouseType) {
      isExcluded = true;
      exclusionOption = 'predeceased';
    } else if (isPredeceased && !isSpouseType) {
      // 선사망 자녀/형제자매는 하위 상속인이 없을 때만 OFF로 유지한다.
      // 하위 상속인이 있으면 대습상속 경로가 살아 있으므로 기본 ON으로 복구한다.
      if (heirs.length > 0) {
        isExcluded = false;
        exclusionOption = '';
      } else {
        isExcluded = true;
        exclusionOption = 'predeceased';
      }
    } else if (!!base.isDeceased && deathDate && refDate && !isPredeceased) {
      // 후사망(재상속): 강제 포함(ON) - JSON에 isExcluded:true로 저장되어 있어도 덮어씀
      isExcluded = false;
      exclusionOption = '';
    }

    const normalized = {
      id: nodeId,
      personId,
      name: base.name || '',
      relation,
      isDeceased: !!base.isDeceased,
      deathDate,
      marriageDate,
      remarriageDate,
      divorceDate,
      restoreDate,
      gender: base.gender || '',
      isHoju: !!base.isHoju,
      isPrimaryHojuSuccessor: !!base.isPrimaryHojuSuccessor,
      isExcluded: isDuplicate ? true : isExcluded,
      exclusionOption: isDuplicate ? 'duplicate' : exclusionOption,
      isSameRegister: base.isSameRegister !== false,
      heirs,
    };

    if (isRoot) {
      normalized.caseNo = base.caseNo || '';
      normalized.shareN = Math.max(1, Number(base.shareN) || 1);
      normalized.shareD = Math.max(1, Number(base.shareD) || 1);
      delete normalized.relation;
    }

    return normalized;
  };

  return sanitizeNode(rawTree, normalizeDateField(rawTree?.deathDate), true);
};

const cloneTree = (tree) => JSON.parse(JSON.stringify(tree));

const updateTreeNodes = (tree, matcher, updater) => {
  const walk = (node) => {
    const nextNode = { ...node, heirs: (node.heirs || []).map(walk) };
    return matcher(nextNode) ? updater(nextNode) : nextNode;
  };
  return walk(tree);
};

const findNodeById = (tree, targetId) => {
  let found = null;
  const walk = (node) => {
    if (found || !node) return;
    if (node.id === targetId) {
      found = node;
      return;
    }
    (node.heirs || []).forEach(walk);
  };
  walk(tree);
  return found;
};

export const updateDeathInfo = (tree, nodeId, payload) => {
  const current = findNodeById(tree, nodeId);
  if (!current) return tree;

  const nextDeathDate = payload.deathDate !== undefined ? normalizeDateField(payload.deathDate) : normalizeDateField(current.deathDate);
  const nextIsDeceased = payload.isDeceased !== undefined ? !!payload.isDeceased : !!current.isDeceased;
  const isPre = nextDeathDate && payload.inheritedDate && isBefore(nextDeathDate, payload.inheritedDate);
  const isSpouseType = ['wife', 'husband', 'spouse'].includes(current.relation);

  return updateTreeNodes(
    cloneTree(tree),
    (node) => node.id === nodeId,
    (node) => {
      const next = {
        ...node,
        isDeceased: nextIsDeceased,
      };

      if (!next._lastDeathDate && node.deathDate) {
        next._lastDeathDate = node.deathDate;
      }

      // [v3.0.29] 날짜 메모리 캡처 및 복원
      if (nextIsDeceased) {
        if (payload.deathDate) {
          next.deathDate = nextDeathDate;
          next._lastDeathDate = nextDeathDate;
        } else if (!node.isDeceased) {
          // 체크박스를 새로 켰을 때(isDeceased가 false였을 때), 메모리가 있다면 복원
          next.deathDate = node._lastDeathDate || '';
        } else {
          // 이미 체크된 상태에서 날짜를 수동으로 지운 경우 (''로 유지)
          next.deathDate = '';
        }
      } else {
        if (node.deathDate) next._lastDeathDate = node.deathDate;
        next.deathDate = '';
      }

      if (next.isDeceased) {
        if (isPre && isSpouseType) {
          next.isExcluded = true;
          next.exclusionOption = 'predeceased';
        } else if (isPre && !isSpouseType) {
          // 선사망: 기본 제외(OFF) + 옵션 고정
          next.isExcluded = true;
          next.exclusionOption = 'predeceased';
        } else if (!isPre) {
          // 후사망: 기본 포함(ON) -> 재상속 데이터 입력 가능케 함
          next.isExcluded = false;
          next.exclusionOption = '';
        }
      } else if (next.exclusionOption === 'predeceased') {
        next.isExcluded = false;
        next.exclusionOption = '';
      }

      return next;
    }
  );
};

export const updateHistoryInfo = (tree, nodeId, changes) => {
  const current = findNodeById(tree, nodeId);
  if (!current) return tree;

  const targetPersonId = current.personId;
  const nextChanges = {};
  PERSON_FIELDS.forEach((field) => {
    if (changes[field] !== undefined) {
      const val = field.endsWith('Date') ? normalizeDateField(changes[field]) : changes[field];
      nextChanges[field] = val;
      // [v3.0.29] 연혁 날짜 메모리 캡처
      if (field.endsWith('Date') && val) {
        nextChanges[`_last${field.charAt(0).toUpperCase() + field.slice(1)}`] = val;
      }
    }
  });

  if (nextChanges.marriageDate !== undefined && changes.isSameRegister === undefined) {
    nextChanges.isSameRegister = nextChanges.marriageDate ? false : true;
  }
  if (nextChanges.restoreDate !== undefined && changes.isSameRegister === undefined) {
    nextChanges.isSameRegister = nextChanges.restoreDate ? true : current.isSameRegister;
  }

  return updateTreeNodes(
    cloneTree(tree),
    (node) => node.id === nodeId || node.personId === targetPersonId,
    (node) => ({ ...node, ...nextChanges })
  );
};

export const updateRelationInfo = (tree, nodeId, relation) => {
  const current = findNodeById(tree, nodeId);
  if (!current) return tree;

  const nextRelation = normalizeRelation(relation, current.relation || 'son');
  const targetPersonId = current.personId;
  const isFemale = ['daughter', 'mother', 'sister', 'wife'].includes(nextRelation);
  const isMale = ['son', 'father', 'brother', 'husband'].includes(nextRelation);

  return updateTreeNodes(
    cloneTree(tree),
    (node) => node.id === nodeId || (targetPersonId && node.personId === targetPersonId),
    (node) => {
      const nextNode = { ...node, relation: nextRelation };

      if (isFemale || isMale) {
        nextNode.heirs = (nextNode.heirs || []).map((child) => {
          if (['wife', 'husband', 'spouse'].includes(child.relation)) {
            return { ...child, relation: isFemale ? 'husband' : 'wife' };
          }
          return child;
        });
      }

      return nextNode;
    }
  );
};

export const setPrimaryHojuSuccessor = (tree, parentNodeId, nodeId, isSelected = true) => {
  const walk = (node) => {
    if (!node) return node;
    if (node.id !== parentNodeId) {
      return { ...node, heirs: (node.heirs || []).map(walk) };
    }

    return {
      ...node,
      heirs: (node.heirs || []).map((child) => ({
        ...child,
        isPrimaryHojuSuccessor: isSelected ? child.id === nodeId : false,
      })),
    };
  };

  return walk(cloneTree(tree));
};

export const setHojuStatus = (tree, nodeId, isHoju) => {
  const walk = (node) => {
    if (!node.heirs || node.heirs.length === 0) return { ...node };
    const hasTargetChild = node.heirs.some((child) => child.id === nodeId);
    if (hasTargetChild) {
      return {
        ...node,
        heirs: node.heirs.map((child) => ({
          ...child,
          isHoju: child.id === nodeId ? !!isHoju : false,
        })),
      };
    }
    return { ...node, heirs: node.heirs.map(walk) };
  };

  return walk(cloneTree(tree));
};

export const applyNodeUpdates = (tree, nodeId, updates) => {
  const current = findNodeById(tree, nodeId);
  if (!current) return tree;
  const targetPersonId = current.personId;

  const personUpdates = {};
  const linkUpdates = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (PERSON_FIELDS.includes(key)) personUpdates[key] = value;
    if (LINK_FIELDS.includes(key)) linkUpdates[key] = value;
  });

  return updateTreeNodes(
    cloneTree(tree),
    (node) => node.id === nodeId || (targetPersonId && node.personId === targetPersonId),
    (node) => {
      if (node.id === nodeId) return { ...node, ...personUpdates, ...linkUpdates };
      return { ...node, ...personUpdates };
    }
  );
};

export const appendQuickHeirs = (tree, parentId, rawNames) => {
  const current = findNodeById(tree, parentId);
  if (!current) return tree;

  const names = rawNames
    .split(/[,\s]+/)
    .map(toSafeName)
    .filter(Boolean);

  if (names.length === 0) return tree;

  const usedNames = new Set((current.heirs || []).map((heir) => heir.name).filter(Boolean));
  const hasSpouse = (current.heirs || []).some((heir) => ['wife', 'husband', 'spouse'].includes(heir.relation));
  const isParentFemale = current.gender === 'female' || ['wife', 'daughter', 'mother', 'sister'].includes(current.relation);

  const newHeirs = names.map((name, index) => {
    const isSpouse = index === 0 && !hasSpouse;
    let finalName = name;
    if (usedNames.has(finalName)) {
      let suffix = 2;
      while (usedNames.has(`${name}(${suffix})`)) suffix += 1;
      finalName = `${name}(${suffix})`;
    }
    usedNames.add(finalName);

    return {
      id: createNodeId(),
      personId: createPersonId(),
      name: finalName,
      relation: isSpouse ? (isParentFemale ? 'husband' : 'wife') : 'son',
      isDeceased: false,
      deathDate: '',
      marriageDate: '',
      remarriageDate: '',
      divorceDate: '',
      restoreDate: '',
      gender: '',
      isHoju: false,
      isPrimaryHojuSuccessor: false,
      isExcluded: false,
      exclusionOption: '',
      isSameRegister: true,
      heirs: [],
    };
  });

  return updateTreeNodes(
    cloneTree(tree),
    (node) => node.id === parentId,
    (node) => ({
      ...node,
      isDeceased: true,
      isExcluded: false,
      exclusionOption: '',
      heirs: [...(node.heirs || []), ...newHeirs],
    })
  );
};

export const serializeFactTree = (tree) => {
  const serializeNode = (node, parentDate = '') => {
    const deathDate = normalizeDateField(node?.deathDate);
    const refDate = parentDate || deathDate;
    const isPredeceased = deathDate && refDate && isBefore(deathDate, refDate);
    const exclusionOption =
      isPredeceased && node?.isExcluded && node?.exclusionOption === 'renounce'
        ? 'predeceased'
        : (node?.exclusionOption || '');

    return {
      id: node?.id || 'root',
      personId: node?.personId || (node?.id === 'root' ? 'root' : createPersonId()),
      name: node?.name || '',
      relation: node?.id === 'root' ? undefined : normalizeRelation(node?.relation),
      isDeceased: !!node?.isDeceased,
      deathDate,
      marriageDate: normalizeDateField(node?.marriageDate),
      remarriageDate: normalizeDateField(node?.remarriageDate),
      divorceDate: normalizeDateField(node?.divorceDate),
      restoreDate: normalizeDateField(node?.restoreDate),
      gender: node?.gender || '',
      isHoju: !!node?.isHoju,
      isPrimaryHojuSuccessor: !!node?.isPrimaryHojuSuccessor,
      isExcluded: !!node?.isExcluded,
      exclusionOption,
      isSameRegister: node?.isSameRegister !== false,
      caseNo: node?.id === 'root' ? (node?.caseNo || '') : undefined,
      shareN: node?.id === 'root' ? Math.max(1, Number(node?.shareN) || 1) : undefined,
      shareD: node?.id === 'root' ? Math.max(1, Number(node?.shareD) || 1) : undefined,
      heirs: (node?.heirs || []).map((child) => serializeNode(child, deathDate || refDate)),
    };
  };

  return JSON.parse(JSON.stringify(serializeNode(tree)));
};
