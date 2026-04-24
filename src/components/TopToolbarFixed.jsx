import React from 'react';
import {
  IconCalculator,
  IconFolderOpen,
  IconMoon,
  IconPrinter,
  IconRedo,
  IconReset,
  IconSave,
  IconSun,
  IconTable,
  IconUndo,
} from './Icons';

export default function TopToolbarFixed({
  sidebarOpen,
  setSidebarOpen,
  tree,
  setAiTargetId,
  setIsAiModalOpen,
  setShowNavigator,
  hasActionItems,
  undoTree,
  redoTree,
  canUndo,
  canRedo,
  setIsResetModalOpen,
  loadFile,
  saveFile,
  handleExcelExport,
  handlePrint,
  zoomLevel,
  setZoomLevel,
  isDarkMode,
  setIsDarkMode,
}) {
  return (
    <div className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex justify-start transition-all duration-300 shadow-sm overflow-hidden">
      <div className="w-[1080px] min-w-[1080px] shrink-0 px-6 flex items-center justify-between h-full flex-nowrap">
        <div className="flex items-center gap-3 flex-nowrap shrink-0">
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className={`w-7 h-7 flex flex-col justify-center items-center rounded-md gap-1 transition-all no-print ${sidebarOpen ? 'bg-[#f0f0ee] dark:bg-neutral-700 text-[#2383e2] dark:text-blue-400' : 'text-[#787774] dark:text-neutral-400 hover:bg-[#efefed] dark:hover:bg-neutral-700'}`}
            title={sidebarOpen ? '가계도 패널 닫기' : '가계도 패널 열기'}
          >
            <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
            <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
            <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
          </button>
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0 overflow-visible">
            <div className="flex items-center text-[#37352f] dark:text-neutral-100 font-bold text-[18px] tracking-tight whitespace-nowrap shrink-0">
              <IconCalculator className="w-5 h-5 mr-1.5 text-[#787774] dark:text-neutral-400 shrink-0" />
              상속지분 계산기 PRO
              <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">베타 v1.0.1</span>
            </div>
            <span className="designer-sign text-[#a3a3a3] dark:text-neutral-500 text-[14px] ml-8 whitespace-nowrap shrink-0">
              Designed by J.H. Lee
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#f7f7f5] dark:bg-neutral-700 px-2.5 py-1 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-2 transition-colors">
            <div className="min-w-[120px] flex items-center gap-1 overflow-hidden">
              <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">사건:</span>
              <span className="text-[11px] font-bold text-[#37352f] dark:text-neutral-200 truncate">{tree.caseNo || '미입력'}</span>
            </div>
            <div className="w-px h-2.5 bg-[#d4d4d4] dark:bg-neutral-600 mx-0.5"></div>
            <div className="min-w-[140px] flex items-center gap-1 overflow-hidden">
              <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">피상속인:</span>
              <span className="text-[13px] font-black text-[#0b6e99] dark:text-blue-400 truncate">{tree.name || '미입력'}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setAiTargetId('root');
              setIsAiModalOpen(true);
            }}
            title="가계도 전체 AI 자동입력"
            className="flex items-center justify-center gap-1 px-2.5 h-8 shrink-0 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-all shadow-sm hover:scale-105 active:scale-95 text-[12px] font-bold text-indigo-700 dark:text-indigo-300"
          >
            <span className="text-[14px] leading-none opacity-100">*</span>
            AI
          </button>
          <button
            onClick={() => setShowNavigator(true)}
            className={`flex items-center justify-center gap-1 px-2.5 h-8 rounded-lg transition-all shadow-sm border shrink-0 mx-[6px] active:scale-95 text-[12px] font-bold ${hasActionItems ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 dark:hover:bg-indigo-900/40' : 'bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f7f5] hover:text-[#37352f] dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700'}`}
            title={hasActionItems ? '확인할 가이드가 있습니다.' : '가이드 열기'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActionItems ? 2.5 : 2}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            가이드
          </button>
          <button onClick={undoTree} disabled={!canUndo} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
            <IconUndo className="w-3.5 h-3.5" /> 이전
          </button>
          <button onClick={redoTree} disabled={!canRedo} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
            <IconRedo className="w-3.5 h-3.5" /> 다시
          </button>
          <div className="w-px h-3.5 bg-[#e9e9e7] dark:bg-neutral-600 mx-1"></div>
          <details className="relative">
            <summary className="list-none cursor-pointer text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2.5 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconFolderOpen className="h-3.5 w-3.5" /> 파일
            </summary>
            <div className="absolute right-0 top-9 w-36 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-1.5 flex flex-col gap-1 z-[120]">
              <label className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 flex items-center gap-2 cursor-pointer">
                <IconFolderOpen className="h-3.5 w-3.5" /> 불러오기
                <input type="file" accept=".json" onChange={loadFile} className="hidden" />
              </label>
              <button onClick={saveFile} className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 flex items-center gap-2">
                <IconSave className="h-3.5 w-3.5" /> 저장
              </button>
              <button onClick={() => setIsResetModalOpen(true)} className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#d44c47] hover:bg-[#fff1ef] dark:hover:bg-red-900/20 flex items-center gap-2">
                <IconReset className="h-3.5 w-3.5" /> 초기화
              </button>
            </div>
          </details>
          <details className="relative">
            <summary className="list-none cursor-pointer text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2.5 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconPrinter className="h-3.5 w-3.5" /> 출력
            </summary>
            <div className="absolute right-0 top-9 w-32 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-1.5 flex flex-col gap-1 z-[120]">
              <button onClick={handlePrint} className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 flex items-center gap-2">
                <IconPrinter className="h-3.5 w-3.5" /> 인쇄
              </button>
              <button onClick={handleExcelExport} className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 flex items-center gap-2">
                <IconTable className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          </details>
          <details className="relative">
            <summary className="list-none cursor-pointer text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2.5 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              {isDarkMode ? <IconSun className="h-3.5 w-3.5" /> : <IconMoon className="h-3.5 w-3.5" />} 보기
            </summary>
            <div className="absolute right-0 top-9 w-36 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-1.5 flex flex-col gap-1 z-[120]">
              <div className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 flex items-center justify-between gap-2">
                <span>확대</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoomLevel((prev) => Math.max(0.7, prev - 0.1))} className="w-6 h-6 rounded border border-[#d4d4d4] dark:border-neutral-600">-</button>
                  <span className="w-9 text-center text-[10px]">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel((prev) => Math.min(1.5, prev + 0.1))} className="w-6 h-6 rounded border border-[#d4d4d4] dark:border-neutral-600">+</button>
                </div>
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="px-2.5 py-2 rounded-lg text-[12px] font-bold text-[#37352f] dark:text-neutral-200 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 flex items-center gap-2">
                {isDarkMode ? <IconSun className="h-3.5 w-3.5 text-amber-400" /> : <IconMoon className="h-3.5 w-3.5" />}
                {isDarkMode ? '라이트 모드' : '다크 모드'}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
