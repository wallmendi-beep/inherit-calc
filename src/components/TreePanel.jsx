import React from 'react';
import TreeReportNode from './TreeReportNode';
import { formatKorDate, getLawEra, getRelStr, isBefore, math } from '../engine/utils';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const getStepKey = (step, index) => step?.dec?.personId || step?.dec?.id || `step-${index}`;

const lawEraLabel = (era) => {
  if (era === '1960') return '구민법 (1960년 제정)';
  if (era === '1979') return '1979년 개정 민법';
  if (era === '1991') return '현행 민법 (1991년 개정)';
  return '';
};

// 사건들 간 부모-자식 관계 맵 빌드
const buildStepTree = (steps) => {
  const parentOf = new Map();
  const childrenOf = new Map();

  steps.forEach((step, i) => {
    const childKey = getStepKey(step, i);
    steps.forEach((parentStep, pi) => {
      if (pi === i) return;
      const parentKey = getStepKey(parentStep, pi);
      const isChild = (parentStep.dists || []).some((d) => {
        const pid = d.h?.personId || d.h?.id;
        return pid === step.dec?.personId || pid === step.dec?.id;
      });
      if (isChild && !parentOf.has(childKey)) {
        parentOf.set(childKey, parentKey);
        if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
        childrenOf.get(parentKey).push(childKey);
      }
    });
  });

  return { parentOf, childrenOf };
};

// ─── 서브 컴포넌트들 ─────────────────────────────────────────────────────────

const Tag = ({ children, tone = 'default' }) => {
  const cls =
    tone === 'blue'
      ? 'border-[#d7e5f9] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300'
      : tone === 'amber'
      ? 'border-[#e8dfc8] bg-[#fdf8ef] text-[#7a6240] dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : tone === 'rose'
      ? 'border-[#efd9db] bg-[#fdf4f5] text-[#8a5a5f] dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
      : tone === 'green'
      ? 'border-[#c9e8d5] bg-[#f0faf4] text-[#2e6e4a] dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
      : 'border-[#e4e2de] bg-[#f7f6f3] text-[#5d5b57] dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
};

// 제외된 상속인 목록
const ExcludedSection = ({ dists }) => {
  const excluded = dists.filter((d) => d.ex);
  if (!excluded.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-dashed border-[#e4e2de] bg-[#fafaf9] px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/30">
      <div className="mb-2 text-[10px] font-black tracking-[0.06em] text-[#9b9a97] dark:text-neutral-500">상속권 없음</div>
      <div className="flex flex-wrap gap-2">
        {excluded.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-[#9b9a97] line-through dark:text-neutral-500">
              {d.h?.name}
            </span>
            <Tag tone="rose">{d.ex}</Tag>
          </div>
        ))}
      </div>
    </div>
  );
};

