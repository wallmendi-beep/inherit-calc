import React from 'react';

export default function SmartGuidePanel({
  showNavigator,
  setShowNavigator,
  navigatorWidth,
  handleNavigatorResizeMouseDown,
  hasActionItems,
  noSurvivors,
  activeTab,
  warnings,
  deceasedTabs,
  setActiveDeceasedTab,
  tree,
  smartGuides,
  hiddenGuideKeys,
  dismissGuide,
  showGlobalWarning,
  globalMismatchReasons,
  auditActionItems,
  repairHints,
  handleNavigate,
  showAutoCalcNotice,
  autoCalculatedNames,
}) {
  // 사이드바 구현을 위해 showNavigator가 false이더라도 렌더링을 유지하여 애니메이션 효과를 줄 수 있음
  // 하지만 여기서는 심플하게 조건부 렌더링을 유지하되 클래스로 애니메이션을 제어함

  const findParentTabId = (targetId) => {
    const findParentTab = (node, currentTabId) => {
      if (node.id === targetId) return currentTabId;
      if (node.heirs) {
        for (const heir of node.heirs) {
          const nextTabId = node.isDeceased && node.heirs.length > 0 ? node.id : currentTabId;
          const found = findParentTab(heir, nextTabId);
          if (found) return found;
        }
      }
      return null;
    };

    return findParentTab(tree, 'root');
  };

  const moveToGuideTarget = (guide) => {
    if (guide.targetTabId) {
      setActiveDeceasedTab(guide.targetTabId === tree.personId ? 'root' : guide.targetTabId);
      return;
    }

    if (guide.id) {
      const tabId = findParentTabId(guide.id);
      if (tabId) setActiveDeceasedTab(tabId);
    }
  };

  const visibleAuditActionItems = (auditActionItems || []).filter((item) =>
    (item.displayTargets || []).includes('guide')
  );

  return (
    <aside
      className={`fixed top-[73px] right-0 z-[100] h-[calc(100vh-73px)] bg-white dark:bg-neutral-800 border-l border-[#e9e9e7] dark:border-neutral-700 shadow-[-4px_0_20px_rgba(0,0,0,0.03)] transition-[transform,opacity] duration-300 transform no-print ${
        showNavigator ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
      }`}
      style={{ width: navigatorWidth }}
    >
      {/* 리사이즈 핸들 */}
      <div 
        onMouseDown={handleNavigatorResizeMouseDown}
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize z-50 hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors"
        title="드래그하여 너비 조절"
      />
      <div className="flex flex-col h-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0ef] dark:border-neutral-700 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${hasActionItems ? 'bg-blue-50 text-[#2383e2] dark:bg-blue-900/30' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700'}`}>
              <svg className="w-5 h-5 transition-transform duration-500 hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <span className="font-extrabold text-[16px] tracking-tight text-[#37352f] dark:text-neutral-100">스마트 가이드</span>
          </div>
          <button 
            onClick={() => setShowNavigator(false)} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-all active:scale-90"
            title="가이드 닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {noSurvivors && (
            <div className="p-5 text-center bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="text-[#b45309] dark:text-amber-500 font-black text-[15px] mb-1.5">상속인 부재</div>
              <div className="text-[#787774] dark:text-neutral-400 text-[12px] font-medium leading-relaxed leading-snug">
                모든 상속인이 제외 상태입니다.<br />다음 순위 상속인을 추가해 주세요.
              </div>
            </div>
          )}

          {!hasActionItems && !noSurvivors && (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-[#fcfcfb] dark:bg-neutral-800/30 rounded-2xl border border-dashed border-[#e9e9e7] dark:border-neutral-700">
              <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[#37352f] dark:text-neutral-300 font-bold text-[14px] mb-1">검증 완료</span>
              <span className="text-[#9b9a97] dark:text-neutral-500 text-[12px]">추가 확인 사항이 없습니다.</span>
            </div>
          )}

          {activeTab === 'input' && warnings.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-red-500 uppercase tracking-wider px-1">⚠️ 주의사항</div>
              {warnings.map((warning, index) => (
                <div
                  key={`w-${index}`}
                  onClick={() => {
                    if (warning.targetTabId && deceasedTabs.some((tab) => tab.id === warning.targetTabId)) {
                      setActiveDeceasedTab(warning.targetTabId);
                    } else if (warning.id) {
                      const tabId = findParentTabId(warning.id);
                      if (tabId) setActiveDeceasedTab(tabId);
                    }
                  }}
                  className={`flex items-start gap-3 p-3.5 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-800/20 transition-all duration-200 ${warning.id ? 'cursor-pointer hover:bg-red-100/60 dark:hover:bg-red-900/30 hover:scale-[1.01] hover:shadow-sm' : ''}`}
                >
                  <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">!</div>
                  <span className="flex-1 leading-snug text-red-700 dark:text-red-400 font-bold text-[13px]">{warning.text || warning}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'input' && visibleAuditActionItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-red-500 uppercase tracking-wider px-1">수정 필요 인물</div>
              {visibleAuditActionItems.map((item, index) => (
                <button
                  key={`a-${item.id || index}`}
                  onClick={() => handleNavigate(item.targetTabId || item.personId || item.id)}
                  className="w-full text-left flex items-start gap-3 bg-red-50/80 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200/50 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all hover:scale-[1.01]"
                >
                  <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">!</div>
                  <div className="flex-1">
                    <div className="leading-snug text-[#c93f3a] dark:text-red-400 font-bold text-[13px]">
                      {item.text}
                    </div>
                    {item.name && (
                      <div className="mt-1 text-[11px] text-red-500/80 dark:text-red-300/80 font-semibold">
                        대상: {item.name}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider px-1">📍 필수 확인</div>
              {smartGuides.filter(g => g.type === 'mandatory').map((guide, index) => (
                <button 
                  key={`m-${index}`} 
                  onClick={() => moveToGuideTarget(guide)} 
                  className="w-full text-left flex items-start gap-3 bg-blue-50/60 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/20 hover:bg-blue-100/80 dark:hover:bg-blue-900/20 transition-all group hover:scale-[1.01] hover:shadow-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 group-hover:rotate-12 transition-transform">✓</div>
                  <span className="flex-1 leading-snug text-[#37352f] dark:text-neutral-200 font-bold text-[13.5px]">{guide.text}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'input' && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#f0f0ef] dark:border-neutral-700">
              <div className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">💡 권고사항</div>
              {smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).map((guide, index) => (
                <div key={`r-${index}`} className="relative group mb-2">
                  <button 
                    onClick={() => moveToGuideTarget(guide)} 
                    className="w-full text-left flex items-start gap-3 bg-[#fbfbfb] dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-[#e9e9e7] dark:border-neutral-700 hover:bg-[#f2f2f0] dark:hover:bg-neutral-700/60 transition-all"
                  >
                    <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">?</div>
                    <span className="flex-1 leading-snug text-[#787774] dark:text-neutral-400 font-medium text-[13px] pr-6">{guide.text}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); dismissGuide(guide.uniqueKey); }} 
                    className="absolute top-3.5 right-3 p-1 text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full transition-all opacity-0 group-hover:opacity-100" 
                    title="숨기기"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {showGlobalWarning && (
            <div className="pt-2 border-t border-red-100 dark:border-red-900/30 space-y-3">
              <div className="text-[#e53e3e] dark:text-red-400 font-black text-[14px] px-1">지분 불일치 탐지</div>
              {globalMismatchReasons.length > 0 ? (
                <div className="space-y-2">
                  {globalMismatchReasons.map((reason, index) => (
                    <button 
                      key={index} 
                      onClick={() => reason.id ? handleNavigate(reason.id) : null} 
                      className="w-full text-left flex items-start gap-3 bg-red-50/80 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200/50 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all hover:scale-[1.01]"
                    >
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 animate-pulse">!</div>
                      <span className="flex-1 leading-snug text-[#c93f3a] dark:text-red-400 font-bold text-[13px]">{reason.text || reason}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-red-50/30 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/20 rounded-2xl">
                  <span className="text-[12.5px] text-[#787774] dark:text-neutral-400 font-bold leading-relaxed">지분 일부가 제외 처리되어 전체 합계가 부족합니다.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'input' && repairHints && repairHints.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-amber-100 dark:border-amber-900/20">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">수정 힌트</div>
              {repairHints.map((hint, index) => (
                <button
                  key={`hint-${hint.code}-${hint.personId || index}`}
                  onClick={() => hint.targetTabId ? handleNavigate(hint.targetTabId) : null}
                  className={`w-full text-left flex items-start gap-3 bg-amber-50/70 dark:bg-amber-900/10 p-3.5 rounded-2xl border border-amber-200/40 dark:border-amber-800/30 transition-all ${hint.targetTabId ? 'hover:bg-amber-100/80 dark:hover:bg-amber-900/20 hover:scale-[1.01]' : ''}`}
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">i</div>
                  <span className="flex-1 leading-snug text-amber-800 dark:text-amber-300 font-semibold text-[12.5px]">{hint.text}</span>
                </button>
              ))}
            </div>
          )}

          {showAutoCalcNotice && (
            <div className="bg-[#fbfcff] dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl p-5 mt-4">
              <span className="text-[#37352f] dark:text-neutral-200 font-black block mb-3 border-b border-blue-100/30 dark:border-neutral-700 pb-2 text-[14px]">자동 상속분 분배:</span>
              <div className="space-y-2.5">
                {autoCalculatedNames.map((item, index) => (
                  <div key={index} className="text-[13px] flex items-center justify-between group">
                    <span className="font-bold text-[#504f4c] dark:text-neutral-300 group-hover:text-blue-500 transition-colors">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{item.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* 푸터 (하단 안내) */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-[#e9e9e7] dark:border-neutral-700">
          <div className="flex items-start gap-2.5 text-[11px] text-[#9b9a97] dark:text-neutral-500 font-medium leading-normal">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>가이드는 실시간 법령 분석 데이터에 기반하며, 입력 정보에 따라 즉시 업데이트됩니다.</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
