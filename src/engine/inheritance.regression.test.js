import { describe, expect, it } from 'vitest';
import { calculateInheritance } from './inheritance.js';

const flattenShares = (result) => [
  ...(result.finalShares.direct || []),
  ...(result.finalShares.subGroups || []).flatMap((group) => group.shares || []),
];

describe('inheritance regression guardrails', () => {
  it('keeps the 1975 legacy family distribution stable', () => {
    const tree = {
      id: 'root',
      name: 'KimGapSu',
      isDeceased: true,
      deathDate: '1975-06-01',
      shareN: 1,
      shareD: 1,
      isHoju: true,
      heirs: [
        { id: 'w1', name: 'LeeSoonJa', relation: 'wife', isDeceased: false, heirs: [] },
        {
          id: 's1',
          name: 'KimDaeHan',
          relation: 'son',
          isHoju: true,
          isDeceased: false,
          heirs: [],
        },
        {
          id: 's2',
          name: 'KimMinGuk',
          relation: 'son',
          isDeceased: false,
          heirs: [],
        },
        {
          id: 'd1',
          name: 'KimYoungHee',
          relation: 'daughter',
          isDeceased: false,
          isSameRegister: false,
          heirs: [],
        },
      ],
    };

    const result = calculateInheritance(tree, 0, { includeCalcSteps: true });
    const directShares = Object.fromEntries(
      (result.finalShares.direct || []).map((share) => [share.name, `${share.n}/${share.d}`])
    );
    const stepSummary = (result.calcSteps || []).map((step) => ({
      decedent: step.dec?.name,
      lawEra: step.lawEra,
      dists: (step.dists || []).map((dist) => ({
        name: dist.h?.name,
        share: `${dist.sn || 0}/${dist.sd || 1}`,
        mod: dist.mod || '',
        ex: dist.ex || '',
      })),
    }));

    expect(directShares).toEqual({
      LeeSoonJa: '2/13',
      KimDaeHan: '6/13',
      KimMinGuk: '4/13',
      KimYoungHee: '1/13',
    });

    expect(stepSummary).toEqual([
      {
        decedent: 'KimGapSu',
        lawEra: '1960',
        dists: [
          { name: 'LeeSoonJa', share: '2/13', mod: '처 감산 (직계비속의 1/2)', ex: '' },
          { name: 'KimDaeHan', share: '6/13', mod: '호주상속 5할 가산', ex: '' },
          { name: 'KimMinGuk', share: '4/13', mod: '', ex: '' },
          { name: 'KimYoungHee', share: '1/13', mod: '출가녀 감산 (남자의 1/4)', ex: '' },
        ],
      },
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.integrity.hasTotalMismatch).toBe(false);
  });

  it('keeps the blocked son-in-law branch warning and calc trace stable', () => {
    const tree = {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '1995-10-10',
      shareN: 1,
      shareD: 1,
      heirs: [
        {
          id: 'd1',
          name: 'LateDaughter',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '1985-05-05',
          heirs: [{ id: 'h1', name: 'SonInLaw', relation: 'husband', isDeceased: false, heirs: [] }],
        },
        { id: 's1', name: 'LivingSon', relation: 'son', isDeceased: false, heirs: [] },
      ],
    };

    const result = calculateInheritance(tree, 0, { includeCalcSteps: true });
    const allShares = flattenShares(result);
    const warningSummary = (result.warnings || []).map((warning) => ({
      code: warning.code,
      targetTabId: warning.targetTabId,
      text: warning.text,
    }));
    const stepSummary = (result.calcSteps || []).map((step) => ({
      decedent: step.dec?.name,
      dists: (step.dists || []).map((dist) => ({
        name: dist.h?.name,
        n: dist.n,
        d: dist.d,
        sn: dist.sn || 0,
        sd: dist.sd || 1,
      })),
    }));

    expect(allShares.map((share) => `${share.name}:${share.n}/${share.d}`)).toEqual(['LivingSon:1/1']);
    expect(warningSummary).toEqual([
      {
        code: 'ineligible-substitution-heirs',
        targetTabId: 'd1',
        text: '[LateDaughter]의 하위 상속인 [SonInLaw]은(는) 법적으로 대습상속인이 될 수 없어 이 가지는 제외됩니다. 해당 몫은 같은 단계의 다른 공동상속인 기준으로 다시 계산됩니다.',
      },
    ]);
    expect(stepSummary).toEqual([
      {
        decedent: 'Root',
        dists: [{ name: 'LivingSon', n: 1, d: 1, sn: 1, sd: 1 }],
      },
    ]);
    expect(result.status).toBe('partial');
    expect(result.integrity.hasTotalMismatch).toBe(false);
  });

  it('does not exclude living heirs when a stale empty exclusion flag remains', () => {
    const tree = {
      id: 'root',
      name: 'KimMyungNam',
      isDeceased: true,
      deathDate: '1978-08-05',
      shareN: 1,
      shareD: 1,
      heirs: [
        { id: 'h1', personId: 'h1', name: 'YoonJongOk', relation: 'husband', isDeceased: false, heirs: [] },
        { id: 's1', personId: 's1', name: 'YoonWooYoung', relation: 'son', isDeceased: false, heirs: [] },
        {
          id: 'd1',
          personId: 'd1',
          name: 'YoonJungHee',
          relation: 'daughter',
          isDeceased: false,
          isExcluded: true,
          exclusionOption: '',
          isSameRegister: false,
          heirs: [],
        },
        {
          id: 's2',
          personId: 's2',
          name: 'YoonWooSung',
          relation: 'son',
          isDeceased: false,
          isExcluded: true,
          exclusionOption: '',
          isHoju: true,
          heirs: [],
        },
      ],
    };

    const result = calculateInheritance(tree, 0, { includeCalcSteps: true });
    const allShares = flattenShares(result);

    expect(allShares.map((share) => `${share.name}:${share.n}/${share.d}`)).toEqual([
      'YoonJongOk:4/15',
      'YoonWooYoung:4/15',
      'YoonJungHee:1/15',
      'YoonWooSung:2/5',
    ]);
    expect(result.integrity.hasTotalMismatch).toBe(false);
  });

  it('keeps separate substitution groups for personId-less branches', () => {
    const tree = {
      id: 'root',
      name: 'Root',
      isDeceased: true,
      deathDate: '1987-06-01',
      shareN: 1,
      shareD: 1,
      heirs: [
        {
          id: 's1',
          name: 'BranchA',
          relation: 'son',
          isDeceased: true,
          deathDate: '1983-01-01',
          heirs: [{ id: 's1c1', name: 'AChild', relation: 'son', isDeceased: false, heirs: [] }],
        },
        {
          id: 's2',
          name: 'BranchB',
          relation: 'son',
          isDeceased: true,
          deathDate: '1984-01-01',
          heirs: [{ id: 's2c1', name: 'BChild', relation: 'son', isDeceased: false, heirs: [] }],
        },
      ],
    };

    const result = calculateInheritance(tree, 0, { includeCalcSteps: true });
    const subGroups = (result.finalShares.subGroups || []).map((group) => ({
      ancestor: group.ancestor?.name,
      shares: (group.shares || []).map((share) => `${share.name}:${share.n}/${share.d}`),
    }));

    expect(subGroups).toEqual([
      { ancestor: 'BranchA', shares: ['AChild:1/2'] },
      { ancestor: 'BranchB', shares: ['BChild:1/2'] },
    ]);
    expect(result.integrity.hasTotalMismatch).toBe(false);
  });

  it('keeps calc steps separate when the same person is evaluated in different event contexts', () => {
    const makeJung = (id) => ({
      id,
      personId: 'jung-mun-ja',
      name: 'JungMunJa',
      relation: 'daughter',
      isDeceased: true,
      deathDate: '1986-02-26',
      heirs: [],
    });
    const tree = {
      id: 'root',
      personId: 'root',
      name: 'KimHyukJo',
      isDeceased: true,
      deathDate: '1967-10-27',
      heirs: [
        {
          id: 'kms-root',
          personId: 'kim-myung-su',
          name: 'KimMyungSu',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '1972-11-22',
          heirs: [
            makeJung('jung-root'),
            { id: 'alive-root', personId: 'alive-root', name: 'AliveRoot', relation: 'son', isDeceased: false, heirs: [] },
          ],
        },
        {
          id: 'gu',
          personId: 'gu-su-myeong',
          name: 'GuSuMyeong',
          relation: 'wife',
          isDeceased: true,
          deathDate: '1990-07-03',
          heirs: [
            {
              id: 'kms-gu',
              personId: 'kim-myung-su',
              name: 'KimMyungSu',
              relation: 'daughter',
              isDeceased: true,
              deathDate: '1972-11-22',
              heirs: [
                makeJung('jung-gu'),
                { id: 'alive-gu', personId: 'alive-gu', name: 'AliveGu', relation: 'son', isDeceased: false, heirs: [] },
              ],
            },
          ],
        },
      ],
    };

    const result = calculateInheritance(tree, 0, { includeCalcSteps: true });
    const kimMyungSuSteps = (result.calcSteps || []).filter((step) => step.dec?.personId === 'kim-myung-su');

    expect(kimMyungSuSteps.map((step) => ({
      from: step.parentDecName,
      inheritedDate: step.inheritedDate,
      distributionDate: step.distributionDate,
      isSubstitution: step.isSubstitution,
      dists: (step.dists || []).map((dist) => dist.h?.name),
    }))).toEqual([
      {
        from: 'KimHyukJo',
        inheritedDate: '1967-10-27',
        distributionDate: '1972-11-22',
        isSubstitution: false,
        dists: ['JungMunJa', 'AliveRoot'],
      },
      {
        from: 'GuSuMyeong',
        inheritedDate: '1990-07-03',
        distributionDate: '1990-07-03',
        isSubstitution: true,
        dists: ['AliveGu'],
      },
    ]);
  });
});
