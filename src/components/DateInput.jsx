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

const isBefore = (a, b) => !!a && !!b && a < b;

const format = (v) => {
  let val = v.replace(/\D/g, '').slice(0, 8);
  if (val.length > 6) return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
  if (val.length > 4) return `${val.slice(0, 4)}-${val.slice(4)}`;
  return val;
};

export const DateInput = ({
  value,
  onChange,
  placeholder,
  className,
  onKeyDown,
  autoFocus,
  compareDate,       // 비교 기준일 (예: 피상속인 사망일)
  compareLabel,      // 비교 기준 레이블 (예: "피상속인 사망일")
}) => {
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
    if (isInvalid) setIsInvalid(false);
  };

  const handleBlur = () => {
    if (!localValue) {
      if (localValue !== (value || '')) onChange('');
      setIsInvalid(false);
      return;
    }
    if (localValue.length < 10) {
      setIsInvalid(true);
      return;
    }
    if (!isValidCalendarDate(localValue)) {
      setIsInvalid(true);
      return;
    }
    setIsInvalid(false);
    if (localValue !== (value || '')) onChange(localValue);
  };

  const isPredeceased = !isInvalid &&
    localValue.length === 10 &&
    isValidCalendarDate(localValue) &&
    compareDate &&
    isBefore(localValue, compareDate);

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
          isInvalid
            ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20'
            : isPredeceased
              ? 'border-blue-300 dark:border-blue-700'
              : ''
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
