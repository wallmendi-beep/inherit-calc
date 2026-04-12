import React, { useState, useMemo, useEffect } from 'react';
import { IconMenu, IconTrash2 } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore, getRelStr } from '../engine/utils';
import { MultiplierBadge, BadgeToggle } from './ui/InheritDesign';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const HeirRow = ({ node, finalShares, handleUpdate, removeHeir, inheritedDate, rootDeathDate, onKeyDown, rootIsHoju, onTabClick, parentNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

  // [v4.29] 실시간 계산된 지분 데이터 연동
  const calcShare = useMemo(() => {
    if (!finalShares) return null;
    const direct = finalShares.direct.find(s => s.personId === node.personId);
    if (direct) return direct;

    for (const group of (finalShares.subGroups || [])) {
      const sub = group.shares.find(s => s.personId === node.personId);
      if (sub) return sub;
    }
    return null;
  }, [finalShares, node.personId]);

  // [v4.29] 인터랙션 상태 관리
  const [showPredeceasedWarning, setShowPredeceasedWarning] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // [v4.29] 선사망 토글 3초 자동 원복 타이머
  useEffect(() => {
    let timer;
    if (showPredeceasedWarning) {
      timer = setTimeout(() => {
        setShowPredeceasedWarning(false);
        // 3초 후 다시 Off(Excluded: true)로 원복
        handleUpdate(node.id, { isExcluded: true });
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showPredeceasedWarning, node.id, handleUpdate]);

  const displayN = (node.exclusionOption === 'predeceased' && (!node.heirs || node.heirs.length === 0)) ? 0 : (calcShare ? calcShare.n : (node.shareN || 0));
  const displayD = (node.exclusionOption === 'predeceased' && (!node.heirs || node.heirs.length === 0)) ? 1 : (calcShare ? calcShare.d : (node.shareD || 1));
  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  const isPreDeceasedCondition = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);
  const isDaeseupContext = rootDeathDate && inheritedDate && inheritedDate !== rootDeathDate && isBefore(inheritedDate, rootDeathDate);
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;
  const isToggleOff = node.isExcluded || false;

  // 탭 버튼 및 스타일 결정
  let shouldShowTabBtn = false;
  let tabBtnText = '재상속 »';
  let tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700";
  let onBtnClick = () => onTabClick && onTabClick(node.id);

  if (isToggleOff) {
    if (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified' || node.exclusionOption === 'remarried') {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 »';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700";
    } else if (isPreDeceasedCondition && ['son', 'daughter', 'sibling'].includes(node.relation)) {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 »';
      tabBtnClass = "bg-transparent text-neutral-400 border border-neutral-300 border-dashed hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 hover:border-solid dark:border-neutral-700";
    }
  } else if (node.isDeceased) {
    if (isPreDeceasedCondition) {
      if (!isSpouseType) {
        shouldShowTabBtn = true;
        tabBtnText = '대습상속 »';
        tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700";
      }
    } else {
      shouldShowTabBtn = true;
      tabBtnText = '재상속 »';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700";
    }
  }

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const isRootParent = parentNode?.id === 'root';
  const isParentFemale = !isRootParent && ['wife', 'daughter', 'mother', 'sister'].includes(parentNode?.relation);
  const isParentMale = !isRootParent && ['husband', 'son', 'father', 'brother'].includes(parentNode?.relation);
  const showHoju = node.relation === 'son' && lawEra !== '1991' && rootIsHoju !== false && !isParentFemale;
  const showMarriedDaughter = node.relation === 'daughter' && lawEra !== '1991';
  const hasHistoryData = node.divorceDate || node.remarriageDate || node.marriageDate || node.restoreDate;

  // [v4.29] 엔진 데이터와 상관없이 UI를 강제로 잡고 있는 시각적 On 상태
  const [isPredeceasedActive, setIsPredeceasedActive] = useState(false);
  const isToggleVisuallyOn = isPredeceasedActive || !node.isExcluded;

  // [v4.30] 3초 자동 원복 타이머 (시각적 상태 중심)
  useEffect(() => {
    let timer;
    if (isPredeceasedActive) {
      timer = setTimeout(() => {
        setIsPredeceasedActive(false);
        setShowPredeceasedWarning(false);
        // 3초 후 실제 데이터도 다시 Off로 확실히 보정
        handleUpdate(node.id, { isExcluded: true });
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isPredeceasedActive, node.id, handleUpdate]);



  return (
    <>
      <div className="mb-0.5 flex flex-col w-full no-print">
        <div 
          ref={setNodeRef} 
          style={dndStyle} 
          data-node-id={node.id}
          className="group/row flex flex-col w-full pr-0 pl-0 bg-white dark:bg-neutral-800 rounded-md border border-[#e5e5e5] dark:border-neutral-700 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700/50 transition-colors relative z-10"
        >
          {/* A. 메인 상속인 데이터 행 */}
          <div className="flex items-center w-full min-h-[52px] py-1">
            {/* 0. 드래그 핸들 */}
            <div {...attributes} {...listeners} className="w-5 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-400 transition-colors ml-[10px] shrink-0">
              <IconMenu className="w-4 h-4" />
            </div>

            {/* 1. 상태 토글 (isToggleVisuallyOn으로 3초 강제 On 구현) */}
            <div className="ml-[20px] shrink-0 flex items-center">
              <button
                type="button"
                role="switch"
                aria-checked={isToggleVisuallyOn}
                onClick={() => {
                  // 선사망 상속인이고 현재 Off인 경우 -> 3초 강제 On 시동
                  if (node.exclusionOption === 'predeceased' && node.isExcluded && !isPredeceasedActive) {
                    setIsPredeceasedActive(true);
                    setShowPredeceasedWarning(true);
                    return; // 엔진 데이터 업데이트 생략 (시각적 잠금만 수행)
                  }

                  // 일반 상속인 토글
                  const nextExcluded = !node.isExcluded;
                  handleUpdate(node.id, {
                    isExcluded: nextExcluded,
                    exclusionOption: nextExcluded ? (isDaeseupSpouse ? 'remarried' : 'renounce') : ''
                  });
                }}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-all duration-200 ease-in-out focus:outline-none cursor-pointer
                  ${isToggleVisuallyOn ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${isToggleVisuallyOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* 2. 성명 */}
            <div className="w-[72px] ml-[50px] shrink-0 flex items-center">
              <input 
                type="text" 
                value={node.name} 
                onKeyDown={onKeyDown} 
                onChange={e => handleUpdate(node.id, 'name', e.target.value)} 
                lang="ko"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full text-[15px] font-bold text-[#37352f] dark:text-slate-200 outline-none bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-amber-400" 
                placeholder="성명"
              />
            </div>

            {/* 3. 관계 */}
            <div className="w-[76px] ml-[30px] shrink-0">
              <select 
                value={node.relation}
                onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
                className="w-full text-[15px] font-normal text-[#787774] dark:text-neutral-400 bg-transparent outline-none cursor-pointer"
              >
                {(!isParentFemale) && <option value="wife">{lawEra === '1991' ? '배우자' : '처'}</option>}
                {(!isParentMale) && <option value="husband">{lawEra === '1991' ? '배우자' : '남편'}</option>}
                <option value="son">{lawEra === '1991' ? '자녀' : '아들'}</option>
                <option value="daughter">{lawEra === '1991' ? '자녀' : '딸'}</option>
                <option value="parent">직계존속</option>
                <option value="sibling">형제자매</option>
              </select>
            </div>

            {/* 4. 사망여부 및 일자 */}
            <div className="w-[150px] ml-[30px] shrink-0 flex items-center text-[15px]">
              <div className="flex items-center gap-2 w-full">
                <input
                  type="checkbox"
                  checked={node.isDeceased || false}
                  onChange={(e) => handleUpdate({
                    type: 'updateDeathInfo',
                    nodeId: node.id,
                    isDeceased: e.target.checked,
                    deathDate: e.target.checked ? node.deathDate : '',
                    inheritedDate,
                  })}
                  className="w-4 h-4 accent-neutral-500 cursor-pointer shrink-0 opacity-60"
                />
                {node.isDeceased ? (
                  <DateInput
                    value={node.deathDate}
                    onKeyDown={onKeyDown}
                    onChange={(v) => handleUpdate({
                      type: 'updateDeathInfo',
                      nodeId: node.id,
                      deathDate: v,
                      isDeceased: !!v,
                      inheritedDate,
                    })}
                    className={`flex-1 text-[13px] font-bold outline-none bg-transparent ${isPreDeceasedCondition && !isSpouseType ? 'text-[#787774] dark:text-neutral-400' : 'text-[#37352f] dark:text-neutral-100'}`}
                    placeholder="사망일자"
                  />
                ) : (
                  <span className="text-[13px] text-[#787774] font-medium">생존</span>
                )}
              </div>
            </div>

            {/* 5. 특수조건 (멀티플라이어 전수 복구) */}
            <div className="w-[180px] ml-[10px] shrink-0 flex items-center gap-1.5">
              {node.exclusionOption === 'predeceased' ? (
                <div className="w-[150px] h-[26px] shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm" title="피상속인보다 먼저 사망하여 상속권이 발생하지 않습니다.">
                  <span className="text-[10.5px] font-black text-neutral-500 dark:text-neutral-400">상속권 없음 (선사망)</span>
                </div>
              ) : (isToggleOff && isSpouseType && isPreDeceasedCondition && !isPredeceasedActive) ? (
                <div className="w-[150px] h-[26px] shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">배우자 선사망 (상속권 없음)</span>
                </div>
              ) : (isToggleOff && !isPredeceasedActive) ? (
                <div className="relative w-[150px] group/select bg-[#f8f8f7] dark:bg-neutral-800 px-2.5 py-1 rounded border border-[#e5e5e5] dark:border-neutral-700 hover:border-neutral-300 transition-colors">
                  <select
                    value={node.exclusionOption || 'renounce'}
                    onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
                    className="w-full bg-transparent text-[13px] font-bold text-[#5d4037] dark:text-neutral-300 outline-none cursor-pointer appearance-none pr-5"
                  >
                    <option value="renounce">
                      {node.heirs && node.heirs.length > 0 
                        ? (node.isDeceased ? '대습상속 발생' : '대습상속(상속포기)')
                        : (isPreDeceasedCondition && !isSpouseType ? '대습상속인 없음' : (node.isDeceased ? '상속인 없음 (지분 재분배)' : '상속포기'))
                      }
                    </option>
                    <option value="disqualified">
                      {node.heirs && node.heirs.length > 0 ? '상속결격 (대습상속)' : '상속결격'}
                    </option>
                    {!isBefore(inheritedDate || rootDeathDate, '2024-04-25') && (
                      <option value="lost">
                        {node.heirs && node.heirs.length > 0 ? '상실선고 (대습상속)' : '상실선고'}
                      </option>
                    )}
                    {isDaeseupSpouse && <option value="remarried">대습 개시 전 재혼</option>}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              ) : (
                <>
                  {isSpouseType && (() => {
                    let label = getRelStr(node.relation, inheritedDate || rootDeathDate);
                    let multiplier = '';
                    if (lawEra === '1960' && node.relation === 'wife') multiplier = 'x 1/2';
                    else if (lawEra === '1979' && node.relation === 'wife') multiplier = 'x 1.5';
                    else if (lawEra === '1991') multiplier = 'x 1.5';

                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-[64px] h-[26px] shrink-0 flex items-center justify-center bg-white dark:bg-neutral-800 rounded-full border border-[#e9e9e7] dark:border-neutral-700 shadow-sm">
                          <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{label}</span>
                        </div>
                        <MultiplierBadge multiplier={multiplier} />
                      </div>
                    );
                  })()}

                  {!isSpouseType && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showHoju && (
                        <div className="flex items-center gap-1.5">
                          <BadgeToggle
                            active={node.isHoju}
                            onToggle={(val) => handleUpdate({ type: 'setHojuStatus', nodeId: node.id, isHoju: val })}
                            activeLabel="호주"
                            inactiveLabel="일반"
                            className="w-[64px]"
                          />
                          {node.isHoju && <MultiplierBadge multiplier="x 1.5" />}
                        </div>
                      )}
                      {showMarriedDaughter && (
                        <div className="flex items-center gap-1.5">
                          <BadgeToggle
                            active={node.isSameRegister !== false}
                            onToggle={(val) => handleUpdate(node.id, 'isSameRegister', val ? true : false)}
                            activeLabel="동일"
                            inactiveLabel="출가"
                            isInferred={node._isInferredRegister}
                            className="w-[64px]"
                          />
                          {(() => {
                            let m = '';
                            if (lawEra === '1960') m = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                            else if (lawEra === '1979' && node.isSameRegister === false) m = 'x 1/4';
                            return m ? <MultiplierBadge multiplier={m} /> : null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {((isSpouseType && inheritedDate !== rootDeathDate && !isPreDeceasedCondition) || node.relation === 'daughter') && (
                <button 
                  onClick={() => setIsHistoryModalOpen(true)}
                  className={`flex items-center justify-center shrink-0 w-[32px] h-[26px] rounded-md transition-colors border shadow-sm ${
                    hasHistoryData 
                      ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' 
                      : 'bg-white text-neutral-400 border-[#e9e9e7] hover:bg-[#f7f7f5] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-500'
                  }`}
                  title="상세 호적 연혁 (이혼, 재혼, 친가복적 등) 입력"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                </button>
              )}
            </div>

            {/* 6. 재상속/대습상속 버튼 */}
            <div className="w-[88px] ml-[20px] shrink-0 flex flex-col items-center justify-center gap-1">
              {(!isToggleOff || isPredeceasedActive) && !node.isDeceased && (
                <div className="flex items-center gap-0.5 text-[11px] font-black leading-none mb-0.5 ml-[-10px]">
                  <span className="text-[#1e56a0] dark:text-blue-400">{displayN}</span>
                  <span className="text-neutral-500 dark:text-neutral-500">/</span>
                  <span className="text-[#1e56a0] dark:text-blue-400">{displayD}</span>
                </div>
              )}
              {shouldShowTabBtn && onTabClick && (
                <button
                  type="button"
                  onClick={onBtnClick}
                  className={`w-full py-1 rounded-md font-bold text-[12px] shrink-0 border transition-all shadow-sm ${tabBtnClass}`}
                >
                  {tabBtnText}
                </button>
              )}
            </div>

            {/* 7. 삭제 버튼 */}
            <div className="w-12 shrink-0 flex justify-center ml-[30px] mr-[20px]">
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

          {/* B. 인라인 경고 슬라이드 행 */}
          {(showPredeceasedWarning || (node.exclusionOption === 'predeceased' && isSpouseType)) && (
            <div className="w-full flex items-center pl-[150px] py-1.5 animate-in slide-in-from-top-1 fade-in duration-300 ease-out fill-mode-forwards">
              <span className="text-[#92400e] text-[13px] font-semibold flex items-center gap-2 bg-[#fffcf0] px-3 py-1 rounded-md border border-[#fcd9a8]/50 shadow-sm mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#92400e]/70"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                {isSpouseType 
                  ? "선사망 배우자는 상속권이 없으므로 가계도에서 자동 제외됩니다. 사망일자의 오류가 있다면 수정해 주세요."
                  : "본인은 선사망하였으나 대습상속 등으로 인해 가계도에 포함되었습니다. 사망일자가 정확한지 확인해 주세요."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* C. 호적 연혁 모달창 복구 */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center no-print backdrop-blur-[1px]">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-[360px] w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7] modal-content-container">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[17px] font-bold flex items-center gap-1.5">
                <span className="text-black">'{node.name || '상속인'}'</span>
                <span className="text-neutral-400 font-medium">호적 연혁</span>
              </h2>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-neutral-400 hover:text-neutral-700 p-1 transition-colors rounded-full outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-[12px] font-medium text-[#787774] mb-5 leading-relaxed bg-[#f8f8f7] p-3 rounded-lg border border-[#e9e9e7]">
              입력된 날짜는 <span className="font-bold text-[#37352f]">피상속인 사망일({inheritedDate || '미상'})</span>과 대조되어 상속권 및 지분 판단에 자동 반영됩니다.
            </p>
            <div className="modal-nav-area">
              {isSpouseType && (
                <div className="mb-5 p-4 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg relative">
                  <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774]">상속권 / 대습상속 차단 사유</div>
                  <div className="space-y-3 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[13px] font-bold text-[#504f4c]">이혼 일자</label>
                        <div className="flex items-center gap-1">
                          {(!node.divorceDate && node._lastDivorceDate) && (
                            <button 
                              onClick={() => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { divorceDate: node._lastDivorceDate } })}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-bold border border-blue-200 px-1.5 py-0.5 rounded bg-blue-50/50"
                              title={`최근 입력값(${node._lastDivorceDate}) 복원`}
                            >복원</button>
                          )}
                          <DateInput value={node.divorceDate || ''} onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { divorceDate: v } })} className="w-[110px] border border-[#e5e5e5] rounded-md px-2 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] outline-none" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-bold text-[#504f4c]">재혼 일자</label>
                        <div className="flex items-center gap-1">
                          {(!node.remarriageDate && node._lastRemarriageDate) && (
                            <button 
                              onClick={() => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { remarriageDate: node._lastRemarriageDate } })}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-bold border border-blue-200 px-1.5 py-0.5 rounded bg-blue-50/50"
                              title={`최근 입력값(${node._lastRemarriageDate}) 복원`}
                            >복원</button>
                          )}
                          <DateInput value={node.remarriageDate || ''} onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { remarriageDate: v } })} className="w-[110px] border border-[#e5e5e5] rounded-md px-2 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {node.relation === 'daughter' && (
                  <div className="mb-6 p-4 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg relative">
                     <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774]">과거 민법 판별 (딸)</div>
                     <div className="space-y-4 pt-2">
                       <div className="flex items-center justify-between">
                         <label className="text-[13px] font-bold text-[#504f4c]">혼인 일자</label>
                         <div className="flex items-center gap-1">
                           {(!node.marriageDate && node._lastMarriageDate) && (
                             <button 
                               onClick={() => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { marriageDate: node._lastMarriageDate } })}
                               className="text-[10px] text-blue-500 hover:text-blue-700 font-bold border border-blue-200 px-1.5 py-0.5 rounded bg-blue-50/50"
                               title={`최근 입력값(${node._lastMarriageDate}) 복원`}
                             >복원</button>
                           )}
                           <DateInput value={node.marriageDate || ''} onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { marriageDate: v } })} className="w-[110px] border border-[#e5e5e5] rounded-md px-2 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] outline-none" />
                         </div>
                       </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-bold text-[#504f4c]">친가복적 일자</label>
                        <div className="flex items-center gap-1">
                          {(!node.restoreDate && node._lastRestoreDate) && (
                            <button 
                              onClick={() => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { restoreDate: node._lastRestoreDate } })}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-bold border border-blue-200 px-1.5 py-0.5 rounded bg-blue-50/50"
                              title={`최근 입력값(${node._lastRestoreDate}) 복원`}
                            >복원</button>
                          )}
                          <DateInput value={node.restoreDate || ''} onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { restoreDate: v } })} className="w-[110px] border border-[#e5e5e5] rounded-md px-2 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="w-full py-2.5 bg-[#f1f1ef] hover:bg-[#e5e5e1] text-[#37352f] font-bold rounded-lg transition-colors text-[13px] shadow-sm mt-2">입력 완료 및 닫기</button>
            </div>
          </div>
        )}
    </>
  );
};

export default HeirRow;
