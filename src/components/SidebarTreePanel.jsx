import React from 'react';
import MiniTreeView from './MiniTreeView';

function PanelActionButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-7 items-center justify-center rounded-lg border border-[#e9e9e7] bg-white px-2.5 text-[11px] font-semibold text-[#5f5e5b] transition-colors hover:border-[#d7d5cf] hover:bg-[#f3f2ef] hover:text-[#37352f] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}

export default function SidebarTreePanel({
  sidebarOpen = false,
  sidebarWidth = 240,
  sidebarSearchQuery = '',
  setSidebarSearchQuery = () => {},
  sidebarMatchIds = [],
  sidebarCurrentMatchIdx = 0,
  handleSidebarPrevMatch = () => {},
  handleSidebarNextMatch = () => {},
  setSidebarToggleSignal = () => {},
  sidebarToggleSignal = 0,
  tree = null,
  handleNavigate = () => {},
  guideStatusMap = {},
  handleResizeMouseDown = () => {},
  removeHeir = () => {},
}) {
  if (!sidebarOpen) return null;

  const matchCount = (sidebarMatchIds || []).length;

  return (
    <aside className="fixed left-0 top-[60px] z-30 flex h-[calc(100vh-60px)] items-stretch no-print" style={{ width: sidebarWidth + 10 }}>
      <div className="flex flex-col overflow-hidden border-r border-[#e9e9e7] bg-white dark:border-neutral-700 dark:bg-neutral-800" style={{ width: sidebarWidth }}>
        <div className="shrink-0 border-b border-[#e9e9e7] bg-[#faf9f6] px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a988f] dark:text-neutral-500">가계도 요약</div>
              <div className="mt-0.5 text-[13px] font-semibold text-[#37352f] dark:text-neutral-100">상속인 구조 탐색</div>
            </div>
            <div className="flex items-center gap-1">
              <PanelActionButton onClick={() => setSidebarToggleSignal((signal) => Math.abs(signal) + 1)} title="모두 펼치기">
                펼치기
              </PanelActionButton>
              <PanelActionButton onClick={() => setSidebarToggleSignal((signal) => -(Math.abs(signal) + 1))} title="모두 접기">
                접기
              </PanelActionButton>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#e9e9e7] bg-white px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.9)] dark:border-neutral-700 dark:bg-neutral-800">
            <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="상속인 검색"
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#37352f] outline-none placeholder:text-neutral-400 dark:text-neutral-200"
            />
            {matchCount > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] font-medium text-neutral-400">
                  {sidebarCurrentMatchIdx + 1}/{matchCount}
                </span>
                <button onClick={handleSidebarPrevMatch} className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-[#f0f0ee] hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200" title="이전 결과">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button onClick={handleSidebarNextMatch} className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-[#f0f0ee] hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200" title="다음 결과">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="hover-scrollbar flex-1 overflow-y-auto px-2 py-2">
          {tree && (
            <MiniTreeView
              node={tree}
              onSelectNode={handleNavigate}
              deathDate={tree.deathDate}
              toggleSignal={sidebarToggleSignal}
              searchQuery={sidebarSearchQuery}
              matchIds={sidebarMatchIds}
              currentMatchId={sidebarMatchIds[sidebarCurrentMatchIdx]}
              guideStatusMap={guideStatusMap}
              removeHeir={removeHeir}
            />
          )}
        </div>
      </div>
      <div className="w-[10px] shrink-0 cursor-col-resize transition-colors hover:bg-blue-200/40 active:bg-blue-300/40 dark:hover:bg-blue-900/30" onMouseDown={handleResizeMouseDown} />
    </aside>
  );
}
