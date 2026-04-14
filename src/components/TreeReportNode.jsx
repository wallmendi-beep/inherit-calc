import React, { useState, useEffect } from 'react';
import { IconChevronRight } from './Icons';
import { getRelStr, getLawEra, isBefore } from '../engine/utils';

const TreeReportNode = ({ node, level, treeToggleSignal, rootDeathDate, onDelete, navigationSignal }) => {
  const hasHeirs = node.heirs && node.heirs.length > 0;
  const [isExpanded, setIsExpanded] = useState(level === 0);

  // [v4.61] 네비게이션 신호에 따른 자동 펼치기 로직
  useEffect(() => {
    if (!navigationSignal?.targetId || !hasHeirs) return;
    
    const targetId = navigationSignal.targetId;
    
    // 현재 노드의 하위에 타겟이 있는지 확인하는 헬퍼 함수
    const isAncestorOfTarget = (n, tid) => {
      if (!n.heirs) return false;
      for (const h of n.heirs) {
        if (h.id === tid || h.personId === tid) return true;
        if (isAncestorOfTarget(h, tid)) return true;
      }
      return false;
    };

    if (isAncestorOfTarget(node, targetId)) {
      setIsExpanded(true);
    }
  }, [navigationSignal, node, hasHeirs]);

  // 구조적 오류 여부 판단 (자식 위치에 부모/형제가 들어온 경우)
  const isStructuralError = ['parent', 'sibling'].includes(node.relation);

  const [prevSignal, setPrevSignal] = useState(treeToggleSignal);
  if (treeToggleSignal !== prevSignal) {
    setPrevSignal(treeToggleSignal);
    if (treeToggleSignal > 0) setIsExpanded(true);
    else if (treeToggleSignal < 0) setIsExpanded(level === 0);
  }

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
      // 접혀있을 때의 밑줄도 차분한 회색으로 변경하여 미니멀리즘 유지
      underlineClass = 'underline decoration-[#d4d4d4] dark:decoration-neutral-600 decoration-2 underline-offset-4'; 
    }
    return `${colorClass} ${underlineClass}`;
  };

  const itemStyleClass = getStatusStyle(node, hasHeirs, isExpanded);

  return (
    <div 
      className={`relative ${level > 0 ? 'ml-5 pl-3.5 border-l border-[#e5e5e5] dark:border-neutral-700' : ''} py-0.5 transition-colors ${isStructuralError ? 'ring-2 ring-rose-500/50 bg-rose-50/30 rounded-lg' : ''}`}
      data-node-id={node.id}
    >
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

        {/* 🗑️ 구조적 오류 긴급 삭제 버튼 */}
        {isStructuralError && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`[경고] 잘못 입력된 관계(${node.relation})입니다.\n'${node.name}' 노드를 가계도에서 삭제하시겠습니까?`)) {
                onDelete && onDelete(node.id);
              }
            }}
            className="ml-2 flex items-center justify-center w-6 h-6 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors print:hidden"
            title="잘못된 관계 노드 삭제"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4H5a2 2 0 0 0-2 2v.092c0 .51.102 1.012.29 1.482l.848 2.12a.5.5 0 0 0 .462.306h10.8a.5.5 0 0 0 .462-.306l.848-2.12c.188-.47.29-.972.29-1.482V6a2 2 0 0 0-2-2h-1V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM8 3.75V4h4v-.25a1.25 1.25 0 0 0-1.25-1.25h-1.5A1.25 1.25 0 0 0 8 3.75ZM3.5 10.5V17a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6.5h-13Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      
      <div className={`grid transition-all duration-300 ease-in-out print:grid-rows-[1fr] print:opacity-100 print:mt-0 ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-0' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden print:overflow-visible">
          {node.heirs && node.heirs.map(h => (
            <TreeReportNode 
              key={h.id} 
              node={h} 
              level={level + 1} 
              treeToggleSignal={treeToggleSignal} 
              rootDeathDate={rootDeathDate || node.deathDate} 
              onDelete={onDelete}
              navigationSignal={navigationSignal}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TreeReportNode;
