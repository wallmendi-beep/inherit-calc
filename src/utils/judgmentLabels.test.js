import { describe, expect, it } from 'vitest';
import { formatExclusionLabel, formatJudgmentLabel, formatModifierLabel, formatRegisterNote } from './judgmentLabels';

describe('judgment label formatter', () => {
  it('formats legacy female reduction labels with register status', () => {
    expect(formatModifierLabel('출가녀 감산 (남자의 1/4)', { isSameRegister: false })).toBe('비동일가적, 감산(남자의 1/4)');
    expect(formatModifierLabel('출가녀 감산 (남자의 1/4)', { isSameRegister: false, marriageDate: '1925-02-03' })).toBe('1925년 02월 03일 혼인, 비동일가적, 감산(남자의 1/4)');
    expect(formatModifierLabel('여자 감산 (남자의 1/2)', { isSameRegister: true })).toBe('동일가적 여자, 감산(남자의 1/2)');
  });

  it('formats legacy spouse and exclusion labels for compact notes', () => {
    expect(formatModifierLabel('처 감산 (남자의 1/2)', {})).toBe('처 감산(남자의 1/2)');
    expect(formatExclusionLabel('1991년 이전 처 사망으로 사위 대습상속권 없음')).toBe('1991년 이전 처 사망(대습상속 불가)');
    expect(formatJudgmentLabel({ ex: '', mod: '', h: { relation: 'son' } }, '1970-01-01')).toBe('균분');
  });

  it('formats register notes without assuming every non-same-register case is only 출가', () => {
    expect(formatRegisterNote({ isSameRegister: false })).toBe('비동일가적');
    expect(formatRegisterNote({ isSameRegister: false, marriageDate: '1961-04-05' })).toBe('1961년 04월 05일 혼인, 비동일가적');
  });
});
