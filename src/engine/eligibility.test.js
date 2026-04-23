import { describe, expect, it } from 'vitest';
import {
  isEligibleSubstitutionHeir,
  isRenouncedHeir,
  isSpouseRelation,
  isSubstitutionTrigger,
} from './eligibility.js';

const isBefore = (left, right) => new Date(left) < new Date(right);

describe('eligibility helpers', () => {
  it('blocks a pre-1991 husband-only substitution heir under a daughter branch', () => {
    const ancestor = {
      relation: 'daughter',
      deathDate: '1985-05-05',
    };
    const child = {
      relation: 'husband',
    };

    expect(isEligibleSubstitutionHeir(child, ancestor, '1995-10-10', { isBefore })).toBe(false);
  });

  it('treats predeceased spouses as non-substitution heirs', () => {
    const spouse = {
      relation: 'wife',
      isDeceased: true,
      deathDate: '1980-01-01',
    };

    const result = isRenouncedHeir(spouse, '1990-01-01', {
      isBefore,
      isSpouseRelation,
      getQualifiedSubstitutionHeirs: () => [{ id: 'c1' }],
    });

    expect(result).toBe(true);
    expect(isSubstitutionTrigger(spouse, { isSpouseRelation })).toBe(false);
  });
});
