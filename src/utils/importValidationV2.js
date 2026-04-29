import { isBefore } from '../engine/utils';

const SPOUSE_RELATIONS = new Set(['wife', 'husband', 'spouse']);
const VALID_RELATIONS = new Set(['wife', 'husband', 'spouse', 'son', 'daughter', 'parent', 'sibling']);

const buildIssue = (node, issue) => ({
  personId: node?.personId || '',
  nodeId: node?.id || 'root',
  targetTabId: node?.personId || node?.id || 'root',
  personName: node?.name || '이름 미상',
  severity: 'warning',
  ...issue,
});

// 트리 전체에서 personId 중복 노드를 수집
const collectDuplicatePersonIds = (tree) => {
  const seen = {};
  const walk = (node) => {
    if (!node) return;
    const pid = node.personId;
    if (pid && node.id !== 'root') {
      if (!seen[pid]) seen[pid] = { name: node.name, count: 0, nodeId: node.id };
      seen[pid].count += 1;
    }
    (node.heirs || []).forEach(walk);
  };
  walk(tree);
  return Object.entries(seen)
    .filter(([, v]) => v.count > 1)
    .map(([pid, v]) => ({ personId: pid, name: v.name, nodeId: v.nodeId, count: v.count }));
};

export const collectImportValidationIssues = (tree) => {
  const issues = [];

  // 전체 트리 personId 중복 감지 (배우자 탭 간 동일인 이중 입력 등)
  const duplicatePersons = collectDuplicatePersonIds(tree);
  duplicatePersons.forEach(({ personId, name, nodeId, count }) => {
    issues.push({
      personId,
      nodeId,
      targetTabId: personId,
      personName: name || '이름 미상',
      severity: 'warning',
      code: 'duplicate-person',
      message: `인물 중복 — [${name || '이름 미상'}]이(가) 트리 내 ${count}곳에 입력되어 있습니다. 동일인이면 한 곳만 남기고 삭제해 주세요.`,
    });
  });

  // 순환 참조 감지 (DFS)
  const detectCycle = (node, visiting = new Set()) => {
    if (!node) return null;
    const pid = node.personId || node.id;
    if (visiting.has(pid)) return node;
    const next = new Set(visiting);
    next.add(pid);
    for (const heir of node.heirs || []) {
      const found = detectCycle(heir, next);
      if (found) return found;
    }
    return null;
  };
  const cycleNode = detectCycle(tree);
  if (cycleNode) {
    issues.push({
      personId: cycleNode.personId || cycleNode.id,
      nodeId: cycleNode.id,
      targetTabId: cycleNode.personId || cycleNode.id,
      personName: cycleNode.name || '이름 미상',
      severity: 'error',
      code: 'inheritance-cycle',
      message: `순환 참조 — [${cycleNode.name || '이름 미상'}]이 트리 상하위에 중복 연결되어 있습니다. 해당 탭에서 잘못 연결된 상속인을 제거해 주세요.`,
    });
  }

  const walk = (node, inheritedDate = tree?.deathDate || '') => {
    if (!node) return;

    if (node.id !== 'root') {
      if (!node.name?.trim()) {
        issues.push(buildIssue(node, {
          code: 'missing-name',
          message: '이름 누락 — 이름 없이 등록된 상속인이 있습니다. 이름을 입력해 주세요.',
        }));
      }

      if (!VALID_RELATIONS.has(node.relation)) {
        issues.push(buildIssue(node, {
          code: 'invalid-relation',
          message: `관계 오류 — [${node.name || '이름 미상'}]의 관계가 올바르지 않습니다. 관계를 다시 선택해 주세요.`,
        }));
      }
    }

    if (node.isDeceased && !node.deathDate) {
      issues.push(buildIssue(node, {
        code: 'missing-death-date',
        message: `사망일 누락 — [${node.name || '이름 미상'}]. 사망일을 입력해야 계산이 가능합니다.`,
      }));
    }

    const isPredeceased = !!(node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate));
    const isSpouse = SPOUSE_RELATIONS.has(node.relation);
    const hasHeirs = (node.heirs || []).length > 0;

    if (node.id !== 'root' && node.isDeceased && !hasHeirs && !node.successorStatus && !(isSpouse && isPredeceased)) {
      issues.push(buildIssue(node, {
        code: 'missing-descendants',
        message: `후속 상속 미확정 — [${node.name || '이름 미상'}]. 후속 상속인 입력 또는 '없음 확정'을 눌러 주세요.`,
      }));
    }

    const activeSpouses = (node.heirs || []).filter((heir) => {
      if (!SPOUSE_RELATIONS.has(heir.relation)) return false;
      if (heir.isExcluded) return false;
      if (heir.isDeceased && heir.deathDate && node.deathDate && isBefore(heir.deathDate, node.deathDate)) return false;
      return true;
    });

    if (activeSpouses.length > 1) {
      issues.push(buildIssue(node, {
        code: 'multiple-spouses',
        message: `배우자 중복 — [${node.name || '이름 미상'}] 아래에 유효 배우자가 둘 이상 있습니다. 1명만 남기고 나머지를 제외해 주세요.`,
      }));
    }

    // 중복 성명 검사 (같은 부모 아래에서)
    const nameCount = {};
    (node.heirs || []).forEach((heir) => {
      const name = heir.name?.trim();
      if (!name) return;
      nameCount[name] = (nameCount[name] || 0) + 1;
    });
    Object.entries(nameCount).forEach(([name, count]) => {
      if (count > 1) {
        issues.push(buildIssue(node, {
          code: 'duplicate-name',
          severity: 'warning',
          message: `성명 중복 — [${node.name || '피상속인'}] 아래에 [${name}]이(가) ${count}명 입력되어 있습니다. 동일인이면 삭제하고, 실제로 다른 사람이면 '확인 (다른 사람)'을 눌러 주세요.`,
        }));
      }
    });

    (node.heirs || []).forEach((child) => {
      const nextInheritedDate = node.deathDate || inheritedDate;
      walk(child, nextInheritedDate);
    });
  };

  walk(tree, tree?.deathDate || '');
  return issues;
};
