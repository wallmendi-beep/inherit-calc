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
import SummaryPanel from './components/SummaryPanelFixed';
import AmountPanel from './components/AmountPanel';
import CalcPanel from './components/CalcPanelFinal';
import ResultPanel from './components/ResultPanelFixed';
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
import { AI_PROMPT } from './utils/aiPromptUtf8';
import { normalizeImportedTree, updateDeathInfo, updateHistoryInfo, updateRelationInfo, setHojuStatus, setPrimaryHojuSuccessor, applyNodeUpdates, appendQuickHeirs, serializeFactTree } from './utils/treeDomain';
import { migrateToVault, buildTreeFromVault } from './utils/vaultTransforms';
import { stripHojuBonusInputs, buildHojuBonusDiffs } from './utils/hojuBonusCompare';
import { collectImportValidationIssues } from './utils/importValidationV2';
import { ingestAiJsonInput, loadTreeFromJsonFile, printAiPromptDocument, printCurrentTab, saveFactTreeToFile } from './utils/appActions';
import { useSmartGuide } from './hooks/useSmartGuide';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { QRCodeSVG } from 'qrcode.react'; // 메모: v3.0 브리핑 출력용 QR 코드 생성

function App() {
  const HISTORY_LIMIT = 10;
  const CHANGELOG_LIMIT = 300;
  const CHANGELOG_STORAGE_KEY = 'inheritance-calc-action-log-v1';
  const cloneDeep = (value) => {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  };

  const buildImportIssueSignature = (issues = []) =>
    issues
      .map((issue) => [
        issue.code || '',
        issue.personId || '',
        issue.nodeId || '',
        issue.targetTabId || '',
        issue.message || '',
      ].join('|'))
      .sort()
      .join('||');

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
  const [importIssues, setImportIssues] = useState([]);
  const [changeLog, setChangeLog] = useState([]);

  const appendChangeLog = (entry) => {
    setChangeLog((prev) => {
      const next = [
        ...prev,
        {
          at: new Date().toISOString(),
          ...entry,
        },
      ];
      return next.length > CHANGELOG_LIMIT ? next.slice(next.length - CHANGELOG_LIMIT) : next;
    });
  };

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
      const newVault = typeof action === 'function' ? action(cloneDeep(currentVault)) : action;
      const parsedVault = cloneDeep(newVault); 
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(parsedVault);
      if (newHistory.length > HISTORY_LIMIT) newHistory.shift();
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
      if (newHistory.length > HISTORY_LIMIT) newHistory.shift();
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    });
  };

  const tree = useMemo(() => buildTreeFromVault(rawVault) || getInitialTree(), [rawVault]);

  useEffect(() => {
    // [v4.47 안정화] 입력 중 실시간 import 재검사는 메모리/CPU 부담이 커서 중단했다.
    // importIssues는 파일/AI 불러오기 시점에만 생성하고, 이후에는 명시적 확인 흐름만 유지한다.
  }, [tree, importIssues, activeTab]);

  useEffect(() => {
    if (activeTab !== 'input') return undefined;
    if (!importIssues || importIssues.length === 0) return undefined;

    const timer = setTimeout(() => {
      const refreshedIssues = collectImportValidationIssues(tree);
      if (buildImportIssueSignature(refreshedIssues) !== buildImportIssueSignature(importIssues)) {
        setImportIssues(refreshedIssues);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [tree, activeTab, importIssues]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(CHANGELOG_STORAGE_KEY, JSON.stringify({
          updatedAt: new Date().toISOString(),
          caseNo: tree.caseNo || '',
          decedentName: tree.name || '',
          changeLog,
        }));
      } catch (error) {
        // localStorage quota can fail silently; keep app responsive.
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [changeLog, tree.caseNo, tree.name]);

  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set();
    const visitedNodes = new Set(); // ????紐껊굡 ?癒?퍥????쀬넎 筌〓챷??獄쎻뫗???
  tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      if (!node || visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);

      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouseNode = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
      const parentDeathDate = parentNode?.deathDate || tree.deathDate;
      const isPredeceasedSpouse = isSpouseNode && node.deathDate && parentDeathDate && isBefore(node.deathDate, parentDeathDate);
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
            inheritanceType: node.isDeceased ? 'deceased' : 'excluded',
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

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [showNavigator, setShowNavigator] = useState(true);

  const handleNavigate = (nodeId) => {
    if (!nodeId) return;

    // [v4.60] 가계도 보기 모드로의 직접 이동 지원
    if (nodeId === 'tree') {
      setActiveTab('tree');
      // TreePanel의 초기 viewMode가 'flow'일 수 있으므로 주의가 필요합니다.
      // 하지만 사용자 요구사항에 따라 탭을 전환합니다.
      return;
    }

    setActiveTab('input');
    if (typeof nodeId === 'string' && nodeId.startsWith('tab:')) {
      const targetTabId = nodeId.split(':')[1];
      setActiveDeceasedTab(targetTabId);
      setIsFolderFocused(true);
      return;
    }
    let resolvedNodeId = null;
    const findTabIdForNode = (currentNode, currentTabId, visited = new Set()) => {
      if (!currentNode || visited.has(currentNode.id)) return null;
      visited.add(currentNode.id);
      if (currentNode.id === nodeId || currentNode.personId === nodeId) {
        resolvedNodeId = currentNode.id;
        return currentTabId;
      }
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          const isTabOwner = h.isDeceased || (h.isExcluded && ['lost', 'disqualified'].includes(h.exclusionOption));
          if (h.id === nodeId || h.personId === nodeId) {
            resolvedNodeId = h.id;
            return isTabOwner ? h.personId : currentTabId;
          }
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
      const targetDomId = resolvedNodeId || nodeId;
      const element = document.querySelector(`[data-node-id="${targetDomId}"]`);
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
    appendChangeLog({ type: 'appendQuickHeirs', parentId, raw: value });
    setTree(prev => appendQuickHeirs(prev, parentId, value));
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth, setNavigatorWidth] = useState(310);
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
      { id: 'tree', label: '시뮬레이션', icon: <IconNetwork className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'calc', label: '계산 상세', icon: <IconTable className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'result', label: '결과 리포트', icon: <IconFileText className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'summary', label: '법정 상속분', icon: <IconList className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
    { id: 'amount', label: '구체적 상속분', icon: <IconCalculator className="w-4 h-4"/>, style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' } },
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
    appendChangeLog({ type: action.type || 'unknown', nodeId: action.nodeId || '', parentNodeId: action.parentNodeId || '' });

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
        case 'setPrimaryHojuSuccessor':
          return setPrimaryHojuSuccessor(prev, action.parentNodeId, action.nodeId, action.isSelected);
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
        if (parentNodeOfExisting?.id === parentNodeOfCurrent?.id) {
          setDuplicateRequest({
            name: trimmedValue,
            parentName: parentNodeOfExisting?.name || '피상속인',
            relation: existingNode.relation,
            isSameBranch: true,
            onConfirm: (isSame) => {
              if (isSame) {
                alert(`'${trimmedValue}'은(는) 같은 관계의 상속인으로 이미 등록되어 있습니다.\n동일인이라면 한 번만 등록해 주세요.`);
              } else {
                setTree(prev => {
                  const renameBase = (n) => {
                    if (n.id === existingNode.id && n.name === baseName) return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] };
                    return { ...n, heirs: n.heirs?.map(renameBase) || [] };
                  };
                  return renameBase(prev);
                });
                const nextSuffix = allSameBaseDups.length + 1;
                applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false);
              }
              setDuplicateRequest(null);
            },
            onCancel: () => setDuplicateRequest(null),
          });
          return;
        }
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
      const personalKeys = ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender', 'successorStatus'];
      personalKeys.forEach(k => { if (updates[k] !== undefined) prev.persons[targetPersonId][k] = updates[k]; });
      const linkKeys = ['relation', 'isExcluded', 'exclusionOption', 'isHoju', 'isPrimaryHojuSuccessor', 'isSameRegister'];
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
    appendChangeLog({ type: 'updateRootField', field });
    setVault(prev => {
      const rootId = prev.meta.rootPersonId;
      if (['caseNo', 'shareN', 'shareD'].includes(field)) { if (field === 'caseNo') prev.meta.caseNo = value; if (field === 'shareN') prev.meta.targetShareN = value; if (field === 'shareD') prev.meta.targetShareD = value; }
      else prev.persons[rootId][field] = value;
      return prev;
    });
  };

  const addHeir = (parentId) => {
    appendChangeLog({ type: 'addHeir', parentId });
    let parentPersonId = parentId; const findPId = (n) => { if (n.id === parentId) parentPersonId = n.personId; if (n.heirs) n.heirs.forEach(findPId); }; findPId(tree);
    setVault(prev => {
      const newPersonId = `p_${Math.random().toString(36).substr(2, 9)}`;
      prev.persons[newPersonId] = { id: newPersonId, name: '', isDeceased: false, deathDate: '', marriageDate: '', remarriageDate: '', divorceDate: '', restoreDate: '', gender: '', successorStatus: '' };
      if (prev.persons[parentPersonId]) prev.persons[parentPersonId].successorStatus = '';
      if (!prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = [];
      prev.relationships[parentPersonId].push({ targetId: newPersonId, relation: 'son', isExcluded: false, exclusionOption: '', isHoju: false, isSameRegister: true });
      if (parentPersonId !== prev.meta.rootPersonId) { Object.values(prev.relationships).forEach(links => { const pLink = links.find(l => l.targetId === parentPersonId); if (pLink) { pLink.isExcluded = false; pLink.exclusionOption = ''; } }); }
      return prev;
    });
  };

  const removeHeir = (id) => {
    appendChangeLog({ type: 'removeHeir', nodeId: id });
    let targetPersonId = id; let parentPersonId = null;
    const findNode = (n, pId) => { if (n.id === id) { targetPersonId = n.personId; parentPersonId = pId; return true; } return (n.heirs || []).some(child => findNode(child, n.personId)); }; findNode(tree, null);
    if (!parentPersonId) return;
    setVault(prev => { if (prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = prev.relationships[parentPersonId].filter(l => l.targetId !== targetPersonId); return prev; });
  };

  const appendResolvedHeirs = (parentId, heirsToAdd = []) => {
    if (!Array.isArray(heirsToAdd) || heirsToAdd.length === 0) return;
    appendChangeLog({ type: 'appendResolvedHeirs', parentId, count: heirsToAdd.length });

    let parentPersonId = parentId;
    const findPId = (n) => {
      if (!n) return;
      if (n.id === parentId || n.personId === parentId) {
        parentPersonId = n.personId || n.id;
        return;
      }
      (n.heirs || []).forEach(findPId);
    };
    findPId(tree);

    setVault(prev => {
      const ensurePersonExists = (item) => {
        const existingPersonId = item.personId && prev.persons[item.personId] ? item.personId : null;
        if (existingPersonId) return existingPersonId;

        const newPersonId = `p_${Math.random().toString(36).substr(2, 9)}`;
        prev.persons[newPersonId] = {
          id: newPersonId,
          name: item.name || '',
          isDeceased: !!item.isDeceased,
          deathDate: item.deathDate || '',
          marriageDate: item.marriageDate || '',
          remarriageDate: item.remarriageDate || '',
          divorceDate: item.divorceDate || '',
          restoreDate: item.restoreDate || '',
          gender: item.gender || '',
          successorStatus: item.successorStatus || '',
        };
        return newPersonId;
      };

      const ensureLink = (parentVaultPersonId, item) => {
        const targetId = ensurePersonExists(item);
        if (!prev.relationships[parentVaultPersonId]) prev.relationships[parentVaultPersonId] = [];

        const alreadyLinked = prev.relationships[parentVaultPersonId].some((link) => link.targetId === targetId);
        if (!alreadyLinked) {
          prev.relationships[parentVaultPersonId].push({
            targetId,
            relation: item.relation || 'son',
            isExcluded: !!item.isExcluded,
            exclusionOption: item.exclusionOption || '',
            isHoju: !!item.isHoju,
            isPrimaryHojuSuccessor: !!item.isPrimaryHojuSuccessor,
            isSameRegister: item.isSameRegister !== false,
          });
        }

        // 기존 인물을 재사용하는 경우에는 이미 그 personId 아래 관계 그래프가 존재하므로
        // 하위 서브트리를 다시 복제하지 않는다. 이게 메모리 폭증의 주된 원인이었다.
        if (!(item.personId && prev.persons[item.personId])) {
          (item.heirs || []).forEach((child) => ensureLink(targetId, child));
        }
      };

      if (!prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = [];
      if (prev.persons[parentPersonId]) prev.persons[parentPersonId].successorStatus = '';

      heirsToAdd.forEach((item) => {
        ensureLink(parentPersonId, item);
      });

      if (parentPersonId !== prev.meta.rootPersonId) {
        Object.values(prev.relationships).forEach((links) => {
          const parentLink = links.find((link) => link.targetId === parentPersonId);
          if (parentLink) {
            parentLink.isExcluded = false;
            parentLink.exclusionOption = '';
          }
        });
      }

      return prev;
    });
  };

  const removeAllHeirs = (parentId) => {
    appendChangeLog({ type: 'removeAllHeirs', parentId });
    let parentPersonId = parentId;
    const findPId = (n) => {
      if (!n) return;
      if (n.id === parentId || n.personId === parentId) {
        parentPersonId = n.personId || n.id;
        return;
      }
      (n.heirs || []).forEach(findPId);
    };
    findPId(tree);

    setVault(prev => {
      if (prev.relationships[parentPersonId]) {
        prev.relationships[parentPersonId] = [];
      }
      return prev;
    });
  };

  const [simpleTargetN, simpleTargetD] = math.simplify(tree.shareN || 1, tree.shareD || 1);

  const { finalShares, calcSteps, warnings, transitShares, blockingIssues, compareFinalShares, hojuBonusDiffs } = useMemo(() => {
    const preprocessTree = (n, parentDate, parentNode, visited = new Set()) => {
      const pId = n.personId || n.id;
      if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };
      
      const clone = { ...n }; 
      const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      const newVisited = new Set(visited);
      newVisited.add(pId);

      if (clone.id !== 'root') {
        // [v3.0.13] Smart Inference: 혼인 시점에 따른 동일가적 여부 자동 추정
        if (clone.relation === 'daughter' && clone.marriageDate && refDate) {
          const lawEra = getLawEra(refDate);
          if (lawEra !== '1991') {
            const wasMarriedAtDeath = !isBefore(refDate, clone.marriageDate);
            clone.isSameRegister = !wasMarriedAtDeath;
            clone._isInferredRegister = true;
          }
        }

        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate); 
        const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
        const hasHeirsInModel = clone.heirs && clone.heirs.length > 0;
        
        // [v3.1.5] 하위 상속인이 있다면 제외 처리(isExcluded)를 강제로 해제한다. (지분 0 방지)
        if (hasHeirsInModel && !(isPre && isSpouseType)) {
          clone.isExcluded = false;
          clone.exclusionOption = ''; 
        }

        if (isPre && isSpouseType) {
          clone.isExcluded = true;
          clone.exclusionOption = 'predeceased';
        }

        const isDeadWithoutHeirs = clone.isDeceased && !hasHeirsInModel;
        
        // [선사망자] 하위 상속인이 없으면 강제로 제외 처리
        if (isPre && isDeadWithoutHeirs) { 
          clone.isExcluded = true; 
          clone.exclusionOption = 'predeceased'; 
        } 
        // [후사망자] 하위 상속인이 없어도 기본적으로 상속권을 유지(On)하고 안내만 표시
        else if (!isPre && isDeadWithoutHeirs && parentNode && !clone.id.startsWith('auto_')) {
          clone.isExcluded = false; // 후사망자는 명시적으로 제외 상태 해제
          clone.exclusionOption = '';
          if (!isSpouseType) {
            const pHeirs = parentNode.heirs || []; 
            const aliveAscendants = pHeirs.filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && (!h.isDeceased || (h.deathDate && !isBefore(h.deathDate, clone.deathDate))) && !h.isExcluded);
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
    const calcTree = preprocessTree(tree, tree.deathDate, null);
    const shouldBuildCalcSteps = ['tree', 'calc', 'result', 'summary', 'amount'].includes(activeTab);
    const result = calculateInheritance(calcTree, propertyValue, { includeCalcSteps: shouldBuildCalcSteps });
    const shouldBuildCompare = ['calc', 'result', 'summary'].includes(activeTab);
    const compareTree = shouldBuildCompare ? stripHojuBonusInputs(calcTree) : null;
    const compareResult = shouldBuildCompare
      ? calculateInheritance(compareTree, propertyValue, { includeCalcSteps: false })
      : null;
    if (!result.warnings) result.warnings = [];
    return {
      ...result,
      compareFinalShares: compareResult?.finalShares || {},
      hojuBonusDiffs: shouldBuildCompare ? buildHojuBonusDiffs(result.finalShares || {}, compareResult?.finalShares || {}) : [],
    };
  }, [tree, propertyValue, activeTab]);

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

  useEffect(() => {
    if (activeTab === 'tree') {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  const shouldComputeSmartGuide = showNavigator || activeTab === 'input';
  const guideInfo = useSmartGuide(
    shouldComputeSmartGuide ? tree : null,
    shouldComputeSmartGuide ? finalShares : null,
    activeTab,
    shouldComputeSmartGuide ? warnings : null,
    shouldComputeSmartGuide ? transitShares : null,
    shouldComputeSmartGuide ? importIssues : null,
  );
  const {
    showGlobalWarning,
    showAutoCalcNotice,
    globalMismatchReasons,
    autoCalculatedNames,
    noSurvivors,
    auditActionItems,
    repairHints,
  } = guideInfo || {};


  // guideInfo.smartGuides가 실제로 바뀔 때만 새 배열을 만든다.
  // useMemo 없이 spread를 쓰면 매 렌더마다 새 참조가 생기고,
  // useEffect([smartGuides])가 무한 실행되며 메모리 누수가 발생한다.
  const smartGuides = useMemo(() => {
    const rawGuides = guideInfo.smartGuides || [];
    const uniqueGuidesMap = new Map();
    rawGuides.forEach((g) => {
      const key = `${g.type || 'guide'}:${g.text || g.uniqueKey || ''}`;
      if (!uniqueGuidesMap.has(key)) uniqueGuidesMap.set(key, g);
    });
    return Array.from(uniqueGuidesMap.values());
  }, [guideInfo.smartGuides]);
  const hasActionItems = (guideInfo?.hasActionItems) || smartGuides.length > 0;

  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const dismissGuide = (key) => setHiddenGuideKeys(prev => new Set(prev).add(key));
  const [checkedGuideKeys, setCheckedGuideKeys] = useState(new Set());
  const [confirmedGuidesOpen, setConfirmedGuidesOpen] = useState(false);
  const toggleGuideChecked = (key) => {
    setCheckedGuideKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const liveKeys = new Set((smartGuides || []).map((guide) => guide.uniqueKey || guide.text));
    setCheckedGuideKeys((prev) => {
      const next = new Set([...prev].filter((key) => liveKeys.has(key)));
      // 내용이 같으면 이전 참조를 그대로 반환해 불필요한 리렌더를 막는다.
      if (next.size === prev.size && [...next].every(k => prev.has(k))) return prev;
      return next;
    });
  }, [smartGuides]);

  const confirmedGuides = useMemo(
    () => (smartGuides || []).filter((guide) => checkedGuideKeys.has(guide.uniqueKey || guide.text)),
    [smartGuides, checkedGuideKeys],
  );

  const guideStatusMap = useMemo(() => {
    const map = {}; const setStatus = (key, type) => { if (!map[key]) map[key] = { mandatory: false, recommended: false, childMandatory: false, childRecommended: false }; if (type === 'mandatory') map[key].mandatory = true; if (type === 'recommended') map[key].recommended = true; };
    (smartGuides || []).forEach(g => { if (g.type === 'recommended' && hiddenGuideKeys.has(g.uniqueKey)) return; if (g.id) setStatus(g.id, g.type); const nameMatch = g.text.match(/\[(.*?)\]/); if (nameMatch?.[1]) setStatus(nameMatch[1], g.type); });
    const propagate = (node) => { const s = map[node.id] || map[node.name] || {}; let childMan = s.childMandatory || false; let childRec = s.childRecommended || false; (node.heirs || []).forEach(child => { propagate(child); const cs = map[child.id] || map[child.name] || {}; if (cs.mandatory || cs.childMandatory) childMan = true; if (cs.recommended || cs.childRecommended) childRec = true; }); const key = node.id || node.name; if (key) { if (!map[key]) map[key] = { mandatory: false, recommended: false, childMandatory: false, childRecommended: false }; map[key].childMandatory = childMan; map[key].childRecommended = childRec; } };
    if (tree) propagate(tree); return map;
  }, [smartGuides, hiddenGuideKeys, tree]);

  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const tabRefs = React.useRef({});

  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => {
      if (!curr) return null;
      const newPath = [...currentPath, curr];
      if (curr.id === target || curr.personId === target) return newPath;
      if (curr.heirs) {
        for (const h of curr.heirs) {
          const res = findPath(h, target, newPath);
          if (res) return res;
        }
      }
      return null;
    };

    const lineage = findPath(tree, activeDeceasedTab);
    if (!lineage || lineage.length === 0) return { name: '', relationInfo: '', shareStr: '0', sources: [], isRoot: true };

    const targetNode = lineage[lineage.length - 1];
    if (!targetNode) return { name: '', relationInfo: '', shareStr: '0', sources: [], isRoot: false };

    const isRoot = activeDeceasedTab === 'root';
    const name = targetNode.name || (isRoot ? '피상속인' : '(이름 없음)');
    let relationInfo = isRoot ? '(피상속인)' : '';

    if (!isRoot && lineage.length > 1) {
      const parent = lineage[lineage.length - 2];
      const isChild = targetNode.relation === 'son' || targetNode.relation === 'daughter';
      let parentNames = parent.name || '피상속인';

      if (isChild) {
        const parentIsSpouse = ['wife', 'husband', 'spouse'].includes(parent.relation);
        if (lineage.length > 2 && parentIsSpouse) {
          const grandparent = lineage[lineage.length - 3];
          if (grandparent?.name) parentNames = `${grandparent.name}·${parent.name}`;
        } else if (parent.heirs) {
          const spouse = parent.heirs.find(
            (h) => h.id !== targetNode.id && ['wife', 'husband', 'spouse'].includes(h.relation) && h.name && h.name.trim() !== ''
          );
          if (spouse) parentNames = `${parent.name}·${spouse.name}`;
        }
      }

      relationInfo = `(${parentNames}의 ${getRelStr(targetNode.relation, tree.deathDate)})`;
    }

    let totalN = 0;
    let totalD = 1;
    const sourceList = [];
    const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
    const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

    const myStep = Array.isArray(calcSteps)
      ? calcSteps.find((s) => s.dec?.personId === targetNode.personId)
      : null;

    if (myStep) {
      totalN = myStep.inN;
      totalD = myStep.inD;
      if (myStep.mergeSources?.length) {
        myStep.mergeSources.forEach((src) => sourceList.push({ from: src.from, n: src.n, d: src.d }));
      } else {
        sourceList.push({ from: myStep.parentDecName || '피상속인', n: myStep.inN, d: myStep.inD });
      }
    } else {
      const myFinalShare =
        finalShares.direct.find((f) => f.personId === targetNode.personId) ||
        finalShares.subGroups.flatMap((g) => g.shares).find((f) => f.personId === targetNode.personId);

      if (myFinalShare) {
        totalN = myFinalShare.n;
        totalD = myFinalShare.d;
      } else {
        const ancestorGroup = finalShares.subGroups.find((g) => g.ancestor?.personId === targetNode.personId);
        const mergedSources = ancestorGroup?.sourceBreakdown?.mergeSources || [];
        if (mergedSources.length > 0) {
          const commonD = mergedSources.reduce((acc, src) => lcm(acc, Number(src.d) || 1), 1);
          totalN = mergedSources.reduce(
            (sum, src) => sum + (Number(src.n) || 0) * (commonD / (Number(src.d) || 1)),
            0,
          );
          totalD = commonD;
          mergedSources.forEach((src) => sourceList.push({ from: src.from, n: src.n, d: src.d }));
        }
      }
    }

    const shareStr = isRoot ? '1분의 1' : totalN > 0 ? `${totalD}분의 ${totalN}` : '0';
    return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps, finalShares]);
  useEffect(() => { const activeEl = tabRefs.current[activeDeceasedTab]; if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, [activeDeceasedTab]);
  useEffect(() => { const tabIds = deceasedTabs.map(t => t.id); if (!tabIds.includes(activeDeceasedTab)) { const fallback = (activeTab === 'input' && deceasedTabs.length > 0) ? deceasedTabs[0].id : 'root'; setActiveDeceasedTab(fallback); } }, [deceasedTabs, activeTab]);

  const activeTabObj = useMemo(() => deceasedTabs.find(t => t.id === activeDeceasedTab) || null, [deceasedTabs, activeDeceasedTab]);
  const handleDragEnd = (event) => { const { active, over } = event; if (over && active.id !== over.id) { setTree(prev => { const newTree = cloneDeep(prev); const reorderList = (list) => { if (!list) return false; const activeIdx = list.findIndex(item => item.id === active.id); const overIdx = list.findIndex(item => item.id === over.id); if (activeIdx !== -1 && overIdx !== -1) { const [movedItem] = list.splice(activeIdx, 1); list.splice(overIdx, 0, movedItem); return true; } for (let item of list) { if (item.heirs && item.heirs.length > 0 && reorderList(item.heirs)) return true; } return false; }; reorderList(newTree.heirs); return newTree; }); } };

  const handlePrint = () => printCurrentTab({ activeTab, tree });
  const saveFile = () => {
    const scenarioData = {
      propertyValue,
      specialBenefits,
      contributions,
      isAmountActive
    };
    saveFactTreeToFile(tree, scenarioData);
  };
  const loadFile = (e) => {
    loadTreeFromJsonFile(e.target.files[0], { 
      setTree, 
      setActiveTab, 
      setImportIssues,
      setPropertyValue,
      setSpecialBenefits,
      setContributions,
      setIsAmountActive
    });
    e.target.value = '';
  };
  const handlePrintPrompt = () => printAiPromptDocument();
  const handleCopyPrompt = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(AI_PROMPT).then(() => alert('AI 안내문이 클립보드에 복사되었습니다. ChatGPT 창에 붙여 넣어 사용해 주세요.'));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = AI_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('AI 안내문이 복사되었습니다.');
      } catch (err) {
        alert('복사에 실패했습니다. 직접 드래그해서 복사해 주세요.');
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
      setActiveTab,
      setImportIssues,
      getInheritedDateForNode,
      setIsAiModalOpen,
      setAiInputText,
    });

  const performReset = (saveFirst) => { if (saveFirst) saveFile(); setVaultState({ history: [migrateToVault(getInitialTree())], currentIndex: 0 }); setImportIssues([]); setActiveTab('input'); setActiveDeceasedTab('root'); setIsResetModalOpen(false); };
  useEffect(() => { const handleScroll = () => setShowScrollTop(window.scrollY > 200); window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, []);
  useEffect(() => { const handleGlobalKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoTree(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoTree(); } if (e.key === 'Escape' && !isAiModalOpen) { e.preventDefault(); setIsResetModalOpen(true); } }; window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown); }, [isAiModalOpen]);
  const handleExcelExport = () => {
    const rows = [
      ['사건번호', tree.caseNo || ''],
      ['피상속인', tree.name || ''],
      ['사망일자', tree.deathDate || ''],
      [''],
      ['상속인', '관계', '지분 분자', '지분 분모', '금액 분자', '금액 분모'],
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
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣-]/g, '');

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
          checkedGuideKeys={checkedGuideKeys}
          toggleGuideChecked={toggleGuideChecked}
          confirmedGuides={confirmedGuides}
          confirmedGuidesOpen={confirmedGuidesOpen}
          setConfirmedGuidesOpen={setConfirmedGuidesOpen}
          showGlobalWarning={showGlobalWarning}
          globalMismatchReasons={globalMismatchReasons}
          auditActionItems={auditActionItems}
          repairHints={repairHints}
          handleNavigate={handleNavigate}
          showAutoCalcNotice={showAutoCalcNotice}
          autoCalculatedNames={autoCalculatedNames}
          removeHeir={removeHeir} // 삭제 기능 연동
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
          <div className={`flex flex-col shrink-0 mt-6 print-compact relative z-10 transition-all duration-300 ${activeTab === 'tree' ? 'w-[1480px] min-w-[1480px] px-3' : 'w-[1080px] min-w-[1080px] px-6'}`}>
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
                  removeAllHeirs={removeAllHeirs}
                  addHeir={addHeir}
                  appendResolvedHeirs={appendResolvedHeirs}
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
                  calcSteps={calcSteps}
                  handleNavigate={handleNavigate}
                  removeHeir={removeHeir} // 삭제 기능 전달
                />
              )}
              {(activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary' || activeTab === 'amount') && <MetaHeader tree={tree} />}
              {activeTab === 'calc' && <CalcPanel calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} hojuBonusDiffs={hojuBonusDiffs} />}
              {activeTab === 'result' && <ResultPanel calcSteps={calcSteps} tree={tree} issues={blockingIssues} handleNavigate={handleNavigate} hojuBonusDiffs={hojuBonusDiffs} compareFinalShares={compareFinalShares} />}
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
                  calcSteps={calcSteps}
                  hojuBonusDiffs={hojuBonusDiffs}
                  compareFinalShares={compareFinalShares}
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
              <div
                className="absolute bottom-1 right-8 pointer-events-none select-none no-print opacity-60"
                style={{
                  fontFamily: '"Segoe Script", "Snell Roundhand", "Brush Script MT", cursive',
                  fontSize: '15px',
                  letterSpacing: '0.01em',
                  color: isDarkMode ? 'rgba(115,115,115,0.5)' : 'rgba(148,143,136,0.5)',
                  transform: 'rotate(-1deg)',
                }}
              >
                Designed by J.H. Lee
              </div>
            </div>
          </div>
        </div>
      </main>
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
              이미 등록된 <span className="font-bold text-[#37352f] dark:text-neutral-200">{duplicateRequest.name}</span>과(와)
              같은 이름의 인물이 <span className="font-bold text-[#37352f] dark:text-neutral-200">{duplicateRequest.parentName}</span>의 {getRelStr(duplicateRequest.relation, tree.deathDate)} 관계로 존재합니다.
            </p>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-[13px] text-blue-700 dark:text-blue-300">
              같은 사람이라면 <span className="font-bold">예</span>, 다른 동명이인이라면 <span className="font-bold">아니오</span>를 선택하세요.
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

