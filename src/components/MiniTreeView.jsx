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
    ? '하위 상속인 입력 확인 필요 (필수 조치 필요)'
    : '하위 상속인 중 일부 입력 확인 필요 (권장 확인)';

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
      <div className="flex items-center gap-1.5 py-1 pr-1 group">
        {level > 0 && (
          <span className="text-[#d4d4d4] dark:text-neutral-600 text-[12px] shrink-0 font-bold opacity-40">
            |
          </span>
        )}
        <span
          id={`sidebar-node-${node.id}`}
          onClick={() => {
            if (hasHeirs) setIsExpanded(!isExpanded);
            onSelectNode && onSelectNode(node.id);
          }}
          className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer ${itemStyleClass} ${highlightStyle}`}
        >
          {node.name || (level === 0 ? '피상속인' : '(이름 없음)')}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {showMandatory && (
            <span className="text-[12px] cursor-help opacity-100" title={warningTitle}>
              필수
            </span>
          )}
          {!showMandatory && showRecommended && (
            <span className="text-[12px] cursor-help opacity-100" title="권고 사항">
              권고
            </span>
          )}
          {level > 0 &&
            (() => {
              const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
              const isPre = node.isDeceased && node.deathDate && deathDate && isBefore(node.deathDate, deathDate) && !isSpouse;
              return (
                <span
                  className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${isPre ? 'text-[#787774]' : 'text-[#37352f] dark:text-neutral-100 font-bold opacity-100'}`}
                >
                  [{getRelStr(node.relation, deathDate) || '관계'}]
                </span>
              );
            })()}
        </div>
      </div>
      {isExpanded && hasHeirs && (
        <div className="border-l border-[#e9e9e7] dark:border-neutral-700 ml-1.5 pl-1.5 pb-1 transition-colors">
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
