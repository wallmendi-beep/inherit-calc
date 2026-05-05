import { describe, expect, it } from 'vitest';
import { calculateInheritance } from './inheritance.js';
import { math } from './utils.js';

const flattenFinalShares = (finalShares) => [
  ...(finalShares?.direct || []),
  ...(finalShares?.subGroups || []).flatMap((group) => group.shares || []),
];

const addShares = (shares) => shares.reduce(
  ([totalN, totalD], share) => math.add(totalN, totalD, share.n, share.d),
  [0, 1]
);

const completeCaseTrees = [
  {
    name: 'modern spouse and two children',
    tree: {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '2020-01-01',
      shareN: 1,
      shareD: 1,
      heirs: [
        { id: 'w1', personId: 'w1', name: 'Wife', relation: 'wife', isDeceased: false, heirs: [] },
        { id: 's1', personId: 's1', name: 'Son', relation: 'son', isDeceased: false, heirs: [] },
        { id: 'd1', personId: 'd1', name: 'Daughter', relation: 'daughter', isDeceased: false, heirs: [] },
      ],
    },
  },
  {
    name: 'legacy hoju and married daughter',
    tree: {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '1975-06-01',
      shareN: 1,
      shareD: 1,
      isHoju: true,
      heirs: [
        { id: 'w1', personId: 'w1', name: 'Wife', relation: 'wife', isDeceased: false, heirs: [] },
        { id: 's1', personId: 's1', name: 'HojuSon', relation: 'son', isHoju: true, isDeceased: false, heirs: [] },
        { id: 's2', personId: 's2', name: 'Son', relation: 'son', isDeceased: false, heirs: [] },
        { id: 'd1', personId: 'd1', name: 'MarriedDaughter', relation: 'daughter', isSameRegister: false, isDeceased: false, heirs: [] },
      ],
    },
  },
  {
    name: 'multi-step substitution',
    tree: {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '2020-01-01',
      shareN: 1,
      shareD: 1,
      heirs: [
        {
          id: 's1',
          personId: 's1',
          name: 'PredeceasedSon',
          relation: 'son',
          isDeceased: true,
          deathDate: '2019-01-01',
          heirs: [
            { id: 'w1', personId: 'w1', name: 'DaughterInLaw', relation: 'wife', isDeceased: false, heirs: [] },
            {
              id: 'gd1',
              personId: 'gd1',
              name: 'PredeceasedGranddaughter',
              relation: 'daughter',
              isDeceased: true,
              deathDate: '2018-01-01',
              heirs: [
                { id: 'ggs1', personId: 'ggs1', name: 'GreatGrandson', relation: 'son', isDeceased: false, heirs: [] },
              ],
            },
          ],
        },
      ],
    },
  },
];

describe('inheritance result invariants', () => {
  completeCaseTrees.forEach(({ name, tree }) => {
    it(`${name}: final shares are structurally safe`, () => {
      const result = calculateInheritance(tree);
      const shares = flattenFinalShares(result.finalShares);
      const [totalN, totalD] = addShares(shares);

      expect(result.integrity.hasTotalMismatch).toBe(false);
      expect(`${totalN}/${totalD}`).toBe('1/1');
      expect(result.integrity.hasDeceasedInFinalShares).toBe(false);

      shares.forEach((share) => {
        expect(Number.isFinite(share.n)).toBe(true);
        expect(Number.isFinite(share.d)).toBe(true);
        expect(share.n).toBeGreaterThan(0);
        expect(share.d).toBeGreaterThan(0);
        expect(math.gcd(share.n, share.d)).toBe(1);
        expect(share.isDeceased).toBe(false);
      });
    });
  });

  it('excluded heirs with renunciation do not receive final shares', () => {
    const tree = {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '2020-01-01',
      shareN: 1,
      shareD: 1,
      heirs: [
        { id: 's1', personId: 's1', name: 'RenouncedSon', relation: 'son', isDeceased: false, isExcluded: true, exclusionOption: 'renounce', heirs: [] },
        { id: 's2', personId: 's2', name: 'LivingSon', relation: 'son', isDeceased: false, heirs: [] },
      ],
    };

    const result = calculateInheritance(tree);
    const shares = flattenFinalShares(result.finalShares);

    expect(shares.some((share) => share.personId === 's1')).toBe(false);
    expect(shares.map((share) => `${share.personId}:${share.n}/${share.d}`)).toEqual(['s2:1/1']);
  });
});
