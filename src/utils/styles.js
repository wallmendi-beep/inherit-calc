export const getLevelStyle = (level) => {
  if (level === 1) return "bg-[#f0fdf4] dark:bg-green-900/20 border-[#bbf7d0] dark:border-green-800/30 transition-colors"; // 1차: 연녹색
  if (level === 2) return "bg-[#ecfeff] dark:bg-cyan-900/20 border-[#a5f3fc] dark:border-cyan-800/30 transition-colors"; // 2차: 연청록
  if (level === 3) return "bg-[#eff6ff] dark:bg-blue-900/20 border-[#bfdbfe] dark:border-blue-800/30 transition-colors"; // 3차: 연파랑
  if (level === 4) return "bg-[#eef2ff] dark:bg-indigo-900/20 border-[#c7d2fe] dark:border-indigo-800/30 transition-colors"; // 4차: 연남색
  if (level === 5) return "bg-[#faf5ff] dark:bg-purple-900/20 border-[#e9d5ff] dark:border-purple-800/30 transition-colors"; // 5차: 연보라
  if (level === 6) return "bg-[#fdf4ff] dark:bg-fuchsia-900/20 border-[#fbcfe8] dark:border-fuchsia-800/30 transition-colors"; // 6차: 연분홍
  return "bg-[#fff1f2] dark:bg-rose-900/20 border-[#fecdd3] dark:border-rose-800/30 transition-colors";                  // 7차 이상: 연장미
};

export const getLineStyle = (level) => {
  if (level === 2) return "border-[#22d3ee]"; // 2차 연결선: 청록색
  if (level === 3) return "border-[#60a5fa]"; // 3차 연결선: 파란색
  if (level === 4) return "border-[#818cf8]"; // 4차 연결선: 남색
  if (level === 5) return "border-[#a855f7]"; // 5차 연결선: 보라색
  if (level === 6) return "border-[#e879f9]"; // 6차 연결선: 분홍색
  return "border-[#fb7185]";                  // 7차 이상 연결선: 장미색
};
