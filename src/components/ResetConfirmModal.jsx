import React from 'react';

export default function ResetConfirmModal({ isOpen, onSaveAndReset, onResetOnly, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center no-print text-[#37352f]">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 border border-[#e9e9e7]">
        <h2 className="text-xl font-bold mb-2">새 작업 시작</h2>
        <div className="flex flex-col gap-2 mt-6">
          <button onClick={onSaveAndReset} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">
            백업 저장 후 초기화
          </button>
          <button onClick={onResetOnly} className="w-full py-2.5 bg-[#ffe2dd] hover:bg-[#ffc1b8] text-[#d44c47] font-medium rounded transition-colors text-[14px]">
            그냥 초기화
          </button>
          <button onClick={onClose} className="w-full py-2.5 mt-2 bg-white border border-[#d4d4d4] text-[#37352f] font-medium rounded transition-colors text-[14px]">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
