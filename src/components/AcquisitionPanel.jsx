import React from 'react';
import { math, getRelStr } from '../engine/utils';
import { buildHojuBonusPersonMap } from '../utils/hojuBonusNotice';

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979 개정민법';
  if (era === '1991') return '현행민법';
  return era || '';
};

const Tag = ({ children, tone = 'default' }) => {
  const cls = tone === 'blue'
    ? 'border-[#d7e5f9] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300'
    : 'border-[#e4e2de] bg-[#f7f6f3] text-[#5d5b57] dark:border-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
};

export default function AcquisitionPanel({ calcSteps = [], tree, issues = [], handleNavigate, searchQuery = '', setSearchQuery = () => {} }) {
  const issueMap = React.useMemo(() => {
    const map = new Map();
    (issues || []).forEach((issue) => {
      const key = issue.personId || issue.id;
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(issue);
    });
    return map;
  }, [issues]);

  const hojuBonusMap = buildHojuBonusPersonMap(calcSteps);
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const matchesName = (name) => !normalizedQuery || (name || '').toLowerCase().includes(normalizedQuery);

  // 상속인별 취득 경로 집계
  const heirMap = new Map();
  calcSteps.forEach((step) => {
    (step.dists || []).forEach((dist) => {
      if (dist.n <= 0) return;
      const pid = dist.h?.personId || dist.h?.id;
      if (!pid) return;
      if (!heirMap.has(pid)) {
        heirMap.set(pid, {
          personId: pid,
          name: dist.h.name,
          relation: dist.h._origRelation || dist.h.relation,
          isDeceased: dist.h.isDeceased,
          sources: [],
        });
      }
      heirMap.get(pid).sources.push({
        decName: step.dec?.name,
        decDeathDate: step.dec?.deathDate,
        relation: dist.h._origRelation || dist.h.relation,
        lawEra: step.lawEra,
        modifier: dist.mod || '',
        n: dist.n,
        d: dist.d,
      });
    });
  });

  const results = Array.from(heirMap.values())
    .filter((item) => !item.isDeceased && matchesName(item.name));

  const commonD = results.reduce((acc, result) => {
    const total = result.sources.reduce(
      (sum, s) => { const [nn, nd] = math.add(sum.n, sum.d, s.n, s.d); return { n: nn, d: nd }; },
      { n: 0, d: 1 }
    );
    return total.n > 0 ? math.lcm(acc, total.d) : acc;
  }, 1);

  if (results.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-[14px] text-[#787774] dark:text-neutral-300">
        표시할 상속인이 없습니다.
      </div>
    );
  }

  return (
    <section className="w-full space-y-4 text-[#37352f] dark:text-neutral-200">
      {/* 검색 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[#787774] dark:text-neutral-300">
          최종 생존 상속인별 지분 취득 경로 · 총 {results.length}명
        </p>
        <div className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 dark:border-neutral-600 dark:bg-neutral-800">
          <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-20 border-none bg-transparent text-[12px] outline-none transition-all focus:w-28 dark:text-neutral-200"
          />
        </div>
      </div>

      {/* 카드 2열 그리드 */}
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        {results.map((result) => {
          const total = result.sources.reduce(
            (sum, s) => { const [nn, nd] = math.add(sum.n, sum.d, s.n, s.d); return { n: nn, d: nd }; },
            { n: 0, d: 1 }
          );
          const unifiedN = total.n * (commonD / total.d);
          const isMultiSource = result.sources.length > 1;
          const personIssues = issueMap.get(result.personId) || [];
          const hojuApplied = hojuBonusMap.has(result.personId);

          return (
            <div
              key={result.personId}
              className="rounded-xl border border-[#e9e9e7] bg-white shadow-sm dark:border-neutral-600 dark:bg-neutral-900/95"
            >
              {/* 3열: 이름 | 취득경로 | 지분 */}
              <div className="grid grid-cols-[auto_1fr_auto] items-start gap-0">

                {/* 왼쪽: 이름·관계 */}
                <div className="flex flex-col gap-1 px-3.5 py-3 pr-3">
                  <Tag tone="default">{getRelStr(result.relation, tree?.deathDate)}</Tag>
                  <button
                    type="button"
                    onClick={() => handleNavigate && handleNavigate(result.personId)}
                    className={`text-left text-[14px] font-black leading-snug transition-colors hover:text-blue-700 dark:hover:text-blue-300 ${
                      personIssues.length > 0
                        ? 'text-red-600 dark:text-red-400'
                        : hojuApplied
                          ? 'text-blue-600 dark:text-blue-300'
                          : 'text-[#37352f] dark:text-neutral-100'
                    }`}
                  >
                    {result.name}
                  </button>
                  {personIssues.length > 0 && (
                    <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700 dark:bg-red-900/50 dark:text-red-300">
                      경고
                    </span>
                  )}
                </div>

                {/* 중간: 취득경로 */}
                <div className="border-l border-r border-dashed border-[#eeece8] px-3 py-3 dark:border-neutral-700">
                  <div className="space-y-1">
                    {result.sources.map((source, idx) => (
                      <div key={idx} className="flex flex-wrap items-baseline gap-1 text-[11.5px]">
                        <span className="shrink-0 text-[#c0bdb9] dark:text-neutral-500">↳</span>
                        <span className="font-bold text-[#3f5f8a] dark:text-blue-300">{source.n}/{source.d}</span>
                        <span className="text-[#6a6964] dark:text-neutral-300">
                          망 {source.decName}의 {getRelStr(source.relation, source.decDeathDate) || '상속인'}
                        </span>
                        <Tag>{lawLabel(source.lawEra)}</Tag>
                        {source.modifier && (
                          <span className="text-[10px] text-[#9b9a97] dark:text-neutral-400">({source.modifier})</span>
                        )}
                      </div>
                    ))}
                    {isMultiSource && (
                      <div className="mt-1 border-t border-dashed border-[#e9e9e7] pt-1 text-[11px] text-[#6a6964] dark:border-neutral-700 dark:text-neutral-400">
                        = {result.sources.map((s) => `${s.n}/${s.d}`).join(' + ')} = <span className="font-bold text-[#37352f] dark:text-neutral-200">{total.n}/{total.d}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 최종 지분 */}
                <div className="flex flex-col items-end justify-center px-3.5 py-3 pl-3">
                  <div className="text-[18px] font-black text-[#3f5f8a] dark:text-blue-300 leading-none">
                    {total.n}/{total.d}
                  </div>
                  {commonD !== total.d && (
                    <div className="mt-0.5 text-[10px] font-medium text-[#9b9a97] dark:text-neutral-400">
                      통분 {unifiedN}/{commonD}
                    </div>
                  )}
                  {isMultiSource && (
                    <div className="mt-1 text-[9px] text-[#b0ada8] dark:text-neutral-500">복수경로</div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
