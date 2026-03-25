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

    // 🎨 상태별 색상 정의 (사이드바와 통일)
    const getStatusStyle = (lvl, isDead, hasHeirs, isExpanded) => {
      let colorClass = 'text-[#2563eb] dark:text-blue-400 font-medium'; // 기본 상속인 (파란색, 미디엄 두께)
      if (isDead) colorClass = 'text-[#37352f] dark:text-neutral-100 font-bold'; // 사망자 (검정, 볼드 두께)
      
      let underlineClass = '';
      if (hasHeirs && !isExpanded) {
        underlineClass = 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4'; 
      }
      
      return `${colorClass} ${underlineClass}`;
    };

    const itemStyleClass = getStatusStyle(level, node.isDeceased, hasHeirs, isExpanded);

  return (
    <div className={`relative ${level > 0 ? 'ml-6 pl-4 border-l-2 border-[#d4d4d4] dark:border-neutral-700' : ''} py-1 transition-colors`}>
      <div 
        onClick={() => { if (hasHeirs) setIsExpanded(!isExpanded); }}
        className={`flex items-center gap-2 w-fit py-1.5 px-2 rounded-md transition-all select-none ${hasHeirs ? 'cursor-pointer hover:bg-[#e9e9e7] dark:hover:bg-neutral-800 active:scale-[0.98]' : ''} ${isExpanded && hasHeirs && level > 0 ? 'bg-[#f1f1ef] dark:bg-neutral-800/60' : ''}`}
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded ${hasHeirs ? 'bg-white dark:bg-neutral-900 border border-[#d4d4d4] dark:border-neutral-700 shadow-sm' : ''}`}>
          {hasHeirs ? (
            <IconChevronRight className={`w-3.5 h-3.5 text-[#504f4c] dark:text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4] dark:bg-neutral-700" />
          )}
        </div>
        
        <span className={`tracking-wide transition-colors ${level === 0 ? 'text-[18px]' : 'text-[16px]'} ${itemStyleClass}`}>
          {node.name}
        </span>
        
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[12px] text-[#504f4c] dark:text-slate-300 font-medium border border-[#d4d4d4] dark:border-slate-600 bg-[#fbfcfb] dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">
            {level === 0 ? '피상속인' : relStr[node.relation] || '자녀'}
          </span>
          
          {node.relation === 'son' && node.isHoju && <span className="text-[12px] text-[#1d4ed8] dark:text-blue-300 bg-[#bfdbfe] dark:bg-blue-900/40 border border-[#93c5fd] dark:border-blue-800/40 px-1.5 py-0.5 rounded font-bold">호주상속</span>}
          {node.relation === 'daughter' && node.isSameRegister === false && <span className="text-[12px] text-[#b91c1c] dark:text-red-300 bg-[#fee2e2] dark:bg-red-900/40 border border-[#fecaca] dark:border-red-800/40 px-1.5 py-0.5 rounded font-bold">출가녀</span>}
          {node.isDeceased && <span className="text-[12px] text-[#c93f3a] dark:text-red-400 bg-white dark:bg-slate-800 border border-[#c93f3a] dark:border-red-900/50 px-1.5 py-0.5 rounded font-bold">{node.deathDate} 사망</span>}
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
