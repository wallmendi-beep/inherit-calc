import React from 'react';
import { IconNetwork } from './Icons';
import TreeReportNode from './TreeReportNode';

export default function TreePanel({ tree, treeToggleSignal, isAllExpanded, setTreeToggleSignal, setIsAllExpanded }) {
  return (
    <div className="py-2 flex flex-col h-full animate-in fade-in duration-300">
      <div className="mb-5 p-4 bg-[#f8f8f7] dark:bg-neutral-800/50 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg text-[#787774] dark:text-neutral-300 text-[14px] font-semibold flex justify-between items-center no-print shadow-none">
        <div className="flex items-center gap-2">
          <IconNetwork className="w-5 h-5 shrink-0 opacity-50" />
          <span>이름을 클릭하면 하위 관계도를 펼치거나 접을 수 있습니다.</span>
        </div>
        <button
          onClick={() => {
            const next = Math.abs(treeToggleSignal) + 1;
            setTreeToggleSignal(isAllExpanded ? -next : next);
            setIsAllExpanded(!isAllExpanded);
          }}
          className="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-[#d4d4d4] dark:border-neutral-600 hover:bg-[#efefed] dark:hover:bg-neutral-700 text-[#37352f] dark:text-neutral-200 rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap"
        >
          {isAllExpanded ? '모두 접기' : '모두 펼치기'}
        </button>
      </div>
      <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 shadow-sm overflow-hidden">
        <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
      </div>
    </div>
  );
}
