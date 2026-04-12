import React, { useEffect, useMemo, useState } from 'react';
import { getRelStr, isBefore } from '../engine/utils';

export default function MiniTreeView({
  node,
  level = 0,
  onSelectNode,
  visitedHeirs = new Set(),
  deathDate,
  toggleSignal,
  searchQuery,
  matchIds,
  currentMatchId,
  guideStatusMap,
}) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const isMatch = matchIds && matchIds.includes(node.id);
  const isCurrentMatch = currentMatchId === node.id;

  const hasMatchingDescendant = useMemo(() => {
    if (!searchQuery || !matchIds || matchIds.length === 0) return false;

    const check = (targetNode) => {
      if (matchIds.includes(targetNode.id)) return true;
      if (targetNode.heirs) return targetNode.heirs.some(check);
      return false;
    };

    return node.heirs ? node.heirs.some(check) : false;
  }, [node, matchIds, searchQuery]);

  useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(level === 0);
  }, [toggleSignal, level]);

  useEffect(() => {
    if (hasMatchingDescendant) setIsExpanded(true);
  }, [hasMatchingDescendant]);

  if (!node) return null;

  const status = guideStatusMap?.[node.id] || guideStatusMap?.[node.name] || {};
  const showMandatory = status.mandatory || (!isExpanded && status.childMandatory);
  const showRecommended = !showMandatory && (status.recommended || (!isExpanded && status.childRecommended));
  const warningTitle = status.mandatory
    ? '하위 상속인 입력 확인이 필요합니다. 필수 조치가 남아 있습니다.'
    : '하위 상속 구조를 한 번 더 확인해 주세요.';

  const getStatusStyle = (targetNode, hasSubHeirs) => {
    const isAlive = !targetNode.deathDate && !targetNode.isDeceased;
    const colorClass = isAlive ? 'text-[#1e56a0] dark:text-[#60a5fa]' : 'text-black dark:text-white';
    const underlineClass = hasSubHeirs
      ? 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4'
      : '';
    return `${colorClass} ${underlineClass}`;
  };

  const hasHeirs = node.heirs && node.heirs.length > 0;
  const itemStyleClass = getStatusStyle(node, hasHeirs);
  const highlightStyle = isCurrentMatch
    ? 'bg-yellow-200 dark:bg-yellow-800 ring-2 ring-yellow-400 dark:ring-yellow-500 font-black'
    : isMatch
      ? 'bg-yellow-100 dark:bg-yellow-900/50'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded';

  if (node.name && level > 0) visitedHeirs.add(node.name);

  return (
    <div className={`flex flex-col ${level > 0 ? 'ml-3' : ''}`}>
      <div className="group flex items-center gap-1.5 py-1 pr-1">
        {level > 0 && (
          <span className="shrink-0 text-[12px] font-bold text-[#d4d4d4] opacity-40 dark:text-neutral-600">
            |
          </span>
        )}
        <div
          id={`sidebar-node-${node.id}`}
          onClick={() => {
            if (hasHeirs) setIsExpanded(!isExpanded);
            onSelectNode && onSelectNode(node.id);
          }}
          className={`flex flex-1 min-w-0 cursor-pointer items-center gap-1.5 text-[13px] transition-all ${highlightStyle}`}
        >
          <span className={`min-w-0 truncate ${itemStyleClass}`}>
            {node.name || (level === 0 ? '피상속인' : '(이름 없음)')}
          </span>
          {showMandatory && (
            <span
              className="shrink-0 cursor-help text-[12px] leading-none"
              title={warningTitle}
              aria-label="필수 확인"
            >
              ⚠️
            </span>
          )}
          {!showMandatory && showRecommended && (
            <span
              className="shrink-0 cursor-help text-[12px] leading-none"
              title="참고용 안내가 있습니다."
              aria-label="참고 안내"
            >
              💡
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {level > 0 && (() => {
            const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
            const isPre = node.isDeceased && node.deathDate && deathDate && isBefore(node.deathDate, deathDate) && !isSpouse;
            return (
              <span
                className={`text-[10px] uppercase tracking-tighter ${isPre ? 'text-[#787774] opacity-40' : 'font-bold text-[#37352f] opacity-100 dark:text-neutral-100'}`}
              >
                [{getRelStr(node.relation, deathDate) || '관계'}]
              </span>
            );
          })()}
        </div>
      </div>
      {isExpanded && hasHeirs && (
        <div className="ml-1.5 border-l border-[#e9e9e7] pl-1.5 pb-1 transition-colors dark:border-neutral-700">
          {node.heirs.map((heir, index) => (
            <MiniTreeView
              key={heir.id || index}
              node={heir}
              level={level + 1}
              onSelectNode={onSelectNode}
              visitedHeirs={visitedHeirs}
              deathDate={node.deathDate || deathDate}
              toggleSignal={toggleSignal}
              searchQuery={searchQuery}
              matchIds={matchIds}
              currentMatchId={currentMatchId}
              guideStatusMap={guideStatusMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
