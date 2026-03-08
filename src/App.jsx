import React, { useState, useEffect, useMemo } from 'react';
import { 
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen, 
  IconPrinter, IconNetwork, IconTable, IconList, 
  IconReset, IconFileText, IconXCircle 
} from './components/Icons';
import { DateInput } from './components/DateInput';
import HeirRow from './components/HeirRow';
import TreeReportNode from './components/TreeReportNode';
import { relStr, formatKorDate, formatMoney } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

function App() {
  const [activeTab, setActiveTab] = useState('input'); 
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [syncRequest, setSyncRequest] = useState(null); // { id, name, field, value }
  const [tree, setTree] = useState(getInitialTree());

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [inputToggleSignal, setInputToggleSignal] = useState(0); 
  const [isInputAllExpanded, setIsInputAllExpanded] = useState(true); 
  const [propertyValue, setPropertyValue] = useState(''); 
  const [isAmountActive, setIsAmountActive] = useState(false); 

  const tabData = [
    { id: 'input', label: '데이터 입력', icon: <IconFileText className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#2383e2]', activeText: 'text-[#2383e2]', inactiveBg: 'bg-[#eef4fb]', inactiveBorder: 'border-[#d0e2f5]', inactiveText: 'text-[#6080a0]' } 
    },
    { id: 'tree', label: '가계도', icon: <IconNetwork className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#16a34a]', activeText: 'text-[#16a34a]', inactiveBg: 'bg-[#eaf5ec]', inactiveBorder: 'border-[#cbe6d2]', inactiveText: 'text-[#5a8065]' } 
    },
    { id: 'calc', label: '계산표', icon: <IconTable className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#eab308]', activeText: 'text-[#ca8a04]', inactiveBg: 'bg-[#fef8e6]', inactiveBorder: 'border-[#fbeba6]', inactiveText: 'text-[#9c8238]' } 
    },
    { id: 'summary', label: '요약표', icon: <IconList className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#a855f7]', activeText: 'text-[#9333ea]', inactiveBg: 'bg-[#f6effa]', inactiveBorder: 'border-[#e5d4f5]', inactiveText: 'text-[#7e609c]' } 
    },
  ];
  
  const activeStyle = tabData.find(t => t.id === activeTab).style;

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsResetModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleKeyDown = (e) => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!navKeys.includes(e.key)) return;
    if (isResetModalOpen) return;

    const all = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
    const i = all.indexOf(e.target);
    if (i === -1) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter') { 
      e.preventDefault(); if(i < all.length - 1) all[i+1].focus(); 
    } else if (e.key === 'ArrowUp' || e.key === 'Tab') { 
      e.preventDefault(); if(i > 0) all[i-1].focus(); 
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const row = e.target.closest('.nav-row, .grid');
      if (!row) return;
      const rowEls = Array.from(row.querySelectorAll('input, select, button'));
      const ri = rowEls.indexOf(e.target);
      if (e.key === 'ArrowLeft' && ri > 0) { e.preventDefault(); rowEls[ri-1].focus(); }
      else if (e.key === 'ArrowRight' && ri < rowEls.length-1) { e.preventDefault(); rowEls[ri+1].focus(); }
    }
  };

  const handleUpdate = (id, field, value) => {
    let targetName = null;
    const syncFields = ['isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    
    if (syncFields.includes(field) && field !== 'name') {
      const findNode = (n) => {
        if (n.id === id) targetName = n.name;
        if (!targetName && n.heirs) n.heirs.forEach(findNode);
      };
      findNode(tree);
      
      // 자기 자신이 아닌 동명이인이 있는지 검사
      let hasSameName = false;
      const countSameName = (n) => {
        if (n.id !== id && n.name === targetName && n.name.trim() !== '') hasSameName = true;
        if (!hasSameName && n.heirs) n.heirs.forEach(countSameName);
      };
      if (targetName && targetName.trim() !== '') countSameName(tree);

      if (hasSameName) {
        setSyncRequest({ id, name: targetName, field, value });
        return; // 팝업에서 승인/거절할 때까지 실제 업데이트 보류
      }
    }

    // 동기화 필요 없는 일반 업데이트
    applyUpdate(id, field, value, false);
  };

  const applyUpdate = (id, field, value, syncGlobal = false, syncName = '') => {
    const updateNode = (n) => {
      if (n.id === id || (syncGlobal && n.name === syncName && n.name.trim() !== '')) {
         return { ...n, [field]: value };
      }
      return { ...n, heirs: n.heirs?.map(updateNode) || [] };
    };
    setTree(prev => updateNode(prev));
  };

  const handleSyncConfirm = (shouldSync) => {
    if (!syncRequest) return;
    applyUpdate(syncRequest.id, syncRequest.field, syncRequest.value, shouldSync, syncRequest.name);
    setSyncRequest(null);
  };

  const handleRootUpdate = (field, value) => {
    setTree(prev => ({ ...prev, [field]: value }));
  };

  const addHeir = (parentId) => {
    const newHeir = { id: `h_${Date.now()}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] };
    const addFn = (n) => {
      if (n.id === parentId) return { ...n, heirs: [...(n.heirs || []), newHeir] };
      return { ...n, heirs: n.heirs?.map(addFn) || [] };
    };
    setTree(prev => addFn(prev));
  };

  const removeHeir = (id) => {
    const rmFn = (n) => ({ ...n, heirs: n.heirs?.filter(x => x.id !== id).map(rmFn) || [] });
    setTree(prev => rmFn(prev));
  };



  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { finalShares, calcSteps } = useMemo(() => {
    return calculateInheritance(tree, propertyValue);
  }, [tree, propertyValue]);

  const moveHeir = (activeId, overId) => {
    setTree(prev => {
      const newTree = JSON.parse(JSON.stringify(prev));
      const reorderList = (list) => {
        if (!list) return false;
        const activeIdx = list.findIndex(item => item.id === activeId);
        const overIdx = list.findIndex(item => item.id === overId);
        if (activeIdx !== -1 && overIdx !== -1) {
          const [movedItem] = list.splice(activeIdx, 1);
          list.splice(overIdx, 0, movedItem);
          return true;
        }
        for (let item of list) {
          if (item.heirs && item.heirs.length > 0) {
            if (reorderList(item.heirs)) return true;
          }
        }
        return false;
      };
      reorderList(newTree.heirs);
      return newTree;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveHeir(active.id, over.id);
    }
  };



  const handlePrint = () => {
    if (activeTab === 'input') {
      alert('보고서 탭(가계도, 계산표, 요약표) 중 하나를 선택한 후 인쇄해주세요.');
      return;
    }
    window.print();
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    a.download = `${safeCaseNo}_${safeName}_상속지분계산_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.id === 'root') {
          setTree(data);
          setActiveTab('calc'); 
        }
      } catch (err) { alert('유효하지 않은 파일입니다.'); }
    };
    reader.readAsText(file);
  };

  const performReset = (withSave) => {
    if (withSave) saveFile();
    setTree(getEmptyTree());
    setActiveTab('input');
    setIsResetModalOpen(false);
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col items-center pb-24">
      
      <div id="print-footer" className="hidden print:block fixed bottom-0 right-0 font-['Dancing_Script'] text-slate-300 text-sm">
        Designed by J.H. Lee
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center no-print">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2 text-[#37352f]">새 작업 시작</h2>
            <p className="text-[14px] text-[#787774] mb-6">현재 작성 중인 모든 데이터가 삭제됩니다.<br/>어떻게 처리할까요?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => performReset(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">백업 저장 후 초기화</button>
              <button onClick={() => performReset(false)} className="w-full py-2.5 bg-[#ffe2dd] hover:bg-[#ffc1b8] text-[#d44c47] font-medium rounded transition-colors text-[14px]">저장 없이 그냥 초기화</button>
              <button onClick={() => setIsResetModalOpen(false)} className="w-full py-2.5 mt-2 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">취소</button>
            </div>
          </div>
        </div>
      )}

      {syncRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2 text-[#37352f]">동일 인물 정보 동기화</h2>
            <p className="text-[14px] text-[#787774] mb-6">
              <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 정보를 변경하셨습니다.<br/>
              가계도 내의 다른 <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 동일 정보도 같이 수정할까요?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSyncConfirm(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">예, 모두 동기화합니다</button>
              <button onClick={() => handleSyncConfirm(false)} className="w-full py-2.5 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">아니요, 현재 인물만 수정합니다</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-[#e9e9e7] h-[76px] sticky top-0 z-50 no-print w-full flex justify-center shadow-sm">
        <div className="w-full max-w-[1200px] px-6 flex items-center justify-between h-full">
          <div className="flex items-baseline">
            <div className="flex items-center text-[#37352f] font-bold text-[20px] tracking-tight">
              <IconCalculator className="w-6 h-6 mr-2 text-[#787774]" />
              상속지분 계산기 PRO
            </div>
            <span className="designer-sign text-[#a3a3a3] ml-3 text-[17px]">Designed by J.H. Lee</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-2 bg-[#f7f7f5] px-3 py-1.5 rounded border border-[#e9e9e7] mr-3">
              <span className="text-[12px] font-bold text-[#787774]">사건: <span className="text-[#37352f]">{tree.caseNo || '미입력'}</span></span>
              <div className="w-px h-3 bg-[#d4d4d4] mx-1"></div>
              <span className="text-[12px] font-bold text-[#787774]">피상속인:</span>
              <span className="text-[14px] font-black text-[#0b6e99]">{tree.name || '미입력'}</span>
            </div>

            <button onClick={() => setIsResetModalOpen(true)} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-3 py-1.5 rounded border border-transparent hover:border-[#d4d4d4] text-[13px] font-bold transition-colors flex items-center gap-1.5">
              <IconReset className="h-4 w-4" /> 초기화
            </button>
            <div className="w-px h-4 bg-[#e9e9e7] mx-1"></div>
            <label className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-3 py-1.5 rounded border border-transparent hover:border-[#d4d4d4] text-[13px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer">
              <IconFolderOpen className="h-4 w-4" /> 불러오기<input type="file" accept=".json" onChange={loadFile} className="hidden" />
            </label>
            <button onClick={saveFile} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-3 py-1.5 rounded border border-transparent hover:border-[#d4d4d4] text-[13px] font-bold transition-colors flex items-center gap-1.5">
              <IconSave className="h-4 w-4" /> 저장
            </button>
            <div className="w-px h-4 bg-[#e9e9e7] mx-1"></div>
            <button onClick={handlePrint} className="text-white bg-[#2383e2] hover:bg-[#0073ea] px-3 py-1.5 rounded text-[13px] font-bold transition-colors flex items-center gap-1.5 shadow-sm">
              <IconPrinter className="h-4 w-4" /> 현재 탭 인쇄
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full max-w-[1200px] mx-auto px-6 mt-6 print-compact">
        <div className="flex items-end pl-6 gap-1.5 no-print relative z-10">
          {tabData.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} 
                className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] flex items-center gap-2 transition-all relative cursor-pointer border-2 border-b-0 ${
                  isActive
                    ? `bg-white ${t.style.activeBorder} ${t.style.activeText} pb-3 top-[2px] z-20`
                    : `${t.style.inactiveBg} ${t.style.inactiveBorder} ${t.style.inactiveText} pb-2.5 top-[1px] z-10 hover:brightness-95`
                }`}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
        <div className={`border-2 rounded-xl shadow-sm print-compact print:border-none print:shadow-none min-h-[500px] bg-white flex flex-col ${activeStyle.activeBorder} p-10 relative z-0 print-p-0`}>
          
          {activeTab !== 'input' && (
            <div className="hidden print:flex justify-between items-end mb-8 border-b-2 border-[#37352f] pb-4">
              <div>
                <h1 className="text-3xl font-bold text-[#37352f] mb-4">
                  {activeTab === 'tree' ? '상 속 인 관 계 표' : activeTab === 'calc' ? '상 속 분 계 산 표' : '최 종 상 속 지 분 요 약'}
                </h1>
                <div className="flex items-center gap-6 text-[15px] text-[#37352f]">
                  <span><strong className="font-semibold">사건번호:</strong> {tree.caseNo}</span>
                  <span><strong className="font-semibold">피상속인:</strong> <span className="font-bold">{tree.name}</span></span>
                </div>
              </div>
              {activeTab === 'summary' && isAmountActive && propertyValue > 0 && (
                <div className="text-right">
                   <span className="text-[14px] font-bold text-[#504f4c] mr-2">총 상속재산:</span>
                   <span className="text-[20px] font-black text-[#0b6e99]">{formatMoney(propertyValue)} 원</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'input' && (
            <div className="no-print space-y-6">
              <div className="bg-white border border-[#d4d4d4] rounded-md p-6 shadow-sm">
                <div className="text-[15px] font-bold text-[#37352f] mb-4 flex items-center gap-2 border-b border-[#e9e9e7] pb-3">
                  <IconFileText className="w-4 h-4"/> 기본정보 입력
                </div>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[13px] text-[#504f4c] mb-1.5 font-bold">사건번호</label>
                    <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-full border border-[#cccccc] rounded p-2 text-[15px] font-bold focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#504f4c] mb-1.5 font-bold">피상속인 성명</label>
                    <input type="text" onKeyDown={handleKeyDown} value={tree.name} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-full border border-[#cccccc] rounded p-2 text-[15px] font-black text-[#0b6e99] focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#c93f3a] mb-1.5 font-bold">사망일자</label>
                    <DateInput value={tree.deathDate} onKeyDown={handleKeyDown} onChange={v=>handleRootUpdate('deathDate',v)} className="w-full border border-[#cccccc] rounded p-2 text-[15px] font-bold focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#0284c7] mb-1.5 font-bold">호주 여부</label>
                    <label className={`flex items-center gap-1.5 px-3 py-2 h-[42px] rounded border cursor-pointer transition-colors shadow-sm select-none ${tree.isHoju !== false ? 'bg-[#e0f2fe] border-[#bae6fd] text-[#0369a1]' : 'bg-white border-[#cccccc] text-[#787774] hover:bg-[#f1f1ef]'}`}>
                      <input type="checkbox" checked={tree.isHoju !== false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0284c7]" />
                      <span className="text-[14px] font-bold">호주였음</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#504f4c] mb-1.5 font-bold">피상속인 지분</label>
                    <div className="flex items-center gap-2">
                       <div className="flex flex-1">
                        <input type="number" min="1" onKeyDown={handleKeyDown} value={tree.shareD} onChange={e=>handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value)||1))} title="분모" className="w-full border border-[#cccccc] rounded p-2 text-[16px] text-center font-bold focus:bg-white transition-all shadow-sm" />
                       </div>
                       <span className="text-[#787774] font-black text-[14px] select-none shrink-0">분의</span>
                       <div className="flex flex-1">
                        <input type="number" min="1" max={tree.shareD} onKeyDown={handleKeyDown} value={tree.shareN} onChange={e=>handleRootUpdate('shareN', Math.min(tree.shareD, Math.max(1, parseInt(e.target.value)||1)))} title="분자" className="w-full border border-[#cccccc] rounded p-2 text-[16px] text-center font-bold focus:bg-white transition-all shadow-sm" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#d4d4d4] rounded-md p-6 shadow-sm">
                <div className="flex justify-between border-b border-[#e9e9e7] pb-4 mb-4 items-center">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[15px] font-bold text-[#37352f] flex items-center gap-2"><IconUserPlus className="w-4 h-4"/> 1순위 상속인 명단</h2>
                    <button onClick={() => { setInputToggleSignal(prev => isInputAllExpanded ? -(Math.abs(prev)+1) : Math.abs(prev)+1); setIsInputAllExpanded(!isInputAllExpanded); }} className="px-3 py-1 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#504f4c] rounded transition-colors text-[12px] font-bold shadow-sm whitespace-nowrap">
                      {isInputAllExpanded ? '모두 접기' : '모두 펼치기'}
                    </button>
                  </div>
                  <button type="button" onClick={() => addHeir('root')} className="text-[#504f4c] border border-[#d4d4d4] hover:text-[#37352f] hover:bg-[#efefed] px-3 py-1.5 rounded text-[13px] font-bold transition-colors flex items-center gap-1 shadow-sm">
                    + {tree.name ? `${tree.name}의 상속인 추가` : '상속인 추가'}
                  </button>
                </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={tree.heirs.map(h => h.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {tree.heirs.map(h => <HeirRow key={h.id} node={h} level={1} handleUpdate={handleUpdate} removeHeir={removeHeir} addHeir={addHeir} siblings={tree.heirs} inheritedDate={tree.deathDate} onKeyDown={handleKeyDown} toggleSignal={inputToggleSignal} rootIsHoju={tree.isHoju !== false} />)}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
          )}

          {activeTab === 'tree' && (
            <div className="py-2 flex flex-col h-full">
              <div className="mb-5 p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] rounded-lg text-[14px] font-semibold flex justify-between items-center shadow-sm no-print">
                <div className="flex items-center gap-2">
                  <IconNetwork className="w-5 h-5 shrink-0" />
                  <span>사람 이름을 클릭하면 해당 인물의 상속인(배우자/자녀)을 접거나 펼쳐서 관계도를 직관적으로 확인할 수 있습니다.</span>
                </div>
                <button onClick={() => { setTreeToggleSignal(prev => isAllExpanded ? -(Math.abs(prev)+1) : Math.abs(prev)+1); setIsAllExpanded(!isAllExpanded); }} className="px-4 py-1.5 bg-white border border-[#bbf7d0] hover:bg-[#dcfce7] text-[#166534] rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap">
                  {isAllExpanded ? '모두 접기' : '모두 펼치기'}
                </button>
              </div>
              <div className="bg-[#fafafa] p-6 rounded-xl border border-[#e9e9e7] shadow-inner overflow-hidden">
                <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
              </div>
            </div>
          )}

          {activeTab === 'calc' && (
            <div className="flex flex-col h-full">
              <div className="space-y-6 print-mt-4">
                {calcSteps.map((s, i) => (
                  <div key={i} className="break-inside-avoid">
                    <div className="bg-white/80 border-y border-[#d4d4d4] px-4 py-2 flex justify-between items-center print-table-top">
                      <div className="flex items-center gap-3">
                        <span className="text-[16px] font-bold text-[#37352f]">
                          피상속인 <span className="text-[#0b6e99] font-black mx-1">{s.dec.name}</span> 
                          <span className="ml-2 font-medium text-[#787774] text-[14px]">[피상속지분: {s.inN}/{s.inD}]</span>
                        </span>
                        <span className="text-[#c93f3a] font-bold text-[14px]">({s.dec.deathDate} 사망)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.dec.id === 'root' ? (
                          <>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[#504f4c] font-bold text-[13px] hover:text-[#37352f] select-none no-print">
                              <input type="checkbox" checked={isAmountActive} onChange={(e) => { setIsAmountActive(e.target.checked); if (!e.target.checked) setPropertyValue(''); }} className="w-4 h-4 cursor-pointer accent-[#2383e2]" />
                              금액 계산
                            </label>
                            {isAmountActive && (
                              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-[#cccccc] shadow-sm focus-within:border-[#2383e2] transition-all no-print animate-in fade-in zoom-in duration-200">
                                <span className="text-[13px] font-bold text-[#504f4c]">총 상속재산</span>
                                <input type="text" value={formatMoney(propertyValue)} onChange={(e) => setPropertyValue(e.target.value.replace(/[^0-9]/g, ''))} onFocus={e => e.target.select()} className="w-52 px-2 text-right text-[15px] font-black text-[#0b6e99] outline-none bg-transparent" placeholder="0" />
                                <span className="text-[13px] font-bold text-[#504f4c]">원</span>
                                {propertyValue && <button onClick={() => setPropertyValue('')} className="text-[#a3a3a3] hover:text-[#c93f3a] transition-colors ml-1 p-0.5 rounded-full"><IconXCircle className="w-4 h-4" /></button>}
                              </div>
                            )}
                            {isAmountActive && propertyValue > 0 && (
                              <div className="hidden print:flex items-center gap-2">
                                <span className="text-[14px] font-bold text-[#504f4c]">총 상속재산:</span>
                                <span className="text-[16px] font-black text-[#0b6e99]">{formatMoney(propertyValue)} 원</span>
                              </div>
                            )}
                          </>
                        ) : (
                          isAmountActive && propertyValue > 0 && (
                            <div className="flex items-center gap-2 bg-black/5 px-3 py-1 rounded border border-[#d4d4d4]">
                              <span className="text-[13px] font-bold text-[#504f4c]">승계 대상 금액</span>
                              <span className="text-[15px] font-black text-[#37352f]">{formatMoney(Math.floor((Number(propertyValue) * s.inN) / s.inD))}</span>
                              <span className="text-[13px] font-bold text-[#504f4c]">원</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    <table className="w-full print-table text-[15px] table-fixed">
                      <tbody>
                        {s.dists.map((d, di) => {
                          const amount = propertyValue && d.n > 0 ? Math.floor((Number(propertyValue) * d.n) / d.d) : 0;
                          return (
                            <tr key={di} className="border-b border-[#d4d4d4] print:border-[#d4d4d4]">
                              <td className="w-[120px] py-1.5 pl-4 font-bold text-[16px] text-[#0b6e99]">{d.h.name}</td>
                              <td className="w-[70px] py-1.5 text-[15px] font-semibold text-[#504f4c]">{relStr[d.h.relation] || '자녀'}</td>
                              <td className="w-[480px] py-1.5 text-[#37352f]">
                                <div className="grid grid-cols-[70px_160px_1fr] items-center gap-2 w-full">
                                  {d.ex ? (
                                    <div className="col-span-3 flex justify-start">
                                      <span className="text-[#c93f3a] text-[13px] font-bold bg-white/50 px-1.5 py-0.5 rounded border border-[#f0c0b9]">{d.ex}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[16px] text-[#37352f] text-right pr-2">{d.n} / {d.d}</span>
                                      <span className="text-[14px] text-[#787774] font-medium whitespace-nowrap">(= {s.inN}/{s.inD} × {d.sn}/{d.sd})</span>
                                      <div className="flex justify-start">
                                        {d.mod && (
                                          <span className={`text-[13px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                                            d.mod.includes('호주') ? 'text-[#1d4ed8] bg-[#bfdbfe] border-[#93c5fd]' :
                                            d.mod.includes('출가녀') ? 'text-[#b91c1c] bg-[#fee2e2] border-[#fecaca]' :
                                            d.mod.includes('가산') ? 'text-[#16a34a] bg-[#dcfce7] border-[#bbf7d0]' :
                                            d.mod.includes('처 감산') ? 'text-[#ea580c] bg-[#ffedd5] border-[#fed7aa]' :
                                            d.mod.includes('여자 감산') ? 'text-[#ea580c] bg-[#ffedd5] border-[#fed7aa]' :
                                            d.mod.includes('감산') ? 'text-[#b91c1c] bg-[#fee2e2] border-[#fecaca]' :
                                            'text-[#402c84] bg-[#f3f0ff] border-[#d9cfff]'
                                          }`}>
                                            ※ {d.mod}
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="w-[120px] py-1.5 text-left pl-4 text-[#c93f3a] text-[13px] font-bold whitespace-nowrap">{d.h.isDeceased ? `(${d.h.deathDate} 사망)` : ''}</td>
                              {isAmountActive && <td className="w-[300px] py-1.5 text-right pr-4">{!d.ex && <span className="font-black text-[16px] text-[#0b6e99]">{formatMoney(amount)}원</span>}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="flex flex-col h-full">
              <div className="mb-4 flex justify-end no-print">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#504f4c] font-bold text-[13px] hover:text-[#37352f] select-none">
                    <input type="checkbox" checked={isAmountActive} onChange={(e) => { setIsAmountActive(e.target.checked); if (!e.target.checked) setPropertyValue(''); }} className="w-4 h-4 cursor-pointer accent-[#2383e2]" />
                    금액 계산 활성화
                  </label>
                  {isAmountActive && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-[#cccccc] shadow-sm animate-in fade-in zoom-in duration-200">
                      <span className="text-[13px] font-bold text-[#504f4c]">총 상속재산</span>
                      <input type="text" value={formatMoney(propertyValue)} onChange={(e) => setPropertyValue(e.target.value.replace(/[^0-9]/g, ''))} className="w-60 px-2 text-right text-[15px] font-black text-[#0b6e99] outline-none bg-transparent" placeholder="금액 입력" />
                      <span className="text-[13px] font-bold text-[#504f4c]">원</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="print-mt-4 break-inside-avoid">
                <table className="w-full text-left print-table border border-[#d4d4d4]">
                  <thead>
                    <tr className="print-table-top text-[#37352f] text-[15px] font-bold bg-white/80">
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[20%]' : 'w-[30%]'} border-r border-[#d4d4d4]`}>상속인 성명</th>
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center border-r border-[#d4d4d4]`}>최종 지분 (통분 전)</th>
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center ${isAmountActive ? 'border-r border-[#d4d4d4]' : ''}`}>최종 지분 (통분 후)</th>
                      {isAmountActive && <th className="py-3 px-4 w-[30%] text-center">상속 금액</th>}
                    </tr>
                  </thead>
                  <tbody className="text-[#37352f]">
                    {finalShares.direct?.map((f, i) => (
                      <tr key={'d'+i} className="border-b border-[#d4d4d4]">
                        <td className="py-2.5 px-4 font-bold text-[16px] border-r border-[#d4d4d4] text-[#0b6e99] bg-white/50">{f.name}</td>
                        <td className="py-2.5 px-4 text-center border-r border-[#d4d4d4] font-bold text-[16px]">{f.n} / {f.d}</td>
                        <td className={`py-2.5 px-4 text-center font-bold text-[16px] ${isAmountActive ? 'border-r border-[#d4d4d4]' : ''}`}>{f.un} / {f.ud}</td>
                        {isAmountActive && <td className="py-2.5 px-4 text-right pr-6 font-black text-[16px] text-[#0b6e99] bg-[#eff6ff]">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                      </tr>
                    ))}
                    {finalShares.subGroups?.map((group, gIdx) => (
                      <React.Fragment key={'g'+gIdx}>
                        <tr className="border-b border-[#d4d4d4] bg-[#37352f]/5 print:bg-[#f1f1ef]">
                          <td colSpan={isAmountActive ? "4" : "3"} className="py-2.5 px-4 text-[14px] font-bold text-[#504f4c]">※ 공동상속인 중 [{group.ancestor.name}]은(는) {formatKorDate(group.ancestor.deathDate)} 사망하였으므로 상속인</td>
                        </tr>
                        {group.shares.map((f, i) => (
                          <tr key={'gs'+gIdx+'-'+i} className="border-b border-[#d4d4d4]">
                            <td className="py-2.5 px-4 font-bold pl-10 border-r border-[#d4d4d4] text-[#0b6e99]"><span className="text-[#a1a1aa] mr-2">└</span>{f.name}</td>
                            <td className="py-2.5 px-4 text-center border-r border-[#d4d4d4] font-bold">{f.n} / {f.d}</td>
                            <td className={`py-2.5 px-4 text-center font-bold ${isAmountActive ? 'border-r border-[#d4d4d4]' : ''}`}>{f.un} / {f.ud}</td>
                            {isAmountActive && <td className="py-2.5 px-4 text-right pr-6 font-black text-[#0b6e99] bg-[#eff6ff]">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div className="mt-8 text-[13px] text-[#787774] space-y-1 text-right font-medium">
                  <p>※ 본 계산서는 대습 및 순차 상속 법리를 기초로 산출되었습니다.</p>
                  <p>※ 상속 개시 시점(사망일)에 따른 1960년, 1979년, 1991년 개정 민법 비율이 자동 적용되었습니다.</p>
                  {isAmountActive && <p className="text-[#0b6e99] font-bold mt-2">※ 계산된 상속 금액은 원 단위 이하를 내림하여 표기하였습니다.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
