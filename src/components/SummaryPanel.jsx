import React from 'react';
import { IconList } from './Icons';
import { math, getRelStr, formatKorDate, isBefore } from '../engine/utils';
import { collectMissingHeirNames } from '../utils/missingHeirStatus';

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

export default function SummaryPanel({
  tree,
  finalShares,
  issues = [],
  handleNavigate,
  matchIds,
  currentMatchIdx,
  searchQuery,
  setSearchQuery,
  simpleTargetN,
  simpleTargetD,
  interpretationMode = 'practical',
}) {
  const issueMap = buildIssueMap(issues);

  const missingHeirNames = React.useMemo(() => collectMissingHeirNames(tree), [tree]);
  const hasMissingHeir = missingHeirNames.length > 0;

  const shareByPersonId = new Map();
  (finalShares.direct || []).forEach((s) => shareByPersonId.set(s.personId, s));
  (finalShares.subGroups || []).forEach((g) => g.shares.forEach((s) => shareByPersonId.set(s.personId, s)));

  const printedPersonIds = new Set();
  const buildGroups = (node, parentDeathDate) => {
    const directShares = [];
    const subGroups = [];
    const seenInThisGroup = new Set();

    (node.heirs || []).forEach((h) => {
      if (seenInThisGroup.has(h.personId)) return;
      seenInThisGroup.add(h.personId);

      if (!h.isDeceased) {
        const s = shareByPersonId.get(h.personId);
        if (s && s.n > 0 && !printedPersonIds.has(h.personId)) {
          directShares.push(s);
          printedPersonIds.add(h.personId);
        }
        return;
      }

      const type = h.deathDate && isBefore(h.deathDate, parentDeathDate) ? '대습상속' : '사망상속';
      const child = buildGroups(h, h.deathDate || parentDeathDate);
      if (child.directShares.length > 0 || child.subGroups.length > 0) {
        subGroups.push({ ancestor: h, type, ...child });
      }
    });

    return { directShares, subGroups };
  };

  const topDirect = [];
  const topGroups = [];
  const topSeen = new Set();

  (tree.heirs || []).forEach((h) => {
    if (topSeen.has(h.personId)) return;
    topSeen.add(h.personId);

    if (!h.isDeceased) {
      const s = shareByPersonId.get(h.personId);
      if (s && s.n > 0 && !printedPersonIds.has(h.personId)) {
        topDirect.push(s);
        printedPersonIds.add(h.personId);
      }
      return;
    }

    const type = h.deathDate && isBefore(h.deathDate, tree.deathDate) ? '대습상속' : '사망상속';
    const child = buildGroups(h, h.deathDate || tree.deathDate);
    if (child.directShares.length > 0 || child.subGroups.length > 0) {
      topGroups.push({ ancestor: h, type, ...child });
    }
  });

  const [totalSumN, totalSumD] = (() => {
    let tn = 0;
    let td = 1;
    const addShare = (s) => {
      if (s && s.n > 0) {
        const [nn, nd] = math.add(tn, td, s.n, s.d);
        tn = nn;
        td = nd;
      }
    };
    topDirect.forEach(addShare);
    const traverseGroup = (g) => {
      g.directShares.forEach(addShare);
      g.subGroups.forEach(traverseGroup);
    };
    topGroups.forEach(traverseGroup);
    return math.simplify(tn, td);
  })();

  const renderShareRow = (f, depth, groupAncestorId = null) => {
    const paddingLeft = `${12 + depth * 16}px`;
    const rowId = groupAncestorId ? `summary-row-${f.personId}-${groupAncestorId}` : `summary-row-${f.personId}`;
    const isCurrentMatch = matchIds[currentMatchIdx] === rowId;
    const personIssues = issueMap.get(f.personId) || issueMap.get(f.id) || [];

    return (
      <tr
        key={`sr-${f.id}-${groupAncestorId || 'top'}`}
        id={rowId}
        className={`transition-colors duration-300 ${isCurrentMatch ? 'bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-l-yellow-500' : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20'}`}
      >
        <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left font-medium" style={{ paddingLeft }}>
          <button
            type="button"
            onClick={() => personIssues.length > 0 && handleNavigate ? handleNavigate(personIssues[0].targetTabId || f.personId || f.id) : null}
            className={`${personIssues.length > 0 ? 'cursor-pointer text-red-600 dark:text-red-400' : 'cursor-default'} inline-flex items-center gap-1 font-medium`}
          >
            <span>{f.name}</span>
            {personIssues.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-black">
                경고
              </span>
            )}
          </button>
          <span className="text-[#787774] font-normal ml-1">[{getRelStr(f.relation, tree.deathDate)}]</span>
          {personIssues.map((issue, issueIndex) => (
            <span key={`${issue.code}-${issueIndex}`} className="block text-[11px] text-red-500 dark:text-red-400 font-semibold mt-1">
              {issue.text}
            </span>
          ))}
        </td>
        <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center text-[#504f4c]">{f.n} / {f.d}</td>
        <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{f.un} / {f.ud}</td>
      </tr>
    );
  };

  const renderGroup = (group, depth) => (
    <React.Fragment key={`grp-${group.ancestor.id}`}>
      <tr className="bg-[#fcfcfb] dark:bg-neutral-800/40">
        <td
          colSpan={3}
          className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[#504f4c] dark:text-neutral-400"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          [{group.ancestor.name}] {formatKorDate(group.ancestor.deathDate)} 사망으로 인한 {group.type} 그룹
        </td>
      </tr>
      {group.directShares.map((f) => renderShareRow(f, depth + 1, group.ancestor.id))}
      {group.subGroups.map((sg) => renderGroup(sg, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="w-full text-[#37352f] dark:text-neutral-200">
      <div className="mb-4 rounded-lg border border-[#e9e9e7] bg-[#fcfcfb] px-4 py-3 text-[12px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-400">
        {interpretationMode === 'conservative'
          ? "보수해석 비교: 민법 제1009조의 '동시 상속' 문언을 엄격 해석하면 가산 배제 가능"
          : '실무해석 적용: 대법원 90마772, 등기선례 제8-187호 취지 참조'}
      </div>
      <div className="mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-6">
          <h2 className="text-lg font-black text-[#37352f] dark:text-neutral-200 flex items-center gap-2">
            <IconList className="w-5 h-5 text-[#787774]" />
            지분 요약표
          </h2>
          <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-full px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] w-16 focus:w-28 transition-all"
            />
            {matchIds.length > 0 && (
              <span className="text-[11px] text-neutral-500 font-medium ml-1">
                {currentMatchIdx + 1}/{matchIds.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 요약표 화면 내 미완성 경고 배너 */}
      {hasMissingHeir && (
        <div className="mb-4 bg-[#fbfbfb] dark:bg-neutral-800/40 border border-[#e9e9e7] border-l-4 border-l-red-400 dark:border-neutral-700 p-3 rounded-lg shadow-sm transition-all duration-300">
          <span className="text-[#37352f] dark:text-neutral-200 font-bold text-[13px]">
            사망자 중 하위 상속인(대습/재상속인) 누락이 감지되어, 이 요약표 계산 내역은 미완성 상태입니다.
          </span>
          <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">
            확정 필요: <span className="font-bold text-[#37352f] dark:text-neutral-200">{missingHeirNames.join(', ')}</span>의 하위 상속인 정보를 확정해 주세요.
          </div>
        </div>
      )}

      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[40%] text-[#787774]">상속인 성명</th>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">{hasMissingHeir ? '산출 지분' : '최종 지분'}</th>
            <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">통분 지분</th>
          </tr>
        </thead>
        <tbody>
          {topDirect.map((f) => renderShareRow(f, 0))}
          {topGroups.map((g) => renderGroup(g, 0))}
        </tbody>
        <tfoot className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-right font-medium text-[#787774]">합계 검증</td>
            <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{totalSumN} / {totalSumD}</td>
            <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[12.5px]">
              {(() => {
                const sumVal = totalSumD ? totalSumN / totalSumD : 0;
                const targetVal = simpleTargetD ? simpleTargetN / simpleTargetD : 1;
                if (totalSumN === 0) return <span className="text-[#b45309] font-bold">최종 생존 상속인이 없습니다.</span>;
                if (sumVal === targetVal) return <span className="text-[#504f4c]">법정상속분 합계와 일치합니다.</span>;
                return <span className="text-red-500 font-bold">지분 합계가 일치하지 않습니다.</span>;
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
