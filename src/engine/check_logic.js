import { calculateInheritance } from './inheritance.js';
import { relStr } from './utils.js';

const printWarnings = (warnings = []) => {
  if (!warnings.length) {
    console.log('경고 없음');
    return;
  }
  warnings.forEach((warning) => {
    console.log(`- [${warning.code}] ${warning.text}`);
  });
};

const printGroups = (groups = []) => {
  groups.forEach((group) => {
    console.log(`[대습상속: ${group.ancestor.name}의 혈족]`);
    group.shares.forEach((share) => {
      console.log(`  └ ${share.name}(${relStr[share.relation] || share.relation}): ${share.un}/${share.ud}`);
    });
  });
};

const printSteps = (steps = []) => {
  steps.forEach((step, index) => {
    console.log(`단계 ${index + 1}: ${step.dec.name}의 상속`);
    step.dists.forEach((dist) => {
      if ((dist.sn || 0) > 0) {
        console.log(`  - ${dist.h.name}: ${dist.sn}/${dist.sd} ${dist.mod ? `(${dist.mod})` : ''}`);
      } else {
        console.log(`  - ${dist.h.name}: 상속권 없음 (${dist.ex || '사유 미기재'})`);
      }
    });
  });
};

const printResult = (title, tree) => {
  console.log('==================================================');
  console.log(`[시나리오] ${title}`);
  console.log(`피상속인: ${tree.name} (사망일: ${tree.deathDate})`);

  try {
    const result = calculateInheritance(tree, 0);

    console.log('--- 최종 상속 지분 ---');
    (result.finalShares.direct || []).forEach((share) => {
      console.log(`- ${share.name}(${relStr[share.relation] || share.relation}): ${share.un}/${share.ud}`);
    });
    printGroups(result.finalShares.subGroups || []);

    console.log('\n--- 계산 세부 근거 ---');
    printSteps(result.calcSteps || []);

    console.log('\n--- 경고 및 무결성 체크 ---');
    printWarnings(result.warnings || []);
    console.log(`- 상태: ${result.status}`);
    console.log(`- 총합 불일치: ${result.integrity?.hasTotalMismatch ? '있음' : '없음'}`);
    console.log(`- 대습 그룹 수: ${(result.finalShares.subGroups || []).length}`);
  } catch (err) {
    console.error(`[오류] ${err.stack}`);
  }

  console.log('==================================================\n');
};

const getFamily = (deathDate) => ({
  id: 'root',
  name: '김갑수',
  isDeceased: true,
  deathDate,
  isHoju: true,
  heirs: [
    { id: 'w1', name: '이순자', relation: 'wife', isDeceased: false, heirs: [] },
    {
      id: 's1',
      name: '김대한(장남)',
      relation: 'son',
      isHoju: true,
      isDeceased: new Date('1983-04-10') < new Date(deathDate),
      deathDate: '1983-04-10',
      heirs: [
        { id: 's1-w', name: '박정희(장남처)', relation: 'wife', isDeceased: false, isRemarried: true, remarriageDate: '1986-07-20', heirs: [] },
        { id: 's1-s', name: '김준호(손자)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] },
        { id: 's1-d', name: '김지수(손녀)', relation: 'daughter', isDeceased: false, isSameRegister: new Date('1990-03-01') > new Date(deathDate), heirs: [] }
      ]
    },
    {
      id: 's2',
      name: '김민국(차남)',
      relation: 'son',
      isDeceased: new Date('1985-09-15') < new Date(deathDate),
      deathDate: '1985-09-15',
      heirs: [
        { id: 's2-w', name: '오영희(차남처)', relation: 'wife', isDeceased: false, heirs: [] },
        { id: 's2-s1', name: '김민준(손자)', relation: 'son', isDeceased: false, heirs: [] },
        { id: 's2-s2', name: '김소연(손녀)', relation: 'daughter', isDeceased: false, heirs: [] }
      ]
    },
    { id: 'd1', name: '김영희(장녀)', relation: 'daughter', isDeceased: false, isSameRegister: false, heirs: [] }
  ]
});

const scenario5 = {
  id: 'root',
  name: '피상속인A',
  isDeceased: true,
  deathDate: '1995-10-10',
  heirs: [
    {
      id: 'd1',
      name: '딸(선사망)',
      relation: 'daughter',
      isDeceased: true,
      deathDate: '1985-05-05',
      heirs: [
        { id: 'h1', name: '사위', relation: 'husband', isDeceased: false, heirs: [] }
      ]
    },
    { id: 's1', name: '생존 아들', relation: 'son', isDeceased: false, heirs: [] }
  ]
};

const scenario6 = {
  id: 'root',
  name: '피상속인B',
  isDeceased: true,
  deathDate: '1987-10-10',
  isHoju: true,
  heirs: [
    {
      id: 's1',
      name: '차남(선사망)',
      relation: 'son',
      isHoju: false,
      isDeceased: true,
      deathDate: '1980-01-01',
      heirs: [
        { id: 'gs1', name: '손자(호주승계)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] }
      ]
    }
  ]
};

const scenario7 = {
  id: 'root',
  name: '비호주피상속인A',
  isDeceased: true,
  deathDate: '1987-10-10',
  isHoju: false,
  heirs: [
    {
      id: 's1',
      name: '차남(선사망/호주)',
      relation: 'son',
      isHoju: true,
      isDeceased: true,
      deathDate: '1980-01-01',
      heirs: [
        { id: 'gs1', name: '손자(호주승계)', relation: 'son', isHoju: true, isDeceased: false, heirs: [] },
        { id: 'gd1', name: '손녀', relation: 'daughter', isDeceased: false, heirs: [] }
      ]
    }
  ]
};

const scenario8 = {
  id: 'root',
  name: '피상속인C',
  isDeceased: true,
  deathDate: '1987-06-01',
  heirs: [
    {
      id: 's1',
      name: '장남(선사망)',
      relation: 'son',
      isDeceased: true,
      deathDate: '1983-01-01',
      heirs: [
        { id: 's1c1', name: '장남의 자녀', relation: 'son', isDeceased: false, heirs: [] }
      ]
    },
    {
      id: 's2',
      name: '차남(선사망)',
      relation: 'son',
      isDeceased: true,
      deathDate: '1984-01-01',
      heirs: [
        { id: 's2c1', name: '차남의 자녀', relation: 'son', isDeceased: false, heirs: [] }
      ]
    }
  ]
};

console.log('상속법 정밀 지침(선례) 기반 로직 검증 시작...\n');

printResult('버전 1: 1975년 (구민법 - 차등 지분)', getFamily('1975-06-01'));
printResult('버전 2: 1987년 (1979 개정 - 대습상속/재혼 유지)', getFamily('1987-06-01'));
printResult('버전 3: 1995년 (1991 개정 - 균등상속/재혼 소멸)', getFamily('1995-06-01'));

console.log('--- 정밀 검증 (선례 기반) ---');
printResult('정밀검증 1: 사위 대습 불가 가지는 경고 후 재산정', scenario5);
printResult('정밀검증 2: 대습 호주가산 배제 (피대습자 호주 아님)', scenario6);
printResult('정밀검증 3: 대습 호주가산 허용 (선례 8-187)', scenario7);
printResult('정밀검증 4: personId 없는 대습 그룹 분리 유지', scenario8);
