import React from 'react';
import { getRelStr, formatKorDate } from '../engine/utils';
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
  <div className="rounded-xl border border-[#e9e9e7] bg-[#f8f8f7] px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/40">
    <div className="text-[13px] font-semibold text-[#37352f] dark:text-neutral-100">{notice.title}</div>
    <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">{notice.basis}</div>
  </div>
);

export default function CalcPanelFinal({
  calcSteps,
  issues = [],
  handleNavigate,
  hojuBonusDiffs = [],
}) {
  const issueMap = buildIssueMap(issues);
  const hojuBonusNotices = extractHojuBonusNotices(calcSteps);
  const hojuBonusMap = buildHojuBonusPersonMap(calcSteps);
  const [showCompare, setShowCompare] = React.useState(false);

  return (
    <section className="w-full text-[#37352f] dark:text-neutral-200">
      {hojuBonusNotices.length > 0 && (
        <div className="mb-4 space-y-2">
          {hojuBonusNotices.map((notice) => (
            <div key={`${notice.personId}-${notice.decedentName}-${notice.modifier}`} className="space-y-2">
              <NoticeCard notice={notice} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCompare((prev) => !prev)}
                  className="rounded-full border border-[#d6d6d3] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#504f4c] transition hover:bg-[#f3f3f1] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {showCompare ? '비교 닫기' : '미반영시 결과보기'}
                </button>
              </div>
            </div>
          ))}
          {showCompare && hojuBonusDiffs.length > 0 && (
            <div className="rounded-xl border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/30">
              <div className="text-[13px] font-semibold text-[#37352f] dark:text-neutral-100">호주가산 미반영 시 변동 상속인</div>
              <div className="mt-2 space-y-1 text-[12px] text-[#787774] dark:text-neutral-400">
                {hojuBonusDiffs.map((diff) => (
                  <div key={`calc-diff-${diff.personId}`}>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{diff.name}</span>
                    <span>{` : 현재 ${diff.currentN}/${diff.currentD} → 미반영 ${diff.compareN}/${diff.compareD}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
        각 상속 단계에서 지분이 어떻게 나뉘는지 순서대로 보여주는 계산 상세표입니다.
      </div>

      <div className="space-y-6 print-mt-4">
        {calcSteps.map((step, index) => (
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
                  const personKey = dist.h.personId || dist.h.id;
                  const personIssues = issueMap.get(personKey) || [];
                  const hojuApplied = hojuBonusMap.has(personKey);
                  const memo = [];

                  if (dist.ex) memo.push(`상속권 없음(${dist.ex})`);
                  if (dist.h.isDeceased && !(dist.ex && (dist.ex.includes('선사망') || dist.ex.includes('후사망')))) {
                    memo.push('망인');
                  }
                  if (dist.mod) memo.push(...dist.mod.split(',').map((item) => item.trim()).filter(Boolean));
                  personIssues.forEach((issue) => memo.push(issue.text));

                  return (
                    <tr key={`calc-dist-${distIndex}`} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20">
                      <td className="border border-[#e9e9e7] p-2 text-center font-medium dark:border-neutral-700">
                        <button
                          type="button"
                          onClick={() =>
                            personIssues.length > 0 && handleNavigate
                              ? handleNavigate(personIssues[0].targetTabId || personKey)
                              : null
                          }
                          className={`inline-flex items-center gap-1 font-medium ${
                            personIssues.length > 0
                              ? 'cursor-pointer text-red-600 dark:text-red-400'
                              : hojuApplied
                                ? 'cursor-default text-blue-600 dark:text-blue-400'
                                : 'cursor-default'
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
