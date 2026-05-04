import React, { useEffect, useRef, useState } from 'react';
import {
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

function PanelToggleIcon({ open }) {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9 4v16" />
      {open ? <path d="m14 12 3-3m-3 3 3 3" /> : <path d="m17 12-3-3m3 3-3 3" />}
    </svg>
  );
}

function InlineMeta({ label, value, tone = 'neutral', minWidth = '' }) {
  const toneClass =
    tone === 'accent'
      ? 'border-[#dceaf8] bg-[#f7fbff] text-[#0b6e99] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300'
      : 'border-[#e9e9e7] bg-white text-[#37352f] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200';

  return (
    <div className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 ${toneClass} ${minWidth}`}>
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a988f] dark:text-neutral-400">{label}</span>
      <span className="truncate text-[12px] font-semibold">{value}</span>
    </div>
  );
}

export default function TopToolbarBalanced({
  sidebarOpen,
  setSidebarOpen,
  sidebarToggleDisabled = false,
  showSidebarToggle = true,
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
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const toggleMenu = (menu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const closeMenus = () => setOpenMenu(null);

  return (
    <div className="sticky top-0 z-50 no-print w-full border-b border-[#e9e9e7] bg-white/94 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-neutral-600 dark:bg-neutral-800/94">
      <div className="mx-auto flex min-h-[56px] w-full max-w-[1400px] items-center gap-4 px-5 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showSidebarToggle && (
            <button
              onClick={() => setSidebarOpen((open) => !open)}
              disabled={sidebarToggleDisabled}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-45 ${sidebarOpen ? 'border-[#cfe2fb] bg-[#eef5ff] text-[#2383e2] dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300' : 'border-[#eceae4] bg-[#fbfaf7] text-[#787774] hover:border-[#e1dfd8] hover:bg-[#f2f1ee] dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700'}`}
              title={sidebarToggleDisabled ? '사건 검토에서는 사건 보고서가 좌측 패널에 표시됩니다.' : (sidebarOpen ? '좌측 가계도 패널 닫기' : '좌측 가계도 패널 열기')}
            >
              <PanelToggleIcon open={sidebarOpen} />
            </button>
          )}

          <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-[#eceae4] bg-[#fbfaf7] px-3 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.9)] dark:border-neutral-600 dark:bg-neutral-800/80">
            <div className="flex min-w-0 items-center gap-2 pr-1">
              <span className="truncate text-[17px] font-bold tracking-tight text-[#37352f] dark:text-neutral-100">상속지분계산기 PRO</span>

            </div>

            <div className="hidden h-7 w-px bg-[#e1dfd8] dark:bg-neutral-700 lg:block" />

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <InlineMeta label="사건번호" value={tree.caseNo || '미입력'} minWidth="min-w-[168px]" />
              <InlineMeta label="피상속인" value={tree.name || '미입력'} tone="accent" minWidth="min-w-[186px]" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" ref={menuRef}>
          <div className="flex items-center gap-0.5 rounded-2xl border border-[#eceae4] bg-[#fbfaf7] px-1.5 py-1.5 dark:border-neutral-600 dark:bg-neutral-800/80">
            <button onClick={undoTree} disabled={!canUndo} className="flex h-7 items-center gap-0.5 rounded-lg border border-transparent px-1.5 text-[11px] font-bold text-[#787774] transition-colors hover:border-[#d4d4d4] hover:bg-[#efefed] hover:text-[#37352f] disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200" title="이전 작업 (Ctrl+Z)">
              <IconUndo className="h-3 w-3" /> 이전
            </button>
            <button onClick={redoTree} disabled={!canRedo} className="flex h-7 items-center gap-0.5 rounded-lg border border-transparent px-1.5 text-[11px] font-bold text-[#787774] transition-colors hover:border-[#d4d4d4] hover:bg-[#efefed] hover:text-[#37352f] disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200" title="다시 실행 (Ctrl+Y)">
              <IconRedo className="h-3 w-3" /> 다시
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-2xl border border-[#eceae4] bg-[#fbfaf7] px-1.5 py-1.5 dark:border-neutral-600 dark:bg-neutral-800/80">
            <button
              onClick={() => {
                setAiTargetId('root');
                setIsAiModalOpen(true);
              }}
              title="가계도 전체 AI 자동입력"
              className="mr-1 flex h-7 items-center justify-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 text-[11px] font-bold text-indigo-700 shadow-sm transition-all hover:scale-[1.02] hover:bg-indigo-100 active:scale-95 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
            >
              AI 자동입력
            </button>
            <div className="mr-1 h-4 w-px bg-[#eceae4] dark:bg-neutral-700" />

            <div className="relative">
              <button onClick={() => toggleMenu('file')} className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-colors ${openMenu === 'file' ? 'border-[#d4d4d4] bg-white text-[#37352f] dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100' : 'border-transparent text-[#787774] hover:border-[#d4d4d4] hover:bg-[#efefed] hover:text-[#37352f] dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'}`}>
                <IconFolderOpen className="h-3 w-3" /> 파일
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => { closeMenus(); loadFile(e); e.target.value = ''; }}
                className="hidden"
              />
              {openMenu === 'file' && (
                <div className="absolute right-0 top-11 z-[120] flex w-40 flex-col gap-1 rounded-2xl border border-[#e9e9e7] bg-white p-1.5 shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
                  <button onClick={() => { closeMenus(); fileInputRef.current?.click(); }} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-[#37352f] hover:bg-[#f7f7f5] dark:text-neutral-200 dark:hover:bg-neutral-700">
                    <IconFolderOpen className="h-3.5 w-3.5" /> 불러오기
                  </button>
                  <button onClick={() => { closeMenus(); saveFile(); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-[#37352f] hover:bg-[#f7f7f5] dark:text-neutral-200 dark:hover:bg-neutral-700">
                    <IconSave className="h-3.5 w-3.5" /> 저장
                  </button>
                  <button onClick={() => { closeMenus(); setIsResetModalOpen(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-[#d44c47] hover:bg-[#fff1ef] dark:hover:bg-red-900/20">
                    <IconReset className="h-3.5 w-3.5" /> 초기화
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleExcelExport}
              className="flex h-7 items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-bold text-[#787774] transition-colors hover:border-[#d4d4d4] hover:bg-[#efefed] hover:text-[#37352f] dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
              title="엑셀(CSV) 파일로 내보내기"
            >
              <IconTable className="h-3 w-3" /> 출력
            </button>

            <button
              onClick={handlePrint}
              className="flex h-7 items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-bold text-[#787774] transition-colors hover:border-[#d4d4d4] hover:bg-[#efefed] hover:text-[#37352f] dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
              title="현재 탭 인쇄하기 (보고서)"
            >
              <IconPrinter className="h-3 w-3" /> 인쇄
            </button>
          </div>

          <div className="hidden items-center gap-0.5 rounded-2xl border border-[#eceae4] bg-[#fbfaf7] px-1.5 py-1.5 dark:border-neutral-600 dark:bg-neutral-800/80 lg:flex">
            <button onClick={() => setZoomLevel((prev) => Math.max(0.7, prev - 0.1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] font-bold text-[#787774] transition-colors hover:bg-[#efefed] hover:text-[#37352f] dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-200">-</button>
            <span className="w-9 text-center text-[10px] font-black text-[#504f4c] dark:text-neutral-300">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel((prev) => Math.min(1.5, prev + 0.1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] font-bold text-[#787774] transition-colors hover:bg-[#efefed] hover:text-[#37352f] dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-200">+</button>
            <div className="mx-0.5 h-4 w-px bg-[#eceae4] dark:bg-neutral-700" />
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#787774] transition-colors hover:bg-[#efefed] dark:text-neutral-300 dark:hover:bg-neutral-700">
              {isDarkMode ? <IconSun className="h-3.5 w-3.5 text-amber-300" /> : <IconMoon className="h-3.5 w-3.5" />}
            </button>
          </div>

          <button
            onClick={() => setShowNavigator((prev) => !prev)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-[12px] font-bold shadow-sm transition-all active:scale-95 ${hasActionItems ? 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-400' : 'border-[#e9e9e7] bg-white text-[#787774] hover:bg-[#f7f7f5] hover:text-[#37352f] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}`}
            title={hasActionItems ? '확인이 필요한 가이드가 있습니다.' : '스마트 가이드 열기/닫기'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActionItems ? 2.5 : 2}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            <span className="tracking-tight">가이드</span>
          </button>
        </div>
      </div>
    </div>
  );
}
