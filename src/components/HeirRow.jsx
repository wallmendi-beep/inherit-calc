import React, { useEffect, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconMenu, IconTrash2 } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, getRelStr, isBefore } from '../engine/utils';
import { MultiplierBadge, BadgeToggle } from './ui/InheritDesign';

const RELATION_OPTIONS = {
  wife: { modern: '배우자', legacy: '처' },
  husband: { modern: '배우자', legacy: '남편' },
  son: { modern: '자녀', legacy: '아들' },
  daughter: { modern: '자녀', legacy: '딸' },
  parent: { modern: '직계존속', legacy: '직계존속' },
  sibling: { modern: '형제자매', legacy: '형제자매' },
};

const SPECIAL_LABELS = {
  disqualified: '상속결격',
  lost: '상속권 상실',
  remarried: '재혼으로 인한 제외',
};

export default function HeirRow({
  node,
  finalShares,
  handleUpdate,
  removeHeir,
  inheritedDate,
  rootDeathDate,
  onKeyDown,
  rootIsHoju,
  onTabClick,
  parentNode,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

  const calcShare = useMemo(() => {
    if (!finalShares) return null;
    const direct = (finalShares.direct || []).find((share) => share.personId === node.personId);
    if (direct) return direct;
    for (const group of finalShares.subGroups || []) {
      const subShare = (group.shares || []).find((share) => share.personId === node.personId);
      if (subShare) return subShare;
    }
    return null;
  }, [finalShares, node.personId]);

  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = ['wife', 'husband', 'spouse'].includes(node.relation);
  const isPreDeceasedCondition = !!(node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate));
  const isPredeceasedSpouse = isSpouseType && isPreDeceasedCondition;
  const isAnyPredeceased = isPreDeceasedCondition;
  const isDaeseupContext = !!(rootDeathDate && inheritedDate && inheritedDate !== rootDeathDate && isBefore(inheritedDate, rootDeathDate));
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;
  const blocksHusbandSubstitution = node.relation === 'husband' && isDaeseupContext && lawEra !== '1991';
  const isToggleOff = !!node.isExcluded || blocksHusbandSubstitution;
  const isEffectivePredeceased = isPreDeceasedCondition && !isSpouseType;
  const effectiveExclusionOption = isToggleOff
    ? (blocksHusbandSubstitution ? 'blocked_husband_substitution' : (node.exclusionOption || (isEffectivePredeceased ? 'predeceased' : 'renounce')))
    : '';

  const [showPredeceasedWarning, setShowPredeceasedWarning] = useState(false);
  const [isWarningClosing, setIsWarningClosing] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPredeceasedActive, setIsPredeceasedActive] = useState(false);
  const handleUpdateRef = React.useRef(handleUpdate);

  useEffect(() => {
    handleUpdateRef.current = handleUpdate;
  }, [handleUpdate]);

  useEffect(() => {
    if (!showPredeceasedWarning) return undefined;
    setIsWarningClosing(false);
    const closeTimer = setTimeout(() => {
      setIsWarningClosing(true);
    }, 2700);
    const hideTimer = setTimeout(() => {
      setShowPredeceasedWarning(false);
      setIsWarningClosing(false);
      handleUpdateRef.current(node.id, {
        isExcluded: true,
        exclusionOption: blocksHusbandSubstitution ? 'blocked_husband_substitution' : 'predeceased',
      });
    }, 3000);
    return () => {
      clearTimeout(closeTimer);
      clearTimeout(hideTimer);
    };
  }, [showPredeceasedWarning, node.id, blocksHusbandSubstitution]);

  useEffect(() => {
    if (!isPredeceasedActive) return undefined;
    const timer = setTimeout(() => {
      setIsPredeceasedActive(false);
      setShowPredeceasedWarning(false);
      setIsWarningClosing(false);
      handleUpdateRef.current(node.id, { isExcluded: true, exclusionOption: 'predeceased' });
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPredeceasedActive, node.id]);

  const isToggleVisuallyOn = isPredeceasedActive || !isToggleOff;
  const displayN = isEffectivePredeceased && isToggleOff && (!node.heirs || node.heirs.length === 0)
    ? 0
    : (calcShare ? calcShare.n : (node.shareN || 0));
  const displayD = isEffectivePredeceased && isToggleOff && (!node.heirs || node.heirs.length === 0)
    ? 1
    : (calcShare ? calcShare.d : (node.shareD || 1));

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const isRootParent = parentNode?.id === 'root';
  const isParentFemale = !isRootParent && ['wife', 'daughter', 'mother', 'sister'].includes(parentNode?.relation);
  const isParentMale = !isRootParent && ['husband', 'son', 'father', 'brother'].includes(parentNode?.relation);
  const isMaleNode = node.gender === 'male' || ['son', 'husband'].includes(node.relation);
  const showHoju = isMaleNode && lawEra !== '1991' && rootIsHoju !== false && !isParentFemale;
  const showMarriedDaughter = node.relation === 'daughter' && lawEra !== '1991';
  const hasHistoryData = !!(node.divorceDate || node.remarriageDate || node.marriageDate || node.restoreDate);

  let shouldShowTabBtn = false;
  let tabBtnText = '재상속 >>';
  let tabBtnClass = 'bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700';

  if (isPredeceasedSpouse || blocksHusbandSubstitution) {
    shouldShowTabBtn = false;
  } else if (isToggleOff) {
    if (['lost', 'disqualified', 'remarried'].includes(effectiveExclusionOption)) {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 >>';
      tabBtnClass = 'bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700';
    } else if (isEffectivePredeceased && ['son', 'daughter', 'sibling'].includes(node.relation)) {
      shouldShowTabBtn = true;
      tabBtnText = '대습상속 >>';
      tabBtnClass = 'bg-transparent text-neutral-400 border border-neutral-300 border-dashed hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 hover:border-solid dark:border-neutral-700';
    }
  } else if (node.isDeceased) {
    shouldShowTabBtn = true;
    if (isEffectivePredeceased) {
      tabBtnText = '대습상속 >>';
      tabBtnClass = 'bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700';
    } else {
      tabBtnText = '재상속 >>';
      tabBtnClass = 'bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700';
    }
  }

  const renderOffLabel = () => {
    if (isEffectivePredeceased) return (node.heirs || []).length > 0 ? '대습상속 진행' : '대습상속인 없음';
    if (blocksHusbandSubstitution) return '사위(대습상속 불가)';
    if (node.isDeceased && (node.heirs || []).length > 0) return '재상속 경로';
    if (node.isDeceased) return '상속인 없음 (지분 재분배)';
    return '상속포기';
  };

  return (
    <>
      <div className="mb-0.5 flex w-full flex-col no-print">
        <div
          ref={setNodeRef}
          style={dndStyle}
          data-node-id={node.id}
          className="group/row relative z-10 flex w-full flex-col rounded-md border border-[#e5e5e5] bg-white transition-colors hover:bg-[#f8f8f7] dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700/50"
        >
          <div className="flex min-h-[52px] w-full items-center py-1">
            <div {...attributes} {...listeners} className="ml-[10px] flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-neutral-300 transition-colors hover:text-neutral-400 active:cursor-grabbing">
              <IconMenu className="h-4 w-4" />
            </div>

            <div className="ml-[20px] flex shrink-0 items-center">
              <button
                type="button"
                role="switch"
                aria-checked={isToggleVisuallyOn}
                onClick={() => {
                  if (blocksHusbandSubstitution) {
                    setShowPredeceasedWarning(true);
                    setIsWarningClosing(false);
                    return;
                  }

                  if (isAnyPredeceased && isToggleOff && !isPredeceasedActive) {
                    setIsPredeceasedActive(true);
                    setShowPredeceasedWarning(true);
                    return;
                  }

                  const nextExcluded = !isToggleOff;
                  handleUpdate(node.id, {
                    isExcluded: nextExcluded,
                    exclusionOption: nextExcluded ? (isDaeseupSpouse ? 'remarried' : 'renounce') : '',
                  });
                }}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-all duration-200 ease-in-out focus:outline-none ${isToggleVisuallyOn ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${isToggleVisuallyOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="ml-[50px] flex w-[72px] shrink-0 items-center">
              <div className="w-full shrink-0">
                <input
                  type="text"
                  value={node.name}
                  onKeyDown={onKeyDown}
                  onChange={(e) => handleUpdate(node.id, 'name', e.target.value)}
                  lang="ko"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full border-b border-transparent bg-transparent text-[15px] font-bold text-[#37352f] outline-none hover:border-neutral-200 focus:border-amber-400 dark:text-slate-200"
                  placeholder="성명"
                />
              </div>
            </div>

            <div className="ml-[30px] w-[76px] shrink-0">
              <select
                value={node.relation}
                onChange={(e) => handleUpdate(node.id, 'relation', e.target.value)}
                className="w-full cursor-pointer bg-transparent text-[15px] font-normal text-[#787774] outline-none dark:text-neutral-400"
              >
                {!isParentFemale && <option value="wife">{lawEra === '1991' ? RELATION_OPTIONS.wife.modern : RELATION_OPTIONS.wife.legacy}</option>}
                {!isParentMale && <option value="husband">{lawEra === '1991' ? RELATION_OPTIONS.husband.modern : RELATION_OPTIONS.husband.legacy}</option>}
                <option value="son">{lawEra === '1991' ? RELATION_OPTIONS.son.modern : RELATION_OPTIONS.son.legacy}</option>
                <option value="daughter">{lawEra === '1991' ? RELATION_OPTIONS.daughter.modern : RELATION_OPTIONS.daughter.legacy}</option>
                <option value="parent">직계존속</option>
                <option value="sibling">형제자매</option>
              </select>
            </div>

            <div className="ml-[30px] flex w-[150px] shrink-0 items-center text-[15px]">
              <div className="flex w-full items-center gap-2">
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
                  className="h-4 w-4 shrink-0 cursor-pointer accent-neutral-500 opacity-60"
                />
                {node.isDeceased ? (
                  <DateInput
                    value={node.deathDate}
                    onKeyDown={onKeyDown}
                    onChange={(value) => handleUpdate({
                      type: 'updateDeathInfo',
                      nodeId: node.id,
                      deathDate: value,
                      isDeceased: node.isDeceased,
                      inheritedDate,
                    })}
                    className={`flex-1 bg-transparent text-[13px] font-bold outline-none ${isEffectivePredeceased ? 'text-[#787774] dark:text-neutral-400' : 'text-[#37352f] dark:text-neutral-100'}`}
                    placeholder="사망일자"
                  />
                ) : (
                  <span className="text-[13px] font-medium text-[#787774]">생존</span>
                )}
              </div>
            </div>

            <div className="ml-[10px] flex w-[180px] shrink-0 items-center gap-1.5">
              {(isEffectivePredeceased && isToggleOff && !isPredeceasedActive) ? (
                <div className="flex h-[26px] w-[120px] shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                  <span className="text-[10.5px] font-normal text-neutral-500 dark:text-neutral-400">
                    {(node.heirs || []).length > 0 ? '대습상속 진행' : '상속권 없음 (선사망)'}
                  </span>
                </div>
              ) : (isToggleOff && isSpouseType && isPreDeceasedCondition && !isPredeceasedActive) ? (
                <div className="flex h-[26px] w-[150px] shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                  <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400">배우자 선사망 (상속권 없음)</span>
                </div>
              ) : (isToggleOff && !isPredeceasedActive) ? (
                <div className="group/select relative w-[120px] rounded border border-[#e5e5e5] bg-[#f8f8f7] px-2.5 py-1 transition-colors hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800">
                  <select
                    value={effectiveExclusionOption || 'renounce'}
                    onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
                    className="w-full cursor-pointer appearance-none bg-transparent pr-5 text-[13px] font-normal text-[#5d4037] outline-none dark:text-neutral-300"
                  >
                    <option value="renounce">{renderOffLabel()}</option>
                    <option value="disqualified">{(node.heirs || []).length > 0 ? '상속결격 (대습상속)' : '상속결격'}</option>
                    {!isBefore(inheritedDate || rootDeathDate, '2024-04-25') && (
                      <option value="lost">{(node.heirs || []).length > 0 ? '상속권 상실 (대습상속)' : '상속권 상실'}</option>
                    )}
                    {isDaeseupSpouse && <option value="remarried">재혼으로 인한 제외</option>}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              ) : (
                <>
                  {isSpouseType && (() => {
                    let multiplier = '';
                    if (lawEra === '1960' && node.relation === 'wife') multiplier = 'x 1/2';
                    else if (lawEra === '1979' && node.relation === 'wife') multiplier = 'x 1.5';
                    else if (lawEra === '1991') multiplier = 'x 1.5';

                    if (blocksHusbandSubstitution) {
                      return (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div className="flex h-[26px] w-[80px] shrink-0 items-center justify-center rounded-full border border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                            <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{getRelStr(node.relation, inheritedDate || rootDeathDate)}</span>
                          </div>
                          <div className="flex h-[26px] shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 px-2.5 shadow-sm dark:border-red-900/40 dark:bg-red-900/20">
                            <span className="text-[10.5px] font-semibold text-red-600 dark:text-red-300">사위(대습상속 불가)</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <div className="flex h-[26px] w-[80px] shrink-0 items-center justify-center rounded-full border border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                          <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{getRelStr(node.relation, inheritedDate || rootDeathDate)}</span>
                        </div>
                        <MultiplierBadge multiplier={multiplier} />
                      </div>
                    );
                  })()}

                  {!isSpouseType && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {showHoju && (
                        <div className="flex items-center gap-1.5">
                          <BadgeToggle
                            active={node.isHoju}
                            onToggle={(value) => handleUpdate({ type: 'setHojuStatus', nodeId: node.id, isHoju: value })}
                            activeLabel="호주상속"
                            inactiveLabel="재산상속"
                            hoverClassName="hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200"
                            className="w-[80px]"
                          />
                          {node.isHoju && <MultiplierBadge multiplier="x 1.5" />}
                        </div>
                      )}
                      {showMarriedDaughter && (
                        <div className="flex items-center gap-1.5">
                          <BadgeToggle active={node.isSameRegister !== false} onToggle={(value) => handleUpdate(node.id, 'isSameRegister', value ? true : false)} activeLabel="동일가적" inactiveLabel="비동일가적" isInferred={node._isInferredRegister} inactiveClassName="border-neutral-400 bg-neutral-100 text-[#37352f]" hoverClassName="hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200" className="w-[80px]" />
                          {(() => {
                            let multiplier = '';
                            if (lawEra === '1960') multiplier = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                            else if (lawEra === '1979' && node.isSameRegister === false) multiplier = 'x 1/4';
                            return multiplier ? <MultiplierBadge multiplier={multiplier} /> : null;
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
                  className={`flex h-[26px] w-[32px] shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors ${hasHistoryData ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-400' : 'border-[#e9e9e7] bg-white text-neutral-400 hover:bg-[#f7f7f5] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500'}`}
                  title="상세 인적 사항 입력"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                </button>
              )}
            </div>

            <div className="ml-[30px] flex w-[88px] shrink-0 flex-col items-center justify-center gap-1">
              {(!isToggleOff || isPredeceasedActive) && !node.isDeceased && (
                <div className="ml-[-10px] mb-0.5 flex items-center gap-0.5 text-[11px] font-black leading-none">
                  <span className="text-[#1e56a0] dark:text-blue-400">{displayN}</span>
                  <span className="text-neutral-500 dark:text-neutral-500">/</span>
                  <span className="text-[#1e56a0] dark:text-blue-400">{displayD}</span>
                </div>
              )}
              {shouldShowTabBtn && onTabClick && (
                <button
                  type="button"
                  onClick={() => onTabClick(node.id)}
                  className={`ml-[10px] w-full shrink-0 rounded-md border py-1 text-[12px] font-normal shadow-sm transition-all ${tabBtnClass}`}
                >
                  {tabBtnText}
                </button>
              )}
            </div>

            <div className="ml-[25px] mr-[20px] flex w-12 shrink-0 justify-center">
              <button
                type="button"
                onClick={() => removeHeir(node.id)}
                className="rounded-md p-1.5 text-[#a3a3a3] opacity-0 transition-colors hover:bg-neutral-100 hover:text-neutral-600 group-hover/row:opacity-100"
                title="삭제"
              >
                <IconTrash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {showPredeceasedWarning && (
            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${showPredeceasedWarning ? (isWarningClosing ? 'max-h-0 opacity-0 -translate-y-2' : 'max-h-16 opacity-100 translate-y-0') : 'max-h-16 opacity-100 translate-y-0'}`}
            >
              <div className="flex w-full items-center py-1.5 pl-[150px]">
                <span className="mb-1 flex items-center gap-2 rounded-md border border-[#fcd9a8]/50 bg-[#fffcf0] px-3 py-1 text-[13px] font-semibold text-[#92400e] shadow-sm transition-all duration-300 ease-out">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#92400e]/70"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                {isSpouseType
                  ? (blocksHusbandSubstitution
                    ? '1991년 이전 사위는 대습상속권이 없습니다. 피상속인의 사위가 아니라면 관계를 수정하세요.'
                    : '선사망 배우자는 상속권이 없으므로 자동 제외됩니다. 사망일자가 맞는지 확인해 주세요.')
                  : '선사망자는 대습상속 여부를 다시 확인해 주세요. 별도 정보가 없으면 3초 후 원상복구됩니다.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-[1px] no-print">
          <div className="modal-content-container mx-4 w-full max-w-[360px] rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
                <span className="text-black">{node.name || '상속인'}</span>
                <span className="font-medium text-neutral-400">인적 사항</span>
              </h2>
              <button onClick={() => setIsHistoryModalOpen(false)} className="rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="mb-5 rounded-lg border border-[#e9e9e7] bg-[#f8f8f7] p-3 text-[12px] font-medium leading-relaxed text-[#787774]">
              입력된 날짜는 피상속인 사망일({inheritedDate || '미입력'})과 비교되어 상속권 판단에 반영됩니다.
            </p>

            <div className="space-y-5">
              {isSpouseType && (
                <div className="relative rounded-lg border border-[#e5e5e5] bg-white p-4">
                  <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774]">상속권 제한 사유</div>
                  <div className="mt-1.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[13px] font-bold text-[#504f4c]">이혼 일자</label>
                      <DateInput value={node.divorceDate || ''} onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { divorceDate: value } })} className="w-[110px] rounded-md border border-[#e5e5e5] bg-[#f8f8f7] px-2 py-1.5 text-center text-[13px] font-medium outline-none" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[13px] font-bold text-[#504f4c]">재혼 일자</label>
                      <DateInput value={node.remarriageDate || ''} onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { remarriageDate: value } })} className="w-[110px] rounded-md border border-[#e5e5e5] bg-[#f8f8f7] px-2 py-1.5 text-center text-[13px] font-medium outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {node.relation === 'daughter' && (
                <div className="relative rounded-lg border border-[#e5e5e5] bg-white p-4">
                  <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774]">혼인 및 복적 이력</div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[13px] font-bold text-[#504f4c]">혼인 일자</label>
                      <DateInput value={node.marriageDate || ''} onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { marriageDate: value } })} className="w-[110px] rounded-md border border-[#e5e5e5] bg-[#f8f8f7] px-2 py-1.5 text-center text-[13px] font-medium outline-none" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[13px] font-bold text-[#504f4c]">복적 일자</label>
                      <DateInput value={node.restoreDate || ''} onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { restoreDate: value } })} className="w-[110px] rounded-md border border-[#e5e5e5] bg-[#f8f8f7] px-2 py-1.5 text-center text-[13px] font-medium outline-none" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setIsHistoryModalOpen(false)} className="mt-2 w-full rounded-lg bg-[#f1f1ef] py-2.5 text-[13px] font-bold text-[#37352f] shadow-sm transition-colors hover:bg-[#e5e5e1]">
              입력 완료 및 닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
