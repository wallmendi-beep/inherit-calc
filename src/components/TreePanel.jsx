import React from 'react';
import { getLawEra, getRelStr, isBefore, math } from '../engine/utils';

const NODE_W = 220;
const NODE_H = 42;
const TOGGLE_GAP = 10;
const TOGGLE_SIZE = 24;
const X_GAP = 118;
const Y_GAP = 24;
const PAD = 72;

const getPersonKey = (person) => person?.personId || person?.id || null;
const getStepEventDate = (step) => step?.distributionDate || step?.dec?.deathDate || '';
const getStepKey = (step, index = 0) => {
  const personKey = getPersonKey(step?.dec) || `step-${index}`;
  return `event:${personKey}:${getStepEventDate(step)}:${index}`;
};
const lawEraLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '79년 민법';
  if (era === '1991') return '현행민법';
  return '적용 법 확인';
};

const getContinuationEventDate = (step, heir) => {
  const eventDate = getStepEventDate(step);
  if (!heir?.deathDate) return '';
  return eventDate && isBefore(heir.deathDate, eventDate) ? eventDate : heir.deathDate;
};

const shareText = (n, d) => `${n || 0}/${d || 1}`;
const nodeShareText = (share) => (share ? `${share.n || 0}/${share.d || 1}` : '-');
const reportHeaderShareText = (share) => {
  if (!share) return '-';
  return `${share.d || 1}분의 ${share.n || 0}`;
};
const formatKoreanDate = (date) => {
  if (!date) return '';
  const [year, month, day] = String(date).split('-');
  if (!year) return '';
  if (!month || !day) return `${year}년`;
  return `${year}년 ${month}월 ${day}일`;
};
const getCommonDenominator = (dists = []) => dists.reduce((acc, dist) => (dist?.d ? math.lcm(acc, dist.d) : acc), 1);
const getCommonEdgeDenominator = (dists = []) => dists.reduce((acc, dist) => (dist?.sd ? math.lcm(acc, dist.sd) : acc), 1);
const normalizeShare = (share, denom) => {
  if (!share || !denom || !share.d) return share;
  const scale = denom / share.d;
  if (!Number.isInteger(scale)) return share;
  return { n: (share.n || 0) * scale, d: denom };
};
const getEdgeShare = (dist) => ({
  n: dist?.sn ?? dist?.n ?? 0,
  d: dist?.sd ?? dist?.d ?? 1,
});
const formatModifierShort = (dist) => {
  if (!dist) return '-';
  if (dist.ex) return '상속권 없음';
  const text = dist.mod || '';
  if (!text) {
    if (dist.h?.relation === 'son' || dist.h?._origRelation === 'son') return '';
    return dist.h?.isSameRegister === false ? '비동일가적' : '동일가적';
  }
  if (text.includes('호주')) return '호주상속';
  if (text.includes('처') && text.includes('가산')) return '처(가산)';
  if (text.includes('처') && text.includes('감산')) return '처(감산)';
  if (text.includes('출가') && text.includes('감산')) return '출가감산';
  if (text.includes('남편') && text.includes('가산')) return '남편(가산)';
  if (text.includes('여자') && text.includes('감산')) return '여자감산';
  if (text.includes('가산')) return '가산';
  if (text.includes('감산')) return '감산';
  return text.replace(/\s*\(.*\)$/, '');
};

const getEventReportNode = (node, graph) => {
  let cur = node;
  while (cur && cur.type !== 'event') {
    const parentId = graph.parent.get(cur.id);
    cur = parentId ? graph.nodes.get(parentId) : null;
  }
  return cur || node;
};

const getConnectedEventEdges = (eventNode, graph) => {
  if (!eventNode || eventNode.type !== 'event') return [];
  return graph.edges.filter((edge) => {
    if (edge.from !== eventNode.id) return false;
    const target = graph.nodes.get(edge.to);
    return target?.type === 'event' && (edge.label === '재상속' || edge.label === '대습상속');
  });
};

const buildNoRightSummary = (dist, eventDate) => {
  const person = dist?.h || {};
  const name = person.name || '이름 미상';
  if (person.remarriageDate) return `[${name}] ${formatKoreanDate(person.remarriageDate)} 재혼으로 상속권 없음`;
  if (person.marriageDate && (dist?.ex || '').includes('혼인')) return `[${name}] ${formatKoreanDate(person.marriageDate)} 혼인으로 상속권 없음`;
  if (person.deathDate && eventDate && isBefore(person.deathDate, eventDate)) return `[${name}] ${formatKoreanDate(person.deathDate)} 사망으로 상속권 없음`;
  if (dist?.ex) return `[${name}] ${dist.ex}`;
  return `[${name}] 상속권 없음`;
};

