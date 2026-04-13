import React from 'react';
import { IconList } from './Icons';
import { math, getRelStr, formatKorDate, isBefore } from '../engine/utils';
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

export default function SummaryPanelFixed({
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
  calcSteps = [],
}) {
  const issueMap = buildIssueMap(issues);
  const hojuBonusNotices = extractHojuBonusNotices(calcSteps);
  const hojuBonusMap = buildHojuBonusPersonMap(calcSteps);

  const hasMissingHeir = React.useMemo(() => {
    if (!tree) return false;
    let missing = false;
    const check = (node) => {
      if (node.isDeceased && node.isExcluded !== true && (!node.heirs || node.heirs.length === 0)) missing = true;
      if (node.heirs) node.heirs.forEach(check);
    };
    check(tree);
    return missing;
  }, [tree]);

  const shareByPersonId = new Map();
  (finalShares.direct || []).forEach((share) => shareByPersonId.set(share.personId, share));
  (finalShares.subGroups || []).forEach((group) => group.shares.forEach((share) => shareByPersonId.set(share.personId, share)));

  const printedPersonIds = new Set();
  const buildGroups = (node, parentDeathDate) => {
    const directShares = [];
    const subGroups = [];
    const seenInThisGroup = new Set();

    (node.heirs || []).forEach((heir) => {
      if (seenInThisGroup.has(heir.personId)) return;
      seenInThisGroup.add(heir.personId);

      if (!heir.isDeceased) {
        const share = shareByPersonId.get(heir.personId);
        if (share && share.n > 0 && !printedPersonIds.has(heir.personId)) {
          directShares.push(share);
          printedPersonIds.add(heir.personId);
        }
        return;
      }

      const type = heir.deathDate && isBefore(heir.deathDate, parentDeathDate) ? '대습상속' : '재상속';
      const child = buildGroups(heir, heir.deathDate || parentDeathDate);
      if (child.directShares.length > 0 || child.subGroups.length > 0) {
        subGroups.push({ ancestor: heir, type, ...child });
      }
    });

    return { directShares, subGroups };
  };

  const topDirect = [];
  const topGroups = [];
  const topSeen = new Set();

  (tree.heirs || []).forEach((heir) => {
    if (topSeen.has(heir.personId)) return;
    topSeen.add(heir.personId);

    if (!heir.isDeceased) {
      const share = shareByPersonId.get(heir.personId);
      if (share && share.n > 0 && !printedPersonIds.has(heir.personId)) {
        topDirect.push(share);
        printedPersonIds.add(heir.personId);
      }
      return;
    }

    const type = heir.deathDate && isBefore(heir.deathDate, tree.deathDate) ? '대습상속' : '재상속';
    const child = buildGroups(heir, heir.deathDate || tree.deathDate);
    if (child.directShares.length > 0 || child.subGroups.length > 0) {
      topGroups.push({ ancestor: heir, type, ...child });
    }
  });

  const [totalSumN, totalSumD] = (() => {
    let tn = 0;
    let td = 1;
    const addShare = (share) => {
      if (share && share.n > 0) {
        const [nn, nd] = math.add(tn, td, share.n, share.d);
        tn = nn;
        td = nd;
      }
    };
    topDirect.forEach(addShare);
    const traverseGroup = (group) => {
      group.directShares.forEach(addShare);
      group.subGroups.forEach(traverseGroup);
    };
    topGroups.forEach(traverseGroup);
    return math.simplify(tn, td);
  })();

  const renderShareRow = (share, depth, groupAncestorId = null) => {
    const paddingLeft = `${12 + depth * 16}px`;
    const rowId = groupAncestorId ? `summary-row-${share.personId}-${groupAncestorId}` : `summary-row-${share.personId}`;
    const isCurrentMatch = matchIds[currentMatchIdx] === rowId;
    const personIssues = issueMap.get(share.personId) || issueMap.get(share.id) || [];
    const hojuApplied = hojuBonusMap.has(share.personId);

    return (
      <tr
        key={`summary-row-${share.id}-${groupAncestorId || 'top'}`}
        id={rowId}
        className={`transition-colors duration-300 ${isCurrentMatch ? 'border-l-4 border-l-yellow-500 bg-yellow-100 dark:bg-yellow-900/50' : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20'}`}
      >
        <td className="border border-[#e9e9e7] p-2.5 text-left font-medium dark:border-neutral-700" style={{ paddingLeft }}>
          <button
            type="button"
            onClick={() => personIssues.length > 0 && handleNavigate ? handleNavigate(personIssues[0].targetTabId || share.personId || share.id) : null}
            className={`${personIssues.length > 0 ? 'cursor-pointer text-red-600 dark:text-red-400' : hojuApplied ? 'cursor-default text-blue-600 dark:text-blue-400' : 'cursor-default'} inline-flex items-center gap-1 font-medium`}
          >
            <span>{share.name}</span>
            {personIssues.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-300">
                경고
              </span>
            )}
          </button>
          <span className="ml-1 font-normal text-[#787774]">[{getRelStr(share.relation, tree.deathDate)}]</span>
          {personIssues.map((issue, issueIndex) => (
            <span key={`${issue.code}-${issueIndex}`} className="mt-1 block text-[11px] font-semibold text-red-500 dark:text-red-400">
              {issue.text}
            </span>
          ))}
        </td>
        <td className="border border-[#e9e9e7] p-2.5 text-center text-[#504f4c] dark:border-neutral-700">{share.n} / {share.d}</td>
        <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-700">{share.un} / {share.ud}</td>
      </tr>
    );
  };

  const renderGroup = (group, depth) => (
    <React.Fragment key={`summary-group-${group.ancestor.id}`}>
      <tr className="bg-[#fcfcfb] dark:bg-neutral-800/40">
        <td
          colSpan={3}
          className="border border-[#e9e9e7] p-2.5 text-left text-[#504f4c] dark:border-neutral-700 dark:text-neutral-400"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          [{group.ancestor.name}] {formatKorDate(group.ancestor.deathDate)} 사망으로 인한 {group.type} 그룹
        </td>
      </tr>
      {group.directShares.map((share) => renderShareRow(share, depth + 1, group.ancestor.id))}
      {group.subGroups.map((subGroup) => renderGroup(subGroup, depth + 1))}
    </React.Fragment>
  );

  const sumVal = totalSumD ? totalSumN / totalSumD : 0;
  const targetVal = simpleTargetD ? simpleTargetN / simpleTargetD : 1;

  return (
    <div className="w-full text-[#37352f] dark:text-neutral-200">
      {hojuBonusNotices.length > 0 && (
        <div className="mb-4 space-y-2">
          {hojuBonusNotices.map((notice) => (
            <NoticeCard key={`${notice.personId}-${notice.decedentName}-${notice.modifier}`} notice={notice} />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-6">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#37352f] dark:text-neutral-200">
            <IconList className="h-5 w-5 text-[#787774]" />
            지분 요약
          </h2>
          <div className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 dark:border-neutral-700 dark:bg-neutral-800">
            <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-16 border-none bg-transparent text-[13px] outline-none transition-all focus:w-28"
            />
            {matchIds.length > 0 && (
              <span className="ml-1 text-[11px] font-medium text-neutral-500">
                {currentMatchIdx + 1}/{matchIds.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {hasMissingHeir && (
        <div className="mb-4 flex items-center rounded-lg border border-[#e9e9e7] border-l-4 border-l-neutral-300 bg-[#fbfbfb] p-3 shadow-sm transition-all duration-300 dark:border-neutral-700 dark:bg-neutral-800/40">
          <span className="text-[13px] font-bold text-[#37352f] dark:text-neutral-200">
            사망자 중 하위 상속인 입력이 누락된 곳이 있어, 이 요약표는 계산 내역상 미완성 상태입니다.
          </span>
        </div>
      )}

      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <th className="w-[40%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">상속인 성명</th>
            <th className="w-[30%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">{hasMissingHeir ? '현재 지분' : '최종 지분'}</th>
            <th className="w-[30%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-700">통분 지분</th>
          </tr>
        </thead>
        <tbody>
          {topDirect.map((share) => renderShareRow(share, 0))}
          {topGroups.map((group) => renderGroup(group, 0))}
        </tbody>
        <tfoot className="bg-[#fcfcfb] dark:bg-neutral-800/40">
          <tr>
            <td className="border border-[#e9e9e7] p-2.5 text-right font-medium text-[#787774] dark:border-neutral-700">합계 검증</td>
            <td className="border border-[#e9e9e7] p-2.5 text-center font-medium dark:border-neutral-700">{totalSumN} / {totalSumD}</td>
            <td className="border border-[#e9e9e7] p-2.5 text-left text-[12.5px] dark:border-neutral-700">
              {totalSumN === 0 && <span className="font-bold text-[#787774]">최종 생존 상속인이 없습니다.</span>}
              {totalSumN > 0 && sumVal === targetVal && <span className="text-[#504f4c] dark:text-neutral-300">법정상속분 합계와 일치합니다.</span>}
              {totalSumN > 0 && sumVal !== targetVal && <span className="font-bold text-red-500">지분 합계가 일치하지 않습니다.</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
