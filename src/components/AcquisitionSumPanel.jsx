import React from 'react';
import { math, getRelStr } from '../engine/utils';

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '79년 민법';
  if (era === '1991') return '현행민법';
  return era || '';
};

const formatShare = (share) => `${share?.n ?? 0}/${share?.d ?? 1}`;

const addShares = (sources = []) => sources.reduce(
  (sum, source) => {
    const [n, d] = math.add(sum.n, sum.d, source.n, source.d);
    return { n, d };
  },
  { n: 0, d: 1 }
);

const buildHeirMap = (calcSteps = []) => {
  const map = new Map();
  calcSteps.forEach((step) => {
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

export default function AcquisitionSumPanel({
  calcSteps = [],
  finalShares = null,
  tree = null,
  handleNavigate,
  searchQuery = '',
}) {
  const results = React.useMemo(
    () => buildResults({ calcSteps, finalShares, tree, query: searchQuery || '' }),
    [calcSteps, finalShares, tree, searchQuery]
  );
  const multiResults = results.filter((result) => result.sources.length > 1);
  const [selectedPersonId, setSelectedPersonId] = React.useState('');

  const selected = results.find((result) => result.personId === selectedPersonId) || results[0] || null;
  React.useEffect(() => {
    if (!selected && selectedPersonId) {
      setSelectedPersonId('');
      return;
    }
    if (results.length > 0 && !results.some((result) => result.personId === selectedPersonId)) {
      setSelectedPersonId(results[0].personId);
    }
  }, [results, selected, selectedPersonId]);

  const renderFormula = (result) => result.sources
    .map((source) => `${source.decName} ${formatShare(source)}`)
    .join(' + ');

  if (results.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-[#d9d9d5] bg-white text-[14px] text-[#787774] dark:border-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-300">
        표시할 취득 합산 내역이 없습니다.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-[1fr_320px] gap-0 overflow-hidden rounded-xl border border-[#e9e9e7] bg-white text-[#37352f] dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-200">
      <main className="space-y-6 p-5">
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
                    <td className="border border-[#e9e9e7] p-2.5 font-black dark:border-neutral-600">{result.name}</td>
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
                  <td className="border border-[#e9e9e7] p-2.5 font-black dark:border-neutral-600">{result.name}</td>
                  <td className="border border-[#e9e9e7] p-2.5 font-black text-[#3f5f8a] dark:border-neutral-600 dark:text-blue-300">{formatShare(result.total)}</td>
                  <td className="truncate border border-[#e9e9e7] p-2.5 font-bold text-[#504f4c] dark:border-neutral-600 dark:text-neutral-300">{renderFormula(result)}</td>
                  <td className="border border-[#e9e9e7] p-2.5 text-center dark:border-neutral-600">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${result.sources.length > 1 ? 'bg-[#fff5e6] text-[#8a5a1f] dark:bg-yellow-950/30 dark:text-yellow-300' : 'bg-[#f1f1ef] text-[#787774] dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      {result.sources.length > 1 ? '복수경로' : '단일경로'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <aside className="border-l border-[#e9e9e7] bg-[#fbfbfa] p-4 dark:border-neutral-600 dark:bg-neutral-950/30">
        {selected && (
          <>
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
              <div className="mt-1 text-[12px] text-[#787774] dark:text-neutral-400">선택한 상속인의 취득분 합산 명세</div>
            </div>

            <div className="mt-4 space-y-2">
              {selected.sources.map((source, index) => (
                <div key={`${selected.personId}-${source.decPersonId}-${index}`} className="rounded-lg border border-[#e9e9e7] bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => source.decPersonId && handleNavigate?.(source.decPersonId)}
                      className="min-w-0 truncate text-left text-[13px] font-black hover:text-blue-700 hover:underline dark:hover:text-blue-300"
                    >
                      {source.decName} 사건
                    </button>
                    <span className="shrink-0 text-[13px] font-black text-[#3f5f8a] dark:text-blue-300">{formatShare(source)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#787774] dark:text-neutral-400">
                    {getRelStr(source.relation, source.decDeathDate) || source.relation || '상속인'}
                    {source.modifier ? ` · ${source.modifier}` : ''}
                    {lawLabel(source.lawEra) ? ` · ${lawLabel(source.lawEra)}` : ''}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border-2 border-[#37352f] bg-white p-3 dark:border-neutral-100 dark:bg-neutral-900">
              <div className="flex items-center justify-between text-[14px] font-black">
                <span>합계</span>
                <span>{formatShare(selected.total)}</span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-[#d9d6d0] bg-[#f7f6f3] p-3 text-[12px] leading-relaxed text-[#787774] dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400">
              분기 판단은 사건 검토에서 확인하고, 여기서는 최종 상속인별로 산출된 취득분을 더하는 과정만 검산합니다.
            </div>
          </>
        )}
      </aside>
    </section>
  );
}
