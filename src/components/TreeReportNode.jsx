import React, { useState, useEffect } from 'react';
import { IconChevronRight } from './Icons';
import { relStr, getLawEra, isBefore } from '../engine/utils';

const TreeReportNode = ({ node, level, treeToggleSignal, rootDeathDate }) => {
  const hasHeirs = node.heirs && node.heirs.length > 0;
  const [isExpanded, setIsExpanded] = useState(level === 0);

  useEffect(() => {
    if (treeToggleSignal > 0) setIsExpanded(true);
    else if (treeToggleSignal < 0) setIsExpanded(level === 0);
  }, [treeToggleSignal, level]);

  // ⚖️ 법리 판단을 위한 변수들
  const lawEra = getLawEra(rootDeathDate || node.deathDate);
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  // 선사망 배우자 판단 (본인의 사망일이 피상속인의 사망일보다 빠른 경우)
  const isPreDeceasedSpouse = isSpouseType && node.isDeceased && node.deathDate && rootDeathDate && isBefore(node.deathDate, rootDeathDate);
  
  // 최종 상속권 배제 여부
  const isInheritanceLost = node.isExcluded || isPreDeceasedSpouse;

    // 🎨 상태별 색상 정의 (요약표/입력창과 통일)
    const getStatusStyle = (lvl, isDead, hasHeirs, isExpanded) => {
      let colorClass = 'text-[#37352f] dark:text-neutral-100 font-bold'; 
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

        <div className="flex items-center gap-1.5 ml-1 flex-wrap">
          {/* 🏷️ 신분 라벨 */}
          <span className="text-[13px] text-[#787774] dark:text-neutral-400 font-bold border border-[#e5e5e5] dark:border-neutral-700 bg-[#f8f8f7] dark:bg-neutral-800 px-1.5 py-0.5 rounded shadow-sm">
            {level === 0 ? '피상속인' : (relStr[node.relation] || '자녀')}
          </span>

          {/* ⚖️ 상속권 배제 처리 (최우선순위) */}
          {isInheritanceLost ? (
            <span className="px-2.5 py-1 rounded-full border border-neutral-300 bg-neutral-200 text-[12px] font-medium text-black shadow-sm whitespace-nowrap">
              상속권 없음
            </span>
          ) : (
            <>
              {/* ⚖️ 1960년대 처 감산 뱃지 */}
              {lawEra === '1960' && node.relation === 'wife' && (
                <span className="flex items-center px-2 py-0.5 rounded-full border border-rose-800/80 bg-white text-[12px] font-bold text-rose-800/80 shadow-sm whitespace-nowrap">
                  처 x 1/2
                </span>
              )}

              {/* ⚖️ 호주 상속 가산 뱃지 */}
              {node.relation === 'son' && node.isHoju && (
                <span className="flex items-center px-2 py-0.5 rounded-full border border-sky-800/80 bg-white text-[12px] font-bold text-sky-800/80 shadow-sm whitespace-nowrap">
                  호주 x 1.5
                </span>
              )}

              {/* ⚖️ 출가녀/동일가적 감산 뱃지 */}
              {node.relation === 'daughter' && (() => {
                let multiplier = '';
                let label = '';
                if (lawEra === '1960') {
                  label = node.isSameRegister !== false ? '여자' : '출가';
                  multiplier = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                } else if (lawEra === '1979' && node.isSameRegister === false) {
                  label = '출가';
                  multiplier = 'x 1/4';
                }

                return multiplier ? (
                  <span className="flex items-center px-2 py-0.5 rounded-full border border-rose-800/80 bg-white text-[12px] font-bold text-rose-800/80 shadow-sm whitespace-nowrap">
                    {label} {multiplier}
                  </span>
                ) : null;
              })()}
            </>
          )}

          {/* ⚰️ 사망 정보 */}
          {node.isDeceased && (
            <span className="text-[12px] text-neutral-500 font-bold ml-1">
              ({node.deathDate} 사망)
            </span>
          )}
        </div>
        {hasHeirs && !isExpanded && (
           <span className="ml-2 text-[12px] text-[#854d0e] dark:text-yellow-400 font-bold bg-[#fef9c3] dark:bg-yellow-900/20 border border-[#fef08a] dark:border-yellow-800/50 px-2 py-0.5 rounded-full animate-in fade-in zoom-in duration-200 shadow-sm print:hidden">
             상속인 {node.heirs.length}명 보기
           </span>
        )}
      </div>
      
      <div className={`grid transition-all duration-300 ease-in-out print:grid-rows-[1fr] print:opacity-100 print:mt-1 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden print:overflow-visible">
          {node.heirs && node.heirs.map(h => <TreeReportNode key={h.id} node={h} level={level + 1} treeToggleSignal={treeToggleSignal} rootDeathDate={rootDeathDate || node.deathDate} />)}
        </div>
      </div>
    </div>
  );
};

export default TreeReportNode;
