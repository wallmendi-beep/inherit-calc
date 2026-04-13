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

const getInterpretationMeta = (mode) => {
  if (mode === 'conservative') {
    return {
      title: '보수 해석',
      summary: "민법 제1009조의 '동시 상속' 문언을 엄격하게 보는 비교 모드",
      basis: '보수해석 비교: 민법 제1009조의 동시상속 문언을 엄격 해석하면 가산 배제 가능',
    };
  }

  return {
    title: '실무 해석',
    summary: '기본값. 대법원 90마772 및 등기선례 제8-187호 취지를 우선 반영',
    basis: '실무해석 적용: 대법원 90마772, 등기선례 제8-187호 취지 참조',
  };
};

const getInterpretationMemo = (mode, modifier) => {
  if (!modifier) return '';
  if (!modifier.includes('호주상속') && !modifier.includes('가산')) return '';
  return getInterpretationMeta(mode).basis;
};

export default function CalcPanel({ calcSteps, issues = [], handleNavigate, interpretationMode = 'practical', setInterpretationMode }) {
  const issueMap = buildIssueMap(issues);
  const interpretationMeta = getInterpretationMeta(interpretationMode);
  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div>
          <div className="text-[13px] font-bold text-[#37352f] dark:text-neutral-100">법리 해석</div>
          <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">{interpretationMeta.summary}</div>
        </div>
        <div className="inline-flex rounded-full border border-[#e5e5e5] bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setInterpretationMode && setInterpretationMode('practical')}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${interpretationMode === 'practical' ? 'bg-[#37352f] text-white' : 'text-[#787774] hover:bg-[#f1f1ef] dark:text-neutral-400 dark:hover:bg-neutral-800'}`}
          >
            실무 해석
          </button>
          <button
            type="button"
            onClick={() => setInterpretationMode && setInterpretationMode('conservative')}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${interpretationMode === 'conservative' ? 'bg-[#37352f] text-white' : 'text-[#787774] hover:bg-[#f1f1ef] dark:text-neutral-400 dark:hover:bg-neutral-800'}`}
          >
            보수 해석
          </button>
        </div>
      </div>
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
