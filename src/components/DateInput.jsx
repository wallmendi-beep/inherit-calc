import React, { useState } from 'react';

const isValidCalendarDate = (str) => {
  if (!str || str.length < 10) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

const format = (v) => {
  let val = v.replace(/\D/g, '').slice(0, 8);
  if (val.length > 6) return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
  if (val.length > 4) return `${val.slice(0, 4)}-${val.slice(4)}`;
  return val;
};

export const DateInput = ({ value, onChange, placeholder, className, onKeyDown, autoFocus }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [localValue, setLocalValue] = useState(value || '');
  const [isInvalid, setIsInvalid] = useState(false);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value || '');
    setIsInvalid(false);
  }

  const handleChange = (e) => {
    const formatted = format(e.target.value);
    setLocalValue(formatted);
    // 입력 중에는 에러 표시 해제
    if (isInvalid) setIsInvalid(false);
  };

  const handleBlur = () => {
    if (!localValue) {
      // 빈값은 유효 → 그대로 저장
      if (localValue !== (value || '')) onChange('');
      setIsInvalid(false);
      return;
    }
    if (localValue.length < 10) {
      // 미완성 입력 → 에러 표시, 저장 안 함
      setIsInvalid(true);
      return;
    }
    if (!isValidCalendarDate(localValue)) {
      // 형식은 맞지만 실제 없는 날짜 (예: 2024-02-30)
      setIsInvalid(true);
      return;
    }
    setIsInvalid(false);
    if (localValue !== (value || '')) onChange(localValue);
  };

  return (
    <div className="relative inline-block">
      <input
        type="text"
        value={localValue}
        onKeyDown={onKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={e => e.target.select()}
        autoFocus={autoFocus}
        lang="ko"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        placeholder={placeholder || "YYYY-MM-DD"}
        className={`${className} dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 ${
          isInvalid ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20' : ''
        }`}
      />
      {isInvalid && (
        <div className="absolute left-0 top-full mt-0.5 z-50 whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-[11px] text-white shadow">
          올바른 날짜가 아닙니다
        </div>
      )}
    </div>
  );
};
