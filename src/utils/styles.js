// 레벨별 배경색 — 모두 동일한 뉴트럴로 통일 (계층은 들여쓰기 선으로만 구분)
export const getLevelStyle = (level) => {
  return "bg-white dark:bg-neutral-800 border-[#e2e2e0] dark:border-neutral-700 transition-colors";
};

// 연결선 — 단일 색상
export const getLineStyle = (level) => {
  return "border-[#d4d4d4] dark:border-neutral-600";
};