const getRawExclusionReason = (person, eventDate) => {
  if (!person) return '';
  if (person.exclusionOption === 'renounce') return '상속포기로 상속권 없음';
  if (person.exclusionOption === 'remarried') {
    const date = formatKoreanDate(person.remarriageDate);
    return `${date ? `${date} ` : ''}재혼으로 상속권 없음`;
  }
  if (person.exclusionOption === 'blocked_husband_substitution') return '구민법상 사위 대습상속권 없음';
  if (person.exclusionOption === 'lost') return '상속권 상실로 상속권 없음';
  if (person.exclusionOption === 'disqualified') return '상속결격으로 상속권 없음';
  if (person.isExcluded && person.exclusionOption && person.exclusionOption !== 'predeceased') return '상속권 없음';
  if (['wife', 'husband', 'spouse'].includes(person.relation)) {
    if (person.divorceDate && eventDate && !isBefore(eventDate, person.divorceDate)) {
      const date = formatKoreanDate(person.divorceDate);
      return `${date ? `${date} ` : ''}이혼으로 상속권 없음`;
    }
    if (person.remarriageDate && eventDate && !isBefore(eventDate, person.remarriageDate)) {
      const date = formatKoreanDate(person.remarriageDate);
      return `${date ? `${date} ` : ''}재혼으로 상속권 없음`;
    }
  }
  if (person.isExcluded && person.exclusionOption === 'predeceased' && person.deathDate && eventDate && isBefore(person.deathDate, eventDate)) {
    return `${formatKoreanDate(person.deathDate)} 사망으로 상속권 없음`;
  }
  return '';
};

const buildReportRows = (reportNode, eventDate) => {
  const dists = reportNode?.dists || [];
  const rows = dists.map((dist) => ({ ...dist, reportOnly: false }));
  const seen = new Set(rows.map((dist) => getPersonKey(dist.h)).filter(Boolean));
  const rawHeirs = reportNode?.step?.dec?.heirs || [];

  rawHeirs.forEach((person, index) => {
    const personKey = getPersonKey(person) || `raw-${index}`;
    if (seen.has(personKey)) return;
    const reason = getRawExclusionReason(person, eventDate);
    if (!reason) return;
    rows.push({
      h: person,
      n: 0,
      d: 1,
      sn: 0,
      sd: 1,
      rSnap: 0,
      ex: reason,
      mod: '',
      reportOnly: true,
    });
    seen.add(personKey);
  });

  return rows;
};

const buildModifierSummary = (dist) => {
  const person = dist?.h || {};
  const name = person.name || '이름 미상';
  const text = dist?.mod || '';
  if (!text) return '';
  if (text.includes('출가') || (person.isSameRegister === false && text.includes('감산'))) {
    const date = formatKoreanDate(person.marriageDate);
    return `[${name}] ${date ? `${date} ` : ''}출가로 감산`;
  }
  if (text.includes('호주')) return `[${name}] 호주상속으로 가산`;
  if (text.includes('처') && text.includes('가산')) return `[${name}] 처 지위로 가산`;
  if (text.includes('처') && text.includes('감산')) return `[${name}] 처 지위로 감산`;
  if (text.includes('남편') && text.includes('가산')) return `[${name}] 남편 지위로 가산`;
  if (text.includes('가산')) return `[${name}] 가산`;
  if (text.includes('감산')) return `[${name}] 감산`;
  return `[${name}] ${text}`;
};

const buildContinuationSummary = (edge) => {
  const person = edge?.dist?.h || {};
  const name = person.name || '이름 미상';
  const date = formatKoreanDate(person.deathDate);
  return `[${name}] ${date ? `${date} ` : ''}사망으로 ${edge.label}`;
};

