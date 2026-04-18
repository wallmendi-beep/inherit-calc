import React from 'react';
import { DateInput } from './DateInput';
import { getLawEra, isBefore } from '../engine/utils';
import { BadgeToggle } from './ui/InheritDesign';
import { IconX } from './Icons';

const RELATION_OPTIONS = [
  { value: 'wife', label: { '1991': '배우자', legacy: '처' } },
  { value: 'husband', label: { '1991': '배우자', legacy: '남편' } },
  { value: 'son', label: { '1991': '자녀', legacy: '아들' } },
  { value: 'daughter', label: { '1991': '자녀', legacy: '딸' } },
  { value: 'parent', label: { '1991': '직계존속', legacy: '직계존속' } },
  { value: 'sibling', label: { '1991': '형제자매', legacy: '형제자매' } },
];

function relLabel(relation, era) {
  const opt = RELATION_OPTIONS.find((item) => item.value === relation);
  if (!opt) return relation || '';
  return era === '1991' ? opt.label['1991'] : opt.label.legacy;
}

function FullRow({ label, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[58px] shrink-0 text-[11px] font-bold text-[#9a9994] dark:text-neutral-500">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function GridRow({ label, children }) {
  return (
    <div className="grid grid-cols-10 items-center gap-x-2.5">
      <span className="col-span-2 text-right text-[11px] font-bold text-[#9a9994] dark:text-neutral-500">
        {label}
      </span>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

function FieldShell({ children, className = '' }) {
  return (
    <div
      className={`rounded-md border border-[#e5e5e5] bg-[#f8f8f7] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900 ${className}`}
    >
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-[#e5e5e5] dark:border-neutral-700 bg-[#f8f8f7] dark:bg-neutral-900 px-2.5 py-1.5 text-[13px] text-[#37352f] dark:text-neutral-200 outline-none focus:border-amber-400 focus:bg-white transition-colors';

export default function PersonEditModal({
  isOpen,
  onClose,
  onOpenInInputTab,
  node,
  parentNode,
  inheritedDate,
  rootDeathDate,
  rootIsHoju,
  sourceEventName,
  sourceEventDate,
  handleUpdate,
}) {
  if (!isOpen || !node) return null;

  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = ['wife', 'husband', 'spouse'].includes(node.relation);
  const isPreDeceasedCondition = !!(
    node.isDeceased &&
    node.deathDate &&
    inheritedDate &&
    isBefore(node.deathDate, inheritedDate)
  );
  const isPredeceasedSpouse = isSpouseType && isPreDeceasedCondition;
  const isDaeseupContext = !!(
    rootDeathDate &&
    inheritedDate &&
    inheritedDate !== rootDeathDate &&
    isBefore(inheritedDate, rootDeathDate)
  );
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;
  const isLegacyHusbandContext =
    node.relation === 'husband' && lawEra !== '1991' && !!parentNode && parentNode.id !== 'root';
  const blocksHusbandSubstitution =
    (node.relation === 'husband' && isDaeseupContext && lawEra !== '1991') ||
    isLegacyHusbandContext;
  const hasEnteredHeirs = !!(node.heirs && node.heirs.length > 0);
  const mustStayExcluded =
    isPredeceasedSpouse ||
    blocksHusbandSubstitution ||
    ['lost', 'disqualified', 'remarried', 'renounce', 'blocked_husband_substitution'].includes(
      node.exclusionOption || '',
    );
  const isToggleOff =
    blocksHusbandSubstitution ||
    (!!node.isExcluded && !(hasEnteredHeirs && !mustStayExcluded));
  const isEffectivePredeceased = isPreDeceasedCondition && !isSpouseType;
  const effectiveExclusionOption = isToggleOff
    ? blocksHusbandSubstitution
      ? 'blocked_husband_substitution'
      : node.exclusionOption || (isEffectivePredeceased ? 'predeceased' : 'renounce')
    : '';

  const isRootParent = !parentNode || parentNode.id === 'root';
  const isParentFemale =
    !isRootParent && ['wife', 'daughter', 'mother', 'sister'].includes(parentNode?.relation);
  const isParentMale =
    !isRootParent && ['husband', 'son', 'father', 'brother'].includes(parentNode?.relation);
  const isMaleNode = node.gender === 'male' || ['son', 'husband'].includes(node.relation);
  const showHoju = isMaleNode && lawEra !== '1991' && rootIsHoju !== false && !isParentFemale;
  const showSameRegister = node.relation === 'daughter' && lawEra !== '1991';

  const canConfirmNoSubstituteHeirs =
    !!node.isDeceased && !blocksHusbandSubstitution && !isSpouseType && !hasEnteredHeirs;
  const isNoSubstituteConfirmed = node.successorStatus === 'confirmed_no_substitute_heirs';
  const hasAnyConfirmedNoSuccessors = !!node.successorStatus;
  const eventStatusLabel = blocksHusbandSubstitution
    ? '현재 사건: 사위 대습불가'
    : isPredeceasedSpouse
      ? '현재 사건: 배우자 선사망'
      : isEffectivePredeceased
        ? '현재 사건: 선사망'
        : '';
  const contextTitle = sourceEventName
    ? `${sourceEventName} 사건 검토`
    : '현재 사건 검토';
  const contextBody = hasAnyConfirmedNoSuccessors
    ? `[${node.name || '해당 인물'}]는 이미 후속 상속인 없음으로 확정되어 있습니다. 이번에는 ${sourceEventName || '현재'} 사건에서 이 사람의 사건별 상태를 확인하는 화면입니다. 입력값이 잘못되었다면 입력 탭으로 돌아가 수정해 주세요.`
    : `이번에는 ${sourceEventName || '현재'} 사건 기준으로 [${node.name || '해당 인물'}]의 상태를 검토하는 화면입니다. 여기 보이는 선사망·대습불가 같은 표시는 현재 사건 기준입니다.`;

  const renderExclusionLabel = () => {
    if (isEffectivePredeceased) return hasEnteredHeirs ? '대습상속 진행' : '대습상속인 없음';
    if (blocksHusbandSubstitution) return '사위(대습상속 불가)';
    if (node.isDeceased && hasEnteredHeirs) return '재상속 경로';
    if (node.isDeceased) return '상속인 없음';
    return '상속포기';
  };

  const parentName = isRootParent ? '피상속인' : parentNode?.name || '상위';

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[448px] flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e9e9e7] px-5 py-3 dark:border-neutral-700">
          <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">인물 편집</span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-[#e8e2d7] bg-[#fbf7ef] px-3.5 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-[#7a6240] dark:text-amber-300">
                {contextTitle}
              </span>
              {sourceEventDate ? (
                <span className="text-[11px] font-bold text-[#9b8767] dark:text-amber-200/80">
                  {sourceEventDate}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#7a6a55] dark:text-neutral-300">
              {contextBody}
            </p>
          </div>

          <FullRow label="이름">
            <input
              type="text"
              value={node.name || ''}
              onChange={(e) => handleUpdate(node.id, 'name', e.target.value)}
              lang="ko"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="성명 입력"
              className={`${inputCls} font-bold text-[14px]`}
            />
          </FullRow>

          <FullRow label="관계">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[12px] text-neutral-400 dark:text-neutral-500">
                {parentName}의
              </span>
              <div className="relative min-w-0 flex-1">
                <select
                  value={node.relation || ''}
                  onChange={(e) => handleUpdate(node.id, 'relation', e.target.value)}
                  className={`${inputCls} appearance-none pr-7`}
                >
                  {!isParentFemale && <option value="wife">{relLabel('wife', lawEra)}</option>}
                  {!isParentMale && <option value="husband">{relLabel('husband', lawEra)}</option>}
                  <option value="son">{relLabel('son', lawEra)}</option>
                  <option value="daughter">{relLabel('daughter', lawEra)}</option>
                  <option value="parent">직계존속</option>
                  <option value="sibling">형제자매</option>
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </FullRow>

          <FullRow label="상태">
            <FieldShell>
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center">
                  {eventStatusLabel ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {eventStatusLabel}
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!isToggleOff}
                      onClick={() => {
                        const nextExcluded = !isToggleOff;
                        handleUpdate(node.id, {
                          isExcluded: nextExcluded,
                          exclusionOption: nextExcluded ? (isDaeseupSpouse ? 'remarried' : 'renounce') : '',
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                        !isToggleOff
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${!isToggleOff ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                      {!isToggleOff ? '상속권 있음' : '제외됨'}
                    </button>
                  )}
                </div>

                <div className="h-5 w-px shrink-0 bg-[#e2e2de] dark:bg-neutral-700" />

                <div className="flex min-w-0 flex-[1.35] items-center gap-2">
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={node.isDeceased || false}
                      onChange={(e) =>
                        handleUpdate({
                          type: 'updateDeathInfo',
                          nodeId: node.id,
                          isDeceased: e.target.checked,
                          deathDate: e.target.checked ? node.deathDate : '',
                          inheritedDate,
                        })
                      }
                      className="h-3.5 w-3.5 cursor-pointer accent-neutral-600"
                    />
                    <span className="text-[11.5px] text-[#37352f] dark:text-neutral-200">사망</span>
                  </label>
                  {node.isDeceased && (
                    <DateInput
                      value={node.deathDate || ''}
                      onChange={(value) =>
                        handleUpdate({
                          type: 'updateDeathInfo',
                          nodeId: node.id,
                          deathDate: value,
                          isDeceased: node.isDeceased,
                          inheritedDate,
                        })
                      }
                      className="flex-1 rounded-md border border-[#deded8] bg-white px-2 py-1 text-center text-[12px] font-medium text-[#37352f] outline-none transition-colors focus:border-amber-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      placeholder="사망일자"
                    />
                  )}
                </div>
              </div>
            </FieldShell>
          </FullRow>

          {isToggleOff && !blocksHusbandSubstitution && !isPredeceasedSpouse && (
            <FullRow label="제외사유">
              <div className="relative">
                <select
                  value={effectiveExclusionOption || 'renounce'}
                  onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
                  className={`${inputCls} appearance-none pr-7`}
                >
                  <option value="renounce">{renderExclusionLabel()}</option>
                  <option value="disqualified">
                    {hasEnteredHeirs ? '상속결격 (대습상속)' : '상속결격'}
                  </option>
                  {!isBefore(inheritedDate || rootDeathDate, '2024-04-25') && (
                    <option value="lost">
                      {hasEnteredHeirs ? '상속권 상실 (대습상속)' : '상속권 상실'}
                    </option>
                  )}
                  {isDaeseupSpouse && <option value="remarried">재혼으로 인한 제외</option>}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </FullRow>
          )}

          {showSameRegister && (
            <FullRow label="가적">
              <FieldShell className="py-2">
                <BadgeToggle
                  active={node.isSameRegister !== false}
                  onToggle={(value) => handleUpdate(node.id, 'isSameRegister', value)}
                  activeLabel="동일가적"
                  inactiveLabel="비동일가적"
                  isInferred={node._isInferredRegister}
                  activeClassName="border-emerald-300 bg-emerald-50 text-emerald-700"
                  inactiveClassName="border-neutral-400 bg-neutral-100 text-[#37352f]"
                  hoverClassName="hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-600"
                  className="w-[96px]"
                />
              </FieldShell>
            </FullRow>
          )}

          {node.relation === 'daughter' && (
            <div className="space-y-2.5">
              <FullRow label="혼인일자">
                <DateInput
                  value={node.marriageDate || ''}
                  onChange={(value) =>
                    handleUpdate({
                      type: 'updateHistoryInfo',
                      nodeId: node.id,
                      changes: { marriageDate: value },
                    })
                  }
                  className={inputCls}
                  placeholder="혼인일자"
                />
              </FullRow>
              <FullRow label="복적일자">
                <DateInput
                  value={node.restoreDate || ''}
                  onChange={(value) =>
                    handleUpdate({
                      type: 'updateHistoryInfo',
                      nodeId: node.id,
                      changes: { restoreDate: value },
                    })
                  }
                  className={inputCls}
                  placeholder="복적일자"
                />
              </FullRow>
            </div>
          )}

          {isSpouseType && (
            <div className="space-y-2.5">
              <FullRow label="이혼일자">
                <DateInput
                  value={node.divorceDate || ''}
                  onChange={(value) =>
                    handleUpdate({
                      type: 'updateHistoryInfo',
                      nodeId: node.id,
                      changes: { divorceDate: value },
                    })
                  }
                  className={inputCls}
                  placeholder="이혼일자"
                />
              </FullRow>
              <FullRow label="재혼일자">
                <DateInput
                  value={node.remarriageDate || ''}
                  onChange={(value) =>
                    handleUpdate({
                      type: 'updateHistoryInfo',
                      nodeId: node.id,
                      changes: { remarriageDate: value },
                    })
                  }
                  className={inputCls}
                  placeholder="재혼일자"
                />
              </FullRow>
            </div>
          )}

          {(canConfirmNoSubstituteHeirs || hasAnyConfirmedNoSuccessors) && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!isNoSubstituteConfirmed) {
                    handleUpdate(node.id, 'successorStatus', 'confirmed_no_substitute_heirs');
                  }
                }}
                className={`w-full rounded-lg border px-3 py-2 text-[12px] font-bold transition-all ${
                  hasAnyConfirmedNoSuccessors
                    ? 'cursor-default border-[#8a7c69] bg-[#5f564b] text-[#f5f1ea] dark:border-[#6f6457] dark:bg-[#4e463d]'
                    : 'border-[#e9e9e7] bg-white text-[#787774] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {hasAnyConfirmedNoSuccessors
                  ? node.successorStatus === 'confirmed_no_substitute_heirs'
                    ? '대습상속인 없음 확정'
                    : node.successorStatus === 'confirmed_no_spouse_descendants'
                      ? '직계비속·배우자 없음 확정'
                      : '추가 상속인 없음 확정'
                  : '후속 상속인 없음 확정'}
              </button>
              {!hasAnyConfirmedNoSuccessors && (
                <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                  확정 시 형제자매 자동 분배가 중단됩니다.
                </p>
              )}
            </div>
          )}

          {showHoju && (
            <FullRow label="호주지정">
              <FieldShell className="py-2">
                <BadgeToggle
                  active={node.isHoju}
                  onToggle={(value) =>
                    handleUpdate({ type: 'setHojuStatus', nodeId: node.id, isHoju: value })
                  }
                  activeLabel="호주상속"
                  inactiveLabel="재산상속"
                  activeClassName="border-blue-300 bg-blue-50 text-blue-700"
                  hoverClassName="hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600"
                  className="w-[96px]"
                />
              </FieldShell>
            </FullRow>
          )}

          {node.isDeceased && !hasEnteredHeirs && (
            <p className="pt-1 text-center text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
              후속 상속인 입력은{' '}
              <button type="button" onClick={onOpenInInputTab} className="font-bold text-blue-500 hover:underline">
                입력 탭에서 열기
              </button>
              를 눌러 계속 진행해 주세요.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#e9e9e7] bg-[#f7f7f5]/50 px-5 py-3 dark:border-neutral-700 dark:bg-neutral-900/30">
          <button
            type="button"
            onClick={onOpenInInputTab}
            className="text-[12px] text-[#787774] underline underline-offset-2 transition-colors hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            입력 탭에서 열기 →
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#37352f] px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#201f1c] dark:bg-neutral-100 dark:text-[#37352f] dark:hover:bg-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
