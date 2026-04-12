import React from 'react';

const iconBase = 'h-3.5 w-3.5 shrink-0';

const AlertTriangleIcon = ({ className = '' }) => (
  <svg className={`${iconBase} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const LightbulbIcon = ({ className = '' }) => (
  <svg className={`${iconBase} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.75c.62.43 1 1.13 1 1.89V18h6v-1.36c0-.76.38-1.46 1-1.89A7 7 0 0 0 12 2Z" />
  </svg>
);

export const FatalBadge = ({ title = '계산불가 / 필수확인' }) => (
  <span
    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
    title={title}
  >
    <AlertTriangleIcon className="h-3.5 w-3.5" />
  </span>
);

export const WarningBadge = ({ title = '주의 / 확인' }) => (
  <span
    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100"
    title={title}
  >
    <AlertTriangleIcon className="h-3.5 w-3.5" />
  </span>
);

export const InfoBadge = ({ title = '참고' }) => (
  <span
    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
    title={title}
  >
    <LightbulbIcon className="h-3.5 w-3.5" />
  </span>
);
