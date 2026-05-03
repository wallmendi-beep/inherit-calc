import { describe, expect, it } from 'vitest';
import {
  buildPostMarriageFamilyReviewGuide,
  buildSpouseDirectGuideText,
  collectLegacyStepchildGuideEntries,
} from './smartGuideHelpers';

describe('smartGuideHelpers', () => {
  it('builds a short direct guide for wife reinheritance', () => {
    expect(
      buildSpouseDirectGuideText(
        { parentName: '이성우', spouseRelation: 'wife' },
        ['노금례']
      )
    ).toBe("후속 상속 미확정 — [노금례] 사건. 추가 자녀가 있으면 입력, 없으면 '없음 확정'을 눌러 주세요.");
  });

  it('builds a short direct guide for husband reinheritance', () => {
    expect(
      buildSpouseDirectGuideText(
        { parentName: '정순화', spouseRelation: 'husband' },
        ['이명우']
      )
    ).toBe("후속 상속 미확정 — [이명우] 사건. 자녀 범위를 확인하고 입력해 주세요.");
  });

  it('detects missing stepchild inclusion guidance for pre-1991 wife cases', () => {
    const tree = {
      id: 'root',
      personId: 'root',
      name: '처 사건',
      deathDate: '1983-01-26',
      heirs: [
        {
          id: 'wife-1',
          personId: 'wife-1',
          name: '노금례',
          relation: 'wife',
          deathDate: '2022-12-19',
          heirs: [],
        },
        {
          id: 'husband-1',
          personId: 'husband-1',
          name: '이성우',
          relation: 'husband',
          deathDate: '',
          heirs: [
            {
              id: 'child-1',
              personId: 'child-1',
              name: '이상조',
              relation: 'son',
              heirs: [],
            },
          ],
        },
      ],
    };

    const entries = collectLegacyStepchildGuideEntries(tree);

    expect(entries).toHaveLength(1);
    expect(entries[0].text).toContain('[노금례]의 배우자 [이성우]에게 자녀 [이상조]이 입력되어 있습니다.');
    expect(entries[0].text).toContain('구법상 [노금례] 사건의 상속인 포함 여부를 확인해 주세요.');
    expect(entries[0].targetTabId).toBe('husband-1');
    expect(entries[0].relatedEventTabId).toBe('root');
    expect(entries[0].targetNodeIds).toContain('child-1');
  });

  it('separates post-marriage family guidance from legacy stepchild guidance', () => {
    const tree = {
      id: 'root',
      personId: 'root',
      name: '김혁조',
      deathDate: '1967-01-01',
      heirs: [
        {
          id: 'wife-decedent',
          personId: 'wife-decedent',
          name: '윤숙자',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '1970-06-13',
          heirs: [
            {
              id: 'husband-1',
              personId: 'husband-1',
              name: '조창제',
              relation: 'husband',
              deathDate: '',
              heirs: [
                {
                  id: 'later-wife',
                  personId: 'later-wife',
                  name: '이옥지',
                  relation: 'wife',
                  marriageDate: '1973-12-06',
                  heirs: [],
                },
                {
                  id: 'later-child',
                  personId: 'later-child',
                  name: '조상욱',
                  relation: 'son',
                  heirs: [],
                },
              ],
            },
            {
              id: 'direct-child',
              personId: 'direct-child',
              name: '조상범',
              relation: 'son',
              heirs: [],
            },
          ],
        },
      ],
    };

    const entries = collectLegacyStepchildGuideEntries(tree);

    expect(entries).toHaveLength(1);
    expect(entries[0].key).toContain('post-marriage-family');
    expect(entries[0].text).toContain('후혼 가족관계 확인');
    expect(entries[0].text).toContain('[이옥지]');
    expect(entries[0].text).toContain('[조상욱]');
    expect(entries[0].text).toContain('출생자 또는 태아였는지 확인');
  });

  it('builds post-marriage family review text', () => {
    expect(
      buildPostMarriageFamilyReviewGuide(
        { name: '윤숙자' },
        { name: '조창제' },
        ['이옥지'],
        ['조상욱']
      )
    ).toContain('[윤숙자] 사건에서는 제외해 주세요.');
  });
});
