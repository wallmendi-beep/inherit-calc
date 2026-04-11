import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DateInput } from './DateInput';
import HeirRow from './HeirRow';
import { IconUserGroup, IconUserPlus, IconX } from './Icons';
import { getLawEra, formatKorDate, isBefore } from '../engine/utils';

export default function InputPanel({
  tree,
  activeDeceasedTab,
  activeTabObj,
  finalShares,
  handleUpdate,
  removeHeir,
  addHeir,
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
}) {
  const currentNode = activeTabObj ? activeTabObj.node : tree;
  const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
  const isRootNode = currentNode && currentNode.id === 'root';
  const canAutoFill = !isRootNode && ['wife', 'husband', 'son', 'daughter'].includes(currentNode?.relation);

  const handleAutoFill = () => {
    const parentHeirs = activeTabObj.parentNode?.heirs || [];
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
      baseAdd = [...parents, ...siblings].filter((c) => c.name.trim() === '' || !existingNames.has(c.name));
    }
    
    if (baseAdd.length > 0) {
      const namesJoined = baseAdd.map((b) => b.name).join(', ');
      handleQuickSubmit(activeDeceasedTab, currentNode, namesJoined);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0" data-active-deceased-tab={activeDeceasedTab}>
      <div className="flex items-center justify-between pb-3 px-1 no-print">
        {isRootNode && (
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">개정전 호주</label>
            <input type="checkbox" disabled={!isRootNode} checked={tree.isHoju !== false} onChange={(e) => handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" />
          </div>
        )}
        <div className="shrink-0 flex items-center gap-2 ml-auto">
          <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">상속분 설정</label>
          <div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1">
            <input type="number" min="1" value={tree.shareD || 1} onChange={(e) => handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분모" />
            <span className="text-[#787774] dark:text-neutral-500 text-[12px] font-medium mx-0.5">/</span>
            <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={(e) => handleRootUpdate('shareN', Math.min(tree.shareD || 1, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분자" />
          </div>
        </div>
      </div>

      <div className="transition-colors flex-1 flex flex-col">
        <div className="relative transition-all duration-300 flex-1 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-xl flex flex-col min-h-0">
          <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl min-h-[80px] shrink-0">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center shrink-0 pr-1">
                {isRootNode ? (
                  <div className="flex items-center px-2">
                    <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 tracking-tight">피상속인 정보</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => setActiveDeceasedTab(activeTabObj?.parentTabId || 'root')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100/80 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md border border-[#e9e9e7] dark:border-neutral-700 transition-all active:scale-95 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3 h-3 text-[#1e56a0] dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-0.5">상위</span>
                      <span className="text-[11.5px] font-black text-slate-800 dark:text-neutral-100 whitespace-nowrap">
                        {activeTabObj?.parentName || '피상속인'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center min-w-[80px] max-w-[180px]">
                <span className="text-[10px] font-bold text-[#1e56a0] dark:text-blue-400 uppercase mb-0.5">
                  {isRootNode ? '피상속인' : (activeTabObj?.inheritanceType === 'predeceased' ? '피대습상속인' : '피상속인')}
                </span>
                <div className="flex items-center overflow-hidden">
                  <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                    {currentNode?.name || '성명 미상'}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center items-center shrink-0 min-w-[100px]">
                <span className="text-[11px] font-bold text-[#c93f3a] dark:text-red-400 mb-1 leading-none">
                  {currentNode?.deathDate ? `${formatKorDate(currentNode.deathDate)} 사망` : '사망일 미입력'}
                </span>
                <div className="px-2 bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 py-0.5 rounded flex items-center justify-center shadow-sm">
                  <span className="text-[10px] font-black tracking-tighter whitespace-nowrap uppercase">
                    {getLawEra(currentNode?.deathDate || tree.deathDate)}년 민법
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">지분</span>
                  <span className="text-[17px] font-black text-[#1e56a0] dark:text-blue-400 leading-none">
                    {getBriefingInfo?.shareStr || '0/1'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {canAutoFill && (
                  <button type="button" onClick={handleAutoFill} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm">
                    <IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 일괄 불러오기
                  </button>
                )}
                <button type="button" onClick={() => setIsMainQuickActive(!isMainQuickActive)} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm">
                  <IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 빠른 등록
                </button>
                <button type="button" onClick={() => { setAiTargetId(activeDeceasedTab); setIsAiModalOpen(true); }} className="flex items-center justify-center w-7 h-7 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-all shadow-sm active:scale-95 ml-1">
                  <span className="text-[14px] font-bold leading-none text-indigo-600 dark:text-indigo-400">AI</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50 custom-scrollbar">
            {isMainQuickActive && (
              <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">여러 이름을 쉼표로 구분하여 입력하세요.</div>
                    <button onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }} className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors"><IconX className="w-3.5 h-3.5" /></button>
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
                    <button onClick={() => { handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); setIsMainQuickActive(false); setMainQuickVal(''); }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 hover:bg-[#efefed] dark:hover:bg-neutral-700 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 text-[13px] font-bold rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap">등록</button>
                  </div>
                </div>
              </div>
            )}

            {nodeHeirs.length === 0 && (
              currentNode?.isDeceased && currentNode?.isExcluded !== true ? (
                <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#b45309] dark:text-amber-500 font-bold text-[14.5px] whitespace-pre-wrap leading-relaxed">
                    {(() => {
                      const isPre = currentNode.deathDate && tree.deathDate && isBefore(currentNode.deathDate, tree.deathDate);
                      const isSp = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(currentNode.relation);
                      const name = currentNode.name || '상속인';

                      if (isPre) {
                        return isSp 
                          ? `피상속인보다 먼저 사망한 배우자 [${name}]은 상속권이 발생하지 않습니다.` 
                          : `[${name}]은 선사망자입니다. 하위에 대습상속인(비속/배우자)이 있다면 입력해 주세요.\n입력 시 [${name}]의 상속지분이 자동으로 계산됩니다.`;
                      } else {
                        const findSuccessors = () => {
                          if (isSp) {
                            const children = (tree.heirs || []).filter(h => ['son', 'daughter', '아들', '딸'].includes(h.relation) && !h.isExcluded).map(h => h.name);
                            return children.length > 0 ? `직계비속 [${children.join(', ')}]` : "다음 순위 상속인";
                          } else {
                            const mother = (tree.heirs || []).find(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isDeceased && !h.isExcluded);
                            if (mother) return `직계존속 [${mother.name}]`;
                            const siblings = (tree.heirs || []).filter(h => h.id !== currentNode.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded).map(h => h.name);
                            return siblings.length > 0 ? `형제자매 [${siblings.join(', ')}]` : "다음 순위 상속인";
                          }
                        };
                        const target = findSuccessors();
                        return `별도의 상속인을 입력하지 않으면, 법정 순위에 따라 ${target}에게 지분이 귀속됩니다.`;
                      }
                    })()}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#b45309] dark:text-amber-500 font-bold text-[14px]">아직 하위 상속인 데이터가 없습니다.</span>
                  <span className="text-[#787774] dark:text-neutral-400 text-[12.5px]">상속인이 없다면 법정 순위에 따라 다음 순위로 지분이 분배됩니다.</span>
                </div>
              )
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={nodeHeirs.map(h => h.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col w-full">
                  {nodeHeirs.map((heir) => (
                    <HeirRow key={heir.id} node={heir} tree={tree} handleUpdate={handleUpdate} removeHeir={removeHeir} />
                  ))}
                  <button onClick={() => addHeir(currentNode.id)} className="group mt-4 flex items-center justify-center w-full py-4 bg-white dark:bg-neutral-800 border-2 border-dashed border-[#e9e9e7] dark:border-neutral-700 rounded-xl text-[#787774] dark:text-neutral-400 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-[0.99] font-bold text-[14px]">
                    <IconUserPlus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> {isRootNode ? '상속인 추가' : '대습/계승 상속인 추가'}
                  </button>
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
