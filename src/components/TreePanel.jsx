import React from 'react';
import TreeReportNode from './TreeReportNode';
import { formatKorDate, getLawEra, getRelStr, isBefore, math } from '../engine/utils';

const getStepKey = (step, index) => step?.dec?.personId || step?.dec?.id || `step-${index}`;

const lawEraLabel = (era) => {
  if (era === '1960') return '1960년 제정 민법 적용';
  if (era === '1979') return '1979년 개정 민법 적용';
  if (era === '1991') return '1991년 개정 민법 적용';
  return '적용 법 확인 필요';
};

const buildStepTree = (steps) => {
  const parentOf = new Map();

  steps.forEach((step, i) => {
    const childKey = getStepKey(step, i);
    steps.forEach((parentStep, pi) => {
      if (pi === i) return;
      const parentKey = getStepKey(parentStep, pi);
      const isChild = (parentStep.dists || []).some((d) => {
        const pid = d.h?.personId || d.h?.id;
        return pid === step.dec?.personId || pid === step.dec?.id;
      });
      if (isChild && !parentOf.has(childKey)) parentOf.set(childKey, parentKey);
    });
  });

  return { parentOf };
};

const relationTone = (relation) => {
  if (['wife', 'husband', 'spouse'].includes(relation)) return 'blue';
  if (['father', 'mother', 'parent'].includes(relation)) return 'amber';
  return 'default';
};

const Tag = ({ children, tone = 'default', className = '' }) => {
  const cls =
    tone === 'blue'
      ? 'border-[#d7e5f9] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300'
      : tone === 'amber'
      ? 'border-[#eadfcb] bg-[#fbf6ed] text-[#7a6240] dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : tone === 'green'
      ? 'border-[#cfe5d7] bg-[#f1faf4] text-[#2f6f4d] dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
      : tone === 'rose'
      ? 'border-[#ead7da] bg-[#fcf4f5] text-[#8a5a5f] dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
      : 'border-[#e4e2de] bg-[#f7f6f3] text-[#5d5b57] dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300';

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls} ${className}`}>{children}</span>;
};

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

const EventNavItem = ({ step, index, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
      active
        ? 'border-[#cfd9e8] bg-[#f0f6ff] dark:border-blue-900/40 dark:bg-blue-950/20'
        : 'border-transparent bg-transparent hover:border-[#e4e2de] hover:bg-[#fafaf9] dark:hover:border-neutral-700 dark:hover:bg-neutral-900/40'
    }`}
  >
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
        active ? 'bg-[#3b5f8a] text-white dark:bg-blue-600' : 'bg-[#e4e2de] text-[#787774] dark:bg-neutral-700 dark:text-neutral-400'
      }`}>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] font-black ${active ? 'text-[#2d4a6e] dark:text-blue-200' : 'text-[#37352f] dark:text-neutral-200'}`}>
          망 {step.dec?.name}
        </div>
        <div className="mt-0.5 text-[11px] text-[#9b9a97] dark:text-neutral-500">{formatKorDate(step.dec?.deathDate)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag tone="blue">상속지분 {step.inN}/{step.inD}</Tag>
          <Tag>{(step.dists || []).filter((d) => !d.ex && d.n > 0).length}명 분배</Tag>
        </div>
      </div>
    </div>
  </button>
);

const buildShareInfo = (step, dist, innerCommonD, commonD) => {
  const innerScale = innerCommonD && dist.sd && innerCommonD !== dist.sd ? innerCommonD / dist.sd : 1;
  const outerScale = commonD && dist.d && commonD !== dist.d ? commonD / dist.d : 1;
  const innerShare = `${(dist.sn || 0) * innerScale}/${innerCommonD || dist.sd || 1}`;
  const finalShare = `${(dist.n || 0) * outerScale}/${commonD || dist.d || 1}`;
  return {
    innerShare,
    finalShare,
    formula: `${step.inN}/${step.inD} × ${innerShare}`,
  };
};

