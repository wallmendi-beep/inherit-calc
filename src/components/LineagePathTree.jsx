import React from 'react';
import { formatKorDate, getRelStr, isBefore } from '../engine/utils';

const getPersonKey = (person) => person?.personId || person?.id || null;

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979 개정민법';
  if (era === '1991') return '현행민법';
  return era || '';
};

const Tag = ({ children, tone = 'default' }) => {
  const cls = tone === 'blue'
    ? 'border-[#d7e5f9] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300'
    : 'border-[#e4e2de] bg-[#f7f6f3] text-[#5d5b57] dark:border-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
};

const sameShare = (aN, aD, bN, bD) => Number(aN) === Number(bN) && Number(aD) === Number(bD);

const findSourceBreakdown = (step, sourceName, inN, inD) => {
  const breakdowns = step?.sourceBreakdowns || [];
  if (!sourceName || breakdowns.length === 0) return null;
  return (
    breakdowns.find((item) => item.from === sourceName && sameShare(item.inN, item.inD, inN, inD)) ||
    breakdowns.find((item) => item.from === sourceName) ||
    null
  );
};

const normalizeDists = (step, breakdown) => {
  if (!breakdown) {
    return (step?.dists || []).map((dist) => ({
      personId: getPersonKey(dist.h),
      name: dist.h?.name || '이름 미상',
      relation: dist.h?._origRelation || dist.h?.relation || '',
      n: dist.n,
      d: dist.d,
      mod: dist.mod || '',
      ex: dist.ex || '',
      h: dist.h,
    }));
  }

  return (breakdown.dists || []).map((dist) => {
    const original = (step?.dists || []).find((item) => getPersonKey(item.h) === dist.personId);
    return {
      personId: dist.personId,
      name: dist.name || original?.h?.name || '이름 미상',
      relation: dist.relation || original?.h?._origRelation || original?.h?.relation || '',
      n: dist.n,
      d: dist.d,
      mod: dist.mod || '',
      ex: dist.ex || '',
      h: original?.h || null,
    };
  });
};

const branchMatches = (step, stepByPersonId, query, sourceName = null, inN = null, inD = null, visited = new Set()) => {
  if (!query) return true;
  const key = getPersonKey(step?.dec);
  const visitKey = `${key || 'root'}:${sourceName || ''}:${inN || ''}/${inD || ''}`;
  if (visited.has(visitKey)) return false;
  visited.add(visitKey);

  if ((step?.dec?.name || '').toLowerCase().includes(query)) return true;

  const breakdown = findSourceBreakdown(step, sourceName, inN, inD);
  return normalizeDists(step, breakdown).some((dist) => {
    if ((dist.name || '').toLowerCase().includes(query)) return true;
    const nextStep = dist.personId ? stepByPersonId.get(dist.personId) : null;
    if (!nextStep) return false;
    return branchMatches(nextStep, stepByPersonId, query, step?.dec?.name, dist.n, dist.d, new Set(visited));
  });
};

