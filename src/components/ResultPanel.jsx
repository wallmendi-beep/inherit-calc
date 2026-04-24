import React from 'react';
import { math, getRelStr } from '../engine/utils';

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

const getInterpretationNote = (mode) => (
  mode === 'conservative'
    ? "보수해석 비교: 민법 제1009조의 '동시 상속' 문언을 엄격 해석하면 가산 배제 가능"
    : '실무해석 적용: 대법원 90마772, 등기선례 제8-187호 취지 참조'
);

export default function ResultPanel({ calcSteps, tree, issues = [], handleNavigate, interpretationMode = 'practical' }) {
  const issueMap = buildIssueMap(issues);
  const heirMap = new Map();
  calcSteps.forEach((s) => {
    s.dists.forEach((d) => {
      if (d.n > 0) {
        const key = d.h.personId;
        if (!heirMap.has(key)) {
          heirMap.set(key, { personId: key, name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
        }
        heirMap.get(key).sources.push({
          decName: s.dec.name,
          decDeathDate: s.dec.deathDate,
          relation: d.h.relation,
          lawEra: s.lawEra,
          mod: d.mod || '',
          n: d.n,
          d: d.d,
        });
      }
    });
  });

  const results = Array.from(heirMap.values()).filter((r) => !r.isDeceased);
  const lawLabel = (era) => {
    if (era === '1960') return '구민법';
    if (era === '1979') return '1979 개정';
    if (era === '1991') return '현행법';
    return `${era}년`;
  };

  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      <div className="mb-4 rounded-lg border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-3 text-[12px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-400">
        {getInterpretationNote(interpretationMode)}
      </div>
      <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
        최종 생존 상속인이 어떤 경로로 지분을 취득했는지 한눈에 검토하는 표입니다.
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[18%] text-[#787774]">최종 상속인</th>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[52%] text-[#787774]">지분 취득 경로</th>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[15%] text-[#787774]">최종 합계</th>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[15%] text-[#787774]">통분 지분</th>
          </tr>
        </thead>
        <tbody>
          {results.length > 0 ? results.map((r, i) => {
            const total = r.sources.reduce((acc, s) => {
              const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
              return { n: nn, d: nd };
            }, { n: 0, d: 1 });

            let commonD = 1;
            results.forEach((res) => {
              const t = res.sources.reduce((acc, s) => {
                const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                return { n: nn, d: nd };
              }, { n: 0, d: 1 });
              if (t.n > 0) commonD = math.lcm(commonD, t.d);
            });

            const unifiedN = total.n * (commonD / total.d);
            const isMultiSource = r.sources.length > 1;

            const personIssues = issueMap.get(r.personId) || [];

            return (
              <tr key={i} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 align-top">
                <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                  <button
                    type="button"
                    onClick={() => personIssues.length > 0 && handleNavigate ? handleNavigate(personIssues[0].targetTabId || r.personId) : null}
                    className={`${personIssues.length > 0 ? 'cursor-pointer text-red-600 dark:text-red-400' : 'cursor-default'} inline-flex items-center gap-1 font-medium`}
                  >
                    <span>{r.name}</span>
                    {personIssues.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-black">
                        경고
                      </span>
                    )}
                  </button>
                  <span className="text-[#787774] font-normal ml-1">[{getRelStr(r.relation, tree.deathDate)}]</span>
                  {personIssues.length > 0 && (
                    <span className="block text-[11px] text-red-500 dark:text-red-400 font-semibold mt-1">
                      {personIssues[0].text}
                    </span>
                  )}
                  {isMultiSource && <span className="block text-[10px] text-[#787774] font-bold mt-0.5">복수 경로</span>}
                </td>
                <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left">
                  {r.sources.map((src, si) => (
                    <div key={si} className={`flex items-baseline gap-1 ${si > 0 ? 'mt-1.5 pt-1.5 border-t border-dashed border-[#e9e9e7] dark:border-neutral-700' : ''}`}>
                      <span className="font-medium text-[#37352f] dark:text-neutral-200 shrink-0">{src.n}/{src.d}</span>
                      <span className="text-[#787774] dark:text-neutral-500 text-[12px]">망 {src.decName}의 {getRelStr(src.relation, src.decDeathDate) || '상속인'} &lt;{lawLabel(src.lawEra)}&gt;{src.mod ? ` (${src.mod})` : ''}</span>
                    </div>
                  ))}
                  {isMultiSource && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#e9e9e7] dark:border-neutral-700 text-[12px] text-[#504f4c] dark:text-neutral-400 font-medium">
                      = {r.sources.map((s) => `${s.n}/${s.d}`).join(' + ')} = <span className="text-[#37352f] dark:text-neutral-200 font-bold">{total.n}/{total.d}</span>
                    </div>
                  )}
                </td>
                <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{total.n} / {total.d}</td>
                <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{unifiedN} / {commonD}</td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan="4" className="border border-[#e9e9e7] dark:border-neutral-700 p-8 text-center text-[#b45309] font-bold bg-amber-50">최종 생존 상속인이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
