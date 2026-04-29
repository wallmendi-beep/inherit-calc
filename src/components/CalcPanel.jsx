import React from 'react';
import { getRelStr, formatKorDate, math } from '../engine/utils';
import { extractHojuBonusNotices, buildHojuBonusPersonMap } from '../utils/hojuBonusNotice';

const buildIssueMap = (issues = []) => {
  const map = new Map();
  issues.forEach((issue) => {
    const key = issue.personId || issue.id;
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(issue);
  });
  return map;
};

const NoticeCard = ({ notice }) => (
  <div className="rounded-xl border border-[#e9e9e7] bg-[#f8f8f7] px-4 py-3 dark:border-neutral-600 dark:bg-neutral-800/80">
    <div className="text-[13px] font-semibold text-[#37352f] dark:text-neutral-100">{notice.title}</div>
    <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-300">{notice.basis}</div>
  </div>
);

export default function CalcPanelFinal({ calcSteps, issues = [], handleNavigate, searchQuery = '', setSearchQuery = () => {} }) {
  const issueMap = buildIssueMap(issues);
  const hojuBonusNotices = extractHojuBonusNotices(calcSteps);
  const hojuBonusMap = buildHojuBonusPersonMap(calcSteps);
  const normalizedSearchQuery = (searchQuery || '').trim().toLowerCase();
  const matchesName = (name) => !normalizedSearchQuery || (name || '').toLowerCase().includes(normalizedSearchQuery);

  const visibleSteps = React.useMemo(() => {
    return (calcSteps || [])
      .map((step) => ({
        ...step,
        dists: (step.dists || []).filter((dist) => matchesName(dist.h?.name)),
      }))
      .filter((step) => step.dists.length > 0 || !normalizedSearchQuery);
  }, [calcSteps, normalizedSearchQuery]);

  const visibleMatchCount = React.useMemo(() => {
    if (!normalizedSearchQuery) return 0;
    return (calcSteps || []).reduce((count, step) => {
      return count + (step.dists || []).filter((dist) => matchesName(dist.h?.name)).length;
    }, 0);
  }, [calcSteps, normalizedSearchQuery]);

  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      {hojuBonusNotices.length > 0 && (
        <div className="mb-4 space-y-2">
          {hojuBonusNotices.map((notice) => (
            <NoticeCard key={`${notice.personId}-${notice.decedentName}-${notice.modifier}`} notice={notice} />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] text-[#787774] dark:text-neutral-400">
          각 상속 단계에서 지분이 어떻게 산정되었는지 순서대로 보여주는 계산 상세입니다.
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 dark:border-neutral-600 dark:bg-neutral-800">
          <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-20 border-none bg-transparent text-[13px] outline-none transition-all focus:w-32"
          />
          {normalizedSearchQuery && (
            <span className="ml-1 text-[11px] font-medium text-neutral-500">
              {visibleMatchCount}건
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 print-mt-4">
        {visibleSteps.map((step, index) => {
          // 해당 단계 내 통분 분모(LCM) 계산
          const innerLCM = step.dists.reduce((acc, d) => (d.sd ? math.lcm(acc, d.sd) : acc), 1);
          const outerLCM = step.dists.reduce((acc, d) => (d.d ? math.lcm(acc, d.d) : acc), 1);

          return (
            <div key={`calc-step-${index}`}>
              <div className="mb-2 text-[13px] text-[#504f4c] dark:text-neutral-300">
                [STEP {index + 1}] <span className="font-medium text-[#37352f] dark:text-neutral-100">망 {step.dec.name}</span>{' '}
                ({formatKorDate(step.dec.deathDate)} 사망) 의 분배 지분 {step.inN}/{step.inD}
                {step.mergeSources && step.mergeSources.length > 1 && (
                  <span className="text-[#787774]">
                    {` (= ${step.mergeSources.map((src) => `${src.from} ${src.d}분의 ${src.n}`).join(' + ')})`}
                  </span>
                )}
              </div>

              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-[#fcfcfb] dark:bg-neutral-800/80">
                  <tr>
                    <th className="w-[15%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-600">이름</th>
                    <th className="w-[12%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-600">관계</th>
                    <th className="w-[25%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-600">계산식</th>
                    <th className="w-[18%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-600">계산 결과</th>
                    <th className="w-[30%] border border-[#e9e9e7] p-2 pl-4 text-left font-medium text-[#787774] dark:border-neutral-600">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {step.dists.map((dist, distIndex) => {
                    const personKey = dist.h.personId || dist.h.id;
                    const personIssues = issueMap.get(personKey) || [];
                    const hojuApplied = hojuBonusMap.has(personKey);
                    const memo = [];

                    if (dist.ex) memo.push(`상속권 없음(${dist.ex})`);
                    if (dist.h.isDeceased && !(dist.ex && (dist.ex.includes('후사망') || dist.ex.includes('선사망')))) {
                      memo.push('망인');
                    }
                    if (dist.mod) memo.push(...dist.mod.split(',').map((item) => item.trim()).filter(Boolean));
                    personIssues.forEach((issue) => memo.push(issue.text));

                    // 통분된 값 계산
                    const scaleInner = innerLCM / dist.sd;
                    const displayInnerN = dist.sn * scaleInner;
                    const scaleOuter = outerLCM / dist.d;
                    const displayOuterN = dist.n * scaleOuter;

                    return (
                      <tr key={`calc-dist-${distIndex}`} className={`${matchesName(dist.h?.name) && normalizedSearchQuery ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20`}>
                        <td className="border border-[#e9e9e7] p-2 text-center font-medium dark:border-neutral-600">
                          <button
                            type="button"
                            onClick={() => handleNavigate && handleNavigate(personIssues[0]?.targetTabId || personKey)}
                            title="입력 탭에서 이 사람 정보 수정"
                            className={`group inline-flex items-center gap-1 font-medium transition-colors ${
                              personIssues.length > 0
                                ? 'cursor-pointer text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                                : hojuApplied
                                  ? 'cursor-pointer text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300'
                                  : 'cursor-pointer text-[#37352f] hover:text-blue-700 dark:text-neutral-200 dark:hover:text-blue-300'
                            }`}
                          >
                            <span className="underline-offset-2 group-hover:underline">{dist.h.name}</span>
                            {personIssues.length > 0 && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/50 dark:text-red-300">
                                경고
                              </span>
                            )}
                            <span className="hidden text-[10px] font-bold text-[#787774] group-hover:inline dark:text-neutral-400">
                              수정
                            </span>
                          </button>
                        </td>
                          <td className="border border-[#e9e9e7] p-2 text-center text-[#787774] dark:border-neutral-600">
                           {getRelStr(dist.h._origRelation || dist.h.relation, step.dec.deathDate) || '상속인'}
                          </td>
                        <td className="border border-[#e9e9e7] p-2 text-center text-[#787774] dark:border-neutral-600">
                          {step.inN}/{step.inD} × {displayInnerN}/{innerLCM}
                        </td>
                        <td className="border border-[#e9e9e7] p-2 text-center font-medium dark:border-neutral-600">
                          {displayOuterN}/{outerLCM}
                        </td>
                        <td className="border border-[#e9e9e7] p-2 pl-4 text-left text-[#787774] dark:border-neutral-600">
                          {memo.join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
