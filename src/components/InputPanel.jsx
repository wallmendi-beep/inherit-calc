import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DateInput } from './DateInput';
import HeirRow from './HeirRow';
import { IconTrash2, IconUserGroup, IconUserPlus, IconX, IconSparkles } from './Icons';
import { getLawEra, formatKorDate, getRelStr, isBefore } from '../engine/utils';

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

  const spouseEmptyStateGuide = React.useMemo(() => {
    if (!currentNode || !['wife', 'husband', 'spouse'].includes(currentNode.relation)) return null;
    if (currentNode.relation === 'wife') {
      return {
        title: `[${currentNode.name || '이름 미상'}]의 하위 상속인(자녀 등)을 입력해 주세요.`,
        body: `대습상속 판정을 위해 [${currentNode.name || '이름 미상'}]과(와) 연결된 자녀 계통을 모두 입력해 주셔야 합니다. 하위 상속인이 아예 없다면 '추가 상속인 없음'으로 확정해 주세요.`,
      };
    }
    if (currentNode.relation === 'husband') {
      return {
        title: `[${currentNode.name || '이름 미상'}]의 하위 상속인 정보(자녀 등)를 확인해 주세요.`,
        body: `1991년 이전 사망한 남편의 경우, 처가 본가의 대습상속인이 될 수 있는지 여부를 판정하기 위해 자녀 유무를 반드시 확인해야 합니다.`,
      };
    }
    return {
      title: `[${currentNode.name || '이름 미상'}]의 하위 상속인을 구성해 주세요.`,
      body: `이 사건의 상속인 [${currentNode.name || '이름 미상'}]에게 연결될 하위 계통 정보를 입력해 주셔야 합니다. 더 이상 하위 상속인이 없다면 '추가 상속인 없음'으로 확정해 주세요.`,
    };
  }, [currentNode]);

  const reviewTargetNodeIds = React.useMemo(
    () => new Set((reviewContext?.targetNodeIds || []).filter(Boolean)),
    [reviewContext]
  );

  // [v4.74] 가이드 클릭 시 자동 스크롤 및 하이라이트 유지
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

  const parentChildCandidates = React.useMemo(
    () => parentHeirsForGuide.filter((person) => ['son', 'daughter'].includes(person.relation)),
    [parentHeirsForGuide]
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

  const briefing = React.useMemo(() => {
    if (currentNode?.successorStatus) {
      const confirmedLabel =
        currentNode.successorStatus === 'confirmed_no_substitute_heirs'
          ? '대습상속인 없음'
          : currentNode.successorStatus === 'confirmed_no_spouse_descendants'
            ? '직계비속·배우자 없음'
            : '추가 상속인 없음';
      return {
        title: `${confirmedLabel} 확정 상태입니다.`,
        body: '사용자가 하위 상속인이 없음을 직접 확정하였습니다. 만약 입력할 정보가 더 있다면 아래 버튼을 통해 확정 상태를 해제하고 다시 입력해 주세요.',
      };
    }

    const cycleIssue = currentNodeIssues.find((issue) => issue.code === 'inheritance-cycle');
    if (cycleIssue) {
      return {
        title: '순환 참조 오류를 먼저 해결해 주세요.',
        body: cycleIssue.text,
      };
    }

    if (isRootNode && (!tree.name?.trim() || !tree.deathDate)) {
      return {
        title: '기본 정보를 먼저 입력해 주세요.',
        body: '사건번호, 피상속인 성명, 사망일자를 입력해야 정확한 안내와 계산이 시작됩니다.',
      };
    }

    const isPre = currentNode?.deathDate && tree?.deathDate && isBefore(currentNode.deathDate, tree.deathDate);
    if (isPre) {
      return {
        title: '선사망자로 판정되어 대습상속이 적용됩니다.',
        body: '사망자의 배우자나 직계비속이 있다면 대습상속인으로 추가 입력해 주세요.',
      };
    }

    if (nodeHeirs.length === 0) {
      if (isRootNode) {
        return {
          title: '상속인(자녀, 배우자 등)을 입력해 주세요.',
          body: '피상속인 사망 당시의 상속인들을 아래 입력창을 통해 등록해 주세요. 구민법 적용 시 호주 여부도 중요합니다.',
        };
      }
      return spouseEmptyStateGuide;
    }

    return null;
  }, [isRootNode, tree, currentNode, currentNodeIssues, nodeHeirs, spouseEmptyStateGuide]);

  const removeAllHeirsAction = () => {
    if (window.confirm('입력된 상속인 목록을 전부 삭제하시겠습니까?')) {
      removeAllHeirs(currentNode.id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {briefing && (
        <div className="mb-6 p-5 rounded-2xl bg-[#fcfcfb] border border-[#e9e9e7] dark:bg-neutral-900/40 dark:border-neutral-700 animate-in fade-in slide-in-from-top-1">
          <h3 className="text-[15px] font-bold text-[#37352f] dark:text-neutral-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1e56a0] dark:bg-blue-400"></span>
            {briefing.title}
          </h3>
          <p className="mt-2 text-[13.5px] text-[#787774] dark:text-neutral-400 leading-relaxed whitespace-pre-wrap">
            {briefing.body}
          </p>
          {currentNode?.successorStatus && (
            <button
              onClick={() => handleUpdate(currentNode.id, { successorStatus: '' })}
              className="mt-4 text-[12px] font-bold text-[#1e56a0] hover:underline dark:text-blue-400"
            >
              확정 상태 해제하고 다시 입력하기
            </button>
          )}
        </div>
      )}

      {showSpouseComparisonPanel && (
        <div className="mb-6 rounded-2xl border-2 border-[#1e56a0]/20 bg-[#eff6ff]/30 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-[14px] font-bold text-[#1e56a0] dark:text-blue-400">
                {isLegacyWifeReinheritance ? '여성 상속인(처)의 동일가적 여부 검토' : '남편의 대습상속 자격 검토'}
              </h4>
              <p className="mt-1 text-[13px] text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                {isLegacyWifeReinheritance
                  ? '구민법상 처가 시댁 가계에서 계속 상속권을 가지려면 남편 사망 후 시댁 가적에 남아있어야 합니다. 분가하거나 재혼했다면 상속권이 소멸할 수 있습니다.'
                  : '1991년 이전 민법에서는 남편이 사망한 경우, 아내가 대습상속인이 되기 위해서는 해당 가계에 자녀가 있어야 합니다. 자녀가 없다면 아내의 대습상속권이 인정되지 않습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <IconUserGroup className="w-5 h-5 text-[#37352f] dark:text-neutral-400" />
          <h2 className="text-[16px] font-bold text-[#37352f] dark:text-neutral-100">
            상속인 목록 ({nodeHeirs.length}명)
          </h2>
        </div>
        <div className="flex gap-2">
          {suggestHojuSelection && (
            <button
              onClick={() => handleUpdate(currentNode.id, { isHoju: true })}
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
            >
              호주 승계자로 설정
            </button>
          )}
          {canAutoFill && nodeHeirs.length === 0 && (
            <button
              onClick={() => handleUpdate(currentNode.id, { successorStatus: 'confirmed_no_substitute_heirs' })}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-200 transition-colors dark:bg-neutral-700 dark:text-neutral-300"
            >
              추가 상속인 없음 확정
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 space-y-3">
          <SortableContext items={nodeHeirs.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            {nodeHeirs.map((node) => (
              <HeirRow
                key={node.id}
                node={node}
                finalShares={finalShares}
                handleUpdate={handleUpdate}
                removeHeir={removeHeir}
                inheritedDate={inheritedDate}
                rootDeathDate={tree.deathDate}
                rootIsHoju={tree.isHoju !== false}
                onTabClick={setActiveDeceasedTab}
                parentNode={currentNode}
                isHighlighted={reviewTargetNodeIds.has(node.id) || reviewTargetNodeIds.has(node.personId)}
              />
            ))}
          </SortableContext>

          <div className="mt-6 flex flex-col gap-3 no-print">
            <div className="relative group">
              <input
                type="text"
                placeholder="상속인 이름을 쉼표(,)로 구분해 입력 (예: 김철수, 이영희)"
                value={mainQuickVal}
                onChange={(e) => setMainQuickVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); }}
                className="w-full rounded-xl border border-[#e9e9e7] bg-white px-5 py-3.5 text-[14px] shadow-sm transition-all focus:border-[#1e56a0] focus:ring-4 focus:ring-[#1e56a0]/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <button
                onClick={() => handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-[#1e56a0] p-2 text-white shadow-md hover:bg-[#1a4a8a] transition-all"
              >
                <IconUserPlus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-between px-2">
              <p className="text-[12px] text-[#9b9a97] dark:text-neutral-500">
                💡 팁: 이름을 입력하고 엔터를 누르면 즉시 추가됩니다.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#1e56a0] hover:underline dark:text-blue-400"
                >
                  <IconSparkles className="w-4 h-4" /> AI로 가계도 자동 구성
                </button>
                {nodeHeirs.length > 0 && (
                  <button
                    onClick={removeAllHeirsAction}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-red-500 hover:underline"
                  >
                    <IconTrash2 className="w-4 h-4" /> 전체 삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}
