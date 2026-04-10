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
import { QRCodeSVG } from 'qrcode.react'; // ?뮕 v3.0 ?ㅽ봽?쇱씤 QR ?앹꽦湲?

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
    const visitedNodes = new Set(); // ?슚 ?몃뱶 ?먯껜???쒗솚 李몄“ 諛⑹???
tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      if (!node || visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);

      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouseOfRoot = parentNode.id === 'root' && (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse');
      const isDisqualifiedSpouse = isSpouseOfRoot && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      let currentBranchRootId = branchRootId;
      const pId = node.personId;
      if (isTarget && !isDisqualifiedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          tabMap.set(pId, { id: pId, personId: pId, name: node.name || '(상속인)', node: node, parentNode: parentNode, parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name, relation: node.relation, level: level, branchRootId: currentBranchRootId });
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

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [showNavigator, setShowNavigator] = useState(false);

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

  const [isFolderFocused, setIsFolderFocused] = useState(false); 
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(1); 
  const [mainQuickVal, setMainQuickVal] = useState('');          
  const [isMainQuickActive, setIsMainQuickActive] = useState(false); 
  const [duplicateRequest, setDuplicateRequest] = useState(null); 

  const findDuplicates = (node, name, excludeId, results = [], visited = new Set()) => {
    if (!name || name.trim() === '' || !node || visited.has(node.id)) return results;
    visited.add(node.id);
    if (node.id !== excludeId && node.name === name.trim()) results.push(node);
    if (node.heirs) node.heirs.forEach(h => findDuplicates(h, name, excludeId, results, visited));
    return results;
  };

  const findParentNode = (root, targetId, visited = new Set()) => {
    if (!root || visited.has(root.id)) return null;
    visited.add(root.id);
    if (root.heirs && root.heirs.some(h => h.id === targetId)) return root;
    if (root.heirs) { for (const h of root.heirs) { const p = findParentNode(h, targetId, visited); if (p) return p; } }
    return null;
  };

  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) return;
    setTree(prev => appendQuickHeirs(prev, parentId, value));
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth, setNavigatorWidth] = useState(360);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);

  useEffect(() => {
    if (!sidebarSearchQuery.trim()) { setSidebarMatchIds([]); setSidebarCurrentMatchIdx(0); return; }
    const query = sidebarSearchQuery.trim().toLowerCase();
    const matches = [];
    const scan = (n) => { if (n.name && n.name.toLowerCase().includes(query)) matches.push(n.id); if (n.heirs) n.heirs.forEach(scan); };
    scan(tree);
    setSidebarMatchIds(matches); setSidebarCurrentMatchIdx(0);
  }, [sidebarSearchQuery, tree]);

  useEffect(() => {
    if (sidebarMatchIds.length > 0 && sidebarOpen) {
      const targetId = sidebarMatchIds[sidebarCurrentMatchIdx];
      const element = document.getElementById(`sidebar-node-${targetId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [sidebarCurrentMatchIdx, sidebarMatchIds, sidebarOpen]);

  const handleSidebarPrevMatch = () => setSidebarCurrentMatchIdx(prev => (prev > 0 ? prev - 1 : sidebarMatchIds.length - 1));
  const handleSidebarNextMatch = () => setSidebarCurrentMatchIdx(prev => (prev < sidebarMatchIds.length - 1 ? prev + 1 : 0));

  const isResizing = React.useRef(false);
  const isNavResizing = React.useRef(false);
  const startX = React.useRef(0);
  const startWidth = React.useRef(0);
  const navStartWidth = React.useRef(0);

  const handleResizeMouseDown = (e) => {
    isResizing.current = true; startX.current = e.clientX; startWidth.current = sidebarWidth; e.preventDefault();
  };

  const handleNavigatorResizeMouseDown = (e) => {
    isNavResizing.current = true; startX.current = e.clientX; navStartWidth.current = navigatorWidth; e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => { 
      if (isResizing.current) {
        const delta = e.clientX - startX.current;
        const newWidth = Math.min(480, Math.max(160, startWidth.current + delta));
        setSidebarWidth(newWidth);
      }
      if (isNavResizing.current) {
        const delta = startX.current - e.clientX;
        const newWidth = Math.min(600, Math.max(300, navStartWidth.current + delta));
        setNavigatorWidth(newWidth);
      }
    };
    const onMouseUp = () => { isResizing.current = false; isNavResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [navigatorWidth, sidebarWidth]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const tabData = [
    { id: 'input', label: '데이터 입력', icon: <IconFileText className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'tree', label: '가계도', icon: <IconNetwork className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'calc', label: '계산표', icon: <IconTable className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'result', label: '계산결과', icon: <IconCalculator className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'summary', label: '법정 상속분 요약', icon: <IconList className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'amount', label: '구체적 상속분 계산', icon: <IconCalculator className="w-4 h-4 text-green-600"/>,
      style: { activeBorder: 'border-[#15803d]', activeText: 'text-[#15803d] dark:text-green-400', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
  ];

  const getInheritedDateForNode = (targetId) => {
    let inheritedDate = tree.deathDate;

    const walk = (node, currentDate) => {
      if (!node) return false;
      if (node.id === targetId) {
        inheritedDate = currentDate || tree.deathDate;
        return true;
      }
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
          return updateDeathInfo(prev, action.nodeId, {
            isDeceased: action.isDeceased,
            deathDate: action.deathDate,
            inheritedDate: action.inheritedDate || getInheritedDateForNode(action.nodeId),
          });
        case 'updateHistoryInfo':
          return updateHistoryInfo(prev, action.nodeId, action.changes || {});
        case 'updateRelationInfo':
          return updateRelationInfo(prev, action.nodeId, action.relation);
        case 'setHojuStatus':
          return setHojuStatus(prev, action.nodeId, action.isHoju);
        case 'applyNodeUpdates':
          return applyNodeUpdates(prev, action.nodeId, action.updates || {});
        default:
          return prev;
      }
    });
  };

  const handleUpdate = (id, changes, value) => {
    if (typeof id === 'object' && id !== null && id.type) {
      handlePersonAction(id);
      return;
    }

    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };
    const field = typeof changes === 'string' ? changes : Object.keys(changes)[0];
    const val = updates[field];
    if (field === 'name' && val && val.trim() !== '') {
      const trimmedValue = val.trim(); const baseName = trimmedValue.replace(/\(\d+\)$/, ''); const dups = findDuplicates(tree, trimmedValue, id);
      const allSameBaseDups = dups.length > 0 ? (() => { const r = []; const scan = (n) => { if (n.id !== id && n.name && (n.name === baseName || n.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)$`)))) r.push(n); if (n.heirs) n.heirs.forEach(scan); }; scan(tree); return r; })() : [];
      if (dups.length > 0) {
        const existingNode = dups[0]; const parentNodeOfExisting = findParentNode(tree, existingNode.id); const parentNodeOfCurrent = findParentNode(tree, id);
        if (parentNodeOfExisting?.id === parentNodeOfCurrent?.id) { setDuplicateRequest({ name: trimmedValue, parentName: parentNodeOfExisting?.name || '피상속인', relation: existingNode.relation, isSameBranch: true, onConfirm: (isSame) => { if (isSame) alert(`'${trimmedValue}'는 이미 같은 관계의 상속인으로 등록되어 있습니다.\n동일인이라면 한 번만 등록해 주세요.`); else { setTree(prev => { const renameBase = (n) => { if (n.id === existingNode.id && n.name === baseName) return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] }; return { ...n, heirs: n.heirs?.map(renameBase) || [] }; }; return renameBase(prev); }); const nextSuffix = allSameBaseDups.length + 1; applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false); } setDuplicateRequest(null); }, onCancel: () => setDuplicateRequest(null) }); return; }
        const parentName = parentNodeOfExisting ? (parentNodeOfExisting.name || '피상속인') : '피상속인';
        setDuplicateRequest({ name: trimmedValue, parentName, relation: existingNode.relation, isSameBranch: false, onConfirm: (isSame) => { if (isSame) { const syncIdInTree = (n) => { if (n.id === id) return { ...n, name: trimmedValue, personId: existingNode.personId }; return { ...n, heirs: n.heirs?.map(syncIdInTree) || [] }; }; setTree(prev => syncIdInTree(prev)); } else { setTree(prev => { const renameBase = (n) => { if (n.id === existingNode.id && n.name === baseName) return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] }; return { ...n, heirs: n.heirs?.map(renameBase) || [] }; }; return renameBase(prev); }); const nextSuffix = allSameBaseDups.length + 1; applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false); } setDuplicateRequest(null); }, onCancel: () => setDuplicateRequest(null) }); return;
      }
    }
    if (field === 'relation') {
      handlePersonAction({ type: 'updateRelationInfo', nodeId: id, relation: val });
      return;
    }
    if (field === 'isHoju') {
      handlePersonAction({ type: 'setHojuStatus', nodeId: id, isHoju: val });
      return;
    }
    if (field === 'deathDate' || field === 'isDeceased') {
      handlePersonAction({
        type: 'updateDeathInfo',
        nodeId: id,
        deathDate: updates.deathDate,
        isDeceased: updates.isDeceased,
        inheritedDate: getInheritedDateForNode(id),
      });
      return;
    }
    if (['marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate'].includes(field)) {
      handlePersonAction({ type: 'updateHistoryInfo', nodeId: id, changes: updates });
      return;
    }
    setVault(prev => {
      let targetPersonId = id; let parentPersonId = null;
      const findNode = (n, pId) => { if (n.id === id) { targetPersonId = n.personId; parentPersonId = pId; return true; } return (n.heirs || []).some(child => findNode(child, n.personId)); }; findNode(tree, null);
      const personalKeys = ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender'];
      personalKeys.forEach(k => { if (updates[k] !== undefined) prev.persons[targetPersonId][k] = updates[k]; });
      const linkKeys = ['relation', 'isExcluded', 'exclusionOption', 'isHoju', 'isSameRegister'];
      if (parentPersonId && prev.relationships[parentPersonId]) { const link = prev.relationships[parentPersonId].find(l => l.targetId === targetPersonId); if (link) { linkKeys.forEach(k => { if (updates[k] !== undefined) link[k] = updates[k]; }); } }
      return prev;
    });
  };

  const applyUpdate = (id, changes, value, syncGlobal = false, syncName = '') => {
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };
    handlePersonAction({ type: 'applyNodeUpdates', nodeId: id, updates });
  };

  const handleSyncConfirm = (shouldSync) => { if (!syncRequest) return; applyUpdate(syncRequest.id, syncRequest.field, syncRequest.value, shouldSync, syncRequest.name); setSyncRequest(null); };

  const handleRootUpdate = (field, value) => {
    setVault(prev => {
      const rootId = prev.meta.rootPersonId;
      if (['caseNo', 'shareN', 'shareD'].includes(field)) { if (field === 'caseNo') prev.meta.caseNo = value; if (field === 'shareN') prev.meta.targetShareN = value; if (field === 'shareD') prev.meta.targetShareD = value; }
      else prev.persons[rootId][field] = value;
      return prev;
    });
  };

  const addHeir = (parentId) => {
    let parentPersonId = parentId; const findPId = (n) => { if (n.id === parentId) parentPersonId = n.personId; if (n.heirs) n.heirs.forEach(findPId); }; findPId(tree);
    setVault(prev => {
      const newPersonId = `p_${Math.random().toString(36).substr(2, 9)}`;
      prev.persons[newPersonId] = { id: newPersonId, name: '', isDeceased: false, deathDate: '', marriageDate: '', remarriageDate: '', divorceDate: '', restoreDate: '', gender: '' };
      if (!prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = [];
      prev.relationships[parentPersonId].push({ targetId: newPersonId, relation: 'son', isExcluded: false, exclusionOption: '', isHoju: false, isSameRegister: true });
      if (parentPersonId !== prev.meta.rootPersonId) { Object.values(prev.relationships).forEach(links => { const pLink = links.find(l => l.targetId === parentPersonId); if (pLink) { pLink.isExcluded = false; pLink.exclusionOption = ''; } }); }
      return prev;
    });
  };

  const removeHeir = (id) => {
    let targetPersonId = id; let parentPersonId = null;
    const findNode = (n, pId) => { if (n.id === id) { targetPersonId = n.personId; parentPersonId = pId; return true; } return (n.heirs || []).some(child => findNode(child, n.personId)); }; findNode(tree, null);
    if (!parentPersonId) return;
    setVault(prev => { if (prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = prev.relationships[parentPersonId].filter(l => l.targetId !== targetPersonId); return prev; });
  };

  const [simpleTargetN, simpleTargetD] = math.simplify(tree.shareN || 1, tree.shareD || 1);

  const { finalShares, calcSteps, warnings, transitShares, blockingIssues } = useMemo(() => {
    const preprocessTree = (n, parentDate, parentNode, visited = new Set()) => {
      const pId = n.personId || n.id;
      if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };
      
      const clone = { ...n }; 
      const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      const newVisited = new Set(visited);
      newVisited.add(pId);

      if (clone.id !== 'root' && !clone.isExcluded) {
        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate); 
        const isDeadWithoutHeirs = clone.isDeceased && (!clone.heirs || clone.heirs.length === 0);
        
        if (isPre && isDeadWithoutHeirs) { 
          clone.isExcluded = true; 
          clone.exclusionOption = 'predeceased'; 
        } else if (!isPre && isDeadWithoutHeirs && parentNode && !clone.id.startsWith('auto_')) {
          const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
          if (!isSpouseType) {
            const pHeirs = parentNode.heirs || []; 
            const aliveAscendants = pHeirs.filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && (!h.isDeceased || (h.deathDate && isBefore(clone.deathDate, h.deathDate))) && !h.isExcluded);
            if (aliveAscendants.length > 0) {
              clone.heirs = aliveAscendants.map(asc => ({ ...asc, id: `auto_${asc.id}`, relation: 'parent', heirs: [] }));
            } else { 
              const siblings = pHeirs.filter(h => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded); 
              if (siblings.length > 0) clone.heirs = siblings.map(sib => ({ ...sib, id: `auto_${sib.id}`, relation: 'sibling', heirs: [] })); 
            }
          } else { 
            const stepChildren = parentNode.heirs.filter(h => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded); 
            if (stepChildren.length > 0) clone.heirs = stepChildren.map(child => ({ ...child, id: `auto_${child.id}`, relation: child.relation, heirs: [] })); 
          }
        }
      }
      if (clone.heirs) {
        clone.heirs = clone.heirs.map(h => preprocessTree(h, clone.deathDate || refDate, clone, newVisited));
      }
      return clone;
    };
    const calcTree = preprocessTree(tree, tree.deathDate, null); const result = calculateInheritance(calcTree, propertyValue);
    if (!result.warnings) result.warnings = []; return result;
  }, [tree, propertyValue]);

  const allFinalHeirs = useMemo(() => {
    if (!finalShares) return []; const list = []; if (finalShares.direct) list.push(...finalShares.direct);
    if (finalShares.subGroups) { const scan = (group) => { list.push(...group.shares); if (group.subGroups) group.subGroups.forEach(scan); }; finalShares.subGroups.forEach(scan); }
    return list;
  }, [finalShares]);

  const amountCalculations = useMemo(() => {
    if (!allFinalHeirs || allFinalHeirs.length === 0) return null;
    const estateVal = parseInt(String(propertyValue).replace(/[^0-9]/g, ''), 10) || 0;
    let totalSpecial = 0; let totalContrib = 0;
    allFinalHeirs.forEach(share => { totalSpecial += parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; totalContrib += parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; });
    const deemedEstate = estateVal + totalSpecial - totalContrib; let totalDistributed = 0;
    const results = allFinalHeirs.map(share => {
      const sVal = parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; const cVal = parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const statutoryAmount = Math.floor(deemedEstate * (share.n / share.d)); let modifiedAmount = statutoryAmount - sVal; if (modifiedAmount < 0) modifiedAmount = 0; 
      const finalAmount = modifiedAmount + cVal; totalDistributed += finalAmount;
      return { ...share, statutoryAmount, specialBenefit: sVal, contribution: cVal, finalAmount };
    });
    const remainder = estateVal - totalDistributed; return { estateVal, deemedEstate, totalSpecial, totalContrib, results, totalDistributed, remainder };
  }, [allFinalHeirs, propertyValue, specialBenefits, contributions]);

  useEffect(() => {
    if (!searchQuery.trim() || !finalShares || activeTab !== 'summary') { setMatchIds([]); setCurrentMatchIdx(0); return; }
    const query = searchQuery.trim().toLowerCase(); const matches = [];
    if (finalShares.direct) finalShares.direct.forEach(s => { if (s.name && s.name.toLowerCase().includes(query)) matches.push(`summary-row-${s.personId}`); });
    if (finalShares.subGroups) { const scan = (group) => { group.shares.forEach(s => { if (s.name && s.name.toLowerCase().includes(query)) matches.push(`summary-row-${s.personId}-${group.ancestor.id}`); }); if (group.subGroups) group.subGroups.forEach(scan); }; finalShares.subGroups.forEach(scan); }
    setMatchIds(matches); setCurrentMatchIdx(0);
  }, [searchQuery, finalShares, activeTab]);

  useEffect(() => {
    if (matchIds.length > 0 && activeTab === 'summary') { const targetId = matchIds[currentMatchIdx]; const element = document.getElementById(targetId); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [currentMatchIdx, matchIds, activeTab]);

  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings, transitShares);
  const {
    showGlobalWarning,
    showAutoCalcNotice,
    globalMismatchReasons,
    autoCalculatedNames,
    noSurvivors,
    auditActionItems,
    repairHints,
  } = guideInfo || {};

  const multipleSpouseGuides = useMemo(() => {
    const guides = []; const checkSpouses = (node) => { const spouses = (node.heirs || []).filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded); if ( spouses.length > 1) { guides.push({ id: node.id, uniqueKey: `multi-spouse-${node.personId}`, targetTabId: node.personId, type: 'mandatory', text: `[${node.name || '이름 없음'}] 유효 배우자가 중복 입력되었습니다. 실제 상속받을 1명만 남기고 나머지는 제외 처리해 주세요.` }); } if (node.heirs) node.heirs.forEach(checkSpouses); };
    checkSpouses(tree); return guides;
  }, [tree]);

  const hojuMissingGuides = useMemo(() => {
    const guides = [];
    const checkHoju = (node) => {
      if (node.isDeceased && node.heirs && node.heirs.length > 0) {
        const hasHoju = node.heirs.some(h => h.isHoju && !h.isExcluded);
        const effectiveDate = node.deathDate || tree.deathDate; 
        const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '아들'].includes(node.relation));
        if (needsHoju && !hasHoju) {
          guides.push({
            id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
            text: `[${node.name || '이름 없음'}]은 구법(${effectiveDate} 사망) 적용 대상입니다. 하위 상속인 중 호주상속인을 지정해 주세요.`
          });
        }
      }
      if (node.heirs) node.heirs.forEach(checkHoju);
    };
    checkHoju(tree);
    return guides;
  }, [tree]);

  const logicalMismatchGuides = useMemo(() => {
    const guides = [];
    if (!tree.name || !tree.name.trim()) { guides.push({ id: 'root', uniqueKey: 'missing-root-name', targetTabId: 'root', type: 'mandatory', text: '피상속인의 성명과 사망일자를 먼저 입력해 주세요.' }); } else if (!tree.deathDate) { guides.push({ id: 'root', uniqueKey: 'missing-root-death', targetTabId: 'root', type: 'mandatory', text: `[${tree.name || '이름 없음'}]의 사망일자를 입력해 주세요. 사망일자를 기준으로 적용 법령이 결정됩니다.` }); }
    const checkMismatch = (node, parentDeathDate, parentPersonId) => {
      const effectiveDate = parentDeathDate || tree.deathDate;
      const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);
      if (node.relation === 'daughter' && node.marriageDate && effectiveDate) { if (getLawEra(effectiveDate) !== '1991' && isBefore(node.marriageDate, effectiveDate) && node.isSameRegister !== false) { guides.push({ id: node.id, uniqueKey: `mismatch-married-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 없음'}]의 혼인일(${node.marriageDate})이 상속개시일(${effectiveDate}) 이전입니다. 구법 적용 대상일 수 있으므로 [출가] 상태를 확인해 주세요.` }); } }
      if (node.deathDate && effectiveDate && isBefore(node.deathDate, effectiveDate) && !isSpouse) { if (!node.isExcluded || node.exclusionOption !== 'predeceased') { guides.push({ id: node.id, uniqueKey: `mismatch-predeceased-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 없음'}]의 사망일(${node.deathDate})이 부모 사망일(${effectiveDate})보다 빠릅니다. [상속권 없음] 상태를 확인해 주세요.` }); } }
      if (isSpouse && node.remarriageDate && effectiveDate && isBefore(node.remarriageDate, effectiveDate)) { if (!node.isExcluded || node.exclusionOption !== 'remarried') { guides.push({ id: node.id, uniqueKey: `mismatch-remarried-self-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 없음'}]은 피상속인 사망일(${effectiveDate}) 이전에 재혼일(${node.remarriageDate})이 입력되어 있습니다. 재혼에 따른 상속권 여부를 확인해 주세요.` }); } }
      if (node.marriageDate && node.deathDate && isBefore(node.deathDate, node.marriageDate)) { guides.push({ id: node.id, uniqueKey: `date-mismatch-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 없음'}]의 혼인일(${node.marriageDate})이 사망일(${node.deathDate})보다 늦게 입력되어 있습니다. 날짜를 확인해 수정해 주세요.` }); }
      // 5단계 조기 발견: 사망자이나 하위 상속인이 없는 경우 검증
      if (node.isDeceased && node.isExcluded !== true && (!node.heirs || node.heirs.length === 0)) { guides.push({ id: node.id, uniqueKey: `missing-heirs-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름 없음'}]은(는) 사망자이나 재상속/대습상속인이 입력되지 않았습니다. 하위 상속인이 없다면 '상속인 없음(지분 재분배)' 등으로 처리해주세요.` }); }
      if (node.heirs) { node.heirs.forEach(h => { let nextEffectiveDate = effectiveDate; if (node.deathDate && !isBefore(node.deathDate, effectiveDate)) nextEffectiveDate = node.deathDate; checkMismatch(h, nextEffectiveDate, node.personId); }); }
    };
    if (tree.heirs) tree.heirs.forEach(h => checkMismatch(h, tree.deathDate, tree.personId || 'root'));
    return guides;
  }, [tree]);

  const rawSmartGuides = [ ...(guideInfo.smartGuides || []), ...multipleSpouseGuides, ...hojuMissingGuides, ...logicalMismatchGuides ];
  const uniqueGuidesMap = new Map(); rawSmartGuides.forEach(g => { const key = g.uniqueKey || g.text; if (!uniqueGuidesMap.has(key)) uniqueGuidesMap.set(key, g); });
  const smartGuides = Array.from(uniqueGuidesMap.values());
  const hasActionItems = (guideInfo?.hasActionItems) || smartGuides.length > 0;

  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const dismissGuide = (key) => setHiddenGuideKeys(prev => new Set(prev).add(key));

  const guideStatusMap = useMemo(() => {
    const map = {}; const setStatus = (key, type) => { if (!map[key]) map[key] = { mandatory: false, recommended: false, childMandatory: false, childRecommended: false }; if (type === 'mandatory') map[key].mandatory = true; if (type === 'recommended') map[key].recommended = true; };
    (smartGuides || []).forEach(g => { if (g.type === 'recommended' && hiddenGuideKeys.has(g.uniqueKey)) return; if (g.id) setStatus(g.id, g.type); const nameMatch = g.text.match(/\[(.*?)\]/); if (nameMatch?.[1]) setStatus(nameMatch[1], g.type); });
    const propagate = (node) => { const s = map[node.id] || map[node.name] || {}; let childMan = s.childMandatory || false; let childRec = s.childRecommended || false; (node.heirs || []).forEach(child => { propagate(child); const cs = map[child.id] || map[child.name] || {}; if (cs.mandatory || cs.childMandatory) childMan = true; if (cs.recommended || cs.childRecommended) childRec = true; }); const key = node.id || node.name; if (key) { if (!map[key]) map[key] = { mandatory: false, recommended: false, childMandatory: false, childRecommended: false }; map[key].childMandatory = childMan; map[key].childRecommended = childRec; } };
    if (tree) propagate(tree); return map;
  }, [smartGuides, hiddenGuideKeys, tree]);

  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const tabRefs = React.useRef({});

  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => { if (!curr) return null; const newPath = [...currentPath, curr]; if (curr.id === target || curr.personId === target) return newPath; if (curr.heirs) { for (const h of curr.heirs) { const res = findPath(h, target, newPath); if (res) return res; } } return null; };
    const lineage = findPath(tree, activeDeceasedTab); if (!lineage || lineage.length === 0) return { name: '', relationInfo: '', shareStr: '0', sources: [], isRoot: true };
    const targetNode = lineage[lineage.length - 1]; if (!targetNode) return { name: '', relationInfo: '', shareStr: '0', sources: [], isRoot: false };
    const isRoot = activeDeceasedTab === 'root'; const name = targetNode.name || (isRoot ? '피상속인' : '(이름 없음)'); let relationInfo = isRoot ? '(피상속인)' : '';
    if (!isRoot && lineage.length > 1) { const parent = lineage[lineage.length - 2]; const isChild = targetNode.relation === 'son' || targetNode.relation === 'daughter'; let parentNames = parent.name || '피상속인'; if (isChild) { const parentIsSp = parent.relation === 'wife' || parent.relation === 'husband' || parent.relation === 'spouse'; if (lineage.length > 2 && parentIsSp) { const grandparent = lineage[lineage.length - 3]; if (grandparent?.name) parentNames = `${grandparent.name}·${parent.name}`; } else if (parent.heirs) { const spouse = parent.heirs.find(h => h.id !== targetNode.id && ['wife', 'husband', 'spouse'].includes(h.relation) && h.name && h.name.trim() !== ''); if (spouse) parentNames = `${parent.name}·${spouse.name}`; } } relationInfo = `(${parentNames}의 ${getRelStr(targetNode.relation, tree.deathDate)})`; }
    let totalN = 0, totalD = 1; const sourceList = []; if (calcSteps && Array.isArray(calcSteps) && targetNode) { const myStep = calcSteps.find(s => s.dec?.personId === targetNode.personId); if (myStep) { totalN = myStep.inN; totalD = myStep.inD; if (myStep.mergeSources && myStep.mergeSources.length > 0) myStep.mergeSources.forEach(src => sourceList.push({ from: src.from, n: src.n, d: src.d })); else sourceList.push({ from: myStep.parentDecName || '피상속인', n: myStep.inN, d: myStep.inD }); } else { const myFinalShare = finalShares.direct.find(f => f.personId === targetNode.personId) || finalShares.subGroups.flatMap(g => g.shares).find(f => f.personId === targetNode.personId); if (myFinalShare) { totalN = myFinalShare.n; totalD = myFinalShare.d; } } }
    const shareStr = isRoot ? '1분의 1' : (totalN > 0 ? `${totalD}분의 ${totalN}` : '0'); return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps, finalShares]);

  useEffect(() => { const activeEl = tabRefs.current[activeDeceasedTab]; if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, [activeDeceasedTab]);
  useEffect(() => { const tabIds = deceasedTabs.map(t => t.id); if (!tabIds.includes(activeDeceasedTab)) { const fallback = (activeTab === 'input' && deceasedTabs.length > 0) ? deceasedTabs[0].id : 'root'; setActiveDeceasedTab(fallback); } }, [deceasedTabs, activeTab]);

  const activeTabObj = useMemo(() => deceasedTabs.find(t => t.id === activeDeceasedTab) || null, [deceasedTabs, activeDeceasedTab]);
  const handleDragEnd = (event) => { const { active, over } = event; if (over && active.id !== over.id) { setTree(prev => { const newTree = JSON.parse(JSON.stringify(prev)); const reorderList = (list) => { if (!list) return false; const activeIdx = list.findIndex(item => item.id === active.id); const overIdx = list.findIndex(item => item.id === over.id); if (activeIdx !== -1 && overIdx !== -1) { const [movedItem] = list.splice(activeIdx, 1); list.splice(overIdx, 0, movedItem); return true; } for (let item of list) { if (item.heirs && item.heirs.length > 0 && reorderList(item.heirs)) return true; } return false; }; reorderList(newTree.heirs); return newTree; }); } };

  const handlePrint = () => printCurrentTab({ activeTab, tree });
  const saveFile = () => saveFactTreeToFile(tree);
  const loadFile = (e) => {
    loadTreeFromJsonFile(e.target.files[0], { setTree, setActiveTab });
    e.target.value = '';
  };
  const handlePrintPrompt = () => printAiPromptDocument();
  const handleCopyPrompt = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(AI_PROMPT).then(() => alert('AI 안내문이 클립보드에 복사되었습니다. ChatGPT 등에 붙여넣어 사용하세요.'));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = AI_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('AI 안내문이 복사되었습니다.');
      } catch (err) {
        alert('복사에 실패했습니다. 직접 드래그하여 복사해 주세요.');
      }
      document.body.removeChild(textArea);
    }
  };
  const handleAiIngest = (input) =>
    ingestAiJsonInput({
      input,
      aiTargetId,
      tree,
      setTree,
      getInheritedDateForNode,
      setIsAiModalOpen,
      setAiInputText,
    });

  const performReset = (saveFirst) => { if (saveFirst) saveFile(); setVaultState({ history: [migrateToVault(getInitialTree())], currentIndex: 0 }); setActiveTab('input'); setActiveDeceasedTab('root'); setIsResetModalOpen(false); };
  useEffect(() => { const handleScroll = () => setShowScrollTop(window.scrollY > 200); window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, []);
  useEffect(() => { const handleGlobalKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoTree(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoTree(); } if (e.key === 'Escape' && !isAiModalOpen) { e.preventDefault(); setIsResetModalOpen(true); } }; window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown); }, [isAiModalOpen]);
  const handleExcelExport = () => {
    const rows = [
      ['사건번호', tree.caseNo || ''],
      ['피상속인', tree.name || ''],
      ['사망일자', tree.deathDate || ''],
      [''],
      ['상속인', '관계', '지분 분자', '지분 분모', '통분 분자', '통분 분모'],
    ];

    finalShares.direct.forEach((f) => {
      rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
    });

    (finalShares.subGroups || []).forEach((g) => {
      rows.push(['', `대습상속 [${g.ancestor?.name || ''}]`, '', '', '', '']);
      g.shares.forEach((f) => {
        rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
      });
    });

    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');

    a.href = url;
    a.download = `상속지분_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PrintReport tree={tree} activeTab={activeTab} activeDeceasedTab={activeDeceasedTab} finalShares={finalShares} calcSteps={calcSteps} amountCalculations={amountCalculations} propertyValue={propertyValue} />
      <div className="w-full min-h-screen relative flex flex-col items-start pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900 min-w-[1280px] print:hidden">
        <SmartGuidePanel
          showNavigator={showNavigator}
          setShowNavigator={setShowNavigator}
          navigatorWidth={navigatorWidth}
          handleNavigatorResizeMouseDown={handleNavigatorResizeMouseDown}
          hasActionItems={hasActionItems}
          noSurvivors={noSurvivors}
          activeTab={activeTab}
          warnings={warnings}
          deceasedTabs={deceasedTabs}
          setActiveDeceasedTab={setActiveDeceasedTab}
          tree={tree}
          smartGuides={smartGuides}
          hiddenGuideKeys={hiddenGuideKeys}
          dismissGuide={dismissGuide}
          showGlobalWarning={showGlobalWarning}
          globalMismatchReasons={globalMismatchReasons}
          auditActionItems={auditActionItems}
          repairHints={repairHints}
          handleNavigate={handleNavigate}
          showAutoCalcNotice={showAutoCalcNotice}
          autoCalculatedNames={autoCalculatedNames}
        />
      <TopToolbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        tree={tree}
        setAiTargetId={setAiTargetId}
        setIsAiModalOpen={setIsAiModalOpen}
        setShowNavigator={setShowNavigator}
        hasActionItems={hasActionItems}
        undoTree={undoTree}
        redoTree={redoTree}
        canUndo={vaultState.currentIndex > 0}
        canRedo={vaultState.currentIndex < vaultState.history.length - 1}
        setIsResetModalOpen={setIsResetModalOpen}
        loadFile={loadFile}
        saveFile={saveFile}
        handleExcelExport={handleExcelExport}
        handlePrint={handlePrint}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
      <SidebarTreePanel
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        sidebarSearchQuery={sidebarSearchQuery}
        setSidebarSearchQuery={setSidebarSearchQuery}
        sidebarMatchIds={sidebarMatchIds}
        sidebarCurrentMatchIdx={sidebarCurrentMatchIdx}
        handleSidebarPrevMatch={handleSidebarPrevMatch}
        handleSidebarNextMatch={handleSidebarNextMatch}
        setSidebarToggleSignal={setSidebarToggleSignal}
        sidebarToggleSignal={sidebarToggleSignal}
        tree={tree}
        handleNavigate={handleNavigate}
        guideStatusMap={guideStatusMap}
        handleResizeMouseDown={handleResizeMouseDown}
      />
      <main className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`} style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 10) : 0, paddingRight: showNavigator ? (navigatorWidth + 10) : 0 }}>
        <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: (sidebarOpen || showNavigator) ? 'flex-start' : 'center' }}>
          <div className="flex flex-col w-[1080px] min-w-[1080px] shrink-0 px-6 mt-6 print-compact relative z-10">
            <div className="flex items-end pl-[48px] gap-1 no-print relative z-20">
              {tabData.map(t => {
                const isActive = activeTab === t.id;
                return <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] flex items-center gap-2 transition-all relative cursor-pointer border-2 border-b-0 ${isActive ? `bg-white dark:bg-neutral-800 ${t.style.activeBorder} ${t.style.activeText} pb-3 top-[2px] z-20` : `${t.style.inactiveBg} dark:bg-neutral-800/40 ${t.style.inactiveBorder} dark:border-neutral-700 ${t.style.inactiveText} dark:text-neutral-500 pb-2.5 top-[1px] z-10 hover:brightness-95`}`}>{t.icon} {t.label}</button>;
              })}
            </div>
            <div className="border border-[#e9e9e7] dark:border-neutral-700 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:border-none print:shadow-none min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col p-10 relative z-0 transition-colors">
              {activeTab === 'input' && (
                <InputPanel
                  tree={tree}
                  activeDeceasedTab={activeDeceasedTab}
                  activeTabObj={activeTabObj}
                  finalShares={finalShares}
                  issues={blockingIssues}
                  handleUpdate={handleUpdate}
                  removeHeir={removeHeir}
                  addHeir={addHeir}
                  handleKeyDown={handleKeyDown}
                  handleRootUpdate={handleRootUpdate}
                  handleDragEnd={handleDragEnd}
                  sensors={sensors}
                  setAiTargetId={setAiTargetId}
                  setIsAiModalOpen={setIsAiModalOpen}
                  isMainQuickActive={isMainQuickActive}
                  setIsMainQuickActive={setIsMainQuickActive}
                  mainQuickVal={mainQuickVal}
                  setMainQuickVal={setMainQuickVal}
                  handleQuickSubmit={handleQuickSubmit}
                  getBriefingInfo={getBriefingInfo}
                  setActiveDeceasedTab={setActiveDeceasedTab}
                />
              )}
              {activeTab === 'tree' && (
                <TreePanel
                  tree={tree}
                  treeToggleSignal={treeToggleSignal}
                  isAllExpanded={isAllExpanded}
                  setTreeToggleSignal={setTreeToggleSignal}
                  setIsAllExpanded={setIsAllExpanded}
                />
              )}
              {(activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary' || activeTab === 'amount') && <MetaHeader tree={tree} />}
              {activeTab === 'calc' && <CalcPanel calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} />}
              {activeTab === 'result' && <ResultPanel calcSteps={calcSteps} tree={tree} issues={blockingIssues} handleNavigate={handleNavigate} />}
              {activeTab === 'summary' && (
                <SummaryPanel
                  tree={tree}
                  finalShares={finalShares}
                  issues={blockingIssues}
                  handleNavigate={handleNavigate}
                  matchIds={matchIds}
                  currentMatchIdx={currentMatchIdx}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  simpleTargetN={simpleTargetN}
                  simpleTargetD={simpleTargetD}
                />
              )}
              {activeTab === 'amount' && (
                <AmountPanel
                  tree={tree}
                  finalShares={finalShares}
                  amountCalculations={amountCalculations}
                  propertyValue={propertyValue}
                  setPropertyValue={setPropertyValue}
                  specialBenefits={specialBenefits}
                  setSpecialBenefits={setSpecialBenefits}
                  contributions={contributions}
                  setContributions={setContributions}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <div
        className="fixed bottom-5 right-8 z-[40] pointer-events-none select-none no-print"
        style={{
          fontFamily: '"Segoe Script", "Snell Roundhand", "Brush Script MT", cursive',
          fontSize: '22px',
          letterSpacing: '0.02em',
          color: isDarkMode ? 'rgba(115,115,115,0.42)' : 'rgba(148,143,136,0.38)',
          textShadow: isDarkMode
            ? '1px 1px 0 rgba(255,255,255,0.05), -1px -1px 0 rgba(0,0,0,0.22)'
            : '1px 1px 0 rgba(255,255,255,0.82), -1px -1px 0 rgba(130,120,110,0.10)',
          transform: 'rotate(-2deg)',
        }}
      >
        Designed by J.H. Lee
      </div>
      <AiImportModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSubmit={handleAiIngest}
        onTextareaAutoSubmit={handleAiIngest}
        onCopyPrompt={handleCopyPrompt}
        onPrintPrompt={handlePrintPrompt}
        aiInputText={aiInputText}
        setAiInputText={setAiInputText}
      />
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={performReset}
      />
      {duplicateRequest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700">
            <h3 className="text-lg font-bold text-[#37352f] dark:text-neutral-100 flex items-center gap-2">
              <IconUserPlus className="w-5 h-5 text-blue-500" /> 이름 중복 확인
            </h3>
            <p className="mt-3 text-[14px] text-[#787774] dark:text-neutral-400 leading-relaxed">
              이미 등록된 <span className="font-bold text-[#37352f] dark:text-neutral-200">[{duplicateRequest.name}]</span>(이)라는 이름이 <span className="font-bold text-[#37352f] dark:text-neutral-200">{duplicateRequest.parentName}</span>의 {getRelStr(duplicateRequest.relation, tree.deathDate)} 계보에 존재합니다.
            </p>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-[13px] text-blue-700 dark:text-blue-300">
              이 상속인이 <span className="font-bold">동일인</span>입니까?
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={duplicateRequest.onCancel} className="px-4 py-2 text-[13px] font-bold text-[#787774] hover:bg-[#f7f7f5] rounded-xl transition-colors">취소</button>
              <button onClick={() => duplicateRequest.onConfirm(false)} className="px-4 py-2 text-[13px] font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">아니오 (동명이인)</button>
              <button onClick={() => duplicateRequest.onConfirm(true)} className="px-4 py-2 text-[13px] font-bold bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-all">예 (동일인)</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
