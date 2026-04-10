import React from 'react';
import MiniTreeView from './MiniTreeView';

export default function SidebarTreePanel({
  sidebarOpen,
  sidebarWidth,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  sidebarMatchIds,
  sidebarCurrentMatchIdx,
  handleSidebarPrevMatch,
  handleSidebarNextMatch,
  setSidebarToggleSignal,
  sidebarToggleSignal,
  tree,
  handleNavigate,
  guideStatusMap,
  handleResizeMouseDown,
}) {
  if (!sidebarOpen) return null;

  return (
    <aside className="fixed left-0 top-[54px] h-[calc(100vh-54px)] z-30 no-print flex items-stretch" style={{ width: sidebarWidth + 10 }}>
      <div className="flex flex-col bg-white dark:bg-neutral-800 border-r border-[#e9e9e7] dark:border-neutral-700 overflow-hidden" style={{ width: sidebarWidth }}>
        <div className="p-2 border-b border-[#e9e9e7] dark:border-neutral-700 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-1 bg-[#f7f7f5] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2 py-1">
            <svg className="w-3 h-3 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="이름 검색"
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-[12px] text-[#37352f] dark:text-neutral-200 min-w-0"
            />
            {sidebarMatchIds.length > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <span className="text-[10px] text-neutral-400">
                  {sidebarCurrentMatchIdx + 1}/{sidebarMatchIds.length}
                </span>
                <button onClick={handleSidebarPrevMatch} className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button onClick={handleSidebarNextMatch} className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setSidebarToggleSignal((signal) => Math.abs(signal) + 1)} className="flex-1 text-[10px] text-[#787774] dark:text-neutral-400 hover:text-[#37352f] hover:bg-[#f0f0ee] dark:hover:bg-neutral-700 py-0.5 rounded transition-colors font-bold">
              모두 펼치기
            </button>
            <button onClick={() => setSidebarToggleSignal((signal) => -(Math.abs(signal) + 1))} className="flex-1 text-[10px] text-[#787774] dark:text-neutral-400 hover:text-[#37352f] hover:bg-[#f0f0ee] dark:hover:bg-neutral-700 py-0.5 rounded transition-colors font-bold">
              모두 접기
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
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
            />
          )}
        </div>
      </div>
      <div className="w-[10px] cursor-col-resize hover:bg-blue-200/40 dark:hover:bg-blue-900/30 active:bg-blue-300/40 transition-colors shrink-0" onMouseDown={handleResizeMouseDown} />
    </aside>
  );
}
