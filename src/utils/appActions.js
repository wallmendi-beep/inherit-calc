import { AI_PROMPT } from './aiPrompt';
import { normalizeImportedTree, serializeFactTree } from './treeDomain';

const sanitizeKorFilePart = (value, fallback) =>
  (value || fallback).replace(/[^a-zA-Z0-9가-힣_-]/g, '');

export function printCurrentTab({ activeTab, tree }) {
  if (activeTab === 'input') {
    alert('보고서 탭을 선택한 뒤 인쇄해 주세요.');
    return;
  }

  const tabNames = {
    input: '가계도',
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

export function saveFactTreeToFile(tree) {
  const pureTree = serializeFactTree(tree);
  const blob = new Blob([JSON.stringify(pureTree, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeCaseNo = sanitizeKorFilePart(tree.caseNo, 'case');
  const safeName = sanitizeKorFilePart(tree.name, 'decedent');

  a.href = url;
  a.download = `${safeCaseNo}_${safeName}_상속지분계산_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadTreeFromJsonFile(file, { setTree, setActiveTab }) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
        setTree(normalizeImportedTree(data));
        setActiveTab('calc');
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
  getInheritedDateForNode,
  setIsAiModalOpen,
  setAiInputText,
}) {
  if (!input.trim() || !input.includes('{')) return;

  try {
    const cleanJson = input.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedTree = JSON.parse(cleanJson);

    if (aiTargetId === 'root') {
      setTree(normalizeImportedTree({ ...parsedTree, id: 'root' }));
    } else {
      const targetRawIds = [];
      const findRawIds = (node) => {
        if (node.id === aiTargetId || node.personId === aiTargetId) targetRawIds.push(node.id);
        if (node.heirs) node.heirs.forEach(findRawIds);
      };
      findRawIds(tree);

      setTree((prev) => {
        const targetInheritedDate = getInheritedDateForNode(aiTargetId);
        const normalizedSource = normalizeImportedTree({
          id: 'root',
          name: parsedTree.name || '',
          deathDate: parsedTree.deathDate || targetInheritedDate || tree.deathDate,
          heirs: Array.isArray(parsedTree) ? parsedTree : parsedTree.heirs || [],
        });

        const injectHeirs = (node) => {
          if (targetRawIds.includes(node.id)) {
            const generateNewHeirs = (heirsArray) =>
              (heirsArray || []).map((heir) => ({
                ...heir,
                id: `ai_${Math.random().toString(36).substr(2, 9)}`,
                heirs: generateNewHeirs(heir.heirs || []),
              }));

            return {
              ...node,
              heirs: [...(node.heirs || []), ...generateNewHeirs(normalizedSource.heirs || [])],
            };
          }

          return { ...node, heirs: node.heirs?.map(injectHeirs) || [] };
        };

        return injectHeirs(prev);
      });
    }

    setIsAiModalOpen(false);
    setAiInputText('');
    alert('AI 상속인 자동 입력이 완료되었습니다.');
  } catch {
    // Auto-parse silent fail, button remains for manual submit.
  }
}
