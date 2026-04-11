import React from 'react';

/**
 * 치명적인 오류를 나타내는 작은 배지입니다.
 */
export const FatalBadge = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50 text-[10px] filter grayscale hover:grayscale-0 transition-all" title="계산불가/필수">
    🚫
  </span>
);

export const WarningBadge = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-[10px] filter grayscale hover:grayscale-0 transition-all" title="주의/확인">
    ⚠️
  </span>
);

export const InfoBadge = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-[10px] filter grayscale hover:grayscale-0 transition-all" title="참고">
    ℹ️
  </span>
);
