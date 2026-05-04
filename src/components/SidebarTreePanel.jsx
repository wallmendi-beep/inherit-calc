import React from 'react';
import MiniTreeView from './MiniTreeView';

function PanelActionButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-7 items-center justify-center rounded-lg border border-[#e9e9e7] bg-white px-2.5 text-[11px] font-semibold text-[#5f5e5b] transition-colors hover:border-[#d7d5cf] hover:bg-[#f3f2ef] hover:text-[#37352f] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}

function PanelIcon({ open }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9 4v16" />
      {open ? <path d="m14 12 3-3m-3 3 3 3" /> : <path d="m17 12-3-3m3 3-3 3" />}
    </svg>
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
  setSidebarOpen = () => {},
  sidebarToggleSignal = 0,
  tree = null,
  handleNavigate = () => {},
  guideStatusMap = {},
  handleResizeMouseDown = () => {},
  removeHeir = () => {},
}) {
  const matchCount = (sidebarMatchIds || []).length;
  const safeSidebarWidth = Math.max(250, sidebarWidth);

  if (!sidebarOpen) {
    return (
      <aside className="fixed left-0 top-[60px] z-30 flex h-[calc(100vh-60px)] w-[42px] flex-col items-center border-r border-[#e9e9e7] bg-white/95 py-3 shadow-sm backdrop-blur no-print dark:border-neutral-700 dark:bg-neutral-900/95">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e9e9e7] bg-[#fafaf9] text-[#3b5f8a] transition-colors hover:bg-[#f0f6ff] dark:border-neutral-700 dark:bg-neutral-800 dark:text-blue-300"
          title="가계도 요약 열기"
          aria-label="가계도 요약 열기"
        >
          <PanelIcon open={false} />
        </button>
        <div className="mt-3 [writing-mode:vertical-rl] text-[11px] font-black tracking-[0.08em] text-[#787774] dark:text-neutral-400">
          가계도 요약
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-[60px] z-30 flex h-[calc(100vh-60px)] items-stretch no-print" style={{ width: safeSidebarWidth + 10 }}>
      <div className="flex flex-col overflow-hidden border-r border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900" style={{ width: safeSidebarWidth, minWidth: 250 }}>
        <div className="shrink-0 border-b border-[#e9e9e7] bg-white/95 px-3 py-3 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="text-[12px] font-black tracking-[0.08em] text-[#3b5f8a] dark:text-blue-300">가계도 요약</div>
              <div className="mt-1 text-[12px] font-bold text-[#787774] dark:text-neutral-300">상속인 구조 탐색</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-[#e9e9e7] bg-white text-[#787774] transition-colors hover:bg-[#f3f2ef] hover:text-[#37352f] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                title="가계도 요약 닫기"
                aria-label="가계도 요약 닫기"
              >
                <PanelIcon open />
              </button>
              <PanelActionButton onClick={() => setSidebarToggleSignal((signal) => Math.abs(signal) + 1)} title="모두 펼치기">
                펼치기
              </PanelActionButton>
              <PanelActionButton onClick={() => setSidebarToggleSignal((signal) => -(Math.abs(signal) + 1))} title="모두 접기">
                접기
              </PanelActionButton>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5 rounded-lg border border-[#e9e9e7] bg-[#fafaf9] px-2 py-2 dark:border-neutral-700 dark:bg-neutral-800">
              <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="검색"
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="min-w-0 w-full bg-transparent text-[12px] text-[#37352f] outline-none placeholder:text-neutral-400 dark:text-neutral-200"
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
