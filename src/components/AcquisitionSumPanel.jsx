import React from 'react';
import { math, getRelStr } from '../engine/utils';

const formatShare = (share) => `${share?.n ?? 0}/${share?.d ?? 1}`;
const getPersonKey = (person) => person?.personId || person?.id || null;
const getStepEventDate = (step) => step?.distributionDate || step?.dec?.deathDate || '';
const sameShare = (a, b) => Number(a?.n) === Number(b?.n) && Number(a?.d) === Number(b?.d);

const addShares = (sources = []) => sources.reduce(
  (sum, source) => {
    const [n, d] = math.add(sum.n, sum.d, source.n, source.d);
    return { n, d };
  },
  { n: 0, d: 1 }
);

const buildHeirMap = (calcSteps = []) => {
  const map = new Map();
  calcSteps.forEach((step, stepIndex) => {
    const eventDate = step.distributionDate || step.dec?.deathDate;
    (step.dists || []).forEach((dist) => {
      if (dist.n <= 0 || dist.ex) return;
      const personId = dist.h?.personId || dist.h?.id;
      if (!personId) return;
      if (!map.has(personId)) {
        map.set(personId, {
          personId,
          name: dist.h?.name || '이름 미상',
          relation: dist.h?._origRelation || dist.h?.relation || '',
          isDeceased: dist.h?.isDeceased,
          sources: [],
        });
      }
      map.get(personId).sources.push({
        stepIndex,
        decPersonId: step.dec?.personId || step.dec?.id,
        decName: step.dec?.name || '사건 미상',
        decDeathDate: eventDate,
        relation: dist.h?._origRelation || dist.h?.relation || '',
        lawEra: step.lawEra,
        modifier: dist.mod || '',
        n: dist.n,
        d: dist.d,
      });
    });
  });
  return map;
};

const buildResults = ({ calcSteps = [], finalShares = null, tree = null, query = '' }) => {
  const heirMap = buildHeirMap(calcSteps);
  const normalizedQuery = query.trim().toLowerCase();
  const matchesName = (name) => !normalizedQuery || (name || '').toLowerCase().includes(normalizedQuery);
  const groups = [];

  const directMembers = (finalShares?.direct || [])
    .filter((share) => !share.isDeceased && matchesName(share.name))
    .map((share) => heirMap.get(share.personId))
    .filter(Boolean);
  if (directMembers.length > 0) {
    groups.push({ label: `${tree?.name || '피상속인'} 직접 취득`, members: directMembers });
  }

  (finalShares?.subGroups || []).forEach((group) => {
    const members = (group.shares || [])
      .filter((share) => !share.isDeceased && matchesName(share.name))
      .map((share) => heirMap.get(share.personId))
      .filter(Boolean);
    if (members.length > 0) {
      groups.push({ label: `${group.ancestor?.name || '계통'} 계통`, members });
    }
  });

  if (groups.length === 0) {
    const members = Array.from(heirMap.values())
      .filter((result) => !result.isDeceased && matchesName(result.name));
    if (members.length > 0) groups.push({ label: null, members });
  }

  return groups.flatMap((group) => group.members.map((member) => ({
    ...member,
    groupLabel: group.label,
    total: addShares(member.sources),
  })));
};

const getNameContext = (result, tree) => {
  const relation = getRelStr(result?.relation, tree?.deathDate) || result?.relation || '';
  const sourceNames = Array.from(new Set((result?.sources || []).map((source) => source.decName).filter(Boolean)));
  const sourceText = sourceNames.length > 0 ? `${sourceNames.slice(0, 2).join(', ')} 사건` : '';
  return [relation, sourceText].filter(Boolean).join(' · ');
};

const buildStepIndexes = (calcSteps = []) => {
  const steps = calcSteps.map((step, index) => ({ ...step, __index: index })).filter((step) => step?.dec);
  const byIndex = new Map(steps.map((step) => [step.__index, step]));
  return { steps, byIndex };
};

const getBreakdownShares = (step, personId, fallbackShare) => {
  const sourceBreakdowns = Array.isArray(step?.sourceBreakdowns) ? step.sourceBreakdowns : [];
  const rows = sourceBreakdowns.flatMap((breakdown) => (
    (breakdown.dists || [])
      .filter((dist) => dist.personId === personId && dist.n > 0 && !dist.ex)
      .map((dist) => ({
        share: { n: dist.n, d: dist.d },
        breakdown,
      }))
  ));
  if (rows.length > 0) return rows;
  return [{ share: fallbackShare, breakdown: null }];
};