const getNodeBadges = (dist) => {
  const badges = [];
  if (typeof dist.h?.isHoju === 'boolean' && dist.h.isHoju) badges.push({ label: '호주상속', tone: 'blue' });
  if (dist.h?.relation === 'daughter') {
    badges.push({
      label: dist.h?.isSameRegister === false ? '비동일가적' : '동일가적',
      tone: dist.h?.isSameRegister === false ? 'amber' : 'green',
    });
  }
  if (typeof dist.mod === 'string') {
    if (dist.mod.includes('5할') && dist.mod.includes('가산')) badges.push({ label: '가산 5할', tone: 'blue' });
    else if (dist.mod.includes('1/2') && dist.mod.includes('감산')) badges.push({ label: '감산 1/2', tone: 'amber' });
    else if (dist.mod.includes('1/4') && dist.mod.includes('감산')) badges.push({ label: '감산 1/4', tone: 'amber' });
    else if (dist.mod.includes('가산')) badges.push({ label: '가산', tone: 'blue' });
    else if (dist.mod.includes('감산')) badges.push({ label: '감산', tone: 'amber' });
  }
  return badges;
};

const getReviewNotes = (step, activeDists) => {
  const notes = [];
  const hasMultipleRoutes = Array.isArray(step.inflows) && step.inflows.length > 1;
  if (hasMultipleRoutes) {
    const sources = step.inflows.map((flow) => `${flow.from} ${flow.n}/${flow.d}`).join(' + ');
    notes.push(`복수 경로 유입: ${sources}`);
  }
  if (activeDists.some((d) => typeof d.mod === 'string' && d.mod.includes('호주'))) {
    notes.push('이번 사건에는 호주상속 판단이 반영된 상속인이 있습니다.');
  }
  if (activeDists.some((d) => d.h?.relation === 'daughter')) {
    notes.push('여성 상속인의 동일가적/비동일가적 상태가 결과를 바꿀 수 있습니다.');
  }
  if (activeDists.some((d) => d.h?.deathDate && isBefore(d.h.deathDate, step.dec?.deathDate))) {
    notes.push('선사망 상속인이 있어 대습상속 검토가 함께 필요합니다.');
  }
  if (activeDists.some((d) => d.h?.deathDate && !isBefore(d.h.deathDate, step.dec?.deathDate))) {
    notes.push('지분을 받은 뒤 다시 사망한 상속인이 있어 재상속 검토가 이어집니다.');
  }
  return notes;
};

const createGraphNode = ({ key, x, y, width, height, title, subtitle, dateLabel = '', tags = [], share = null, dist = null, relatedStep = null, branchLabel = '', eventDateNote = '', isRoot = false }) => ({
  key,
  x,
  y,
  width,
  height,
  title,
  subtitle,
  dateLabel,
  tags,
  share,
  dist,
  relatedStep,
  branchLabel,
  eventDateNote,
  isRoot,
});

const buildEventLayout = (step, stepMap, commonD, innerCommonD) => {
  const activeDists = (step.dists || []).filter((d) => !d.ex && d.n > 0);
  const spouseDists = activeDists.filter((d) => ['wife', 'husband', 'spouse'].includes(d.h?.relation));
  const heirDists = activeDists.filter((d) => !['wife', 'husband', 'spouse'].includes(d.h?.relation));

  const rootW = 250;
  const rootH = 110;
  const cardW = 260;
  const cardH = 155;
  const leftColX = 70;
  const topY = 76;
  const verticalGap = 28;
  const heirsX = 520;
  const heirGap = 20;

  const root = createGraphNode({
    key: 'root',
    x: leftColX,
    y: topY,
    width: rootW,
    height: rootH,
    title: `망 ${step.dec?.name}`,
    subtitle: '피상속인',
    dateLabel: `${formatKorDate(step.dec?.deathDate)} 사망`,
    tags: [
      { label: `상속지분 ${step.inN}/${step.inD}`, tone: 'blue' },
      ...(step.dec?.isHoju ? [{ label: '호주', tone: 'blue' }] : []),
    ],
    isRoot: true,
  });

  const spouseNodes = spouseDists.map((dist, index) => {
    const share = buildShareInfo(step, dist, innerCommonD, commonD);
    return createGraphNode({
      key: dist.h?.personId || dist.h?.id || `spouse-${index}`,
      x: leftColX,
      y: topY + rootH + verticalGap + index * (cardH + verticalGap),
      width: cardW,
      height: cardH,
      title: dist.h?.name,
      subtitle: getRelStr(dist.h?.relation, step.dec?.deathDate) || '배우자',
      tags: getNodeBadges(dist),
      share,
      dist,
      relatedStep: stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null,
      branchLabel: dist.h?.deathDate ? (isBefore(dist.h.deathDate, step.dec?.deathDate) ? '대습상속 ->' : '재상속 ->') : '',
      eventDateNote: dist.h?.deathDate ? `${formatKorDate(dist.h.deathDate)} 사망` : '',
    });
  });

  const heirNodes = heirDists.map((dist, index) => {
    const share = buildShareInfo(step, dist, innerCommonD, commonD);
    return createGraphNode({
      key: dist.h?.personId || dist.h?.id || `heir-${index}`,
      x: heirsX,
      y: topY + index * (cardH + heirGap),
      width: cardW,
      height: cardH,
      title: dist.h?.name,
      subtitle: getRelStr(dist.h?.relation, step.dec?.deathDate) || '상속인',
      tags: getNodeBadges(dist),
      share,
      dist,
      relatedStep: stepMap.get(dist.h?.personId) || stepMap.get(dist.h?.id) || null,
      branchLabel: dist.h?.deathDate ? (isBefore(dist.h.deathDate, step.dec?.deathDate) ? '대습상속 ->' : '재상속 ->') : '',
      eventDateNote: dist.h?.deathDate ? `${formatKorDate(dist.h.deathDate)} 사망` : '',
    });
  });

  const leftColBottom = spouseNodes.length > 0 ? spouseNodes[spouseNodes.length - 1].y + cardH : root.y + rootH;
  const heirsBottom = heirNodes.length > 0 ? heirNodes[heirNodes.length - 1].y + cardH : root.y + rootH;

  const graphWidth = Math.max(1040, heirsX + cardW + 100);
  const graphHeight = Math.max(leftColBottom, heirsBottom) + 80;
  return { root, spouseNodes, heirNodes, graphWidth, graphHeight };
};

