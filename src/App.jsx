import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen,
  IconPrinter, IconNetwork, IconTable, IconList,
  IconReset, IconFileText, IconXCircle, IconX, IconChevronRight,
  IconSun, IconMoon, IconUndo, IconRedo, IconUserGroup, IconTrash2, IconSparkles
} from './components/Icons';
import { DateInput } from './components/DateInput';
import HeirRow from './components/HeirRow';
import TreeReportNode from './components/TreeReportNode';
import PrintReport from './components/PrintReport';
import SummaryPanel from './components/SummaryPanel';
import AmountPanel from './components/AmountPanel';
import CalcPanel from './components/CalcPanel';
import ResultPanel from './components/ResultPanel';
import InputPanel from './components/InputPanel';
import TreePanel from './components/TreePanel';
import MetaHeader from './components/MetaHeader';
import AiImportModal from './components/AiImportModal';
import ResetConfirmModal from './components/ResetConfirmModal';
import SmartGuidePanel from './components/SmartGuidePanel';
import SidebarTreePanel from './components/SidebarTreePanel';
import TopToolbar from './components/TopToolbarBalanced';
import { math, getLawEra, getRelStr, formatKorDate, formatMoney, isBefore } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { AI_PROMPT } from './utils/aiPrompt';
import { normalizeImportedTree, updateDeathInfo, updateHistoryInfo, updateRelationInfo, setHojuStatus, applyNodeUpdates, appendQuickHeirs, serializeFactTree } from './utils/treeDomain';
import { migrateToVault, buildTreeFromVault } from './utils/vaultTransforms';
import { ingestAiJsonInput, loadTreeFromJsonFile, printAiPromptDocument, printCurrentTab, saveFactTreeToFile } from './utils/appActions';
import { useSmartGuide } from './hooks/useSmartGuide';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { QRCodeSVG } from 'qrcode.react'; 

