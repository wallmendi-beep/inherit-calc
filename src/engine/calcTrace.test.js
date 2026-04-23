import { describe, expect, it } from 'vitest';
import { mergeCalcSteps } from './calcTrace.js';
import { math } from './utils.js';

describe('calcTrace helpers', () => {
  it('merges repeated decedent steps and recalculates distribution numerators', () => {
    const person = { id: 'p1', name: 'Child' };
    const heirA = { id: 'h1', name: 'HeirA', r: 1 };
    const heirB = { id: 'h2', name: 'HeirB', r: 1 };

    const { mergedSteps, stepByPersonId } = mergeCalcSteps([
      {
        dec: person,
        inN: 1,
        inD: 4,
        lawEra: '1991',
        parentDecName: 'ParentA',
        dists: [
          { h: heirA, n: 1, d: 8, sn: 1, sd: 2, rSnap: 1 },
          { h: heirB, n: 1, d: 8, sn: 1, sd: 2, rSnap: 1 },
        ],
      },
      {
        dec: person,
        inN: 1,
        inD: 4,
        lawEra: '1991',
        parentDecName: 'ParentB',
        dists: [
          { h: heirA, n: 1, d: 8, sn: 1, sd: 2, rSnap: 1 },
          { h: heirB, n: 1, d: 8, sn: 1, sd: 2, rSnap: 1 },
        ],
      },
    ], {
      getPersonKey: (value) => value.id,
      math,
    });

    expect(mergedSteps).toHaveLength(1);
    expect(stepByPersonId.p1.inN).toBe(1);
    expect(stepByPersonId.p1.inD).toBe(2);
    expect(stepByPersonId.p1.mergeSources).toHaveLength(2);
    expect(stepByPersonId.p1.dists.map((dist) => `${dist.h.name}:${dist.n}/${dist.d}`)).toEqual([
      'HeirA:1/4',
      'HeirB:1/4',
    ]);
  });
});
