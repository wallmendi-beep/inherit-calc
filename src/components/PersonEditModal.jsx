import React from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { IconX } from './Icons';

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[72px] shrink-0 pt-[2px] text-[11px] font-bold text-[#9a9994] dark:text-neutral-400">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[13px] text-[#37352f] dark:text-neutral-200">{children}</div>
    </div>
  );
}

function Surface({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-[#e5e5e5] bg-[#fafaf9] px-3.5 py-3 dark:border-neutral-600 dark:bg-neutral-900/80 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, tone = 'neutral' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/40 dark:text-amber-200'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/40 dark:text-blue-300'
          : tone === 'brown'
            ? 'border-[#8a7c69] bg-[#5f564b] text-[#f5f1ea] dark:border-[#6f6457] dark:bg-[#4e463d]'
            : 'border-[#ddd9d1] bg-white text-[#6b655d] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';

  return <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold ${toneClass}`}>{children}</span>;
}

function formatDateLabel(value) {
  if (!value) return '미입력';
  return value;
}

export default function PersonEditModal({
  isOpen,
  onClose,
  onOpenInInputTab,
  onOpenInTreeTab,
  node,
  parentNode,
  inheritedDate,
  rootDeathDate,
  rootIsHoju,
  sourceEventName,
  sourceEventDate,
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
  const isLegacyHusbandContext =
    node.relation === 'husband' && lawEra !== '1991' && !!parentNode && parentNode.id !== 'root';
  const blocksHusbandSubstitution =
    (node.relation === 'husband' && isDaeseupContext && lawEra !== '1991') ||
    isLegacyHusbandContext;
  const hasEnteredHeirs = !!(node.heirs && node.heirs.length > 0);
  const hasAnyConfirmedNoSuccessors = !!node.successorStatus;
  const isLegacyContext = lawEra !== '1991';
  const isEffectivePredeceased = isPreDeceasedCondition && !isSpouseType;
  const showHoju = (node.gender === 'male' || ['son', 'husband'].includes(node.relation)) && lawEra !== '1991' && rootIsHoju !== false;
  const showSameRegister = node.relation === 'daughter' && lawEra !== '1991';
  const needsNextOrderFemaleReview = hasAnyConfirmedNoSuccessors && isLegacyContext && node.relation === 'daughter';
  const needsHojuReview = showHoju && hasEnteredHeirs && !node.isHoju;
  const isReinheritanceReview = !!node.isDeceased && hasEnteredHeirs && !hasAnyConfirmedNoSuccessors;
  const isSpouseReinheritanceReview = isSpouseType && !!node.isDeceased;
  const isWifeReinheritanceReview = isSpouseReinheritanceReview && node.relation === 'wife';
  const isHusbandReinheritanceReview = isSpouseReinheritanceReview && node.relation === 'husband';

  const relationLabelMap = {
    wife: lawEra === '1991' ? '배우자' : '처',
    husband: lawEra === '1991' ? '배우자' : '남편',
    son: lawEra === '1991' ? '자녀' : '아들',
    daughter: lawEra === '1991' ? '자녀' : '딸',
    parent: '직계존속',
    sibling: '형제자매',
  };

  const eventStatusLabel = blocksHusbandSubstitution
    ? '현재 사건: 사위 대습불가'
    : isPredeceasedSpouse
      ? '현재 사건: 배우자 선사망'
      : isEffectivePredeceased
        ? '현재 사건: 선사망'
        : '현재 사건: 상속권 있음';

  const confirmedStatusLabel = hasAnyConfirmedNoSuccessors
    ? node.successorStatus === 'confirmed_no_substitute_heirs'
      ? '대습상속인 없음 확정'
      : node.successorStatus === 'confirmed_no_spouse_descendants'
        ? '직계비속·배우자 없음 확정'
        : '추가 상속인 없음 확정'
    : null;

  const reviewReason = needsNextOrderFemaleReview
    ? `${sourceEventName || '현재'} 사건은 차순위 상속 검토 대상입니다. 여성 형제자매의 혼인·복적·동일가적 여부가 결과를 바꿀 수 있습니다.`
    : needsHojuReview
      ? `${node.name || '해당 인물'} 사건은 호주상속 검토 단계입니다. 1차 상속인 중 호주상속인을 지정해야 합니다.`
      : isWifeReinheritanceReview
        ? `${node.name || '해당 배우자'} 사건은 배우자 재상속 검토 단계입니다. 상위 사건에서 이어진 자녀 목록과 별도로, ${node.name || '해당 배우자'}에게만 있는 자녀가 있는지 먼저 확인해 주세요.`
        : isHusbandReinheritanceReview
          ? `${node.name || '해당 배우자'} 사건은 배우자 재상속 검토 단계입니다. 현재 자녀 범위를 먼저 확인하고, 자녀가 없으면 직계존속 순서를 검토해 주세요.`
      : isReinheritanceReview
        ? `${node.name || '해당 인물'}는 이 사건에서 지분을 받은 뒤 다시 사망했습니다. 다음 상속 단계가 올바르게 이어지는지 확인해 주세요.`
        : hasAnyConfirmedNoSuccessors
          ? `${node.name || '해당 인물'} 자신을 다시 확정하는 단계가 아니라, ${sourceEventName || '현재'} 사건에서 이 사람과 연결된 흐름을 점검하는 단계입니다.`
          : `${sourceEventName || '현재'} 사건에서 이 사람의 사건별 상태를 확인하는 단계입니다.`;

  const parentName = parentNode?.name || '피상속인';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-2xl dark:border-neutral-600 dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e9e9e7] px-5 py-3 dark:border-neutral-600">
          <span className="text-[13px] font-bold text-[#37352f] dark:text-neutral-100">{node.name ? `${node.name} 검토` : '사건 검토'}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <Surface className="border-[#e8e2d7] bg-[#fbf7ef]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-black text-[#7a6240] dark:text-amber-200">
                {sourceEventName ? `${sourceEventName} 사건 검토` : '현재 사건 검토'}
              </span>
              {sourceEventDate ? (
                <span className="text-[11px] font-bold text-[#9b8767] dark:text-amber-200/80">
                  {sourceEventDate}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#7a6a55] dark:text-neutral-300">
              {reviewReason}
            </p>
          </Surface>

          <Surface className="space-y-3">
            <InfoRow label="이름">
              {node.isDeceased && onOpenInTreeTab ? (
                <button
                  type="button"
                  onClick={() => { onOpenInTreeTab(node.personId || node.id); }}
                  className="text-[15px] font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 transition-colors text-left"
                >
                  {node.name || '이름 미상'}
                </button>
              ) : (
                <div className="text-[15px] font-bold">{node.name || '이름 미상'}</div>
              )}
            </InfoRow>

            <InfoRow label="관계">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-neutral-400 dark:text-neutral-400">{parentName}의</span>
                <span className="font-bold">{relationLabelMap[node.relation] || node.relation || '미지정'}</span>
              </div>
            </InfoRow>

            <InfoRow label="사건 상태">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={eventStatusLabel.includes('상속권 있음') ? 'emerald' : 'neutral'}>
                  {eventStatusLabel}
                </Badge>
                {node.isDeceased ? <Badge>{formatDateLabel(node.deathDate)} 사망</Badge> : <Badge>생존</Badge>}
              </div>
            </InfoRow>

            {confirmedStatusLabel ? (
              <InfoRow label="이미 확정">
                <Badge tone="brown">{confirmedStatusLabel}</Badge>
              </InfoRow>
            ) : null}

            {showSameRegister ? (
              <InfoRow label="가적 상태">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={node.isSameRegister !== false ? 'emerald' : 'neutral'}>
                    {node.isSameRegister !== false ? '동일가적' : '비동일가적'}
                  </Badge>
                  <span className="text-[11.5px] text-neutral-500 dark:text-neutral-300">
                    혼인일 {formatDateLabel(node.marriageDate)} / 복적일 {formatDateLabel(node.restoreDate)}
                  </span>
                </div>
              </InfoRow>
            ) : null}

            {isSpouseType ? (
              <InfoRow label="배우자 상태">
                <span className="text-[11.5px] text-neutral-500 dark:text-neutral-300">
                  이혼일 {formatDateLabel(node.divorceDate)} / 재혼일 {formatDateLabel(node.remarriageDate)}
                </span>
              </InfoRow>
            ) : null}

            {showHoju ? (
              <InfoRow label="호주 검토">
                <Badge tone={node.isHoju ? 'blue' : 'neutral'}>
                  {node.isHoju ? '호주상속 지정됨' : '호주상속 지정 필요'}
                </Badge>
              </InfoRow>
            ) : null}
          </Surface>

          <Surface className="space-y-2.5">
            <div className="text-[11px] font-bold text-[#9a9994] dark:text-neutral-400">이번 사건에서 볼 것</div>
            <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[#6b655d] dark:text-neutral-300">
              {needsNextOrderFemaleReview ? (
                <>
                  <li>여성 형제자매의 혼인·복적·동일가적 여부가 결과를 바꿀 수 있습니다.</li>
                  <li>이 단계는 {node.name || '이 사람'} 자신을 다시 입력하는 것이 아니라, 다음 순위 상속인을 검토하는 단계입니다.</li>
                </>
              ) : null}
              {needsHojuReview ? (
                <>
                  <li>이 사건은 호주상속 판단이 필요합니다.</li>
                  <li>1차 상속인 중 누구를 호주상속으로 볼지 입력 탭에서 지정해 주세요.</li>
                </>
              ) : null}
              {isWifeReinheritanceReview ? (
                <>
                  <li>현재 화면의 자녀 목록은 상위 사건에서 이어진 정보일 수 있으니, 그대로 이 처의 상속인이라고 단정하지 말아야 합니다.</li>
                  <li>이 처에게만 있는 별도의 자녀가 있으면 추가로 입력하고, 없으면 추가 상속인 없음으로 정리하면 됩니다.</li>
                </>
              ) : null}
              {isHusbandReinheritanceReview ? (
                <>
                  <li>현재 표시된 자녀들이 모두 이 남편의 자녀인지 먼저 확인해 주세요.</li>
                  <li>남편의 자녀가 아닌 사람은 삭제하거나 제외 처리하고, 자녀가 없으면 그다음 직계존속 여부를 검토해 주세요.</li>
                </>
              ) : null}
              {isReinheritanceReview && !isSpouseReinheritanceReview ? (
                <>
                  <li>이 사람은 이 사건에서 지분을 받은 뒤 다시 사망했습니다.</li>
                  <li>다음 상속 단계에서 후속 상속인과 분배 경로가 맞는지 확인해 주세요.</li>
                </>
              ) : null}
              {!needsNextOrderFemaleReview && !needsHojuReview && !isReinheritanceReview && !isSpouseReinheritanceReview ? (
                <>
                  <li>현재 사건에서 이 사람의 지위와 이미 확정된 사실이 충돌하지 않는지 확인해 주세요.</li>
                  <li>입력값이 다르면 입력 탭으로 돌아가 수정하면 됩니다.</li>
                </>
              ) : null}
            </ul>
          </Surface>
        </div>

        <div className="flex items-center justify-between border-t border-[#e9e9e7] bg-[#f7f7f5]/50 px-5 py-3 dark:border-neutral-600 dark:bg-neutral-900/70">
          <button
            type="button"
            onClick={onOpenInInputTab}
            className="text-[12px] text-[#787774] underline underline-offset-2 transition-colors hover:text-[#37352f] dark:text-neutral-300 dark:hover:text-neutral-200"
          >
            입력 탭에서 수정하기 →
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
