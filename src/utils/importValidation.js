import { isBefore } from '../engine/utils';

const SPOUSE_RELATIONS = new Set(['wife', 'husband', 'spouse']);
const VALID_RELATIONS = new Set(['wife', 'husband', 'spouse', 'son', 'daughter', 'parent', 'sibling']);

export const collectImportValidationIssues = (tree) => {
  const issues = [];
  const seenPersonIds = new Set();

  const walk = (node, parent = null, inheritedDate = tree?.deathDate || '') => {
    if (!node) return;

    if (node.id !== 'root') {
      if (!node.name?.trim()) {
        issues.push({
          code: 'missing-name',
          severity: 'warning',
          message: '이름이 비어 있는 상속인이 있습니다.',
          personName: '이름 미상',
          nodeId: node.id,
        });
      }

      if (!VALID_RELATIONS.has(node.relation)) {
        issues.push({
          code: 'invalid-relation',
          severity: 'warning',
          message: `[${node.name || '이름 미상'}]의 관계값이 올바르지 않습니다.`,
          personName: node.name || '이름 미상',
          nodeId: node.id,
        });
      }
    }

    if (node.personId) {
      if (seenPersonIds.has(node.personId)) {
        issues.push({
          code: 'duplicate-person-id',
          severity: 'warning',
          message: `[${node.name || '이름 미상'}]의 personId가 중복되어 있습니다.`,
          personName: node.name || '이름 미상',
          nodeId: node.id,
        });
      } else {
        seenPersonIds.add(node.personId);
      }
    }

    if (node.isDeceased && !node.deathDate) {
      issues.push({
        code: 'missing-death-date',
        severity: 'warning',
        message: `[${node.name || '이름 미상'}]이(가) 사망으로 입력되었지만 사망일이 없습니다.`,
        personName: node.name || '이름 미상',
        nodeId: node.id,
      });
    }

    const isPredeceased = !!(node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate));
    const isSpouse = SPOUSE_RELATIONS.has(node.relation);
    const hasHeirs = (node.heirs || []).length > 0;

    if (node.id !== 'root' && node.isDeceased && !hasHeirs) {
      if (!(isSpouse && isPredeceased)) {
        issues.push({
          code: 'missing-descendants',
          severity: 'warning',
          message: `[${node.name || '이름 미상'}]은(는) 사망자로 입력되었지만 하위상속인이 비어 있습니다.`,
          personName: node.name || '이름 미상',
          nodeId: node.id,
        });
      }
    }

    const activeSpouses = (node.heirs || []).filter((heir) => {
      if (!SPOUSE_RELATIONS.has(heir.relation)) return false;
      if (heir.isExcluded) return false;
      if (heir.isDeceased && heir.deathDate && node.deathDate && isBefore(heir.deathDate, node.deathDate)) return false;
      return true;
    });

    if (activeSpouses.length > 1) {
      issues.push({
        code: 'multiple-spouses',
        severity: 'warning',
        message: `[${node.name || '이름 미상'}] 아래에 유효한 배우자가 둘 이상 있습니다.`,
        personName: node.name || '이름 미상',
        nodeId: node.id,
      });
    }

    (node.heirs || []).forEach((child) => {
      const nextInheritedDate = node.deathDate || inheritedDate;
      walk(child, node, nextInheritedDate);
    });
  };

  walk(tree, null, tree?.deathDate || '');
  return issues;
};

export const buildImportValidationMessage = (issues = []) => {
  if (!issues.length) return '';
  const lines = issues.slice(0, 6).map((issue) => `- ${issue.message}`);
  const extra = issues.length > 6 ? `\n- 그 외 ${issues.length - 6}건` : '';
  return `불러오기 데이터에서 확인이 필요한 항목이 발견되었습니다.\n\n${lines.join('\n')}${extra}\n\n다시 입력을 권장합니다. 그래도 불러오시겠습니까?`;
};