function App() {
  const [activeTab, setActiveTab] = useState('input'); 
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [syncRequest, setSyncRequest] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState("");
  const [aiTargetId, setAiTargetId] = useState('root');
  const [showQrCode, setShowQrCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIds, setMatchIds] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [propertyValue, setPropertyValue] = useState(''); 
  const [specialBenefits, setSpecialBenefits] = useState({}); 
  const [contributions, setContributions] = useState({});     
  const [isAmountActive, setIsAmountActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth, setNavigatorWidth] = useState(310);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);
  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [showNavigator, setShowNavigator] = useState(false);
  const [isFolderFocused, setIsFolderFocused] = useState(false); 
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(1);
  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const tabRefs = useRef({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  const [vaultState, setVaultState] = useState({
    history: [ migrateToVault(getInitialTree()) ],
    currentIndex: 0
  });

  const rawVault = vaultState.history[vaultState.currentIndex];

  const setVault = (action) => {
    setVaultState(prev => {
      const currentVault = prev.history[prev.currentIndex];
      const newVault = typeof action === 'function' ? action(JSON.parse(JSON.stringify(currentVault))) : action;
      const parsedVault = JSON.parse(JSON.stringify(newVault)); 
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(parsedVault);
      if (newHistory.length > 50) newHistory.shift();
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    });
  };

  const setTree = (action) => {
    setVaultState(prev => {
      const currentVault = prev.history[prev.currentIndex];
      const currentTree = buildTreeFromVault(currentVault); 
      const newTree = typeof action === 'function' ? action(currentTree) : action; 
      const newVault = migrateToVault(newTree); 
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(newVault);
      if (newHistory.length > 50) newHistory.shift();
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    });
  };

  const tree = useMemo(() => buildTreeFromVault(rawVault) || getInitialTree(), [rawVault]);

  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set();
    const visitedNodes = new Set();
    const rootName = tree.name || '피상속인';
    tabMap.set('root', { id: 'root', personId: 'root', name: rootName, node: tree, parentName: null, level: 0, branchRootId: null });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      if (!node || visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);

      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
      
      const isPredeceasedSpouse = isSpouse && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      
      let currentBranchRootId = branchRootId;
      const pId = node.personId;
      if (isTarget && !isPredeceasedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          tabMap.set(pId, { 
            id: pId, 
            personId: pId, 
            name: node.name || '(상속인)', 
            node: node, 
            parentNode: parentNode, 
            parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name, 
            parentTabId: parentNode.id === 'root' ? 'root' : parentNode.personId,
            inheritanceType: (node.isDeceased && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate)) ? 'predeceased' : 'deceased',
            relation: node.relation, 
            level: level, 
            branchRootId: currentBranchRootId 
          });
          registeredPersonIds.add(pId);
        } else {
          const existingTab = tabMap.get(pId);
          if (existingTab) currentBranchRootId = existingTab.branchRootId;
        }
      } else if (!isTarget && registeredPersonIds.has(pId)) {
          const existingTab = tabMap.get(pId);
          if (existingTab) currentBranchRootId = existingTab.branchRootId;
      }
      if (node.heirs && node.heirs.length > 0) node.heirs.forEach(h => queue.push({ node: h, parentNode: node, level: level + 1, branchRootId: currentBranchRootId }));
    }
    return Array.from(tabMap.values());
  }, [tree]);

  const undoTree = () => { setVaultState(prev => prev.currentIndex > 0 ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev); };
  const redoTree = () => { setVaultState(prev => prev.currentIndex < prev.history.length - 1 ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev); };

  const handleKeyDown = (e) => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!navKeys.includes(e.key)) return;
    if (isResetModalOpen) return;
    const all = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
    const i = all.indexOf(e.target);
    if (i === -1) return;
    if (e.key === 'Tab') { if (e.shiftKey) { e.preventDefault(); if (i > 0) all[i-1].focus(); } else { e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) all[i-1].focus(); } 
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const row = e.target.closest('.group\\/row, .nav-row, .grid'); if (!row) return; const rowEls = Array.from(row.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)')); const ri = rowEls.indexOf(e.target); if (e.key === 'ArrowLeft' && ri > 0) { e.preventDefault(); rowEls[ri-1].focus(); } else if (e.key === 'ArrowRight' && ri < rowEls.length-1) { e.preventDefault(); rowEls[ri+1].focus(); } }
  };

  const handleNavigate = (nodeId) => {
    setActiveTab('input');
    if (typeof nodeId === 'string' && nodeId.startsWith('tab:')) {
      const targetTabId = nodeId.split(':')[1];
      setActiveDeceasedTab(targetTabId);
      setIsFolderFocused(true);
      return;
    }
    const findTabIdForNode = (currentNode, currentTabId, visited = new Set()) => {
      if (!currentNode || visited.has(currentNode.id)) return null;
      visited.add(currentNode.id);
      if (currentNode.id === nodeId || currentNode.personId === nodeId) return currentTabId;
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          if (h.id === nodeId || h.personId === nodeId) return currentTabId;
          const isTabOwner = h.isDeceased || (h.isExcluded && ['lost', 'disqualified'].includes(h.exclusionOption));
          const nextTabId = isTabOwner ? h.personId : currentTabId;
          const found = findTabIdForNode(h, nextTabId, visited);
          if (found) return found;
        }
      }
      return null;
    };
    const foundTabId = findTabIdForNode(tree, 'root');
    if (foundTabId) setActiveDeceasedTab(foundTabId);
    setTimeout(() => {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50');
        setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50'), 2000);
      }
    }, 150);
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const tabData = [
    { id: 'input', label: '정보 입력', icon: <IconFileText className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'tree', label: '가계도', icon: <IconNetwork className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'calc', label: '검토', icon: <IconTable className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'result', label: '리포트', icon: <IconFileText className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'summary', label: '최종 지분', icon: <IconList className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'amount', label: '상속분 계산', icon: <IconCalculator className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
  ];

  const getInheritedDateForNode = (targetId) => {
    let inheritedDate = tree.deathDate;
    const walk = (node, currentDate) => {
      if (!node) return false;
      if (node.id === targetId) { inheritedDate = currentDate || tree.deathDate; return true; }
      return (node.heirs || []).some((child) => walk(child, node.deathDate || currentDate));
    };
    walk(tree, tree.deathDate);
    return inheritedDate;
  };

  const handlePersonAction = (action) => {
    if (!action || typeof action !== 'object') return;
    setTree((prev) => {
      switch (action.type) {
        case 'updateDeathInfo':
          return updateDeathInfo(prev, action.nodeId, { isDeceased: action.isDeceased, deathDate: action.deathDate, inheritedDate: action.inheritedDate || getInheritedDateForNode(action.nodeId) });
        case 'updateHistoryInfo':
          return updateHistoryInfo(prev, action.nodeId, action.changes || {});
        case 'updateRelationInfo':
          return updateRelationInfo(prev, action.nodeId, action.relation);
        case 'setHojuStatus':
          return setHojuStatus(prev, action.nodeId, action.isHoju);
        case 'applyNodeUpdates':
          return applyNodeUpdates(prev, action.nodeId, action.updates || {});
        default: return prev;
      }
    });
  };

  const handleUpdate = (id, changes, value) => {
    if (typeof id === 'object' && id !== null && id.type) { handlePersonAction(id); return; }
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };
    const field = typeof changes === 'string' ? changes : Object.keys(changes)[0];
    const val = updates[field];
    
    if (field === 'isHoju') { handlePersonAction({ type: 'setHojuStatus', nodeId: id, isHoju: val }); return; }
    if (field === 'deathDate' || field === 'isDeceased') { handlePersonAction({ type: 'updateDeathInfo', nodeId: id, deathDate: updates.deathDate, isDeceased: updates.isDeceased, inheritedDate: getInheritedDateForNode(id) }); return; }
    if (['marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate'].includes(field)) { handlePersonAction({ type: 'updateHistoryInfo', nodeId: id, changes: updates }); return; }
    
    setTree(prev => {
      const scanAndApply = (node) => {
        if (node.id === id) {
          const newNode = { ...node, ...updates };
          return newNode;
        }
        if (node.heirs) return { ...node, heirs: node.heirs.map(scanAndApply) };
        return node;
      };
      return scanAndApply(prev);
    });
  };

  const handleRootUpdate = (field, value) => { handleUpdate('root', { [field]: value }); };

  const addHeir = (parentId) => {
    setTree(prev => {
      const recursiveAdd = (node) => {
        if (node.id === parentId) {
          const newHeir = { id: `h_${Math.random().toString(36).substr(2, 9)}`, personId: `p_${Math.random().toString(36).substr(2, 9)}`, name: '', relation: 'son', isDeceased: false, deathDate: '', isExcluded: false, exclusionOption: '', heirs: [] };
          const updatedNode = { ...node, heirs: [...(node.heirs || []), newHeir] };
          if (node.isDeceased && node.id !== 'root') { updatedNode.isExcluded = false; updatedNode.exclusionOption = ''; }
          return updatedNode;
        }
        if (node.heirs) return { ...node, heirs: node.heirs.map(recursiveAdd) };
        return node;
      };
      return recursiveAdd(prev);
    });
  };

  const removeHeir = (id) => {
    setTree(prev => {
      const recursiveRemove = (node) => {
        if (node.heirs) {
          const newHeirs = node.heirs.filter(h => h.id !== id).map(recursiveRemove);
          return { ...node, heirs: newHeirs };
        }
        return node;
      };
      return recursiveRemove(prev);
    });
  };

  const { finalShares, calcSteps, warnings, transitShares, blockingIssues } = useMemo(() => {
    const preprocessTree = (n, parentDate, parentNode, visited = new Set()) => {
      const pId = n.personId || n.id;
      if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };
      const clone = { ...n }; const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      const newVisited = new Set(visited); newVisited.add(pId);
      if (clone.id !== 'root' && !clone.isExcluded) {
        if (clone.relation === 'daughter' && clone.marriageDate && refDate) {
           const lawEra = getLawEra(refDate);
           if (lawEra !== '1991') clone.isSameRegister = isBefore(refDate, clone.marriageDate);
        }
      }
      if (clone.heirs) clone.heirs = clone.heirs.map(h => preprocessTree(h, clone.deathDate || refDate, clone, newVisited));
      return clone;
    };
    const preprocessed = preprocessTree(tree, tree.deathDate, null);
    return calculateInheritance(preprocessed);
  }, [tree]);

  const [simpleTargetN, simpleTargetD] = math.simplify(tree.shareN || 1, tree.shareD || 1);

  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings, transitShares);
  const { showGlobalWarning, showAutoCalcNotice, globalMismatchReasons, auditActionItems, repairHints, noSurvivors, autoCalculatedNames } = guideInfo || {};

  const logicalMismatchGuides = useMemo(() => {
    const guides = [];
    if (!tree.name || !tree.name.trim()) { guides.push({ id: 'root', uniqueKey: 'missing-root-name', targetTabId: 'root', type: 'mandatory', text: '피상속인의 성명과 사망일자를 먼저 입력해 주세요.' }); } else if (!tree.deathDate) { guides.push({ id: 'root', uniqueKey: 'missing-root-death', targetTabId: 'root', type: 'mandatory', text: `[${tree.name || '이름 미상'}]의 사망일자를 입력해 주세요.` }); }
    const checkMismatch = (node, parentDeathDate, parentPersonId) => {
      const effectiveDate = parentDeathDate || tree.deathDate;
      const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
      if (node.relation === 'daughter' && node.marriageDate && effectiveDate && getLawEra(effectiveDate) !== '1991' && isBefore(node.marriageDate, effectiveDate) && node.isSameRegister !== false) { 
        guides.push({ id: node.id, uniqueKey: `mismatch-married-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 미상'}]은 구법 적용(출가) 대상일 수 있습니다.` }); 
      }
      if (node.isDeceased && node.isExcluded !== true && (!node.heirs || node.heirs.length === 0)) {
        const isPre = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
        let msg = `[${node.name || '이름 미상'}]은 사망자이나 후속 상속인이 입력되지 않았습니다.`;
        if (isPre) msg = `[${node.name}]은 선사망자입니다. 대습상속인이 있다면 입력해 주세요.`;
        else {
           const finder = () => {
             const m = (tree.heirs || []).find(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isDeceased && !h.isExcluded);
             if (m) return `직계존속 [${m.name}]`;
             const s = (tree.heirs || []).filter(h => h.id !== node.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded).map(h => h.name);
             return s.length > 0 ? `형제자매 [${s.join(', ')}]` : "다음 순위 상속인";
           };
           msg = `별도의 상속인을 입력하지 않으면, 법정 순위에 따라 ${finder()}에게 지분이 귀속됩니다.`;
        }
        guides.push({ id: node.id, uniqueKey: `missing-heirs-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: msg });
      }
      if (node.heirs) node.heirs.forEach(h => checkMismatch(h, node.deathDate || effectiveDate, node.personId));
    };
    if (tree.heirs) tree.heirs.forEach(h => checkMismatch(h, tree.deathDate, 'root'));
    return guides;
  }, [tree]);

  const smartGuides = useMemo(() => {
    const raw = [ ...(guideInfo.smartGuides || []), ...logicalMismatchGuides ];
    const map = new Map(); raw.forEach(g => { const key = g.uniqueKey || g.text; if (!map.has(key)) map.set(key, g); });
    return Array.from(map.values());
  }, [guideInfo, logicalMismatchGuides]);

  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const dismissGuide = (key) => setHiddenGuideKeys(prev => new Set(prev).add(key));

  const guideStatusMap = useMemo(() => {
    const map = {}; 
    const setStatus = (key, type) => { if (!map[key]) map[key] = { mandatory: false, recommended: false, childMandatory: false, childRecommended: false }; if (type === 'mandatory') map[key].mandatory = true; if (type === 'recommended') map[key].recommended = true; };
    (smartGuides || []).forEach(g => { if (g.type === 'recommended' && hiddenGuideKeys.has(g.uniqueKey)) return; if (g.id) setStatus(g.id, g.type); });
    return map;
  }, [smartGuides, hiddenGuideKeys]);

  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => { if (!curr) return null; const newPath = [...currentPath, curr]; if (curr.id === target || curr.personId === target) return newPath; if (curr.heirs) { for (const h of curr.heirs) { const res = findPath(h, target, newPath); if (res) return res; } } return null; };
    const lineage = findPath(tree, activeDeceasedTab); if (!lineage) return null;
    const node = lineage[lineage.length - 1]; const isRoot = activeDeceasedTab === 'root';
    const name = node.name || (isRoot ? '피상속인' : '(성명 미상)');
    let totalN = 0, totalD = 1; if (calcSteps && node) { const step = calcSteps.find(s => s.dec?.personId === node.personId); if (step) { totalN = step.inN; totalD = step.inD; } }
    const shareStr = isRoot ? '1분의 1' : (totalN > 0 ? `${totalD}분의 ${totalN}` : '0');
    return { name, shareStr, isRoot };
  }, [tree, activeDeceasedTab, calcSteps]);

  const activeTabObj = useMemo(() => deceasedTabs.find(t => t.id === activeDeceasedTab) || null, [deceasedTabs, activeDeceasedTab]);

  const handlePrint = () => printCurrentTab({ activeTab, tree });
  const saveFile = () => saveFactTreeToFile(tree);
  const loadFile = (e) => { loadTreeFromJsonFile(e.target.files[0], { setTree, setActiveTab }); e.target.value = ''; };
  const handlePrintPrompt = () => printAiPromptDocument();
  const handleCopyPrompt = () => { if (navigator.clipboard) navigator.clipboard.writeText(AI_PROMPT).then(() => alert('AI 안내문 복사 완료.')); };
  const handleAiIngest = (input) => ingestAiJsonInput({ input, aiTargetId, tree, setTree, getInheritedDateForNode, setIsAiModalOpen, setAiInputText: () => {} });
  const performReset = (saveFirst) => { if (saveFirst) saveFile(); setVaultState({ history: [migrateToVault(getInitialTree())], currentIndex: 0 }); setActiveTab('input'); setActiveDeceasedTab('root'); setIsResetModalOpen(false); };
  const handleExcelExport = () => { alert("CSV 내보내기를 시작합니다."); };

  return (
    <>
      <PrintReport tree={tree} activeTab={activeTab} activeDeceasedTab={activeDeceasedTab} finalShares={finalShares} calcSteps={calcSteps} amountCalculations={[]} propertyValue={propertyValue} />
      <div className="w-full min-h-screen relative flex flex-col items-start pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900 min-w-[1280px] print:hidden">
        <SmartGuidePanel showNavigator={showNavigator} setShowNavigator={setShowNavigator} navigatorWidth={navigatorWidth} handleNavigatorResizeMouseDown={() => {}} hasActionItems={false} noSurvivors={noSurvivors} activeTab={activeTab} warnings={warnings} deceasedTabs={deceasedTabs} setActiveDeceasedTab={setActiveDeceasedTab} tree={tree} smartGuides={smartGuides} hiddenGuideKeys={hiddenGuideKeys} dismissGuide={dismissGuide} showGlobalWarning={showGlobalWarning} globalMismatchReasons={globalMismatchReasons || []} auditActionItems={auditActionItems || []} repairHints={[]} handleNavigate={handleNavigate} showAutoCalcNotice={false} autoCalculatedNames={[]} />
        <TopToolbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} tree={tree} setAiTargetId={setAiTargetId} setIsAiModalOpen={setIsAiModalOpen} setShowNavigator={setShowNavigator} hasActionItems={false} undoTree={undoTree} redoTree={redoTree} canUndo={vaultState.currentIndex > 0} canRedo={vaultState.currentIndex < vaultState.history.length - 1} setIsResetModalOpen={setIsResetModalOpen} loadFile={loadFile} saveFile={saveFile} handleExcelExport={handleExcelExport} handlePrint={handlePrint} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        <main className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`} style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 10) : 0 }}>
          <div className="flex flex-col w-[1080px] px-6 mt-6 print-compact relative z-10">
            <div className="flex items-end pl-[48px] gap-1 no-print">
              {tabData.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] border-2 border-b-0 ${activeTab === t.id ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-100'}`}>{t.label}</button>)}
            </div>
            <div className="border rounded-xl bg-white dark:bg-neutral-800 p-10 min-h-[600px]">
              {activeTab === 'input' && <InputPanel tree={tree} activeDeceasedTab={activeDeceasedTab} activeTabObj={activeTabObj} finalShares={finalShares} handleUpdate={handleUpdate} removeHeir={removeHeir} addHeir={addHeir} handleKeyDown={handleKeyDown} handleRootUpdate={handleRootUpdate} sensors={sensors} setAiTargetId={setAiTargetId} setIsAiModalOpen={setIsAiModalOpen} isMainQuickActive={false} setIsMainQuickActive={() => {}} mainQuickVal="" setMainQuickVal={() => {}} handleQuickSubmit={() => {}} getBriefingInfo={getBriefingInfo} setActiveDeceasedTab={setActiveDeceasedTab} />}
              {activeTab === 'tree' && <TreePanel tree={tree} isAllExpanded={isAllExpanded} setIsAllExpanded={setIsAllExpanded} />}
              {activeTab === 'summary' && <SummaryPanel tree={tree} finalShares={finalShares} handleNavigate={handleNavigate} matchIds={[]} currentMatchIdx={0} searchQuery="" setSearchQuery={() => {}} simpleTargetN={1} simpleTargetD={1} />}
            </div>
          </div>
        </main>
        <AiImportModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} onSubmit={handleAiIngest} />
        <ResetConfirmModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} onConfirm={performReset} />
      </div>
    </>
  );
}

export default App;
