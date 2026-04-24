import React from 'react';
import { IconList } from './Icons';
import { math, getRelStr, formatKorDate, isBefore } from '../engine/utils';
import { extractHojuBonusNotices, buildHojuBonusPersonMap } from '../utils/hojuBonusNotice';
import { hasMissingHeirsInTree, isMissingHeirNode } from '../utils/missingHeirStatus';

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979 개정민법';
  if (era === '1991') return '현행민법';
  return `${era} 기준`;
};

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

const PathView = ({ calcSteps, tree, issues, handleNavigate, searchQuery }) => {
  const issueMap = React.useMemo(() => buildIssueMap(issues), [issues]);
  const hojuBonusMap = buildHojuBonusPersonMap(calcSteps);
  const normalizedSearchQuery = (searchQuery || '').trim().toLowerCase();
  const matchesName = (name) => !normalizedSearchQuery || (name || '').toLowerCase().includes(normalizedSearchQuery);

  const heirMap = new Map();
  calcSteps.forEach((step) => {
    (step.dists || []).forEach((dist) => {
      if (dist.n <= 0) return;
      const personId = dist.h.personId || dist.h.id;
      if (!personId) return;
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
      <div className="py-12 text-center text-[13px] text-[#787774] dark:text-neutral-400">
        최종 생존 상속인이 없습니다.
      </div>
    );
  }

  return (
    <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
      <p className="mb-4">최종 생존 상속인이 어떤 경로로 지분을 취득했는지 정리한 결과표입니다.</p>
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">최종 상속인</th>
            <th className="w-[52%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">지분 취득 경로</th>
            <th className="w-[15%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">최종 합계</th>
            <th className="w-[15%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">통분 지분</th>
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
            const hojuApplied = hojuBonusMap.has(result.personId);
            const isMultiSource = result.sources.length > 1;

            return (
              <tr key={result.personId} className="border-b border-[#e9e9e7] last:border-0 dark:border-neutral-700">
                <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => handleNavigate && handleNavigate(personIssues[0]?.targetTabId || result.personId)}
                    title="입력 탭으로 이동해 관련 정보를 수정합니다"
                    className={`group inline-flex cursor-pointer items-center gap-1 font-medium transition-colors hover:text-blue-700 dark:hover:text-blue-300 ${personIssues.length > 0 ? 'text-red-600 dark:text-red-400' : hojuApplied ? 'text-blue-600 dark:text-blue-400' : 'text-[#37352f] dark:text-neutral-200'}`}
                  >
                    <span className="underline-offset-2 group-hover:underline">{result.name}</span>
                    {personIssues.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-300">경고</span>
                    )}
                    <span className="hidden text-[10px] font-bold text-[#787774] group-hover:inline dark:text-neutral-500">수정</span>
                  </button>
                  <span className="ml-1 font-normal text-[#787774]">[{getRelStr(result.relation, tree.deathDate)}]</span>
                </td>
                <td className="border border-[#e9e9e7] p-2.5 text-left dark:border-neutral-700">
                  {result.sources.map((source, index) => (
                    <div key={`${result.personId}-src-${index}`} className={`flex items-baseline gap-1 ${index > 0 ? 'mt-1.5 border-t border-dashed border-[#e9e9e7] pt-1.5 dark:border-neutral-700' : ''}`}>
                      <span className="shrink-0 font-medium text-[#37352f] dark:text-neutral-200">{source.n}/{source.d}</span>
                      <span className="text-[12px] text-[#787774] dark:text-neutral-500">
                        망 {source.decName}의 {getRelStr(source.relation, source.decDeathDate) || '상속인'} &lt;{lawLabel(source.lawEra)}&gt;
                        {source.modifier ? ` (${source.modifier})` : ''}
                      </span>
                    </div>
                  ))}
                  {isMultiSource && (
                    <div className="mt-1.5 border-t border-[#e9e9e7] pt-1.5 text-[12px] font-medium text-[#504f4c] dark:border-neutral-700 dark:text-neutral-400">
                      = 합계: {total.n}/{total.d}
                    </div>
                  )}
                </td>
                <td className="border border-[#e9e9e7] p-2.5 text-center font-bold text-[#37352f] dark:border-neutral-700 dark:text-neutral-200">{total.n} / {total.d}</td>
                <td className="border border-[#e9e9e7] p-2.5 text-center font-black text-[#1e56a0] dark:border-neutral-700 dark:text-blue-400">{unifiedN} / {commonD}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const StructureView = ({ node, finalShares, tree, level = 0 }) => {
  if (!node) return null;
  const isExcluded = node.isExcluded;
  const hasSubHeirs = node.heirs && node.heirs.length > 0;
  const share = finalShares?.direct?.find((s) => s.personId === node.personId) || 
                finalShares?.subGroups?.flatMap(g => g.shares).find(s => s.personId === node.personId);

  const getLawInfo = (personId) => {
    if (!finalShares?.appliedLawMap) return null;
    return finalShares.appliedLawMap[personId];
  };

  const lawEra = getLawInfo(node.personId);

  return (
    <React.Fragment>
      {!isExcluded && share && (
        <tr className="border-b border-[#e9e9e7] last:border-0 hover:bg-[#fcfcfb] dark:border-neutral-700 dark:hover:bg-neutral-800/40">
          <td className="p-3 text-[13px] dark:text-neutral-200">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 16}px` }}>
              {level > 0 && <span className="text-slate-300 dark:text-neutral-600">└</span>}
              <span className="font-bold">{node.name}</span>
              <span className="text-[11px] text-[#787774] dark:text-neutral-500">[{getRelStr(node.relation, tree.deathDate)}]</span>
              {lawEra && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 dark:bg-neutral-700 dark:text-neutral-400">{lawLabel(lawEra)}</span>}
            </div>
          </td>
          <td className="p-3 text-center text-[13px] font-medium text-[#37352f] dark:text-neutral-200">
            {share.n} / {share.d}
          </td>
          <td className="p-3 text-center text-[13px] font-bold text-[#1e56a0] dark:text-blue-400">
            {share.un} / {share.ud}
          </td>
        </tr>
      )}
      {hasSubHeirs && node.heirs.map((h) => (
        <StructureView key={h.id} node={h} finalShares={finalShares} tree={tree} level={level + 1} />
      ))}
    </React.Fragment>
  );
};

export default function SummaryPanelFixed({ tree, finalShares, calcSteps, issues, handleNavigate, searchQuery, viewMode, setViewMode }) {
  const hojuBonusNotices = extractHojuBonusNotices(calcSteps);
  const hasMissingHeir = hasMissingHeirsInTree(tree);

  return (
    <section className="w-full">
      {hojuBonusNotices.length > 0 && (
        <div className="mb-6 space-y-2">
          {hojuBonusNotices.map((notice, idx) => (
            <NoticeCard key={idx} notice={notice} />
          ))}
        </div>
      )}

      {hasMissingHeir && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <h4 className="text-[14px] font-bold text-amber-800 dark:text-amber-400">가계도 내 미입력 정보가 감지되었습니다.</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-700/80 dark:text-amber-500/80">
                일부 선사망자나 재상속 대상자의 하위 상속인이 입력되지 않았습니다. 현재 계산 결과는 입력된 인원만을 기준으로 산출된 임시 지분입니다.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <IconList className="h-5 w-5 text-[#37352f] dark:text-neutral-400" />
          <h2 className="text-[16px] font-bold text-[#37352f] dark:text-neutral-100">최종 상속지분 요약</h2>
        </div>
        <div className="flex rounded-lg bg-[#f0f0ef] p-1 dark:bg-neutral-800">
          <button
            onClick={() => setViewMode('structure')}
            className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition-all ${viewMode === 'structure' ? 'bg-white shadow-sm dark:bg-neutral-700 dark:text-neutral-100' : 'text-[#787774] hover:text-[#37352f] dark:text-neutral-500'}`}
          >
            가계도 구조형
          </button>
          <button
            onClick={() => setViewMode('path')}
            className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition-all ${viewMode === 'path' ? 'bg-white shadow-sm dark:bg-neutral-700 dark:text-neutral-100' : 'text-[#787774] hover:text-[#37352f] dark:text-neutral-500'}`}
          >
            취득 경로형
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#e9e9e7] bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800/40">
        {viewMode === 'structure' ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-[#37352f] dark:border-neutral-600">
                <th className="p-3 text-left text-[13px] font-bold text-[#787774] dark:text-neutral-400">최종 상속인</th>
                <th className="p-3 text-center text-[13px] font-bold text-[#787774] dark:text-neutral-400">
                  {hasMissingHeir ? '임시 상속분' : '법정 상속분'}
                </th>
                <th className="p-3 text-center text-[13px] font-bold text-[#787774] dark:text-neutral-400">통분 지분</th>
              </tr>
            </thead>
            <tbody>
              <StructureView node={tree} finalShares={finalShares} tree={tree} />
            </tbody>
          </table>
        ) : (
          <PathView calcSteps={calcSteps} tree={tree} issues={issues} handleNavigate={handleNavigate} searchQuery={searchQuery} />
        )}
      </div>
    </section>
  );
}
