import React from 'react';
import { getRelStr, formatKorDate } from '../engine/utils';

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

export default function CalcPanel({ calcSteps, issues = [], handleNavigate }) {
  const issueMap = buildIssueMap(issues);
  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
        피상속인부터 시작해 각 상속 단계에서 지분이 어떻게 분배되는지 보여주는 계산표입니다.
      </div>
      <div className="space-y-6 print-mt-4">
        {calcSteps.map((s, i) => (
          <div key={`p-s${i}`}>
            <div className="mb-2 text-[13px] text-[#504f4c] dark:text-neutral-300">
              [STEP {i + 1}] <span className="font-medium text-[#37352f] dark:text-neutral-100">망 {s.dec.name}</span> ({formatKorDate(s.dec.deathDate)} 사망) 의 분배 지분 {s.inN}/{s.inD}
              {s.mergeSources && s.mergeSources.length > 1 && (
                <span className="text-[#787774]">
                  {` (= ${s.mergeSources.map((src) => `${src.from} ${src.d}분의 ${src.n}`).join(' + ')})`}
                </span>
              )}
            </div>
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                <tr>
                  <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[15%] text-[#787774]">이름</th>
                  <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[12%] text-[#787774]">관계</th>
                  <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[25%] text-[#787774]">계산식</th>
                  <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[18%] text-[#787774]">계산 결과</th>
                  <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-left w-[30%] pl-4 text-[#787774]">비고</th>
                </tr>
              </thead>
              <tbody>
                {s.dists.map((d, di) => {
                  const personIssues = issueMap.get(d.h.personId) || issueMap.get(d.h.id) || [];
                  const memo = [];
                  if (d.ex) memo.push(`상속권 없음(${d.ex})`);
                  if (d.h.isDeceased && !(d.ex && (d.ex.includes('사망') || d.ex.includes('선사망')))) memo.push('망인');
                  if (d.mod) memo.push(...d.mod.split(',').map((m) => m.trim()));
                  personIssues.forEach((issue) => memo.push(issue.text));

                  return (
                    <tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20">
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">
                        <button
                          type="button"
                          onClick={() => personIssues.length > 0 && handleNavigate ? handleNavigate(personIssues[0].targetTabId || d.h.personId || d.h.id) : null}
                          className={`${personIssues.length > 0 ? 'cursor-pointer text-red-600 dark:text-red-400' : 'cursor-default'} inline-flex items-center gap-1 font-medium`}
                        >
                          <span>{d.h.name}</span>
                          {personIssues.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-black">
                              경고
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">{getRelStr(d.h.relation, s.dec.deathDate) || '상속인'}</td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">{s.inN}/{s.inD} × {d.sn}/{d.sd}</td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">{d.n}/{d.d}</td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-left pl-4 text-[#787774]">{memo.join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
