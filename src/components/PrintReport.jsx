import React, { useMemo } from 'react';
import { getLawEra, getRelStr, formatKorDate, math } from '../engine/utils';

const PrintReport = ({ tree, activeTab, finalShares, calcSteps, amountCalculations }) => {
  // 1. 공통 헤더 제목 매핑
  const reportTitle = {
    input: '상속인 명부 및 가계 연혁',
    tree: '상속인 명부 및 가계 연혁',
    calc: '상속지분 산출 내역서 (단계별)',
    result: '상속지분 취득 경로 및 최종 결과표',
    summary: '법정 상속분 요약표',
    amount: '구체적 상속분 (금액) 정산서'
  }[activeTab] || '상속지분 계산 보고서';

  // 🌟 영어로 된 제외 사유를 한글 실무 용어로 변환하는 사전
  const exclusionDict = {
    'predeceased': '선사망',
    'renounce': '상속포기',
    'unworthy': '상속결격',
    'disqualified': '상속결격',
    'lost': '대습원인 소멸(재혼 등)'
  };
  const translateExclusion = (val) => exclusionDict[val] || val;

  // 🌟 6단계 추가: 출력물에 불완전거리가 있는지 내부 검증
  const hasMissingHeir = useMemo(() => {
    if (!tree) return false;
    let missing = false;
    const check = (node) => {
      if (node.isDeceased && node.isExcluded !== true && (!node.heirs || node.heirs.length === 0)) missing = true;
      if (node.heirs) node.heirs.forEach(check);
    };
    check(tree);
    return missing;
  }, [tree]);

  // 최종 결과표 명칭도 불완전할 경우 변경 처리
  const dynamicReportTitle = hasMissingHeir && (activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary' || activeTab === 'amount')
    ? `${reportTitle} [주의: 미완성]`
    : reportTitle;

  // 2. 가계도 평탄화 (상속인 명부용)
  const flatHeirs = useMemo(() => {
    if (!tree) return [];
    const flatten = (node, depth = 0, prefix = '1') => {
      let list = [{ ...node, depth, prefix }];
      if (node.heirs) {
        node.heirs.forEach((h, i) => {
          list = list.concat(flatten(h, depth + 1, `${prefix}-${i + 1}`));
        });
      }
      return list;
    };
    return flatten(tree);
  }, [tree]);

  // 3. 계산결과 탭용 그룹화 로직
  const resultGroups = useMemo(() => {
    if (!calcSteps) return [];
    const heirMap = new Map();
    calcSteps.forEach(s => {
      s.dists.forEach(d => {
        if (d.n > 0) {
          const key = d.h.personId;
          if (!heirMap.has(key)) heirMap.set(key, { name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
          heirMap.get(key).sources.push({ decName: s.dec.name, decDeathDate: s.dec.deathDate, relation: d.h.relation, lawEra: s.lawEra, mod: d.mod || '', n: d.n, d: d.d });
        }
      });
    });
    return Array.from(heirMap.values()).filter(r => !r.isDeceased);
  }, [calcSteps]);

  // 인쇄 시에만 렌더링
  return (
    <div className="hidden print:block w-full bg-white text-black font-sans text-[12px] leading-relaxed">
      
      {/* [공통 헤더] 문서 타이틀 및 메타 정보 */}
      <div className="mb-2 text-center">
        <h1 className="text-[24px] font-bold border-b-2 border-black pb-2 inline-block mb-4 px-4">{dynamicReportTitle}</h1>
      </div>

      {/* 🌟 6단계 추가: 출력물 강제 경고 배너 */}
      {hasMissingHeir && (
        <div className="mb-4 border-2 border-red-600 bg-red-50 p-2 text-center text-red-800 font-bold" style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}>
          [경고] 하위 상속인(대습/재상속인)이 누락된 사망자가 존재합니다. 본 문서는 미완성된 임시 계산 결과이므로 실무 반영에 주의하십시오.
        </div>
      )}

      <table className="w-full border-collapse border-2 border-black mb-6 text-[12px]">
        <tbody>
          <tr>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left w-[15%] font-bold">사건번호</th>
            <td className="border border-black py-1.5 px-3 w-[35%] font-medium">{tree.caseNo || '미입력'}</td>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left w-[15%] font-bold">피상속인</th>
            <td className="border border-black py-1.5 px-3 w-[35%] font-bold text-blue-800">{tree.name || '미입력'}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left font-bold">사망일자</th>
            <td className="border border-black py-1.5 px-3 font-medium">{tree.deathDate || '미입력'}</td>
            <th className="border border-black bg-gray-100 py-1.5 px-3 text-left font-bold">적용법령</th>
            <td className="border border-black py-1.5 px-3 font-medium">{getLawEra(tree.deathDate)}년 민법</td>
          </tr>
        </tbody>
      </table>

      {/* ========================================== */}
      {/* 탭 1: 가계도 (상속인 명부 형태) */}
      {/* ========================================== */}
      {(activeTab === 'input' || activeTab === 'tree') && (
        <div className="mb-8"> {/* 🌟 전체 박스의 페이지 넘김 방지 옵션 제거 (용지 낭비 해결) */}
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-2 w-[8%]">순번</th>
                <th className="border border-black py-2 px-2 w-[22%]">상속인 성명</th>
                <th className="border border-black py-2 px-2 w-[12%]">관계</th>
                <th className="border border-black py-2 px-2 w-[20%]">생존 여부(사망일)</th>
                <th className="border border-black py-2 px-2 w-[20%]">호적 연혁</th>
                <th className="border border-black py-2 px-2 w-[18%]">특수 조건</th>
              </tr>
            </thead>
            <tbody>
              {flatHeirs.map(h => (
                // 🌟 tr(행) 단위로만 안 잘리게 break-inside-avoid 적용
                <tr key={h.id} className="border-b border-gray-400 break-inside-avoid">
                  <td className="border border-black py-1.5 px-2 text-center text-gray-600">{h.prefix}</td>
                  <td className="border border-black py-1.5 px-2" style={{ paddingLeft: `${(h.depth * 12) + 8}px` }}>
                    {h.depth > 0 && <span className="text-gray-400 mr-1">└</span>}
                    <span className="font-bold">{h.name || '(이름없음)'}</span>
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center">{h.depth === 0 ? '피상속인' : getRelStr(h.relation, tree.deathDate)}</td>
                  <td className="border border-black py-1.5 px-2 text-center">
                    {h.isDeceased ? `사망 (${h.deathDate || '일자미상'})` : '생존'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                    {h.marriageDate && <div>혼인: {h.marriageDate}</div>}
                    {h.remarriageDate && <div>재혼: {h.remarriageDate}</div>}
                    {h.divorceDate && <div>이혼: {h.divorceDate}</div>}
                    {h.restoreDate && <div>복적: {h.restoreDate}</div>}
                    {!h.marriageDate && !h.remarriageDate && !h.divorceDate && !h.restoreDate && '-'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                    {/* 🌟 번역기 적용 */}
                    {h.isExcluded ? <span className="text-red-600 font-bold">상속권 없음 ({translateExclusion(h.exclusionOption)})</span> : ''}
                    {h.isHoju ? <div className="text-blue-600 font-bold">호주상속인</div> : ''}
                    {h.isSameRegister === false ? <div className="text-orange-600">출가</div> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 2: 계산표 (단계별 산출) */}
      {/* ========================================== */}
      {activeTab === 'calc' && calcSteps && (
        <div className="space-y-6">
          {calcSteps.map((s, i) => (
            <div key={`calc-${i}`} className="mb-6 break-inside-avoid">
              <div className="font-bold text-[13px] mb-2">
                [STEP {i + 1}] 망 {s.dec.name} ({formatKorDate(s.dec.deathDate)} 사망) ─ 분배 대상 지분: {s.inN}/{s.inD}
              </div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead className="bg-gray-100 text-center font-bold">
                  <tr>
                    <th className="border border-black py-1.5 px-2 w-[15%]">상속인</th>
                    <th className="border border-black py-1.5 px-2 w-[12%]">관계</th>
                    <th className="border border-black py-1.5 px-2 w-[25%]">계산식</th>
                    <th className="border border-black py-1.5 px-2 w-[18%]">산출 지분</th>
                    <th className="border border-black py-1.5 px-2 w-[30%]">비고 (가감산 사유)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.dists.map((d, di) => {
                    const memo = [];
                    // 🌟 번역기 적용
                    if (d.ex) memo.push(`상속권 없음(${translateExclusion(d.ex)})`);
                    if (d.h.isDeceased && !d.ex) memo.push('망인');
                    if (d.mod) memo.push(d.mod);
                    return (
                      <tr key={di} className="break-inside-avoid">
                        <td className="border border-black py-1.5 px-2 text-center font-bold">{d.h.name}</td>
                        <td className="border border-black py-1.5 px-2 text-center">{getRelStr(d.h.relation, s.dec.deathDate)}</td>
                        <td className="border border-black py-1.5 px-2 text-center">{s.inN}/{s.inD} × {d.sn}/{d.sd}</td>
                        <td className="border border-black py-1.5 px-2 text-center font-bold">{d.n}/{d.d}</td>
                        <td className="border border-black py-1.5 px-2 text-left">{memo.join(', ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 3: 계산결과 (합산 표) */}
      {/* ========================================== */}
      {activeTab === 'result' && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-2 w-[18%]">최종 생존 상속인</th>
                <th className="border border-black py-2 px-2 w-[52%]">지분 취득 경로 및 산출 근거</th>
                <th className="border border-black py-2 px-2 w-[15%]">{hasMissingHeir ? '가계산 합계' : '최종 합계'}</th>
                <th className="border border-black py-2 px-2 w-[15%]">통분 지분</th>
              </tr>
            </thead>
            <tbody>
              {resultGroups.map((r, i) => {
                const total = r.sources.reduce((acc, s) => { const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d); return { n: nn, d: nd }; }, { n: 0, d: 1 });
                let commonD = 1;
                resultGroups.forEach(res => { const t = res.sources.reduce((acc, s) => { const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d); return { n: nn, d: nd }; }, { n: 0, d: 1 }); if (t.n > 0) commonD = math.lcm(commonD, t.d); });
                const unifiedN = total.n * (commonD / total.d);
                
                return (
                  <tr key={i} className="align-top break-inside-avoid">
                    <td className="border border-black py-2 px-2 text-center">
                      <span className="font-bold">{r.name}</span><br/>
                      <span className="text-gray-600">[{getRelStr(r.relation, tree.deathDate)}]</span>
                    </td>
                    <td className="border border-black py-2 px-2 text-left">
                      {r.sources.map((src, si) => (
                        <div key={si} className="mb-1">
                          • 망 {src.decName}의 {getRelStr(src.relation, src.decDeathDate)}로서 ({src.n}/{src.d})
                        </div>
                      ))}
                      {r.sources.length > 1 && (
                        <div className="mt-1 pt-1 border-t border-gray-300 font-bold">
                          = 합계: {total.n}/{total.d}
                        </div>
                      )}
                    </td>
                    <td className="border border-black py-2 px-2 text-center font-bold">{total.n}/{total.d}</td>
                    <td className="border border-black py-2 px-2 text-center font-bold">{unifiedN}/{commonD}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 4: 법정 상속분 요약 */}
      {/* ========================================== */}
      {activeTab === 'summary' && finalShares && (
        <div className="mb-8">
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-3 w-[40%]">상속인 성명</th>
                <th className="border border-black py-2 px-3 w-[30%]">{hasMissingHeir ? '산출 지분 (통분 전)' : '최종 지분 (통분 전)'}</th>
                <th className="border border-black py-2 px-3 w-[30%]">{hasMissingHeir ? '산출 지분 (통분 후)' : '최종 지분 (통분 후)'}</th>
              </tr>
            </thead>
            <tbody>
              {finalShares.direct && finalShares.direct.map(f => (
                <tr key={f.id} className="break-inside-avoid">
                  <td className="border border-black py-2 px-3 font-bold">{f.name} <span className="font-normal text-gray-600">[{getRelStr(f.relation, tree.deathDate)}]</span></td>
                  <td className="border border-black py-2 px-3 text-center">{f.n} / {f.d}</td>
                  <td className="border border-black py-2 px-3 text-center font-bold">{f.un} / {f.ud}</td>
                </tr>
              ))}
              {finalShares.subGroups && finalShares.subGroups.map((g, gi) => (
                <React.Fragment key={`sg-${gi}`}>
                  <tr className="bg-gray-50 break-inside-avoid">
                    <td colSpan="3" className="border border-black py-1.5 px-3 font-bold text-gray-700">
                      ※ {formatKorDate(g.ancestor.deathDate)} 공동상속인 중 [{g.ancestor.name}] 사망에 따른 {g.type}
                    </td>
                  </tr>
                  {g.shares.map(f => (
                    <tr key={f.id} className="break-inside-avoid">
                      <td className="border border-black py-2 px-3 pl-6 font-bold">└ {f.name} <span className="font-normal text-gray-600">[{getRelStr(f.relation, g.ancestor.deathDate)}]</span></td>
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

      {/* ========================================== */}
      {/* 탭 5: 구체적 상속분 (금액 계산) */}
      {/* ========================================== */}
      {activeTab === 'amount' && amountCalculations && (
        <div className="mb-8">
          <div className="mb-2 font-bold text-[13px]">
            ■ 총 상속재산가액: {amountCalculations.estateVal.toLocaleString()} 원 
            (간주상속재산: {amountCalculations.deemedEstate.toLocaleString()} 원)
          </div>
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead className="bg-gray-100 text-center font-bold">
              <tr>
                <th className="border border-black py-2 px-2 w-[20%]">상속인</th>
                <th className="border border-black py-2 px-2 w-[15%]">법정 지분</th>
                <th className="border border-black py-2 px-2 w-[20%]">특별수익 (-)</th>
                <th className="border border-black py-2 px-2 w-[20%]">기여분 (+)</th>
                <th className="border border-black py-2 px-2 w-[25%]">구체적 상속 산출액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {amountCalculations.results.map((r, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="border border-black py-2 px-2 text-center font-bold">{r.name}</td>
                  <td className="border border-black py-2 px-2 text-center">{r.un} / {r.ud}</td>
                  <td className="border border-black py-2 px-2 text-right text-red-700">{r.specialBenefit > 0 ? r.specialBenefit.toLocaleString() : '0'}</td>
                  <td className="border border-black py-2 px-2 text-right text-green-700">{r.contribution > 0 ? r.contribution.toLocaleString() : '0'}</td>
                  <td className="border border-black py-2 px-2 text-right font-bold">{r.finalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="break-inside-avoid">
              <tr className="bg-gray-50 font-bold">
                <td colSpan="4" className="border border-black py-2 px-2 text-right">분배액 합계:</td>
                <td className="border border-black py-2 px-2 text-right text-blue-800">{amountCalculations.totalDistributed.toLocaleString()}</td>
              </tr>
              {amountCalculations.remainder > 0 && (
                <tr className="font-bold">
                  <td colSpan="4" className="border border-black py-1.5 px-2 text-right text-gray-600">미분배 잔여금 (소수점 단수):</td>
                  <td className="border border-black py-1.5 px-2 text-right text-red-600">{amountCalculations.remainder.toLocaleString()}</td>
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
