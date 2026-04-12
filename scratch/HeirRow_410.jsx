import React, { useState, useMemo } from 'react';
import { IconMenu, IconTrash2 } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, isBefore, getRelStr } from '../engine/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// ?뮕 finalShares ?꾨∼??異붽?
const HeirRow = ({ node, finalShares, handleUpdate, removeHeir, inheritedDate, rootDeathDate, onKeyDown, rootIsHoju, onTabClick, parentNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

  // ?뮕 ?ㅼ떆媛?怨꾩궛??吏遺??밴꺼?ㅺ린 (?붿쭊 ?곕룞)
  // finalShares.direct? subGroups ?꾩껜瑜??ㅼ졇????personId??留욌뒗 吏遺꾩쓣 李얠뒿?덈떎.
  const calcShare = useMemo(() => {
    if (!finalShares) return null;
    const direct = finalShares.direct.find(s => s.personId === node.personId);
    if (direct) return direct;

    for (const group of (finalShares.subGroups || [])) {
      const sub = group.shares.find(s => s.personId === node.personId);
      if (sub) return sub;
    }
    return null;
  }, [finalShares, node.personId]);

  // ?붿쭊 寃곌낵媛믪씠 ?덉쑝硫?洹멸구 蹂댁뿬二쇨퀬, ?놁쑝硫??몃뱶????λ맂 湲곕낯媛??몄텧
  const displayN = calcShare ? calcShare.n : (node.shareN || 0);
  const displayD = calcShare ? calcShare.d : (node.shareD || 1);

  // ?붿쭊??怨꾩궛??媛믪씤吏 ?먮퀎 (湲???됱긽 媛뺤“??
  const isAutoCalculated = !!calcShare;

  // ?뮕 Phase 2: ?고쁺 ?앹뾽李?Modal) ?곹깭 異붽?
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const lawEra = getLawEra(inheritedDate);
  const isSpouseType = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
  const isPreDeceasedCondition = node.isDeceased && node.deathDate && inheritedDate && isBefore(node.deathDate, inheritedDate);

  const isDaeseupContext = rootDeathDate && inheritedDate && inheritedDate !== rootDeathDate && isBefore(inheritedDate, rootDeathDate);
  const isDaeseupSpouse = isSpouseType && isDaeseupContext;

  const isToggleOff = node.isExcluded || false;

  let shouldShowTabBtn = false;
  let tabBtnText = '?ъ긽??쨩';
  let tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700 dark:hover:bg-blue-900/20";
  let onBtnClick = () => onTabClick && onTabClick(node.id);

  if (isToggleOff) {
    if (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified' || node.exclusionOption === 'remarried') {
      shouldShowTabBtn = true;
      tabBtnText = '??듭긽??쨩';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700 dark:hover:bg-emerald-900/20";
    } else if (isPreDeceasedCondition && ['son', 'daughter', 'sibling'].includes(node.relation)) {
      shouldShowTabBtn = true;
      tabBtnText = '??듭긽???낅젰 쨩';
      tabBtnClass = "bg-transparent text-neutral-400 border border-neutral-300 border-dashed hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 hover:border-solid dark:border-neutral-700";
      onBtnClick = () => {
        // ?뮕 ??뿉 洹몃깷 ?ㅼ뼱媛??寃껊쭔?쇰줈???ㅼ쐞移섎? 耳쒖? ?딆뒿?덈떎. (?먯쑀濡쒖슫 ?먯깋 ?덉슜)
        if (onTabClick) onTabClick(node.id);
      };
    }
  } else if (node.isDeceased) {
    if (isPreDeceasedCondition) {
      if (!isSpouseType) {
        shouldShowTabBtn = true;
        tabBtnText = '??듭긽??쨩';
        tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200 dark:border-neutral-700 dark:hover:bg-emerald-900/20";
      }
    } else {
      shouldShowTabBtn = true;
      tabBtnText = '?ъ긽??쨩';
      tabBtnClass = "bg-transparent text-[#787774] border border-[#e9e9e7] hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-200 dark:border-neutral-700 dark:hover:bg-blue-900/20";
    }
  }

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  // ?뮕 1. 遺紐??몃뱶???깅퀎 ?먮퀎 濡쒖쭅??癒쇱? ?뚯뼱?щ┰?덈떎.
  const isRootParent = parentNode?.id === 'root';
  const isParentFemale = !isRootParent && ['wife', 'daughter', 'mother', 'sister'].includes(parentNode?.relation);
  const isParentMale = !isRootParent && ['husband', 'son', 'father', 'brother'].includes(parentNode?.relation);

  // ?슚 2. ?듭떖 ?쎌뒪: ?꾩옱 ??쓽 ?쇱긽?띿씤??'?ъ꽦(泥?????'??寃쎌슦, ?먮???'?몄＜ 媛?? ?ㅼ쐞移섏? 諭껋?瑜??꾩쟾???④퉩?덈떎!
  const showHoju = node.relation === 'son' && lawEra !== '1991' && rootIsHoju !== false && !isParentFemale;
  const showMarriedDaughter = node.relation === 'daughter' && lawEra !== '1991';
  
  // ?뮕 ?낅젰???고쁺 ?곗씠?곌? ?덈뒗吏 ?뺤씤?섏뿬 踰꾪듉 ?됱긽 蹂寃?  const hasHistoryData = node.divorceDate || node.remarriageDate || node.marriageDate || node.restoreDate;

  return (
    <>
      <div 
        ref={setNodeRef} 
        style={dndStyle} 
        data-node-id={node.id} // ?뮕 異붽?: ?ㅻ쭏??媛?대뱶媛 ??醫뚰몴濡??대룞?⑸땲??        className="group/row flex items-center justify-start w-full pr-0 pl-0 py-2 mb-1 bg-white dark:bg-neutral-800 rounded-md border border-[#e5e5e5] dark:border-neutral-700 hover:bg-[#f8f8f7] dark:hover:bg-neutral-700/50 transition-colors relative"
      >
      
      {/* 0. ?쒕옒洹??몃뱾 */}
      <div {...attributes} {...listeners} className="w-5 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-400 transition-colors ml-[10px] shrink-0">
        <IconMenu className="w-4 h-4" />
      </div>

      {/* 1. ?곹깭 ?좉? */}
      <div className="ml-[20px] shrink-0 flex items-center">
        <button
          type="button"
          role="switch"
          aria-checked={!node.isExcluded}
          onClick={() => {
            const nextExcluded = !node.isExcluded;
            handleUpdate(node.id, {
              isExcluded: nextExcluded,
              exclusionOption: nextExcluded ? (isDaeseupSpouse ? 'remarried' : 'renounce') : ''
            });
          }}
          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-in-out focus:outline-none ${!node.isExcluded ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'}`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${!node.isExcluded ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* 2. ?깅챸 */}
      <div className="w-[72px] ml-[50px] shrink-0 flex items-center">
        <input 
          type="text" 
          value={node.name} 
          onKeyDown={onKeyDown} 
          onChange={e => handleUpdate(node.id, 'name', e.target.value)} 
          lang="ko"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full text-[15px] font-bold text-[#37352f] dark:text-slate-200 outline-none bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-amber-400" 
          placeholder="?깅챸"
        />
      </div>

      {/* 3. 愿怨?*/}
      <div className="w-[76px] ml-[30px] shrink-0">
        <select 
          value={node.relation}
          onChange={e => handleUpdate(node.id, 'relation', e.target.value)} 
          className="w-full text-[15px] font-normal text-[#787774] dark:text-neutral-400 bg-transparent outline-none cursor-pointer"
        >
          {/* ?뮕 遺紐④? ?ъ꽦?대㈃ '泥?瑜??④린怨? 遺紐④? ?⑥꽦?대㈃ '?⑦렪'???④퉩?덈떎! */}
          {(!isParentFemale) && <option value="wife">{lawEra === '1991' ? '諛곗슦?? : '泥?}</option>}
          {(!isParentMale) && <option value="husband">{lawEra === '1991' ? '諛곗슦?? : '?⑦렪'}</option>}
          <option value="son">{lawEra === '1991' ? '?먮?' : '?꾨뱾'}</option>
          <option value="daughter">{lawEra === '1991' ? '?먮?' : '??}</option>
          <option value="parent">吏곴퀎議댁냽</option>
          <option value="sibling">?뺤젣?먮ℓ</option>
        </select>
      </div>

      {/* 4. ?щ쭩?щ? 諛??쇱옄 (??긽 ?몄텧?섏뼱 ?섏젙 媛?? */}
      <div className="w-[150px] ml-[30px] shrink-0 flex items-center text-[15px]">
        <div className="flex items-center gap-2 w-full">
          <input
            type="checkbox"
            checked={node.isDeceased || false}
            onChange={(e) => handleUpdate({
              type: 'updateDeathInfo',
              nodeId: node.id,
              isDeceased: e.target.checked,
              deathDate: e.target.checked ? node.deathDate : '',
              inheritedDate,
            })}
            className="w-4 h-4 accent-neutral-500 cursor-pointer shrink-0 opacity-60"
          />
          {node.isDeceased ? (
            <DateInput
              value={node.deathDate}
              onKeyDown={onKeyDown}
              onChange={(v) => handleUpdate({
                type: 'updateDeathInfo',
                nodeId: node.id,
                deathDate: v,
                isDeceased: !!v,
                inheritedDate,
              })}
              className={`flex-1 text-[13px] font-bold outline-none bg-transparent ${isPreDeceasedCondition && !isSpouseType ? 'text-[#787774] dark:text-neutral-400' : 'text-[#37352f] dark:text-neutral-100'}`}
              placeholder="?щ쭩?쇱옄"
            />
          ) : (
            <span className="text-[13px] text-[#787774] font-medium">?앹〈</span>
          )}
        </div>
      </div>

      {/* 5. ?뱀닔議곌굔 (?쒕∼?ㅼ슫 OR 媛媛먯궛) - ?덉씠?꾩썐 遺꾨━ ?깃났! */}
      <div className="w-[180px] ml-[10px] shrink-0 flex items-center gap-1.5">
        {/* ... 以묐왂 (諛곗슦???몄＜/異쒓?? 濡쒖쭅 ?좎?) ... */}
        {isToggleOff && isSpouseType && isPreDeceasedCondition ? (
          <div className="w-[150px] h-[26px] shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">諛곗슦???좎궗留?(?곸냽沅??놁쓬)</span>
          </div>
        ) : isToggleOff ? (
          <div className="relative w-[150px] group/select bg-[#f8f8f7] dark:bg-neutral-800 px-2.5 py-1 rounded border border-[#e5e5e5] dark:border-neutral-700 hover:border-neutral-300 transition-colors">
            <select
              value={node.exclusionOption || 'renounce'}
              onChange={(e) => handleUpdate(node.id, 'exclusionOption', e.target.value)}
              className="w-full bg-transparent text-[13px] font-bold text-[#5d4037] dark:text-neutral-300 outline-none cursor-pointer appearance-none pr-5"
            >
              <option value="renounce">
                {node.heirs && node.heirs.length > 0 
                  ? (node.isDeceased ? '??듭긽??諛쒖깮' : '??듭긽???곸냽?ш린)')
                  : (isPreDeceasedCondition && !isSpouseType ? '??듭긽?띿씤 ?놁쓬' : (node.isDeceased ? '?곸냽???놁쓬 (吏遺??щ텇諛?' : '?곸냽?ш린'))
                }
              </option>
              <option value="disqualified">
                {node.heirs && node.heirs.length > 0 ? '?곸냽寃곌꺽 (??듭긽??' : '?곸냽寃곌꺽'}
              </option>
              {!isBefore(rootDeathDate, '2024-04-25') && (
                <option value="lost">
                  {node.heirs && node.heirs.length > 0 ? '?곸떎?좉퀬 (??듭긽??' : '?곸떎?좉퀬'}
                </option>
              )}
              {isDaeseupSpouse && <option value="remarried">???媛쒖떆 ???ы샎</option>}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <>
            {isSpouseType && (() => {
              let label = getRelStr(node.relation, inheritedDate || rootDeathDate);
              let multiplier = '';
              if (lawEra === '1960' && node.relation === 'wife') multiplier = 'x 1/2';
              else if (lawEra === '1979' && node.relation === 'wife') multiplier = 'x 1.5';
              else if (lawEra === '1991') multiplier = 'x 1.5';

              return (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-[64px] h-[26px] shrink-0 flex items-center justify-center bg-white dark:bg-neutral-800 rounded-full border border-[#e9e9e7] dark:border-neutral-700 shadow-sm">
                    <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{label}</span>
                  </div>
                  {multiplier && (
                    <span className="px-2 py-0.5 rounded-full border border-neutral-300 bg-white text-[10px] font-bold text-[#37352f] shadow-sm whitespace-nowrap">{multiplier}</span>
                  )}
                </div>
              );
            })()}

            {!isSpouseType && (
              <div className="flex items-center gap-1.5 shrink-0">
                {showHoju && (
                  <div className="flex items-center gap-1.5">
                    <div onClick={() => handleUpdate({ type: 'setHojuStatus', nodeId: node.id, isHoju: !node.isHoju })} className="relative flex items-center w-[64px] h-[26px] bg-[#efefed] dark:bg-neutral-900 rounded-full border border-[#e5e5e5] dark:border-neutral-700 p-0.5 cursor-pointer select-none">
                      <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] bg-white dark:bg-neutral-700 rounded-full shadow-sm border border-[#e5e5e5] dark:border-neutral-600 transition-transform duration-300 ${node.isHoju ? 'translate-x-[calc(100%-1px)]' : 'translate-x-0'}`} />
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${!node.isHoju ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>?쇰컲</div>
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isHoju ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>?몄＜</div>
                    </div>
                    {node.isHoju && <span className="px-2 py-0.5 rounded-full border border-sky-800/80 bg-white text-[10px] font-medium text-sky-800/80 shadow-sm whitespace-nowrap">x 1.5</span>}
                  </div>
                )}
                {showMarriedDaughter && (
                  <div className="flex items-center gap-1.5">
                    <div 
                      onClick={() => handleUpdate(node.id, 'isSameRegister', node.isSameRegister === false ? true : false)} 
                      className={`relative flex items-center w-[64px] h-[26px] rounded-full border p-0.5 cursor-pointer select-none transition-all ${node._isInferredRegister ? 'border-amber-400 bg-amber-50/30' : 'bg-[#efefed] dark:bg-neutral-900 border-[#e5e5e5] dark:border-neutral-700'}`}
                      title={node._isInferredRegister ? '?щ쭩???쇱씤???議곕줈 ?먮룞 ?ㅼ젙?? : '吏遺꾩쑉 寃곗젙???꾪븳 ?몄쟻 ?곹깭 ?좏깮'}
                    >
                      <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] bg-white dark:bg-neutral-700 rounded-full shadow-sm border border-[#e5e5e5] dark:border-neutral-600 transition-transform duration-300 ${node.isSameRegister === false ? 'translate-x-[calc(100%-1px)]' : 'translate-x-0'}`} />
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isSameRegister !== false ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>?숈씪</div>
                      <div className={`flex-1 text-center z-10 text-[11px] font-bold ${node.isSameRegister === false ? 'text-[#37352f]' : 'text-[#a3a3a3]'}`}>異쒓?{node._isInferredRegister && ' ??}</div>
                    </div>
                    {(() => {
                      let m = '';
                      if (lawEra === '1960') m = node.isSameRegister !== false ? 'x 1/2' : 'x 1/4';
                      else if (lawEra === '1979' && node.isSameRegister === false) m = 'x 1/4';
                      return m ? <span className="px-2 py-0.5 rounded-full border border-rose-800/80 bg-white text-[10px] font-medium text-rose-800/80 shadow-sm whitespace-nowrap">{m}</span> : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {((isSpouseType && inheritedDate !== rootDeathDate && !isPreDeceasedCondition) || node.relation === 'daughter') && (
          <button 
            onClick={() => setIsHistoryModalOpen(true)}
            className={`flex items-center justify-center shrink-0 w-[32px] h-[26px] rounded-md transition-colors border shadow-sm ${
              hasHistoryData 
                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' 
                : 'bg-white text-neutral-400 border-[#e9e9e7] hover:bg-[#f7f7f5] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-500'
            }`}
            title="?곸꽭 ?몄쟻 ?고쁺 (?댄샎, ?ы샎, 移쒓?蹂듭쟻 ?? ?낅젰"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* 6. ?ъ긽????듭긽??踰꾪듉 (洹쒖젙 蹂듦뎄: W 112px, ML 20px) */}
      <div className="w-[112px] ml-[20px] shrink-0 flex flex-col items-center justify-center gap-1">
        {/* ?뮕 吏遺??쒖떆??踰꾪듉 ?꾨굹 ?꾨옒??肄ㅽ뙥?명븯寃?諛곗튂 (?꾩껜 ?덈퉬 ?좎?) - ?쇱そ?쇰줈 10px ?대룞 */}
        {!node.isExcluded && !node.isDeceased && (
          <div className="flex items-center gap-0.5 text-[11px] font-black leading-none mb-0.5 ml-[-10px]">
            <span className={isAutoCalculated ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}>{displayN}</span>
            <span className="text-neutral-300 dark:text-neutral-600">/</span>
            <span className={isAutoCalculated ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}>{displayD}</span>
          </div>
        )}
        {shouldShowTabBtn && onTabClick && (
          <button
            type="button"
            onClick={onBtnClick}
            className={`w-full py-1 rounded-md font-bold text-[12px] shrink-0 border transition-all shadow-sm ${tabBtnClass}`}
          >
            {tabBtnText}
          </button>
        )}
      </div>

      {/* 7. ??젣 踰꾪듉 */}
      <div className="w-12 shrink-0 flex justify-center ml-[10px] mr-[20px]">
        <button
          type="button"
          onClick={() => removeHeir(node.id)}
          className="text-[#a3a3a3] hover:text-neutral-600 transition-colors p-1.5 rounded-md hover:bg-neutral-100 opacity-0 group-hover/row:opacity-100"
          title="??젣"
        >
          <IconTrash2 className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* ?뮕 誘몃땲硫由ъ쬁 ?꾨줈?섏뀛???뚮쭏 紐⑤떖李?*/}
    {isHistoryModalOpen && (
      <div className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center no-print backdrop-blur-[1px]">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-[360px] w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7] modal-content-container">
          
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[17px] font-bold flex items-center gap-1.5">
              <span className="text-black">'{node.name || '?곸냽??}'</span>
              <span className="text-neutral-400 font-medium">?몄쟻 ?고쁺</span>
            </h2>
            <button onClick={() => setIsHistoryModalOpen(false)} className="text-neutral-400 hover:text-neutral-700 p-1 transition-colors focus:ring-2 focus:ring-blue-500 rounded-full outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <p className="text-[12px] font-medium text-[#787774] mb-5 leading-relaxed bg-[#f8f8f7] p-3 rounded-lg border border-[#e9e9e7]">
            ?낅젰???좎쭨??<span className="font-bold text-[#37352f]">?쇱긽?띿씤 ?щ쭩??{inheritedDate || '誘몄긽'})</span>怨??議곕릺???곸냽沅?諛?吏遺??먮떒???먮룞 諛섏쁺?⑸땲??
          </p>

          <div className="modal-nav-area">
            {isSpouseType && (
              <div className="mb-5 p-4 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg relative">
                <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774] flex items-center gap-1">
                   ?곸냽沅?/ ??듭긽??李⑤떒 ?ъ쑀
                </div>
                <div className="space-y-3 mt-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-[#504f4c]">?댄샎 ?쇱옄</label>
                    <DateInput 
                      autoFocus
                      value={node.divorceDate || ''} 
                      onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { divorceDate: v } })} 
                      onKeyDown={e => {
                        if (e.key === ' ') { e.preventDefault(); setIsHistoryModalOpen(false); }
                        else if (e.key === 'Tab' || e.key === 'Enter' || e.key.includes('Arrow')) {
                          e.preventDefault();
                          const focusables = Array.from(e.currentTarget.closest('.modal-content-container').querySelectorAll('input, button:not([title="?リ린"])'));
                          const idx = focusables.indexOf(e.target);
                          const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
                          focusables[next].focus();
                        }
                      }}
                      className="w-[130px] border border-[#e5e5e5] rounded-md px-2.5 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-[#504f4c]">?ы샎 ?쇱옄</label>
                    <DateInput 
                      value={node.remarriageDate || ''} 
                      onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { remarriageDate: v } })} 
                      onKeyDown={e => {
                        if (e.key === ' ') { e.preventDefault(); setIsHistoryModalOpen(false); }
                        else if (e.key === 'Tab' || e.key === 'Enter' || e.key.includes('Arrow')) {
                          e.preventDefault();
                          const focusables = Array.from(e.currentTarget.closest('.modal-content-container').querySelectorAll('input, button:not([title="?リ린"])'));
                          const idx = focusables.indexOf(e.target);
                          const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
                          focusables[next].focus();
                        }
                      }}
                      className="w-[130px] border border-[#e5e5e5] rounded-md px-2.5 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            )}

            {node.relation === 'daughter' && (
              <div className="mb-6 p-4 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg relative">
                <div className="absolute -top-2.5 left-3 bg-white px-2 text-[11px] font-bold text-[#787774] flex items-center gap-1">
                   怨쇨굅 誘쇰쾿 吏遺꾩쑉 ?먮퀎 (??
                </div>
                        else if (e.key === 'Tab' || e.key === 'Enter' || e.key.includes('Arrow')) {
                          e.preventDefault();
                          const focusables = Array.from(e.currentTarget.closest('.modal-content-container').querySelectorAll('input, button:not([title="?リ린"])'));
                          const idx = focusables.indexOf(e.target);
                          const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
                          focusables[next].focus();
                        }
                      }}
                      className="w-[130px] border border-[#e5e5e5] rounded-md px-2.5 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-[#504f4c]">移쒓?蹂듭쟻 ?쇱옄</label>
                    <DateInput 
                      value={node.restoreDate || ''} 
                      onChange={v => handleUpdate({ type: 'updateHistoryInfo', nodeId: node.id, changes: { restoreDate: v } })} 
                      onKeyDown={e => {
                        if (e.key === ' ') { e.preventDefault(); setIsHistoryModalOpen(false); }
                        else if (e.key === 'Tab' || e.key === 'Enter' || e.key.includes('Arrow')) {
                          e.preventDefault();
                          const focusables = Array.from(e.currentTarget.closest('.modal-content-container').querySelectorAll('input, button:not([title="?リ린"])'));
                          const idx = focusables.indexOf(e.target);
                          const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
                          focusables[next].focus();
                        }
                      }}
                      className="w-[130px] border border-[#e5e5e5] rounded-md px-2.5 py-1.5 text-[13px] text-center font-medium bg-[#f8f8f7] focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsHistoryModalOpen(false)} 
            onKeyDown={e => {
              if (e.key === 'Tab' || e.key === 'Enter' || e.key.includes('Arrow')) {
                e.preventDefault();
                const focusables = Array.from(e.currentTarget.closest('.modal-content-container').querySelectorAll('input, button:not([title="?リ린"])'));
                const idx = focusables.indexOf(e.target);
                const next = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length : (idx + 1) % focusables.length;
                focusables[next].focus();
              }
            }}
            className="w-full py-2.5 bg-[#f1f1ef] hover:bg-[#e5e5e1] dark:bg-neutral-700 dark:hover:bg-neutral-600 text-[#37352f] dark:text-neutral-200 font-bold rounded-lg transition-colors text-[13px] shadow-sm flex items-center justify-center gap-2 mt-2 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            ?낅젰 ?꾨즺 諛??リ린
          </button>
        </div>
      </div>
    )}
  </>
);
};

export default HeirRow;
