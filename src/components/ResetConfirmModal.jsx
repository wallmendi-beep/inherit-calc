import React from 'react';

export default function ResetConfirmModal({ isOpen, onSaveAndReset, onResetOnly, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-[2px] no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-5 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-800">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-neutral-400">
            Reset
          </div>
          <h2 className="mt-1 text-[22px] font-black text-slate-900 dark:text-neutral-100">새 작업 시작</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-neutral-300">
            현재 입력 내용을 정리하고 새 사건으로 시작합니다. 필요하면 먼저 백업 저장한 뒤 초기화할 수 있습니다.
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            onClick={onSaveAndReset}
            className="w-full rounded-xl border border-sky-200 bg-sky-100 px-4 py-3 text-left text-sky-800 shadow-sm transition-colors hover:bg-sky-200 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200"
          >
            <div className="text-[14px] font-bold">백업 저장 후 초기화</div>
            <div className="mt-1 text-[12px] text-sky-700 dark:text-sky-200/90">현재 사건을 파일로 저장한 뒤 새 입력 상태로 전환합니다.</div>
          </button>

          <button
            type="button"
            onClick={onResetOnly}
            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
          >
            <div className="text-[14px] font-bold">그냥 초기화</div>
            <div className="mt-1 text-[12px] text-rose-600 dark:text-rose-300/90">저장 없이 현재 입력 내용을 비우고 새 작업으로 전환합니다.</div>
          </button>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
