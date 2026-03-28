import React, { useState, useEffect } from 'react';
import { IconChevronRight, IconTrash2, IconMenu } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore, getRelStr } from '../engine/utils';
import { getLevelStyle, getLineStyle } from '../utils/styles';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 🏛️ 등기관 규격 준수 HeirRow (Logic Refined)
 * 1. 탭 이동 버튼 노출 로직 변수화 (법리 정확성 확보)
 * 2. 배우자 선사망 및 상속포기 시 버튼 자동 숨김
 * 3. 상황별 버튼 텍스트 분기 (대습상속 vs 재상속)
 */
const HeirRow = ({ node, level, handleUpdate, removeHeir, addHeir, siblings, inheritedDate, onKeyDown, toggleSignal, rootIsHoju, showSubHeirs = true, isRootChildren, onTabClick }) => {
  const isSp = node.relation === 'wife' || node.relation === 'husband';
  const isSon = node.relation === 'son';
  const isDaughter = node.relation === 'daughter';
  const isChild = node.relation === 'son' || node.relation === 'daughter';
  const lawEra = getLawEra(inheritedDate);

  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(false);
  }, [toggleSignal]);

  const showHoju = isSon && lawEra !== '1991' && rootIsHoju !== false;
  const showMarriedDaughter = isDaughter && lawEra !== '1991';
  const hasOtherHoju = siblings?.some(s => s.id !== node.id && s.isHoju);

  let nextInheritedDate = inheritedDate;
  if (node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
    nextInheritedDate = node.deathDate;
  }

  // 🔴 배제 사유 압축 (뱃지용)
  let disqualificationReason = '';
  if (isSp && isRootChildren && node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate)) {
    disqualificationReason = `선사망`;
  } else if (isSp && !isRootChildren && node.isRemarried && node.remarriageDate && inheritedDate && isBefore(node.remarriageDate, inheritedDate)) {
    disqualificationReason = `재혼(대습X)`;
  } else if (node.relation === 'husband' && level > 1 && lawEra !== '1991' && node.isSubstitution) {
    disqualificationReason = '사위(대습X)';
  }

  // --- 탭 이동 버튼 노출 및 텍스트 결정 로직 (★ 추가됨) ---
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  const isPreDeceasedCondition = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);

  let shouldShowTabBtn = false;
  let tabBtnText = '재상속 ➔';

  if (node.isExcluded) {
    // 1. 상속결격, 상속권 상실 -> 대습상속 O
    if (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified') {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 ➔';
    }
    // 2. 상속포기 -> 대습상속 절대 불가 (버튼 숨김)
    else if (node.exclusionOption === 'renounce') {
      shouldShowTabBtn = false;
    }
  } else if (node.isDeceased) {
    // 3. 배우자가 선사망한 경우 -> 대습상속 불가 (권리 소멸이므로 버튼 숨김)
    if (isSpouseType && isPreDeceasedCondition) {
      shouldShowTabBtn = false;
    } 
    // 4. 그 외 사망자 -> 선사망이면 대습상속, 아니면 순차(재)상속
    else {
      shouldShowTabBtn = true;
      tabBtnText = isPreDeceasedCondition ? '대습상속 ➔' : '재상속 ➔';
    }
  }
  // -------------------------------------------------------

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative'
  };

  const isActive = !node.isExcluded && !disqualificationReason;
  const boxStyle = getLevelStyle(level);
  const lineStyle = getLineStyle(level);

  // 🎨 스타일 상수
  const UI_CONFIG = {
    textMain: 'text-[#37352f] dark:text-neutral-200',
    textLabel: 'text-neutral-400 dark:text-neutral-500',
    btnAction: 'bg-[#fffbeb] dark:bg-amber-900/40 text-[#b45309] dark:text-amber-500 border border-[#fde68a] dark:border-amber-700/50 hover:bg-[#fef3c7] transition-colors',
    btnPositive: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0] hover:bg-[#d1fae5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    btnNegative: 'bg-[#fff1f2] text-[#be123e] border-[#fecdd3] hover:bg-[#ffe4e6] dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
    badgePositive: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    badgeNegative: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
    badgeNeutral: 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
  };

  return (
    <div ref={setNodeRef} style={dndStyle} className={`mt-1.5 ${level > 1 ? `ml-8 pl-4 border-l-[2px] ${lineStyle}` : ''}`}>
      <div className="flex items-center gap-1.5 group">
        
        {/* 1. 최좌측 섹션 */}
        <div {...attributes} {...listeners} className="cursor-grab text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
        </div>

        <div className="w-6 flex justify-center shrink-0">
          {(node.isDeceased || (node.isExcluded && node.exclusionOption === 'lost')) && showSubHeirs && (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded transition-colors">
              <IconChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        {/* 💡 상속권 스위치 */}
        <button 
          type="button" 
          onClick={() => handleUpdate(node.id, 'isExcluded', !node.isExcluded)}
          className={`p-1.5 rounded-md transition-all duration-300 shrink-0 border ${
            isActive 
              ? 'text-amber-500 bg-amber-50 border-amber-100' 
              : 'text-neutral-400 bg-neutral-50 border-neutral-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="currentColor" className="w-5 h-5">
            {isActive && <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 1v3M23 12h-3M4 12H1M19.7 4.3l-2.1 2.1M6.4 4.3l2.1 2.1" />}
            <path d="M12 7a5 5 0 0 0-5 5c0 1.8 1.3 3.5 2.2 5v1.5a1 1 0 0 0 1 1h3.6a1 1 0 0 0 1-1V17c.9-1.5 2.2-3.2 2.2-5a5 5 0 0 0-5-5Z" />
            <path d="M9.8 21h4.4v1a1 1 0 0 1-1 1h-2.4a1 1 0 0 1-1-1v-1Z" />
          </svg>
        </button>

        {/* 🏛️ 메인 데이터 슬롯 */}
        <div className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
          isActive 
            ? 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 shadow-sm' 
            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 shadow-sm'
        }`}>
          {/* 성명 */}
          <div className="flex items-center gap-2 w-32 shrink-0 border-r border-neutral-100 dark:border-neutral-700 pr-2">
            <span className={`text-[10px] font-bold uppercase tracking-tighter shrink-0 ${UI_CONFIG.textLabel}`}>성명</span>
            <input 
              type="text" 
              value={node.name} 
              onKeyDown={onKeyDown} 
              onChange={e => handleUpdate(node.id, 'name', e.target.value)} 
              className={`w-full text-[14px] font-bold outline-none bg-transparent ${UI_CONFIG.textMain}`} 
            />
          </div>
          
          {/* 관계 */}
          <div className="flex items-center gap-2 w-24 shrink-0 border-r border-neutral-100 dark:border-neutral-700 pr-2">
            <span className={`text-[10px] font-bold uppercase tracking-tighter shrink-0 ${UI_CONFIG.textLabel}`}>관계</span>
            <select 
              value={lawEra === '1991' ? (node.relation === 'daughter' ? 'son' : (node.relation === 'husband' ? 'wife' : node.relation)) : node.relation}
              onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
              className={`w-full text-[13px] font-bold bg-transparent outline-none cursor-pointer appearance-none ${UI_CONFIG.textMain}`}
            >
              {lawEra === '1991' ? (<><option value="wife">배우자</option><option value="son">자녀</option></>) : (<><option value="wife">처</option><option value="husband">남편</option><option value="son">아들</option><option value="daughter">딸</option></>)}
              <option value="parent">직계존속</option>
              <option value="sibling">형제자매</option>
            </select>
          </div>

          {/* 사망/배제 상태 */}
          <div className="flex items-center gap-2 shrink-0">
            {node.isExcluded ? (
              <div className="flex items-center rounded-md border border-[#d4d4d4] dark:border-neutral-600 bg-[#f8f8f7] dark:bg-neutral-800 shrink-0 relative transition-colors">
                <select 
                  value={node.exclusionOption || 'renounce'} 
                  onChange={e => handleUpdate(node.id, 'exclusionOption', e.target.value)} 
                  className="pl-3 pr-7 py-1.5 text-[13.5px] font-bold text-[#c93f3a] dark:text-red-400 bg-transparent outline-none cursor-pointer appearance-none w-full"
                >
                  <option value="renounce" className="text-[#37352f] dark:text-neutral-200">상속포기</option>
                  <option value="disqualified" className="text-[#37352f] dark:text-neutral-200">상속결격</option>
                  {(!inheritedDate || !isBefore(inheritedDate, '2024-04-25')) && (
                     <option value="lost" className="text-[#37352f] dark:text-neutral-200">상속권 상실</option>
                  )}
                </select>
                <div className="pointer-events-none absolute right-2 flex items-center text-[#787774] dark:text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex items-center rounded-md border border-neutral-200 bg-white dark:bg-neutral-800">
                <label className="flex items-center px-1.5 py-1 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={node.isDeceased || false} 
                    onChange={e => { handleUpdate(node.id, 'isDeceased', e.target.checked); if (!e.target.checked) handleUpdate(node.id, 'deathDate', ''); }} 
                    className="w-3.5 h-3.5 cursor-pointer accent-[#c93f3a]" 
                  />
                </label>
                {node.isDeceased && (
                   <div className="flex items-center pr-2 group/death">
                     <DateInput 
                        value={node.deathDate} 
                        onChange={v => handleUpdate(node.id, 'deathDate', v)} 
                        className={`w-[95px] px-1 py-0.5 text-[12.5px] font-bold bg-transparent text-center outline-none ${UI_CONFIG.textMain}`} 
                     />
                     <span className={`text-[11px] font-bold mr-1 ${UI_CONFIG.textLabel}`}>사망</span>
                   </div>
                )}
              </div>
            )}
          </div>

          {/* 🏷️ 뱃지 및 버튼 섹션 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 🟢 가산 정보 */}
            {isSp && isActive && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight border whitespace-nowrap ${UI_CONFIG.badgePositive}`}>
                {lawEra === '1991' ? '배우자 +5할' : (node.relation === 'wife' ? '처 +5할' : '남편 +5할')}
              </span>
            )}

            {/* 🟢 호주 +5할 */}
            {showHoju && (
              <button
                type="button"
                onClick={() => !hasOtherHoju || node.isHoju ? handleUpdate(node.id, 'isHoju', !node.isHoju) : null}
                disabled={hasOtherHoju && !node.isHoju}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all ${
                  node.isHoju ? UI_CONFIG.btnPositive : 'bg-white text-neutral-400 border-neutral-200 hover:border-emerald-300'
                }`}
              >
                {node.isHoju ? '호주 +5할' : '호주 지정'}
              </button>
            )}

            {/* 🔴 배제 정보 (타원형 뱃지) */}
            {!node.isExcluded && disqualificationReason && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight border whitespace-nowrap ${UI_CONFIG.badgeNegative}`}>
                {disqualificationReason}
              </span>
            )}
            {node.isExcluded && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight border whitespace-nowrap ${(!node.exclusionOption || node.exclusionOption === 'renounce' || node.exclusionOption === 'disqualified') ? UI_CONFIG.badgeNeutral : UI_CONFIG.badgePositive}`}>
                {(!node.exclusionOption || node.exclusionOption === 'renounce' || node.exclusionOption === 'disqualified') ? '대습 X' : '대습 O'}
              </span>
            )}

            {/* 🔴 출가녀 로직 */}
            {showMarriedDaughter && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleUpdate(node.id, 'isSameRegister', node.isSameRegister === false ? true : false)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-all border ${
                    node.isSameRegister !== false ? UI_CONFIG.btnAction : UI_CONFIG.btnNegative
                  }`}
                >
                  {node.isSameRegister !== false ? '동일가적' : '출가(제적)'}
                </button>
                {node.isSameRegister === false && (
                  <div className="flex items-center pr-3 group/marriage">
                    <DateInput 
                      value={node.marriageDate} 
                      onKeyDown={onKeyDown} 
                      onChange={v => handleUpdate(node.id, 'marriageDate', v)} 
                      placeholder="YYYY-MM-DD" 
                      className={`w-[105px] px-1 py-1 text-[13.5px] font-bold outline-none bg-transparent text-center ${UI_CONFIG.textMain}`} 
                    />
                    <span className={`text-[13px] font-bold ${UI_CONFIG.textMain}`}>제적</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 🟡 최우측 액션부 (휴지통 위치 고정 순서 적용) */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {shouldShowTabBtn && onTabClick && (
              <button
                type="button"
                onClick={() => onTabClick(node.id)}
                className={`${UI_CONFIG.btnAction} px-3 py-1.5 rounded-md font-bold text-[13px] shrink-0 active:scale-95 shadow-sm flex items-center gap-1`}
              >
                {tabBtnText}
              </button>
            )}

            <button 
              type="button" 
              onClick={() => removeHeir(node.id)} 
              className="p-1.5 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all" 
              title="삭제"
            >
              <IconTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeirRow;
