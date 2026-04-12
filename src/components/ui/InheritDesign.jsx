import React from 'react';

/**
 * [v1.0] [뱃지[] 형태]의 배율 표시 뱃지
 * 디자인 룰 제 66조 준수
 */
export const MultiplierBadge = ({ multiplier }) => {
  if (!multiplier) return null;

  const isPenalty = multiplier.includes('/');
  const isBonus = multiplier.includes('1.5');

  // Notion-inspired 뱃지 스타일: 사각에 가까운 둥근 직사각형
  const baseClass = "px-1.5 py-0.5 rounded-[3px] border text-[10px] font-black shadow-sm whitespace-nowrap bg-white ml-1";
  
  let dynamicClass = "border-neutral-300 text-[#37352f]"; // 중립
  if (isPenalty) dynamicClass = "border-rose-800/80 text-rose-800/80"; // 감산 (Rose)
  if (isBonus) dynamicClass = "border-sky-800/80 text-sky-800/80"; // 가산 (Sky)

  return (
    <span className={`${baseClass} ${dynamicClass}`}>
      {multiplier}
    </span>
  );
};

/**
 * [v1.0] [뱃지 토글] - 슬라이더 없는 텍스트 반전형 캡슐 버튼
 * 디자인 룰 제 70조 및 v4.20 준수
 */
export const BadgeToggle = ({ 
  active, 
  onToggle, 
  activeLabel, 
  inactiveLabel, 
  isInferred = false,
  className = "" 
}) => {
  const currentLabel = active ? activeLabel : inactiveLabel;
  
  // 자동 판별 시 블루톤 스타일 (Rule 70)
  const inferredClass = "border-blue-400 bg-blue-50/50 text-blue-700";
  const standardClass = active 
    ? "border-neutral-400 bg-neutral-100 text-[#37352f]" 
    : "border-[#e5e5e5] bg-[#f8f8f7] text-[#a3a3a3]";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!active);
      }}
      title={isInferred ? "지능형 자동 판별 상속 데이터" : "클릭하여 상태 변경"}
      className={`
        px-3 py-1 rounded-full border text-[11px] font-black transition-all duration-200 active:scale-95 shadow-sm
        ${isInferred ? inferredClass : standardClass}
        ${className}
      `}
    >
      {currentLabel}
    </button>
  );
};

/**
 * [v1.0] 상속권 제외 옵션 전용 뱃지
 */
export const ExclusionBadge = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition-colors shadow-sm"
  >
    {label}
  </button>
);
