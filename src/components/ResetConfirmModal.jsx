import React from 'react';
import { IconX } from './Icons';

export default function ResetConfirmModal({ isOpen, onSaveAndReset, onResetOnly, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in duration-150 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-2xl dark:border-neutral-600 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e9e9e7] px-6 py-4 dark:border-neutral-600">
          <h2 className="text-[16px] font-bold text-[#37352f] dark:text-neutral-100">새 작업 시작</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-[13px] leading-relaxed text-[#787774] dark:text-neutral-300">
            현재 입력 내용을 정리하고 새 사건으로 시작합니다. 필요하면 먼저 백업 저장한 뒤 초기화할 수 있습니다.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onSaveAndReset}
              className="w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sky-800 shadow-sm transition-colors hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200"
            >
              <div className="text-[14px] font-bold">백업 저장 후 초기화</div>
              <div className="mt-1 text-[12px] text-sky-700 dark:text-sky-200/90">현재 사건을 파일로 저장한 뒤 새 입력 상태로 전환합니다.</div>
            </button>

            <button
              type="button"
              onClick={onResetOnly}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
            >
              <div className="text-[14px] font-bold">저장 없이 초기화</div>
              <div className="mt-1 text-[12px] text-rose-600 dark:text-rose-300/90">저장 없이 현재 입력 내용을 비우고 새 작업으로 전환합니다.</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#e9e9e7] bg-[#f7f7f5]/50 px-6 py-4 dark:border-neutral-600 dark:bg-neutral-900/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e9e9e7] bg-white px-4 py-2 text-[13px] font-bold text-[#787774] transition-colors hover:bg-[#efefed] dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