const Tag = ({ children, tone = 'default' }) => {
  const cls = tone === 'blue'
    ? 'border-[#d7e5f9] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300'
    : tone === 'green'
      ? 'border-[#cfe5d7] bg-[#f1faf4] text-[#2f6f4d] dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300'
      : tone === 'amber'
        ? 'border-[#eadfcb] bg-[#fbf6ed] text-[#7a6240] dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200'
        : tone === 'rose'
          ? 'border-[#ead7da] bg-[#fcf4f5] text-[#8a5a5f] dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
          : 'border-[#e4e2de] bg-[#f7f6f3] text-[#5d5b57] dark:border-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300';
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-black ${cls}`}>{children}</span>;
};

const SummaryBlock = ({ title, items, tone = 'default' }) => (
  <div className="rounded-lg border border-[#e9e9e7] bg-[#fafaf9] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
    <div className="mb-1.5">
      <Tag tone={tone}>{title}</Tag>
    </div>
    <div className="space-y-1">
      {items.map((item, index) => (
        <div key={`${title}-${index}`} className="text-[12px] leading-relaxed text-[#5d5b57] dark:text-neutral-300">
          {item}
        </div>
      ))}
    </div>
  </div>
);

const getModifierTone = (text = '') => {
  if (text.includes('가산') || text.includes('호주')) return 'blue';
  if (text.includes('감산')) return 'amber';
  return 'default';
};

const sameShare = (leftN, leftD, rightN, rightD) => (
  Number(leftN || 0) === Number(rightN || 0) && Number(leftD || 1) === Number(rightD || 1)
);

const buildVisualStepEntries = (calcSteps = []) => {
  const entries = [];

  calcSteps.filter((step) => step?.dec).forEach((step) => {
    const sourceBreakdowns = Array.isArray(step.sourceBreakdowns) ? step.sourceBreakdowns : [];
    const activeDists = (step.dists || []).filter((dist) => !dist.ex && dist.n > 0);
    const cardDenom = getCommonDenominator(activeDists);

    if (step.dec?.id === 'root' || sourceBreakdowns.length === 0) {
      const visualStep = {
        ...step,
        dists: step.dists || [],
        cardDenom: getCommonDenominator((step.dists || []).filter((dist) => !dist.ex && dist.n > 0)),
        visualSourceIndex: 0,
      };
      entries.push({ step: visualStep, index: entries.length, id: getStepKey(visualStep, entries.length) });
      return;
    }

    sourceBreakdowns.forEach((breakdown, sourceIndex) => {
      const dists = (breakdown.dists || []).map((dist) => {
        const original = (step.dists || []).find((item) => getPersonKey(item.h) === dist.personId);
        return {
          ...dist,
          h: original?.h || {
            personId: dist.personId,
            id: dist.personId,
            name: dist.name,
            relation: dist.relation,
          },
          n: dist.n,
          d: dist.d,
          sn: dist.sn,
          sd: dist.sd,
          ex: dist.ex || '',
          mod: dist.mod || '',
        };
      });
      const visualStep = {
        ...step,
        inN: breakdown.inN,
        inD: breakdown.inD,
        inheritedDate: breakdown.inheritedDate || step.inheritedDate,
        distributionDate: breakdown.distributionDate || step.distributionDate,
        isSubstitution: !!breakdown.isSubstitution,
        lawEra: breakdown.lawEra || step.lawEra,
        parentDecName: breakdown.from || step.parentDecName,
        dists,
        cardDenom,
        visualSourceIndex: sourceIndex,
        visualSourceKey: `${breakdown.from || step.parentDecName || ''}:${breakdown.inN || 0}/${breakdown.inD || 1}:${breakdown.inheritedDate || ''}:${breakdown.distributionDate || ''}`,
      };
      entries.push({ step: visualStep, index: entries.length, id: getStepKey(visualStep, entries.length) });
    });
  });

  return entries;
};

const buildFlowGraph = (calcSteps = []) => {
  const stepEntries = buildVisualStepEntries(calcSteps);

  const nodes = new Map();
  const edges = [];
  const children = new Map();
  const parent = new Map();

  const addNode = (node) => nodes.set(node.id, node);
  const addEdge = (edge) => {
    edges.push(edge);
    if (!children.has(edge.from)) children.set(edge.from, []);
    if (!children.get(edge.from).includes(edge.to)) children.get(edge.from).push(edge.to);
    if (!parent.has(edge.to)) parent.set(edge.to, edge.from);
  };

  stepEntries.forEach((entry) => {
    const step = entry.step;
    addNode({
      id: entry.id,
      type: 'event',
      step,
      title: step.dec?.name || '이름 미상',
      subtitle: entry.index === 0 ? '원상속' : (step.isSubstitution ? '대습상속' : '재상속'),
      date: getStepEventDate(step),
      share: { n: step.inN || 0, d: step.inD || 1 },
      displayShare: { n: step.inN || 0, d: step.inD || 1 },
      lawEra: step.lawEra || getLawEra(getStepEventDate(step)),
      dists: step.dists || [],
    });
  });

  stepEntries.forEach((entry) => {
    const step = entry.step;
    const eventDate = getStepEventDate(step);
    const activeDists = (step.dists || []).filter((dist) => !dist.ex && dist.n > 0);
    const cardDenom = step.cardDenom || getCommonDenominator(activeDists);
    const edgeDenom = getCommonEdgeDenominator(activeDists);
    (step.dists || []).forEach((dist, distIndex) => {
      const personKey = getPersonKey(dist.h);
      const continuationDate = getContinuationEventDate(step, dist.h);
      const relatedEntry = stepEntries.find((candidate) => {
        if (candidate.id === entry.id) return false;
        const candidatePersonKey = getPersonKey(candidate.step?.dec);
        if (!personKey || candidatePersonKey !== personKey) return false;
        if (getStepEventDate(candidate.step) !== continuationDate) return false;
        if ((candidate.step?.parentDecName || '') !== (step.dec?.name || '')) return false;
        return sameShare(candidate.step?.inN, candidate.step?.inD, dist.n, dist.d);
      });
      const relatedEventId = relatedEntry?.id || null;
      const hasShare = !dist.ex && dist.n > 0;
      const isBlocked = !!dist.ex || dist.n === 0;
      if (isBlocked) return;
      const isPredeceased = dist.h?.deathDate && eventDate && isBefore(dist.h.deathDate, eventDate);
      const terminalId = `person:${entry.id}:${personKey || distIndex}`;
      const shouldLinkEvent = hasShare && relatedEventId && relatedEventId !== entry.id;
      const targetId = shouldLinkEvent ? relatedEventId : terminalId;
      const flowType = shouldLinkEvent
        ? (isPredeceased ? '대습상속' : '재상속')
        : isPredeceased
            ? '선사망'
            : '최종 취득';
      const siblingDisplayShare = normalizeShare({ n: dist.n, d: dist.d }, cardDenom);

      if (!shouldLinkEvent) {
        addNode({
          id: terminalId,
          type: isPredeceased ? 'blocked' : 'terminal',
          dist,
          title: dist.h?.name || '이름 미상',
          subtitle: isPredeceased ? '선사망' : '취득',
          date: dist.h?.deathDate || '',
          share: hasShare ? { n: dist.n, d: dist.d } : null,
          displayShare: hasShare ? siblingDisplayShare : null,
          lawEra: '',
          dists: [],
        });
      } else {
        const target = nodes.get(relatedEventId);
        if (target) {
          nodes.set(relatedEventId, {
            ...target,
            displayShare: siblingDisplayShare,
          });
        }
      }

      addEdge({
        from: entry.id,
        to: targetId,
        dist,
        share: hasShare ? normalizeShare(getEdgeShare(dist), edgeDenom) : null,
        label: flowType,
        blocked: isBlocked,
      });
    });
  });

  const rootId = stepEntries[0]?.id || null;
  return { nodes, edges, children, parent, rootId, stepEntries };
};

const collectDescendants = (id, children, out = new Set()) => {
  (children.get(id) || []).forEach((childId) => {
    if (out.has(childId)) return;
    out.add(childId);
    collectDescendants(childId, children, out);
  });
  return out;
};

const collectAncestors = (id, parent, out = new Set()) => {
  let cur = parent.get(id);
  while (cur && !out.has(cur)) {
    out.add(cur);
    cur = parent.get(cur);
  }
  return out;
};

const buildFocusSet = (selectedId, graph) => {
  if (!selectedId || !graph.nodes.has(selectedId)) return new Set();
  const focus = new Set([selectedId]);
  collectAncestors(selectedId, graph.parent, focus);
  collectDescendants(selectedId, graph.children, focus);
  return focus;
};

const getVisibleIds = (graph, collapsed, focusOnly, focusSet) => {
  const visible = new Set();
  const walk = (id) => {
    if (!id || visible.has(id)) return;
    if (focusOnly && focusSet.size > 0 && !focusSet.has(id)) return;
    visible.add(id);
    if (collapsed.has(id)) return;
    (graph.children.get(id) || []).forEach(walk);
  };
  walk(graph.rootId);
  if (focusOnly && focusSet.size > 0) focusSet.forEach((id) => visible.add(id));
  return visible;
};

const layoutGraph = (graph, collapsed, focusOnly, focusSet) => {
  const visible = getVisibleIds(graph, collapsed, focusOnly, focusSet);
  const heightCache = new Map();

  const measure = (id) => {
    if (heightCache.has(id)) return heightCache.get(id);
    const children = (graph.children.get(id) || []).filter((childId) => visible.has(childId) && !collapsed.has(id));
    const height = children.length === 0
      ? NODE_H
      : Math.max(NODE_H, children.reduce((sum, childId) => sum + measure(childId), 0) + (children.length - 1) * Y_GAP);
    heightCache.set(id, height);
    return height;
  };

  const positions = new Map();
  const place = (id, depth, y) => {
    if (!visible.has(id)) return;
    const height = measure(id);
    positions.set(id, { x: PAD + depth * (NODE_W + X_GAP), y: y + (height - NODE_H) / 2 });
    if (collapsed.has(id)) return;
    let cy = y;
    (graph.children.get(id) || []).filter((childId) => visible.has(childId)).forEach((childId) => {
      place(childId, depth + 1, cy);
      cy += measure(childId) + Y_GAP;
    });
  };

  if (graph.rootId) place(graph.rootId, 0, PAD);
  let width = 640;
  let height = 360;
  positions.forEach((pos) => {
    width = Math.max(width, pos.x + NODE_W + TOGGLE_GAP + TOGGLE_SIZE + PAD);
    height = Math.max(height, pos.y + NODE_H + PAD);
  });

  return { visible, positions, width, height };
};

const FlowNode = ({ node, active, dimmed, onSelect }) => {
  const tone = node.type === 'terminal' ? 'green' : node.type === 'blocked' ? 'rose' : 'blue';
  const border = active ? 'border-[#3b5f8a] shadow-[0_8px_26px_rgba(59,95,138,0.20)]' : 'border-[#e4e2de] shadow-sm';
  const top = tone === 'green' ? 'border-t-[#2f6f4d]' : tone === 'rose' ? 'border-t-[#8a5a5f]' : 'border-t-[#3b5f8a]';
  const relation = node.type === 'event'
    ? (getRelStr(node.step?.dec?.relation, '') || node.step?.dec?.relation || '-')
    : (getRelStr(node.dist?.h?.relation, '') || node.dist?.h?.relation || node.subtitle);
  const branchLabel = node.type === 'event' ? node.subtitle : node.subtitle;
  const share = node.displayShare || node.share;

  return (
    <div
      data-flow-node="true"
      className={`absolute rounded-lg border border-t-[3px] bg-white px-2 py-2 transition-all dark:bg-neutral-900 ${border} ${top} ${dimmed ? 'opacity-25' : 'opacity-100'}`}
      style={{ width: NODE_W, height: NODE_H }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <div className="flex h-full min-w-0 items-center gap-2">
        <span className="max-w-[68px] shrink-0 truncate text-[10px] font-black text-[#9b9a97] dark:text-neutral-400">{relation}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[#37352f] dark:text-neutral-100">{node.title}</span>
        <span className="shrink-0 rounded-md border border-[#d7e5f9] bg-[#f0f6ff] px-1.5 py-0.5 text-[10px] font-black text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300">
          {nodeShareText(share)}
        </span>
        <span className={`max-w-[58px] shrink-0 truncate text-[10px] font-black ${tone === 'green' ? 'text-[#2f6f4d]' : tone === 'rose' ? 'text-[#8a5a5f]' : 'text-[#7a6240]'} dark:text-neutral-300`}>
          {branchLabel}
        </span>
    </div>
    </div>
  );
};

const FlowEdges = ({ graph, layout, focusSet, focusOnly }) => (
  <svg className="absolute left-0 top-0 overflow-visible" width={layout.width} height={layout.height}>
    {graph.edges.map((edge, index) => {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.to);
      if (!from || !to) return null;
      const sx = from.x + NODE_W;
      const sy = from.y + NODE_H / 2;
      const tx = to.x;
      const ty = to.y + NODE_H / 2;
      const mid = Math.max(32, (tx - sx) / 2);
      const inFocus = focusSet.size === 0 || (focusSet.has(edge.from) && focusSet.has(edge.to));
      const stroke = edge.blocked ? '#e6c6ca' : inFocus ? '#b8cce3' : '#dedbd5';
      const opacity = focusOnly || inFocus ? 1 : 0.28;
      return (
        <g key={`${edge.from}-${edge.to}-${index}`} opacity={opacity}>
          <path
            d={`M ${sx} ${sy} C ${sx + mid} ${sy}, ${tx - mid} ${ty}, ${tx} ${ty}`}
            fill="none"
            stroke={stroke}
            strokeWidth={inFocus ? 2.4 : 1.5}
            strokeLinecap="round"
          />
          {edge.share && (
            <text
              x={sx + mid}
              y={sy + (ty - sy) / 2 - 7}
              textAnchor="middle"
              fontSize="11"
              fontWeight="900"
              fill="#3b5f8a"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth="4"
            >
              {shareText(edge.share.n, edge.share.d)}
            </text>
          )}
        </g>
      );
    })}
  </svg>
);

const ReportPanel = ({ node, graph, onJump, reviewContext, onCompleteReview, onOpenInInput }) => {
  if (!node) return null;
  const reportNode = getEventReportNode(node, graph);
  const isEvent = reportNode?.type === 'event';
  const eventDate = isEvent ? getStepEventDate(reportNode.step) : '';
  const tableRows = isEvent ? buildReportRows(reportNode, eventDate) : [];
  const activeDists = tableRows.filter((dist) => !dist.ex && dist.n > 0);
  const excludedDists = tableRows.filter((dist) => dist.ex || dist.n === 0);
  const tableDenom = isEvent ? getCommonDenominator(activeDists) : 1;
  const eventDateLabel = formatKoreanDate(eventDate);
  const lawEra = isEvent ? lawEraLabel(reportNode.lawEra) : '';
  const primaryName = isEvent ? (reportNode.step?.dec?.name || reportNode.title || '미상') : (reportNode.title || '미상');
  const primaryShare = isEvent ? reportHeaderShareText(reportNode.share) : reportHeaderShareText(reportNode.displayShare || reportNode.share);
  const connectedEventEdges = isEvent ? getConnectedEventEdges(reportNode, graph) : [];
  const noRightSummaries = excludedDists.map((dist) => buildNoRightSummary(dist, eventDate));
  const modifierSummaries = activeDists.map(buildModifierSummary).filter(Boolean);
  const continuationSummaries = connectedEventEdges.map(buildContinuationSummary);
  const reasonRows = tableRows.filter((dist) => dist.ex || dist.mod);

  return (
    <aside className="z-20 w-[390px] shrink-0 self-stretch border-r border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="sticky top-0 z-10 border-b border-[#e9e9e7] bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-black tracking-[0.08em] text-[#3b5f8a] dark:text-blue-300">사건 보고서</div>
          {node.id !== reportNode?.id && (
            <Tag tone="blue">선택 노드 포함 사건</Tag>
          )}
        </div>
        <div className="mt-3 rounded-lg border border-[#e9e9e7] bg-[#fafaf9] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
            <div className="min-w-0">
              <span className="mr-1.5 font-black text-[#787774] dark:text-neutral-400">피상속인</span>
              <span className="font-black text-[#37352f] dark:text-neutral-100">{primaryName}</span>
            </div>
            <div className="min-w-0">
              <span className="mr-1.5 font-black text-[#787774] dark:text-neutral-400">상속지분</span>
              <span className="font-black text-[#3b5f8a] dark:text-blue-300">{primaryShare}</span>
            </div>
            <div className="min-w-0">
              <span className="mr-1.5 font-black text-[#787774] dark:text-neutral-400">사망일자</span>
              <span className="font-bold text-[#37352f] dark:text-neutral-100">{eventDateLabel || '미상'}</span>
            </div>
            <div className="min-w-0">
              <span className="mr-1.5 font-black text-[#787774] dark:text-neutral-400">적용법</span>
              <span className="font-black text-[#37352f] dark:text-neutral-100">{lawEra || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {reviewContext && isEvent && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-[12px] dark:border-blue-900/40 dark:bg-blue-900/40">
            <div className="font-black text-blue-800 dark:text-blue-200">현재 검토 중</div>
            <div className="mt-1 font-bold text-blue-700 dark:text-blue-300">{reportNode.step?.dec?.name || '이름 미상'}</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onOpenInInput?.(getPersonKey(reportNode.step?.dec))}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                입력 탭에서 수정
              </button>
              <button
                type="button"
                onClick={onCompleteReview}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                검토 완료
              </button>
            </div>
          </div>
        )}

        {isEvent && (
          <section>
            <div className="mb-2 text-[12px] font-black text-[#55534d] dark:text-neutral-300">사건 관계인</div>
            <div className="overflow-hidden rounded-lg border border-[#e9e9e7] dark:border-neutral-700">
              <table className="w-full border-collapse text-left">
                <thead className="bg-[#fafaf9] text-[10px] font-black text-[#787774] dark:bg-neutral-800 dark:text-neutral-400">
                  <tr>
                    <th className="px-2 py-2">성명</th>
                    <th className="px-2 py-2">관계</th>
                    <th className="px-2 py-2">지분</th>
                    <th className="px-2 py-2">가감산 요소</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeeeb] text-[12px] dark:divide-neutral-700">
                  {tableRows.map((dist, index) => {
                    const personKey = getPersonKey(dist.h);
                    const related = graph.edges.find((edge) => edge.from === reportNode.id && edge.dist === dist);
                    const canJump = related?.to && graph.nodes.has(related.to);
                    const displayShare = dist.n > 0 ? normalizeShare({ n: dist.n, d: dist.d }, tableDenom) : null;
                    return (
                      <tr key={`${personKey || index}-${index}`}>
                        <td className="px-2 py-2">
                          {canJump ? (
                            <button type="button" onClick={() => onJump(related.to)} className="font-black text-[#3b5f8a] hover:underline dark:text-blue-300">
                              {dist.h?.name || '이름 미상'}
                            </button>
                          ) : (
                            <span className="font-black text-[#37352f] dark:text-neutral-100">{dist.h?.name || '이름 미상'}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[#787774] dark:text-neutral-300">{getRelStr(dist.h?.relation, eventDate) || dist.h?.relation || '-'}</td>
                        <td className="px-2 py-2 font-black text-[#3b5f8a] dark:text-blue-300">{displayShare ? shareText(displayShare.n, displayShare.d) : '-'}</td>
                        <td className="px-2 py-2">
                          {dist.ex ? (
                            <Tag tone="rose">{formatModifierShort(dist)}</Tag>
                          ) : dist.mod ? (
                            <Tag tone={getModifierTone(dist.mod)}>{formatModifierShort(dist)}</Tag>
                          ) : formatModifierShort(dist) ? (
                            <span className="text-[#787774] dark:text-neutral-300">{formatModifierShort(dist)}</span>
                          ) : (
                            <span className="text-[#b8b4ac] dark:text-neutral-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(noRightSummaries.length > 0 || modifierSummaries.length > 0 || continuationSummaries.length > 0) && (
          <section>
            <div className="mb-2 text-[12px] font-black text-[#55534d] dark:text-neutral-300">사건 요약</div>
            <div className="space-y-2">
              {noRightSummaries.length > 0 && (
                <SummaryBlock title="상속권 없음" items={noRightSummaries} tone="rose" />
              )}
              {modifierSummaries.length > 0 && (
                <SummaryBlock title="가감산 요소" items={modifierSummaries} tone="amber" />
              )}
              {continuationSummaries.length > 0 && (
                <SummaryBlock title="재상속·대습상속" items={continuationSummaries} tone="blue" />
              )}
            </div>
          </section>
        )}

        {reasonRows.length > 0 && (
          <section>
            <div className="mb-2 text-[12px] font-black text-[#55534d] dark:text-neutral-300">판정 요약</div>
            <div className="space-y-1.5">
              {reasonRows.map((dist, index) => (
                <div key={`${getPersonKey(dist.h) || index}-reason`} className="text-[12px] leading-relaxed text-[#5d5b57] dark:text-neutral-300">
                  <span className="font-black text-[#37352f] dark:text-neutral-100">[{dist.h?.name || '이름 미상'}]</span>{' '}
                  {dist.ex || dist.mod}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};

export default function TreePanel({
  calcSteps = [],
  navigationSignal,
  reviewContext = null,
  onCompleteReview,
  onOpenInInput,
}) {
  const shellRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const graph = React.useMemo(() => buildFlowGraph(calcSteps), [calcSteps]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(new Set());
  const [focusOnly, setFocusOnly] = React.useState(false);
  const [view, setView] = React.useState({ scale: 1, x: 0, y: 0 });

  React.useEffect(() => {
    if (!graph.rootId) {
      setSelectedId(null);
      setCollapsed(new Set());
      return;
    }
    setSelectedId(graph.rootId);
    setCollapsed(new Set(Array.from(graph.nodes.keys()).filter((id) => graph.children.has(id))));
  }, [graph]);

  React.useEffect(() => {
    if (!navigationSignal?.targetId || !graph.nodes.size) return;
    const found = Array.from(graph.nodes.values()).find((node) => {
      const person = node.step?.dec || node.dist?.h;
      return person?.personId === navigationSignal.targetId || person?.id === navigationSignal.targetId;
    });
    if (found) {
      setSelectedId(found.id);
      setCollapsed((prev) => {
        const next = new Set(prev);
        collectAncestors(found.id, graph.parent).forEach((id) => next.delete(id));
        next.delete(found.id);
        return next;
      });
    }
  }, [navigationSignal, graph]);

  const focusSet = React.useMemo(() => buildFocusSet(selectedId, graph), [selectedId, graph]);
  const layout = React.useMemo(() => layoutGraph(graph, collapsed, focusOnly, focusSet), [graph, collapsed, focusOnly, focusSet]);
  const selectedNode = selectedId ? graph.nodes.get(selectedId) : null;

  const applyFit = React.useCallback((targetId = selectedId) => {
    const shell = shellRef.current;
    if (!shell || !graph.rootId) return;
    const target = targetId ? layout.positions.get(targetId) : null;
    const scale = Math.min(1.15, Math.max(0.32, Math.min((shell.clientWidth - 80) / layout.width, (shell.clientHeight - 80) / layout.height)));
    if (target && (layout.width * scale > shell.clientWidth || layout.height * scale > shell.clientHeight)) {
      setView({
        scale,
        x: shell.clientWidth / 2 - (target.x + NODE_W / 2) * scale,
        y: shell.clientHeight / 2 - (target.y + NODE_H / 2) * scale,
      });
    } else {
      setView({
        scale,
        x: Math.max(24, (shell.clientWidth - layout.width * scale) / 2),
        y: Math.max(24, (shell.clientHeight - layout.height * scale) / 2),
      });
    }
  }, [graph.rootId, layout, selectedId]);

  React.useEffect(() => {
    applyFit(graph.rootId);
  }, [graph.rootId, applyFit]);

  const selectNode = React.useCallback((id) => {
    setSelectedId(id);
    setCollapsed((prev) => {
      const next = new Set(prev);
      collectAncestors(id, graph.parent).forEach((ancestorId) => next.delete(ancestorId));
      return next;
    });
    window.setTimeout(() => applyFit(id), 0);
  }, [applyFit, graph.parent]);

  const toggleNode = React.useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = React.useCallback(() => {
    setSelectedId(graph.rootId);
    setCollapsed(new Set(Array.from(graph.nodes.keys()).filter((id) => graph.children.has(id))));
    setFocusOnly(false);
    window.setTimeout(() => applyFit(graph.rootId), 0);
  }, [applyFit, graph]);

  const onPointerDown = (event) => {
    if (event.target.closest('button') || event.target.closest('[data-flow-node="true"]')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, startX: view.x, startY: view.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setView((prev) => ({ ...prev, x: drag.startX + dx, y: drag.startY + dy }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (!graph.rootId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d9d9d5] bg-white px-5 py-8 text-center text-[13px] text-[#787774] dark:border-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-300">
        아직 검토할 상속지분 분기 자료가 없습니다. 데이터 입력 후 다시 확인해 주세요.
      </div>
    );
  }

  const report = (
    <ReportPanel
      node={selectedNode}
      graph={graph}
      onJump={selectNode}
      reviewContext={reviewContext}
      onCompleteReview={onCompleteReview}
      onOpenInInput={onOpenInInput}
    />
  );

  const canvas = (
    <div
      ref={shellRef}
      className="relative min-h-[760px] flex-1 overflow-hidden bg-[#f7f7f5] dark:bg-neutral-950"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setView((prev) => ({ ...prev, scale: Math.max(0.32, Math.min(1.8, prev.scale + (event.deltaY > 0 ? -0.08 : 0.08))) }));
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(#d7d5cf_0.8px,transparent_0.8px)] [background-size:24px_24px] dark:bg-[radial-gradient(#3f3f46_0.8px,transparent_0.8px)]" />
      <div
        className="absolute left-0 top-0"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <FlowEdges graph={graph} layout={layout} focusSet={focusSet} focusOnly={focusOnly} />
        {Array.from(layout.positions.entries()).map(([id, pos]) => {
          const node = graph.nodes.get(id);
          const inFocus = focusSet.size === 0 || focusSet.has(id);
          const hasChildren = (graph.children.get(id) || []).length > 0;
          const collapsedHere = collapsed.has(id);
          return (
            <div key={id} style={{ position: 'absolute', left: pos.x, top: pos.y, width: NODE_W + TOGGLE_GAP + TOGGLE_SIZE, height: NODE_H }}>
              <FlowNode
                node={node}
                active={id === selectedId}
                dimmed={!focusOnly && !inFocus}
                onSelect={selectNode}
              />
              {hasChildren && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleNode(id);
                  }}
                  className="absolute grid place-items-center rounded-full border border-[#dcd9d2] bg-white text-[13px] font-black text-[#3b5f8a] shadow-sm hover:bg-[#f0f6ff] dark:border-neutral-600 dark:bg-neutral-800 dark:text-blue-300"
                  style={{
                    left: NODE_W + TOGGLE_GAP,
                    top: Math.round((NODE_H - TOGGLE_SIZE) / 2),
                    width: TOGGLE_SIZE,
                    height: TOGGLE_SIZE,
                  }}
                  title={collapsedHere ? '펼치기' : '접기'}
                  aria-label={collapsedHere ? '펼치기' : '접기'}
                >
                  {collapsedHere ? '+' : '-'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute left-4 top-4 rounded-xl border border-[#e9e9e7] bg-white/95 px-4 py-3 text-[12px] shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <div className="font-black text-[#37352f] dark:text-neutral-100">상속지분 분기 검토</div>
        <div className="mt-1 max-w-[360px] leading-relaxed text-[#787774] dark:text-neutral-300">
          최초 피상속인부터 사건 노드를 하나씩 펼치며 상속지분이 분기되는 흐름을 확인합니다.
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-row items-stretch overflow-visible rounded-xl border border-[#e9e9e7] bg-[#f7f7f5] dark:border-neutral-600 dark:bg-neutral-900">
      {report}
      {canvas}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <div className="rounded-full border border-[#e9e9e7] bg-white px-3 py-2 text-[12px] font-black text-[#787774] shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {Math.round(view.scale * 100)}%
        </div>
        <div className="grid grid-cols-[52px_52px_44px_44px_44px] overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <button type="button" onClick={collapseAll} className="border-r border-[#efeeeb] px-2 py-2 text-[12px] font-black text-[#55534d] dark:border-neutral-700 dark:text-neutral-300">접기</button>
          <button type="button" onClick={expandAll} className="border-r border-[#efeeeb] px-2 py-2 text-[12px] font-black text-[#55534d] dark:border-neutral-700 dark:text-neutral-300">펼침</button>
          <button type="button" onClick={() => setView((prev) => ({ ...prev, scale: Math.max(0.32, prev.scale - 0.1) }))} className="border-r border-[#efeeeb] py-2 text-[18px] font-black dark:border-neutral-700">-</button>
          <button type="button" onClick={() => applyFit(selectedId)} className="border-r border-[#efeeeb] py-2 text-[16px] font-black dark:border-neutral-700">⌖</button>
          <button type="button" onClick={() => setView((prev) => ({ ...prev, scale: Math.min(1.8, prev.scale + 0.1) }))} className="py-2 text-[18px] font-black">+</button>
        </div>
        <button
          type="button"
          onClick={() => setFocusOnly((prev) => !prev)}
          className={`rounded-lg border px-3 py-2 text-[12px] font-black shadow-sm ${focusOnly ? 'border-[#3b5f8a] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300' : 'border-[#e9e9e7] bg-white text-[#55534d] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'}`}
        >
          {focusOnly ? '전체 흐름 보기' : '선택 계통만 보기'}
        </button>
      </div>
    </div>
  );
}
