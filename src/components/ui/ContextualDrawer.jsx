import React from 'react';

export default function ContextualDrawer({ isOpen, onClose, title, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/10 backdrop-blur-[1px] transition-opacity duration-300 ease-in-out md:hidden ${
          isOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed right-0 z-40 flex max-w-full transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-in-out dark:border-neutral-800 dark:bg-neutral-900 ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
        style={{ 
          top: '60px', 
          height: 'calc(100vh - 60px)',
          width: isOpen ? '310px' : 0 
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/80">
          <h2 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="hover-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
