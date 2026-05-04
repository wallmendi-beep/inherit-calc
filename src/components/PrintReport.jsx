import React, { useMemo } from 'react';
import { getLawEra, getRelStr, formatKorDate, isBefore, math } from '../engine/utils';
import { collectMissingHeirNames } from '../utils/missingHeirStatus';

const lawLabel = (era) => {
  if (era === '1960') return '구민법(1960년 제정)';
  if (era === '1979') return '1979년 개정 민법';
  if (era === '1991') return '현행 민법';
  return era ? `${era}년 기준` : '민법';
};

const lawLabelShort = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979년';
  if (era === '1991') return '현행';
  return era || '';
};

const exclusionDict = {
  predeceased:                  '선사망',
  renounce:                     '상속포기',
  unworthy:                     '상속결격',
  disqualified:                 '상속결격',
  lost:                         '상속권 상실',
  remarried:                    '재혼으로 인한 대습권 소멸',
  blocked_husband_substitution: '구민법상 사위 대습 불가',
};
const translateExclusion = (val) => exclusionDict[val] || val || '제외';

const PrintReport = ({ tree, activeTab, finalShares, calcSteps, amountCalculations, summaryViewMode = 'structure' }) => {
  const reportTitle = {
    input:       '상속인 명부 및 가계 연혁',
    tree:        '상속지분 산출 내역서',
    calc:        '상속지분 산출 내역서 (단계별)',
    summary:     '상속지분 요약표',
    amount:      '구체적 상속분 정산서',
  }[activeTab] || '상속지분 계산 보고서';

  const missingHeirNames = useMemo(() => {
    return collectMissingHeirNames(tree);
  }, [tree]);
  const hasMissingHeir = missingHeirNames.length > 0;

  const dynamicReportTitle = hasMissingHeir && ['tree', 'summary'].includes(activeTab)
    ? `${reportTitle} [미완성]`
    : reportTitle;

  const flatHeirs = useMemo(() => {
    if (!tree) return [];
    const flatten = (node, depth = 0, prefix = '1') => {
      let list = [{ ...node, depth, prefix }];
      if (node.heirs) node.heirs.forEach((h, i) => { list = list.concat(flatten(h, depth + 1, `${prefix}-${i + 1}`)); });
      return list;
    };
    return flatten(tree);
  }, [tree]);

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans text-[12px] leading-relaxed">

      {/* 문서 제목 */}
      <div className="mb-2 text-center">
        <h1 className="text-[24px] font-bold border-b-2 border-black pb-2 inline-block mb-4 px-4">{dynamicReportTitle}</h1>
      </div>

      {/* 미완성 경고 배너 */}
      {hasMissingHeir && (
        <div className="mb-4 border-2 border-red-600 bg-red-50 p-2 text-center text-red-800 font-bold" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
          【미완성 계산】 후속 상속인이 확정되지 않은 항목이 있습니다. 실무 적용 전 반드시 확인하십시오.
          <div className="mt-1 font-normal text-[11px]">
            확인 필요: {missingHeirNames.map((n, i) => <span key={i} className="font-bold">{i > 0 ? ', ' : ''}{n}</span>)}
          </div>
        </div>
      )}

      {/* 사건 정보 */}
      <table className="w-full border-collapse border-2 border-black mb-6 text-[12px]">
        <tbody>
          <tr>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left w-[15%] font-bold">사건번호</th>
            <td className="border border-black py-1.5 px-3 w-[35%] font-medium">{tree.caseNo || '—'}</td>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left w-[15%] font-bold">피상속인</th>
            <td className="border border-black py-1.5 px-3 w-[35%] font-bold">{tree.name || '—'}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left font-bold">사망일자</th>
            <td className="border border-black py-1.5 px-3 font-medium">{tree.deathDate || '—'}</td>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left font-bold">적용 민법</th>
            <td className="border border-black py-1.5 px-3 font-medium">{lawLabel(getLawEra(tree.deathDate))}</td>
          </tr>
        </tbody>
      </table>

      {/* 데이터 입력 — 상속인 명부 */}
      {activeTab === 'input' && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-2 w-[8%]">번호</th>
                <th className="border border-black py-2 px-2 w-[22%]">성명</th>
                <th className="border border-black py-2 px-2 w-[12%]">관계</th>
                <th className="border border-black py-2 px-2 w-[20%]">생사 여부 (사망일)</th>
                <th className="border border-black py-2 px-2 w-[20%]">호적 연혁</th>
                <th className="border border-black py-2 px-2 w-[18%]">비고</th>
              </tr>
            </thead>
            <tbody>
              {flatHeirs.map(h => (
                <tr key={h.id} className="border-b border-gray-400 break-inside-avoid">
                  <td className="border border-black py-1.5 px-2 text-center text-gray-500">{h.prefix}</td>
                  <td className="border border-black py-1.5 px-2" style={{ paddingLeft: `${(h.depth * 12) + 8}px` }}>
                    {h.depth > 0 && <span className="text-gray-400 mr-1">└</span>}
                    <span className="font-bold">{h.name || '(미입력)'}</span>
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center">
                    {h.depth === 0 ? '피상속인' : getRelStr(h.relation, tree.deathDate)}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center">
                    {h.isDeceased ? `사망 (${h.deathDate || '일자 미확인'})` : '생존'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                    {h.marriageDate && <div>혼인: {h.marriageDate}</div>}
                    {h.remarriageDate && <div>재혼: {h.remarriageDate}</div>}
                    {h.divorceDate && <div>이혼: {h.divorceDate}</div>}
                    {h.restoreDate && <div>복적: {h.restoreDate}</div>}
                    {!h.marriageDate && !h.remarriageDate && !h.divorceDate && !h.restoreDate && '—'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                    {h.isExcluded && <span className="text-red-600 font-bold">상속권 없음 ({translateExclusion(h.exclusionOption)})</span>}
                    {h.isHoju && <div className="text-blue-700 font-bold">호주상속인</div>}
                    {h.isSameRegister === false && <div className="text-orange-600">비동일가적(출가)</div>}
                    {!h.isExcluded && !h.isHoju && h.isSameRegister !== false && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사건 검토 — STEP별 지분 산출표 */}
      {activeTab === 'tree' && calcSteps && calcSteps.length > 0 && (() => {
        const continuationIds = new Set(
          calcSteps.map(s => s.dec?.personId || s.dec?.id).filter(Boolean)
        );
        return (
          <div className="space-y-6">
            {calcSteps.map((s, i) => {
              const era = getLawEra(s.dec?.deathDate);
              const activeDists = (s.dists || []).filter(d => !d.ex && d.n > 0);
              const excludedDists = (s.dists || []).filter(d => (d.ex || d.n === 0) && d.h?.name);
              const innerLCM = activeDists.reduce((acc, d) => (d.sd ? math.lcm(acc, d.sd) : acc), 1);
              return (
                <div key={`tree-step-${i}`} className="break-inside-avoid">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-3 border-b-2 border-black pb-1">
                    <span className="text-[11px] font-bold text-gray-500">제{i + 1}사건</span>
                    <span className="text-[13px] font-black">망 {s.dec?.name}</span>
                    <span className="text-[11px] text-gray-600">{formatKorDate(s.dec?.deathDate)} 사망</span>
                    <span className="text-[11px] font-bold">분배 지분 {s.inN}/{s.inD}</span>
                    <span className="rounded border border-gray-400 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{lawLabel(era)}</span>
                  </div>
                  <table className="w-full border-collapse border border-black text-[11px]">
                    <thead className="bg-gray-100 text-center font-bold">
                      <tr>
                        <th className="border border-black py-1.5 px-2 w-[15%]">상속인</th>
                        <th className="border border-black py-1.5 px-2 w-[11%]">관계</th>
                        <th className="border border-black py-1.5 px-2 w-[24%]">계산식</th>
                        <th className="border border-black py-1.5 px-2 w-[15%]">취득 지분</th>
                        <th className="border border-black py-1.5 px-2 w-[35%]">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDists.map((d, di) => {
                        const pid = d.h?.personId || d.h?.id;
                        const hasContinuation = pid && continuationIds.has(pid);
                        const isPredeceased = d.h?.deathDate && s.dec?.deathDate && isBefore(d.h.deathDate, s.dec.deathDate);
                        const continuationNote = hasContinuation
                          ? (isPredeceased ? '대습상속 개시' : '재상속 개시')
                          : '';
                        const innerScale = innerLCM && d.sd && innerLCM !== d.sd ? innerLCM / d.sd : 1;
                        const formula = `${s.inN}/${s.inD} × ${(d.sn || 0) * innerScale}/${innerLCM || d.sd || 1}`;
                        const notes = [d.mod, continuationNote].filter(Boolean);
                        return (
                          <tr key={`a-${di}`} className="break-inside-avoid">
                            <td className="border border-black py-1.5 px-2 text-center font-bold">{d.h?.name}</td>
                            <td className="border border-black py-1.5 px-2 text-center">{getRelStr(d.h?.relation, s.dec?.deathDate)}</td>
                            <td className="border border-black py-1.5 px-2 text-center font-mono">{formula}</td>
                            <td className="border border-black py-1.5 px-2 text-center font-bold">{d.n}/{d.d}</td>
                            <td className="border border-black py-1.5 px-2 text-left">{notes.join('  ·  ') || '균분'}</td>
                          </tr>
                        );
                      })}
                      {excludedDists.map((d, di) => (
                        <tr key={`e-${di}`} className="break-inside-avoid text-gray-400">
                          <td className="border border-black py-1.5 px-2 text-center line-through">{d.h?.name}</td>
                          <td className="border border-black py-1.5 px-2 text-center">{getRelStr(d.h?.relation, s.dec?.deathDate)}</td>
                          <td className="border border-black py-1.5 px-2 text-center">—</td>
                          <td className="border border-black py-1.5 px-2 text-center">—</td>
                          <td className="border border-black py-1.5 px-2 text-left text-[10px]">{translateExclusion(d.ex)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 계산 상세 — 단계별 산출 (기존 calc 탭용, 제거 전까지 유지) */}
      {activeTab === 'calc' && calcSteps && (
        <div className="space-y-6">
          {calcSteps.map((s, i) => (
            <div key={`calc-${i}`} className="mb-6 break-inside-avoid">
              <div className="font-bold text-[13px] mb-2">
                제{i + 1}사건 — 망 {s.dec.name} ({formatKorDate(s.dec.deathDate)} 사망)  분배 지분: {s.inN}/{s.inD}  [{lawLabelShort(getLawEra(s.dec.deathDate))}]
              </div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead className="bg-gray-100 text-center font-bold">
                  <tr>
                    <th className="border border-black py-1.5 px-2 w-[15%]">상속인</th>
                    <th className="border border-black py-1.5 px-2 w-[12%]">관계</th>
                    <th className="border border-black py-1.5 px-2 w-[25%]">계산식</th>
                    <th className="border border-black py-1.5 px-2 w-[18%]">취득 지분</th>
                    <th className="border border-black py-1.5 px-2 w-[30%]">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {s.dists.map((d, di) => {
                    const notes = [];
                    if (d.ex) notes.push(translateExclusion(d.ex));
                    else if (d.h.isDeceased) notes.push('망인');
                    if (d.mod) notes.push(d.mod);
                    return (
                      <tr key={di} className="break-inside-avoid">
                        <td className="border border-black py-1.5 px-2 text-center font-bold">{d.h.name}</td>
                        <td className="border border-black py-1.5 px-2 text-center">{getRelStr(d.h.relation, s.dec.deathDate)}</td>
                        <td className="border border-black py-1.5 px-2 text-center">{s.inN}/{s.inD} × {d.sn}/{d.sd}</td>
                        <td className="border border-black py-1.5 px-2 text-center font-bold">{d.n}/{d.d}</td>
                        <td className="border border-black py-1.5 px-2 text-left">{notes.join('  ·  ') || '균분'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* 지분 요약 — 구조형 */}
      {activeTab === 'summary' && summaryViewMode === 'structure' && finalShares && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-3 w-[40%]">상속인</th>
                <th className="border border-black py-2 px-3 w-[30%]">{hasMissingHeir ? '산출 지분' : '법정 지분'}</th>
                <th className="border border-black py-2 px-3 w-[30%]">{hasMissingHeir ? '산출 지분 (통분)' : '법정 지분 (통분)'}</th>
              </tr>
            </thead>
            <tbody>
              {finalShares.direct && finalShares.direct.map(f => (
                <tr key={f.id} className="break-inside-avoid">
                  <td className="border border-black py-2 px-3 font-bold">
                    {f.name} <span className="font-normal text-gray-600">[{getRelStr(f.relation, tree.deathDate)}]</span>
                  </td>
                  <td className="border border-black py-2 px-3 text-center">{f.n} / {f.d}</td>
                  <td className="border border-black py-2 px-3 text-center font-bold">{f.un} / {f.ud}</td>
                </tr>
              ))}
              {finalShares.subGroups && finalShares.subGroups.map((g, gi) => (
                <React.Fragment key={`sg-${gi}`}>
                  <tr className="bg-gray-50 break-inside-avoid">
                    <td colSpan="3" className="border border-black py-1.5 px-3 font-bold text-gray-700">
                      [{g.ancestor.name}] {formatKorDate(g.ancestor.deathDate)} 사망 — 대습·재상속 지분
                    </td>
                  </tr>
                  {g.shares.map(f => (
                    <tr key={f.id} className="break-inside-avoid">
                      <td className="border border-black py-2 px-3 pl-6 font-bold">
                        └ {f.name} <span className="font-normal text-gray-600">[{getRelStr(f.relation, g.ancestor.deathDate)}]</span>
                      </td>
                      <td className="border border-black py-2 px-3 text-center">{f.n} / {f.d}</td>
                      <td className="border border-black py-2 px-3 text-center font-bold">{f.un} / {f.ud}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 구체적 상속분 */}
      {activeTab === 'amount' && amountCalculations && (
        <div className="mb-8">
          <div className="mb-3 text-[12px]">
            <span className="font-bold">상속재산 총액: </span>{(amountCalculations?.estateVal ?? 0).toLocaleString()}원
            <span className="ml-4 font-bold">간주상속재산: </span>{(amountCalculations?.deemedEstate ?? 0).toLocaleString()}원
            <span className="ml-2 text-[10px] text-gray-600">(총액 + 특별수익 − 기여분)</span>
          </div>
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-2 w-[20%]">상속인</th>
                <th className="border border-black py-2 px-2 w-[15%]">법정 지분</th>
                <th className="border border-black py-2 px-2 w-[20%]">특별수익 공제(−)</th>
                <th className="border border-black py-2 px-2 w-[20%]">기여분 가산(+)</th>
                <th className="border border-black py-2 px-2 w-[25%]">구체적 상속액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {(amountCalculations?.results || []).map((r, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="border border-black py-2 px-2 text-center font-bold">{r.name}</td>
                  <td className="border border-black py-2 px-2 text-center">{r.un} / {r.ud}</td>
                  <td className="border border-black py-2 px-2 text-right text-red-700">
                    {r.specialBenefit > 0 ? r.specialBenefit.toLocaleString() : '—'}
                  </td>
                  <td className="border border-black py-2 px-2 text-right text-green-700">
                    {r.contribution > 0 ? r.contribution.toLocaleString() : '—'}
                  </td>
                  <td className="border border-black py-2 px-2 text-right font-bold">{(r?.finalAmount ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="break-inside-avoid">
              <tr className="bg-gray-50 font-bold">
                <td colSpan="4" className="border border-black py-2 px-2 text-right">합계:</td>
                <td className="border border-black py-2 px-2 text-right text-blue-800">{(amountCalculations.totalDistributed || 0).toLocaleString()}</td>
              </tr>
              {(amountCalculations.remainder || 0) > 0 && (
                <tr>
                  <td colSpan="4" className="border border-black py-1.5 px-2 text-right text-gray-600">
                    단수 미배분액 (원 미만 절사):
                  </td>
                  <td className="border border-black py-1.5 px-2 text-right text-red-600">{(amountCalculations.remainder || 0).toLocaleString()}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

    </div>
  );
};

export default PrintReport;
