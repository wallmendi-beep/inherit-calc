import React from 'react';
import ContextualDrawer from './ui/ContextualDrawer';

const GuideCheckButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-neutral-100 hover:text-slate-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    title={label}
  >
    {label}
  </button>
);

export default function SmartGuidePanel({
  showNavigator,
  setShowNavigator,
  hasActionItems,
  noSurvivors,
  activeTab,
  warnings,
  smartGuides,
  hiddenGuideKeys,
  dismissGuide,
  checkedGuideKeys,
  toggleGuideChecked,
  confirmedGuides,
  confirmedGuidesOpen,
  setConfirmedGuidesOpen,
  showGlobalWarning,
  globalMismatchReasons,
  auditActionItems,
  repairHints,
  handleNavigate,
  showAutoCalcNotice,
  autoCalculatedNames,
}) {
  const resolveGuideTarget = (item) =>
    item?.targetNodeId || item?.targetTabId || item?.personId || item?.id || null;

  const checkedSet = checkedGuideKeys || new Set();
  const visibleAuditActionItems = (auditActionItems || []).filter((item) =>
    (item.displayTargets || []).includes('guide'),
  );

  const mandatoryGuides = (smartGuides || []).filter(
    (guide) => guide.type === 'mandatory' && !checkedSet.has(guide.uniqueKey),
  );
  const recommendedGuides = (smartGuides || []).filter(
    (guide) =>
      guide.type === 'recommended' &&
      !hiddenGuideKeys.has(guide.uniqueKey) &&
      !checkedSet.has(guide.uniqueKey),
  );
  const hasUrgentSignals =
    mandatoryGuides.length > 0 ||
    visibleAuditActionItems.length > 0 ||
    !!showGlobalWarning;

  return (
    <>
      {!showNavigator && (
        <button
          type="button"
          onClick={() => setShowNavigator(true)}
          className={`fixed right-4 top-[92px] z-50 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-bold shadow-lg transition-all ${
            hasUrgentSignals
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
          }`}
          title={hasUrgentSignals ? '확인이 필요한 가이드가 있습니다.' : '가이드 펼치기'}
        >
          <span className={`h-2 w-2 rounded-full ${hasUrgentSignals ? 'bg-amber-500' : 'bg-slate-300 dark:bg-neutral-600'}`} />
          가이드
        </button>
      )}

      <ContextualDrawer isOpen={showNavigator} onClose={() => setShowNavigator(false)} title="스마트 가이드">
        <div className="space-y-6 p-5">
        {noSurvivors && (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800/50">
            <div className="text-[13px] font-bold text-slate-800 dark:text-neutral-100">최종 생존 상속인이 없습니다.</div>
            <div className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-neutral-400">
              모든 상속인이 제외되었거나 사망 상태입니다. 입력 데이터를 확인하고 실제 상속인을 추가해 주세요.
            </div>
          </section>
        )}

        {!hasActionItems && !noSurvivors && (
          <section className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-center dark:border-neutral-700 dark:bg-neutral-900/40">
            <span className="text-2xl">✨</span>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-neutral-300">입력 데이터에 치명적인 문제가 없습니다.</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">정상적으로 상속 지분 계산을 진행할 수 있습니다.</p>
          </section>
        )}

        {visibleAuditActionItems.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">⚠️ 해결이 필요한 문제</h3>
            <ul className="space-y-2">
              {visibleAuditActionItems.map((item, index) => (
                <li key={`audit-${item.id || index}`}>
                  <button
                    onClick={() => handleNavigate(item.targetTabId || item.personId || item.id)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[12.5px] font-bold text-slate-800 dark:text-neutral-100">{item.name || '확인 필요 인물'}</div>
                        <div className="mt-0.5 text-[11.5px] font-medium leading-relaxed text-slate-600 dark:text-neutral-400">{item.text}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {warnings.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">💡 참고사항</h3>
            <ul className="space-y-2">
              {warnings.map((warning, index) => (
                <li key={`warning-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      const target = warning?.targetTabId || warning?.personId || warning?.id || null;
                      if (target) handleNavigate(target);
                    }}
                    disabled={!(warning?.targetTabId || warning?.personId || warning?.id)}
                    className={`w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left dark:border-neutral-700 dark:bg-neutral-800/50 ${
                      warning?.targetTabId || warning?.personId || warning?.id
                        ? 'transition-all hover:bg-neutral-100'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] font-medium leading-snug text-slate-700 dark:text-neutral-200">{warning.text || warning}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {mandatoryGuides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">⚠️ 필수 검토</h3>
            <ul className="space-y-2">
              {mandatoryGuides.map((guide, index) => (
                <li key={`mandatory-${index}`}>
                  <button
                    onClick={() => handleNavigate(resolveGuideTarget(guide))}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left shadow-sm transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[11.5px] font-medium leading-relaxed text-slate-800 dark:text-neutral-100">{guide.text}</span>
                      <GuideCheckButton
                        label="확인"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGuideChecked(guide.uniqueKey);
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recommendedGuides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">💡 권장 가이드</h3>
            <ul className="space-y-2">
              {recommendedGuides.map((guide, index) => (
                <li key={`recommended-${index}`} className="group relative">
                  <button
                    onClick={() => handleNavigate(resolveGuideTarget(guide))}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 pr-10 text-left shadow-sm transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[11.5px] font-medium leading-relaxed text-slate-700 dark:text-neutral-200">{guide.text}</span>
                      <GuideCheckButton
                        label="확인"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGuideChecked(guide.uniqueKey);
                        }}
                      />
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissGuide(guide.uniqueKey);
                    }}
                    className="absolute right-2 top-2 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:text-slate-600 group-hover:opacity-100 dark:hover:text-neutral-300"
                    title="숨기기"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showGlobalWarning && (
          <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-neutral-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">⚠️ 무결성 경고</h3>
            <ul className="space-y-2">
              {globalMismatchReasons.map((reason, index) => (
                <li key={`global-${index}`}>
                  <button
                    onClick={() => (reason.id ? handleNavigate(reason.id) : null)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-100 p-4 text-left text-slate-800 shadow-sm transition-all hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <span className="block text-[12px] font-medium leading-relaxed">{reason.text || reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {repairHints && repairHints.length > 0 && (
          <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-neutral-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">💡 수정 힌트</h3>
            <ul className="space-y-2">
              {repairHints.map((hint, index) => (
                <li key={`hint-${index}`}>
                  <button
                    onClick={() => (hint.targetTabId ? handleNavigate(hint.targetTabId) : null)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-left transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] font-medium leading-relaxed text-slate-700 dark:text-neutral-200">{hint.text}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(confirmedGuides || []).length > 0 && (
          <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setConfirmedGuidesOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">☑️ 확인된 항목 ({confirmedGuides.length})</h3>
              <span className="text-[11px] text-slate-400">{confirmedGuidesOpen ? '접기' : '펼치기'}</span>
            </button>
            {confirmedGuidesOpen && (
              <ul className="space-y-2">
                {confirmedGuides.map((guide, index) => (
                  <li key={`confirmed-${guide.uniqueKey || index}`}>
                    <button
                      onClick={() => handleNavigate(resolveGuideTarget(guide))}
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 text-left transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11.5px] font-medium leading-relaxed text-slate-500 dark:text-neutral-300">{guide.text}</span>
                        <GuideCheckButton
                          label="해제"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGuideChecked(guide.uniqueKey);
                          }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {showAutoCalcNotice && (
          <section className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/20">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">💡 자동 분배 탐지</h3>
            <ul className="space-y-1.5">
              {autoCalculatedNames.map((item, index) => (
                <li key={index} className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-slate-800 dark:text-neutral-100">{item.name}</span>
                  <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                    <span>{item.target}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </ContextualDrawer>
    </>
  );
}
