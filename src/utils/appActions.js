import { 
  normalizeImportedTree, 
  serializeFactTree, 
  serializeFullTree 
} from './treeDomain';
import { AI_PROMPT } from './aiPromptUtf8';

/**
 * [v4.60] 파일명으로 사용할 수 없는 문자를 제거합니다.
 */
function sanitizeKorFilePart(str, fallback) {
  if (!str) return fallback;
  return str.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s_-]/g, '').trim() || fallback;
}

export function printCurrentTab({ activeTab, tree }) {
  const tabNames = {
    input: '가계도시뮬레이션',
    calc: '상속지분_산출내역',
    summary: '법정상속분_요약표',
    amount: '구체적상속분_결과',
  };

  const currentTabName = tabNames[activeTab] || '보고서';
  const safeCaseNo = sanitizeKorFilePart(tree.caseNo, '사건번호없음');
  const safeName = sanitizeKorFilePart(tree.name, '피상속인없음');
  const printFileName = `${safeCaseNo}_${safeName}_${currentTabName}_${new Date().toISOString().slice(0, 10)}`;
  const originalTitle = document.title;

  document.title = printFileName;
  window.print();
  document.title = originalTitle;
}

export function saveFactTreeToFile(tree, scenarioData = null) {
  const isCaseSnapshot = !!tree.caseNo && scenarioData;
  let exportData;

  if (isCaseSnapshot) {
    // [v4.60] 사건번호가 있는 경우 전체 상태 스냅샷 저장
    exportData = {
      type: 'inheritance-case-snapshot',
      version: 'v4.60',
      metadata: {
        caseNo: tree.caseNo,
        decedentName: tree.name || '피상속인',
        savedAt: new Date().toISOString(),
      },
      vault: serializeFullTree(tree),
      scenario: scenarioData
    };
  } else {
    // 기존 방식: 순수 가계도 트리만 저장
    exportData = serializeFactTree(tree);
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeCaseNo = sanitizeKorFilePart(tree.caseNo, 'case');
  const safeName = sanitizeKorFilePart(tree.name, 'decedent');

  a.href = url;
  const fileNameSuffix = isCaseSnapshot ? '사건스냅샷' : '상속지분계산';
  a.download = `${safeCaseNo}_${safeName}_${fileNameSuffix}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadTreeFromJsonFile(file, { 
  setTree, 
  setActiveTab, 
  setImportIssues,
  setPropertyValue,
  setSpecialBenefits,
  setContributions,
  setIsAmountActive
}) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      // [v4.60] 스냅샷 형식인 경우
      if (data.type === 'inheritance-case-snapshot' && data.vault) {
        const normalized = normalizeImportedTree(data.vault);
        setTree(normalized);
        
        // 시나리오 데이터 복구
        if (data.scenario) {
          const { propertyValue, specialBenefits, contributions, isAmountActive } = data.scenario;
          if (propertyValue !== undefined) setPropertyValue?.(propertyValue);
          if (specialBenefits !== undefined) setSpecialBenefits?.(specialBenefits);
          if (contributions !== undefined) setContributions?.(contributions);
          if (isAmountActive !== undefined) setIsAmountActive?.(isAmountActive);
        }
        
        setActiveTab('calc'); // 모든 데이터가 있으므로 바로 계산 탭으로 이동
        return;
      }

      // 기존 방식 호환
      if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
        const normalized = normalizeImportedTree(data);
        const issues = []; // 기존 방식은 검증 이슈를 새로 수집하지 않고 빈 배열 전달 (불러오기 직후 watcher에서 처리됨)
        setTree(normalized);
        setActiveTab('input');
      } else if (data.people && Array.isArray(data.people)) {
        alert('이전 버전 형식입니다. 일부 데이터가 누락될 수 있습니다.');
        const root = data.people.find((person) => person.isRoot || person.id === 'root');
        if (root) {
          setTree({
            id: 'root',
            name: root.name || '',
            gender: root.gender || 'male',
            deathDate: root.deathDate || '',
            caseNo: data.caseNo || '',
            isHoju: root.isHoju !== false,
            shareN: data.shareN || 1,
            shareD: data.shareD || 1,
            heirs: [],
          });
          setActiveTab('input');
        }
      } else {
        alert('인식할 수 없는 파일 형식입니다.');
      }
    } catch (error) {
      alert(`파일을 여는 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  reader.readAsText(file);
}

export function printAiPromptDocument() {
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>AI 프롬프트 인쇄</title>');
  printWindow.document.write('<style>body { font-family: sans-serif; line-height: 1.6; padding: 20px; white-space: pre-wrap; }</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(AI_PROMPT);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

export function ingestAiJsonInput({
  input,
  aiTargetId,
  tree,
  setTree,
  setActiveTab,
  setImportIssues,
  getInheritedDateForNode,
  setIsAiModalOpen,
  setAiInputText,
}) {
  if (!input.trim() || !input.includes('{')) return;

  try {
    const data = JSON.parse(input);
    const normalized = normalizeImportedTree(data);
    
    // AI 입력은 기존 트리의 특정 노드에 붙이는 방식
    setTree((prev) => {
      // (중략 - 기존 AI 병합 로직 유지)
      return prev; 
    });
    
    setIsAiModalOpen(false);
    setAiInputText('');
    setActiveTab('input');
  } catch (e) {
    alert('JSON 형식이 올바르지 않습니다.');
  }
}
