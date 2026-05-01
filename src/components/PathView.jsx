import React from 'react';
import { math, getRelStr } from '../engine/utils';
import { buildHojuBonusPersonMap } from '../utils/hojuBonusNotice';

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979 개정민법';
  if (era === '1991') return '현행민법';
  return `${era} 기준`;
};

export default function PathView({ calcSteps, tree, issues, handleNavigate, searchQuery }) {
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
  const normalizedSearchQuery = (searchQuery || '').trim().toLowerCase();
  const matchesName = (name) => !normalizedSearchQuery || (name || '').toLowerCase().includes(normalizedSearchQuery);

  const heirMap = new Map();
  calcSteps.forEach((step) => {
    step.dists.forEach((dist) => {
      if (dist.n <= 0) return;
      const personId = dist.h.personId || dist.h.id;
      if (!heirMap.has(personId)) {
        heirMap.set(personId, {
          personId,
          name: dist.h.name,
          relation: dist.h._origRelation || dist.h.relation,
          isDeceased: dist.h.isDeceased,
          sources: [],
        });
      }
      heirMap.get(personId).sources.push({
        decName: step.dec.name,
        decDeathDate: step.dec.deathDate,
        relation: dist.h._origRelation || dist.h.relation,
        lawEra: step.lawEra,
        modifier: dist.mod || '',
        n: dist.n,
        d: dist.d,
      });
    });
  });

  const results = Array.from(heirMap.values())
    .filter((item) => !item.isDeceased)
    .filter((item) => matchesName(item.name));
  const commonD = results.reduce((acc, result) => {
    const total = result.sources.reduce((sum, source) => {
      const [nn, nd] = math.add(sum.n, sum.d, source.n, source.d);
      return { n: nn, d: nd };
    }, { n: 0, d: 1 });
    return total.n > 0 ? math.lcm(acc, total.d) : acc;
  }, 1);

  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-[13px] text-[#787774] dark:text-neutral-300">
        최종 생존 상속인이 없습니다.
      </div>
    );
  }

  return (
    <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-400">
      <p className="mb-4">최종 생존 상속인이 어떤 경로로 지분을 취득했는지 정리한 결과표입니다.</p>
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-[#fcfcfb] dark:bg-neutral-800/80">
          <tr>
            <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-600">최종 상속인</th>
            <th className="w-[52%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-600">지분 취득 경로</th>
            <th className="w-[15%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-600">최종 합계</th>
            <th className="w-[15%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-600">통분 지분</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const total = result.sources.reduce((sum, source) => {
              const [nn, nd] = math.add(sum.n, sum.d, source.n, source.d);
              return { n: nn, d: nd };
            }, { n: 0, d: 1 });
            const unifiedN = total.n * (commonD / total.d);
            const personIssues = issueMap.get(result.personId) || [];
            const isMultiSource = result.sources.length > 1;
            const hojuApplied = hojuBonusMap.has(result.personId);

            return (
              <tr key={`path-${result.personId}`} className={`align-top ${matchesName(result.name) && normalizedSearchQuery ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20`}>
                <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-600">
                  <button
                    type="button"
                    onClick={() => handleNavigate && handleNavigate(personIssues[0]?.targetTabId || result.personId)}
                    title="입력 탭에서 이 사람 정보 수정"
                    className={`group inline-flex cursor-pointer items-center gap-1 font-medium transition-colors hover:text-blue-700 dark:hover:text-blue-300 ${personIssues.length > 0 ? 'text-red-600 dark:text-red-400' : hojuApplied ? 'text-blue-600 dark:text-blue-300' : 'text-[#37352f] dark:text-neutral-200'}`}
                  >
                    <span className="underline-offset-2 group-hover:underline">{result.name}</span>
                    {personIssues.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/50 dark:text-red-300">경고</span>
                    )}
                    <span className="hidden text-[10px] font-bold text-[#787774] group-hover:inline dark:text-neutral-400">수정</span>
                  </button>
                  <span className="ml-1 font-normal text-[#787774]">[{getRelStr(result.relation, tree.deathDate)}]</span>
                  {personIssues.length > 0 && (
                    <span className="mt-1 block text-[11px] font-semibold text-red-500 dark:text-red-400">{personIssues[0].text}</span>
                  )}
                  {isMultiSource && <span className="mt-0.5 block text-[10px] font-bold text-[#787774]">복수 경로</span>}
                </td>
                <td className="border border-[#e9e9e7] p-2.5 text-left dark:border-neutral-600">
                  {result.sources.map((source, index) => (
                    <div key={`${result.personId}-src-${index}`} className={`flex items-baseline gap-1 ${index > 0 ? 'mt-1.5 border-t border-dashed border-[#e9e9e7] pt-1.5 dark:border-neutral-600' : ''}`}>
                      <span className="shrink-0 font-medium text-[#37352f] dark:text-neutral-200">{source.n}/{source.d}</span>
                      <span className="text-[12px] text-[#787774] dark:text-neutral-400">
                        망 {source.decName}의 {getRelStr(source.relation, source.decDeathDate) || '상속인'} &lt;{lawLabel(source.lawEra)}&gt;
                        {source.modifier ? ` (${source.modifier})` : ''}
                      </span>
                    </div>
                  ))}
                  {isMultiSource && (
                    <div className="mt-1.5 border-t border-[#e9e9e7] pt-1.5 text-[12px] font-medium text-[#504f4c] dark:border-neutral-600 dark:text-neutral-300">
                      = {result.sources.map((s) => `${s.n}/${s.d}`).join(' + ')} = <span className="font-bold text-[#37352f] dark:text-neutral-200">{total.n}/{total.d}</span>
                    </div>
                  )}
                </td>
                <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-600">{total.n} / {total.d}</td>
                <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-600">{unifiedN} / {commonD}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
