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

export const collectImportValidationIssues = (tree) => {
  const issues = [];
  const seenPersonIds = new Set();

  const walk = (node, inheritedDate = tree?.deathDate || '') => {
    if (!node) return;

    if (node.id !== 'root') {
      if (!node.name?.trim()) {
        issues.push(buildIssue(node, {
          code: 'missing-name',
          message: '이름이 비어 있는 상속인이 있습니다.',
        }));
      }

      if (!VALID_RELATIONS.has(node.relation)) {
        issues.push(buildIssue(node, {
          code: 'invalid-relation',
          message: `[${node.name || '이름 미상'}]의 관계값이 올바르지 않습니다.`,
        }));
      }
    }

    if (node.personId) {
      if (seenPersonIds.has(node.personId)) {
        issues.push(buildIssue(node, {
          code: 'duplicate-person-id',
          message: `[${node.name || '이름 미상'}]의 personId가 중복되어 있습니다.`,
        }));
      } else {
        seenPersonIds.add(node.personId);
      }
    }

    if (node.isDeceased && !node.deathDate) {
      issues.push(buildIssue(node, {
        code: 'missing-death-date',
        message: `[${node.name || '이름 미상'}]은(는) 사망자로 입력되었지만 사망일이 없습니다.`,
      }));
    }

    const isPredeceased = !!(node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate));
    const isSpouse = SPOUSE_RELATIONS.has(node.relation);
    const hasHeirs = (node.heirs || []).length > 0;

    if (node.id !== 'root' && node.isDeceased && !hasHeirs && !(isSpouse && isPredeceased)) {
      issues.push(buildIssue(node, {
        code: 'missing-descendants',
        message: `[${node.name || '이름 미상'}]은(는) 사망자인데 하위상속인이 비어 있습니다.`,
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
        message: `[${node.name || '이름 미상'}] 아래에 유효한 배우자가 둘 이상 있습니다.`,
      }));
    }

    (node.heirs || []).forEach((child) => {
      const nextInheritedDate = node.deathDate || inheritedDate;
      walk(child, nextInheritedDate);
    });
  };

  walk(tree, tree?.deathDate || '');
  return issues;
};

