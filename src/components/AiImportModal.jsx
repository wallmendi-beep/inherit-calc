import React from 'react';
import { IconFileText, IconPrinter, IconX } from './Icons';

export default function AiImportModal({
  isOpen,
  targetName,
  aiInputText,
  setAiInputText,
  onClose,
  onCopyPrompt,
  onPrintPrompt,
  onSubmit,
  onTextareaAutoSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#e9e9e7] dark:border-neutral-600">
        <div className="px-6 py-4 border-b border-[#e9e9e7] dark:border-neutral-600 flex justify-between items-center transition-colors">
          <h2 className="text-[16px] font-bold text-[#37352f] dark:text-neutral-100 flex items-center gap-2">
            <span className="text-[18px]">AI</span>
            {targetName} AI 상속인 자동 입력
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
            <IconX size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="bg-[#f7f7f5] dark:bg-neutral-900/90 border border-[#e9e9e7] dark:border-neutral-600 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-neutral-500">
                <IconFileText size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold text-[#37352f] dark:text-neutral-200 mb-1">1단계: 가이드라인 복사</h3>
                <p className="text-[13px] text-[#787774] dark:text-neutral-300 mb-5 leading-relaxed">
                  아래 버튼으로 안내문을 복사한 뒤 ChatGPT 등 AI 서비스에 붙여 넣고, 문서 사진이나 관계 정보와 함께 JSON 응답을 받아 여기에 붙여 넣어 주세요.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onCopyPrompt}
                    className="flex-1 py-2.5 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 rounded-md font-bold hover:bg-[#efefed] dark:hover:bg-neutral-700 transition-all shadow-sm flex items-center justify-center gap-2 text-[13px]"
                  >
                    AI 안내문 복사하기
                  </button>
                  <button
                    onClick={onPrintPrompt}
                    className="w-10 h-10 flex items-center justify-center border border-[#e9e9e7] dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-[#efefed] dark:hover:bg-neutral-700 rounded-md transition-all shadow-sm"
                    title="가이드라인 인쇄"
                  >
                    <IconPrinter size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[14px] font-bold text-[#37352f] dark:text-neutral-200 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 bg-[#2383e2] text-white rounded-full text-[10px] font-black">2</span>
              결과 데이터 입력
            </h3>
            <textarea
              value={aiInputText}
              onChange={(e) => {
                const value = e.target.value;
                setAiInputText(value);
                if (value.length > 50) onTextareaAutoSubmit(value);
              }}
              placeholder="AI가 생성한 JSON 코드를 여기에 붙여 넣으세요. 일정 길이 이상이면 자동으로 파싱을 시도합니다."
              className="w-full h-44 p-4 border border-[#e9e9e7] dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-[#2383e2]/20 focus:border-[#2383e2] outline-none text-[13px] font-mono bg-white dark:bg-neutral-900 text-[#37352f] dark:text-neutral-200 placeholder:text-neutral-400 transition-all resize-none shadow-inner"
            />
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-[11px] text-[#787774] dark:text-neutral-400 italic">
                붙여 넣은 뒤 자동 인식이 되지 않으면 아래 실행 버튼으로 직접 입력을 진행할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e9e9e7] dark:border-neutral-600 flex justify-end gap-2 bg-[#f7f7f5]/50 dark:bg-neutral-900/70 transition-colors">
          <button onClick={onClose} className="px-4 py-2 text-[#787774] dark:text-neutral-300 font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-all text-[13px]">
            닫기
          </button>
          <button
            onClick={() => onSubmit(aiInputText)}
            className="px-5 py-2 bg-[#37352f] dark:bg-neutral-100 hover:bg-[#201f1c] dark:hover:bg-white text-white dark:text-[#37352f] rounded-md font-bold shadow-md transition-all text-[13px] flex items-center gap-2"
          >
            직접 입력 실행
          </button>
        </div>
      </div>
    </div>
  );
}
