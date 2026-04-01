import React, { useState, useEffect } from 'react';
import { IconChevronRight } from './Icons';
import { getRelStr, getLawEra, isBefore, formatKorDate } from '../engine/utils';

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
  // 선사망 배우자 판단
  const isPreDeceasedSpouse = isSpouseType && node.isDeceased && node.deathDate && rootDeathDate && isBefore(node.deathDate, rootDeathDate);
  
  // 최종 상속권 배제 여부
  const isInheritanceLost = node.isExcluded || isPreDeceasedSpouse;

  // 🎨 상태별 색상 정의 (이름 색상만 남기고 톤다운)
  const getStatusStyle = (node, hasHeirs, isExpanded) => {
    const isAlive = !node.deathDate && !node.isDeceased;
    
    // 생존자: 차분한 남색
    let colorClass = 'text-[#1e56a0] dark:text-[#60a5fa] font-bold'; 
    if (!isAlive) {
      // 사망자: 검정색
      colorClass = 'text-[#37352f] dark:text-neutral-200 font-bold'; 
    }
    
    let underlineClass = '';
    if (hasHeirs && !isExpanded) {
      // 접혀있을 때의 밑줄도 붉은색에서 차분한 회색으로 변경
      underlineClass = 'underline decoration-[#d4d4d4] dark:decoration-neutral-600 decoration-2 underline-offset-4'; 
    }
    return `${colorClass} ${underlineClass}`;
  };

  const itemStyleClass = getStatusStyle(node, hasHeirs, isExpanded);

  return (
    <div className={`relative ${level > 0 ? 'ml-5 pl-3.5 border-l border-[#e5e5e5] dark:border-neutral-700' : ''} py-0.5 transition-colors`}>
      <div 
        onClick={() => { if (hasHeirs) setIsExpanded(!isExpanded); }}
        className={`flex items-center gap-1.5 w-fit py-1 px-1.5 rounded-md transition-all select-none ${hasHeirs ? 'cursor-pointer hover:bg-[#f8f8f7] dark:hover:bg-neutral-800' : ''}`}
      >
        <div className={`flex items-center justify-center w-4 h-4 rounded ${hasHeirs ? 'bg-white dark:bg-neutral-900 border border-[#e5e5e5] dark:border-neutral-700' : ''}`}>
          {hasHeirs ? (
            <IconChevronRight className={`w-3 h-3 text-[#a3a3a3] dark:text-neutral-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <div className="w-1 h-1 rounded-full bg-[#d4d4d4] dark:bg-neutral-600" />
          )}
        </div>

        {/* 💡 이름: 크기를 16px에서 13.5px로 축소 */}
        <span className={`tracking-tight transition-colors text-[13.5px] ${itemStyleClass}`}>
          {node.name}
        </span>

        <div className="flex items-center gap-1 ml-1 flex-wrap">
          {/* 🏷️ 신분 라벨 (크기 축소 및 회색 톤) */}
          <span className="text-[11.5px] text-[#787774] dark:text-neutral-400 font-medium border border-[#e5e5e5] dark:border-neutral-700 bg-[#f8f8f7] dark:bg-neutral-800 px-1.5 py-0.5 rounded">
            {level === 0 ? '피상속인' : (getRelStr(node.relation, rootDeathDate || node.deathDate) || '자녀')}
          </span>

          {/* 💀 사망일자 (붉은색 제거, 회색 톤) */}
          {node.isDeceased && (
            <span className="text-[12px] text-[#787774] dark:text-neutral-400 whitespace-nowrap ml-0.5">
              {node.deathDate} 사망
            </span>
          )}

          {/* ⚖️ 상속권 상태 및 가감산 뱃지 (크기 축소, 올 그레이 톤) */}
          <div className="flex items-center gap-1 flex-wrap ml-0.5">
            {isInheritanceLost ? (
              <span className="px-1.5 py-0.5 rounded border border-[#e5e5e5] bg-[#f8f8f7] text-[11px] text-[#787774] whitespace-nowrap">
                상속권 없음
              </span>
            ) : (
              <>
                {lawEra === '1960' && node.relation === 'wife' && (
                  <span className="px-1.5 py-0.5 rounded border border-[#e5e5e5] bg-white text-[11px] text-[#787774] whitespace-nowrap">
                    처 x 1/2
                  </span>
                )}
                {node.relation === 'son' && node.isHoju && (
                  <span className="px-1.5 py-0.5 rounded border border-[#e5e5e5] bg-white text-[11px] text-[#787774] whitespace-nowrap">
                    호주 x 1.5
                  </span>
                )}
                {node.relation === 'daughter' && (() => {
                  let m = '';
                  let l = '';
                  if (lawEra === '1960') {
                    l = node.isSameRegister !== false ? '여자' : '출가';
                    m = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                  } else if (lawEra === '1979' && node.isSameRegister === false) {
                    l = '출가';
                    m = 'x 1/4';
                  }
                  return m ? (
                    <span className="flex items-center px-1.5 py-0.5 rounded border border-[#e5e5e5] bg-white text-[11px] text-[#787774] whitespace-nowrap">
                      {l} {m}
                    </span>
                  ) : null;
                })()}
              </>
            )}
          </div>
        </div>

        {/* 👁️ 상속인 보기 버튼 (노란색 제거, 회색 톤) */}
        {hasHeirs && !isExpanded && (
           <span className="ml-1 text-[11px] text-[#787774] font-medium bg-[#f8f8f7] border border-[#e5e5e5] px-2 py-0.5 rounded-full print:hidden">
             상속인 {node.heirs.length}명 보기
           </span>
        )}
      </div>
      
      <div className={`grid transition-all duration-300 ease-in-out print:grid-rows-[1fr] print:opacity-100 print:mt-0 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-0' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden print:overflow-visible">
          {node.heirs && node.heirs.map(h => <TreeReportNode key={h.id} node={h} level={level + 1} treeToggleSignal={treeToggleSignal} rootDeathDate={rootDeathDate || node.deathDate} />)}
        </div>
      </div>
    </div>
  );
};

export default TreeReportNode;
