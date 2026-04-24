import {
  normalizeImportedTree,
  serializeFactTree,
  serializeFullTree
} from './treeDomain';
import { AI_PROMPT } from './aiPromptUtf8';

// AI ?묐떟 JSON?먯꽌 ?덉슜???꾨뱶留?異붿텧 (蹂댁븞/?덉쟾??
const sanitizeAiFacts = (node, isRoot = true) => {
  if (!node || typeof node !== 'object') return node;
  const src = Array.isArray(node) ? { heirs: node } : node;
  const allowed = isRoot
    ? ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender', 'isHoju', 'isSameRegister', 'caseNo', 'shareN', 'shareD', 'heirs']
    : ['name', 'relation', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender', 'isHoju', 'isSameRegister', 'heirs'];
  const next = {};
  allowed.forEach((key) => {
    if (key === 'heirs') {
      next.heirs = Array.isArray(src.heirs) ? src.heirs.map((child) => sanitizeAiFacts(child, false)) : [];
    } else if (src[key] !== undefined) {
      next[key] = src[key];
    }
  });
  return next;
};

/**
 * [v4.60] ?뚯씪紐낆쑝濡??ъ슜?????녿뒗 臾몄옄瑜??쒓굅?⑸땲??
 */
function sanitizeKorFilePart(str, fallback) {
  if (!str) return fallback;
  return str.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim() || fallback;
}

export function printCurrentTab({ activeTab, tree, summaryViewMode = 'structure' }) {
  const tabNames = {
    input: '가계도_입력화면',
    tree: '사건검토_상속인명부',
    calc: '상속지분_산출내역',
    summary: summaryViewMode === 'path' ? '법정상속분_취득경로표' : '법정상속분_요약표',
    amount: '구체적상속분_계산결과',
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
    // [v4.60] ?ш굔踰덊샇媛 ?덈뒗 寃쎌슦 ?꾩껜 ?곹깭 ?ㅻ깄?????
    exportData = {
      type: 'inheritance-case-snapshot',
      version: 'v4.60',
      metadata: {
        caseNo: tree.caseNo,
        decedentName: tree.name || '?쇱긽?띿씤',
        savedAt: new Date().toISOString(),
      },
      vault: serializeFullTree(tree),
      scenario: scenarioData
    };
  } else {
    // 湲곗〈 諛⑹떇: ?쒖닔 媛怨꾨룄 ?몃━留????
    exportData = serializeFactTree(tree);
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeCaseNo = sanitizeKorFilePart(tree.caseNo, '사건번호없음');
  const safeName = sanitizeKorFilePart(tree.name, '피상속인없음');

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

      // [v4.60] ?ㅻ깄???뺤떇??寃쎌슦
      if (data.type === 'inheritance-case-snapshot' && data.vault) {
        const normalized = normalizeImportedTree(data.vault);
        setTree(normalized);
        
        // ?쒕굹由ъ삤 ?곗씠??蹂듦뎄
        if (data.scenario) {
          const { propertyValue, specialBenefits, contributions, isAmountActive } = data.scenario;
          if (propertyValue !== undefined) setPropertyValue?.(propertyValue);
          if (specialBenefits !== undefined) setSpecialBenefits?.(specialBenefits);
          if (contributions !== undefined) setContributions?.(contributions);
          if (isAmountActive !== undefined) setIsAmountActive?.(isAmountActive);
        }
        
        setActiveTab('calc'); // 紐⑤뱺 ?곗씠?곌? ?덉쑝誘濡?諛붾줈 怨꾩궛 ??쑝濡??대룞
        return;
      }

      // 湲곗〈 諛⑹떇 ?명솚
      if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
        const normalized = normalizeImportedTree(data);
        const issues = []; // 湲곗〈 諛⑹떇? 寃利??댁뒋瑜??덈줈 ?섏쭛?섏? ?딄퀬 鍮?諛곗뿴 ?꾨떖 (遺덈윭?ㅺ린 吏곹썑 watcher?먯꽌 泥섎━??
        setTree(normalized);
        setActiveTab('input');
      } else if (data.people && Array.isArray(data.people)) {
        alert('?댁쟾 踰꾩쟾 ?뺤떇?낅땲?? ?쇰? ?곗씠?곌? ?꾨씫?????덉뒿?덈떎.');
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
        alert('?몄떇?????녿뒗 ?뚯씪 ?뺤떇?낅땲??');
      }
    } catch (error) {
      alert(`?뚯씪???щ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎: ${error.message}`);
    }
  };

  reader.readAsText(file);
}

