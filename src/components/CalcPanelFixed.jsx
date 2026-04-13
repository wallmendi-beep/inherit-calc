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
      basis: "보수해석 비교: 민법 제1009조의 '동시 상속' 문언을 엄격 해석하면 가산 배제 가능",
    };
  }

  return {
    title: '실무 해석',
    summary: '기본값. 대법원 90마772 및 등기선례 제8-187호 취지를 우선 반영',
    basis: '실무해석 적용: 대법원 90마772, 등기선례 제8-187호 취지 참조',
  };
};

export default function CalcPanelFixed({
  calcSteps,
  issues = [],
  handleNavigate,
  interpretationMode = 'practical',
  setInterpretationMode,
}) {
  const issueMap = buildIssueMap(issues);
  const interpretationMeta = getInterpretationMeta(interpretationMode);

  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/40">
        <div>
          <div className="text-[13px] font-bold text-[#37352f] dark:text-neutral-100">법리 해석</div>
          <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">{interpretationMeta.summary}</div>
          <div className="mt-1 text-[11px] text-[#a8a29e] dark:text-neutral-500">{interpretationMeta.basis}</div>
        </div>
        <div className="inline-flex rounded-full border border-[#e5e5e5] bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setInterpretationMode && setInterpretationMode('practical')}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              interpretationMode === 'practical'
                ? 'bg-[#37352f] text-white'
                : 'text-[#787774] hover:bg-[#f1f1ef] dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            실무 해석
          </button>
          <button
            type="button"
            onClick={() => setInterpretationMode && setInterpretationMode('conservative')}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              interpretationMode === 'conservative'
                ? 'bg-[#37352f] text-white'
                : 'text-[#787774] hover:bg-[#f1f1ef] dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            보수 해석
          </button>
        </div>
      </div>

      <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
        피상속인부터 시작해 각 상속 단계에서 지분이 어떻게 분배되는지 보여주는 계산표입니다.
      </div>

      <div className="space-y-6 print-mt-4">
        {calcSteps.map((step, index) => (
          <div key={`p-s${index}`}>
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
              <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                <tr>
                  <th className="w-[15%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-700">이름</th>
                  <th className="w-[12%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-700">관계</th>
                  <th className="w-[25%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-700">계산식</th>
                  <th className="w-[18%] border border-[#e9e9e7] p-2 text-center font-medium text-[#787774] dark:border-neutral-700">계산 결과</th>
                  <th className="w-[30%] border border-[#e9e9e7] p-2 pl-4 text-left font-medium text-[#787774] dark:border-neutral-700">비고</th>
                </tr>
              </thead>
              <tbody>
                {step.dists.map((dist, distIndex) => {
                  const personIssues = issueMap.get(dist.h.personId) || issueMap.get(dist.h.id) || [];
                  const memo = [];

                  if (dist.ex) memo.push(`상속권 없음(${dist.ex})`);
                  if (dist.h.isDeceased && !(dist.ex && (dist.ex.includes('사망') || dist.ex.includes('선사망')))) {
                    memo.push('망인');
                  }
                  if (dist.mod) memo.push(...dist.mod.split(',').map((item) => item.trim()));
                  personIssues.forEach((issue) => memo.push(issue.text));

                  return (
                    <tr key={distIndex} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20">
                      <td className="border border-[#e9e9e7] p-2 text-center font-medium dark:border-neutral-700">
                        <button
                          type="button"
                          onClick={() =>
                            personIssues.length > 0 && handleNavigate
                              ? handleNavigate(personIssues[0].targetTabId || dist.h.personId || dist.h.id)
                              : null
                          }
                          className={`inline-flex items-center gap-1 font-medium ${
                            personIssues.length > 0 ? 'cursor-pointer text-red-600 dark:text-red-400' : 'cursor-default'
                          }`}
                        >
                          <span>{dist.h.name}</span>
                          {personIssues.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              경고
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="border border-[#e9e9e7] p-2 text-center text-[#787774] dark:border-neutral-700">
                        {getRelStr(dist.h.relation, step.dec.deathDate) || '상속인'}
                      </td>
                      <td className="border border-[#e9e9e7] p-2 text-center text-[#787774] dark:border-neutral-700">
                        {step.inN}/{step.inD} × {dist.sn}/{dist.sd}
                      </td>
                      <td className="border border-[#e9e9e7] p-2 text-center font-medium dark:border-neutral-700">
                        {dist.n}/{dist.d}
                      </td>
                      <td className="border border-[#e9e9e7] p-2 pl-4 text-left text-[#787774] dark:border-neutral-700">
                        {memo.join(', ')}
                      </td>
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
