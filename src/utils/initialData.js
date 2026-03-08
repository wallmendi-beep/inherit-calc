export const getInitialTree = () => {
  const heirs_yongim = [
    { id: 'hy1', name: '전경록', relation: 'husband', isDeceased: true, deathDate: '1988-06-29', heirs: [
      { id: 'hy1_1', name: '전동명', relation: 'son', isHoju: true, isDeceased: false, heirs: [] },
      { id: 'hy1_2', name: '전동욱', relation: 'son', isDeceased: false, heirs: [] },
      { id: 'hy1_3', name: '전동훈', relation: 'son', isDeceased: false, heirs: [] },
      { id: 'hy1_4', name: '전동신', relation: 'son', isDeceased: true, deathDate: '2016-03-12', heirs: [
          { id: 'hy1_4_1', name: '전동명', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hy1_4_2', name: '전동욱', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hy1_4_3', name: '전동훈', relation: 'sibling', isDeceased: false, heirs: [] }
      ]}
    ]},
    { id: 'hy2', name: '전동명', relation: 'son', isHoju: false, isDeceased: false, heirs: [] },
    { id: 'hy3', name: '전동욱', relation: 'son', isDeceased: false, heirs: [] },
    { id: 'hy4', name: '전동훈', relation: 'son', isDeceased: false, heirs: [] },
    { id: 'hy5', name: '전동신', relation: 'son', isDeceased: true, deathDate: '2016-03-12', heirs: [
      { id: 'hy5_1', name: '전동명', relation: 'sibling', isDeceased: false, heirs: [] },
      { id: 'hy5_2', name: '전동욱', relation: 'sibling', isDeceased: false, heirs: [] },
      { id: 'hy5_3', name: '전동훈', relation: 'sibling', isDeceased: false, heirs: [] }
    ]}
  ];

  const heirs_kyungtaek = [
    { id: 'hk1', name: '조소순', relation: 'wife', isDeceased: true, deathDate: '2013-08-14', heirs: [
      { id: 'hk1_1', name: '이화영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hk1_2', name: '이욱영', relation: 'daughter', isDeceased: true, deathDate: '2020-04-30', heirs: [
          { id: 'hk1_2_1', name: '이화영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk1_2_2', name: '이우영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk1_2_3', name: '이대영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk1_2_4', name: '이시영', relation: 'sibling', isDeceased: false, heirs: [] }
      ]},
      { id: 'hk1_3', name: '이우영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hk1_4', name: '이대영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hk1_5', name: '이시영', relation: 'daughter', isDeceased: false, heirs: [] }
    ]},
    { id: 'hk2', name: '이화영', relation: 'daughter', isDeceased: false, heirs: [] },
    { id: 'hk3', name: '이욱영', relation: 'daughter', isDeceased: true, deathDate: '2020-04-30', heirs: [
          { id: 'hk3_1', name: '이화영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk3_2', name: '이우영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk3_3', name: '이대영', relation: 'sibling', isDeceased: false, heirs: [] },
          { id: 'hk3_4', name: '이시영', relation: 'sibling', isDeceased: false, heirs: [] }
    ]},
    { id: 'hk4', name: '이우영', relation: 'daughter', isDeceased: false, heirs: [] },
    { id: 'hk5', name: '이대영', relation: 'daughter', isDeceased: false, heirs: [] },
    { id: 'hk6', name: '이시영', relation: 'daughter', isDeceased: false, heirs: [] }
  ];

  const heirs_kyuseung = [
    { id: 'hq1', name: '강희열', relation: 'wife', isDeceased: true, deathDate: '2020-03-19', heirs: [
      { id: 'hq1_1', name: '이내영', relation: 'son', isDeceased: true, deathDate: '2024-06-20', heirs: [
          { id: 'hq1_1_1', name: '김미연', relation: 'wife', isDeceased: false, heirs: [] },
          { id: 'hq1_1_2', name: '이기훈', relation: 'son', isDeceased: false, heirs: [] },
          { id: 'hq1_1_3', name: '이치훈', relation: 'son', isDeceased: false, heirs: [] }
      ]},
      { id: 'hq1_2', name: '이윤영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hq1_3', name: '이기영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hq1_4', name: '이상영', relation: 'daughter', isDeceased: false, heirs: [] },
      { id: 'hq1_5', name: '이완영', relation: 'daughter', isDeceased: false, heirs: [] }
    ]},
    { id: 'hq2', name: '이내영', relation: 'son', isHoju: true, isDeceased: true, deathDate: '2024-06-20', heirs: [
          { id: 'hq2_1', name: '김미연', relation: 'wife', isDeceased: false, heirs: [] },
          { id: 'hq2_2', name: '이기훈', relation: 'son', isDeceased: false, heirs: [] },
          { id: 'hq2_3', name: '이치훈', relation: 'son', isDeceased: false, heirs: [] }
    ]},
    { id: 'hq3', name: '이윤영', relation: 'daughter', isSameRegister: true, isDeceased: false, heirs: [] },
    { id: 'hq4', name: '이기영', relation: 'daughter', isSameRegister: true, isDeceased: false, heirs: [] },
    { id: 'hq5', name: '이상영', relation: 'daughter', isSameRegister: true, isDeceased: false, heirs: [] },
    { id: 'hq6', name: '이완영', relation: 'daughter', isSameRegister: true, isDeceased: false, heirs: [] }
  ];

  const heirs_chunseung = [
    { id: 'hc1', name: '윤석찬', relation: 'wife', isDeceased: true, deathDate: '2021-11-11', heirs: [
      { id: 'hc1_1', name: '이동영', relation: 'son', isDeceased: false, heirs: [] },
      { id: 'hc1_2', name: '이미영', relation: 'daughter', isDeceased: false, heirs: [] }
    ]},
    { id: 'hc2', name: '이동영', relation: 'son', isDeceased: false, heirs: [] },
    { id: 'hc3', name: '이미영', relation: 'daughter', isDeceased: false, heirs: [] }
  ];

  const initialChildren = [
    { id: 'c2', name: '이용임', relation: 'daughter', isSameRegister: false, marriageDate: '1970-01-01', isDeceased: true, deathDate: '1987-01-19', heirs: heirs_yongim },
    { id: 'c3', name: '이경택', relation: 'son', isHoju: true, isDeceased: true, deathDate: '2003-10-31', heirs: heirs_kyungtaek },
    { id: 'c4', name: '이규승', relation: 'son', isHoju: false, isDeceased: true, deathDate: '1978-12-09', heirs: heirs_kyuseung },
    { id: 'c5', name: '이춘승', relation: 'son', isHoju: false, isDeceased: true, deathDate: '2015-01-13', heirs: heirs_chunseung },
    { id: 'c6', name: '이상임', relation: 'daughter', isSameRegister: false, marriageDate: '1974-01-01', isDeceased: false, heirs: [] },
    { id: 'c7', name: '이상희', relation: 'daughter', isSameRegister: false, marriageDate: '1974-01-01', isDeceased: false, heirs: [] },
    { id: 'c8', name: '이순희', relation: 'daughter', isSameRegister: false, marriageDate: '1974-01-01', isDeceased: false, heirs: [] },
    { id: 'c9', name: '이형승', relation: 'son', isHoju: false, isDeceased: false, heirs: [] },
    { id: 'c10', name: '이진승', relation: 'son', isHoju: false, isDeceased: false, heirs: [] },
    { id: 'c11', name: '이영승', relation: 'daughter', isSameRegister: false, marriageDate: '1974-01-01', isDeceased: false, heirs: [] },
    { id: 'c12', name: '이남승', relation: 'daughter', isSameRegister: false, marriageDate: '1974-01-01', isDeceased: false, heirs: [] },
  ];

  const cloneForMongbun = (n) => {
    const newNode = { ...n, id: 'm_' + Math.random().toString(36).substr(2,9) };
    if (newNode.name === '이경택' || newNode.name === '이내영') newNode.isHoju = false;
    if (newNode.heirs) newNode.heirs = newNode.heirs.map(cloneForMongbun);
    return newNode;
  };

  return {
    id: 'root', caseNo: '975261', name: '이영재', 
    isDeceased: true, deathDate: '1975-07-15', shareN: 1, shareD: 1,
    heirs: [
      { id: 'c1', name: '이몽분', relation: 'wife', isDeceased: true, deathDate: '1980-05-14', heirs: initialChildren.map(cloneForMongbun) },
      ...initialChildren
    ]
  };
};

export const getEmptyTree = () => ({
  id: 'root', caseNo: '', name: '', 
  isDeceased: true, deathDate: '', shareN: 1, shareD: 1,
  heirs: []
});
