import React, { useState, useEffect } from 'react';
import { IconChevronRight, IconTrash2, IconFileText, IconMenu } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore } from '../engine/utils';
import { getLevelStyle, getLineStyle } from '../utils/styles';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const HeirRow = ({ node, level, handleUpdate, removeHeir, addHeir, siblings, inheritedDate, onKeyDown, toggleSignal, rootIsHoju, showSubHeirs = true }) => {
  const isSp = node.relation === 'wife' || node.relation === 'husband';
  const isSon = node.relation === 'son';
  const isDaughter = node.relation === 'daughter';
  const isChild = node.relation === 'son' || node.relation === 'daughter';
  const canAutoFillSp = node.isDeceased && isSp && (!node.heirs || node.heirs.length === 0) && siblings?.filter(s => s.relation === 'son' || s.relation === 'daughter').length > 0;
  const canAutoFillChild = node.isDeceased && isChild && (!node.heirs || node.heirs.length === 0) && siblings?.filter(s => s.id !== node.id && (s.relation === 'son' || s.relation === 'daughter')).length > 0;
  const canAutoFill = canAutoFillSp || canAutoFillChild;

  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(false);
  }, [toggleSignal]);

  const lawEra = getLawEra(inheritedDate);
  const showHoju = isSon && lawEra !== '1991' && rootIsHoju !== false;
  const showMarriedDaughter = isDaughter && lawEra !== '1991';

  const hasOtherHoju = siblings?.some(s => s.id !== node.id && s.isHoju);

  let nextInheritedDate = inheritedDate;
  if (node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
    nextInheritedDate = node.deathDate;
  }

  let disqualificationReason = '';
  if (isSp && level > 1 && node.isRemarried && node.remarriageDate && inheritedDate && isBefore(node.remarriageDate, inheritedDate)) {
    disqualificationReason = `상속 개시(${inheritedDate}) 전 재혼: 대습상속권이 없습니다.`;
  } else if (node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate) && (!node.heirs || node.heirs.length === 0)) {
    disqualificationReason = `상속 개시(${inheritedDate}) 전 사망: 대습상속인이 없으므로 상속권이 없습니다.`;
  } else if (node.relation === 'husband' && level > 1 && lawEra !== '1991' && node.isSubstitution) {
    disqualificationReason = '1991년 1월 1일 이전 사위: 대습상속권이 없습니다.';
  }

  const autoFill = () => {
    const clone = (n) => ({ ...n, id: `auto_${Math.random().toString(36).substr(2,9)}`, heirs: n.heirs?.map(clone) || [] });
    if (canAutoFillSp) {
      const children = siblings.filter(s => s.relation === 'son' || s.relation === 'daughter');
      handleUpdate(node.id, 'heirs', children.map(clone));
    } else if (canAutoFillChild) {
      const siblingList = siblings
        .filter(s => s.id !== node.id && (s.relation === 'son' || s.relation === 'daughter'))
        .map(s => ({ ...clone(s), relation: 'sibling', heirs: [] }));
      handleUpdate(node.id, 'heirs', siblingList);
    }
  };

  const boxStyle = getLevelStyle(level);
  const lineStyle = getLineStyle(level);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative'
  };

  return (
    <div ref={setNodeRef} style={dndStyle} className={`mt-2 ${level > 1 ? `ml-8 pl-4 border-l-[3px] ${lineStyle}` : ''}`}>
      <div className={`${boxStyle} border rounded-md p-2.5 hover:shadow-sm transition-colors relative nav-row no-print group flex items-center`}>
        
        <div {...attributes} {...listeners} className="cursor-grab hover:text-[#2383e2] dark:hover:text-blue-400 text-[#d4d4d4] dark:text-slate-500 p-1 -ml-1.5 mr-0.5 flex items-center justify-center shrink-0 outline-none">
          <IconMenu className="w-5 h-5 pointer-events-none" />
        </div>

        <div className="w-7 flex justify-center shrink-0 mr-1">
          {node.isDeceased && showSubHeirs && (
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="text-[#787774] dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 p-1 rounded transition-colors" title={isExpanded ? "접기" : "펼치기"}>
              <IconChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          )}

        </div>

        <div className="flex items-center gap-2 flex-nowrap w-full">
          {/* 성명 */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden input-combo transition-colors">
            <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">성명</span>
            <input type="text" placeholder="성명" value={node.name} onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'name', e.target.value)} onFocus={e => e.target.select()} 
              className="w-24 px-3 py-1.5 text-[14px] font-bold text-[#0b6e99] dark:text-blue-400 outline-none bg-transparent" />
          </div>
          
          {/* 관계 */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden relative input-combo transition-colors">
            <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">관계</span>
            <select value={node.relation} onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
              className="w-24 px-3 py-1.5 text-[14px] font-semibold text-[#37352f] dark:text-slate-200 bg-transparent outline-none cursor-pointer appearance-none">
              <option value="wife" className="dark:bg-slate-800">처</option><option value="husband" className="dark:bg-slate-800">남편</option><option value="son" className="dark:bg-slate-800">아들</option><option value="daughter" className="dark:bg-slate-800">딸</option><option value="sibling" className="dark:bg-slate-800">형제자매</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#787774] dark:text-slate-400"><IconChevronRight className="w-4 h-4 rotate-90" /></div>
          </div>

          <div className="flex items-center gap-2 pl-1">
            {showHoju && (
              <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors select-none ${
                node.isHoju 
                  ? 'bg-[#bfdbfe] dark:bg-blue-900/40 border-[#93c5fd] dark:border-blue-800/50 text-[#1d4ed8] dark:text-blue-300 cursor-pointer' 
                  : hasOtherHoju 
                    ? 'bg-[#f1f1ef] dark:bg-slate-700/50 border-[#e9e9e7] dark:border-slate-600 text-[#a3a3a3] dark:text-slate-500 cursor-not-allowed opacity-70' 
                    : 'bg-white dark:bg-slate-800 border-[#cccccc] dark:border-slate-600 hover:bg-[#f1f1ef] dark:hover:bg-slate-700 text-[#787774] dark:text-slate-400 cursor-pointer'
              }`}>
                <input 
                  type="checkbox" 
                  checked={node.isHoju || false} 
                  disabled={hasOtherHoju && !node.isHoju}
                  onKeyDown={onKeyDown} 
                  onChange={e => handleUpdate(node.id, 'isHoju', e.target.checked)} 
                  className={`w-3.5 h-3.5 accent-[#0284c7] ${hasOtherHoju && !node.isHoju ? 'cursor-not-allowed grayscale' : 'cursor-pointer'}`} 
                />
                <span className="text-[13px] font-bold">호주</span>
              </label>
            )}
            
            {showMarriedDaughter && (
              <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors cursor-pointer select-none ${node.isSameRegister !== false ? 'bg-white dark:bg-slate-800 border-[#cccccc] dark:border-slate-600 text-[#504f4c] dark:text-slate-300' : 'bg-[#fff7ed] dark:bg-orange-900/20 border-[#fed7aa] dark:border-orange-800/40 text-[#c2410c] dark:text-orange-400'}`}>
                <input type="checkbox" checked={node.isSameRegister !== false} onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'isSameRegister', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#504f4c]" />
                <span className="text-[13px] font-bold">{node.isSameRegister !== false ? '동일가적' : '출가녀'}</span>
              </label>
            )}

            {showMarriedDaughter && node.isSameRegister === false && (
              <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden input-combo ml-1 transition-colors">
                <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">제적일</span>
                <DateInput value={node.marriageDate} onKeyDown={onKeyDown} onChange={v => handleUpdate(node.id, 'marriageDate', v)} className="w-28 px-3 py-1.5 text-[14px] font-semibold outline-none text-[#37352f] dark:text-slate-200 bg-transparent transition-colors" />
              </div>
            )}
          </div>

          <div className={`flex items-center rounded overflow-hidden transition-all ml-auto border ${node.isDeceased ? 'border-[#f0c0b9] dark:border-red-800/50 bg-[#ffe2dd]/30 dark:bg-red-900/10' : 'border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700'}`}>
            <label className="flex items-center px-2 py-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={node.isDeceased || false} onKeyDown={onKeyDown} onChange={e => {
                handleUpdate(node.id, 'isDeceased', e.target.checked);
                if (!e.target.checked) handleUpdate(node.id, 'deathDate', '');
              }} className="w-3.5 h-3.5 cursor-pointer accent-[#c93f3a]" />
            </label>
            
            {node.isDeceased && (
               <div className="flex items-center pr-3 group/death">
                 <DateInput value={node.deathDate} onKeyDown={onKeyDown} onChange={v => handleUpdate(node.id, 'deathDate', v)} placeholder="사망일자" className="w-[105px] px-1 py-1 text-[13.5px] font-bold outline-none text-[#c93f3a] dark:text-red-400 bg-transparent transition-colors text-center" />
                 <span className="text-[13px] font-bold text-[#c93f3a] dark:text-red-400 opacity-80">사망</span>
               </div>
            )}
            {!node.isDeceased && (
               <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-500 pr-3 opacity-60">사망</span>
            )}
          </div>

          {isSp && level > 1 && (
            <div className="flex gap-1 ml-1 shrink-0">
              <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors cursor-pointer select-none ${node.isRemarried ? 'bg-[#f1f1ef] dark:bg-slate-700 border-[#cccccc] dark:border-slate-600 text-[#504f4c] dark:text-slate-300' : 'bg-white dark:bg-slate-800 border-[#cccccc] dark:border-slate-600 hover:bg-[#f1f1ef] dark:hover:bg-slate-700 text-[#787774] dark:text-slate-400'}`}>
                <input type="checkbox" checked={node.isRemarried || false} onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'isRemarried', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#504f4c]" />
                <span className="text-[13px] font-bold">재혼</span>
              </label>
              {node.isRemarried && (
                <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden input-combo transition-colors">
                  <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">재혼일</span>
                  <DateInput value={node.remarriageDate} onKeyDown={onKeyDown} onChange={v => handleUpdate(node.id, 'remarriageDate', v)} className="w-28 px-3 py-1.5 text-[14px] font-semibold outline-none text-[#37352f] dark:text-slate-200 bg-transparent transition-colors" />
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={() => removeHeir(node.id)} onKeyDown={onKeyDown} className="text-[#d4d4d4] dark:text-slate-500 hover:text-[#c93f3a] dark:hover:text-red-400 p-1.5 ml-2 shrink-0 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="삭제">
          <IconTrash2 className="w-5 h-5" />
        </button>
      </div>

      {node.isDeceased && showSubHeirs && isExpanded && (
        <div className="mt-2 ml-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {canAutoFill && (
            <div className="mb-2 p-3 bg-[#f7f7f5] dark:bg-slate-700/50 border border-[#d4d4d4] dark:border-slate-600 rounded-md text-[13px] flex items-center justify-between no-print shadow-sm transition-colors">
              <span className="text-[#504f4c] dark:text-slate-300 font-semibold flex items-center gap-2"><IconFileText className="w-4 h-4"/>
                {canAutoFillSp ? '이 배우자의 상속인을 피상속인의 자녀에서 복사하시겠습니까?' : `${node.name || '이 자녀'}의 상속인을 형제자매 목록에서 복사하시겠습니까?`}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => addHeir(node.id)} className="px-3 py-1 bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 text-[#37352f] dark:text-slate-200 font-semibold rounded hover:bg-[#f1f1ef] dark:hover:bg-slate-700 transition-colors">직접입력</button>
                <button type="button" onClick={autoFill} className="px-3 py-1 bg-[#37352f] dark:bg-blue-600 text-white font-semibold rounded hover:bg-[#2f2d27] dark:hover:bg-blue-700 transition-colors">자동불러오기</button>
              </div>
            </div>
          )}

          {disqualificationReason ? (
            <div className="px-3 py-2 mt-2 bg-[#fee2e2] dark:bg-red-900/40 border border-[#fecaca] dark:border-red-800/50 text-[#b91c1c] dark:text-red-300 text-[13px] font-bold rounded flex items-center gap-2 transition-colors">
              ⚠️ {disqualificationReason}
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-1 mt-2 no-print">
                <span className="text-[13px] font-bold text-[#787774] dark:text-slate-400 flex items-center pl-2">
                  <IconChevronRight className="h-4 w-4 mr-1" /> 대습/순차 상속인
                </span>
                {!canAutoFill && (
                  <button type="button" onClick={() => addHeir(node.id)} onKeyDown={onKeyDown} className="text-[13px] text-[#504f4c] dark:text-slate-300 font-semibold hover:bg-[#e9e9e7] dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors flex items-center border border-transparent hover:border-[#cccccc] dark:hover:border-slate-600">
                    + {node.name ? `${node.name}의 상속인 추가` : '상속인 추가'}
                  </button>
                )}
              </div>
              {node.heirs?.length > 0 && (
                <SortableContext items={node.heirs.map(h => h.id)} strategy={verticalListSortingStrategy}>
                  {node.heirs.map(h => (
                    <HeirRow 
                      key={h.id} 
                      node={h} 
                      level={level+1} 
                      handleUpdate={handleUpdate} 
                      removeHeir={removeHeir} 
                      addHeir={addHeir} 
                      siblings={node.heirs} 
                      inheritedDate={nextInheritedDate} 
                      onKeyDown={onKeyDown} 
                      toggleSignal={toggleSignal} 
                      rootIsHoju={rootIsHoju}
                    />
                  ))}
                </SortableContext>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HeirRow;
