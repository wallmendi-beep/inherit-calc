import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DateInput } from './DateInput';
import HeirRow from './HeirRow';
import { IconTrash2, IconUserGroup, IconUserPlus, IconX } from './Icons';
import { getLawEra, formatKorDate, getRelStr, isBefore } from '../engine/utils';
import { BadgeToggle } from './ui/InheritDesign';

export default function InputPanel({
  tree,
  activeDeceasedTab,
  activeTabObj,
  finalShares,
  issues = [],
  handleUpdate,
  removeHeir,
  removeAllHeirs,
  addHeir,
  appendResolvedHeirs,
  handleKeyDown,
  handleRootUpdate,
  handleDragEnd,
  sensors,
  isMainQuickActive,
  setIsMainQuickActive,
  mainQuickVal,
  setMainQuickVal,
  handleQuickSubmit,
  getBriefingInfo,
  setActiveDeceasedTab,
  reviewContext,
}) {
  const currentNode = activeTabObj ? activeTabObj.node : tree;
  const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
  const currentNodeIssues = (issues || []).filter((issue) => {
    const target = issue?.targetTabId || issue?.personId || issue?.id;
    return !!currentNode && !!target && (target === currentNode.personId || target === currentNode.id);
  });
  const isRootNode = currentNode && currentNode.id === 'root';
  const canAutoFill = !isRootNode && ['wife', 'husband', 'son', 'daughter'].includes(currentNode?.relation);
  const inheritedDate = currentNode?.deathDate || tree.deathDate;
  const currentLawEra = getLawEra(inheritedDate);
  const showCurrentHojuToggle =
    currentLawEra !== '1991' &&
    (isRootNode || ['son', 'husband'].includes(currentNode?.relation));
  const requiresHojuReview =
    currentLawEra !== '1991' &&
    (isRootNode || ['son', 'husband'].includes(currentNode?.relation));
  const findParentNode = React.useCallback((root, targetId, targetPersonId, visited = new Set()) => {
    if (!root || visited.has(root.id)) return null;
    visited.add(root.id);
    if ((root.heirs || []).some((h) => h.id === targetId || h.personId === targetPersonId)) return root;
    for (const heir of root.heirs || []) {
      const found = findParentNode(heir, targetId, targetPersonId, visited);
      if (found) return found;
    }
    return null;
  }, []);
  const resolvedParentNode = React.useMemo(() => {
    if (isRootNode || !currentNode) return null;
    return findParentNode(tree, currentNode.id, currentNode.personId) || activeTabObj?.parentNode || null;
  }, [isRootNode, currentNode, tree, activeTabObj, findParentNode]);
  const parentHeirsForGuide = resolvedParentNode?.heirs || [];
  const reviewTargetNodeIds = React.useMemo(
    () => new Set((reviewContext?.targetNodeIds || []).filter(Boolean)),
    [reviewContext]
  );
  // 가이드 클릭 후 하이라이트 대상 첫 행으로 자동 스크롤
  React.useEffect(() => {
    if (reviewTargetNodeIds.size === 0) return;
    const timer = setTimeout(() => {
      for (const id of reviewTargetNodeIds) {
        const el = document.querySelector(`[data-node-id="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [reviewTargetNodeIds, activeDeceasedTab]);

  const getEmptyStateGuide = () => {
    if (currentNode?.successorStatus) {
      const confirmedLabel =
        currentNode.successorStatus === 'confirmed_no_substitute_heirs'
          ? '대습상속인 없음 확정'
          : currentNode.successorStatus === 'confirmed_no_spouse_descendants'
            ? '직계비속·배우자 없음 확정'
            : '추가 상속인 없음 확정';
      return {
        title: `${confirmedLabel} 상태입니다.`,
        body: '이 단계는 추가 상속인 없이 진행하도록 확인된 상태입니다. 후속 상속인이 필요해지면 상속인 추가 또는 불러오기를 사용하면 됩니다.',
      };
    }

    const cycleIssue = currentNodeIssues.find((issue) => issue.code === 'inheritance-cycle');
    if (cycleIssue) {
      return {
        title: '순환 참조 오류를 먼저 정리해 주세요.',
        body: cycleIssue.text,
      };
    }

    if (isRootNode && (!tree.name?.trim() || !tree.deathDate)) {
      return {
        title: '기본정보를 먼저 입력해 주세요.',
        body: '사건번호, 피상속인 이름, 사망일자를 입력하면 다음 안내가 이어집니다.',
      };
    }

    const isPre = currentNode?.deathDate && tree?.deathDate && isBefore(currentNode.deathDate, tree.deathDate);
    if (isPre) {
      return {
        title: '선사망 상속인은 대습상속인 입력이 필요합니다.',
        body: '배우자 또는 직계비속을 입력하지 않으면 계산에서 제외됩니다.',
      };
    }

    if (
      currentLawEra !== '1991' &&
      ['son', 'husband'].includes(currentNode?.relation) &&
      currentNode?.isHoju === false
    ) {
      return {
        title: `${currentNode?.name || '현재 상속인'}은(는) 비호주로 설정되어 있습니다.`,
        body: '특별한 사정이 없다면 호주 여부를 다시 확인한 뒤 1차 상속인을 입력해 주세요.',
      };
    }

    if (currentNode?.relation === 'wife') {
      return {
        title: '아직 직접 입력된 후속 상속인이 없습니다.',
        body: `1991년 이전 사건에서는 상위 사건의 자녀들이 [${currentNode?.name || '처'}] 사건의 기본 상속인으로 반영됩니다. [${currentNode?.name || '처'}]에게만 있는 별도의 고유 자녀가 있으면 추가해 주세요.`,
      };
    }

    if (currentNode?.relation === 'husband') {
      const isOldEra = currentLawEra !== '1991';
      return {
        title: '아직 직접 입력된 후속 상속인이 없습니다.',
        body: `불러오기를 통해 상위 사건의 자녀를 가져온 뒤, [${currentNode?.name || '남편'}]의 상속인이 아닌 자녀는 삭제해 주세요.${isOldEra ? ' (1991년 이전 사망한 남편은 기본적으로 호주 자격이 전제됩니다.)' : ''}`,
      };
    }

    if (requiresHojuReview) {
      return {
        title: '이 상속 단계는 호주상속 가산 검토가 필요합니다.',
        body: '상속인 불러오기 또는 수동 입력을 먼저 진행한 뒤, 현재 탭에서 호주 여부를 확인하세요.',
      };
    }

    const rootHeirs = tree.heirs || [];
    const activeGuideHeirs = isRootNode ? rootHeirs : parentHeirsForGuide;
    const parentNode = activeGuideHeirs.find((h) => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded);
    const isParentAliveAtTargetDeath =
      parentNode &&
      (!parentNode.deathDate || !currentNode?.deathDate || !isBefore(parentNode.deathDate, currentNode.deathDate));

    if (['spouse'].includes(currentNode?.relation)) {
      return {
        title: '아직 직접 입력된 후속 상속인이 없습니다.',
        body: '필요한 상속인이 있다면 추가해 주세요. 입력하지 않으면 법정 순위에 따라 자동 분배가 진행될 수 있습니다.',
      };
    }

    if (isParentAliveAtTargetDeath) {
      return {
        title: '아직 직접 입력된 후속 상속인이 없습니다.',
        body: '필요한 상속인이 있다면 추가해 주세요. 입력하지 않으면 법정 순위에 따라 자동 분배가 진행될 수 있습니다.',
      };
    }

    return {
      title: '아직 직접 입력된 후속 상속인이 없습니다.',
      body: '필요한 상속인이 있다면 추가해 주세요. 입력하지 않으면 법정 순위에 따라 자동 분배가 진행될 수 있습니다.',
    };
  };

  const emptyStateGuide = getEmptyStateGuide();
  const compareDateForCurrentNode = resolvedParentNode?.deathDate || tree?.deathDate || '';
  const isCurrentPredeceased =
    !!(currentNode?.deathDate && compareDateForCurrentNode && isBefore(currentNode.deathDate, compareDateForCurrentNode));
  const emptyStateConfirm = React.useMemo(() => {
    if (!currentNode || currentNode.id === 'root' || !currentNode.isDeceased || currentNode.isExcluded === true) return null;
    if (['wife', 'husband', 'spouse'].includes(currentNode.relation)) {
      return {
        label: '추가 상속인 없음',
        value: 'confirmed_no_additional_heirs',
        helper: '이 단계에서 더 입력할 후속 상속인이 없음을 확정합니다.',
      };
    }
    if (isCurrentPredeceased && ['son', 'daughter', 'sibling'].includes(currentNode.relation)) {
      return {
        label: '대습상속인 없음',
        value: 'confirmed_no_substitute_heirs',
        helper: '배우자나 직계비속이 없어 대습상속이 없음을 확정합니다.',
      };
    }
    return {
      label: '직계비속·배우자 없음',
      value: 'confirmed_no_spouse_descendants',
      helper: '직계비속과 배우자가 없어 차순위 상속으로 넘어가도 됨을 확정합니다.',
    };
  }, [currentNode, isCurrentPredeceased]);

  const handleRemoveAllHeirs = () => {
    if (!nodeHeirs.length) return;
    const confirmed = window.confirm('입력된 상속인 목록을 전부 삭제하시겠습니까?');
    if (!confirmed) return;
    removeAllHeirs(currentNode?.id || 'root');
  };

  const handleAutoFill = (silent = false) => {
    const parentHeirs = parentHeirsForGuide;
    const existingNames = new Set(nodeHeirs.map((h) => h.name).filter((n) => n.trim() !== ''));
    let baseAdd = [];

    if (['wife', 'husband', 'spouse'].includes(currentNode.relation)) {
      const children = parentHeirs.filter((s) => ['son', 'daughter'].includes(s.relation));
      baseAdd = children.filter((c) => c.name.trim() === '' || !existingNames.has(c.name));
    } else {
      const parents = parentHeirs.filter((s) => {
        if (!['wife', 'husband', 'spouse'].includes(s.relation)) return false;
        if (s.isDeceased && s.deathDate && currentNode.deathDate && isBefore(s.deathDate, currentNode.deathDate)) return false;
        return true;
      });
      const siblings = parentHeirs.filter((s) => s.id !== currentNode.id && ['son', 'daughter'].includes(s.relation));
      baseAdd = [
        ...parents.map((item) => ({ ...item, relation: 'parent' })),
        ...siblings.map((item) => ({ ...item, relation: 'sibling' })),
      ].filter((s) => s.name.trim() === '' || !existingNames.has(s.name));
    }

    if (baseAdd.length === 0) {
      if (silent !== true) alert('불러올 상속인이 없습니다.');
      return;
    }

    appendResolvedHeirs(currentNode.id, baseAdd.map((item) => ({ ...item })));
  };

  const autoFilledTabs = React.useRef(new Set());
  React.useEffect(() => {
    if (activeDeceasedTab !== 'root' && currentNode && ['wife', 'husband', 'spouse'].includes(currentNode.relation)) {
      if (nodeHeirs.length === 0 && !autoFilledTabs.current.has(activeDeceasedTab)) {
        handleAutoFill(true);
        autoFilledTabs.current.add(activeDeceasedTab);
      }
    }
  }, [activeDeceasedTab, currentNode?.relation, nodeHeirs.length]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
      <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-600 rounded-lg px-6 py-4 flex flex-wrap items-center gap-4 transition-colors shadow-sm">
        <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-600/50 pr-6 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-300 uppercase tracking-widest">기본정보</span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-300 font-bold whitespace-nowrap">사건번호</label>
          <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo || ''} onChange={(e) => handleRootUpdate('caseNo', e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-600 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="사건번호 입력" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-300 font-bold whitespace-nowrap">피상속인</label>
          <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={(e) => handleRootUpdate('name', e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-600 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="이름" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-300 font-bold whitespace-nowrap">사망일자</label>
          <DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={(v) => handleRootUpdate('deathDate', v)} className="w-28 border border-[#e9e9e7] dark:border-neutral-600 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" />
        </div>
        {getLawEra(tree.deathDate) !== '1991' && (
          <div className="shrink-0 flex items-center gap-2">
            <label className="text-[12px] text-[#787774] dark:text-neutral-300 font-bold whitespace-nowrap">호주</label>
            <input type="checkbox" disabled={!isRootNode} checked={tree.isHoju !== false} onChange={(e) => handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" />
          </div>
        )}
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-300 font-bold whitespace-nowrap">상속분 지분</label>
          <div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-600 px-2 py-1 gap-1">
            <input type="number" min="1" value={tree.shareD || 1} onChange={(e) => handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분모" />
            <span className="text-[#787774] dark:text-neutral-400 text-[12px] font-medium mx-0.5">/</span>
            <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={(e) => handleRootUpdate('shareN', Math.min(tree.shareD || 1, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분자" />
          </div>
        </div>
      </div>

      <div className="transition-colors flex-1 flex flex-col">
        <div className="relative transition-all duration-300 flex-1 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-600/50 rounded-xl">
          <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-600/50 bg-[#f8f9fa] dark:bg-neutral-900/80 rounded-t-xl min-h-[80px]">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center shrink-0 pr-1">
                {activeDeceasedTab === 'root' ? (
                  <div className="flex items-center px-2">
                    <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-300 tracking-tight">입력 단계</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveDeceasedTab(activeTabObj?.parentTabId || 'root')}
                    className="flex min-w-[112px] items-center gap-2 px-3 py-1.5 bg-neutral-100/80 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md border border-[#e9e9e7] dark:border-neutral-600 transition-all active:scale-95 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3 h-3 text-[#1e56a0] dark:text-blue-300 group-hover:-translate-x-0.5 transition-transform">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-400 uppercase mb-0.5">상위상속인 바로가기</span>
                      <span className="text-[13.5px] font-black text-slate-800 dark:text-neutral-100 whitespace-nowrap">
                        {activeTabObj?.parentName || '상위'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center min-w-[120px] max-w-[250px]">
                <span className="text-[10.5px] font-bold text-[#1e56a0] dark:text-blue-300 mb-0.5 whitespace-nowrap">
                  {activeDeceasedTab === 'root'
                    ? '피상속인'
                    : `${activeTabObj?.parentName || '상위상속인'}의 ${getRelStr(currentNode?.relation, tree.deathDate)}`}
                </span>
                <div className="flex items-center overflow-hidden">
                  <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                    {getBriefingInfo?.name || (activeDeceasedTab === 'root' ? (tree.name || '피상속인') : '(상속인)')}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center items-center shrink-0">
                <span className="text-[12px] font-bold text-[#c93f3a] dark:text-red-400 mb-1 leading-none">{currentNode?.deathDate ? `${formatKorDate(currentNode.deathDate)} 사망` : (tree.deathDate ? `${formatKorDate(tree.deathDate)} 사망` : '사망일자 미입력')}</span>
                <div className="w-[120px] bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 py-0.5 rounded flex items-center justify-center gap-1 shadow-sm">
                  <span className="text-[10px] font-black tracking-tighter whitespace-nowrap">{getLawEra(currentNode?.deathDate || tree.deathDate)}년 기준</span>
                </div>
              </div>
              {showCurrentHojuToggle && (
                <>
                  <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
                  <div className="flex items-center justify-center shrink-0 min-w-[52px]">
                    <BadgeToggle
                      active={currentNode?.isHoju !== false}
                      onToggle={(value) => {
                        if (isRootNode) {
                          handleRootUpdate('isHoju', value);
                        } else {
                          handleUpdate(currentNode.id, 'isHoju', value);
                        }
                      }}
                      activeLabel="호주"
                      inactiveLabel="비호주"
                      activeClassName="border-blue-300 bg-blue-50 text-blue-700"
                      hoverClassName="hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200"
                      className="w-[80px]"
                    />
                  </div>
                </>
              )}
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {canAutoFill && <button type="button" onClick={handleAutoFill} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-600 gap-1.5 shadow-sm"><IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 불러오기</button>}
                <button type="button" onClick={() => setIsMainQuickActive(!isMainQuickActive)} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-600 gap-1.5 shadow-sm"><IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 상속인 추가</button>
              </div>
            </div>
          </div>

          <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-600/50">
            {currentNodeIssues.filter(i => i.blocking && i.code !== 'inheritance-cycle').length > 0 && (
              <div className="mb-4 space-y-1.5">
                {currentNodeIssues.filter(i => i.blocking && i.code !== 'inheritance-cycle').map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/40 dark:text-amber-200">
                    <span className="mt-0.5 shrink-0 font-bold">⚠</span>
                    <span className="font-medium leading-snug">{issue.text}</span>
                  </div>
                ))}
              </div>
            )}
            {isMainQuickActive && (
              <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/90 border border-[#e9e9e7] dark:border-neutral-600">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-300">상속인 이름을 쉼표로 구분해 빠르게 입력하세요.</div>
                    <button onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }} className="text-[#a3a3a3] dark:text-neutral-400 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors" title="닫기"><IconX className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={mainQuickVal}
                      onChange={(e) => setMainQuickVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal);
                          setIsMainQuickActive(false);
                          setMainQuickVal('');
                        }
                        if (e.key === 'Escape') {
                          setIsMainQuickActive(false);
                          setMainQuickVal('');
                        }
                      }}
                      placeholder="예: 김철수, 이영희"
                      className="flex-1 text-[13px] border border-[#e9e9e7] dark:border-neutral-600 rounded-md px-3 py-1.5 outline-none focus:border-[#d4d4d4] bg-white dark:bg-neutral-900 dark:text-neutral-200 transition-all font-medium text-[#37352f]"
                    />
                    <button onClick={() => { handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); setIsMainQuickActive(false); setMainQuickVal(''); }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 hover:bg-[#efefed] dark:hover:bg-neutral-700 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 text-[13px] font-bold rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap">빠른 등록</button>
                  </div>
                </div>
              </div>
            )}

            {nodeHeirs.length === 0 && (
              currentNode?.isDeceased && (currentNode?.isExcluded !== true || !!emptyStateConfirm || !!currentNode?.successorStatus) ? (
                <div className="flex flex-col items-center justify-center p-8 bg-[#f8f8f7] dark:bg-neutral-800/80 border border-[#e9e9e7] dark:border-neutral-600 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[14.5px] leading-relaxed whitespace-pre-wrap">
                    {emptyStateGuide.title}
                  </span>
                  <span className="text-[#787774] dark:text-neutral-300 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                    {emptyStateGuide.body}
                  </span>
                  {emptyStateConfirm && !currentNode?.successorStatus && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(currentNode.id, 'successorStatus', emptyStateConfirm.value)}
                        className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        {emptyStateConfirm.label}
                      </button>
                      <span className="text-[11.5px] text-[#787774] dark:text-neutral-300">
                        {emptyStateConfirm.helper}
                      </span>
                    </div>
                  )}
                  {currentNode?.successorStatus && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="inline-flex items-center rounded-md border border-[#8a7c69] bg-[#5f564b] px-3 py-1.5 text-[12px] font-bold text-[#f5f1ea] shadow-sm dark:border-[#6f6457] dark:bg-[#4e463d] dark:text-[#f3eee6]">
                        {currentNode.successorStatus === 'confirmed_no_substitute_heirs'
                          ? '대습상속인 없음 확정'
                          : currentNode.successorStatus === 'confirmed_no_spouse_descendants'
                            ? '직계비속·배우자 없음 확정'
                            : '추가 상속인 없음 확정'}
                      </div>
                      <span className="text-[11.5px] text-[#787774] dark:text-neutral-300">
                        상속인을 추가하거나 불러오기 하면 이 확정 상태는 자동으로 해제됩니다.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-[#f8f8f7] dark:bg-neutral-800/80 border border-[#e9e9e7] dark:border-neutral-600 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[14px]">아직 하위 상속인 데이터가 없습니다.</span>
                  <span className="text-[#787774] dark:text-neutral-300 text-[12.5px]">이 가지에 상속인이 없다면 법정 순위에 따라 다음 순위로 지분이 분배됩니다.</span>
                </div>
              )
            )}

            {nodeHeirs.length > 0 &&
              ['wife', 'husband', 'spouse'].includes(currentNode?.relation) &&
              currentNode?.successorStatus !== 'confirmed_no_additional_heirs' && (
                <div className="flex p-4 bg-[#f8f8f7] dark:bg-neutral-800/80 border border-[#e9e9e7] dark:border-neutral-600 rounded-lg mb-4 shadow-sm relative">
                  <div className="flex-1 flex flex-col justify-center text-center gap-1">
                    <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[13.5px]">
                      [{resolvedParentNode?.name || '상위 피상속인'}]의 자녀들을 자동으로 불러왔습니다.
                    </span>
                    {currentNode?.relation === 'wife' ? (
                      <span className="text-[#787774] dark:text-neutral-300 text-[12px] mt-1">
                        [{currentNode?.name || '처'}]에게만 있는 별도의 고유 자녀가 있으면 추가해 주세요.
                      </span>
                    ) : (
                      <>
                        <span className="text-[#787774] dark:text-neutral-300 text-[12px] mt-1">
                          [{currentNode?.name || '남편'}]의 고유자녀가 아닌 사람은 삭제해 주세요.
                        </span>
                        {!nodeHeirs.some((h) => h.isHoju) && (
                          <span className="text-red-500 font-bold text-[12.5px] mt-1">
                            [{currentNode?.name || '남편'}]은 호주 입니다. 호주상속을 받는 자를 선택해주세요.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col justify-center shrink-0 border-l border-[#e9e9e7] dark:border-neutral-600 pl-4">
                    <button
                      type="button"
                      onClick={() => handleUpdate(currentNode.id, 'successorStatus', 'confirmed_no_additional_heirs')}
                      className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 whitespace-nowrap"
                    >
                      추가 상속인 없음
                    </button>
                  </div>
                </div>
              )}

            {nodeHeirs.length > 0 && (
              <div className="mb-2 flex items-center w-full min-h-[28px] rounded-md border border-[#f1f1ef] bg-[#fcfcfb] px-0 text-[11px] font-bold tracking-tight text-[#787774] dark:border-neutral-600/50 dark:bg-neutral-900/20 dark:text-neutral-300">
                <div className="w-5 ml-[10px] shrink-0" />
                <div className="ml-[20px] w-7 shrink-0 text-center">상태</div>
                <div className="w-[72px] ml-[50px] shrink-0">성명</div>
                <div className="w-[76px] ml-[30px] shrink-0">관계</div>
                <div className="w-[150px] ml-[50px] shrink-0">생존/사망(사망일자)</div>
                <div className="w-[180px] ml-[10px] shrink-0">특수조건/가감산 요소</div>
                <div className="w-[98px] ml-[10px] shrink-0 text-center">재상속/대습상속</div>
                <div className="ml-[15px] mr-[20px] w-12 shrink-0 flex justify-center">
                  <button
                    type="button"
                    onClick={handleRemoveAllHeirs}
                    disabled={!nodeHeirs.length}
                    className="group relative flex h-7 w-7 items-center justify-center rounded-md text-[#a3a3a3] transition-colors hover:text-red-500 disabled:cursor-default disabled:opacity-40"
                    aria-label="전체삭제"
                  >
                    <IconTrash2 className="h-4 w-4 shrink-0" />
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-normal whitespace-nowrap text-red-500 opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100">
                      전체삭제
                    </span>
                  </button>
                </div>
              </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={nodeHeirs.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {nodeHeirs.map((h) => {
                    const highlighted = reviewTargetNodeIds.size > 0 &&
                      (reviewTargetNodeIds.has(h.id) || reviewTargetNodeIds.has(h.personId));
                    return (
                    <HeirRow
                      key={h.id}
                      node={h}
                      level={1}
                      handleUpdate={handleUpdate}
                      removeHeir={removeHeir}
                      addHeir={addHeir}
                      siblings={nodeHeirs}
                      inheritedDate={inheritedDate}
                      rootDeathDate={tree.deathDate}
                      onKeyDown={handleKeyDown}
                      rootIsHoju={tree.isHoju !== false}
                      isRootChildren={activeDeceasedTab === 'root'}
                      parentNode={currentNode}
                      isHighlighted={highlighted}
                      onTabClick={(id) => {
                        let targetPId = id;
                        const findPId = (n) => {
                          if (n.id === id) targetPId = n.personId;
                          if (n.heirs) n.heirs.forEach(findPId);
                        };
                        findPId(tree);
                        setActiveDeceasedTab(targetPId);
                      }}
                    />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end px-2 no-print pointer-events-none select-none">
          <span 
            className="font-['Caveat','Dancing_Script','Great_Vibes',cursive] text-[16px] tracking-wider text-[#d4d4d0] dark:text-[#404040] [text-shadow:1px_1px_0px_rgba(255,255,255,0.9),-1px_-1px_0px_rgba(0,0,0,0.05)] dark:[text-shadow:1px_1px_0px_rgba(255,255,255,0.02),-1px_-1px_0px_rgba(0,0,0,0.8)] opacity-90"
          >
            Designed by J.H. LEE
          </span>
        </div>
      </div>
    </div>
  );
}
