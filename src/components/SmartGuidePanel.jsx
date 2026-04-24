import React from 'react';
import ContextualDrawer from './ui/ContextualDrawer';

const GuideCheckButton = ({ label, onClick, tone = 'neutral' }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition-all ${
      tone === 'primary'
        ? 'border-[#1e56a0] bg-white text-[#1e56a0] hover:bg-[#eff6ff] dark:bg-neutral-800'
        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400'
    }`}
  >
    {label}
  </button>
);

const GuideCard = ({ guide, onChecked, onDismiss, isChecked, handleGuideNavigate }) => {
  const isMandatory = guide.type === 'mandatory';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300 ${
        isChecked
          ? 'border-slate-100 bg-slate-50/50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/20'
          : isMandatory
          ? 'border-red-100 bg-white shadow-sm hover:border-red-200 dark:border-red-900/20 dark:bg-neutral-800/40'
          : 'border-amber-100 bg-white shadow-sm hover:border-amber-200 dark:border-amber-900/20 dark:bg-neutral-800/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isMandatory ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[12px] font-black text-red-600 dark:bg-red-900/40 dark:text-red-400">
              !
            </span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[12px] font-black text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              ?
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-relaxed transition-colors ${isChecked ? 'text-slate-400 dark:text-neutral-600 line-through' : 'text-[#37352f] dark:text-neutral-200'}`}>
            {guide.text}
          </p>
          
          <div className="mt-3.5 flex items-center gap-2">
            <button
              onClick={() => handleGuideNavigate(guide)}
              className="text-[12px] font-bold text-[#1e56a0] hover:underline dark:text-blue-400"
            >
              조치하기
            </button>
            <div className="h-3 w-[1px] bg-slate-200 dark:bg-neutral-700" />
            <button
              onClick={() => onChecked(guide.uniqueKey)}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-700 dark:text-neutral-400"
            >
              {isChecked ? '완료 취소' : '확인 완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SmartGuidePanel({
  showNavigator,
  setShowNavigator,
  navigatorWidth,
  activeTab,
  tree,
  smartGuides = [],
  hasActionItems,
  noSurvivors,
  warnings,
  hiddenGuideKeys,
  dismissGuide,
  checkedGuideKeys,
  toggleGuideChecked,
  confirmedGuides = [],
  confirmedGuidesOpen,
  setConfirmedGuidesOpen,
  showGlobalWarning,
  globalMismatchReasons = [],
  auditActionItems = [],
  handleGuideNavigate,
}) {
  const visibleGuides = smartGuides.filter((g) => !hiddenGuideKeys.has(g.uniqueKey));
  const mandatoryGuides = visibleGuides.filter((g) => g.type === 'mandatory');
  const recommendedGuides = visibleGuides.filter((g) => g.type === 'recommended');

  return (
    <ContextualDrawer
      isOpen={showNavigator}
      onClose={() => setShowNavigator(false)}
      width={navigatorWidth}
      title="스마트 가이드"
      subtitle="데이터 무결성 및 법리 검토"
    >
      <div className="flex flex-col gap-6">
        {/* 가이드 상태 요약 */}
        <section>
          {mandatoryGuides.length > 0 ? (
            <div className="rounded-xl border-2 border-red-100 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
              <div className="flex items-center gap-2 text-[14px] font-black text-red-600 dark:text-red-400">
                <span>⚠️ {mandatoryGuides.length}건의 필수 확인 사항이 있습니다.</span>
              </div>
              <p className="mt-1 text-[12px] text-red-700/70 dark:text-red-500/70">
                정확한 계산을 위해 아래 조치 사항을 먼저 해결해 주세요.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-green-100 bg-green-50/50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
              <div className="flex items-center gap-2 text-[14px] font-black text-green-600 dark:text-green-400">
                <span>✓ 이상 없음</span>
              </div>
              <p className="mt-1 text-[12px] text-green-700/70 dark:text-green-500/70">
                가계도 검증이 완료되었습니다. 사건 검토 및 계산 결과를 확인해 주세요.
              </p>
            </div>
          )}
        </section>

        {/* 필수 조치 가이드 */}
        {mandatoryGuides.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
              필수 검토 사항
            </h3>
            <div className="space-y-3">
              {mandatoryGuides.map((guide) => (
                <GuideCard
                  key={guide.uniqueKey}
                  guide={guide}
                  isChecked={checkedGuideKeys.has(guide.uniqueKey)}
                  onChecked={toggleGuideChecked}
                  onDismiss={dismissGuide}
                  handleGuideNavigate={handleGuideNavigate}
                />
              ))}
            </div>
          </section>
        )}

        {/* 권장 가이드 */}
        {recommendedGuides.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              권장 확인 사항
            </h3>
            <div className="space-y-3">
              {recommendedGuides.map((guide) => (
                <GuideCard
                  key={guide.uniqueKey}
                  guide={guide}
                  isChecked={checkedGuideKeys.has(guide.uniqueKey)}
                  onChecked={toggleGuideChecked}
                  onDismiss={dismissGuide}
                  handleGuideNavigate={handleGuideNavigate}
                />
              ))}
            </div>
          </section>
        )}

        {/* 확인 완료 목록 */}
        {confirmedGuides.length > 0 && (
          <section>
            <button
              onClick={() => setConfirmedGuidesOpen(!confirmedGuidesOpen)}
              className="flex w-full items-center justify-between py-2 text-[12px] font-bold text-slate-400 hover:text-slate-600 dark:text-neutral-500"
            >
              <span>확인 완료된 항목 ({confirmedGuides.length})</span>
              <span className="text-[10px]">{confirmedGuidesOpen ? '▼' : '▶'}</span>
            </button>
            {confirmedGuidesOpen && (
              <div className="mt-2 space-y-2">
                {confirmedGuides.map((guide) => (
                  <GuideCard
                    key={guide.uniqueKey}
                    guide={guide}
                    isChecked={true}
                    onChecked={toggleGuideChecked}
                    onDismiss={dismissGuide}
                    handleGuideNavigate={handleGuideNavigate}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {visibleGuides.length === 0 && !noSurvivors && (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-100 bg-white text-center dark:border-neutral-800 dark:bg-neutral-900/20">
            <span className="text-2xl opacity-20">✓</span>
            <p className="mt-2 text-sm font-medium text-slate-400 dark:text-neutral-500">모든 가이드가 처리되었습니다.</p>
          </div>
        )}
      </div>
    </ContextualDrawer>
  );
}
