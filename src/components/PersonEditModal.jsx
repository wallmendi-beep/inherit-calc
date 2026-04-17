import React from 'react';
import { DateInput } from './DateInput';
import { getLawEra, isBefore } from '../engine/utils';
import { BadgeToggle } from './ui/InheritDesign';
import { IconX } from './Icons';

const RELATION_OPTIONS = [
  { value: 'wife',     label: { '1991': '배우자', legacy: '처' } },
  { value: 'husband',  label: { '1991': '배우자', legacy: '남편' } },
  { value: 'son',      label: { '1991': '자녀',   legacy: '아들' } },
  { value: 'daughter', label: { '1991': '자녀',   legacy: '딸' } },
  { value: 'parent',   label: { '1991': '직계존속', legacy: '직계존속' } },
  { value: 'sibling',  label: { '1991': '형제자매', legacy: '형제자매' } },
];

function relLabel(relation, era) {
  const opt = RELATION_OPTIONS.find(o => o.value === relation);
  if (!opt) return relation || '';
  return era === '1991' ? opt.label['1991'] : opt.label.legacy;
}

// 이름·관계 등 단독 전체 행
function FullRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 w-[52px] text-[11px] font-bold text-[#9a9994] dark:text-neutral-500">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// 2:8 그리드 행 (좁은 레이블 + 넓은 필드)
function GridRow({ label, children }) {
  return (
    <div className="grid grid-cols-10 items-center gap-x-2">
      <span className="col-span-2 text-[11px] font-bold text-[#9a9994] dark:text-neutral-500 text-right pr-1">{label}</span>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-[#e5e5e5] dark:border-neutral-700 bg-[#f8f8f7] dark:bg-neutral-900 px-2.5 py-1.5 text-[13px] text-[#37352f] dark:text-neutral-200 outline-none focus:border-amber-400 focus:bg-white transition-colors';

export default function PersonEditModal({
  isOpen,
  onClose,
  onOpenInInputTab,
  node,
  parentNode,
  inheritedDate,
  rootDeathDate,
  rootIsHoju,
  handleUpdate,
}) {
  if (!isOpen || !node) return null;

  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = ['wife', 'husband', 'spouse'].includes(node.relation);
  const isPreDeceasedCondition = !!(node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate));
  const isPredeceasedSpouse = isSpouseType && isPreDeceasedCondition;
  const isDaeseupContext = !!(rootDeathDate && inheritedDate && inheritedDate !== rootDeathDate && isBefore(inheritedDate, rootDeathDate));
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;
  const isLegacyHusbandCtx = node.relation === 'husband' && lawEra !== '1991' && !!parentNode && parentNode.id !== 'root';
  const blocksHusbandSubstitution = (node.relation === 'husband' && isDaeseupContext && lawEra !== '1991') || isLegacyHusbandCtx;
  const hasEnteredHeirs = !!(node.heirs && node.heirs.length > 0);
  const mustStayExcluded =
    isPredeceasedSpouse || blocksHusbandSubstitution ||
    ['lost', 'disqualified', 'remarried', 'renounce', 'blocked_husband_substitution'].includes(node.exclusionOption || '');
  const isToggleOff = blocksHusbandSubstitution || (!!node.isExcluded && !(hasEnteredHeirs && !mustStayExcluded));
  const isEffectivePredeceased = isPreDeceasedCondition && !isSpouseType;
  const effectiveExclusionOption = isToggleOff
    ? (blocksHusbandSubstitution ? 'blocked_husband_substitution'
      : (node.exclusionOption || (isEffectivePredeceased ? 'predeceased' : 'renounce')))
    : '';

  const isRootParent = !parentNode || parentNode.id === 'root';
  const isParentFemale = !isRootParent && ['wife', 'daughter', 'mother', 'sister'].includes(parentNode?.relation);
  const isParentMale  = !isRootParent && ['husband', 'son', 'father', 'brother'].includes(parentNode?.relation);
  const isMaleNode = node.gender === 'male' || ['son', 'husband'].includes(node.relation);
  const showHoju = isMaleNode && lawEra !== '1991' && rootIsHoju !== false && !isParentFemale;
  const showMarriedDaughter = node.relation === 'daughter' && lawEra !== '1991';

  const canConfirmNoSubstituteHeirs = !!node.isDeceased && !blocksHusbandSubstitution && !isSpouseType && !hasEnteredHeirs;
  const isNoSubstituteConfirmed = node.successorStatus === 'confirmed_no_substitute_heirs';

  const renderExclusionLabel = () => {
    if (isEffectivePredeceased) return hasEnteredHeirs ? '대습상속 진행' : '대습상속인 없음';
    if (blocksHusbandSubstitution) return '사위(대습상속 불가)';
    if (node.isDeceased && hasEnteredHeirs) return '재상속 경로';
    if (node.isDeceased) return '상속인 없음';
    return '상속포기';
  };

  const parentName = isRootParent ? '피상속인' : (parentNode?.name || '상위');

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-[440px] flex flex-col max-h-[90vh] border border-[#e9e9e7] dark:border-neutral-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="px-5 py-3 border-b border-[#e9e9e7] dark:border-neutral-700 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">편집</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* 1. 이름 — 단독 전체 행 */}
          <FullRow label="이  름">
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

          {/* 2. 관계 — 단독 전체 행 */}
          <FullRow label="관  계">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[12px] text-neutral-400 dark:text-neutral-500">{parentName}의</span>
              <div className="relative flex-1">
                <select
                  value={node.relation || ''}
                  onChange={(e) => handleUpdate(node.id, 'relation', e.target.value)}
                  className={`${inputCls} appearance-none pr-6`}
                >
                  {!isParentFemale && <option value="wife">{relLabel('wife', lawEra)}</option>}
                  {!isParentMale  && <option value="husband">{relLabel('husband', lawEra)}</option>}
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

          {/* 3. 상태토글 + 사망일자 — 한 줄 분할 */}
          <div className="flex items-center gap-3 rounded-lg border border-[#e9e9e7] dark:border-neutral-700 bg-[#fafaf9] dark:bg-neutral-900/30 px-3 py-2.5">
            {/* 왼쪽: 상속 상태 토글 */}
            <div className="flex-1">
              {isPredeceasedSpouse ? (
                <span className="text-[11.5px] font-bold text-slate-400">배우자 선망</span>
              ) : blocksHusbandSubstitution ? (
                <span className="text-[11.5px] font-bold text-slate-400">사위(대습상속 불가)</span>
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

            {/* 구분 */}
            <div className="h-5 w-px bg-[#e9e9e7] dark:bg-neutral-700 shrink-0" />

            {/* 오른쪽: 사망 */}
            <div className="flex-1 flex items-center gap-2">
              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
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
                  className="h-3.5 w-3.5 cursor-pointer accent-neutral-600"
                />
                <span className="text-[11.5px] text-[#37352f] dark:text-neutral-200">사망</span>
              </label>
              {node.isDeceased && (
                <DateInput
                  value={node.deathDate || ''}
                  onChange={(value) => handleUpdate({
                    type: 'updateDeathInfo',
                    nodeId: node.id,
                    deathDate: value,
                    isDeceased: node.isDeceased,
                    inheritedDate,
                  })}
                  className="flex-1 rounded-md border border-[#e5e5e5] dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-center text-[12px] font-medium text-[#37352f] dark:text-neutral-200 outline-none focus:border-amber-400 transition-colors"
                  placeholder="사망일자"
                />
              )}
            </div>
          </div>

          {/* 제외 사유 (제외됨 상태일 때) */}
          {isToggleOff && !blocksHusbandSubstitution && !isPredeceasedSpouse && (
            <FullRow label="제외사유">
              <div className="relative">
                <select
                  value={effectiveExclusionOption || 'renounce'}
                  onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
                  className={`${inputCls} appearance-none pr-6`}
                >
                  <option value="renounce">{renderExclusionLabel()}</option>
                  <option value="disqualified">{hasEnteredHeirs ? '상속결격 (대습상속)' : '상속결격'}</option>
                  {!isBefore(inheritedDate || rootDeathDate, '2024-04-25') && (
                    <option value="lost">{hasEnteredHeirs ? '상속권 상실 (대습상속)' : '상속권 상실'}</option>
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

          {/* 4. 2:8 그리드 구간 — 관계(가적), 가적 */}
          {showMarriedDaughter && (
            <div className="space-y-2.5 rounded-lg border border-[#e9e9e7] dark:border-neutral-700 px-3 py-3">
              <GridRow label="가  적">
                <BadgeToggle
                  active={node.isSameRegister !== false}
                  onToggle={(value) => handleUpdate(node.id, 'isSameRegister', value)}
                  activeLabel="동일가적"
                  inactiveLabel="비동일가적"
                  isInferred={node._isInferredRegister}
                  activeClassName="border-emerald-300 bg-emerald-50 text-emerald-700"
                  inactiveClassName="border-neutral-400 bg-neutral-100 text-[#37352f]"
                  hoverClassName="hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200"
                  className="w-[90px]"
                />
              </GridRow>
            </div>
          )}

          {/* 5. 혼인일·복적일 — 단독 전체 행 */}
          {node.relation === 'daughter' && (
            <div className="space-y-2.5">
              <FullRow label="혼인일자">
                <DateInput
                  value={node.marriageDate || ''}
                  onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { marriageDate: value } })}
                  className={inputCls}
                  placeholder="혼인일자"
                />
              </FullRow>
              <FullRow label="복적일자">
                <DateInput
                  value={node.restoreDate || ''}
                  onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { restoreDate: value } })}
                  className={inputCls}
                  placeholder="복적일자"
                />
              </FullRow>
            </div>
          )}

          {/* 배우자: 이혼·재혼 */}
          {isSpouseType && (
            <div className="space-y-2.5">
              <FullRow label="이혼일자">
                <DateInput
                  value={node.divorceDate || ''}
                  onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { divorceDate: value } })}
                  className={inputCls}
                  placeholder="이혼일자"
                />
              </FullRow>
              <FullRow label="재혼일자">
                <DateInput
                  value={node.remarriageDate || ''}
                  onChange={(value) => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { remarriageDate: value } })}
                  className={inputCls}
                  placeholder="재혼일자"
                />
              </FullRow>
            </div>
          )}

          {/* 후속 상속인 없음 확정 */}
          {canConfirmNoSubstituteHeirs && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleUpdate(node.id, 'successorStatus', isNoSubstituteConfirmed ? '' : 'confirmed_no_substitute_heirs')}
                className={`w-full rounded-lg border px-3 py-2 text-[12px] font-bold transition-all ${
                  isNoSubstituteConfirmed
                    ? 'border-[#8a7c69] bg-[#5f564b] text-[#f5f1ea] hover:bg-[#564d43] dark:border-[#6f6457] dark:bg-[#4e463d]'
                    : 'border-[#e9e9e7] bg-white text-[#787774] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {isNoSubstituteConfirmed ? '✓ 후속 상속인 없음 확정됨 (해제)' : '후속 상속인 없음 확정'}
              </button>
              {!isNoSubstituteConfirmed && (
                <p className="mt-1.5 text-[10.5px] text-neutral-400 dark:text-neutral-500 leading-relaxed text-center">
                  확정 시 형제자매 자동 분배가 중단됩니다.
                </p>
              )}
            </div>
          )}

          {/* 호주 지정 */}
          {showHoju && (
            <div className="space-y-2.5 rounded-lg border border-[#e9e9e7] dark:border-neutral-700 px-3 py-3">
              <GridRow label="호주지정">
                <BadgeToggle
                  active={node.isHoju}
                  onToggle={(value) => handleUpdate({ type: 'setHojuStatus', nodeId: node.id, isHoju: value })}
                  activeLabel="호주상속"
                  inactiveLabel="재산상속"
                  activeClassName="border-blue-300 bg-blue-50 text-blue-700"
                  hoverClassName="hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200"
                  className="w-[90px]"
                />
              </GridRow>
            </div>
          )}

          {/* 대습상속인 추가 안내 */}
          {node.isDeceased && !hasEnteredHeirs && (
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed text-center pt-1">
              💡 대습상속인 추가는{' '}
              <button onClick={onOpenInInputTab} className="font-bold text-blue-500 hover:underline">
                입력 탭에서 열기
              </button>
              를 눌러 추가해 주세요.
            </p>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 border-t border-[#e9e9e7] dark:border-neutral-700 flex items-center justify-between bg-[#f7f7f5]/50 dark:bg-neutral-900/30">
          <button
            type="button"
            onClick={onOpenInInputTab}
            className="text-[12px] text-[#787774] dark:text-neutral-400 hover:text-[#37352f] dark:hover:text-neutral-200 transition-colors underline underline-offset-2"
          >
            입력 탭에서 열기 →
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#37352f] dark:bg-neutral-100 hover:bg-[#201f1c] dark:hover:bg-white text-white dark:text-[#37352f] px-5 py-2 text-[13px] font-bold shadow-sm transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