const EventNode = ({
  step,
  stepByPersonId,
  sourceName = null,
  incomingShare = null,
  depth = 0,
  searchQuery = '',
  handleNavigate,
  visited = new Set(),
}) => {
  const stepKey = getPersonKey(step?.dec) || 'root';
  const visitKey = `${stepKey}:${sourceName || ''}:${incomingShare?.n || step?.inN}/${incomingShare?.d || step?.inD}`;
  const breakdown = findSourceBreakdown(step, sourceName, incomingShare?.n, incomingShare?.d);
  const dists = normalizeDists(step, breakdown).filter((dist) => !dist.ex && dist.n > 0);
  const isMerged = (step?.mergeSources || []).length > 1;
  const isRepeated = visited.has(visitKey);
  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);
  const currentInN = incomingShare?.n || breakdown?.inN || step?.inN || 0;
  const currentInD = incomingShare?.d || breakdown?.inD || step?.inD || 1;

  if (isRepeated) {
    return (
      <div className="ml-4 border-l border-dashed border-[#ddd9cf] pl-4 text-[12px] text-[#9b9a97] dark:border-neutral-700 dark:text-neutral-400">
        망 {step?.dec?.name || '이름 미상'} 사건은 위에서 이미 표시되었습니다.
      </div>
    );
  }

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-[#e4e2de] pl-4 dark:border-neutral-700' : ''}>
      <div className="rounded-lg border border-[#e9e9e7] bg-white px-3.5 py-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/90">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[11px] font-black tracking-[0.08em] text-[#3b5f8a] dark:text-blue-300">
                {depth === 0 ? '원 상속' : '후속 사건'}
              </span>
              <span className="text-[15px] font-black text-[#37352f] dark:text-neutral-100">
                망 {step?.dec?.name || '이름 미상'}
              </span>
              {step?.dec?.deathDate && (
                <span className="text-[12px] font-medium text-[#787774] dark:text-neutral-400">
                  {formatKorDate(step.dec.deathDate)} 사망
                </span>
              )}
            </div>
            {sourceName && (
              <div className="mt-1 text-[11.5px] text-[#787774] dark:text-neutral-400">
                {sourceName} 사건에서 유입된 지분 기준
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tag tone="blue">유입 {currentInN}/{currentInD}</Tag>
            {lawLabel(step?.lawEra) && <Tag>{lawLabel(step.lawEra)}</Tag>}
          </div>
        </div>

        {isMerged && (
          <div className="mt-2 rounded-md border border-dashed border-[#e4e2de] bg-[#fcfcfb] px-2.5 py-1.5 text-[11px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-950/40 dark:text-neutral-400">
            전체 유입: {step.mergeSources.map((source) => `${source.from} ${source.n}/${source.d}`).join(' + ')}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {dists.map((dist) => {
            const nextStep = dist.personId ? stepByPersonId.get(dist.personId) : null;
            const hasNext = !!nextStep;
            const deathDate = dist.h?.deathDate || nextStep?.dec?.deathDate || '';
            const continuationType = deathDate && step?.dec?.deathDate && isBefore(deathDate, step.dec.deathDate)
              ? '대습상속'
              : '재상속';
            const relation = getRelStr(dist.relation, step?.dec?.deathDate) || dist.relation || '상속인';

            return (
              <div key={`${stepKey}-${dist.personId}-${dist.n}/${dist.d}`} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-[#fafaf9] px-2.5 py-2 text-[12.5px] dark:bg-neutral-800/70">
                  <button
                    type="button"
                    onClick={() => dist.personId && handleNavigate?.(dist.personId)}
                    className="font-black text-[#37352f] underline-offset-2 transition-colors hover:text-blue-700 hover:underline dark:text-neutral-100 dark:hover:text-blue-300"
                  >
                    {dist.name}
                  </button>
                  <span className="text-[#787774] dark:text-neutral-400">({relation})</span>
                  <span className="font-black text-[#3f5f8a] dark:text-blue-300">{dist.n}/{dist.d}</span>
                  <span className="text-[#787774] dark:text-neutral-400">취득</span>
                  {dist.mod && (
                    <span className="text-[11px] text-[#9b9a97] dark:text-neutral-500">({dist.mod})</span>
                  )}
                  {hasNext ? (
                    <span className="ml-auto text-[11px] font-bold text-[#5a7fa8] dark:text-blue-300">
                      {deathDate ? `${formatKorDate(deathDate)} 사망 · ` : ''}{continuationType} 개시
                    </span>
                  ) : (
                    <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                      최종 취득
                    </span>
                  )}
                </div>
                {hasNext && (
                  <EventNode
                    step={nextStep}
                    stepByPersonId={stepByPersonId}
                    sourceName={step?.dec?.name}
                    incomingShare={{ n: dist.n, d: dist.d }}
                    depth={depth + 1}
                    searchQuery={searchQuery}
                    handleNavigate={handleNavigate}
                    visited={nextVisited}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function LineagePathTree({ calcSteps = [], handleNavigate, searchQuery = '' }) {
  const steps = Array.isArray(calcSteps) ? calcSteps.filter((step) => step?.dec) : [];
  const stepByPersonId = React.useMemo(() => {
    const map = new Map();
    steps.forEach((step) => {
      const key = getPersonKey(step.dec);
      if (key) map.set(key, step);
    });
    return map;
  }, [steps]);

  const rootStep = steps.find((step) => step.dec?.id === 'root') || steps[0] || null;
  const normalizedSearchQuery = (searchQuery || '').trim().toLowerCase();
  const isVisible = rootStep
    ? branchMatches(rootStep, stepByPersonId, normalizedSearchQuery)
    : false;

  if (!rootStep || !isVisible) {
    return (
      <div className="rounded-xl border border-dashed border-[#d9d9d5] bg-white px-5 py-10 text-center text-[13px] text-[#787774] dark:border-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-300">
        표시할 취득경로 계통이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-[#37352f] dark:text-neutral-200">
      <div className="rounded-xl border border-[#e4e2de] bg-[#f7f6f3] px-4 py-3 dark:border-neutral-600 dark:bg-neutral-800/80">
        <div className="text-[13px] font-black text-[#37352f] dark:text-neutral-100">상속지분 취득 계통 트리</div>
        <div className="mt-1 text-[12px] leading-relaxed text-[#787774] dark:text-neutral-300">
          사건별 유입 지분과 분배 결과를 이어서 표시합니다. 생존자는 최종 취득으로 끝나고, 사망자는 다음 재상속 또는 대습상속 사건으로 이어집니다.
        </div>
      </div>
      <EventNode
        step={rootStep}
        stepByPersonId={stepByPersonId}
        searchQuery={searchQuery}
        handleNavigate={handleNavigate}
      />
    </div>
  );
}
