import React from 'react';
import { IconNetwork } from './Icons';
import TreeReportNode from './TreeReportNode';
import { formatKorDate, getRelStr, isBefore } from '../engine/utils';

const ViewModeButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
      active
        ? 'bg-[#37352f] text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'bg-white text-[#787774] hover:bg-[#efefed] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
    }`}
  >
    {children}
  </button>
);

const SummaryPill = ({ label, value, accent = 'default' }) => {
  const toneClass =
    accent === 'blue'
      ? 'border-[#d7e5f9] bg-[#f7fbff] text-[#46648e] dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300'
      : accent === 'amber'
          ? 'border-[#eadfce] bg-[#fbf8f2] text-[#7d6647] dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
          : 'border-[#e7e5e1] bg-[#fbfbfa] text-[#5d5b57] dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300';

  return (
    <div className={`rounded-full border px-3 py-1 text-[10px] font-bold ${toneClass}`}>
      <span className="mr-1 opacity-70">{label}</span>
      <span>{value}</span>
    </div>
  );
};

const FlowTag = ({ children, tone = 'default' }) => {
  const toneClass =
    tone === 'blue'
      ? 'border-[#d7e5f9] bg-[#f7fbff] text-[#46648e] dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300'
      : tone === 'amber'
          ? 'border-[#eadfce] bg-[#fbf8f2] text-[#7d6647] dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
          : tone === 'rose'
              ? 'border-[#efd9db] bg-[#fcf7f7] text-[#8a5a5f] dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
              : 'border-[#e7e5e1] bg-[#fbfbfa] text-[#5d5b57] dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
      {children}
    </span>
  );
};

const FlowNode = ({ title, subtitle, value, accent = 'default' }) => {
  const accentClass =
    accent === 'blue'
      ? 'border-[#d7e5f9] bg-[#f7fbff] dark:border-blue-900/40 dark:bg-blue-950/20'
      : 'border-[#e7e5e1] bg-white dark:border-neutral-700 dark:bg-neutral-900/70';

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${accentClass}`}>
      <div className="text-[10px] font-black tracking-[0.06em] text-[#8a887f] dark:text-neutral-500">{title}</div>
      <div className="mt-1 text-[18px] font-black text-[#37352f] dark:text-neutral-100">{subtitle}</div>
      {value && <div className="mt-1 text-[12px] font-bold text-[#46648e] dark:text-blue-300">{value}</div>}
    </div>
  );
};

const getStepKey = (step, index) => step?.dec?.personId || step?.dec?.id || `step-${index}`;

