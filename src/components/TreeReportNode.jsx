import React, { useState, useEffect } from 'react';
import { IconChevronRight } from './Icons';
import { relStr } from '../engine/utils';

const TreeReportNode = ({ node, level, treeToggleSignal }) => {
  const hasHeirs = node.heirs && node.heirs.length > 0;
  const [isExpanded, setIsExpanded] = useState(level === 0);

  useEffect(() => {
    if (treeToggleSignal > 0) setIsExpanded(true);
    else if (treeToggleSignal < 0) setIsExpanded(level === 0);
  }, [treeToggleSignal, level]);

    // 🎨 상태별 색상 정의 (요약표/입력창과 통일)
    const getStatusStyle = (lvl, isDead, hasHeirs, isExpanded) => {
      let colorClass = 'text-[#37352f] dark:text-neutral-100 font-bold'; // 기본 상속인 (또렷한 차콜)
      
      let underlineClass = '';
      if (hasHeirs && !isExpanded) {
        underlineClass = 'underline decoration-rose-400 dark:decoration-rose-500 decoration-2 underline-offset-4'; 
      }
      
      return `${colorClass} ${underlineClass}`;
    };

    const itemStyleClass = getStatusStyle(level, node.isDeceased, hasHeirs, isExpanded);

  return (
    <div className={`relative ${level > 0 ? 'ml-6 pl-4 border-l-2 border-[#e5e5e5] dark:border-neutral-700' : ''} py-1 transition-colors`}>
      <div 
        onClick={() => { if (hasHeirs) setIsExpanded(!isExpanded); }}
        className={`flex items-center gap-2 w-fit py-1.5 px-2 rounded-md transition-all select-none ${hasHeirs ? 'cursor-pointer hover:bg-[#f8f8f7] dark:hover:bg-neutral-800 active:scale-[0.98]' : ''} ${isExpanded && hasHeirs && level > 0 ? 'bg-[#f8f8f7] dark:bg-neutral-800/60' : ''}`}
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded ${hasHeirs ? 'bg-white dark:bg-neutral-900 border border-[#e5e5e5] dark:border-neutral-700 shadow-sm' : ''}`}>
          {hasHeirs ? (
            <IconChevronRight className={`w-3.5 h-3.5 text-[#787774] dark:text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#e5e5e5] dark:bg-neutral-700" />
          )}
        </div>
        
        <span className={`tracking-tight transition-colors ${level === 0 ? 'text-[18px]' : 'text-[16px]'} ${itemStyleClass}`}>
          {node.name}
        </span>
        
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[13px] text-[#787774] dark:text-neutral-400 font-bold border border-[#e5e5e5] dark:border-neutral-700 bg-[#f8f8f7] dark:bg-neutral-800 px-1.5 py-0.5 rounded shadow-sm">
            {level === 0 ? '피상속인' : (relStr[node.relation] || '자녀')}
          </span>
          
          {node.relation === 'son' && node.isHoju && <span className="text-[12px] text-sky-600 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800/40 px-1.5 py-0.5 rounded font-bold">호주상속 +5할</span>}
          {node.relation === 'daughter' && node.isSameRegister === false && <span className="text-[12px] text-rose-600 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/40 px-1.5 py-0.5 rounded font-bold">출가(제적)</span>}
          {node.isDeceased && <span className="text-[12px] text-neutral-500 bg-white dark:bg-slate-800 border border-[#e5e5e5] dark:border-neutral-700 px-1.5 py-0.5 rounded font-bold">{node.deathDate} 사망</span>}
        </div>

        {hasHeirs && !isExpanded && (
           <span className="ml-2 text-[12px] text-[#854d0e] dark:text-yellow-400 font-bold bg-[#fef9c3] dark:bg-yellow-900/20 border border-[#fef08a] dark:border-yellow-800/50 px-2 py-0.5 rounded-full animate-in fade-in zoom-in duration-200 shadow-sm print:hidden">
             상속인 {node.heirs.length}명 보기
           </span>
        )}
      </div>
      
      <div className={`grid transition-all duration-300 ease-in-out print:grid-rows-[1fr] print:opacity-100 print:mt-1 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden print:overflow-visible">
          {node.heirs && node.heirs.map(h => <TreeReportNode key={h.id} node={h} level={level + 1} treeToggleSignal={treeToggleSignal} />)}
        </div>
      </div>
    </div>
  );
};

export default TreeReportNode;
