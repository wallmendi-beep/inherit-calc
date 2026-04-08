const fs = require('fs');
const path = require('path');
const file = 'c:/VS_CODE/상속지분 계산기/src/App.jsx';

let code = fs.readFileSync(file, 'utf8');
const lines = code.split(/\r?\n/);

const newLines = `  const handlePrint = () => {
    // 1. 입력 탭에서는 인쇄 불가 처리
    if (activeTab === 'input') {
      alert('보고서 (가계도, 계산표, 계산결과, 요약표) 중 하나를 선택한 후 인쇄해주세요.');
      return;
    }

    // 2. 현재 열려있는 탭의 영문 ID를 한글 이름으로 변환
    const tabNames = {
      tree: '가계도',
      calc: '계산표',
      result: '계산결과',
      summary: '요약표'
    };
    const currentTabName = tabNames[activeTab] || '보고서';

    // 3. 사건번호와 피상속인 이름 가져오기 (특수문자 제거하여 안전한 파일명 생성)
    const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣-]/g, '');
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣-]/g, '');

    // 4. 오늘 날짜 구하기 (YYYY-MM-DD 형식)
    const today = new Date().toISOString().slice(0, 10);

    // 5. 최종 인쇄용 파일명 조합
    const printFileName = \`\${safeCaseNo}_\${safeName}_\${currentTabName}_\${today}\`;

    // 6. 원래 브라우저 탭 이름(Title) 임시 저장
    const originalTitle = document.title;

    // 7. 브라우저 탭 이름을 인쇄용 파일명으로 변경
    document.title = printFileName;

    // 8. 인쇄(PDF 저장 다이얼로그) 호출!
    window.print();

    // 9. 인쇄 창이 닫히고 나면, 다시 원래 브라우저 탭 이름으로 원상복구
    document.title = originalTitle;
  };`.split('\n');

// Find the line index of "const handlePrint = () => {"
let startIndex = -1;
let endIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handlePrint = () => {')) {
    startIndex = i;
  }
  if (startIndex !== -1 && lines[i].includes('const saveFile = () => {')) {
    endIndex = i - 1; // line before saveFile
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  // To handle empty lines backwards from saveFile if any
  while(lines[endIndex].trim() === '') endIndex--;

  lines.splice(startIndex, (endIndex - startIndex + 1), ...newLines);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Fixed handlePrint encoding properly');
} else {
  console.log('Could not find boundaries');
}
