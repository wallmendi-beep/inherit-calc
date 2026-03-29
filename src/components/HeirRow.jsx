import React, { useState, useEffect } from 'react';
import { IconChevronRight, IconTrash2, IconMenu } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore, getRelStr } from '../engine/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 🏛️ 정밀 엑셀 그리드 HeirRow (Refined UI/UX)
 * 1. 선사망 배우자 권리 소멸 로직 강제 적용
 * 2. 엑셀/노션 데이터베이스 스타일 너비 동기화
 * 3. 가독성 중심의 심플한 디자인
 */
const HeirRow = ({ node, level, handleUpdate, removeHeir, addHeir, siblings, inheritedDate, onKeyDown, toggleSignal, rootIsHoju, isRootChildren, onTabClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  
  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  const isPreDeceasedCondition = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);

  // ⚖️ 선사망 배우자면 토글을 강제로 끄고 잠가버림 (권리 소멸 법리)
  const shouldDisableToggle = isSpouseType && isPreDeceasedCondition;
  // 토글 상태 (잠겼으면 강제 OFF(true), 아니면 사용자가 선택한 배제 상태)
  const isToggleOff = shouldDisableToggle ? true : (node.isExcluded || false);

  let shouldShowTabBtn = false;
  let tabBtnText = '재상속 ➔';

  if (isToggleOff) {
    if (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified') {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 ➔';
    }
  } else if (node.isDeceased) {
    shouldShowTabBtn = true;
    tabBtnText = isPreDeceasedCondition ? '대습상속 ➔' : '재상속 ➔';
  }

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const showHoju = node.relation === 'son' && lawEra !== '1991' && rootIsHoju !== false;
  const showMarriedDaughter = node.relation === 'daughter' && lawEra !== '1991';

  return (
    <div ref={setNodeRef} style={dndStyle} className="group/row flex items-center w-full px-2 py-2 mb-1 bg-white dark:bg-neutral-800 rounded-md border border-[#e5e5e5] dark:border-neutral-700 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700/50 transition-colors">
      
      {/* 1. 상태 (토글 스위치 - 노란색 전구 컨셉) */}
      <div className="w-[90px] flex justify-center shrink-0 items-center gap-1">
        <div {...attributes} {...listeners} className="cursor-grab text-neutral-400 hover:text-neutral-600 p-1 transition-opacity relative -left-[15px]">
          <IconMenu className="w-3.5 h-3.5" />
        </div>
        <button
          type="button"
          disabled={shouldDisableToggle}
          onClick={() => handleUpdate(node.id, 'isExcluded', !node.isExcluded)}
          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none disabled:opacity-100 ${
            shouldDisableToggle ? 'bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed' :
            !isToggleOff ? 'bg-amber-400/60 dark:bg-amber-500/60' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${!isToggleOff ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* 2. 성명 */}
      <div className="w-28 px-2 shrink-0 flex items-center">
        <input 
          type="text" 
          value={node.name} 
          onKeyDown={onKeyDown} 
          onChange={e => handleUpdate(node.id, 'name', e.target.value)} 
          className="w-full text-[14px] font-bold text-[#37352f] dark:text-slate-200 outline-none bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-amber-400" 
          placeholder="성명"
        />
      </div>

      {/* 3. 관계 */}
      <div className="w-24 px-2 shrink-0">
        <select 
          value={node.relation}
          onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
          className="w-full text-[13px] font-bold text-[#787774] dark:text-neutral-400 bg-transparent outline-none cursor-pointer"
        >
          <option value="wife">{lawEra === '1991' ? '배우자' : '처'}</option>
          <option value="husband">{lawEra === '1991' ? '배우자' : '남편'}</option>
          <option value="son">{lawEra === '1991' ? '자녀' : '아들'}</option>
          <option value="daughter">{lawEra === '1991' ? '자녀' : '딸'}</option>
          <option value="parent">직계존속</option>
          <option value="sibling">형제자매</option>
        </select>
      </div>

      {/* 4. 사망여부 및 일자 OR 상속포기/결격 드롭다운 */}
      <div className="w-[140px] pl-[28px] shrink-0 flex items-center">
        {isToggleOff && !shouldDisableToggle ? (
          <div className="relative w-full group/select">
            <select
              value={node.exclusionOption || 'renounce'}
              onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
              className="w-full bg-transparent text-[13px] font-bold text-[#c93f3a] dark:text-red-400 outline-none cursor-pointer appearance-none pr-5"
            >
              <option value="renounce">상속포기</option>
              <option value="disqualified">상속결격</option>
              {!isBefore(inheritedDate, '2024-04-25') && (
                <option value="lost">상속권 상실</option>
              )}
            </select>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#c93f3a] opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <input
              type="checkbox"
              checked={node.isDeceased || false}
              onChange={(e) => handleUpdate(node.id, 'isDeceased', e.target.checked)}
              className="w-3.5 h-3.5 accent-[#c93f3a] cursor-pointer shrink-0 opacity-80"
            />
            {node.isDeceased && (
              <DateInput
                value={node.deathDate}
                onKeyDown={onKeyDown}
                onChange={(v) => handleUpdate(node.id, 'deathDate', v)}
                className="flex-1 text-[13px] font-medium outline-none text-neutral-500 dark:text-neutral-400 bg-transparent"
                placeholder="사망일자"
              />
            )}
          </div>
        )}
      </div>

      {/* 5. 특수조건 (뱃지 영역) */}
      <div className="flex-1 pl-[41px] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* ⚖️ 상속권 없음 뱃지 (선사망, 상속포기, 상속결격, 상속권 상실 통합) */}
          {isToggleOff && (
            <span className="px-2 py-0.5 rounded-full border border-rose-400 bg-white text-[10px] font-bold text-neutral-500 shadow-sm whitespace-nowrap">
              상속권 없음
            </span>
          )}

          {/* 배우자 가산 지분 뱃지 */}
          {isSpouseType && !isToggleOff && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
              {lawEra === '1991' ? '배우자 +5할' : (node.relation === 'wife' ? '처 +5할' : '남편 +5할')}
            </span>
          )}

          {/* 호주 상속 뱃지 */}
          {showHoju && (
            <button
              type="button"
              onClick={() => handleUpdate(node.id, 'isHoju', !node.isHoju)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                node.isHoju
                  ? 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/30'
                  : 'bg-[#f8f8f7] text-[#a3a3a3] border-[#e5e5e5] dark:bg-neutral-800'
              }`}
            >
              {node.isHoju ? '✓ 호주상속 +5할' : '호주'}
            </button>
          )}

          {/* 출가녀(동일가적) 뱃지 */}
          {showMarriedDaughter && (
            <button
              type="button"
              onClick={() => handleUpdate(node.id, 'isSameRegister', node.isSameRegister === false ? true : false)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                node.isSameRegister !== false 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20' 
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20'
              }`}
            >
              {node.isSameRegister !== false ? '동일가적' : '출가(제적)'}
            </button>
          )}
      </div>

      {/* 6. 재상속/대습상속 버튼 */}
      <div className="w-28 flex justify-center shrink-0">
        {shouldShowTabBtn && onTabClick && (
          <button
            type="button"
            onClick={() => onTabClick(node.id)}
            className="bg-[#fffbeb] dark:bg-amber-900/40 text-[#b45309] dark:text-amber-500 border border-[#fde68a] dark:border-amber-700/50 px-3 py-1 rounded-md font-bold text-[12px] shrink-0 hover:bg-[#fef3c7] transition-colors shadow-sm"
          >
            {tabBtnText}
          </button>
        )}
      </div>

      {/* 7. 휴지통 (맨 우측 고정) */}
      <div className="w-20 flex justify-end shrink-0 pr-2">
        <button
          type="button"
          onClick={() => removeHeir(node.id)}
          className="text-[#a3a3a3] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 opacity-0 group-hover/row:opacity-100"
          title="삭제"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

    </div>
  );
};

export default HeirRow;
