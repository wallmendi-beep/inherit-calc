import { describe, expect, it } from 'vitest';
import {
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
    ).toBe('[노금례] 사건의 추가 자녀 여부를 확인해 주세요.');
  });

  it('builds a short direct guide for husband reinheritance', () => {
    expect(
      buildSpouseDirectGuideText(
        { parentName: '정순화', spouseRelation: 'husband' },
        ['이명우']
      )
    ).toBe('[이명우] 사건의 자녀 범위를 확인해 주세요.');
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
    expect(entries[0].text).toContain('1991년 이전에는 계모자관계에 따라 [노금례] 사건의 상속인에 포함될 수 있으니 확인 바랍니다.');
    expect(entries[0].targetTabId).toBe('root');
  });
});
