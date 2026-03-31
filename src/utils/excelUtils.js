import * as XLSX from 'xlsx';

// 영문 관계 <-> 한글 관계 번역 맵
const relToKor = {
  'root': '피상속인', 'wife': '배우자(처)', 'husband': '배우자(부)', 'spouse': '배우자', 'son': '자녀(아들)', 'daughter': '자녀(딸)'
};
const korToRel = {
  '피상속인': 'root', '배우자(처)': 'wife', '배우자(부)': 'husband', '배우자': 'spouse', '자녀(아들)': 'son', '자녀(딸)': 'daughter',
  '처': 'wife', '남편': 'husband', '아들': 'son', '딸': 'daughter', '자녀': 'son' // 예외 처리용
};

// 💾 [트리 -> 엑셀] 내보내기 함수
export const exportTreeToExcel = (tree, caseNo = '상속가계도') => {
  const rows = [];
  
  const traverse = (node, parentName = '') => {
    rows.push({
      '식별ID': node.personId || node.id,
      '성명': node.name || '',
      '관계': relToKor[node.relation] || node.relation || '',
      '상위 상속인': parentName,
      '생존 여부': node.isDeceased ? '사망' : '생존',
      '사망일자': node.deathDate || '',
      '동일가적(출가녀)': node.isSameRegister === false ? 'X' : 'O',
      '상속인없음(제외)': node.isExcluded ? 'O' : 'X',
      '제외 사유': node.ex || node.exclusionOption || '',
      '호주상속(장남)': node.isHoju || node.isHojuHeir ? 'O' : 'X'
    });
    
    if (node.heirs && node.heirs.length > 0) {
      node.heirs.forEach(child => traverse(child, node.name));
    }
  };
  
  traverse(tree, '');
  
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, 
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "상속가계도");
  XLSX.writeFile(workbook, `${caseNo}.xlsx`);
};

// 📂 [엑셀 -> 트리] 불러오기 함수
export const importExcelToTree = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (rows.length === 0) throw new Error("데이터가 없습니다.");

        const rootRow = rows.find(r => r['관계'] === '피상속인' || !r['상위 상속인']);
        if (!rootRow) throw new Error("피상속인(root) 데이터를 찾을 수 없습니다.");

        const buildNode = (row) => {
          const node = {
            id: row['식별ID'] || `h_${Math.random().toString(36).substr(2, 9)}`,
            personId: row['식별ID'] || '',
            name: row['성명'] || '',
            relation: korToRel[row['관계']] || 'son',
            isDeceased: row['생존 여부'] === '사망',
            deathDate: row['사망일자'] || '',
            isSameRegister: row['동일가적(출가녀)'] === 'X' ? false : true,
            isExcluded: row['상속인없음(제외)'] === 'O',
            exclusionOption: row['제외 사유'] || (row['상속인없음(제외)'] === 'O' ? 'no_heir' : ''),
            ex: row['제외 사유'] || '',
            isHoju: row['호주상속(장남)'] === 'O',
            isHojuHeir: row['호주상속(장남)'] === 'O',
            heirs: []
          };

          const childrenRows = rows.filter(r => r['상위 상속인'] === row['성명'] && r['성명'] !== row['성명']);
          node.heirs = childrenRows.map(childRow => buildNode(childRow));
          return node;
        };

        const tree = buildNode(rootRow);
        tree.caseNo = `${tree.name}_상속가계도`;
        resolve(tree);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

// 📝 [텍스트 -> 트리] 불러오기 함수 (Pipe 표 형식 지원)
export const importTextToTree = (text) => {
  try {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) throw new Error("데이터가 부족합니다.");

    // 표 형식(|성명|...)에서 데이터 행만 추출
    const dataLines = lines.filter(line => line.includes('|') && !line.includes('---') && !line.startsWith('|성명'));

    const rows = dataLines.map(line => {
      // 앞뒤 파이프 제거 후 분리
      const cols = line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      return {
        '성명': cols[0] || '',
        '관계': cols[1] || '',
        '상위 상속인': cols[2] || '',
        '생존 여부': cols[3] || '',
        '사망일자': cols[4] || '',
        '동일가적(출가녀)': cols[5] || '',
        '상속인없음(제외)': cols[6] || '',
        '비고': cols[7] || ''
      };
    });

    const rootRow = rows.find(r => r['관계'] === '피상속인' || !r['상위 상속인']);
    if (!rootRow) throw new Error("피상속인(root) 데이터를 찾을 수 없습니다.");

    const buildNode = (row) => {
      const node = {
        id: `h_${Math.random().toString(36).substr(2, 9)}`,
        personId: `p_${Math.random().toString(36).substr(2, 9)}`,
        name: row['성명'] || '',
        relation: korToRel[row['관계']] || 'son',
        isDeceased: row['생존 여부'] === '사망',
        deathDate: row['사망일자'] || '',
        isSameRegister: row['동일가적(출가녀)'] === 'X' ? false : true,
        isExcluded: row['상속인없음(제외)'] === 'O',
        exclusionOption: row['비고'] || (row['상속인없음(제외)'] === 'O' ? 'no_heir' : ''),
        ex: row['비고'] || '',
        isHoju: false,
        isHojuHeir: false,
        heirs: []
      };

      const childrenRows = rows.filter(r => r['상위 상속인'] === row['성명'] && r['성명'] !== row['성명']);
      node.heirs = childrenRows.map(childRow => buildNode(childRow));
      return node;
    };

    const tree = buildNode(rootRow);
    tree.caseNo = `${tree.name}_상속가계도`;
    return tree;
  } catch (error) {
    throw new Error(`텍스트 파싱 중 오류 발생: ${error.message}`);
  }
};

// 💾 [트리 -> 텍스트] 내보내기 함수 (Pipe 표 형식 지원)
export const exportTreeToText = (tree) => {
  const header = '|성명|관계|상위 상속인|생존 여부|사망일자|동일가적(출가녀)|상속인없음(제외)|비고|';
  const divider = '|---|---|---|---|---|---|---|---|';
  const rows = [header, divider];
  
  const traverse = (node, parentName = '') => {
    const row = [
      node.name || '',
      relToKor[node.relation] || node.relation || '',
      parentName,
      node.isDeceased ? '사망' : '생존',
      node.deathDate || '',
      node.isSameRegister === false ? 'X' : 'O',
      node.isExcluded ? 'O' : 'X',
      node.ex || node.exclusionOption || ''
    ];
    rows.push(`|${row.join('|')}|`);
    
    if (node.heirs && node.heirs.length > 0) {
      node.heirs.forEach(child => traverse(child, node.name));
    }
  };
  
  traverse(tree, '');
  
  const textContent = rows.join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = tree.caseNo || `${tree.name || '미상'}_상속가계도`;
  a.download = `${fileName}_데이터.txt`;
  a.click();
  URL.revokeObjectURL(url);
};
