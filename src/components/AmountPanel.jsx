import React from 'react';
import { formatKorDate, isBefore } from '../engine/utils';

export default function AmountPanel({
  tree,
  finalShares,
  amountCalculations,
  propertyValue,
  setPropertyValue,
  specialBenefits,
  setSpecialBenefits,
  contributions,
  setContributions,
}) {
  const resultMap = new Map();
  (amountCalculations?.results || []).forEach((r) => resultMap.set(r.personId, r));

  const orderedRows = [];
  const printedAmtIds = new Set();
  const pushAmtRow = (share) => {
    if (!share || printedAmtIds.has(share.personId)) return;
    const res = resultMap.get(share.personId);
    if (!res) return;
    printedAmtIds.add(share.personId);
    orderedRows.push({ type: 'row', res });
  };

  (finalShares.direct || []).forEach(pushAmtRow);
  (finalShares.subGroups || []).forEach((group) => {
    if (group.shares.some((s) => resultMap.has(s.personId))) {
      const isSubst = group.ancestor.deathDate && isBefore(group.ancestor.deathDate, tree.deathDate);
      orderedRows.push({
        type: 'header',
        ancestor: group.ancestor,
        label: isSubst ? '대습상속인' : '사망상속인',
      });
      group.shares.forEach(pushAmtRow);
    }
  });

  const renderAmtInput = (personId, state, setter, colorClass, ringClass) => (
    <input
      type="text"
      placeholder="0"
      value={state[personId] || ''}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter((prev) => ({ ...prev, [personId]: val ? Number(val).toLocaleString() : '' }));
      }}
      className={`w-full px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-600 rounded text-right text-[13px] font-mono bg-white dark:bg-neutral-900 ${colorClass} ${ringClass} outline-none focus:ring-1 transition-all`}
    />
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-4 p-4 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-xl border border-[#e9e9e7] dark:border-neutral-700">
        <span className="text-[13px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap shrink-0">상속재산가액</span>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="예: 1,000,000,000"
            value={propertyValue}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setPropertyValue(val ? Number(val).toLocaleString() : '');
            }}
            className="flex-1 max-w-xs px-3 py-2 text-[14px] border border-[#e9e9e7] dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-200 text-right font-mono outline-none"
          />
          <span className="text-[13px] text-neutral-500 font-medium">원</span>
          {amountCalculations && (
            <span className="text-[12px] text-[#787774] dark:text-neutral-400 ml-2">
              간주상속재산: <span className="font-bold text-[#37352f] dark:text-neutral-200 font-mono">{amountCalculations.deemedEstate.toLocaleString()}</span> 원
            </span>
          )}
        </div>
      </div>

      {orderedRows.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 dark:text-neutral-500 text-[14px]">상속인이 없습니다.</div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <table className="w-full text-[13px] border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-bold border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-3 text-center w-[22%]">상속인</th>
                <th className="px-4 py-3 text-center w-[14%]">법정지분</th>
                <th className="px-4 py-3 text-center w-[18%]">특별수익 (-)</th>
                <th className="px-4 py-3 text-center w-[18%]">기여분 (+)</th>
                <th className="px-4 py-3 text-right w-[28%] text-neutral-800 dark:text-neutral-200">구체적 상속분 산정액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f1ef] dark:divide-neutral-700/50">
              {orderedRows.map((item, idx) => {
                if (item.type === 'header') {
                  return (
                    <tr key={`hdr-${idx}`} className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                      <td colSpan="5" className="px-4 py-2 text-left text-[#504f4c] dark:text-neutral-400 text-[12px]">
                        [{item.ancestor.name}] {formatKorDate(item.ancestor.deathDate)} 사망에 따른 {item.label}
                      </td>
                    </tr>
                  );
                }

                const { res } = item;
                return (
                  <tr key={res.personId} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-center font-bold text-neutral-800 dark:text-neutral-200">{res.name}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-[#504f4c] dark:text-neutral-400">{res.un} / {res.ud}</td>
                    <td className="px-3 py-2">{renderAmtInput(res.personId, specialBenefits, setSpecialBenefits, 'text-neutral-600 dark:text-neutral-400', 'focus:ring-neutral-300')}</td>
                    <td className="px-3 py-2">{renderAmtInput(res.personId, contributions, setContributions, 'text-neutral-600 dark:text-neutral-400', 'focus:ring-neutral-300')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[15px] text-neutral-900 dark:text-neutral-100">
                      {res.finalAmount.toLocaleString()} <span className="text-[12px] font-normal text-neutral-400">원</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#f8f9fa] dark:bg-neutral-900/50 border-t-2 border-[#d4d4d4] dark:border-neutral-600">
              <tr>
                <td colSpan="4" className="px-4 py-3 text-right text-[13px] font-bold text-[#787774] dark:text-neutral-400">합계:</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-[16px] text-[#37352f] dark:text-neutral-200">
                  {amountCalculations?.totalDistributed?.toLocaleString() ?? '0'} <span className="text-[12px] font-normal text-neutral-400">원</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
