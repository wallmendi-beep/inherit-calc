import React, { useEffect, useRef, useState } from 'react';
import { IconFolderOpen, IconMoon, IconPrinter, IconReset, IconSave, IconSun, IconTable } from './Icons';

function HeaderButton({ className = '', children, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all ${className}`}
    >
      {children}
    </button>
  );
}

export default function CommandHeader({
  tree,
  sidebarOpen,
  setSidebarOpen,
  setAiTargetId,
  setIsAiModalOpen,
  setShowNavigator,
  hasActionItems,
  setIsResetModalOpen,
  loadFile,
  saveFile,
  handleExcelExport,
  handlePrint,
  isDarkMode,
  setIsDarkMode,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const toggleMenu = (menu) => setOpenMenu((prev) => (prev === menu ? null : menu));
  const closeMenus = () => setOpenMenu(null);

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? '가계도 닫기' : '가계도 열기'}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-tight text-slate-800 dark:text-neutral-100">
              상속분 계산기 <span className="text-indigo-600 dark:text-indigo-400">Pro</span>
            </div>
            <div className="hidden truncate text-[11px] text-slate-400 lg:block dark:text-neutral-400">
              {tree.caseNo || '사건번호 미입력'} · {tree.name || '피상속인 미입력'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5" ref={menuRef}>
          <div className="relative hidden sm:block">
            <HeaderButton
              onClick={() => toggleMenu('file')}
              className="text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              파일
            </HeaderButton>
            {openMenu === 'file' && (
              <div className="absolute right-0 top-11 z-[120] flex w-40 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-700">
                  <IconFolderOpen className="h-3.5 w-3.5" /> 불러오기
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      closeMenus();
                      loadFile(e);
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    closeMenus();
                    saveFile();
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <IconSave className="h-3.5 w-3.5" /> 저장
                </button>
                <button
                  onClick={() => {
                    closeMenus();
                    setIsResetModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <IconReset className="h-3.5 w-3.5" /> 초기화
                </button>
              </div>
            )}
          </div>

          <HeaderButton
            onClick={() => setShowNavigator((prev) => !prev)}
            className={`hidden sm:inline-flex ${
              hasActionItems
                ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            }`}
          >
            가이드
          </HeaderButton>

          <div className="mx-1 hidden h-4 w-px bg-slate-200 sm:block dark:bg-neutral-700" />

          <div className="relative hidden sm:block">
            <HeaderButton
              onClick={() => toggleMenu('export')}
              className="border border-indigo-200 bg-white text-indigo-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-900/40 dark:bg-neutral-900 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
            >
              내보내기
            </HeaderButton>
            {openMenu === 'export' && (
              <div className="absolute right-0 top-11 z-[120] flex w-36 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
                <button
                  onClick={() => {
                    closeMenus();
                    handlePrint();
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <IconPrinter className="h-3.5 w-3.5" /> 인쇄
                </button>
                <button
                  onClick={() => {
                    closeMenus();
                    handleExcelExport?.();
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  disabled={!handleExcelExport}
                >
                  <IconTable className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            )}
          </div>

          <HeaderButton
            onClick={() => {
              setAiTargetId('root');
              setIsAiModalOpen(true);
            }}
            className="bg-indigo-600 px-2.5 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 sm:px-3 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <span className="text-xs text-indigo-200">✦</span>
            <span className="hidden sm:inline">AI 자동입력</span>
            <span className="sm:hidden">AI</span>
          </HeaderButton>

          <button
            onClick={() => setShowNavigator((prev) => !prev)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors sm:hidden ${
              hasActionItems
                ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            }`}
            title="가이드"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            title={isDarkMode ? '라이트 모드' : '다크 모드'}
          >
            {isDarkMode ? <IconSun className="h-4 w-4 text-amber-300" /> : <IconMoon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
