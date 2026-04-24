import React, { useMemo } from 'react';
import { getLawEra, getRelStr, formatKorDate, math } from '../engine/utils';
import { collectMissingHeirNames } from '../utils/missingHeirStatus';

const lawLabel = (era) => {
  if (era === '1960') return '구민법';
  if (era === '1979') return '1979 개정민법';
  if (era === '1991') return '현행민법';
  return `${era} 기준`;
};

const buildResultGroups = (calcSteps = []) => {
  const heirMap = new Map();

  calcSteps.forEach((step) => {
    (step.dists || []).forEach((dist) => {
      if (!dist || dist.n <= 0) return;
      const key = dist.h.personId || dist.h.id;
      if (!key) return;
      if (!heirMap.has(key)) {
        heirMap.set(key, {
          personId: key,
          id: dist.h.id || key,
          name: dist.h.name,
          relation: dist.h._origRelation || dist.h.relation,
          isDeceased: dist.h.isDeceased,
          sources: [],
        });
      }
      heirMap.get(key).sources.push({
        decName: step.dec?.name,
        decDeathDate: step.dec?.deathDate,
        relation: dist.h._origRelation || dist.h.relation,
        lawEra: step.lawEra,
        mod: dist.mod || '',
        n: dist.n,
        d: dist.d,
      });
    });
  });

  return Array.from(heirMap.values()).filter((item) => !item.isDeceased);
};

const flattenTree = (tree) => {
  if (!tree) return [];
  const walk = (node, depth = 0, prefix = '1') => {
    let list = [{ ...node, depth, prefix }];
    (node.heirs || []).forEach((child, index) => {
      list = list.concat(walk(child, depth + 1, `${prefix}-${index + 1}`));
    });
    return list;
  };
  return walk(tree);
};

const exclusionDict = {
  predeceased: '선사망',
  renounce: '상속포기',
  unworthy: '상속결격',
  disqualified: '상속결격',
  lost: '상속권 상실',
};

const translateExclusion = (value) => exclusionDict[value] || value || '-';

const renderFinalShareRows = (tree, finalShares) => {
  const rows = [];

  (finalShares?.direct || []).forEach((share) => {
    rows.push(
      <tr key={`direct-${share.id || share.personId}`}>
        <td className="border border-black px-3 py-2 font-bold">{share.name} <span className="font-normal text-gray-600">[{getRelStr(share.relation, tree?.deathDate)}]</span></td>
        <td className="border border-black px-3 py-2 text-center">{share.n} / {share.d}</td>
        <td className="border border-black px-3 py-2 text-center font-bold">{share.un} / {share.ud}</td>
      </tr>
    );
  });

  (finalShares?.subGroups || []).forEach((group, index) => {
    rows.push(
      <tr key={`group-head-${index}`} className="bg-gray-50">
        <td colSpan={3} className="border border-black px-3 py-2 font-bold text-gray-700">
          [{group.ancestor?.name}] {formatKorDate(group.ancestor?.deathDate)} 사망으로 인한 {group.type}
        </td>
      </tr>
    );

    (group.shares || []).forEach((share) => {
      rows.push(
        <tr key={`group-share-${group.ancestor?.id}-${share.id || share.personId}`}>
          <td className="border border-black px-3 py-2 pl-6 font-bold">└ {share.name} <span className="font-normal text-gray-600">[{getRelStr(share.relation, group.ancestor?.deathDate)}]</span></td>
          <td className="border border-black px-3 py-2 text-center">{share.n} / {share.d}</td>
          <td className="border border-black px-3 py-2 text-center font-bold">{share.un} / {share.ud}</td>
        </tr>
      );
    });
  });

  return rows;
};

