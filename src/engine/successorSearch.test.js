import { describe, expect, it } from 'vitest';
import { findGlobalSuccessors, findHeirsByName } from './successorSearch.js';

describe('successorSearch helpers', () => {
  it('borrows heirs from another node with the same name', () => {
    const tree = {
      id: 'root',
      name: 'Root',
      heirs: [
        {
          id: 'target',
          name: 'KimYoungHee',
          heirs: [],
        },
        {
          id: 'source',
          name: 'KimYoungHee',
          heirs: [{ id: 'c1', name: 'BorrowedChild', relation: 'son' }],
        },
      ],
    };

    expect(findHeirsByName(tree, 'KimYoungHee', 'target')).toEqual([
      { id: 'c1', name: 'BorrowedChild', relation: 'son' },
    ]);
  });

  it('finds siblings as next-order successors when a branch has no direct heirs', () => {
    const tree = {
      id: 'root',
      heirs: [
        {
          id: 'parent',
          heirs: [
            { id: 'target', name: 'LateSibling', relation: 'son', heirs: [] },
            { id: 's1', name: 'YoungerBrother', relation: 'son', heirs: [] },
            { id: 'd1', name: 'OlderSister', relation: 'daughter', heirs: [] },
          ],
        },
      ],
    };

    const result = findGlobalSuccessors(tree, { id: 'target' });

    expect(result).toEqual([
      { id: 's1', name: 'YoungerBrother', relation: 'sibling', heirs: [], _origRelation: 'son' },
      { id: 'd1', name: 'OlderSister', relation: 'sibling', heirs: [], _origRelation: 'daughter' },
    ]);
  });
});