const findParentLinks = (steps, childStep, requiredIncomingShare = null) => {
  const childKey = getPersonKey(childStep?.dec);
  if (!childKey) return [];
  return steps.flatMap((step) => {
    if (step.__index === childStep.__index) return [];
    return (step.dists || [])
      .filter((dist) => {
        if (dist.ex || dist.n <= 0) return false;
        if (getPersonKey(dist.h) !== childKey) return false;
        if (requiredIncomingShare && !sameShare({ n: dist.n, d: dist.d }, requiredIncomingShare)) return false;
        return true;
      })
      .map((dist) => ({
        parentStep: step,
        dist,
      }));
  });
};

const getFlowLabel = (parentStep, person) => {
  if (!parentStep) return '원상속';
  const eventDate = getStepEventDate(parentStep);
  const deathDate = person?.deathDate || '';
  if (deathDate && eventDate && deathDate < eventDate) return '대습상속';
  return '재상속';
};

const buildPrefixPaths = (steps, step, incomingShare = null, visited = new Set()) => {
  if (!step) return [[]];
  const stepKey = `${step.__index}:${getPersonKey(step.dec) || ''}:${incomingShare?.n || ''}/${incomingShare?.d || ''}`;
  if (visited.has(stepKey)) return [[]];
  const nextVisited = new Set(visited);
  nextVisited.add(stepKey);

  const isRootStep = step.dec?.id === 'root' || step.dec?.personId === 'root';
  if (isRootStep) {
    return [[{
      id: `event-root-${step.__index}`,
      personId: getPersonKey(step.dec),
      name: step.dec?.name || '피상속인',
      share: { n: step.inN || 1, d: step.inD || 1 },
      label: '원상속',
      relation: '피상속인',
      lawEra: step.lawEra,
    }]];
  }

  const requiredShare = incomingShare || { n: step.inN || 0, d: step.inD || 1 };
  const parentLinks = findParentLinks(steps, step, requiredShare);
  if (parentLinks.length === 0) {
    return [[{
      id: `event-${step.__index}`,
      personId: getPersonKey(step.dec),
      name: step.dec?.name || '이름 미상',
      share: requiredShare,
      label: '취득',
      relation: '상위 사건',
      lawEra: step.lawEra,
    }]];
  }

  return parentLinks.flatMap(({ parentStep, dist }) => (
    buildPrefixPaths(steps, parentStep, null, nextVisited).map((prefix) => ([
      ...prefix,
      {
        id: `event-${step.__index}-${dist.h?.personId || dist.h?.id}`,
        personId: getPersonKey(step.dec),
        name: step.dec?.name || dist.h?.name || '이름 미상',
        share: { n: dist.n, d: dist.d },
        label: getFlowLabel(parentStep, dist.h),
        relation: getRelStr(dist.h?._origRelation || dist.h?.relation, getStepEventDate(parentStep)) || dist.h?.relation || '상속인',
        lawEra: step.lawEra,
      },
    ]))
  ));
};

const buildLineagePaths = (calcSteps, selected) => {
  if (!selected) return [];
  const { steps, byIndex } = buildStepIndexes(calcSteps);
  return selected.sources.flatMap((source, sourceIndex) => {
    const step = byIndex.get(source.stepIndex);
    if (!step) {
      return [{
        id: `source-${sourceIndex}`,
        source,
        cards: [{
          id: `selected-${selected.personId}-${sourceIndex}`,
          personId: selected.personId,
          name: selected.name,
          share: source,
          label: '최종 취득',
          relation: getRelStr(source.relation, source.decDeathDate) || source.relation || '상속인',
          lawEra: source.lawEra,
        }],
      }];
    }

    return getBreakdownShares(step, selected.personId, source).flatMap(({ share, breakdown }, breakdownIndex) => {
      const prefixPaths = buildPrefixPaths(
        steps,
        step,
        breakdown ? { n: breakdown.inN, d: breakdown.inD } : null
      );
      return prefixPaths.map((prefix, pathIndex) => ({
        id: `${sourceIndex}-${breakdownIndex}-${pathIndex}`,
        source: { ...source, ...share },
        cards: [
          ...prefix,
          {
            id: `selected-${selected.personId}-${sourceIndex}-${breakdownIndex}-${pathIndex}`,
            personId: selected.personId,
            name: selected.name,
            share,
            label: '최종 취득',
            relation: getRelStr(source.relation, source.decDeathDate) || source.relation || '상속인',
            lawEra: source.lawEra,
          },
        ],
      }));
    });
  });
};

