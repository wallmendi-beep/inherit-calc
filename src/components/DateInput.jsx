import React, { useState, useEffect } from 'react';

export const DateInput = ({ value, onChange, placeholder, className, onKeyDown, autoFocus }) => {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const format = (v) => {
    let val = v.replace(/\D/g, '').slice(0, 8);
    if (val.length > 6) return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
    if (val.length > 4) return `${val.slice(0, 4)}-${val.slice(4)}`;
    return val;
  };

  const handleChange = (e) => {
    setLocalValue(format(e.target.value));
  };

  const handleBlur = () => {
    if (localValue !== (value || '')) {
      onChange(localValue);
    }
  };

  return (
    <input 
      type="text" 
      value={localValue} 
      onKeyDown={onKeyDown} 
      onChange={handleChange} 
      onBlur={handleBlur}
      onFocus={e => e.target.select()} 
      autoFocus={autoFocus}
      placeholder={placeholder || "YYYY-MM-DD"} 
      className={`${className} dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200`}
    />
  );
};
