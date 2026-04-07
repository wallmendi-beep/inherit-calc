import React from 'react';
import { getLawEra, getRelStr, formatKorDate, isBefore } from '../engine/utils';

// 금액 포맷터
const formatMoney = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Number(val).toLocaleString('ko-KR');
};

const PrintReport = ({ tree, propertyValue, finalShares, calcSteps, amountCalculations, activeTab, activeDeceasedTab }) => {
  // 인쇄는 calc(계산표), summary(법정상속분 요약), amount(구체적 상속분) 탭 등에서 각각 수행됨
  // 인풋(input) 탭에서는 출력 방지 (handlePrint 내부에서 방어)

  const topDirect = finalShares?.direct || [];
  const topGroups = finalShares?.subGroups || [];
  const totalSumN = finalShares?.totalSumN || 0;
  const totalSumD = finalShares?.totalSumD || 1;
  const warnings = calcSteps?.warnings || [];

  // 1. 계산과정(calc) 모드용 구적 (Step 배열 구조 App.jsx 엔진과 동기화)
  const stepsList = Array.isArray(calcSteps) ? calcSteps : (calcSteps?.steps || []);
  
  // 2. 분수 단순화 헬퍼 (App.js에서 가져오는 대신 직접 수행 가능한 부분)
  // 여기서는 단순히 n/d 문자열로 보여줍니다.

  return (
    <div className="hidden print:block print:w-full print:bg-white print:text-black font-sans text-[11pt]">
      {/* 1. 공통 헤더: 피상속인(사건본인) 정보 */}
      <HeaderSection tree={tree} />

      {/* 2. 경고창 (데이터 문제 시) */}
      {warnings.length > 0 && (
        <div className="border border-red-500 bg-red-50 text-red-700 p-3 mb-6 relative">
          <strong className="block mb-1">⚠️ 계산 주의사항</strong>
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => <li key={i}>{w.text || w}</li>)}
          </ul>
        </div>
      )}

      {/* --- 탭별 내용 표출 분기 --- */}

      {/* A. 상속지분 산출 내역 (산출 과정) */}
      {activeTab === 'calc' && (
        <section className="mb-8">
          <h2 className="text-[14pt] font-extrabold mb-3 border-l-4 border-black pl-3">상속지분 산출 내역</h2>
          {stepsList.map((step, i) => (
            <div key={i} className="mb-6 break-inside-avoid">
              <div className="mb-2 bg-gray-100 p-2 border-y border-black font-bold">
                [STEP {i + 1}] 망 {step.dec?.name || '미상'} ({formatKorDate(step.dec?.deathDate)})
                <span className="ml-4 font-normal text-[10pt] text-gray-700">분배 지분: {step.inN}/{step.inD}</span>
              </div>
              <table className="w-full border-collapse border border-gray-400 text-[10pt]">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-400">
                    <th className="border border-gray-400 py-1.5 px-2 text-center w-[20%]">상속인</th>
                    <th className="border border-gray-400 py-1.5 px-2 text-center w-[15%]">관계</th>
                    <th className="border border-gray-400 py-1.5 px-2 text-center w-[25%]">계산식</th>
                    <th className="border border-gray-400 py-1.5 px-2 text-center w-[15%]">취득지분</th>
                    <th className="border border-gray-400 py-1.5 px-2 text-center w-[25%]">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {step.dists.map((d, di) => (
                    <tr key={di} className="border-b border-gray-300">
                      <td className="border border-gray-400 py-1 px-2 text-center font-bold">{d.node?.name || '미상'}</td>
                      <td className="border border-gray-400 py-1 px-2 text-center text-gray-600">{getRelStr(d.node?.relation)}</td>
                      <td className="border border-gray-400 py-1 px-2 text-center">{d.expr}</td>
                      <td className="border border-gray-400 py-1 px-2 text-center font-bold">{d.n}/{d.d}</td>
                      <td className="border border-gray-400 py-1 px-2 text-center text-[9pt]">{d.reason}</td>
                    </tr>
                  ))}
                  {step.dists.length === 0 && (
                    <tr>
                      <td colSpan="5" className="border border-gray-400 py-2 px-2 text-center text-gray-500">
                        귀속될 상속인이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
      {/* A-2. 가계도(input) 탭 인쇄 방어 (Ctrl+P 강제 인쇄 시 빈 평면 방지) */}
      {activeTab === 'input' && (
        <section className="mb-8 text-center text-gray-500 py-10 border-2 border-dashed border-gray-300">
          <h2 className="text-[16pt] font-extrabold mb-4 text-black">가계도(데이터 입력) 화면입니다</h2>
          <p>가계도 구조는 너비가 넓고 상호작용이 필요하므로 화면 캡처 장비를 이용해 주시길 권장합니다.</p>
          <p>종이 인쇄용 보고서를 원하시면 상단의 <strong>[산출내역]</strong>, <strong>[지분요약]</strong>, <strong>[상속금액]</strong> 탭 중 하나를 선택한 후 인쇄해 주세요.</p>
        </section>
      )}

      {/* B. 법정 상속분 요약표 */}
      {activeTab === 'summary' && (
        <section className="mb-8">
          <h2 className="text-[14pt] font-extrabold mb-3 border-l-4 border-black pl-3">법정 상속지분 요약표</h2>
          <table className="w-full border-collapse border-2 border-black text-[11pt]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border border-black py-2 px-2 text-center w-[30%] font-bold">상속인 성명</th>
                <th className="border border-black py-2 px-2 text-center w-[35%] font-bold">최종 지분 (기본)</th>
                <th className="border border-black py-2 px-2 text-center w-[35%] font-bold">최종 지분 (통분)</th>
              </tr>
            </thead>
            <tbody>
              {topDirect.map((share, idx) => (
                <tr key={'dir-'+idx} className="border-b border-gray-400">
                  <td className="border border-black py-2 px-2 text-center font-bold">{share.name}</td>
                  <td className="border border-black py-2 px-2 text-center">{share.un} / {share.ud}</td>
                  <td className="border border-black py-2 px-2 text-center font-bold">{share.n} / {share.d}</td>
                </tr>
              ))}
              {topGroups.map((group, gIdx) => (
                <React.Fragment key={'grp-'+gIdx}>
                  <tr className="bg-gray-50 border-b-2 border-dashed border-gray-500">
                    <td colSpan="3" className="border border-black py-1.5 px-3 text-left font-bold text-gray-700 bg-gray-100">
                      망 {group.ancestor.name} ({getRelStr(group.ancestor.relation)})의 {group.ancestor.deathDate && isBefore(group.ancestor.deathDate, tree.deathDate) ? '대습' : '재'}상속 그룹
                    </td>
                  </tr>
                  {group.shares.map((share, idx) => (
                    <tr key={`g-${gIdx}-${idx}`} className="border-b border-gray-400">
                      <td className="border border-black py-2 px-2 text-center pl-6 font-bold truncate">└ {share.name}</td>
                      <td className="border border-black py-2 px-2 text-center">{share.un} / {share.ud}</td>
                      <td className="border border-black py-2 px-2 text-center font-bold">{share.n} / {share.d}</td>
                    </tr>
                  ))}
                  {/* Nested rendering omitted for print simplicity unless deeply nested. If needed, can extract recursive row render. */}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-bold border-t-2 border-black">
                <td className="border border-black py-2 px-2 text-center">합계</td>
                <td colSpan="2" className="border border-black py-2 px-2 text-center tracking-widest text-[12pt]">
                  {totalSumN} / {totalSumD} {totalSumN !== totalSumD && <span className="text-red-600 ml-2">(일치여부 확인 필요)</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}


      {/* C. 구체적 상속분 (금액 포함표) */}
      {activeTab === 'amount' && amountCalculations && (
        <section className="mb-8">
          <h2 className="text-[14pt] font-extrabold mb-3 border-l-4 border-black pl-3 flex justify-between items-baseline">
            <span>구체적 상속분 산정 최종 결과</span>
            <span className="text-[11pt] font-normal tracking-wide">
              (간주상속재산: <strong className="text-black">{formatMoney(amountCalculations.deemedEstate)} 원</strong>)
            </span>
          </h2>
          <table className="w-full border-collapse border-2 border-black text-[10pt]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border border-black py-2 px-1 text-center w-[15%] font-bold">상속인</th>
                <th className="border border-black py-2 px-1 text-center w-[12%] font-bold">법정지분</th>
                <th className="border border-black py-2 px-1 text-center w-[18%] font-bold text-gray-700">법정상속분액</th>
                <th className="border border-black py-2 px-1 text-center w-[15%] font-bold text-blue-700">기여분 (+)</th>
                <th className="border border-black py-2 px-1 text-center w-[15%] font-bold text-red-700">특별수익 (-)</th>
                <th className="border border-black py-2 px-1 text-center w-[25%] font-bold text-[11pt]">최종 구체적상속분</th>
              </tr>
            </thead>
            <tbody>
              {amountCalculations.results.map((res, idx) => (
                <tr key={idx} className="border-b border-gray-400">
                  <td className="border border-black py-2 px-2 text-center font-bold bg-gray-50">{res.name}</td>
                  <td className="border border-black py-2 px-2 text-center">{res.n}/{res.d}</td>
                  <td className="border border-black py-2 px-2 text-right">{formatMoney(res.statutoryAmount)}</td>
                  <td className="border border-black py-2 px-2 text-right text-blue-800">{formatMoney(res.contribution)}</td>
                  <td className="border border-black py-2 px-2 text-right text-red-800">{formatMoney(res.specialBenefit)}</td>
                  <td className="border border-black py-2 px-2 text-right font-extrabold text-[12pt] tracking-wider bg-gray-50">{formatMoney(res.finalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 border-t-2 border-black font-bold">
                <td className="border border-black py-2 px-2 text-center">합계</td>
                <td className="border border-black py-2 px-2 text-center">{totalSumN}/{totalSumD}</td>
                <td colSpan="3" className="border border-black py-2 px-2 text-right tracking-widest text-[11pt]">
                  총 분배 후 잔액: {formatMoney(amountCalculations.remainder)}
                </td>
                <td className="border border-black py-2 px-2 text-right tracking-widest text-[12pt]">
                  {formatMoney(amountCalculations.totalDistributed)}원
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
      {/* C-2. 금액 관련 데이터가 없거나 로딩되지 않았을 경우 방어 */}
      {activeTab === 'amount' && !amountCalculations && (
        <section className="mb-8 text-center text-gray-500 py-10">
          구체적 상속분 계산을 위한 상속인 데이터가 없습니다. (분배 대상자 없음)
        </section>
      )}
      {/* 하단 인쇄 스탬프/푸터 */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-center text-gray-500 text-[9pt]">
        본 보고서는 [상속지분 계산기 PRO v3.0]에 의해 작성되었습니다. ({new Date().toLocaleDateString()})
      </div>
    </div>
  );
};

// 미니 컴포넌트: 사건 정보 (재사용)
const HeaderSection = ({ tree }) => (
  <div className="mb-6 pb-4 border-b-2 border-black text-[11pt] tracking-wide">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h1 className="text-[18pt] font-black tracking-tight mb-2">상속지분 분석 보고서</h1>
        <div className="text-[12pt] font-bold text-gray-800">사건번호: {tree.caseNo || '(사건번호 미기재)'}</div>
      </div>
      <div className="text-right flex flex-col justify-end">
        <div><strong>피상속인:</strong> <span className="text-[13pt] font-bold underline underline-offset-4">{tree.name || '미상'}</span></div>
        <div className="mt-1"><strong>사망일자:</strong> {formatKorDate(tree.deathDate)}</div>
        <div className="mt-1"><strong>적용법령:</strong> {getLawEra(tree.deathDate)}년 민법</div>
      </div>
    </div>
  </div>
);

export default PrintReport;
