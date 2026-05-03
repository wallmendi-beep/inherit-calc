import { describe, expect, it } from 'vitest';
import { collectImportValidationIssues } from './importValidationV2';

describe('collectImportValidationIssues', () => {
  it('does not create generic follow-up warnings for people predeceased in the current event context', () => {
    const jungMunJaUnderKimMyungSu = {
      id: 'jung-under-kim',
      personId: 'jung-mun-ja',
      name: '정문자',
      relation: 'daughter',
      isDeceased: true,
      deathDate: '1986-02-26',
      heirs: [],
    };
    const jungMunJaUnderGuSuMyeong = {
      ...jungMunJaUnderKimMyungSu,
      id: 'jung-under-gu',
    };
    const tree = {
      id: 'root',
      personId: 'root',
      name: '김혁조',
      relation: 'root',
      isDeceased: true,
      deathDate: '1967-10-27',
      heirs: [
        {
          id: 'kim-myung-su-root',
          personId: 'kim-myung-su',
          name: '김명수',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '1972-11-22',
          heirs: [jungMunJaUnderKimMyungSu],
        },
        {
          id: 'gu-su-myeong',
          personId: 'gu-su-myeong',
          name: '구수명',
          relation: 'wife',
          isDeceased: true,
          deathDate: '1990-07-03',
          heirs: [
            {
              id: 'kim-myung-su-under-gu',
              personId: 'kim-myung-su',
              name: '김명수',
              relation: 'daughter',
              isDeceased: true,
              deathDate: '1972-11-22',
              heirs: [jungMunJaUnderGuSuMyeong],
            },
          ],
        },
      ],
    };

    const issues = collectImportValidationIssues(tree).filter(
      (issue) => issue.code === 'missing-descendants' && issue.personId === 'jung-mun-ja'
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe('jung-under-kim');
  });
});
