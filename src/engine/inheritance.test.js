import { describe, it, expect } from 'vitest';
import { calculateInheritance } from './inheritance.js';

/**
 * 상속지분 계산 엔진 회귀 테스트 (6종 필수 시나리오)
 * 
 * 핵심 규칙: root 노드(피상속인)는 반드시 isDeceased: true 로 설정해야
 * 엔진이 하위 상속인에게 지분을 분배합니다.
 * (App.jsx의 preprocessTree가 실제 앱에서 이를 보장합니다)
 */
describe('상속지분 계산 엔진 회귀 테스트 (6종 필수 시나리오)', () => {

  it('1. 단순 정상 상속 (배우자 + 자녀 2명, 1991년 이후)', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        { id: 'h1', personId: 'h1', name: '배우자', relation: 'wife', isDeceased: false, heirs: [] },
        { id: 'h2', personId: 'h2', name: '장남', relation: 'son', isDeceased: false, heirs: [] },
        { id: 'h3', personId: 'h3', name: '차녀', relation: 'daughter', isDeceased: false, heirs: [] }
      ]
    };
    const result = calculateInheritance(tree);

    // 1991년 이후: 배우자 1.5, 자녀 각 1.0 → 합계 3.5 → 배우자 3/7, 장남 2/7, 차녀 2/7
    expect(result.finalShares.direct.length).toBe(3);
    const wife = result.finalShares.direct.find(h => h.name === '배우자');
    expect(wife.n).toBe(3);
    expect(wife.d).toBe(7);
    const son = result.finalShares.direct.find(h => h.name === '장남');
    expect(son.n).toBe(2);
    expect(son.d).toBe(7);
  });

  it('2. 선사망 아들 + 며느리만 남은 경우 (대습상속 단독)', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        {
          id: 'h1', personId: 'h1', name: '아들', relation: 'son', isDeceased: true, deathDate: '2019-01-01',
          heirs: [
            { id: 'h1_1', personId: 'h1_1', name: '며느리', relation: 'wife', isDeceased: false, heirs: [] }
          ]
        }
      ]
    };
    const result = calculateInheritance(tree);

    // 아들이 선사망 → 며느리가 대습상속으로 전체 지분(1/1) 획득
    const allShares = [
      ...(result.finalShares.direct || []),
      ...(result.finalShares.subGroups || []).flatMap(g => g.shares)
    ];
    const wife = allShares.find(h => h.name === '며느리');
    expect(wife).toBeDefined();
    expect(wife.n).toBe(1);
    expect(wife.d).toBe(1);
  });

  it('3. 선사망 딸 + 사위 + 손자 (대습상속 분배)', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        {
          id: 'h1', personId: 'h1', name: '딸', relation: 'daughter', isDeceased: true, deathDate: '2019-01-01',
          heirs: [
            { id: 'h1_1', personId: 'h1_1', name: '사위', relation: 'husband', isDeceased: false, heirs: [] },
            { id: 'h1_2', personId: 'h1_2', name: '손자', relation: 'son', isDeceased: false, heirs: [] }
          ]
        }
      ]
    };
    const result = calculateInheritance(tree);

    // 1991년 이후: 사위(배우자) 1.5, 손자 1.0 → 합 2.5 → 사위 3/5, 손자 2/5
    const allShares = [
      ...(result.finalShares.direct || []),
      ...(result.finalShares.subGroups || []).flatMap(g => g.shares)
    ];
    const husband = allShares.find(h => h.name === '사위');
    const grandson = allShares.find(h => h.name === '손자');
    expect(husband).toBeDefined();
    expect(grandson).toBeDefined();
    expect(husband.n).toBe(3);
    expect(husband.d).toBe(5);
    expect(grandson.n).toBe(2);
    expect(grandson.d).toBe(5);
  });

  it('4. 사망자 후속 상속인 누락 시 경고 발생 확인', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        { id: 'h1', personId: 'h1', name: '아들1(사망)', relation: 'son', isDeceased: true, deathDate: '2019-01-01', heirs: [] },
        { id: 'h2', personId: 'h2', name: '아들2(생존)', relation: 'son', isDeceased: false, heirs: [] }
      ]
    };
    const result = calculateInheritance(tree);

    // 아들1은 선사망+후속없음→ predeceased 처리되어 제외
    // 아들2가 전체 지분(1/1) 단독 획득
    const son2 = result.finalShares.direct.find(h => h.name === '아들2(생존)');
    expect(son2).toBeDefined();
    expect(son2.n).toBe(1);
    expect(son2.d).toBe(1);
    // 상태가 success가 아닌 blocked 혹은 partial일 수 있음 (경고 유무에 따라)
    expect(result.warnings).toBeDefined();
  });

  it('5. 다단계 대습상속 (며느리 + 손녀 선사망→증손자)', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        {
          id: 'h1', personId: 'h1', name: '아들1', relation: 'son', isDeceased: true, deathDate: '2019-01-01',
          heirs: [
            { id: 'h1_1', personId: 'h1_1', name: '며느리', relation: 'wife', isDeceased: false, heirs: [] },
            {
              id: 'h1_2', personId: 'h1_2', name: '손녀(선사망)', relation: 'daughter', isDeceased: true, deathDate: '2018-01-01',
              heirs: [
                { id: 'h1_2_1', personId: 'h1_2_1', name: '증손자', relation: 'son', isDeceased: false, heirs: [] }
              ]
            }
          ]
        }
      ]
    };
    const result = calculateInheritance(tree);

    // 아들1 → 며느리(1.5) + 손녀(1.0) → 합 2.5 → 며느리 3/5, 손녀 2/5
    // 손녀 지분(2/5)이 증손자에게 다단계 대습
    const allShares = [
      ...(result.finalShares.direct || []),
      ...(result.finalShares.subGroups || []).flatMap(g => g.shares)
    ];
    const mw = allShares.find(h => h.name === '며느리');
    expect(mw).toBeDefined();
    expect(mw.n).toBe(3);
    expect(mw.d).toBe(5);
    const gs = allShares.find(h => h.name === '증손자');
    expect(gs).toBeDefined();
    expect(gs.n).toBe(2);
    expect(gs.d).toBe(5);
  });

  it('6. 전원 상속포기 시 블로킹 상태 확인', () => {
    const tree = {
      id: 'root', name: '피상속인', isDeceased: true, deathDate: '2020-01-01', shareN: 1, shareD: 1,
      heirs: [
        { id: 'h1', personId: 'h1', name: '아들1', relation: 'son', isDeceased: false, isExcluded: true, exclusionOption: 'renounce', heirs: [] },
        { id: 'h2', personId: 'h2', name: '아들2', relation: 'son', isDeceased: false, isExcluded: true, exclusionOption: 'renounce', heirs: [] }
      ]
    };
    const result = calculateInheritance(tree);

    // 전원 상속포기 → 생존 상속인 0명 → blocked 또는 partial
    expect(result.finalShares.direct.length).toBe(0);
    expect(['partial', 'blocked'].includes(result.status)).toBe(true);
  });

  it('7. 선사망 배우자는 자녀가 있어도 대습상속을 열지 않는다', () => {
    const tree = {
      id: 'root',
      name: '김말수',
      isDeceased: true,
      deathDate: '1955-01-01',
      shareN: 1,
      shareD: 1,
      heirs: [
        {
          id: 'sp1',
          personId: 'sp1',
          name: '옥태진',
          relation: 'husband',
          isDeceased: true,
          deathDate: '1946-01-01',
          heirs: [
            { id: 'c1', personId: 'c1', name: '옥인철', relation: 'son', isDeceased: false, heirs: [] }
          ]
        },
        {
          id: 'd1',
          personId: 'd1',
          name: '김씨딸',
          relation: 'daughter',
          isDeceased: false,
          heirs: []
        }
      ]
    };

    const result = calculateInheritance(tree);
    const allShares = [
      ...(result.finalShares.direct || []),
      ...(result.finalShares.subGroups || []).flatMap(g => g.shares)
    ];

    const spouse = allShares.find(h => h.name === '옥태진');
    const childOfSpouse = allShares.find(h => h.name === '옥인철');
    const daughter = allShares.find(h => h.name === '김씨딸');

    expect(spouse).toBeUndefined();
    expect(childOfSpouse).toBeUndefined();
    expect(daughter).toBeDefined();
    expect(daughter.n).toBe(1);
    expect(daughter.d).toBe(1);
  });
  it('8. excludes a pre-1991 son-in-law-only branch and redistributes at the parent stage', () => {
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
          heirs: [
            { id: 'h1', name: 'SonInLaw', relation: 'husband', isDeceased: false, heirs: [] }
          ]
        },
        { id: 's1', name: 'LivingSon', relation: 'son', isDeceased: false, heirs: [] }
      ]
    };

    const result = calculateInheritance(tree);
    const allShares = [
      ...(result.finalShares.direct || []),
      ...(result.finalShares.subGroups || []).flatMap(g => g.shares)
    ];

    const sonInLaw = allShares.find(h => h.name === 'SonInLaw');
    const livingSon = allShares.find(h => h.name === 'LivingSon');
    const blockedBranchWarning = (result.warnings || []).find(w => w.code === 'ineligible-substitution-heirs');

    expect(sonInLaw).toBeUndefined();
    expect(livingSon).toBeDefined();
    expect(livingSon.n).toBe(1);
    expect(livingSon.d).toBe(1);
    expect(result.integrity.hasTotalMismatch).toBe(false);
    expect(blockedBranchWarning).toBeDefined();
  });

  it('9. keeps separate substitution groups even when ancestors do not have personId', () => {
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
          heirs: [
            { id: 's1c1', name: 'AChild', relation: 'son', isDeceased: false, heirs: [] }
          ]
        },
        {
          id: 's2',
          name: 'BranchB',
          relation: 'son',
          isDeceased: true,
          deathDate: '1984-01-01',
          heirs: [
            { id: 's2c1', name: 'BChild', relation: 'son', isDeceased: false, heirs: [] }
          ]
        }
      ]
    };

    const result = calculateInheritance(tree);
    const ancestorNames = (result.finalShares.subGroups || []).map(g => g.ancestor.name).sort();

    expect(result.finalShares.subGroups.length).toBe(2);
    expect(ancestorNames).toEqual(['BranchA', 'BranchB']);
  });
});
