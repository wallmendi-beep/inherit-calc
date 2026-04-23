import { describe, expect, it } from 'vitest';
import {
  buildIneligibleSubstitutionWarning,
  dedupeWarnings,
  normalizeWarning,
} from './warningFactory.js';

describe('warningFactory helpers', () => {
  it('normalizes plain-text cycle warnings into blocking engine warnings', () => {
    const warning = normalizeWarning('순환 참조가 발생했습니다');

    expect(warning).toEqual({
      code: 'engine-warning',
      severity: 'warning',
      blocking: false,
      id: null,
      personId: null,
      targetTabId: null,
      text: '순환 참조가 발생했습니다',
    });
  });

  it('deduplicates warnings by code, id, and text', () => {
    const warnings = dedupeWarnings([
      { code: 'a', id: '1', text: 'same' },
      { code: 'a', id: '1', text: 'same' },
      { code: 'a', id: '2', text: 'other' },
    ]);

    expect(warnings).toHaveLength(2);
  });

  it('builds the blocked substitution branch warning text', () => {
    const warning = buildIneligibleSubstitutionWarning({
      node: { id: 'd1', name: 'LateDaughter' },
      contextDate: '1995-10-10',
      children: [{ name: 'SonInLaw' }],
      getPersonKey: (person) => person.id,
    });

    expect(warning.code).toBe('ineligible-substitution-heirs');
    expect(warning.targetTabId).toBe('d1');
    expect(warning.text).toContain('[LateDaughter]');
    expect(warning.text).toContain('[SonInLaw]');
  });
});
