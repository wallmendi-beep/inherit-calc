import React, { useState, useEffect } from 'react';
import { IconChevronRight, IconTrash2, IconMenu } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore, getRelStr } from '../engine/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const HeirRow = ({ node, level, handleUpdate, removeHeir, addHeir, siblings, inheritedDate, rootDeathDate, onKeyDown, toggleSignal, rootIsHoju, isRootChildren, onTabClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  
  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  const isPreDeceasedCondition = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);

  const isDaeseupContext = rootDeathDate && inheritedDate && inheritedDate !== rootDeathDate && isBefore(inheritedDate, rootDeathDate);
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;

  const isToggleOff = node.isExcluded || false;

  let shouldShowTabBtn = false;
  let tabBtnText = '재상속 »';
  let tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700 dark:hover:bg-blue-900/20";
  let onBtnClick = () => onTabClick && onTabClick(node.id);

  if (isToggleOff) {
    if (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified' || node.exclusionOption === 'remarried') {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 »';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700 dark:hover:bg-emerald-900/20";
    } else if (isPreDeceasedCondition && ['son', 'daughter', 'sibling'].includes(node.relation)) {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 입력 »';
      tabBtnClass = "bg-transparent text-neutral-400 border border-neutral-300 border-dashed hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 hover:border-solid dark:border-neutral-700";
      onBtnClick = () => {
        handleUpdate(node.id, 'isExcluded', false);
        if (onTabClick) onTabClick(node.id);
      };
    }
  } else if (node.isDeceased) {
    if (isPreDeceasedCondition) {
      if (!isSpouseType) {
        shouldShowTabBtn = true;
        tabBtnText = '대습상속 »';
        tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700 dark:hover:bg-emerald-900/20";
      }
    } else {
      shouldShowTabBtn = true;
      tabBtnText = '재상속 »';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700 dark:hover:bg-blue-900/20";
    }
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
    <>
      <div ref={setNodeRef} style={dndStyle} className="group/row flex items-center justify-start w-full pr-0 pl-0 py-2 mb-1 bg-white dark:bg-neutral-800 rounded-md border border-[#e5e5e5] dark:border-neutral-700 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700/50 transition-colors relative">
      
      {/* 0. 드래그 핸들 */}
      <div {...attributes} {...listeners} className="w-5 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-400 transition-colors ml-[10px] shrink-0">
        <IconMenu className="w-4 h-4" />
      </div>

      {/* 1. 상태 토글 */}
      <div className="ml-[20px] shrink-0 flex items-center">
        <button
          type="button"
          role="switch"
          aria-checked={!node.isExcluded}
          onClick={() => {
            const nextExcluded = !node.isExcluded;
            handleUpdate(node.id, {
              isExcluded: nextExcluded,
              exclusionOption: nextExcluded ? (isDaeseupSpouse ? 'remarried' : 'renounce') : ''
            });
          }}
          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-in-out focus:outline-none ${!node.isExcluded ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'}`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${!node.isExcluded ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* 2. 성명 */}
      <div className="w-[72px] ml-[50px] shrink-0 flex items-center">
        <input 
          type="text" 
          value={node.name} 
          onKeyDown={onKeyDown} 
          onChange={e => handleUpdate(node.id, 'name', e.target.value)} 
          className="w-full text-[15px] font-bold text-[#37352f] dark:text-slate-200 outline-none bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-amber-400" 
          placeholder="성명"
        />
      </div>

      {/* 3. 관계 */}
      <div className="w-24 ml-[30px] shrink-0">
        <select 
          value={node.relation}
          onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
          className="w-full text-[15px] font-normal text-[#787774] dark:text-neutral-400 bg-transparent outline-none cursor-pointer"
        >
          <option value="wife">{lawEra === '1991' ? '배우자' : '처'}</option>
          <option value="husband">{lawEra === '1991' ? '배우자' : '남편'}</option>
          <option value="son">{lawEra === '1991' ? '자녀' : '아들'}</option>
          <option value="daughter">{lawEra === '1991' ? '자녀' : '딸'}</option>
          <option value="parent">직계존속</option>
          <option value="sibling">형제자매</option>
        </select>
      </div>

      {/* 4. 사망여부 및 일자 (항상 노출되어 수정 가능) */}
      <div className="w-[150px] ml-[30px] shrink-0 flex items-center text-[15px]">
        <div className="flex items-center gap-2 w-full">
          <input
            type="checkbox"
            checked={node.isDeceased || false}
            onChange={(e) => handleUpdate(node.id, 'isDeceased', e.target.checked)}
            className="w-4 h-4 accent-neutral-500 cursor-pointer shrink-0 opacity-60"
          />
          {node.isDeceased ? (
            <DateInput
              value={node.deathDate}
              onKeyDown={onKeyDown}
              onChange={(v) => {
                handleUpdate(node.id, 'deathDate', v);
                const isPre = v && inheritedDate && isBefore(v, inheritedDate);
                if (isPre) {
                  handleUpdate(node.id, 'isExcluded', true);
                  if (['son', 'daughter', 'sibling'].includes(node.relation)) {
                    handleUpdate(node.id, 'exclusionOption', 'renounce');
                  }
                } else if (v) {
                  handleUpdate(node.id, 'isExcluded', false);
                  handleUpdate(node.id, 'exclusionOption', '');
                }
              }}
              className={`flex-1 text-[13px] font-bold outline-none bg-transparent ${isPreDeceasedCondition && !isSpouseType ? 'text-[#37352f]' : 'text-[#787774] dark:text-neutral-400'}`}
              placeholder="사망일자"
            />
          ) : (
            <span className="text-[13px] text-[#787774] font-medium">생존</span>
          )}
        </div>
      </div>

      {/* 5. 특수조건 (드롭다운 OR 가감산) - 레이아웃 분리 성공! */}
      <div className="w-[180px] ml-[10px] shrink-0 flex items-center gap-1.5">
        {/* 💡 배우자 선사망은 특수조건 고정 뱃지 */}
        {isToggleOff && isSpouseType && isPreDeceasedCondition ? (
          <div className="w-[150px] h-[26px] shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">배우자 선사망 (상속권 없음)</span>
          </div>
        ) : isToggleOff ? (
          /* 💡 스위치가 꺼지면 이 자리에 제외 사유 선택창이 나타남! */
          <div className="relative w-[150px] group/select bg-[#f8f8f7] dark:bg-neutral-800 px-2.5 py-1 rounded border border-[#e5e5e5] dark:border-neutral-700 hover:border-neutral-300 transition-colors">
            <select
              value={node.exclusionOption || 'renounce'}
              onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
              className="w-full bg-transparent text-[13px] font-bold text-[#5d4037] dark:text-neutral-300 outline-none cursor-pointer appearance-none pr-5"
            >
              <option value="renounce">
                {/* 💡 핵심 픽스: 하위 상속인(heirs)이 있다면 '대습상속' 관련 문구로, 없다면 '상속인 없음'으로 능동적으로 변환 */}
                {node.heirs && node.heirs.length > 0 
                  ? (node.isDeceased ? '대습상속 발생' : '대습상속(상속포기)')
                  : (isPreDeceasedCondition && !isSpouseType ? '대습상속인 없음' : (node.isDeceased ? '상속인 없음 (지분 재분배)' : '상속포기'))
                }
              </option>
              <option value="disqualified">
                {node.heirs && node.heirs.length > 0 ? '상속결격 (대습상속)' : '상속결격'}
              </option>
              {/* 🚨 2024-04-25 이후에만 상실선고 노출! */}
              {!isBefore(rootDeathDate, '2024-04-25') && (
                <option value="lost">
                  {node.heirs && node.heirs.length > 0 ? '상실선고 (대습상속)' : '상실선고'}
                </option>
              )}
              {isDaeseupSpouse && <option value="remarried">대습 개시 전 재혼</option>}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          /* 💡 스위치가 켜져 있을 땐 정상적인 가감산 로직 노출 */
          <>
            {/* 배우자 로직 */}
            {isSpouseType && (() => {
              let label = lawEra === '1991' ? '배우자' : (node.relation === 'wife' ? '처' : '남편');
              let multiplier = '';
              if (lawEra === '1960' && node.relation === 'wife') multiplier = 'x 1/2';
              else if (lawEra === '1979' && node.relation === 'wife') multiplier = 'x 1.5';
              else if (lawEra === '1991') multiplier = 'x 1.5';

              return (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-[96px] h-[26px] shrink-0 flex items-center justify-center bg-white dark:bg-neutral-800 rounded-full border border-[#e9e9e7] dark:border-neutral-700 shadow-sm">
                    <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{label}</span>
                  </div>
                  {multiplier && (
                    <span className={`px-2.5 py-0.5 rounded-full border bg-white text-[11px] font-medium shadow-sm whitespace-nowrap ${multiplier.includes('1.5') ? 'border-emerald-800/80 text-emerald-800/80' : 'border-rose-800/80 text-rose-800/80'}`}>{multiplier}</span>
                  )}
                </div>
              );
            })()}

            {/* 호주/출가녀 로직 */}
            {!isSpouseType && (
              <div className="flex items-center gap-1.5 shrink-0">
                {showHoju && (
                  <div className="flex items-center gap-1.5">
                    <div onClick={() => handleUpdate(node.id, 'isHoju', !node.isHoju)} className="relative flex items-center w-[96px] h-[26px] bg-[#efefed] dark:bg-neutral-900 rounded-full border border-[#e5e5e5] dark:border-neutral-700 p-0.5 cursor-pointer select-none">
                      <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] bg-white dark:bg-neutral-700 rounded-full shadow-sm border border-[#e5e5e5] dark:border-neutral-600 transition-transform duration-300 ${node.isHoju ? 'translate-x-[calc(100%-1px)]' : 'translate-x-0'}`} />
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${!node.isHoju ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>일반</div>
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isHoju ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>호주</div>
                    </div>
                    {node.isHoju && <span className="px-2.5 py-0.5 rounded-full border border-sky-800/80 bg-white text-[11px] font-medium text-sky-800/80 shadow-sm whitespace-nowrap">x 1.5</span>}
                  </div>
                )}
                {showMarriedDaughter && (
                  <div className="flex items-center gap-1.5">
                    <div onClick={() => handleUpdate(node.id, 'isSameRegister', node.isSameRegister === false ? true : false)} className="relative flex items-center w-[96px] h-[26px] bg-[#efefed] dark:bg-neutral-900 rounded-full border border-[#e5e5e5] dark:border-neutral-700 p-0.5 cursor-pointer select-none">
                      <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] bg-white dark:bg-neutral-700 rounded-full shadow-sm border border-[#e5e5e5] dark:border-neutral-600 transition-transform duration-300 ${node.isSameRegister === false ? 'translate-x-[calc(100%-1px)]' : 'translate-x-0'}`} />
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isSameRegister !== false ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>동일</div>
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isSameRegister === false ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>출가</div>
                    </div>
                    {(() => {
                      let m = '';
                      if (lawEra === '1960') m = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                      else if (lawEra === '1979' && node.isSameRegister === false) m = 'x 1/4';
                      return m ? <span className="px-2.5 py-0.5 rounded-full border border-rose-800/80 bg-white text-[11px] font-medium text-rose-800/80 shadow-sm whitespace-nowrap">{m}</span> : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. 재상속/대습상속 버튼 */}
      <div className="w-28 shrink-0 flex justify-center ml-[10px]">
        {shouldShowTabBtn && onTabClick && (
          <button
            type="button"
            onClick={onBtnClick}
            className={`px-3 py-1.5 rounded-md font-bold text-[13px] shrink-0 border transition-all shadow-sm ${tabBtnClass}`}
          >
            {tabBtnText}
          </button>
        )}
      </div>

      {/* 7. 삭제 버튼 */}
      <div className="w-12 shrink-0 flex justify-center ml-0 mr-[10px]">
        <button
          type="button"
          onClick={() => removeHeir(node.id)}
          className="text-[#a3a3a3] hover:text-neutral-600 transition-colors p-1.5 rounded-md hover:bg-neutral-100 opacity-0 group-hover/row:opacity-100"
          title="삭제"
        >
          <IconTrash2 className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* 안내 문구 (무채색) */}
    {isPreDeceasedCondition && (!node.heirs || node.heirs.length === 0) && !node.isExcluded && (
      <div className="flex px-4 py-1.5 bg-neutral-50 dark:bg-neutral-900/40 border-t border-dashed border-neutral-200 dark:border-neutral-700">
        <div className="w-[60px] shrink-0"></div>
        <div className="flex-1 text-[11px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <IconChevronRight className="w-3 h-3" />
          {isSpouseType ? (
            "배우자 선사망은 대습상속이 일어나지 않습니다. 사망일자 오류가 있다면 수정해 주세요."
          ) : (
            "선사망자의 대습상속인(배우자/자녀)을 추가해 주세요. 대습상속인이 없다면 좌측 스위치를 꺼서 '제외' 처리해 주세요."
          )}
        </div>
      </div>
    )}
  </>
);
};

export default HeirRow;