const EdgeLabel = ({ x, y, text }) => (
  <g>
    <rect x={x - 28} y={y - 11} width="56" height="22" rx="11" fill="#f7f6f3" stroke="#e4e2de" />
    <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6b6964">{text}</text>
  </g>
);

const OrthogonalEdges = ({ layout }) => {
  const rootRightX = layout.root.x + layout.root.width;
  const rootCenterY = layout.root.y + layout.root.height / 2;
  const spouseRightX = layout.spouseNodes.length > 0 ? layout.spouseNodes[0].x + layout.spouseNodes[0].width : rootRightX;
  const busX = 430;
  const heirsLeftX = layout.heirNodes.length > 0 ? layout.heirNodes[0].x : 0;

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.graphWidth} ${layout.graphHeight}`} preserveAspectRatio="xMinYMin meet">
      {layout.heirNodes.length > 0 && (
        <>
          <path d={`M ${rootRightX} ${rootCenterY} L ${busX} ${rootCenterY}`} fill="none" stroke="#cfd6de" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M ${busX} ${rootCenterY} L ${busX} ${layout.heirNodes[layout.heirNodes.length - 1].y + layout.heirNodes[layout.heirNodes.length - 1].height / 2}`} fill="none" stroke="#cfd6de" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {layout.heirNodes.map((node) => {
        const centerY = node.y + node.height / 2;
        const labelX = (busX + heirsLeftX) / 2;
        return (
          <g key={`heir-edge-${node.key}`}>
            <path d={`M ${busX} ${centerY} L ${node.x} ${centerY}`} fill="none" stroke="#cfd6de" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <EdgeLabel x={labelX} y={centerY - 16} text={node.share.innerShare} />
          </g>
        );
      })}

      {layout.spouseNodes.map((node) => {
        const startX = spouseRightX;
        const startY = node.y + node.height / 2;
        const targetX = heirsLeftX ? busX : node.x + node.width + 100;
        return (
          <g key={`spouse-edge-${node.key}`}>
            {layout.heirNodes.length > 0 && (
              <>
                <path d={`M ${startX} ${startY} L ${busX} ${startY}`} fill="none" stroke="#cfd6de" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <EdgeLabel x={(startX + busX) / 2} y={startY - 16} text={node.share.innerShare} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const PersonNodeCard = ({ node, stepDate, onNavigate, onOpenEvent }) => {
  const relationLabel = node.subtitle || getRelStr(node.dist?.h?.relation, stepDate) || '상속인';
  const hasBranch = Boolean(node.relatedStep && node.branchLabel);

  return (
    <div
      className="absolute rounded-2xl border border-[#ebeae7] bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/95"
      style={{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, minHeight: `${node.height}px` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={relationTone(node.dist?.h?.relation)}>{relationLabel}</Tag>
        {node.isRoot ? (
          <div className="text-[16px] font-black text-[#37352f] dark:text-neutral-100">{node.title}</div>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(node.dist?.h?.personId || node.dist?.h?.id)}
            className="text-[15px] font-black text-[#37352f] transition-colors hover:text-blue-700 dark:text-neutral-100 dark:hover:text-blue-300"
          >
            {node.title}
          </button>
        )}
        {node.tags.map((tag) => (
          <Tag key={`${node.key}-${tag.label}`} tone={tag.tone}>{tag.label}</Tag>
        ))}
      </div>

      {node.dateLabel && <div className="mt-2 text-[11px] font-bold text-[#7c7a76] dark:text-neutral-400">{node.dateLabel}</div>}
      {node.share && (
        <div className="mt-3 rounded-xl bg-[#fafaf9] px-3 py-2 dark:bg-neutral-950/30">
          <div className="font-mono text-[11px] text-[#787774] dark:text-neutral-400">{node.share.formula}</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#8a8884] dark:text-neutral-400">이 사건 계산</div>
            <div className="text-[17px] font-black text-[#3f5f8a] dark:text-blue-300">{node.share.finalShare}</div>
          </div>
        </div>
      )}

      {hasBranch && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[10px] text-[#8a8884] dark:text-neutral-400">{node.eventDateNote}</div>
          <button
            type="button"
            onClick={() => onOpenEvent && onOpenEvent(getStepKey(node.relatedStep))}
            className="inline-flex items-center gap-1 rounded-full border border-[#ddd9cf] bg-[#fbf7ef] px-2.5 py-1 text-[10px] font-bold text-[#7a6544] hover:bg-[#f4eedf] dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
          >
            {node.branchLabel}
          </button>
        </div>
      )}
    </div>
  );
};

const useDragPan = () => {
  const ref = React.useRef(null);
  const dragState = React.useRef({ dragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const onMouseDown = React.useCallback((event) => {
    const el = ref.current;
    if (!el) return;
    dragState.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    el.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = React.useCallback((event) => {
    const el = ref.current;
    if (!el || !dragState.current.dragging) return;
    el.scrollLeft = dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
    el.scrollTop = dragState.current.scrollTop - (event.clientY - dragState.current.startY);
  }, []);

  const stopDragging = React.useCallback(() => {
    const el = ref.current;
    dragState.current.dragging = false;
    if (el) el.style.cursor = 'grab';
  }, []);

  return { ref, onMouseDown, onMouseMove, onMouseUp: stopDragging, onMouseLeave: stopDragging };
};

const EventGraphView = ({ step, stepMap, onNavigate, onOpenEvent }) => {
  const activeDists = (step.dists || []).filter((d) => !d.ex && d.n > 0);
  const commonD = activeDists.reduce((lcm, d) => math.lcm(lcm, d.d || 1), 1);
  const innerCommonD = activeDists.reduce((lcm, d) => math.lcm(lcm, d.sd || 1), 1);
  const notes = getReviewNotes(step, activeDists);
  const era = step.dec?.deathDate ? getLawEra(step.dec.deathDate) : '';
  const layout = React.useMemo(() => buildEventLayout(step, stepMap, commonD, innerCommonD), [step, stepMap, commonD, innerCommonD]);
  const pan = useDragPan();

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#e4e2de] bg-[#f7f6f3] px-5 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-black tracking-[0.08em] text-[#9b9a97] dark:text-neutral-500">사건 그래프</span>
          <div className="text-[22px] font-black tracking-tight text-[#37352f] dark:text-neutral-100">피상속인 망 {step.dec?.name}</div>
          <div className="text-[13px] font-bold text-[#787774] dark:text-neutral-400">{formatKorDate(step.dec?.deathDate)} 사망</div>
          {step.dec?.isHoju && <Tag tone="blue">호주</Tag>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tag tone="blue">상속지분 {step.inN}/{step.inD}</Tag>
          <Tag>{lawEraLabel(era)}</Tag>
          <Tag>{activeDists.length}명 분배</Tag>
          <Tag>드래그로 이동</Tag>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="rounded-2xl border border-[#ece8de] bg-[#fcfaf5] px-5 py-4 dark:border-neutral-700 dark:bg-neutral-900/30">
          <div className="mb-2 text-[12px] font-black text-[#6b5c45] dark:text-amber-200">이번 사건에서 먼저 볼 것</div>
          <ul className="space-y-1.5 text-[13px] leading-6 text-[#6a6964] dark:text-neutral-300">
            {notes.map((note, index) => (
              <li key={`${note}-${index}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8ae7f] dark:bg-amber-400" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[#e9e9e7] bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
        <div
          ref={pan.ref}
          onMouseDown={pan.onMouseDown}
          onMouseMove={pan.onMouseMove}
          onMouseUp={pan.onMouseUp}
          onMouseLeave={pan.onMouseLeave}
          className="w-full cursor-grab select-none rounded-xl bg-[#fcfcfb] dark:bg-neutral-950/20"
        >
          <div className="relative" style={{ width: `${layout.graphWidth}px`, height: `${layout.graphHeight}px` }}>
            <OrthogonalEdges layout={layout} />
            <PersonNodeCard node={layout.root} stepDate={step.dec?.deathDate} onNavigate={onNavigate} onOpenEvent={onOpenEvent} />
            {layout.spouseNodes.map((node) => (
              <PersonNodeCard key={node.key} node={node} stepDate={step.dec?.deathDate} onNavigate={onNavigate} onOpenEvent={onOpenEvent} />
            ))}
            {layout.heirNodes.map((node) => (
              <PersonNodeCard key={node.key} node={node} stepDate={step.dec?.deathDate} onNavigate={onNavigate} onOpenEvent={onOpenEvent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DialScrubber = ({ listRef, steps, selectedKey, onSelect }) => {
  const trackRef = React.useRef(null);
  const dragging = React.useRef(false);
  const [scrollRatio, setScrollRatio] = React.useState(0);
  const [thumbRatio, setThumbRatio] = React.useState(1);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setScrollRatio(max > 0 ? el.scrollTop / max : 0);
      setThumbRatio(el.clientHeight / el.scrollHeight);
    };
    onScroll();
    el.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, [listRef, steps.length]);

  const seek = React.useCallback((clientY) => {
    const el = listRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  }, [listRef]);

  React.useEffect(() => {
    const onMove = (e) => { if (dragging.current) seek(e.clientY); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [seek]);

  const total = steps.length;
  const thumbH = Math.max(thumbRatio * 100, 6);
  const thumbTop = scrollRatio * (100 - thumbH);

  return (
    <div
      ref={trackRef}
      className="flex w-5 shrink-0 cursor-ns-resize select-none items-stretch py-3"
      onMouseDown={(e) => { dragging.current = true; seek(e.clientY); e.preventDefault(); }}
    >
      <div className="relative mx-auto w-[3px] flex-1 rounded-full bg-[#e4e2de] dark:bg-neutral-700">
        <div
          className="absolute left-0 w-full rounded-full bg-[#a8a39a] dark:bg-neutral-500 pointer-events-none"
          style={{ top: `${thumbTop}%`, height: `${thumbH}%` }}
        />
        {total > 1 && steps.map((step, i) => {
          const key = getStepKey(step, i);
          const pct = (i / (total - 1)) * 100;
          const isActive = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              title={`망 ${step.dec?.name || ''}`}
              onClick={(e) => { e.stopPropagation(); onSelect(key); }}
              className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all ${
                isActive
                  ? 'h-3 w-3 bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                  : 'h-1.5 w-1.5 bg-[#c8c4be] hover:bg-[#6b6964] dark:bg-neutral-600 dark:hover:bg-neutral-400'
              }`}
              style={{ top: `calc(${pct}% - ${isActive ? 6 : 3}px)` }}
            />
          );
        })}
      </div>
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
  removeHeir,
  viewMode,
  setViewMode,
  navigationSignal,
  reviewContext = null,
  onCompleteReview,
  onOpenInInput,
}) {
  const [selectedStepKey, setSelectedStepKey] = React.useState(null);
  const asideListRef = React.useRef(null);

  const steps = React.useMemo(() => (Array.isArray(calcSteps) ? calcSteps.filter((s) => s?.dec) : []), [calcSteps]);

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

  const { parentOf } = React.useMemo(() => buildStepTree(steps), [steps]);

  const stepDepths = React.useMemo(() => {
    const depths = new Map();
    steps.forEach((step, i) => {
      const key = getStepKey(step, i);
      let depth = 0;
      let cur = key;
      while (parentOf.has(cur)) {
        depth += 1;
        cur = parentOf.get(cur);
      }
      depths.set(key, depth);
    });
    return depths;
  }, [steps, parentOf]);

  React.useEffect(() => {
    if (!steps.length) {
      setSelectedStepKey(null);
      return;
    }
    if (!selectedStepKey || !stepMap.has(selectedStepKey)) {
      setSelectedStepKey(getStepKey(steps[0], 0));
    }
  }, [steps, selectedStepKey, stepMap]);

  React.useEffect(() => {
    if (!navigationSignal?.targetId || viewMode !== 'flow' || !steps.length) return;
    const targetId = navigationSignal.targetId;
    const nextIndex = steps.findIndex(
      (step) => step?.dec?.personId === targetId || step?.dec?.id === targetId,
    );
    if (nextIndex >= 0) {
      setSelectedStepKey(getStepKey(steps[nextIndex], nextIndex));
    }
  }, [navigationSignal, viewMode, steps]);

  const selectedStep = React.useMemo(() => (steps.length ? stepMap.get(selectedStepKey) || steps[0] : null), [steps, selectedStepKey, stepMap]);
  const isGuideEventOpen =
    navigationSignal?.source === 'guide-event' &&
    !!selectedStep &&
    (selectedStep?.dec?.personId === navigationSignal?.targetId || selectedStep?.dec?.id === navigationSignal?.targetId);

  const modeBar = (
    <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[#e5e5e5] bg-[#f8f8f7] p-4 text-[13px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 no-print">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-[#dcdcd9] bg-[#f1f1ef] px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-800">
          <ViewModeBtn active={viewMode === 'flow'} onClick={() => setViewMode('flow')}>사건 그래프</ViewModeBtn>
          <ViewModeBtn active={viewMode === 'tree'} onClick={() => setViewMode('tree')}>관계 트리</ViewModeBtn>
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
          ? '관계 트리는 가족 구조를 확인하는 화면입니다.'
          : '사건 그래프는 선택한 사건의 지분 이동과 다음 검토 포인트를 사각형 노드와 직각 연결선으로 보여줍니다.'}
      </span>
    </div>
  );

  if (viewMode === 'tree') {
    return (
      <div className="flex h-full min-h-0 animate-in fade-in flex-col py-2 duration-300">
        {modeBar}
        <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
          <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} onDelete={removeHeir} navigationSignal={navigationSignal} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 animate-in fade-in flex-col py-2 duration-300">
      {modeBar}

      {reviewContext && selectedStep && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[12px] shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30 no-print">
          <div className="min-w-0 flex-1">
            <span className="font-black text-blue-800 dark:text-blue-200">현재 검토 중: </span>
            <span className="font-bold text-blue-700 dark:text-blue-300">망 {selectedStep.dec?.name} 사건</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenInInput?.(selectedStep.dec?.personId || selectedStep.dec?.id)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300"
            >
              입력 탭에서 수정
            </button>
            <button
              type="button"
              onClick={onCompleteReview}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              검토 완료 ✓
            </button>
          </div>
        </div>
      )}

      {steps.length === 0 || !selectedStep ? (
        <div className="rounded-2xl border border-dashed border-[#d9d9d5] bg-white px-5 py-8 text-center text-[13px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400">
          아직 시뮬레이션할 사건이 없습니다. 입력 정보를 확인한 뒤 계산 상세 탭에서 결과를 만든 후 다시 확인해 주세요.
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="sticky top-[70px] self-start flex gap-1 max-h-[calc(100vh-96px)]">
            <DialScrubber
              listRef={asideListRef}
              steps={steps}
              selectedKey={selectedStepKey}
              onSelect={setSelectedStepKey}
            />
            <div
              ref={asideListRef}
              className="flex-1 overflow-y-auto rounded-2xl border border-[#e9e9e7] bg-[#fbfbfa] p-2 dark:border-neutral-700 dark:bg-neutral-900/40 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="mb-2 px-2 pt-1 text-[10px] font-black tracking-[0.07em] text-[#9b9a97] dark:text-neutral-500">
                사건 목록 ({steps.length})
              </div>
              {steps.map((step, i) => {
                const key = getStepKey(step, i);
                return (
                  <div key={key} style={{ marginLeft: `${(stepDepths.get(key) || 0) * 8}px` }}>
                    <EventNavItem
                      step={step}
                      index={i}
                      active={selectedStep && getStepKey(selectedStep) === key}
                      onClick={() => setSelectedStepKey(key)}
                    />
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-[#e9e9e7] bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/50">
            <EventGraphView
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
