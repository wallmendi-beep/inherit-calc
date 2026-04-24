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
  setAiTargetId,
  setIsAiModalOpen,
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
  const suggestHojuSelection =
    showCurrentHojuToggle &&
    !isRootNode &&
    !currentNode?.isHoju &&
    ['son', 'husband'].includes(currentNode?.relation) &&
    nodeHeirs.length > 0;
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
  const isEligibleAtCurrentStep = (person) => {
    if (!person || person.isExcluded) return false;
    if (!person.isDeceased) return true;
    if (!person.deathDate || !currentNode?.deathDate) return false;
    return !isBefore(person.deathDate, currentNode.deathDate);
  };
  const isStickyExcluded = (person) => (
    ['lost', 'disqualified', 'remarried', 'renounce', 'blocked_husband_substitution'].includes(person?.exclusionOption || '')
  );
  const collectSubstituteDisplayNames = (person, visited = new Set()) => {
    if (!person || visited.has(person.id)) return [];
    visited.add(person.id);
    const names = [];
    (person.heirs || []).forEach((heir) => {
      if (!heir || isStickyExcluded(heir)) return;
      if (!heir.isDeceased && !heir.isExcluded) {
        if (heir.name?.trim()) names.push(heir.name.trim());
        return;
      }
      if ((heir.heirs || []).length > 0) {
        names.push(...collectSubstituteDisplayNames(heir, visited));
      }
    });
    return Array.from(new Set(names));
  };

  const spouseEmptyStateGuide = React.useMemo(() => {
    if (!currentNode || !['wife', 'husband', 'spouse'].includes(currentNode.relation)) return null;

    if (currentNode.relation === 'wife') {
      return {
        title: `[${currentNode.name || '해당 배우자'}]에게만 있는 추가 자녀가 있는지 확인해 주세요.`,
        body: `1991년 이전 사건에서는 [${resolvedParentNode?.name || '상위 사건'}]의 자녀들이 [${currentNode.name || '해당 배우자'}] 사건의 상속인으로 반영됩니다. ${currentNode.name || '해당 배우자'}에게만 있는 별도의 자녀가 있으면 추가로 입력해 주세요.`,
        confirmHelper: `추가 자녀가 없으면 '추가 상속인 없음'으로 정리하면 됩니다.`,
      };
    }

    if (currentNode.relation === 'husband') {
      return {
        title: `[${currentNode.name || '해당 배우자'}] 사건의 자녀 범위를 확인해 주세요.`,
        body: `아래의 상속인은 [${resolvedParentNode?.name || '상위 사건'}] 사건 기준 자녀 목록입니다. [${currentNode.name || '해당 배우자'}]의 상속인이 아닌 사람이 있으면 선택해 주세요.`,
        confirmHelper: `자녀 범위를 확인한 뒤, 남는 상속인이 없으면 다음 순위 상속인 입력 여부를 검토해 주세요.`,
      };
    }

    return {
      title: `[${currentNode.name || '해당 배우자'}] 사건의 후속 상속 구성을 확인해 주세요.`,
      body: `현재 사건에서 [${currentNode.name || '해당 배우자'}]에게 연결될 후속 상속인이 더 있는지 확인해 주세요. 더 입력할 사람이 없으면 '추가 상속인 없음'으로 정리하면 됩니다.`,
      confirmHelper: `이 배우자 사건에서 더 입력할 후속 상속인이 없으면 현재 상태를 확정합니다.`,
    };
  }, [currentNode, resolvedParentNode]);

  const [excludedSpouseChildMap, setExcludedSpouseChildMap] = React.useState({});

  const parentChildCandidates = React.useMemo(
    () => parentHeirsForGuide.filter((person) => ['son', 'daughter'].includes(person.relation)),
    [parentHeirsForGuide]
  );
  const getSpouseCandidateKey = React.useCallback(
    (person) => person?.personId || person?.id || '',
    []
  );

  const excludedSpouseChildIds = excludedSpouseChildMap[currentNode?.id || ''] || [];
  const reviewTargetNodeIds = React.useMemo(
    () => new Set((reviewContext?.targetNodeIds || []).filter(Boolean)),
    [reviewContext]
  );
  const isLegacyWifeReinheritance =
    !!currentNode &&
    currentNode.relation === 'wife' &&
    currentLawEra !== '1991' &&
    !!resolvedParentNode &&
    resolvedParentNode.id !== 'root';
  const isHusbandReinheritanceGuide =
    !!currentNode &&
    currentNode.relation === 'husband' &&
    !!resolvedParentNode &&
    resolvedParentNode.id !== 'root';
  const showSpouseComparisonPanel =
    ['wife', 'husband', 'spouse'].includes(currentNode?.relation) &&
    parentChildCandidates.length > 0 &&
    !!resolvedParentNode;
  const areAllHusbandCandidatesExcluded =
    isHusbandReinheritanceGuide &&
    parentChildCandidates.length > 0 &&
    excludedSpouseChildIds.length === parentChildCandidates.length;

  const toggleExcludedSpouseChild = React.useCallback((personId) => {
    if (!currentNode?.id || !personId) return;
    setExcludedSpouseChildMap((prev) => {
      const current = new Set(prev[currentNode.id] || []);
      if (current.has(personId)) current.delete(personId);
      else current.add(personId);
      return {
        ...prev,
        [currentNode.id]: Array.from(current),
      };
    });
  }, [currentNode]);

  const clearExcludedSpouseChildren = React.useCallback(() => {
    if (!currentNode?.id) return;
    setExcludedSpouseChildMap((prev) => ({
      ...prev,
      [currentNode.id]: [],
    }));
  }, [currentNode]);

  const excludeAllSpouseChildren = React.useCallback(() => {
    if (!currentNode?.id) return;
    setExcludedSpouseChildMap((prev) => ({
      ...prev,
      [currentNode.id]: parentChildCandidates.map((person) => getSpouseCandidateKey(person)).filter(Boolean),
    }));
  }, [currentNode, parentChildCandidates, getSpouseCandidateKey]);

  const getEmptyStateGuide = () => {
    if (currentNode?.successorStatus) {
      const confirmedLabel =
        currentNode.successorStatus === 'confirmed_no_substitute_heirs'
          ? '??듭긽?띿씤 ?놁쓬 ?뺤젙'
          : currentNode.successorStatus === 'confirmed_no_spouse_descendants'
            ? '吏곴퀎鍮꾩냽쨌諛곗슦???놁쓬 ?뺤젙'
            : '異붽? ?곸냽???놁쓬 ?뺤젙';
      return {
        title: `${confirmedLabel} ?곹깭?낅땲??`,
        body: '???④퀎??異붽? ?곸냽???놁씠 吏꾪뻾?섎룄濡??뺤씤???곹깭?낅땲?? ?꾩냽 ?곸냽?몄씠 ?꾩슂?댁?硫??곸냽??異붽? ?먮뒗 遺덈윭?ㅺ린瑜??ъ슜?섎㈃ ?⑸땲??',
      };
    }

    const cycleIssue = currentNodeIssues.find((issue) => issue.code === 'inheritance-cycle');
    if (cycleIssue) {
      return {
        title: '?쒗솚 李몄“ ?ㅻ쪟瑜?癒쇱? ?뺣━??二쇱꽭??',
        body: cycleIssue.text,
      };
    }

    if (isRootNode && (!tree.name?.trim() || !tree.deathDate)) {
      return {
        title: '湲곕낯?뺣낫瑜?癒쇱? ?낅젰??二쇱꽭??',
        body: '?ш굔踰덊샇, ?쇱긽?띿씤 ?대쫫, ?щ쭩?쇱옄瑜??낅젰?섎㈃ ?ㅼ쓬 ?덈궡媛 ?댁뼱吏묐땲??',
      };
    }

    const isPre = currentNode?.deathDate && tree?.deathDate && isBefore(currentNode.deathDate, tree.deathDate);
    if (isPre) {
      return {
        title: '?좎궗留??곸냽?몄? ??듭긽?띿씤 ?낅젰???꾩슂?⑸땲??',
        body: '諛곗슦???먮뒗 吏곴퀎鍮꾩냽???낅젰?섏? ?딆쑝硫?怨꾩궛?먯꽌 ?쒖쇅?⑸땲??',
      };
    }

    if (
      currentLawEra !== '1991' &&
      ['son', 'husband'].includes(currentNode?.relation) &&
      currentNode?.isHoju === false
    ) {
      return {
        title: `${currentNode?.name || '현재 상속인'}은(는) 비호주로 설정되어 있습니다.`,
        body: '사정이 없다면 호주 여부를 다시 확인하고, 1차 상속인을 입력해 주세요.',
      };
    }

    if (requiresHojuReview) {
      return {
        title: '이 상속 단계는 호주상속 검토가 필요합니다.',
        body: '상속인을 먼저 불러오거나 입력한 뒤, 현재 단계에서 호주 여부를 확인해 주세요.',
      };
    }

    const rootHeirs = tree.heirs || [];
    const activeGuideHeirs = isRootNode ? rootHeirs : parentHeirsForGuide;
    const parentNode = activeGuideHeirs.find((h) => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded);
    const isParentAliveAtTargetDeath =
      parentNode &&
      (!parentNode.deathDate || !currentNode?.deathDate || !isBefore(parentNode.deathDate, currentNode.deathDate));

    if (['wife', 'husband', 'spouse'].includes(currentNode?.relation)) {
      return {
        title: '?꾩쭅 吏곸젒 ?낅젰???꾩냽 ?곸냽?몄씠 ?놁뒿?덈떎.',
        body: '?꾩슂???곸냽?몄씠 ?덈떎硫?異붽???二쇱꽭?? ?낅젰?섏? ?딆쑝硫?踰뺤젙 ?쒖쐞???곕씪 ?먮룞 遺꾨같媛 吏꾪뻾?????덉뒿?덈떎.',
      };
    }

    if (isParentAliveAtTargetDeath) {
      return {
        title: '?꾩쭅 吏곸젒 ?낅젰???꾩냽 ?곸냽?몄씠 ?놁뒿?덈떎.',
        body: '?꾩슂???곸냽?몄씠 ?덈떎硫?異붽???二쇱꽭?? ?낅젰?섏? ?딆쑝硫?踰뺤젙 ?쒖쐞???곕씪 ?먮룞 遺꾨같媛 吏꾪뻾?????덉뒿?덈떎.',
      };
    }

    return {
      title: '?꾩쭅 吏곸젒 ?낅젰???꾩냽 ?곸냽?몄씠 ?놁뒿?덈떎.',
      body: '?꾩슂???곸냽?몄씠 ?덈떎硫?異붽???二쇱꽭?? ?낅젰?섏? ?딆쑝硫?踰뺤젙 ?쒖쐞???곕씪 ?먮룞 遺꾨같媛 吏꾪뻾?????덉뒿?덈떎.',
    };
  };

  const emptyStateGuide = ['wife', 'husband', 'spouse'].includes(currentNode?.relation)
    ? spouseEmptyStateGuide
    : getEmptyStateGuide();
  const compareDateForCurrentNode = resolvedParentNode?.deathDate || tree?.deathDate || '';
  const isCurrentPredeceased =
    !!(currentNode?.deathDate && compareDateForCurrentNode && isBefore(currentNode.deathDate, compareDateForCurrentNode));
  const emptyStateConfirm = React.useMemo(() => {
    if (!currentNode || currentNode.id === 'root' || !currentNode.isDeceased || currentNode.isExcluded === true) return null;
    if (['wife', 'husband', 'spouse'].includes(currentNode.relation)) {
      return {
        label: '異붽? ?곸냽???놁쓬',
        value: 'confirmed_no_additional_heirs',
        helper: '???④퀎?먯꽌 ???낅젰???꾩냽 ?곸냽?몄씠 ?놁쓬???뺤젙?⑸땲??',
      };
    }
    if (isCurrentPredeceased && ['son', 'daughter', 'sibling'].includes(currentNode.relation)) {
      return {
        label: '??듭긽?띿씤 ?놁쓬',
        value: 'confirmed_no_substitute_heirs',
        helper: '諛곗슦?먮굹 吏곴퀎鍮꾩냽???놁뼱 ??듭긽?띿씠 ?놁쓬???뺤젙?⑸땲??',
      };
    }
    return {
      label: '吏곴퀎鍮꾩냽쨌諛곗슦???놁쓬',
      value: 'confirmed_no_spouse_descendants',
      helper: '吏곴퀎鍮꾩냽怨?諛곗슦?먭? ?놁뼱 李⑥닚???곸냽?쇰줈 ?섏뼱媛???⑥쓣 ?뺤젙?⑸땲??',
    };
  }, [currentNode, isCurrentPredeceased]);

  const handleRemoveAllHeirs = () => {
    if (!nodeHeirs.length) return;
    const confirmed = window.confirm('?낅젰???곸냽??紐⑸줉???꾨? ??젣?섏떆寃좎뒿?덇퉴?');
    if (!confirmed) return;
    removeAllHeirs(currentNode?.id || 'root');
  };

  const handleAutoFill = () => {
    const parentHeirs = parentHeirsForGuide;
    const existingNames = new Set(nodeHeirs.map((h) => h.name).filter((n) => n.trim() !== ''));
    let baseAdd = [];

    if (['wife', 'husband', 'spouse'].includes(currentNode.relation)) {
      const children = parentHeirs.filter((s) => ['son', 'daughter'].includes(s.relation));
      const filteredChildren = currentNode.relation === 'husband'
        ? children.filter((child) => !excludedSpouseChildIds.includes(getSpouseCandidateKey(child)))
        : children;
      if (currentNode.relation === 'husband' && children.length > 0 && filteredChildren.length === 0) {
        alert('?⑥? ?먮? ?꾨낫媛 ?놁뒿?덈떎. 吏곴퀎議댁냽 ?먮뒗 ?뺤젣?먮ℓ 媛숈? 李⑥닚???곸냽???낅젰???꾩슂?쒖? 寃?좏빐 二쇱꽭??');
        return;
      }
      baseAdd = filteredChildren.filter((c) => c.name.trim() === '' || !existingNames.has(c.name));
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
      alert('遺덈윭???곸냽?몄씠 ?놁뒿?덈떎.');
      return;
    }

    appendResolvedHeirs(currentNode.id, baseAdd.map((item) => ({ ...item })));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
      <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-4 flex flex-wrap items-center gap-4 transition-colors shadow-sm">
        <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 uppercase tracking-widest">湲곕낯?뺣낫</span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사건번호</label>
          <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo || ''} onChange={(e) => handleRootUpdate('caseNo', e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="사건번호 입력" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">피상속인</label>
          <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={(e) => handleRootUpdate('name', e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="이름" />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사망일자</label>
          <DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={(v) => handleRootUpdate('deathDate', v)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" />
        </div>
        {getLawEra(tree.deathDate) !== '1991' && (
          <div className="shrink-0 flex items-center gap-2">
            <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">호주</label>
            <input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={(e) => handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" />
          </div>
        )}
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">상속분 지분</label>
          <div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1">
            <input type="number" min="1" value={tree.shareD || 1} onChange={(e) => handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분모" />
            <span className="text-[#787774] dark:text-neutral-500 text-[12px] font-medium mx-0.5">/</span>
            <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={(e) => handleRootUpdate('shareN', Math.min(tree.shareD || 1, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분자" />
          </div>
        </div>
      </div>

      <div className="transition-colors flex-1 flex flex-col">
        <div className="relative transition-all duration-300 flex-1 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-xl">
          <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl min-h-[80px]">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center shrink-0 pr-1">
                {activeDeceasedTab === 'root' ? (
                  <div className="flex items-center px-2">
                    <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 tracking-tight">입력 단계</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveDeceasedTab(activeTabObj?.parentTabId || 'root')}
                    className="flex min-w-[112px] items-center gap-2 px-3 py-1.5 bg-neutral-100/80 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md border border-[#e9e9e7] dark:border-neutral-700 transition-all active:scale-95 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3 h-3 text-[#1e56a0] dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-0.5">상위상속인 바로가기</span>
                      <span className="text-[13.5px] font-black text-slate-800 dark:text-neutral-100 whitespace-nowrap">
                        {activeTabObj?.parentName || '상위'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center min-w-[120px] max-w-[250px]">
                <span className="text-[10.5px] font-bold text-[#1e56a0] dark:text-blue-400 mb-0.5 whitespace-nowrap">
                  {activeDeceasedTab === 'root'
                    ? '피상속인'
                    : `${activeTabObj?.parentName || '상위상속인'}의 ${getRelStr(currentNode?.relation, tree.deathDate)}`}
                </span>
                <div className="flex items-center overflow-hidden">
                  <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                    {getBriefingInfo?.name || (activeDeceasedTab === 'root' ? (tree.name || '?쇱긽?띿씤') : '(?곸냽??')}
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
                {canAutoFill && <button type="button" onClick={handleAutoFill} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"><IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 불러오기</button>}
                <button type="button" onClick={() => setIsMainQuickActive(!isMainQuickActive)} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"><IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 상속인 추가</button>
              </div>
            </div>
          </div>

          <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
            {isMainQuickActive && (
              <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">?곸냽???대쫫???쇳몴濡?援щ텇??鍮좊Ⅴ寃??낅젰?섏꽭??</div>
                    <button onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }} className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors" title="?リ린"><IconX className="w-3.5 h-3.5" /></button>
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
                      className="flex-1 text-[13px] border border-[#e9e9e7] dark:border-neutral-700 rounded-md px-3 py-1.5 outline-none focus:border-[#d4d4d4] bg-white dark:bg-neutral-900 dark:text-neutral-200 transition-all font-medium text-[#37352f]"
                    />
                    <button onClick={() => { handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); setIsMainQuickActive(false); setMainQuickVal(''); }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 hover:bg-[#efefed] dark:hover:bg-neutral-700 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 text-[13px] font-bold rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap">빠른 등록</button>
                  </div>
                </div>
              </div>
            )}

            {showSpouseComparisonPanel && (
              <div className="mb-4 rounded-lg border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold text-[#37352f] dark:text-neutral-200">
                      {isLegacyWifeReinheritance ? '기준 자녀 목록' : '상위 사건 자녀 목록'}
                    </div>
                    <div className="mt-1 text-[11.5px] leading-relaxed text-[#787774] dark:text-neutral-400">
                      {isLegacyWifeReinheritance
                        ? `[${resolvedParentNode?.name || '상위 사건'}] 사건 자녀`
                        : isHusbandReinheritanceGuide
                          ? `아래의 상속인은 [${resolvedParentNode?.name || '상위 사건'}] 사건 기준 자녀 목록입니다. [${currentNode?.name || '해당 배우자'}]의 상속인이 아닌 사람이 있으면 선택해 주세요.`
                          : `아래의 상속인은 [${resolvedParentNode?.name || '상위 사건'}] 사건 기준 자녀 목록입니다.`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {parentChildCandidates.map((child) => {
                    const candidateKey = getSpouseCandidateKey(child);
                    const isExcludedCandidate = excludedSpouseChildIds.includes(candidateKey);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => isHusbandReinheritanceGuide && toggleExcludedSpouseChild(candidateKey)}
                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                          isHusbandReinheritanceGuide
                            ? isExcludedCandidate
                              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                              : 'border-[#d9d5cf] bg-white text-[#5f5b55] hover:bg-[#f3f3f1] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                            : 'border-[#d9d5cf] bg-white text-[#5f5b55] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        {child.name || '이름 미상'}
                        {isHusbandReinheritanceGuide && isExcludedCandidate ? ' 제외' : ''}
                      </button>
                    );
                  })}
                </div>

                {isHusbandReinheritanceGuide && (
                  <div className="mt-3 text-[11px] leading-relaxed text-[#787774] dark:text-neutral-400">
                    선택한 사람은 [불러오기] 대상에서 제외됩니다. 모두 제외하면 직계존속 또는 형제자매 같은 차순위 상속인 입력이 필요한지 검토해 주세요.
                  </div>
                )}

                {areAllHusbandCandidatesExcluded && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                    {`현재 자녀 후보가 모두 제외되었습니다. [${currentNode?.name || '해당 배우자'}] 사건에서는 직계비속이 보이지 않으므로, 부모 등 직계존속이나 형제자매 같은 차순위 상속인 입력이 필요한지 검토해 주세요.`}
                  </div>
                )}
              </div>
            )}

            {nodeHeirs.length === 0 && (
              currentNode?.isDeceased && (currentNode?.isExcluded !== true || !!emptyStateConfirm || !!currentNode?.successorStatus) ? (
                <div className="flex flex-col items-center justify-center p-8 bg-[#f8f8f7] dark:bg-neutral-800/40 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[14.5px] leading-relaxed whitespace-pre-wrap">
                    {emptyStateGuide.title}
                  </span>
                  <span className="text-[#787774] dark:text-neutral-400 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                    {emptyStateGuide.body}
                  </span>
                  {emptyStateConfirm && !currentNode?.successorStatus && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(currentNode.id, 'successorStatus', emptyStateConfirm.value)}
                        className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        {['wife', 'husband', 'spouse'].includes(currentNode?.relation)
                          ? '추가 상속인 없음'
                          : emptyStateConfirm.label}
                      </button>
                      <span className="text-[11.5px] text-[#787774] dark:text-neutral-400">
                        {['wife', 'husband', 'spouse'].includes(currentNode?.relation)
                          ? (spouseEmptyStateGuide?.confirmHelper || emptyStateConfirm.helper)
                          : emptyStateConfirm.helper}
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
                      <span className="text-[11.5px] text-[#787774] dark:text-neutral-400">
                        ?곸냽?몄쓣 異붽??섍굅??遺덈윭?ㅺ린 ?섎㈃ ???뺤젙 ?곹깭???먮룞?쇰줈 ?댁젣?⑸땲??
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-[#f8f8f7] dark:bg-neutral-800/40 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[14px]">?꾩쭅 ?섏쐞 ?곸냽???곗씠?곌? ?놁뒿?덈떎.</span>
                  <span className="text-[#787774] dark:text-neutral-400 text-[12.5px]">??媛吏???곸냽?몄씠 ?녿떎硫?踰뺤젙 ?쒖쐞???곕씪 ?ㅼ쓬 ?쒖쐞濡?吏遺꾩씠 遺꾨같?⑸땲??</span>
                </div>
              )
            )}

            {nodeHeirs.length > 0 && (
              <div className="mb-2 flex items-center w-full min-h-[28px] rounded-md border border-[#f1f1ef] bg-[#fcfcfb] px-0 text-[11px] font-bold tracking-tight text-[#787774] dark:border-neutral-700/50 dark:bg-neutral-900/20 dark:text-neutral-400">
                <div className="w-5 ml-[10px] shrink-0" />
                <div className="ml-[20px] w-7 shrink-0 text-center">상태</div>
                <div className="w-[72px] ml-[50px] shrink-0">성명</div>
                <div className="w-[76px] ml-[30px] shrink-0">관계</div>
                <div className="w-[150px] ml-[50px] shrink-0">생존/사망(사망일자)</div>
                <div className="w-[180px] ml-[10px] shrink-0">특수조건/가감산 요소</div>
                <div className="w-[98px] ml-[10px] shrink-0 text-center">사상 또는 대습상태</div>
                <div className="ml-[15px] mr-[20px] w-12 shrink-0 flex justify-center">
                  <button
                    type="button"
                    onClick={handleRemoveAllHeirs}
                    disabled={!nodeHeirs.length}
                    className="group relative flex h-7 w-7 items-center justify-center rounded-md text-[#a3a3a3] transition-colors hover:text-red-500 disabled:cursor-default disabled:opacity-40"
                    aria-label="전체 제거"
                  >
                    <IconTrash2 className="h-4 w-4 shrink-0" />
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-normal whitespace-nowrap text-red-500 opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100">
                      전체 제거
                    </span>
                  </button>
                </div>
              </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={nodeHeirs.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {nodeHeirs.map((h) => (
                    <div
                      key={h.id}
                      className={
                        reviewTargetNodeIds.has(h.id)
                          ? 'rounded-lg ring-2 ring-amber-300 ring-offset-2 ring-offset-white dark:ring-amber-600 dark:ring-offset-neutral-800'
                          : ''
                      }
                    >
                      <HeirRow
                        node={h}
                        finalShares={finalShares}
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
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
