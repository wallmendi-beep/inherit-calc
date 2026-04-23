import { describe, expect, it } from 'vitest';
import { assignHeirShare, determineActiveRank } from './distribution.js';

const isBefore = (left, right) => new Date(left) < new Date(right);

describe('distribution helpers', () => {
  it('detects direct descendants as the active rank over spouse and siblings', () => {
    const activeRank = determineActiveRank([
      { relation: 'wife' },
      { relation: 'sibling' },
      { relation: 'son' },
    ]);

    expect(activeRank).toBe(1);
  });

  it('applies legacy daughter reduction under the 1960 law', () => {
    const share = assignHeirShare(
      {
        relation: 'daughter',
        isSameRegister: false,
      },
      {
        activeRank: 1,
        distributionDate: '1975-06-01',
        inheritedDate: '1975-06-01',
        isBefore,
        isDisqualifiedOrLost: false,
        isSubstitution: false,
        law: '1960',
        node: { id: 'root', relation: 'root' },
        hojuContext: {},
        canApplyHojuBonus: () => false,
        getHojuBonusReason: () => '',
      }
    );

    expect(share).toEqual({
      shareWeight: 0.25,
      exclusionReason: '',
      modifierReason: '출가녀 감산 (남자의 1/4)',
    });
  });

  it('applies hoju bonus to a qualifying son under the 1979 law', () => {
    const share = assignHeirShare(
      {
        relation: 'son',
      },
      {
        activeRank: 1,
        distributionDate: '1987-06-01',
        inheritedDate: '1987-06-01',
        isBefore,
        isDisqualifiedOrLost: false,
        isSubstitution: false,
        law: '1979',
        node: { id: 'root', relation: 'root' },
        hojuContext: { isSubstitution: false },
        canApplyHojuBonus: () => true,
        getHojuBonusReason: () => '호주상속 5할 가산',
      }
    );

    expect(share).toEqual({
      shareWeight: 1.5,
      exclusionReason: '',
      modifierReason: '호주상속 5할 가산',
    });
  });

  it('excludes siblings when spouse-only inheritance is active', () => {
    const share = assignHeirShare(
      {
        relation: 'sibling',
      },
      {
        activeRank: -1,
        distributionDate: '2024-01-01',
        inheritedDate: '2024-01-01',
        isBefore,
        isDisqualifiedOrLost: false,
        isSubstitution: false,
        law: '1991',
        node: { id: 'root', relation: 'root' },
        hojuContext: {},
        canApplyHojuBonus: () => false,
        getHojuBonusReason: () => '',
      }
    );

    expect(share).toEqual({
      shareWeight: 0,
      exclusionReason: '배우자 단독 상속으로 형제자매 상속권 없음',
      modifierReason: '',
    });
  });
});
