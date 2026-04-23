export const buildEngineWarning = ({
  code = 'engine-warning',
  severity = 'warning',
  blocking = false,
  id = null,
  personId = null,
  targetTabId = null,
  text = '',
}) => ({
  code,
  severity,
  blocking,
  id,
  personId,
  targetTabId: targetTabId || personId || id || null,
  text,
});

export const normalizeWarning = (warning) => {
  if (!warning) return null;

  if (typeof warning !== 'object') {
    return buildEngineWarning({
      text: String(warning),
    });
  }

  const text = warning.text || '';
  let code = warning.code || 'engine-warning';
  let severity = warning.severity || 'warning';
  let blocking = warning.blocking ?? false;

  if (!warning.code) {
    if (text.includes('순환 참조')) {
      code = 'inheritance-cycle';
      severity = 'error';
      blocking = true;
    } else if (text.includes('사망일자')) {
      code = 'missing-death-date';
      severity = 'error';
      blocking = true;
    } else if (text.includes('하위 상속인 정보가 없습니다')) {
      code = 'deceased-without-heirs';
      severity = 'error';
      blocking = true;
    }
  }

  return buildEngineWarning({
    code,
    severity,
    blocking,
    id: warning.id || null,
    personId: warning.personId || warning.id || null,
    targetTabId: warning.targetTabId || warning.personId || warning.id || null,
    text,
  });
};

export const dedupeWarnings = (warnings) => {
  const uniqueWarnings = [];
  const warningKeys = new Set();

  warnings.forEach((warning) => {
    const normalized = normalizeWarning(warning);
    if (!normalized) return;

    const key = [normalized.code, normalized.id, normalized.text].join('::');
    if (warningKeys.has(key)) return;

    warningKeys.add(key);
    uniqueWarnings.push(normalized);
  });

  return uniqueWarnings;
};

export const buildInheritanceCycleWarning = ({ node }) => buildEngineWarning({
  code: 'inheritance-cycle',
  severity: 'error',
  blocking: true,
  id: node.id,
  personId: node.personId || node.id,
  targetTabId: node.personId || node.id,
  text: `순차상속 순환 참조가 발생하여 [${node.name || '상속인'}]의 지분 전이가 중단되었습니다. 본인이나 조상 계통이 다시 하위 상속인으로 연결되었는지 확인하고, 잘못 연결된 상속인 입력을 제거해 주세요.`,
});

export const buildMissingPrimaryHojuWarning = ({ node, getPersonKey }) => buildEngineWarning({
  code: 'missing-primary-hoju-successor',
  severity: 'warning',
  blocking: false,
  id: node.id || null,
  personId: getPersonKey(node) || null,
  targetTabId: node.id || null,
  text: `[${node.name || '피상속인'}]은(는) 호주입니다. 1차 상속인들의 호주 여부를 확인하세요.`,
});

export const buildIneligibleSubstitutionWarning = ({ node, contextDate, children, getPersonKey }) => {
  const childNames = children
    .map((child) => `[${child?.name || '이름 미상'}]`)
    .join(', ');

  return buildEngineWarning({
    code: 'ineligible-substitution-heirs',
    severity: 'warning',
    blocking: false,
    id: node.id || null,
    personId: getPersonKey(node) || null,
    targetTabId: node.personId || node.id || null,
    text: `[${node.name || '이름 미상'}]의 하위 상속인 ${childNames || '[이름 미상]'}은(는) 법적으로 대습상속인이 될 수 없어 이 가지는 제외됩니다. 해당 몫은 같은 단계의 다른 공동상속인 기준으로 다시 계산됩니다.`,
    contextDate,
  });
};