// 상속인 카드
const HeirCard = ({ dist, step, relatedStep, onNavigate, onOpenEvent, commonD, innerCommonD }) => {
  const relation = dist.h?.relation;
  const isSpouse = ['wife', 'husband', 'spouse'].includes(relation);
  const relationLabel = getRelStr(relation, step.dec?.deathDate) || '상속인';
  
  let finalShare = `${dist.n}/${dist.d}`;
  let displayInnerShare = `${dist.sn}/${dist.sd}`;
  
  // 1. 내부 수식 비율 통분 (가족 내 LCM 적용)
  if (innerCommonD && dist.sd && innerCommonD !== dist.sd) {
    const scale = innerCommonD / dist.sd;
    displayInnerShare = `${dist.sn * scale}/${innerCommonD}`;
  }

  // 2. 최종 결과 지분 통분 (전체 LCM 적용)
  if (commonD && dist.d && commonD !== dist.d) {
    const scale = commonD / dist.d;
    finalShare = `${dist.n * scale}/${commonD}`;
  }

  const hasRelated = Boolean(relatedStep);
  const isReinherit = hasRelated && dist.h?.deathDate && !isBefore(dist.h.deathDate, step.dec?.deathDate);
  const isSubst = hasRelated && dist.h?.deathDate && isBefore(dist.h.deathDate, step.dec?.deathDate);
  const branchLabel = isReinherit ? '재상속' : isSubst ? '대습상속' : null;

  let shortMod = '';
  if (typeof dist.mod === 'string' && dist.mod) {
    const isAdd = dist.mod.includes('가산');
    const isSub = dist.mod.includes('감산');
    
    if (isAdd) {
      if (dist.mod.includes('5할')) shortMod = '5할 가산';
      else if (dist.mod.includes('1/2')) shortMod = '1/2 가산';
      else shortMod = '가산';
    } else if (isSub) {
      if (dist.mod.includes('5할')) shortMod = '5할 감산';
      else if (dist.mod.includes('1/2')) shortMod = '1/2 감산';
      else if (dist.mod.includes('1/4')) shortMod = '1/4 감산';
      else shortMod = '감산';
    }
  }

  const simpleBadges = [];
  if (relation === 'daughter') {
    const isMarriedOut = dist.mod && dist.mod.includes('출가녀');
    const isSame = !isMarriedOut && dist.h?.isSameRegister !== false;
    simpleBadges.push({ label: isSame ? '동일가적' : '비동일가적', tone: isSame ? 'blue' : 'amber' });
  } else if (relation === 'son' && typeof dist.mod === 'string' && dist.mod.includes('호주')) {
    simpleBadges.push({ label: '호주상속', tone: 'blue' });
  } else if (isSpouse && shortMod) {
    simpleBadges.push({ label: shortMod, tone: shortMod.includes('가산') ? 'blue' : 'amber' });
  }

  const accentLeft = isSpouse
    ? 'border-l-[3px] border-l-blue-300 dark:border-l-blue-700'
    : 'border-l-[3px] border-l-[#d9d7d1] dark:border-l-neutral-600';

  return (
    <div className={`rounded-xl border border-[#ebeae7] bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50 ${accentLeft} overflow-hidden`}>
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-0 sm:min-h-[72px]">
        {/* [구역 1] 상속인 기본 정보 (200px 고정) */}
        <div className="sm:w-[200px] sm:shrink-0 sm:border-r border-[#ecebe8] dark:border-neutral-800 p-2.5 flex items-center gap-2 overflow-hidden bg-white dark:bg-neutral-900/20">
          <Tag tone={isSpouse ? 'blue' : 'default'}>{relationLabel}</Tag>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(dist.h?.personId || dist.h?.id)}
            className="group min-w-0 flex-1 text-left text-[14px] font-black text-[#37352f] transition-colors hover:text-blue-700 dark:text-neutral-100 dark:hover:text-blue-300"
          >
            <div className="truncate underline-offset-4 group-hover:underline decoration-blue-500/30">{dist.h?.name}</div>
          </button>
          <div className="flex shrink-0 gap-1">
            {simpleBadges.map((b, i) => <Tag key={i} tone={b.tone}>{b.label}</Tag>)}
          </div>
        </div>

        {/* [구역 2] 지분 산출 내역 (330px 고정, 배경색으로 강조) */}
        <div className="sm:w-[330px] sm:shrink-0 bg-[#fafaf9]/60 dark:bg-neutral-950/30 p-2.5 flex items-center justify-between gap-4">
          <span className="text-[11px] text-[#787774] dark:text-neutral-400 font-mono tracking-tight truncate">
            {step.inN}/{step.inD} × {displayInnerShare} {shortMod ? `(${shortMod})` : ''}
          </span>
          <span className="text-[18px] font-black text-[#3f5f8a] dark:text-blue-300 whitespace-nowrap drop-shadow-sm">{finalShare}</span>
        </div>

        {/* [구역 3] 대습/재상속 정보 (가변 폭, 우측 정렬, 선택적 수직 구분선) */}
        {branchLabel ? (
          <div className="flex-1 sm:border-l border-[#ecebe8] dark:border-neutral-800 p-2.5 flex flex-col items-end justify-center gap-1 bg-white dark:bg-neutral-900/10">
            <span className="text-[10px] text-[#9b9a97] dark:text-neutral-500 font-bold uppercase tracking-wider">
              {formatKorDate(dist.h?.deathDate)} 사망
            </span>
            <button
              type="button"
              onClick={() => onOpenEvent && onOpenEvent(getStepKey(relatedStep))}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd9cf] bg-[#fbf7ef] px-3 py-0.5 text-[10px] font-bold text-[#7a6544] transition-all hover:bg-[#f4eedf] hover:shadow-sm active:scale-95 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
            >
              {branchLabel} 사건 {'>'}
            </button>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
};

// 사건 상세 (우측 캐스케이드 뷰)
const EventDetail = ({ step, stepMap, onNavigate, onOpenEvent }) => {
  const dists = step.dists || [];
  const activeDists = dists.filter((d) => !d.ex && d.n > 0);
  const spouseDists = activeDists.filter((d) => ['wife', 'husband', 'spouse'].includes(d.h?.relation));
  const otherDists = activeDists.filter((d) => !['wife', 'husband', 'spouse'].includes(d.h?.relation));

  const hasSpouse = dists.some((d) => ['wife', 'husband', 'spouse'].includes(d.h?.relation) && !d.ex && d.n > 0);
  const hasChild = dists.some((d) => ['son', 'daughter', 'child'].includes(d.h?.relation) && !d.ex && d.n > 0);
  const hasParent = dists.some((d) => ['father', 'mother', 'parent'].includes(d.h?.relation) && !d.ex && d.n > 0);
  const hasSibling = dists.some((d) => ['brother', 'sister', 'sibling'].includes(d.h?.relation) && !d.ex && d.n > 0);

  let rankLabel = '';
  let rankTone = 'blue';
  if (hasChild) { rankLabel = '1순위: 직계비속'; }
  else if (hasParent) { rankLabel = '2순위: 직계존속'; rankTone = 'amber'; }
  else if (hasSibling) { rankLabel = '3순위: 형제자매'; rankTone = 'amber'; }

  const era = step.dec?.deathDate ? getLawEra(step.dec.deathDate) : '';
  const eraLabel = lawEraLabel(era);

  const commonD = activeDists.reduce((lcm, d) => math.lcm(lcm, d.d || 1), 1);
  const innerCommonD = activeDists.reduce((lcm, d) => math.lcm(lcm, d.sd || 1), 1);
  const totalRatio = activeDists.reduce((sum, d) => sum + (d.h?.r || 0), 0);

  const otherLabel =
    otherDists.some((d) => ['son', 'daughter', 'child'].includes(d.h?.relation)) ? '직계비속' :
    otherDists.some((d) => ['father', 'mother', 'parent'].includes(d.h?.relation)) ? '직계존속' :
    otherDists.length > 0 ? '형제자매 / 기타' : '';

  return (
    <div>
      {/* 피상속인 헤더 + 상속 방향 정보 통합 */}
      <div className="mb-4 rounded-xl border border-[#e4e2de] bg-[#f7f6f3] px-5 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-baseline gap-x-3">
            <div className="text-[22px] font-black tracking-tight text-[#37352f] dark:text-neutral-100">
              망 {step.dec?.name}
            </div>
            <div className="text-[13px] font-bold text-[#787774] dark:text-neutral-400">
              {formatKorDate(step.dec?.deathDate)} 사망
            </div>
          </div>
          
          <div className="hidden h-5 w-px bg-[#d9d7d1] dark:bg-neutral-600 sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {eraLabel && <Tag tone="blue">{eraLabel}</Tag>}
            {rankLabel && <Tag tone={rankTone}>{rankLabel}</Tag>}
            {hasSpouse && <Tag tone="blue">배우자 동순위</Tag>}
            <span className="text-[17px] ml-2 font-black text-[#3f5f8a] dark:text-blue-300">
              상속지분 {step.inN}/{step.inD}
            </span>
          </div>
        </div>
      </div>
      <ExcludedSection dists={dists} />

      {spouseDists.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-[10px] font-black tracking-[0.06em] text-[#9b9a97] dark:text-neutral-500">배우자</div>
          <div className="space-y-2">
            {spouseDists.map((dist, i) => {
              const related = stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null;
              return <HeirCard key={i} dist={dist} step={step} relatedStep={related} onNavigate={onNavigate} onOpenEvent={onOpenEvent} commonD={commonD} innerCommonD={innerCommonD} />;
            })}
          </div>
        </div>
      )}

      {spouseDists.length > 0 && otherDists.length > 0 && (
        <div className="mb-3 flex justify-center">
          <div className="h-6 w-px bg-[#d9d7d1] dark:bg-neutral-600" />
        </div>
      )}

      {otherDists.length > 0 && (
        <div>
          {otherLabel && (
            <div className="mb-2 text-[10px] font-black tracking-[0.06em] text-[#9b9a97] dark:text-neutral-500">
              {otherLabel}
            </div>
          )}
          <div className="space-y-2">
            {otherDists.map((dist, i) => {
              const related = stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null;
              return <HeirCard key={i} dist={dist} step={step} relatedStep={related} onNavigate={onNavigate} onOpenEvent={onOpenEvent} commonD={commonD} innerCommonD={innerCommonD} totalRatio={totalRatio} />;
            })}
          </div>
        </div>
      )}

      {activeDists.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#e4e2de] px-5 py-8 text-center text-[13px] text-[#9b9a97] dark:border-neutral-700 dark:text-neutral-500">
          이 사건의 상속인이 없습니다.
        </div>
      )}
    </div>
  );
};

// 뷰 모드 전환 버튼
const ViewModeBtn = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
      active
        ? 'bg-[#37352f] text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'text-[#787774] hover:bg-[#efefed] dark:text-neutral-300 dark:hover:bg-neutral-700'
    }`}
  >
    {children}
  </button>
);

// 사건 네비게이터 아이템
const NavItem = ({ step, index, active, depth, hasChildren, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
      active
        ? 'border-[#cfd9e8] bg-[#f0f6ff] dark:border-blue-900/40 dark:bg-blue-950/20'
        : 'border-transparent hover:border-[#e4e2de] hover:bg-[#fafaf9] dark:hover:border-neutral-700 dark:hover:bg-neutral-900/40'
    }`}
    style={{ paddingLeft: `${12 + depth * 14}px` }}
  >
    <div className="flex items-center gap-2">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
        active ? 'bg-[#3b5f8a] text-white dark:bg-blue-600' : 'bg-[#e4e2de] text-[#787774] dark:bg-neutral-700 dark:text-neutral-400'
      }`}>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[12px] font-black ${active ? 'text-[#2d4a6e] dark:text-blue-200' : 'text-[#37352f] dark:text-neutral-200'}`}>
          망 {step.dec?.name}
        </div>
        <div className="text-[10px] text-[#9b9a97] dark:text-neutral-500">
          {formatKorDate(step.dec?.deathDate)}
        </div>
      </div>
      {hasChildren && <span className="shrink-0 text-[10px] text-[#9b9a97] dark:text-neutral-600">↓</span>}
    </div>
  </button>
);

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function TreePanel({
  tree,
  treeToggleSignal,
  isAllExpanded,
  setTreeToggleSignal,
  setIsAllExpanded,
  calcSteps = [],
  handleNavigate,
  removeHeir,
  viewMode,
  setViewMode,
  navigationSignal,
}) {
  const [selectedStepKey, setSelectedStepKey] = React.useState(null);

  const steps = React.useMemo(
    () => (Array.isArray(calcSteps) ? calcSteps.filter((s) => s?.dec) : []),
    [calcSteps]
  );

  const stepMap = React.useMemo(() => {
    const map = new Map();
    steps.forEach((step, i) => {
      const key = getStepKey(step, i);
      map.set(key, step);
      if (step.dec?.personId) map.set(step.dec.personId, step);
      if (step.dec?.id) map.set(step.dec.id, step);
    });
    return map;
  }, [steps]);

  const { childrenOf, parentOf } = React.useMemo(() => buildStepTree(steps), [steps]);

  const stepDepths = React.useMemo(() => {
    const depths = new Map();
    steps.forEach((step, i) => {
      const key = getStepKey(step, i);
      let depth = 0;
      let cur = key;
      while (parentOf.has(cur)) { depth++; cur = parentOf.get(cur); }
      depths.set(key, depth);
    });
    return depths;
  }, [steps, parentOf]);

  React.useEffect(() => {
    if (!steps.length) { setSelectedStepKey(null); return; }
    if (!selectedStepKey || !stepMap.has(selectedStepKey)) {
      setSelectedStepKey(getStepKey(steps[0], 0));
    }
  }, [steps, selectedStepKey, stepMap]);

  const selectedStep = React.useMemo(
    () => (steps.length ? stepMap.get(selectedStepKey) || steps[0] : null),
    [steps, selectedStepKey, stepMap]
  );

  const modeBar = (
    <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[#e5e5e5] bg-[#f8f8f7] p-4 text-[13px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 no-print">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-[#dcdcd9] bg-[#f1f1ef] px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-800">
          <ViewModeBtn active={viewMode === 'tree'} onClick={() => setViewMode('tree')}>트리 보기</ViewModeBtn>
          <ViewModeBtn active={viewMode === 'flow'} onClick={() => setViewMode('flow')}>사건 검토</ViewModeBtn>
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
      <span className="text-[12px]">
        {viewMode === 'tree'
          ? '이름을 클릭하면 하위 관계도를 펼치거나 접을 수 있습니다.'
          : '사망 사건별로 상속 방향과 지분 분배를 독립적으로 점검합니다.'}
      </span>
    </div>
  );

  if (viewMode === 'tree') {
    return (
      <div className="flex h-full animate-in fade-in flex-col py-2 duration-300">
        {modeBar}
        <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
          <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} onDelete={removeHeir} navigationSignal={navigationSignal} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-in fade-in flex-col py-2 duration-300">
      {modeBar}

      {steps.length === 0 || !selectedStep ? (
        <div className="rounded-2xl border border-dashed border-[#d9d9d5] bg-white px-5 py-8 text-center text-[13px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400">
          계산 결과가 없습니다. 데이터 입력 후 다시 확인해 주세요.
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* 좌측: 사건 네비게이터 */}
          <aside className="space-y-1 rounded-2xl border border-[#e9e9e7] bg-[#fbfbfa] p-2 dark:border-neutral-700 dark:bg-neutral-900/40">
            <div className="mb-2 px-2 pt-1 text-[10px] font-black tracking-[0.07em] text-[#9b9a97] dark:text-neutral-500">
              사건 목록 ({steps.length})
            </div>
            {steps.map((step, i) => {
              const key = getStepKey(step, i);
              return (
                <NavItem
                  key={key}
                  step={step}
                  index={i}
                  active={selectedStep && getStepKey(selectedStep) === key}
                  depth={stepDepths.get(key) || 0}
                  hasChildren={childrenOf.has(key)}
                  onClick={() => setSelectedStepKey(key)}
                />
              );
            })}
          </aside>

          {/* 우측: 캐스케이드 뷰 */}
          <section className="min-h-0 overflow-y-auto rounded-2xl border border-[#e9e9e7] bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
            <EventDetail
              step={selectedStep}
              stepMap={stepMap}
              onNavigate={handleNavigate}
              onOpenEvent={setSelectedStepKey}
            />
          </section>
        </div>
      )}
    </div>
  );
}