const EventListItem = ({ step, active, onClick, index }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
      active
        ? 'border-[#cfd9e8] bg-[#f7fbff] shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20'
        : 'border-[#ecebe8] bg-white hover:bg-[#fafaf9] dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/70'
    }`}
  >
    <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.06em] text-[#8a887f] dark:text-neutral-500">
      <span>STEP {index + 1}</span>
      <span className="h-1 w-1 rounded-full bg-current opacity-40" />
      <span>{formatKorDate(step.dec?.deathDate)}</span>
    </div>
    <div className="mt-1 text-[14px] font-black text-[#37352f] dark:text-neutral-100">망 {step.dec?.name}</div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <FlowTag tone="blue">원지분 {step.inN}/{step.inD}</FlowTag>
      <FlowTag>{step.dists?.length || 0}명 분배</FlowTag>
      {step.mergeSources?.length > 1 && <FlowTag tone="amber">복수 유입</FlowTag>}
    </div>
  </button>
);

const RecipientCard = ({ dist, step, relatedStep, onNavigate, onOpenEvent }) => {
  const relationLabel = getRelStr(dist.h?.relation, step.dec?.deathDate) || '상속인';
  const hasRelatedEvent = Boolean(relatedStep);
  const isReinheritance = hasRelatedEvent && dist.h?.deathDate && step.dec?.deathDate && !isBefore(dist.h.deathDate, step.dec.deathDate);
  const isSubstitutionBranch = hasRelatedEvent && dist.h?.deathDate && step.dec?.deathDate && isBefore(dist.h.deathDate, step.dec.deathDate);
  const branchLabel = isReinheritance ? '재상속으로 이어짐' : isSubstitutionBranch ? '대습상속 가지' : '이번 사건에서 종결';
  const branchTone = isReinheritance ? 'amber' : isSubstitutionBranch ? 'blue' : 'default';

  return (
    <div className="rounded-2xl border border-[#ebeae7] bg-white px-4 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="mb-3 flex items-center justify-between gap-2">
        <FlowTag tone={branchTone}>{branchLabel}</FlowTag>
        <div className="rounded-full border border-[#ecebe8] bg-[#fafaf9] px-2.5 py-1 text-[10px] font-bold text-[#787774] dark:border-neutral-800 dark:bg-neutral-950/30 dark:text-neutral-400">
          {step.inN}/{step.inD} × {dist.sn}/{dist.sd}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(dist.h?.personId || dist.h?.id)}
            title="입력 탭에서 이 사람 정보 수정"
            className="group inline-flex items-center gap-1.5 text-left text-[15px] font-black text-[#37352f] transition-colors hover:text-blue-700 dark:text-neutral-100 dark:hover:text-blue-300"
          >
            <span className="underline-offset-2 group-hover:underline">{dist.h?.name}</span>
            <span className="hidden text-[10px] font-bold text-[#787774] group-hover:inline dark:text-neutral-500">수정</span>
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            <FlowTag>{relationLabel}</FlowTag>
            {dist.mod && <FlowTag tone="blue">{dist.mod}</FlowTag>}
            {dist.ex && <FlowTag tone="rose">{dist.ex}</FlowTag>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-bold text-[#8a887f] dark:text-neutral-500">이번 사건 귀속분</div>
          <div className="mt-1 text-[18px] font-black text-[#3f5f8a] dark:text-blue-300">{dist.n}/{dist.d}</div>
        </div>
      </div>

      {(isReinheritance || isSubstitutionBranch) && (
        <div className="mt-4 rounded-xl border border-[#ecebe8] bg-[#fafaf9] px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black text-[#5d5b57] dark:text-neutral-300">
                {isReinheritance ? '재상속은 별도 사건으로 진행됩니다.' : '대습상속 가지는 별도 사건으로 확인합니다.'}
              </div>
              <div className="mt-1 text-[11px] text-[#787774] dark:text-neutral-400">
                {isReinheritance
                  ? `${dist.h?.name} 사망 단계에서 다시 지분이 분배됩니다. 이 카드에서는 여기까지만 표시합니다.`
                  : `${dist.h?.name}는 선사망자이므로, 실제 대습상속 흐름은 별도 사건에서 확인합니다.`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenEvent && onOpenEvent(getStepKey(relatedStep))}
              className="rounded-xl border border-[#d8d6d1] bg-white px-3 py-2 text-[11px] font-bold text-[#37352f] transition-colors hover:bg-[#f3f3f1] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              관련 사건 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function TreePanel({
  tree,
  treeToggleSignal,
  isAllExpanded,
  setTreeToggleSignal,
  setIsAllExpanded,
  calcSteps = [],
  handleNavigate,
}) {
  const [viewMode, setViewMode] = React.useState('tree');
  const [selectedStepKey, setSelectedStepKey] = React.useState(null);
  const [showRecipientSummary, setShowRecipientSummary] = React.useState(false);

  const steps = React.useMemo(
    () => (Array.isArray(calcSteps) ? calcSteps.filter((step) => step?.dec) : []),
    [calcSteps]
  );

  const stepMap = React.useMemo(() => {
    const map = new Map();
    steps.forEach((step, index) => {
      map.set(getStepKey(step, index), step);
      if (step?.dec?.personId) map.set(step.dec.personId, step);
      if (step?.dec?.id) map.set(step.dec.id, step);
    });
    return map;
  }, [steps]);

  React.useEffect(() => {
    if (!steps.length) {
      setSelectedStepKey(null);
      return;
    }
    const currentExists = selectedStepKey && stepMap.has(selectedStepKey);
    if (!currentExists) {
      setSelectedStepKey(getStepKey(steps[0], 0));
    }
  }, [steps, selectedStepKey, stepMap]);

  React.useEffect(() => {
    setShowRecipientSummary(false);
  }, [selectedStepKey]);

  const selectedStep = React.useMemo(() => {
    if (!steps.length) return null;
    return stepMap.get(selectedStepKey) || steps[0];
  }, [steps, selectedStepKey, stepMap]);

  return (
    <div className="flex h-full animate-in fade-in flex-col py-2 duration-300">
      <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[#e5e5e5] bg-[#f8f8f7] p-4 text-[13px] font-semibold text-[#787774] shadow-none dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 no-print">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-5 w-5 shrink-0 opacity-50" />
          <span>
            {viewMode === 'tree'
              ? '이름을 클릭하면 하위 관계도를 펼치거나 접을 수 있습니다.'
              : '사망 사건을 하나씩 선택해, 그 사건의 1차 상속 흐름만 시뮬레이션합니다. 재상속은 별도 사건으로 이어집니다.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[#dcdcd9] bg-[#f1f1ef] px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-800">
            <ViewModeButton active={viewMode === 'tree'} onClick={() => setViewMode('tree')}>트리 보기</ViewModeButton>
            <ViewModeButton active={viewMode === 'flow'} onClick={() => setViewMode('flow')}>사건 시뮬레이션</ViewModeButton>
          </div>
          {viewMode === 'tree' && (
            <button
              onClick={() => {
                const next = Math.abs(treeToggleSignal) + 1;
                setTreeToggleSignal(isAllExpanded ? -next : next);
                setIsAllExpanded(!isAllExpanded);
              }}
              className="whitespace-nowrap rounded border border-[#d4d4d4] bg-white px-4 py-1.5 text-[13px] font-bold text-[#37352f] shadow-sm transition-colors hover:bg-[#efefed] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              {isAllExpanded ? '모두 접기' : '모두 펼치기'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
          <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
        </div>
      ) : steps.length > 0 && selectedStep ? (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-2xl border border-[#e9e9e7] bg-[#fbfbfa] p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
            <div>
              <div className="text-[11px] font-black tracking-[0.06em] text-[#787774] dark:text-neutral-500">사건 목록</div>
              <div className="mt-2 text-[13px] text-[#5d5b57] dark:text-neutral-300">
                같은 사람이라도 사망 시점과 적용 법이 다르면 상속 흐름이 달라집니다. 사건을 하나씩 선택해 보세요.
              </div>
            </div>
            <div className="space-y-2">
              {steps.map((step, index) => {
                const key = getStepKey(step, index);
                return (
                  <EventListItem
                    key={key}
                    step={step}
                    index={index}
                    active={getStepKey(selectedStep) === key}
                    onClick={() => setSelectedStepKey(key)}
                  />
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 rounded-2xl border border-[#e9e9e7] bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
            <div className="rounded-2xl border border-[#ecebe8] bg-[#fbfbfa] p-5 dark:border-neutral-800 dark:bg-neutral-950/30">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-black tracking-[0.06em] text-[#8a887f] dark:text-neutral-500">
                <span>사건 시뮬레이션</span>
                <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                <span>{formatKorDate(selectedStep.dec?.deathDate)} 사망</span>
              </div>
              <div className="mt-2 text-[24px] font-black tracking-[-0.02em] text-[#37352f] dark:text-neutral-100">
                망 {selectedStep.dec?.name}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SummaryPill label="원지분" value={`${selectedStep.inN}/${selectedStep.inD}`} accent="blue" />
                <SummaryPill label="1차 분배대상" value={`${selectedStep.dists?.length || 0}명`} />
                {selectedStep.mergeSources?.length > 1 && <SummaryPill label="유입경로" value={`${selectedStep.mergeSources.length}건`} accent="amber" />}
              </div>
              {selectedStep.mergeSources?.length > 1 && (
                <div className="mt-4 rounded-xl border border-[#ecebe8] bg-white px-4 py-3 text-[12px] text-[#5d5b57] dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
                  <div className="font-black text-[#37352f] dark:text-neutral-100">복수 유입 사건</div>
                  <div className="mt-1 leading-6">
                    {selectedStep.mergeSources.map((src) => `${src.from} ${src.d}분의 ${src.n}`).join(' + ')}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#dddcd8] bg-[#fcfcfb] px-4 py-3 text-[12px] leading-6 text-[#6b6963] dark:border-neutral-700 dark:bg-neutral-950/20 dark:text-neutral-400">
              이 화면은 <span className="font-bold text-[#37352f] dark:text-neutral-200">이번 사건의 1차 상속 흐름</span>만 보여줍니다.
              재상속은 별도 사건으로 끊어서 보고, 대습상속 가지도 관련 사건으로 넘겨 확인합니다. 사람 이름을 누르면 입력 탭으로 돌아가 데이터를 점검할 수 있습니다.
            </div>

            <div className="mt-6">
              <div className="overflow-hidden rounded-2xl border border-[#ecebe8] bg-[#fcfcfb] p-5 dark:border-neutral-800 dark:bg-neutral-950/20">
                <div className="flex flex-col items-center">
                  <FlowNode
                    title="사건 시작"
                    subtitle={`망 ${selectedStep.dec?.name}`}
                    value={`원지분 ${selectedStep.inN}/${selectedStep.inD}`}
                    accent="blue"
                  />
                  <div className="h-6 w-px bg-[#d9d7d1] dark:bg-neutral-700" />
                  <div className="rounded-full border border-[#e7e5e1] bg-white px-3 py-1 text-[11px] font-bold text-[#6b6963] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    1차 상속 분배
                  </div>
                  <div className="mt-3 grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedStep.dists.map((dist, distIndex) => {
                      const relatedStep = stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null;
                      return (
                        <RecipientCard
                          key={`${getStepKey(selectedStep)}-${dist.h?.personId || dist.h?.id || distIndex}-graph`}
                          dist={dist}
                          step={selectedStep}
                          relatedStep={relatedStep}
                          onNavigate={handleNavigate}
                          onOpenEvent={setSelectedStepKey}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#ecebe8] bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                <button
                  type="button"
                  onClick={() => setShowRecipientSummary((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-[12px] font-black tracking-[0.06em] text-[#787774] dark:text-neutral-500">상속인별 요약</div>
                    <div className="mt-1 text-[11px] text-[#6d6b65] dark:text-neutral-400">
                      계산식과 비고를 더 자세히 보려면 펼쳐서 확인하세요.
                    </div>
                  </div>
                  <div className="rounded-full border border-[#dfddd7] bg-[#fafaf9] px-3 py-1 text-[11px] font-bold text-[#5d5b57] dark:border-neutral-700 dark:bg-neutral-950/30 dark:text-neutral-300">
                    {showRecipientSummary ? '요약 접기' : '요약 펼치기'}
                  </div>
                </button>
                {showRecipientSummary && (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {selectedStep.dists.map((dist, distIndex) => {
                      const relatedStep = stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null;
                      return (
                        <RecipientCard
                          key={`${getStepKey(selectedStep)}-${dist.h?.personId || dist.h?.id || distIndex}`}
                          dist={dist}
                          step={selectedStep}
                          relatedStep={relatedStep}
                          onNavigate={handleNavigate}
                          onOpenEvent={setSelectedStepKey}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d9d9d5] bg-white px-5 py-8 text-center text-[13px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400">
          아직 시뮬레이션할 계산 결과가 없습니다. 입력 정보를 확인한 뒤 계산 상세 탭에서 결과를 만든 후 다시 확인해 주세요.
        </div>
      )}
    </div>
  );
}
