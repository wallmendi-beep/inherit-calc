import { describe, expect, it } from 'vitest';
import { collectImportValidationIssues } from './importValidationV2';

describe('collectImportValidationIssues', () => {
  it('warns when the same name is used by different personIds across branches', () => {
    const tree = {
      id: 'root',
      personId: 'root',
      name: '피상속인',
      relation: 'root',
      isDeceased: true,
      deathDate: '2020-01-01',
      heirs: [
        {
          id: 'branch-a',
          personId: 'branch-a',
          name: '장남',
          relation: 'son',
          isDeceased: true,
          deathDate: '2021-01-01',
          heirs: [
            {
              id: 'same-name-1',
              personId: 'kim-gyeonghui-1',
              name: '김경희',
              relation: 'wife',
              isDeceased: false,
              heirs: [],
            },
          ],
        },
        {
          id: 'branch-b',
          personId: 'branch-b',
          name: '차남',
          relation: 'son',
          isDeceased: true,
          deathDate: '2021-02-01',
          heirs: [
            {
              id: 'same-name-2',
              personId: 'kim-gyeonghui-2',
              name: '김경희',
              relation: 'daughter',
              isDeceased: false,
              heirs: [],
            },
          ],
        },
      ],
    };

    const issue = collectImportValidationIssues(tree).find(
      (entry) => entry.code === 'duplicate-name' && entry.personName === '김경희'
    );

    expect(issue).toBeTruthy();
    expect(issue.message).toContain('서로 다른 인물 2명');
    expect(issue.nodeIds).toEqual(['same-name-1', 'same-name-2']);
  });

  it('does not warn when repeated same names share the same personId', () => {
    const tree = {
      id: 'root',
      personId: 'root',
      name: '피상속인',
      relation: 'root',
      isDeceased: true,
      deathDate: '2020-01-01',
      heirs: [
        {
          id: 'node-1',
          personId: 'same-person',
          name: '김경희',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '2021-01-01',
          heirs: [],
        },
        {
          id: 'node-2',
          personId: 'same-person',
          name: '김경희',
          relation: 'daughter',
          isDeceased: true,
          deathDate: '2021-01-01',
          heirs: [],
        },
      ],
    };

    const issues = collectImportValidationIssues(tree).filter(
      (entry) => entry.code === 'duplicate-name' && entry.personName === '김경희'
    );

    expect(issues).toHaveLength(0);
  });

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
