import React from 'react';

/**
 * 치명적인 오류를 나타내는 작은 배지입니다.
 */
export const FatalBadge = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/40 dark:text-red-400">
    <span className="mr-1 h-1 w-1 rounded-full bg-red-500 animate-pulse"></span>
    {children || '치명적'}
  </span>
);

/**
 * 주의나 수동 확인이 필요한 사항을 나타내는 작은 배지입니다.
 */
export const WarningBadge = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
    {children || '주의'}
  </span>
);

/**
 * 권장되거나 참고할만한 사항을 나타내는 작은 배지입니다.
 */
export const InfoBadge = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
    {children || '참고'}
  </span>
);