const LineagePanel = ({
  selected,
  lineagePaths,
  handleNavigate,
}) => (
  <aside className="w-[360px] shrink-0 border-r border-[#e9e9e7] bg-[#fbfbfa] p-4 dark:border-neutral-600 dark:bg-neutral-950/30">
    {selected ? (
      <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
        <div className="border-b border-[#e9e9e7] pb-3 dark:border-neutral-700">
          <div className="flex items-baseline justify-between gap-3">
            <button
              type="button"
              onClick={() => handleNavigate?.(selected.personId)}
              className="min-w-0 truncate text-left text-[20px] font-black hover:text-blue-700 hover:underline dark:hover:text-blue-300"
            >
              {selected.name}
            </button>
            <span className="shrink-0 text-[18px] font-black text-[#3f5f8a] dark:text-blue-300">{formatShare(selected.total)}</span>
          </div>
          <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">최초 피상속인부터 선택자까지 내려온 취득 계보</div>
        </div>

        <div className="mt-4 space-y-4">
          {lineagePaths.length > 0 ? (
            lineagePaths.map((path, index) => (
              <LineagePath
                key={path.id}
                path={path}
                pathIndex={index}
                showTitle={lineagePaths.length > 1}
                handleNavigate={handleNavigate}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#d9d6d0] bg-white p-3 text-[12px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
              표시할 취득 계보가 없습니다.
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="rounded-lg border border-dashed border-[#d9d6d0] bg-white p-4 text-[12px] text-[#787774] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        상속인을 선택하면 취득 계보가 표시됩니다.
      </div>
    )}
  </aside>
);

const LineagePath = ({ path, pathIndex, showTitle, handleNavigate }) => (
  <div className="space-y-2">
    {showTitle && (
      <div className="px-1 text-[11px] font-black text-[#9b9a97] dark:text-neutral-400">
        경로 {pathIndex + 1}
      </div>
    )}
    <div className="space-y-1.5">
      {path.cards.map((card, index) => (
        <React.Fragment key={`${path.id}-${card.id}-${index}`}>
          <div className={`rounded-lg border px-3 py-2 ${
            index === path.cards.length - 1
              ? 'border-[#37352f] bg-white dark:border-neutral-100 dark:bg-neutral-900'
              : 'border-[#e9e9e7] bg-white dark:border-neutral-700 dark:bg-neutral-900'
          }`}>
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => card.personId && handleNavigate?.(card.personId)}
                className="min-w-0 truncate text-left text-[13px] font-black hover:text-blue-700 hover:underline dark:hover:text-blue-300"
              >
                {card.name}
              </button>
              <span className="shrink-0 text-[13px] font-black text-[#3f5f8a] dark:text-blue-300">
                {formatShare(card.share)}
              </span>
            </div>
          </div>
          {index < path.cards.length - 1 && (
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#9b9a97] dark:text-neutral-500">
              <span className="h-4 w-px bg-[#d9d6d0] dark:bg-neutral-700" />
              <span>↓ {path.cards[index + 1]?.label || '취득'}</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default function AcquisitionSumPanel({
  calcSteps = [],
  finalShares = null,
  tree = null,
  handleNavigate,
  searchQuery = '',
  viewMode = 'sum',
  finalContent = null,
}) {
  const results = React.useMemo(
    () => buildResults({ calcSteps, finalShares, tree, query: searchQuery || '' }),
    [calcSteps, finalShares, tree, searchQuery]
  );
  const [selectedPersonId, setSelectedPersonId] = React.useState('');

  const selected = results.find((result) => result.personId === selectedPersonId) || results[0] || null;
  const lineagePathsByPersonId = React.useMemo(() => {
    const map = new Map();
    results.forEach((result) => {
      map.set(result.personId, buildLineagePaths(calcSteps, result));
    });
    return map;
  }, [calcSteps, results]);
  const lineagePaths = React.useMemo(
    () => (selected ? lineagePathsByPersonId.get(selected.personId) || [] : []),
    [lineagePathsByPersonId, selected]
  );
  React.useEffect(() => {
    if (!selected && selectedPersonId) {
      setSelectedPersonId('');
      return;
    }
    if (results.length > 0 && !results.some((result) => result.personId === selectedPersonId)) {
      setSelectedPersonId(results[0].personId);
    }
  }, [results, selected, selectedPersonId]);

  const getLineagePaths = (result) => lineagePathsByPersonId.get(result.personId) || [];
  const isMultiPath = (result) => getLineagePaths(result).length > 1;
  const renderFormula = (result) => {
    const paths = getLineagePaths(result);
    if (paths.length > result.sources.length) {
      return paths.map((path, index) => {
        const names = path.cards.map((card) => card.name).filter(Boolean);
        const finalShare = path.cards[path.cards.length - 1]?.share || path.source;
        return `경로 ${index + 1} ${names.join('→')} ${formatShare(finalShare)}`;
      }).join(' + ');
    }
    return result.sources
      .map((source) => `${source.decName} ${formatShare(source)}`)
      .join(' + ');
  };
  const multiResults = results.filter(isMultiPath);

  if (results.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-[#d9d9d5] bg-white text-[14px] text-[#787774] dark:border-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-300">
        표시할 취득 합산 내역이 없습니다.
      </div>
    );
  }

  return (
    <section className="flex min-h-[640px] overflow-visible rounded-xl border border-[#e9e9e7] bg-white text-[#37352f] dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-200">
      <LineagePanel
        selected={selected}
        lineagePaths={lineagePaths}
        handleNavigate={handleNavigate}
      />

      <main className="min-w-0 flex-1 space-y-6 p-5">
        {viewMode === 'final' ? (
          finalContent
        ) : (
          <>
            <div>
              <h2 className="text-[18px] font-black">취득 합산</h2>
              <p className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">
                사건 검토에서 산출된 취득분을 최종 상속인별로 더해 보여줍니다.
              </p>
            </div>

            {multiResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 text-[13px] font-black">
                  <span>복수경로 취득자</span>
                  <span className="text-[11px] font-bold text-[#9b9a97] dark:text-neutral-400">{multiResults.length}명</span>
                </div>
                <table className="w-full table-fixed border-collapse text-[13px]">
                  <thead className="bg-[#fcfcfb] dark:bg-neutral-800/80">
                    <tr>
                      <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">상속인</th>
                      <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">최종지분</th>
                      <th className="border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">합산식</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiResults.map((result) => (
                      <tr
                        key={`multi-${result.personId}`}
                        className={`cursor-pointer transition-colors ${selected?.personId === result.personId ? 'bg-[#f0f6ff] dark:bg-blue-950/20' : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/40'}`}
                        onClick={() => setSelectedPersonId(result.personId)}
                      >
                        <td className="border border-[#e9e9e7] p-2.5 dark:border-neutral-600">
                          <div className="font-black">{result.name}</div>
                          <div className="mt-0.5 truncate text-[11px] font-medium text-[#9b9a97] dark:text-neutral-400">{getNameContext(result, tree)}</div>
                        </td>
                        <td className="border border-[#e9e9e7] p-2.5 font-black text-[#3f5f8a] dark:border-neutral-600 dark:text-blue-300">{formatShare(result.total)}</td>
                        <td className="truncate border border-[#e9e9e7] p-2.5 font-bold text-[#504f4c] dark:border-neutral-600 dark:text-neutral-300">{renderFormula(result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-[13px] font-black">
                <span>전체 취득자</span>
                <span className="text-[11px] font-bold text-[#9b9a97] dark:text-neutral-400">{results.length}명</span>
              </div>
              <table className="w-full table-fixed border-collapse text-[13px]">
                <thead className="bg-[#fcfcfb] dark:bg-neutral-800/80">
                  <tr>
                    <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">상속인</th>
                    <th className="w-[18%] border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">최종지분</th>
                    <th className="border border-[#e9e9e7] p-2.5 text-left font-medium text-[#787774] dark:border-neutral-600">취득 명세</th>
                    <th className="w-[14%] border border-[#e9e9e7] p-2.5 text-center font-medium text-[#787774] dark:border-neutral-600">구분</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr
                      key={`sum-${result.personId}`}
                      className={`cursor-pointer transition-colors ${selected?.personId === result.personId ? 'bg-[#f0f6ff] dark:bg-blue-950/20' : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/40'}`}
                      onClick={() => setSelectedPersonId(result.personId)}
                    >
                      <td className="border border-[#e9e9e7] p-2.5 dark:border-neutral-600">
                        <div className="font-black">{result.name}</div>
                        <div className="mt-0.5 truncate text-[11px] font-medium text-[#9b9a97] dark:text-neutral-400">{getNameContext(result, tree)}</div>
                      </td>
                      <td className="border border-[#e9e9e7] p-2.5 font-black text-[#3f5f8a] dark:border-neutral-600 dark:text-blue-300">{formatShare(result.total)}</td>
                      <td className="truncate border border-[#e9e9e7] p-2.5 font-bold text-[#504f4c] dark:border-neutral-600 dark:text-neutral-300">{renderFormula(result)}</td>
                      <td className="border border-[#e9e9e7] p-2.5 text-center dark:border-neutral-600">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${isMultiPath(result) ? 'bg-[#fff5e6] text-[#8a5a1f] dark:bg-yellow-950/30 dark:text-yellow-300' : 'bg-[#f1f1ef] text-[#787774] dark:bg-neutral-800 dark:text-neutral-300'}`}>
                          {isMultiPath(result) ? '복수경로' : '단일경로'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </section>
  );
}
