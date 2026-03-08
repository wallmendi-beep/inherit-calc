export const getLevelStyle = (level) => {
  if (level === 1) return "bg-[#f0fdf4] border-[#bbf7d0]"; // 1차: 연녹색 (Green)
  if (level === 2) return "bg-[#ecfeff] border-[#a5f3fc]"; // 2차: 연청록 (Cyan)
  if (level === 3) return "bg-[#eff6ff] border-[#bfdbfe]"; // 3차: 연파랑 (Blue)
  if (level === 4) return "bg-[#eef2ff] border-[#c7d2fe]"; // 4차: 연남색 (Indigo)
  if (level === 5) return "bg-[#faf5ff] border-[#e9d5ff]"; // 5차: 연보라 (Purple)
  if (level === 6) return "bg-[#fdf4ff] border-[#fbcfe8]"; // 6차: 연분홍 (Fuchsia)
  return "bg-[#fff1f2] border-[#fecdd3]";                  // 7차 이상: 연장미 (Rose)
};

export const getLineStyle = (level) => {
  if (level === 2) return "border-[#22d3ee]"; // 2차 연결선: 청록색
  if (level === 3) return "border-[#60a5fa]"; // 3차 연결선: 파란색
  if (level === 4) return "border-[#818cf8]"; // 4차 연결선: 남색
  if (level === 5) return "border-[#a855f7]"; // 5차 연결선: 보라색
  if (level === 6) return "border-[#e879f9]"; // 6차 연결선: 분홍색
  return "border-[#fb7185]";                  // 7차 이상 연결선: 장미색
};