const PrintReport = ({
  tree,
  activeTab,
  finalShares,
  calcSteps,
  amountCalculations,
  summaryViewMode = 'structure',
}) => {
  const reportTitle = {
    input: '상속인 명부 및 가계도 현황',
    tree: '상속인 명부 및 가계도 현황',
    calc: '상속지분 산출 내역서 (단계별)',
    result: '상속지분 취득 경로 및 최종 결과',
    summary: summaryViewMode === 'path' ? '법정 상속분 취득 경로표' : '법정 상속분 요약표',
    amount: '구체적 상속분(금액) 계산표',
  }[activeTab] || '상속지분 계산 보고서';

  const missingHeirNames = useMemo(() => collectMissingHeirNames(tree), [tree]);
  const hasMissingHeir = missingHeirNames.length > 0;
  const dynamicReportTitle = hasMissingHeir && ['calc', 'result', 'summary', 'amount'].includes(activeTab)
    ? `${reportTitle} [주의: 미완성]`
    : reportTitle;

  const flatHeirs = useMemo(() => flattenTree(tree), [tree]);
  const resultGroups = useMemo(() => buildResultGroups(calcSteps), [calcSteps]);

  const commonResultDenominator = useMemo(() => {
    return resultGroups.reduce((acc, result) => {
      const total = result.sources.reduce((sum, source) => {
        const [nn, nd] = math.add(sum.n, sum.d, source.n, source.d);
        return { n: nn, d: nd };
      }, { n: 0, d: 1 });
      return total.n > 0 ? math.lcm(acc, total.d) : acc;
    }, 1);
  }, [resultGroups]);

  if (!tree) return null;

  return (
    <div className="hidden w-full bg-white font-sans text-[12px] leading-relaxed text-black print:block">
      <div className="mb-2 text-center">
        <h1 className="mb-4 inline-block border-b-2 border-black px-4 pb-2 text-[24px] font-bold">{dynamicReportTitle}</h1>
      </div>

      {hasMissingHeir && (
        <div className="mb-4 border-2 border-red-600 bg-red-50 p-3 text-center text-red-800" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
          <div className="font-bold">[경고] 하위 상속인(대습/재상속인)이 누락된 사망자가 존재합니다. 본 문서는 미완성된 임시 계산 결과이므로 실무 반영에 주의하십시오.</div>
          <div className="mt-1 text-[11px]">확정 필요: {missingHeirNames.join(', ')}의 하위 상속인 정보를 확정해 주세요.</div>
        </div>
      )}

      <table className="mb-6 w-full border-collapse border-2 border-black text-[12px]">
        <tbody>
          <tr>
            <th className="w-[15%] border border-black bg-gray-100 px-3 py-1.5 text-left font-bold">사건번호</th>
            <td className="w-[35%] border border-black px-3 py-1.5 font-medium">{tree.caseNo || '미입력'}</td>
            <th className="w-[15%] border border-black bg-gray-100 px-3 py-1.5 text-left font-bold">피상속인</th>
            <td className="w-[35%] border border-black px-3 py-1.5 font-bold text-blue-800">{tree.name || '미입력'}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 px-3 py-1.5 text-left font-bold">사망일자</th>
            <td className="border border-black px-3 py-1.5 font-medium">{tree.deathDate || '미입력'}</td>
            <th className="border border-black bg-gray-100 px-3 py-1.5 text-left font-bold">적용법령</th>
            <td className="border border-black px-3 py-1.5 font-medium">{lawLabel(getLawEra(tree.deathDate))}</td>
          </tr>
        </tbody>
      </table>

      {(activeTab === 'input' || activeTab === 'tree') && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="w-[8%] border border-black px-2 py-2">순번</th>
                <th className="w-[22%] border border-black px-2 py-2">상속인 성명</th>
                <th className="w-[12%] border border-black px-2 py-2">관계</th>
                <th className="w-[20%] border border-black px-2 py-2">생존 여부(사망일)</th>
                <th className="w-[20%] border border-black px-2 py-2">인적 사항</th>
                <th className="w-[18%] border border-black px-2 py-2">특수 조건</th>
              </tr>
            </thead>
            <tbody>
              {flatHeirs.map((heir) => (
                <tr key={heir.id} className="break-inside-avoid border-b border-gray-400">
                  <td className="border border-black px-2 py-1.5 text-center text-gray-600">{heir.prefix}</td>
                  <td className="border border-black px-2 py-1.5" style={{ paddingLeft: `${heir.depth * 12 + 8}px` }}>
                    {heir.depth > 0 && <span className="mr-1 text-gray-400">└</span>}
                    <span className="font-bold">{heir.name || '(이름없음)'}</span>
                  </td>
                  <td className="border border-black px-2 py-1.5 text-center">{heir.depth === 0 ? '피상속인' : getRelStr(heir.relation, tree.deathDate)}</td>
                  <td className="border border-black px-2 py-1.5 text-center">{heir.isDeceased ? `사망 (${heir.deathDate || '일자미상'})` : '생존'}</td>
                  <td className="border border-black px-2 py-1.5 text-center text-[10px]">
                    {heir.marriageDate && <div>혼인: {heir.marriageDate}</div>}
                    {heir.remarriageDate && <div>재혼: {heir.remarriageDate}</div>}
                    {heir.divorceDate && <div>이혼: {heir.divorceDate}</div>}
                    {heir.restoreDate && <div>복적: {heir.restoreDate}</div>}
                    {!heir.marriageDate && !heir.remarriageDate && !heir.divorceDate && !heir.restoreDate && '-'}
                  </td>
                  <td className="border border-black px-2 py-1.5 text-center text-[10px]">
                    {heir.isExcluded ? <span className="font-bold text-red-600">상속권 없음 ({translateExclusion(heir.exclusionOption)})</span> : ''}
                    {heir.isHoju ? <div className="font-bold text-blue-600">호주상속인</div> : ''}
                    {heir.isSameRegister === false ? <div className="text-orange-600">출가</div> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'calc' && Array.isArray(calcSteps) && (
        <div className="space-y-6">
          {calcSteps.map((step, index) => (
            <div key={`calc-${index}`} className="mb-6 break-inside-avoid">
              <div className="mb-2 text-[13px] font-bold">
                [STEP {index + 1}] 망 {step.dec?.name} ({formatKorDate(step.dec?.deathDate)} 사망) ─ 분배 대상 지분: {step.inN}/{step.inD}
              </div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead className="bg-gray-100 text-center font-bold">
                  <tr>
                    <th className="w-[15%] border border-black px-2 py-1.5">상속인</th>
                    <th className="w-[12%] border border-black px-2 py-1.5">관계</th>
                    <th className="w-[25%] border border-black px-2 py-1.5">계산식</th>
                    <th className="w-[18%] border border-black px-2 py-1.5">산출 지분</th>
                    <th className="w-[30%] border border-black px-2 py-1.5">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {(step.dists || []).map((dist, distIndex) => {
                    const memo = [];
                    if (dist.ex) memo.push(`상속권 없음(${translateExclusion(dist.ex)})`);
                    if (dist.h?.isDeceased && !dist.ex) memo.push('망인');
                    if (dist.mod) memo.push(dist.mod);
                    return (
                      <tr key={`dist-${distIndex}`}>
                        <td className="border border-black px-2 py-1.5 text-center font-bold">{dist.h?.name}</td>
                        <td className="border border-black px-2 py-1.5 text-center">{getRelStr(dist.h?.relation, step.dec?.deathDate)}</td>
                        <td className="border border-black px-2 py-1.5 text-center">{step.inN}/{step.inD} × {dist.sn}/{dist.sd}</td>
                        <td className="border border-black px-2 py-1.5 text-center font-bold">{dist.n}/{dist.d}</td>
                        <td className="border border-black px-2 py-1.5">{memo.join(', ') || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'result' && resultGroups.length > 0 && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="w-[18%] border border-black px-2 py-2">최종 생존 상속인</th>
                <th className="w-[52%] border border-black px-2 py-2">지분 취득 경로 및 산출 근거</th>
                <th className="w-[15%] border border-black px-2 py-2">{hasMissingHeir ? '가계산 합계' : '최종 합계'}</th>
                <th className="w-[15%] border border-black px-2 py-2">통분 지분</th>
              </tr>
            </thead>
            <tbody>
              {resultGroups.map((result) => {
                const total = result.sources.reduce((sum, source) => {
                  const [nn, nd] = math.add(sum.n, sum.d, source.n, source.d);
                  return { n: nn, d: nd };
                }, { n: 0, d: 1 });
                const unifiedN = total.n * (commonResultDenominator / total.d);
                return (
                  <tr key={`result-${result.personId}`} className="align-top">
                    <td className="border border-black px-2 py-2 text-center">
                      <span className="font-bold">{result.name}</span><br />
                      <span className="text-gray-600">[{getRelStr(result.relation, tree.deathDate)}]</span>
                    </td>
                    <td className="border border-black px-2 py-2 text-left">
                      {result.sources.map((source, sourceIndex) => (
                        <div key={`source-${sourceIndex}`} className={sourceIndex > 0 ? 'mt-1 border-t border-dashed border-gray-300 pt-1' : ''}>
                          망 {source.decName}의 {getRelStr(source.relation, source.decDeathDate)}으로 {source.n}/{source.d}
                          <span className="ml-1 text-gray-500">({lawLabel(source.lawEra)}{source.mod ? `, ${source.mod}` : ''})</span>
                        </div>
                      ))}
                    </td>
                    <td className="border border-black px-2 py-2 text-center font-bold">{total.n} / {total.d}</td>
                    <td className="border border-black px-2 py-2 text-center font-bold">{unifiedN} / {commonResultDenominator}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'summary' && summaryViewMode === 'structure' && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="w-[40%] border border-black px-3 py-2">상속인 성명</th>
                <th className="w-[30%] border border-black px-3 py-2">{hasMissingHeir ? '현재 지분' : '최종 지분'}</th>
                <th className="w-[30%] border border-black px-3 py-2">통분 지분</th>
              </tr>
            </thead>
            <tbody>{renderFinalShareRows(tree, finalShares)}</tbody>
          </table>
        </div>
      )}

      {activeTab === 'summary' && summaryViewMode === 'path' && resultGroups.length > 0 && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="w-[18%] border border-black px-2 py-2">최종 상속인</th>
                <th className="w-[52%] border border-black px-2 py-2">지분 취득 경로</th>
                <th className="w-[15%] border border-black px-2 py-2">{hasMissingHeir ? '가계산 합계' : '최종 합계'}</th>
                <th className="w-[15%] border border-black px-2 py-2">통분 지분</th>
              </tr>
            </thead>
            <tbody>
              {resultGroups.map((result) => {
                const total = result.sources.reduce((sum, source) => {
                  const [nn, nd] = math.add(sum.n, sum.d, source.n, source.d);
                  return { n: nn, d: nd };
                }, { n: 0, d: 1 });
                const unifiedN = total.n * (commonResultDenominator / total.d);
                return (
                  <tr key={`summary-path-${result.personId}`} className="align-top">
                    <td className="border border-black px-2 py-2 text-center">
                      <span className="font-bold">{result.name}</span><br />
                      <span className="text-gray-600">[{getRelStr(result.relation, tree.deathDate)}]</span>
                    </td>
                    <td className="border border-black px-2 py-2 text-left">
                      {result.sources.map((source, sourceIndex) => (
                        <div key={`summary-path-source-${sourceIndex}`} className={sourceIndex > 0 ? 'mt-1 border-t border-dashed border-gray-300 pt-1' : ''}>
                          망 {source.decName}의 {getRelStr(source.relation, source.decDeathDate)}으로 {source.n}/{source.d}
                          <span className="ml-1 text-gray-500">({lawLabel(source.lawEra)}{source.mod ? `, ${source.mod}` : ''})</span>
                        </div>
                      ))}
                      {result.sources.length > 1 && (
                        <div className="mt-1 border-t border-gray-400 pt-1 font-bold">
                          = {result.sources.map((source) => `${source.n}/${source.d}`).join(' + ')} = {total.n}/{total.d}
                        </div>
                      )}
                    </td>
                    <td className="border border-black px-2 py-2 text-center font-bold">{total.n} / {total.d}</td>
                    <td className="border border-black px-2 py-2 text-center font-bold">{unifiedN} / {commonResultDenominator}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'amount' && amountCalculations && (
        <div className="mb-8">
          <div className="mb-2 text-[13px] font-bold">
            총 상속재산가액: {(amountCalculations.estateVal ?? 0).toLocaleString()}원
            (간주상속재산: {(amountCalculations.deemedEstate ?? 0).toLocaleString()}원)
          </div>
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="w-[20%] border border-black px-2 py-2">상속인</th>
                <th className="w-[15%] border border-black px-2 py-2">법정 지분</th>
                <th className="w-[20%] border border-black px-2 py-2">특별수익(-)</th>
                <th className="w-[20%] border border-black px-2 py-2">기여분(+)</th>
                <th className="w-[25%] border border-black px-2 py-2">구체적 상속금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {(amountCalculations.results || []).map((result, index) => (
                <tr key={`amount-${index}`}>
                  <td className="border border-black px-2 py-2 text-center font-bold">{result.name}</td>
                  <td className="border border-black px-2 py-2 text-center">{result.un} / {result.ud}</td>
                  <td className="border border-black px-2 py-2 text-right text-red-700">{result.specialBenefit > 0 ? result.specialBenefit.toLocaleString() : '0'}</td>
                  <td className="border border-black px-2 py-2 text-right text-green-700">{result.contribution > 0 ? result.contribution.toLocaleString() : '0'}</td>
                  <td className="border border-black px-2 py-2 text-right font-bold">{(result.finalAmount ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PrintReport;
