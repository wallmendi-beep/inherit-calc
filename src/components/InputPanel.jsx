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
      baseAdd = [
        ...parents.map((item) => ({ ...item, relation: 'parent' })),
        ...siblings.map((item) => ({ ...item, relation: 'sibling' })),
      ].filter((s) => s.name.trim() === '' || !existingNames.has(s.name));
    }

    if (baseAdd.length === 0) {
      alert('불러올 상속인이 없습니다.');
      return;
    }

    handleUpdate(currentNode.id, {
      heirs: [...(currentNode.heirs || []), ...baseAdd.map((item) => ({ ...item }))],
      isExcluded: false,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
      <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-4 flex flex-wrap items-center gap-4 transition-colors shadow-sm">
        <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 uppercase tracking-widest">기본정보</span>
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100/80 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md border border-[#e9e9e7] dark:border-neutral-700 transition-all active:scale-95 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3 h-3 text-[#1e56a0] dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-0.5">상위상속인</span>
                      <span className="text-[11.5px] font-black text-slate-800 dark:text-neutral-100 whitespace-nowrap">
                        {activeTabObj?.parentName || '상위'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center min-w-[80px] max-w-[180px]">
                <span className="text-[10px] font-bold text-[#1e56a0] dark:text-blue-400 uppercase mb-0.5">
                  {activeDeceasedTab === 'root' 
                    ? '피상속인' 
                    : (activeTabObj?.inheritanceType === 'deceased' ? '피상속인' : '피대습상속인')}
                </span>
                <div className="flex items-center overflow-hidden">
                  <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                    {getBriefingInfo.name}
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
              <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <div className="flex items-baseline gap-2"><span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">지분</span><span className="text-[17px] font-black text-[#1e56a0] dark:text-blue-400 leading-none">{getBriefingInfo.shareStr}</span></div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {canAutoFill && <button type="button" onClick={handleAutoFill} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"><IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 불러오기</button>}
                <button type="button" onClick={() => setIsMainQuickActive(!isMainQuickActive)} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"><IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 상속인 추가</button>
                <button type="button" onClick={() => { setAiTargetId(activeDeceasedTab); setIsAiModalOpen(true); }} title="현재 상속인 기준으로 AI 입력" className="flex items-center justify-center w-7 h-7 shrink-0 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-all shadow-sm active:scale-95 ml-1"><span className="text-[14px] leading-none opacity-100 drop-shadow-sm mt-0.5">*</span></button>
              </div>
            </div>
          </div>

          <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
            {isMainQuickActive && (
              <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">상속인 이름을 쉼표로 구분해 빠르게 입력하세요.</div>
                    <button onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }} className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors" title="닫기"><IconX className="w-3.5 h-3.5" /></button>
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

            {nodeHeirs.length === 0 && (
              currentNode?.isDeceased && currentNode?.isExcluded !== true ? (
                <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#b45309] dark:text-amber-500 font-bold text-[14.5px] leading-relaxed">
                    {(() => {
                      const isPre = currentNode.deathDate && tree.deathDate && isBefore(currentNode.deathDate, tree.deathDate);
                      const isSp = ['wife', 'husband', 'spouse'].includes(currentNode.relation);
                      if (isPre) {
                        return isSp 
                          ? "피상속인보다 먼저 사망한 배우자는 상속권이 발생하지 않습니다.\n본인 항목의 초록색 스위치를 클릭해 [상속권 없음]으로 변경해 주세요."
                          : "대습상속인이 없는 선사망 자녀는 상속권이 발생하지 않습니다.\n본인 항목의 초록색 스위치를 클릭해 [상속권 없음]으로 변경해 주세요.";
                      } else {
                        return isSp 
                          ? "사망한 배우자의 지분을 상속받을 후속 대상을 입력해 주세요.\n하위 상속인이 없다면 [상속인 없음(지분 재분배)] 처리가 필요합니다."
                          : "재상속 대상자이나 현재 하위 상속인(자녀/배우자 등)이 없습니다.\n가계도를 추가하거나 본인 항목을 [상속인 없음] 상태로 변경해 주세요.";
                      }
                    })()}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-center gap-2 m-2 mb-4">
                  <span className="text-[#b45309] dark:text-amber-500 font-bold text-[14px]">아직 하위 상속인 데이터가 없습니다.</span>
                  <span className="text-[#787774] dark:text-neutral-400 text-[12.5px]">이 가지에 상속인이 없다면 법정 순위에 따라 다음 순위로 지분이 분배됩니다.</span>
                </div>
              )
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={nodeHeirs.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {nodeHeirs.map((h) => (
                    <HeirRow
                      key={h.id}
                      node={h}
                      finalShares={finalShares}
                      level={1}
                      handleUpdate={handleUpdate}
                      removeHeir={removeHeir}
                      addHeir={addHeir}
                      siblings={nodeHeirs}
                      inheritedDate={currentNode?.deathDate || tree.deathDate}
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
