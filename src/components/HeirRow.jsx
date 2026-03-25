import React, { useState, useEffect } from 'react';
import { IconChevronRight, IconTrash2, IconFileText, IconMenu } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore } from '../engine/utils';
import { getLevelStyle, getLineStyle } from '../utils/styles';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const HeirRow = ({ node, level, handleUpdate, removeHeir, addHeir, siblings, inheritedDate, onKeyDown, toggleSignal, rootIsHoju, showSubHeirs = true, isRootChildren, onTabClick }) => {
  const isSp = node.relation === 'wife' || node.relation === 'husband';
  const isSon = node.relation === 'son';
  const isDaughter = node.relation === 'daughter';
  const isChild = node.relation === 'son' || node.relation === 'daughter';
  const lawEra = getLawEra(inheritedDate);


  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(false);
  }, [toggleSignal]);

  const showHoju = isSon && lawEra !== '1991' && rootIsHoju !== false;
  const showMarriedDaughter = isDaughter && lawEra !== '1991';

  const hasOtherHoju = siblings?.some(s => s.id !== node.id && s.isHoju);

  let nextInheritedDate = inheritedDate;
  if (node.isDeceased && node.deathDate && !isBefore(node.deathDate, inheritedDate)) {
    nextInheritedDate = node.deathDate;
  }

  let disqualificationReason = '';
  if (isSp && isRootChildren && node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate)) {
    disqualificationReason = `피상속인보다 먼저 사망 (상속권 없음)`;
  } else if (isSp && !isRootChildren && node.isRemarried && node.remarriageDate && inheritedDate && isBefore(node.remarriageDate, inheritedDate)) {
    disqualificationReason = `상속 개시(${inheritedDate}) 전 재혼 (대습불가)`;
  } else if (node.relation === 'husband' && level > 1 && lawEra !== '1991' && node.isSubstitution) {
    disqualificationReason = '1991년 이전 사위 (대습불가)';
  }

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
      {/* 전체 행: [화살표(바깥)] + [슬롯 박스] */}
      <div className="flex items-center gap-0 group">
        
        {/* ↕ 이동 화살표 - 슬롯 바깥 왼쪽, 호버 시 노출 */}
        <div {...attributes} {...listeners} className="cursor-grab text-[#d4d4d4] dark:text-neutral-600 hover:text-[#2383e2] dark:hover:text-blue-400 p-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 outline-none -mr-0.5" title="순서 이동">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
        </div>

        {/* 📦 슬롯 박스 본체 - 배경색 변경 로직 완전 삭제 (v1.5.0 기본 스타일 유지) */}
        <div className={`${boxStyle} border rounded-md px-2 py-1.5 hover:shadow-sm transition-all duration-300 relative nav-row no-print flex items-center flex-1 min-w-0`}>
          
          {/* 💡 전구 - 상속권 상태 반영 (배제되거나 자격 없을 시 OFF) */}
          <button 
            type="button" 
            onClick={() => handleUpdate(node.id, 'isExcluded', !node.isExcluded)}
            className={`p-1.5 rounded-full transition-all duration-300 shrink-0 mr-0.5 ${(!node.isExcluded && !disqualificationReason) ? 'text-[#eab308] hover:bg-[#fefce8] dark:hover:bg-yellow-900/20' : 'text-[#b0b0b0] dark:text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
            title={(!node.isExcluded && !disqualificationReason) ? "상속권 유지 (클릭 시 권리 배제)" : "상속권 배제됨 (클릭 시 권리 복구)"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M12 2.25a5.25 5.25 0 0 0-3.905 8.761 6.136 6.136 0 0 1 1.405 3.033v1.706a.75.75 0 0 0 .75.75h3.5a.75.75 0 0 0 .75-.75v-1.706a6.136 6.136 0 0 1 1.405-3.033A5.25 5.25 0 0 0 12 2.25ZM9.75 18.75a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z" />
              {/* ON 시 빛살 (상단 및 측면 5방향) */}
              {!node.isExcluded && !disqualificationReason && (
                <>
                  <line x1="12" y1="0" x2="12" y2="1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="19.5" y1="4.5" x2="18.65" y2="5.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="22" y1="11" x2="20.8" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="4.5" y1="4.5" x2="5.35" y2="5.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="2" y1="11" x2="3.2" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>

          {/* 🗑️ 휴지통 - 독립 버튼, 희미하게 상시 노출 */}
          <button type="button" onClick={() => removeHeir(node.id)} onKeyDown={onKeyDown} className="text-[#d4d4d4] dark:text-neutral-600 hover:text-[#c93f3a] dark:hover:text-red-400 p-1 rounded transition-colors shrink-0 mr-1" title="삭제">
            <IconTrash2 className="w-4 h-4" />
          </button>

          {/* ▶ 접기/펼치기 */}
          <div className="w-6 flex justify-center shrink-0 mr-1">
            {node.isDeceased && showSubHeirs && !disqualificationReason && (
              <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="text-[#787774] dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 p-0.5 rounded transition-colors" title={isExpanded ? "접기" : "펼치기"}>
                <IconChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>

          {/* 데이터 영역: 성명, 관계, 사망일, 뱃지, 재상속 등 */}
          <div className="flex items-center gap-2 flex-nowrap flex-1 min-w-0">
            {/* 성명 */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden input-combo transition-colors shrink-0">
              <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">성명</span>
              <input type="text" placeholder="이름" value={node.name} onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'name', e.target.value)} onFocus={e => e.target.select()} 
                className="w-20 px-2 py-1.5 text-[14px] font-bold text-[#0b6e99] dark:text-blue-400 outline-none bg-transparent" />
            </div>
            
            {/* 관계 */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden relative input-combo transition-colors shrink-0">
              <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-3 py-1.5 text-[13px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">관계</span>
              <select 
                value={lawEra === '1991' ? (node.relation === 'daughter' ? 'son' : (node.relation === 'husband' ? 'wife' : node.relation)) : node.relation}
                onKeyDown={onKeyDown} onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
                className="w-20 px-2 py-1.5 text-[14px] font-semibold text-[#37352f] dark:text-slate-200 bg-transparent outline-none cursor-pointer appearance-none">
                {lawEra === '1991' ? (
                  <>
                    <option value="wife" className="dark:bg-slate-800">배우자</option>
                    <option value="son" className="dark:bg-slate-800">자녀</option>
                  </>
                ) : (
                  <>
                    <option value="wife" className="dark:bg-slate-800">처</option>
                    <option value="husband" className="dark:bg-slate-800">남편</option>
                    <option value="son" className="dark:bg-slate-800">아들</option>
                    <option value="daughter" className="dark:bg-slate-800">딸</option>
                  </>
                )}
                <option value="parent" className="dark:bg-slate-800">직계존속</option>
                <option value="sibling" className="dark:bg-slate-800">형제자매</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#787774] dark:text-slate-400"><IconChevronRight className="w-4 h-4 rotate-90" /></div>
            </div>

            {/* 사망일/배제사유 - 행 중앙 배치 (ml-auto 제거) */}
            {node.isExcluded ? (
              <div className="flex items-center rounded overflow-hidden border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5 gap-1 shrink-0">
                 <span className="text-[13px] font-bold text-[#787774] dark:text-neutral-500 px-2 py-1 border-r border-[#e9e9e7] dark:border-neutral-700">배제</span>
                 <select 
                   value={node.exclusionOption || 'renounce'} 
                   onChange={e => handleUpdate(node.id, 'exclusionOption', e.target.value)}
                   className={`pl-2 pr-1 py-1 text-[13.5px] font-bold bg-transparent outline-none cursor-pointer appearance-none ${(!node.exclusionOption || node.exclusionOption === 'renounce') ? 'text-[#854d0e] dark:text-yellow-500' : 'text-[#1d4ed8] dark:text-blue-400'}`}
                 >
                   <option value="renounce" className="dark:bg-slate-800">상속포기</option>
                   {(!inheritedDate || !isBefore(inheritedDate, '2024-04-25')) && (
                      <option value="lost" className="dark:bg-slate-800">상속권 상실</option>
                   )}
                 </select>
                 <div className="pointer-events-none pr-1 flex items-center text-[#787774] dark:text-slate-400"><IconChevronRight className="w-3 h-3 rotate-90" /></div>
              </div>
            ) : (
              <div className={`flex items-center rounded overflow-hidden transition-all border shrink-0 ${node.isDeceased ? 'border-[#f0c0b9] dark:border-red-800/50 bg-white dark:bg-neutral-800/50' : 'border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700'}`}>
                <label className="flex items-center px-2 py-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={node.isDeceased || false} onKeyDown={onKeyDown} onChange={e => {
                    handleUpdate(node.id, 'isDeceased', e.target.checked);
                    if (!e.target.checked) handleUpdate(node.id, 'deathDate', '');
                  }} className="w-3.5 h-3.5 cursor-pointer accent-[#c93f3a]" />
                </label>
                
                {node.isDeceased && (
                   <div className="flex items-center pr-3 group/death">
                     <DateInput value={node.deathDate} onKeyDown={onKeyDown} onChange={v => handleUpdate(node.id, 'deathDate', v)} placeholder="사망일자" className="w-[105px] px-1 py-1 text-[13.5px] font-bold outline-none text-[#c93f3a] dark:text-red-400 bg-transparent transition-colors text-center" />
                     <span className="text-[13px] font-bold text-[#c93f3a] dark:text-red-400">사망</span>
                   </div>
                )}
                {!node.isDeceased && (
                   <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-500 pr-3 opacity-60">사망</span>
                )}
              </div>
            )}

            {/* 상태 뱃지 및 기능 버튼들 */}
            <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
              {node.isExcluded && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded border text-[12px] font-bold whitespace-nowrap ${(!node.exclusionOption || node.exclusionOption === 'renounce') ? 'bg-[#fefce8] dark:bg-yellow-900/20 border-[#fef08a] dark:border-yellow-700/50 text-[#854d0e] dark:text-yellow-500' : 'bg-[#eff6ff] dark:bg-blue-900/20 border-[#bfdbfe] dark:border-blue-700/50 text-[#1d4ed8] dark:text-blue-400'}`}>
                  {(!node.exclusionOption || node.exclusionOption === 'renounce') ? '🚫 대습사유 아님' : '🔄 대습상속'}
                </span>
              )}
              
              {!node.isExcluded && disqualificationReason && (
                <span className="flex items-center gap-1 px-2 py-1 rounded border bg-white dark:bg-neutral-800 border-[#f0c0b9] dark:border-red-800/50 text-[#c93f3a] dark:text-red-400 text-[12px] font-bold whitespace-nowrap transition-colors">
                  ⚠️ {disqualificationReason}
                </span>
              )}

              {showHoju && (
                <button
                  type="button"
                  onClick={() => !hasOtherHoju || node.isHoju ? handleUpdate(node.id, 'isHoju', !node.isHoju) : null}
                  onKeyDown={onKeyDown}
                  disabled={hasOtherHoju && !node.isHoju}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold transition-all select-none border ${
                    node.isHoju 
                      ? 'bg-[#eff6ff] dark:bg-blue-900/30 text-[#1d4ed8] dark:text-blue-300 border-[#bfdbfe] dark:border-blue-800/50 shadow-sm' 
                      : hasOtherHoju 
                        ? 'bg-[#f1f1ef] dark:bg-slate-700/50 text-[#a3a3a3] dark:text-slate-500 cursor-not-allowed border-dashed border-[#d4d4d4] dark:border-slate-600' 
                        : 'bg-white dark:bg-slate-800 text-[#787774] dark:text-slate-400 border-dashed border-[#cccccc] dark:border-slate-600 hover:border-[#2383e2] hover:text-[#2383e2] dark:hover:border-blue-400 dark:hover:text-blue-400 cursor-pointer'
                  }`}
                >
                  {node.isHoju ? '✦ 호주' : '호주'}
                </button>
              )}
              
              {showMarriedDaughter && (
                <button
                  type="button"
                  onClick={() => handleUpdate(node.id, 'isSameRegister', node.isSameRegister === false ? true : false)}
                  onKeyDown={onKeyDown}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold transition-all select-none cursor-pointer border ${
                    node.isSameRegister !== false
                      ? 'bg-[#ecfdf5] dark:bg-emerald-900/20 text-[#047857] dark:text-emerald-400 border-[#a7f3d0] dark:border-emerald-800/40 hover:border-[#059669]'
                      : 'bg-[#fff1f2] dark:bg-rose-900/20 text-[#be123e] dark:text-rose-400 border-[#fecdd3] dark:border-rose-800/40 shadow-sm hover:border-[#e11d48]'
                  }`}
                >
                  {node.isSameRegister !== false ? '동일가적' : '출가(제적)'}
                </button>
              )}

              {showMarriedDaughter && node.isSameRegister === false && (
                <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden input-combo transition-colors">
                  <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-2 py-1.5 text-[12px] border-r border-[#cccccc] dark:border-slate-600 transition-colors">제적일</span>
                  <DateInput value={node.marriageDate} onKeyDown={onKeyDown} onChange={v => handleUpdate(node.id, 'marriageDate', v)} className="w-[100px] px-2 py-1.5 text-[13px] font-semibold outline-none text-[#37352f] dark:text-slate-200 bg-transparent transition-colors" />
                </div>
              )}

              {isSp && level > 1 && (
                <div className="flex gap-1 shrink-0">
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

              {/* 재상속 버튼 - 행 내부 인라인 (바깥 포스트잇 제거) */}
              {node.isDeceased && onTabClick && !disqualificationReason && !node.isExcluded && (
<button 
                  type="button"
                  onClick={() => onTabClick(node.id)}
                  className="text-[13px] font-bold text-[#b45309] dark:text-amber-500 hover:text-[#92400e] bg-[#fffbeb] dark:bg-amber-900/40 hover:bg-[#fef3c7] dark:hover:bg-amber-900/60 border border-[#fde68a] dark:border-amber-700/50 px-2 py-1 rounded transition-all shadow-sm whitespace-nowrap"
                  title="대습상속 입력 탭으로 이동"
                >
                  재상속
                </button>
              )}
              {node.isExcluded && node.exclusionOption === 'lost' && onTabClick && (
                <button 
                  type="button"
                  onClick={() => onTabClick(node.id)}
                  className="text-[13px] font-bold text-[#1d4ed8] dark:text-blue-400 hover:text-[#1e3a8a] bg-[#eff6ff] dark:bg-blue-900/60 hover:bg-[#dbeafe] border border-[#bfdbfe] dark:border-blue-700/50 px-2 py-1 rounded transition-all shadow-sm whitespace-nowrap"
                  title="상속권 상실 대습상속 탭으로 이동"
                >
                  재상속
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {((node.isDeceased && showSubHeirs && isExpanded) || (node.isExcluded && node.exclusionOption === 'lost' && showSubHeirs && isExpanded)) && (
        <div className="mt-2 ml-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {(!disqualificationReason || disqualificationReason.includes('선사망')) && (node.exclusionOption !== 'renounce') && (
            <>
              <div className="flex justify-between items-center mb-1 mt-2 no-print">
                <span className="text-[13px] font-bold text-[#787774] dark:text-slate-400 flex items-center pl-2">
                  <IconChevronRight className="h-4 w-4 mr-1" /> 대습/순차 상속인
                </span>
                <div className="flex gap-2">
                  {node.heirs?.length > 0 && (
                    <button type="button" onClick={() => {
                      if(confirm('이 상속인의 하위 상속인 데이터를 모두 삭제하시겠습니까?')) {
                        handleUpdate(node.id, 'heirs', []);
                      }
                    }} className="text-[13px] text-[#c93f3a] dark:text-red-400 font-semibold hover:bg-[#ffe2dd]/50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors flex items-center border border-transparent hover:border-[#f0c0b9] dark:hover:border-red-800">
                      전부 삭제
                    </button>
                  )}
                  <button type="button" onClick={() => addHeir(node.id)} onKeyDown={onKeyDown} className="text-[13px] text-[#504f4c] dark:text-slate-300 font-semibold hover:bg-[#e9e9e7] dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors flex items-center border border-transparent hover:border-[#cccccc] dark:hover:border-slate-600">
                    + {node.name ? `${node.name}의 상속인 추가` : '상속인 추가'}
                  </button>
                </div>
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
                      showSubHeirs={showSubHeirs}
                      isRootChildren={isRootChildren}
                      onTabClick={onTabClick}
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
