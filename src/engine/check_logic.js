
import { calculateInheritance } from './inheritance.js';
import { relStr } from './utils.js';

const printResult = (title, tree) => {
  console.log('==================================================');
  console.log(`[시나리오] ${title}`);
  console.log(`피상속인: ${tree.name} (사망일: ${tree.deathDate})`);
  
  try {
    const result = calculateInheritance(tree, 0);
    
    console.log('--- 최종 상속 지분 ---');
    result.finalShares.direct.forEach(m => {
      console.log(`- ${m.name}(${relStr[m.relation] || m.relation}): ${m.un}/${m.ud}`);
    });
    
    result.finalShares.subGroups.forEach(g => {
      console.log(`[대습상속: ${g.ancestor.name}의 혈족]`);
      g.shares.forEach(m => {
        console.log(`  └ ${m.name}(${relStr[m.relation] || m.relation}): ${m.un}/${m.ud}`);
      });
    });

    console.log('\n--- 계산 세부 근거 ---');
    result.calcSteps.forEach((step, i) => {
      console.log(`단계 ${i + 1}: ${step.dec.name}의 상속`);
      step.dists.forEach(d => {
        if (d.h.r > 0) {
          console.log(`  - ${d.h.name}: ${d.sn}/${d.sd} ${d.mod ? `(${d.mod})` : ''}`);
        } else {
          console.log(`  - ${d.h.name}: 상속권 없음 (${d.ex || '사유 미기재'})`);
        }
      });
    });
  } catch (err) {
    console.error(`❌ [오류] ${err.stack}`);
  }
  console.log('==================================================\n');
};

// ---------------------------------------------------------
// 김갑수 님 패밀리 데이터 구성
// ---------------------------------------------------------

// 공통 인물 데이터 생성 함수
const getFamily = (deathDate) => ({
  id: 'root',
  name: '김갑수',
  isDeceased: true,
  deathDate: deathDate,
  isHoju: true,
  heirs: [
    { id: 'w1', name: '이순자', relation: 'wife', isDeceased: false, heirs: [] },
    { 
      id: 's1', name: '김대한(장남)', relation: 'son', isHoju: true,
      isDeceased: new Date('1983-04-10') < new Date(deathDate),
      deathDate: '1983-04-10',
      heirs: [
        { id: 's1-w', name: '박민정(장남처)', relation: 'wife', isDeceased: false, isRemarried: true, remarriageDate: '1986-07-20', heirs: [] },
        { id: 's1-s', name: '김준호(손자)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] }, // 호주승계 가산 대상
        { id: 's1-d', name: '김지수(손녀)', relation: 'daughter', isDeceased: false, isSameRegister: new Date('1990-03-01') > new Date(deathDate), heirs: [] }
      ]
    },
    { 
      id: 's2', name: '김민국(차남)', relation: 'son', 
      isDeceased: new Date('1985-09-15') < new Date(deathDate),
      deathDate: '1985-09-15',
      heirs: [
        { id: 's2-w', name: '오영희(차남처)', relation: 'wife', isDeceased: false, heirs: [] },
        { id: 's2-s1', name: '김민준(손자)', relation: 'son', isDeceased: false, heirs: [] },
        { id: 's2-s2', name: '김소연(손녀)', relation: 'daughter', isDeceased: false, heirs: [] }
      ]
    },
    { id: 'd1', name: '김영희(장녀)', relation: 'daughter', isDeceased: false, isSameRegister: false, heirs: [] } // 1973년 출가
  ]
});

// 5. 사위 대습상속권 정밀 검증 (나-①)
// 딸(처)이 91년 이전에 사망한 경우, 사위는 95년 피상속인 사망 시에도 상속권이 없어야 함
const scenario5 = {
  id: 'root',
  name: '피상속인A',
  isDeceased: true,
  deathDate: '1995-10-10',
  heirs: [
    { id: 'd1', name: '딸(선사망)', relation: 'daughter', isDeceased: true, deathDate: '1985-05-05', heirs: [
        { id: 'h1', name: '사위', relation: 'husband', isDeceased: false, heirs: [] }
    ]}
  ]
};

// 6. 대습상속 시 호주승계 가산 정밀 검증 (다-③)
// 장남이 호주가 아니면, 그 아들이 호주승계인이더라도 5할 가산이 적용되지 않아야 함
const scenario6 = {
  id: 'root',
  name: '피상속인B',
  isDeceased: true,
  deathDate: '1987-10-10',
  isHoju: true,
  heirs: [
    { id: 's1', name: '차남(선사망)', relation: 'son', isHoju: false, isDeceased: true, deathDate: '1980-01-01', heirs: [
        { id: 'gs1', name: '손자(호주승계)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] }
    ]}
  ]
};

// 7. 선례 8-187호 정밀 검증 (비호주 피상속인 + 대습 호주 가산)
// '호주 아닌 피상속인'이라도, 선사망한 차남(s1)이 호주였고 손자(gs1)가 그 호주를 승계했다면 5할 가산(1.5)을 받아야 함
const scenario7 = {
  id: 'root',
  name: '비호주피상속인A',
  isDeceased: true,
  deathDate: '1987-10-10',
  isHoju: false, // 호주 아님
  heirs: [
    { 
      id: 's1', name: '차남(선사망/호주)', relation: 'son', isHoju: true, isDeceased: true, deathDate: '1980-01-01', 
      heirs: [
        { id: 'gs1', name: '손자(호주승계)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] },
        { id: 'gd1', name: '손녀', relation: 'daughter', isDeceased: false, heirs: [] }
      ]
    }
  ]
};

// ---------------------------------------------------------
// 테스트 실행
// ---------------------------------------------------------

console.log('🏛️ 상속법 정밀 지침(선례) 기반 로직 검증 시작...\n');

printResult('버전 1: 1975년 (구민법 - 차별 지분)', getFamily('1975-06-01'));
printResult('버전 2: 1987년 (1977년 개정 - 대습상속/재혼유지)', getFamily('1987-06-01'));
printResult('버전 3: 1995년 (1991년 개정 - 균등상속/재혼소멸)', getFamily('1995-06-01'));

console.log('--- 정밀 검증 (선례 기반) ---');
printResult('정밀검증 1: 사위 대습권 (처 91년 이전 사망 시)', scenario5);
printResult('정밀검증 2: 대습 호주가산 배제 (피대습자 호주 아닐 시)', scenario6);
printResult('정밀검증 3: 대습 호주가산 허용 (선례 8-187: 비호주 피상속인)', scenario7);
