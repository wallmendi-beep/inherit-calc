import React from 'react';
import ContextualDrawer from './ui/ContextualDrawer';
import { FatalBadge, WarningBadge } from './ui/MicroBadges';

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
  showGlobalWarning,
  globalMismatchReasons,
  auditActionItems,
  repairHints,
  handleNavigate,
  showAutoCalcNotice,
  autoCalculatedNames,
}) {
  const visibleAuditActionItems = (auditActionItems || []).filter((item) =>
    (item.displayTargets || []).includes('guide'),
  );

  const mandatoryGuides = (smartGuides || []).filter((guide) => guide.type === 'mandatory');
  const recommendedGuides = (smartGuides || []).filter(
    (guide) => guide.type === 'recommended' && !hiddenGuideKeys.has(guide.uniqueKey),
  );

  return (
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

        {activeTab === 'input' && visibleAuditActionItems.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">해결이 필요한 문제</h3>
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
                        <div className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600 dark:text-neutral-400">{item.text}</div>
                      </div>
                      <FatalBadge />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'input' && warnings.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">참고사항</h3>
            <ul className="space-y-2">
              {warnings.map((warning, index) => (
                <li key={`warning-${index}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-snug text-slate-700 dark:text-neutral-200">{warning.text || warning}</span>
                    <WarningBadge />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'input' && mandatoryGuides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">필수 검토</h3>
            <ul className="space-y-2">
              {mandatoryGuides.map((guide, index) => (
                <li key={`mandatory-${index}`}>
                  <button
                    onClick={() => handleNavigate(guide.targetTabId || guide.id)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left shadow-sm transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12.5px] font-bold leading-relaxed text-slate-800 dark:text-neutral-100">{guide.text}</span>
                      <FatalBadge />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'input' && recommendedGuides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">권장 가이드</h3>
            <ul className="space-y-2">
              {recommendedGuides.map((guide, index) => (
                <li key={`recommended-${index}`} className="group relative">
                  <button
                    onClick={() => handleNavigate(guide.targetTabId || guide.id)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 pr-10 text-left shadow-sm transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12.5px] leading-relaxed text-slate-700 dark:text-neutral-200">{guide.text}</span>
                      <WarningBadge />
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">무결성 경고</h3>
            <ul className="space-y-2">
              {globalMismatchReasons.map((reason, index) => (
                <li key={`global-${index}`}>
                  <button
                    onClick={() => (reason.id ? handleNavigate(reason.id) : null)}
                    className="w-full rounded-xl bg-neutral-100 border border-neutral-200 p-4 text-left text-slate-800 shadow-sm transition-all hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700"
                  >
                    <span className="block text-[13px] font-bold leading-relaxed">{reason.text || reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'input' && repairHints && repairHints.length > 0 && (
          <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-neutral-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">수정 힌트</h3>
            <ul className="space-y-2">
              {repairHints.map((hint, index) => (
                <li key={`hint-${index}`}>
                  <button
                    onClick={() => (hint.targetTabId ? handleNavigate(hint.targetTabId) : null)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-left transition-all hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/40"
                  >
                    <span className="text-[12px] font-bold leading-relaxed text-slate-700 dark:text-neutral-200">{hint.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showAutoCalcNotice && (
          <section className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/20">
            <h3 className="mb-2 text-[13px] font-bold text-slate-800 dark:text-neutral-100">자동 분배 탐지:</h3>
            <ul className="space-y-1.5">
              {autoCalculatedNames.map((item, index) => (
                <li key={index} className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-slate-600 dark:text-neutral-300">{item.name}</span>
                  <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                    <span>→</span>
                    <span>{item.target}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ContextualDrawer>
  );
}