export function printAiPromptDocument() {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('인쇄 창을 열 수 없습니다. 브라우저의 팝업 차단 설정을 확인해 주세요.');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>AI 프롬프트 인쇄</title>
        <style>
          body {
            font-family: sans-serif;
            line-height: 1.6;
            padding: 20px;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>${AI_PROMPT}</body>
    </html>
  `);
  printWindow.document.close();

  const triggerPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error('AI prompt print failed:', error);
    }
  };

  printWindow.onload = () => {
    setTimeout(triggerPrint, 150);
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 150);
  }
}

export function ingestAiJsonInput({
  input,
  aiTargetId,
  tree,
  setTree,
  setActiveTab,
  setIsAiModalOpen,
  setAiInputText,
}) {
  if (!input || !input.trim() || !input.includes('{')) return;

  try {
    const cleanJson = input.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedTree = sanitizeAiFacts(JSON.parse(cleanJson));

    if (aiTargetId === 'root') {
      setTree(normalizeImportedTree({ ...parsedTree, id: 'root' }));
    } else {
      // ????몃뱶??id 紐⑸줉 ?섏쭛
      const targetRawIds = [];
      const findRawIds = (node) => {
        if (node.id === aiTargetId || node.personId === aiTargetId) targetRawIds.push(node.id);
        if (node.heirs) node.heirs.forEach(findRawIds);
      };
      findRawIds(tree);

      setTree((prev) => {
        const normalizedSource = normalizeImportedTree({
          id: 'root',
          name: parsedTree.name || '',
          deathDate: parsedTree.deathDate || tree.deathDate,
          heirs: Array.isArray(parsedTree) ? parsedTree : parsedTree.heirs || [],
        });

        const generateNewHeirs = (heirsArray) =>
          (heirsArray || []).map((heir) => ({
            ...heir,
            id: `ai_${Math.random().toString(36).substr(2, 9)}`,
            heirs: generateNewHeirs(heir.heirs || []),
          }));

        const injectHeirs = (node) => {
          if (targetRawIds.includes(node.id)) {
            return {
              ...node,
              heirs: [...(node.heirs || []), ...generateNewHeirs(normalizedSource.heirs || [])],
            };
          }
          return { ...node, heirs: (node.heirs || []).map(injectHeirs) };
        };

        return injectHeirs(prev);
      });
    }

    setIsAiModalOpen(false);
    setAiInputText('');
    setActiveTab('input');

    // ?꾪룷????寃利?
    let hasMissingHeir = false;
    let hasMultipleSpouses = false;
    const checkIssues = (node) => {
      if (node.isDeceased && node.isExcluded !== true && (!node.heirs || node.heirs.length === 0))
        hasMissingHeir = true;
      const spouses = (node.heirs || []).filter(
        (h) => ['wife', 'husband', 'spouse'].includes(h.relation) && h.isExcluded !== true
      );
      if (spouses.length > 1) hasMultipleSpouses = true;
      if (node.heirs) node.heirs.forEach(checkIssues);
    };
    checkIssues(parsedTree);

    if (hasMultipleSpouses) {
      alert('?좑툘 [二쇱쓽] AI ?낅젰 寃곌낵, ?숈씪?몄뿉寃?諛곗슦?먭? ?щ윭 紐??깅줉?섏뿀?듬땲??\n?낅젰 ??뿉???ㅼ젣 ?곸냽沅뚯씠 ?녿뒗 諛곗슦?먮? [?곸냽 ?쒖쇅] 泥섎━?섍굅????젣??二쇱꽭??');
    } else if (hasMissingHeir) {
      alert('?좑툘 [寃利??덈궡] AI ?곸냽???먮룞 ?낅젰???꾨즺?섏뿀?쇰굹,\n?섏쐞 ?곸냽?몄씠 ?녿뒗 ?щ쭩?먭? ?ы븿?섏뼱 ?덉뒿?덈떎.\n?낅젰 ??쓽 寃쎄퀬 諛곕꼫瑜??뺤씤?섍퀬 蹂댁셿??二쇱꽭??');
    } else {
      alert('AI ?곸냽???먮룞 ?낅젰???꾨즺?섏뿀?듬땲??');
    }
  } catch (e) {
    alert('JSON ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎. AI ?묐떟?먯꽌 JSON 肄붾뱶釉붾줉留?蹂듭궗??二쇱꽭??');
  }
}

