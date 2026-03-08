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

  return (
    <div className={`relative ${level > 0 ? 'ml-6 pl-4 border-l-2 border-[#d4d4d4]' : ''} py-1`}>
      <div 
        onClick={() => { if (hasHeirs) setIsExpanded(!isExpanded); }}
        className={`flex items-center gap-2 w-fit py-1.5 px-2 rounded-md transition-all select-none ${hasHeirs ? 'cursor-pointer hover:bg-[#e9e9e7] active:scale-[0.98]' : ''} ${isExpanded && hasHeirs && level > 0 ? 'bg-[#f1f1ef]' : ''}`}
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded ${hasHeirs ? 'bg-white border border-[#d4d4d4] shadow-sm' : ''}`}>
          {hasHeirs ? (
            <IconChevronRight className={`w-3.5 h-3.5 text-[#504f4c] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4]" />
          )}
        </div>
        
        <span className={`font-bold tracking-wide transition-colors ${level === 0 ? 'text-[#37352f] text-[18px]' : 'text-[#0b6e99] text-[16px]'} ${!isExpanded && hasHeirs ? 'hover:text-[#2383e2]' : ''}`}>
          {node.name}
        </span>
        
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[12px] text-[#504f4c] font-medium border border-[#d4d4d4] bg-[#fbfcfb] px-1.5 py-0.5 rounded shadow-sm">
            {level === 0 ? '피상속인' : relStr[node.relation] || '자녀'}
          </span>
          
          {node.relation === 'son' && node.isHoju && <span className="text-[12px] text-[#1d4ed8] bg-[#bfdbfe] border border-[#93c5fd] px-1.5 py-0.5 rounded font-bold">호주상속</span>}
          {node.relation === 'daughter' && node.isSameRegister === false && <span className="text-[12px] text-[#b91c1c] bg-[#fee2e2] border border-[#fecaca] px-1.5 py-0.5 rounded font-bold">출가녀</span>}
          {node.isDeceased && <span className="text-[12px] text-[#c93f3a] bg-white border border-[#c93f3a] px-1.5 py-0.5 rounded font-bold">{node.deathDate} 사망</span>}
        </div>

        {hasHeirs && !isExpanded && (
           <span className="ml-2 text-[12px] text-[#2383e2] font-bold bg-[#e8f3ff] border border-[#bfe0ff] px-2 py-0.5 rounded-full animate-in fade-in zoom-in duration-200 shadow-sm print:hidden">
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
