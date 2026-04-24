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
import PersonEditModal from './components/PersonEditModal';
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
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { QRCodeSVG } from 'qrcode.react'; // 硫붾え: v3.0 釉뚮━??異쒕젰??QR 肄붾뱶 ?앹꽦

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

  // [v4.64] ?곗씠???듭떖 ?곹깭 ?좎뼵 (珥덇린???쒖꽌 臾몄젣 ?닿껐???꾪빐 理쒖긽???대룞)
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

  // [v4.64] 紐⑤뱺 ?곹깭 蹂???좎뼵??理쒖긽?⑥쑝濡??듯빀?섏뿬 珥덇린???쒖꽌 臾몄젣 ?닿껐
  const [activeTab, setActiveTab] = useState('input'); 
  const [proposedTab, setProposedTab] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [changeLog, setChangeLog] = useState([]);
  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const [treeViewMode, setTreeViewMode] = useState('flow');
  const [summaryViewMode, setSummaryViewMode] = useState('structure'); // 'structure' | 'path'
  const [navigationSignal, setNavigationSignal] = useState(null);
  const [isFolderFocused, setIsFolderFocused] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [syncRequest, setSyncRequest] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set();
    const visitedNodes = new Set();
    tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '?쇱긽?띿씤', node: tree, parentName: null, level: 0, branchRootId: null });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      if (!node || visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);

      const hasEnteredHeirs = node.heirs && node.heirs.length > 0;
      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) || hasEnteredHeirs;
      const isSpouseNode = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
      const parentDeathDate = parentNode?.deathDate || tree.deathDate;
      const isPredeceasedSpouse = isSpouseNode && node.deathDate && parentDeathDate && isBefore(node.deathDate, parentDeathDate);
      let currentBranchRootId = branchRootId;
      const pId = node.personId;
      if (isTarget && !isPredeceasedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          tabMap.set(pId, { 
            id: pId, personId: pId, name: node.name || '(?곸냽??', node: node, parentNode: parentNode, 
            parentName: parentNode.id === 'root' ? (tree.name || '?쇱긽?띿씤') : parentNode.name, 
            parentTabId: parentNode.id === 'root' ? 'root' : parentNode.personId,
            inheritanceType: node.isDeceased ? 'deceased' : 'excluded',
            relation: node.relation, level: level, branchRootId: currentBranchRootId 
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

  useEffect(() => {
    if (!deceasedTabs.find((t) => t.id === activeDeceasedTab)) {
      setActiveDeceasedTab('root');
    }
  }, [deceasedTabs, activeDeceasedTab]);

  const activeTabObj = useMemo(
    () => deceasedTabs.find((t) => t.id === activeDeceasedTab) || null,
    [deceasedTabs, activeDeceasedTab],
  );

  const getBriefingInfo = useMemo(() => {
    if (activeDeceasedTab === 'root') {
      return { name: tree.name || '?쇱긽?띿씤', relation: '?쇱긽?띿씤', deathDate: tree.deathDate };
    }
    const tab = deceasedTabs.find((t) => t.id === activeDeceasedTab);
    return { name: tab?.name || '(?곸냽??', relation: tab?.relation, deathDate: tab?.node?.deathDate };
  }, [tree, deceasedTabs, activeDeceasedTab]);

  const [personEditModal, setPersonEditModal] = useState(null); // null | { nodeId, foundTabId }
  const personEditModalData = useMemo(() => {
    if (!personEditModal?.nodeId || !tree) return null;

    // ?ш굔 寃?좎뿉????紐⑤떖? "?꾩옱 ?ш굔 ??쓽 ?몃뱶"瑜??곗꽑 ?ъ슜?댁빞 ?쒕떎.
    // 洹몃젃吏 ?딆쑝硫??꾩껜 ?몃━?먯꽌 媛숈? personId??泥??몃뱶瑜?吏묒뼱 ???
    // ?댁쟾 ?ш굔???쒖쇅 ?곹깭瑜??섎せ 蹂댁뿬以????덈떎.
    if (personEditModal?.foundTabId) {
      const tabMatch = deceasedTabs.find((tab) => tab.id === personEditModal.foundTabId);
      if (tabMatch?.node) {
        return { node: tabMatch.node, parentNode: tabMatch.parentNode ?? null };
      }
    }

    const find = (n, parent) => {
      if (n.id === personEditModal.nodeId || n.personId === personEditModal.nodeId) {
        return { node: n, parentNode: parent };
      }
      for (const h of n.heirs || []) {
        const r = find(h, n);
        if (r) return r;
      }
      return null;
    };
    return find(tree, null);
  }, [personEditModal?.nodeId, personEditModal?.foundTabId, tree, deceasedTabs]);
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
  const [isMainQuickActive, setIsMainQuickActive] = useState(false);
  const [mainQuickVal, setMainQuickVal] = useState('');

  // [v4.64] ?ъ씠?쒕컮 諛??덉씠?꾩썐 ?곹깭
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth, setNavigatorWidth] = useState(310);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(0);

  // [v4.64] ?뚮쭏 諛?媛?대뱶 ?곹깭
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [checkedGuideKeys, setCheckedGuideKeys] = useState(new Set());
  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const [confirmedGuidesOpen, setConfirmedGuidesOpen] = useState(false);
  const [reviewContext, setReviewContext] = useState(null); // { guideKey, guideText }

  // [v4.64] ?ㅻ쭏??????앹뾽 ?쒖뼱
  useEffect(() => {
    if (!proposedTab) return;

    if (activeTab === 'input' && isDirty) {
      const confirmSave = window.confirm("?섏젙???댁슜???덉뒿?덈떎. ?뚯씪濡???ν븯?쒓쿋?듬땲源?\n\n[?뺤씤]???꾨Ⅴ硫???????대룞?섎ŉ, [痍⑥냼]瑜??꾨Ⅴ硫?????놁씠 ?대룞?⑸땲??");
      if (confirmSave) {
        saveFactTreeToFile(tree, { propertyValue, specialBenefits, contributions, isAmountActive });
        setIsDirty(false);
      } else {
        setIsDirty(false); 
      }
    }

    setActiveTab(proposedTab);
    setProposedTab(null);
  }, [proposedTab, activeTab, isDirty, tree, propertyValue, specialBenefits, contributions, isAmountActive]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    setProposedTab(tabId);
  };

  const appendChangeLog = (entry) => {
    setIsDirty(true);
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

  useEffect(() => {
    if (activeTab !== 'input') return undefined;
    if (!importIssues) return undefined;

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
        // ignore
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [changeLog, tree.caseNo, tree.name]);

  const undoTree = () => setVaultState(prev => prev.currentIndex > 0 ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev);
  const redoTree = () => setVaultState(prev => prev.currentIndex < prev.history.length - 1 ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev);

  const handleKeyDown = (e) => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!navKeys.includes(e.key)) return;
    if (isResetModalOpen) return;
    const all = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
    const i = all.indexOf(e.target);
    if (i === -1) return;
    if (e.key === 'Tab') { if (e.shiftKey) { e.preventDefault(); if (i > 0) all[i-1].focus(); } else { e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) all[i-1].focus(); } 
  };

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [showNavigator, setShowNavigator] = useState(true);

  const handleNavigate = (nodeId) => {
    if (!nodeId) return;
    
    // 1. ?⑥닚 ???대룞 泥섎━
    const specialTabs = ['summary', 'result', 'calc', 'history', 'amount'];
    if (specialTabs.includes(nodeId)) {
      setActiveTab(nodeId);
      return;
    }

    // 2. 媛怨꾨룄/?쒕??덉씠??愿???寃??먮떒
    const isStructuralErrorNode = typeof nodeId === 'string' && nodeId.includes('struct-err');
    const isTreeRequest = nodeId === 'tree';

    let resolvedNodeId = null;
    const findTabIdForNode = (currentNode, currentTabId, visited = new Set()) => {
      if (!currentNode || visited.has(currentNode.id)) return null;
      visited.add(currentNode.id);
      if (currentNode.id === nodeId || currentNode.personId === nodeId) { resolvedNodeId = currentNode.id; return currentTabId; }
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          const hasEnteredHeirs = h.heirs && h.heirs.length > 0;
          const isTabOwner = h.isDeceased || (h.isExcluded && ['lost', 'disqualified'].includes(h.exclusionOption)) || hasEnteredHeirs;
          const nextTabId = isTabOwner ? h.personId : currentTabId;
          const found = findTabIdForNode(h, nextTabId, visited);
          if (found) return found;
        }
      }
      return null;
    };

    const foundTabId = findTabIdForNode(tree, 'root');

    // 3. 紐⑹쟻吏???곕Ⅸ ???꾪솚 (?⑥씪 ?곹깭 ?낅뜲?댄듃濡?踰덉찉??李⑤떒)
    if (isStructuralErrorNode || isTreeRequest) {
      if (activeTab !== 'tree') {
        setActiveTab('tree');
        // setSidebarOpen(false); // useEffect?먯꽌 怨듯넻 泥섎━??
      }
      setTreeViewMode('tree');
      setNavigationSignal({ targetId: nodeId, at: Date.now() });
    } else {
      // ?쇰컲 ?몃Ъ/?곗씠???섏젙 紐⑹쟻
      // input ??씠 ?꾨땶 寃쎌슦 ???꾪솚 ????몄쭛 紐⑤떖 ?ㅽ뵂
      if (activeTab !== 'input' && nodeId !== 'root') {
          setPersonEditModal({
            nodeId,
            foundTabId,
            sourceTabId: activeDeceasedTab,
            sourceEventName:
              activeDeceasedTab === 'root'
              ? (tree.name || '?쇱긽?띿씤')
              : (activeTabObj?.name || tree.name || '?쇱긽?띿씤'),
          sourceEventDate:
            activeDeceasedTab === 'root'
              ? tree.deathDate
              : (activeTabObj?.node?.deathDate || tree.deathDate),
        });
        return;
      }
      if (activeTab !== 'input') {
        setActiveTab('input');
      }
      if (foundTabId) {
        setActiveDeceasedTab(foundTabId);
      }
    }

    // 4. ?ㅽ겕濡?諛??섏씠?쇱씠???④낵
    setTimeout(() => {
      const targetDomId = resolvedNodeId || nodeId;
      const element = document.querySelector(`[data-node-id="${targetDomId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Tailwind ?곗꽑?쒖쐞??諛由ъ? ?딅룄濡??몃씪???ㅽ??쇰줈 留ㅼ슦 媛뺣젹???쒓컖???쇰뱶諛??쒓났
        const originalBg = element.style.backgroundColor;
        const originalBoxShadow = element.style.boxShadow;
        const originalTransform = element.style.transform;
        
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        element.style.backgroundColor = '#eff6ff'; // Tailwind blue-50 
        element.style.boxShadow = '0 0 0 3px #1d4ed8, 0 8px 25px -5px rgba(29, 78, 216, 0.5)'; // 留ㅼ슦 援듭? ?뚮? 留?+ 洹몃┝??
        element.style.transform = 'scale(1.02)'; // ?댁쭩 ??대굹??
        element.style.zIndex = '50';
        
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
          element.style.boxShadow = originalBoxShadow;
          element.style.transform = originalTransform;
          element.style.zIndex = '';
        }, 1800);
      }
    }, 150);
  };

  const handleSidebarPrevMatch = () => {
    if (sidebarMatchIds.length === 0) return;
    setSidebarCurrentMatchIdx((prev) => (prev - 1 + sidebarMatchIds.length) % sidebarMatchIds.length);
  };
  const handleSidebarNextMatch = () => {
    if (sidebarMatchIds.length === 0) return;
    setSidebarCurrentMatchIdx((prev) => (prev + 1) % sidebarMatchIds.length);
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const handleMouseMove = (moveE) => {
      const deltaX = moveE.clientX - startX;
      setSidebarWidth(Math.max(180, Math.min(600, startWidth + deltaX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const { finalShares, calcSteps, warnings, transitShares, blockingIssues, compareFinalShares, hojuBonusDiffs } = useMemo(() => {
    const preprocessTree = (n, parentDate, parentNode, visited = new Set()) => {
      const pId = n.personId || n.id;
      if (visited.has(pId)) return { ...n, heirs: [], _cycle: true };
      const clone = { ...n }; 
      const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      const newVisited = new Set(visited);
      newVisited.add(pId);
      if (clone.id !== 'root') {
        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate); 
        const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
        const hasHeirsInModel = clone.heirs && clone.heirs.length > 0;
        if (hasHeirsInModel && !(isPre && isSpouseType)) { clone.isExcluded = false; clone.exclusionOption = ''; }
        if (isPre && isSpouseType) { clone.isExcluded = true; clone.exclusionOption = 'predeceased'; }
      }
      if (clone.heirs) { clone.heirs = clone.heirs.map(h => preprocessTree(h, clone.deathDate || refDate, clone, newVisited)); }
      return clone;
    };
    const calcTree = preprocessTree(tree, tree.deathDate, null);
    const shouldBuildCalcSteps = ['tree', 'calc', 'summary', 'amount'].includes(activeTab);
    const result = calculateInheritance(calcTree, propertyValue, { includeCalcSteps: shouldBuildCalcSteps });
    const shouldBuildCompare = ['calc', 'summary'].includes(activeTab);
    const compareTree = shouldBuildCompare ? stripHojuBonusInputs(calcTree) : null;
    const compareResult = shouldBuildCompare ? calculateInheritance(compareTree, propertyValue, { includeCalcSteps: false }) : null;
    return {
      ...result,
      compareFinalShares: compareResult?.finalShares || {},
      hojuBonusDiffs: shouldBuildCompare ? buildHojuBonusDiffs(result.finalShares || {}, compareResult?.finalShares || {}) : [],
    };
  }, [tree, propertyValue, activeTab]);

  const amountCalculations = useMemo(() => {
    const list = []; if (finalShares?.direct) list.push(...finalShares.direct);
    if (finalShares?.subGroups) { const scan = (group) => { list.push(...group.shares); if (group.subGroups) group.subGroups.forEach(scan); }; finalShares.subGroups.forEach(scan); }
    const estateVal = parseInt(String(propertyValue).replace(/[^0-9]/g, ''), 10) || 0;
    let totalSpecial = 0; let totalContrib = 0;
    list.forEach(share => { totalSpecial += parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; totalContrib += parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; });
    const deemedEstate = estateVal + totalSpecial - totalContrib;
    const results = list.map(share => {
      const sVal = parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0; const cVal = parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const statutoryAmount = Math.floor(deemedEstate * (share.n / share.d));
      const finalAmount = Math.max(0, statutoryAmount - sVal) + cVal;
      return { ...share, statutoryAmount, specialBenefit: sVal, contribution: cVal, finalAmount };
    });
    const totalDistributed = results.reduce((acc, r) => acc + (r.finalAmount || 0), 0);
    const remainder = Math.max(0, estateVal - totalDistributed);
    return { estateVal, deemedEstate, results, totalDistributed, remainder };
  }, [finalShares, propertyValue, specialBenefits, contributions]);

  const toggleGuideChecked = (key) => {
    setCheckedGuideKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const handleGuideNavigate = (guide) => {
    if (!guide) return;
    const targetId = guide.targetNodeId || guide.targetTabId || guide.personId || guide.id;
    if (!targetId) return;
    
    // ?寃??몃뱶媛 諛곗뿴濡?議댁옱?섎뒗 紐⑤뱺 媛?대뱶??????섏씠?쇱씠??湲곕뒫??踰붿슜?곸쑝濡??곸슜
    const hasTargetNodes = Array.isArray(guide.targetNodeIds) && guide.targetNodeIds.length > 0;
    const navigationMode = guide.navigationMode || 'auto';

    setPersonEditModal(null);

    if (hasTargetNodes) {
      if (activeTab !== 'input') setActiveTab('input');
      if (guide.targetTabId && guide.targetTabId !== activeDeceasedTab) {
        setActiveDeceasedTab(guide.targetTabId);
      }
      
      // InputPanel??isHighlighted ?섏씠?쇱씠?몃? ?쒖꽦?뷀븯湲??꾪빐 reviewContext ?ㅼ젙
      // ?곹깭 ?낅뜲?댄듃 諛곗묶(Batching)?쇰줈 ?명빐 ???대룞怨?而⑦뀓?ㅽ듃 ?ㅼ젙???숈떆???덉쟾?섍쾶 ?곸슜?⑸땲??
      setReviewContext({
        guideKey: guide.uniqueKey,
        guideText: guide.text,
        targetNodeIds: guide.targetNodeIds || [],
      });
      
      const nodeIds = (guide.targetNodeIds || []).filter(Boolean);
      
      // ?뚮뜑留곸씠 ?꾩쟾???앸궃 ??DOM???뺤떎?섍쾶 ?묎렐?섍린 ?꾪빐 ?쎄컙???ъ쑀(400ms)瑜??〓땲??
      setTimeout(() => {
        let firstScrolled = false;
        nodeIds.forEach((id) => {
          try {
            const el = document.querySelector(`[data-node-id="${id}"]`);
            if (!el) return;
            
            if (!firstScrolled) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              firstScrolled = true;
            }
            
            // ?몃씪???ㅽ??쇰줈 ?뺤떎???쒓컖???쇰뱶諛??쒓났
            const origBg = el.style.backgroundColor;
            const origShadow = el.style.boxShadow;
            const origTransform = el.style.transform;
            const origZIndex = el.style.zIndex;
            const origTransition = el.style.transition;
            
            el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.backgroundColor = '#eff6ff';
            el.style.boxShadow = '0 0 0 3px #1d4ed8, 0 8px 25px -5px rgba(29, 78, 216, 0.5)';
            el.style.transform = 'scale(1.02)';
            el.style.zIndex = '50';
            
            // ?좊땲硫붿씠???먮났
            setTimeout(() => {
              try {
                if (el) {
                  el.style.backgroundColor = origBg;
                  el.style.boxShadow = origShadow;
                  el.style.transform = origTransform;
                  el.style.zIndex = origZIndex;
                  el.style.transition = origTransition;
                }
              } catch (e) {
                // DOM ?붿냼媛 ?몃쭏?댄듃??寃쎌슦 議곗슜??臾댁떆
              }
            }, 2500);
          } catch (error) {
            console.error('Highlight DOM Error:', error);
          }
        });
        
        // ?좊땲硫붿씠?섏씠 ?꾩쟾??醫낅즺?????섏씠?쇱씠???곹깭(?뚮? ?뚮몢由???瑜??먮났?섍린 ?꾪빐 Context 珥덇린??
        setTimeout(() => {
          setReviewContext(null);
        }, 2600);
      }, 400);
      return;
    }

    if (activeTab === 'input') {
      handleNavigate(targetId);
      return;
    }

    if (navigationMode === 'event') {
      if (activeTab !== 'tree') {
        setActiveTab('tree');
      }
      setTreeViewMode('flow');
      setNavigationSignal({ targetId, at: Date.now(), source: 'guide-event' });
      setReviewContext({ guideKey: guide.uniqueKey, guideText: guide.text });
      return;
    }

    handleNavigate(targetId);
  };
  const dismissGuide = (key) => {
    setHiddenGuideKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings, transitShares, importIssues);
  const smartGuides = useMemo(() => {
    const uniqueMap = new Map();
    (guideInfo?.smartGuides || []).forEach(g => {
      const key = `${g.type}:${g.text}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...g, uniqueKey: key });
      }
    });
    return Array.from(uniqueMap.values());
  }, [guideInfo?.smartGuides]);

  const confirmedGuides = useMemo(() => {
    return smartGuides.filter(g => checkedGuideKeys.has(g.uniqueKey));
  }, [smartGuides, checkedGuideKeys]);

  const removeHeir = (id) => {
    appendChangeLog({ type: 'removeHeir', nodeId: id });
    let targetPersonId = id; let parentPersonId = null;
    const findNode = (n, pId) => { if (n.id === id) { targetPersonId = n.personId; parentPersonId = pId; return true; } return (n.heirs || []).some(child => findNode(child, n.personId)); }; findNode(tree, null);
    if (!parentPersonId) return;
    setVault(prev => { if (prev.relationships[parentPersonId]) prev.relationships[parentPersonId] = prev.relationships[parentPersonId].filter(l => l.targetId !== targetPersonId); return prev; });
  };

  const removeAllHeirs = (parentId) => {
    appendChangeLog({ type: 'removeAllHeirs', parentId });
    setVault(prev => {
      let targetPersonId = parentId;
      const findNode = (n) => { if (n.id === parentId) { targetPersonId = n.personId; return true; } return (n.heirs || []).some(findNode); }; findNode(tree);
      if (prev.relationships[targetPersonId]) prev.relationships[targetPersonId] = [];
      return prev;
    });
  };

  const resetAllState = () => {
    setTree({ id: 'root', name: '', gender: 'male', deathDate: '', caseNo: '', isHoju: true, shareN: 1, shareD: 1, heirs: [] });
    setActiveTab('input');
    setActiveDeceasedTab('root');
    setPropertyValue('');
    setSpecialBenefits({});
    setContributions({});
    setIsAmountActive(false);
    setImportIssues([]);
    setCheckedGuideKeys(new Set());
    setHiddenGuideKeys(new Set());
    setConfirmedGuidesOpen(false);
    setReviewContext(null);
    setSearchQuery('');
    setMatchIds([]);
    setCurrentMatchIdx(0);
    setSidebarSearchQuery('');
    setSidebarMatchIds([]);
    setSidebarCurrentMatchIdx(0);
    setIsDirty(false);
    setIsResetModalOpen(false);
  };

  const handleUpdate = (id, changes, value) => {
    // [v4.64] 媛앹껜 湲곕컲 Dispatch ?몄텧 吏??(HeirRow ?깆뿉???ъ슜)
    if (typeof id === 'object' && id.type) {
      const action = id;
      setIsDirty(true);
      if (action.type === 'updateDeathInfo') {
        setTree(prev => updateDeathInfo(prev, action.nodeId, action));
      } else if (action.type === 'updateHistoryInfo') {
        setTree(prev => updateHistoryInfo(prev, action.nodeId, action.changes));
      } else if (action.type === 'updateRelationInfo') {
        setTree(prev => updateRelationInfo(prev, action.nodeId, action.relation));
      } else if (action.type === 'setHojuStatus') {
        setTree(prev => setHojuStatus(prev, action.nodeId, action.isHoju));
      } else if (action.type === 'setPrimaryHojuSuccessor') {
        setTree(prev => setPrimaryHojuSuccessor(prev, action.parentNodeId, action.nodeId, action.isSelected));
      } else if (action.type === 'applyNodeUpdates') {
        setTree(prev => applyNodeUpdates(prev, action.nodeId, action.updates));
      }
      return;
    }

    // ?쒖? ?꾨뱶 湲곕컲 ?낅뜲?댄듃 (InputPanel ?깆뿉???ъ슜)
    const updates = typeof changes === 'object' ? changes : { [changes]: value };
    setIsDirty(true);
    setVault(prev => {
      let targetPersonId = null;
      let parentPersonId = null;
      
      const findInfo = (n, pId) => {
        if (n.id === id) {
          targetPersonId = n.personId;
          parentPersonId = pId;
          return true;
        }
        return (n.heirs || []).some(child => findInfo(child, n.personId));
      };
      findInfo(tree, null);

      if (!targetPersonId || !prev.persons[targetPersonId]) return prev;

      // 1. 媛쒖씤 ?뺣낫 ?낅뜲?댄듃 (persons ?뚯씠釉?
      const personalKeys = ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender', 'successorStatus'];
      personalKeys.forEach(k => {
        if (updates[k] !== undefined) prev.persons[targetPersonId][k] = updates[k];
      });

      // 2. 愿怨??뺣낫 ?낅뜲?댄듃 (relationships ?뚯씠釉?
      const relationshipKeys = ['relation', 'isExcluded', 'exclusionOption', 'isHoju', 'isPrimaryHojuSuccessor', 'isSameRegister'];
      if (parentPersonId && prev.relationships[parentPersonId]) {
        const link = prev.relationships[parentPersonId].find(l => l.targetId === targetPersonId);
        if (link) {
          relationshipKeys.forEach(k => {
            if (updates[k] !== undefined) link[k] = updates[k];
          });
        }
      }
      return prev;
    });
  };

  const handleRootUpdate = (key, val) => {
    setIsDirty(true);
    setVault(prev => {
      prev.persons['root'][key] = val;
      return prev;
    });
  };

  const handleQuickSubmit = (targetTabId, currentNode, val) => {
    if (!val.trim()) return;
    const names = val.split(',').map(n => n.trim()).filter(n => n);
    if (names.length === 0) return;
    setTree(prev => appendQuickHeirs(prev, targetTabId === 'root' ? 'root' : currentNode.id, names));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTree(prev => {
        const findAndMove = (node) => {
          if (node.heirs && node.heirs.some(h => h.id === active.id)) {
            const oldIdx = node.heirs.findIndex(h => h.id === active.id);
            const newIdx = node.heirs.findIndex(h => h.id === over.id);
            node.heirs = arrayMove(node.heirs, oldIdx, newIdx);
            return true;
          }
          return (node.heirs || []).some(findAndMove);
        };
        findAndMove(prev);
        return prev;
      });
    }
  };

  const appendResolvedHeirs = (parentId, heirsToAdd) => {
    setTree(prev => {
      const findAndAdd = (node) => {
        if (node.id === parentId) {
          node.heirs = [...(node.heirs || []), ...heirsToAdd];
          return true;
        }
        return (node.heirs || []).some(findAndAdd);
      };
      findAndAdd(prev);
      return prev;
    });
  };

  return (
    <>
      <PrintReport tree={tree} activeTab={activeTab} activeDeceasedTab={activeDeceasedTab} finalShares={finalShares} calcSteps={calcSteps} amountCalculations={amountCalculations} propertyValue={propertyValue} summaryViewMode={summaryViewMode} />
      <div className="w-full min-h-screen relative flex flex-col items-start pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900 min-w-[1280px] print:hidden">
        <SmartGuidePanel
          showNavigator={showNavigator} setShowNavigator={setShowNavigator} navigatorWidth={navigatorWidth}
          activeTab={activeTab} tree={tree} smartGuides={smartGuides}
          hasActionItems={guideInfo?.hasActionItems} noSurvivors={guideInfo?.noSurvivors}
          warnings={warnings} hiddenGuideKeys={hiddenGuideKeys} dismissGuide={dismissGuide}
          checkedGuideKeys={checkedGuideKeys} toggleGuideChecked={toggleGuideChecked}
          confirmedGuides={confirmedGuides} confirmedGuidesOpen={confirmedGuidesOpen}
          setConfirmedGuidesOpen={setConfirmedGuidesOpen} showGlobalWarning={guideInfo?.showGlobalWarning}
          globalMismatchReasons={guideInfo?.globalMismatchReasons} auditActionItems={guideInfo?.auditActionItems}
          repairHints={guideInfo?.repairHints} handleNavigate={handleNavigate} handleGuideNavigate={handleGuideNavigate}
          showAutoCalcNotice={guideInfo?.showAutoCalcNotice} autoCalculatedNames={guideInfo?.autoCalculatedNames}
          removeHeir={removeHeir}
        />
        <TopToolbar
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} tree={tree}
          setAiTargetId={setAiTargetId} setIsAiModalOpen={setIsAiModalOpen}
          setShowNavigator={setShowNavigator}
          hasActionItems={guideInfo?.hasActionItems}
          undoTree={undoTree} redoTree={redoTree} canUndo={vaultState.currentIndex > 0} canRedo={vaultState.currentIndex < vaultState.history.length - 1}
          setIsResetModalOpen={setIsResetModalOpen}
          loadFile={(e) => {
            loadTreeFromJsonFile(e.target.files[0], { setTree, setActiveTab, setImportIssues, setPropertyValue, setSpecialBenefits, setContributions, setIsAmountActive });
            setIsDirty(false);
          }}
          saveFile={() => {
            saveFactTreeToFile(tree, { propertyValue, specialBenefits, contributions, isAmountActive });
            setIsDirty(false);
          }}
          handleExcelExport={() => {
            const collectedShares = [];
            if (finalShares?.direct) collectedShares.push(...finalShares.direct);
            if (finalShares?.subGroups) {
              const walkGroups = (group) => {
                collectedShares.push(...(group.shares || []));
                (group.subGroups || []).forEach(walkGroups);
              };
              finalShares.subGroups.forEach(walkGroups);
            }

            const survivorMap = new Map();
            collectedShares.forEach((share) => {
              const personKey = share.personId || share.id || share.name;
              if (!personKey || share.n <= 0) return;
              if (!survivorMap.has(personKey)) {
                survivorMap.set(personKey, { ...share });
                return;
              }
              const current = survivorMap.get(personKey);
              const [nextN, nextD] = math.add(current.n, current.d, share.n, share.d);
              survivorMap.set(personKey, {
                ...current,
                n: nextN,
                d: nextD,
              });
            });

            const survivors = Array.from(survivorMap.values()).filter((share) => !share.isDeceased && share.n > 0);
            const commonDenominator = survivors.reduce((acc, s) => math.lcm(acc || 1, s.d || 1), 1) || 1;
            const rows = survivors.map((s) => {
              const simplifiedN = s.n || 0;
              const simplifiedD = s.d || 1;
              const commonN = simplifiedN * (commonDenominator / simplifiedD);
              return [
                s.name || '',
                getRelStr(s._origRelation || s.relation, tree.deathDate) || s._origRelation || s.relation || '',
                simplifiedN,
                simplifiedD,
                commonN,
                commonDenominator,
                s.path || '',
              ];
            });
            const header = ['성명', '관계', '통분전 분자', '통분전 분모', '통분후 분자', '통분후 분모', '취득경로'];
            const excelText = [header, ...rows]
              .map((r) => r.map((c) => String(c).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'))
              .join('\r\n');
            const excelTextWithBom = '\uFEFF' + excelText;
            const bytes = new Uint8Array(excelTextWithBom.length * 2);
            for (let i = 0; i < excelTextWithBom.length; i += 1) {
              const code = excelTextWithBom.charCodeAt(i);
              bytes[i * 2] = code & 0xff;
              bytes[i * 2 + 1] = code >> 8;
            }
            const blob = new Blob([bytes], { type: 'text/csv;charset=utf-16le;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^\w\uAC00-\uD7A3-]/g, '');
            const safeName = (tree.name || '피상속인없음').replace(/[^\w\uAC00-\uD7A3-]/g, '');
            a.href = url;
            a.download = `${safeCaseNo}_${safeName}_상속지분요약_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          handlePrint={() => printCurrentTab({ activeTab, tree, summaryViewMode })}
          zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        />
        <SidebarTreePanel
          sidebarOpen={sidebarOpen} sidebarWidth={sidebarWidth} tree={tree} handleNavigate={handleNavigate}
          sidebarSearchQuery={sidebarSearchQuery} setSidebarSearchQuery={setSidebarSearchQuery}
          sidebarMatchIds={sidebarMatchIds} sidebarCurrentMatchIdx={sidebarCurrentMatchIdx}
          handleSidebarPrevMatch={handleSidebarPrevMatch} handleSidebarNextMatch={handleSidebarNextMatch}
          sidebarToggleSignal={sidebarToggleSignal} setSidebarToggleSignal={setSidebarToggleSignal}
          handleResizeMouseDown={handleResizeMouseDown}
          removeHeir={removeHeir}
        />
        <main className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`} style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 10) : 0, paddingRight: showNavigator ? (navigatorWidth + 10) : 0 }}>
          <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: (sidebarOpen || showNavigator) ? 'flex-start' : 'center' }}>
            <div
                className={`flex flex-col shrink-0 mt-6 print-compact relative z-10 transition-all duration-300 ${
                activeTab === 'tree' ? 'w-full px-2' : 'w-[1080px] min-w-[1080px] px-6'
                }`}
            >
              <div className="flex items-end pl-[48px] gap-1 no-print relative z-20">
                {['input', 'tree', 'calc', 'summary', 'amount'].map(id => (
                  <button key={id} onClick={() => handleTabChange(id)} className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] border-2 border-b-0 transition-all ${activeTab === id ? 'bg-white dark:bg-neutral-800 border-[#37352f] text-[#37352f]' : 'bg-transparent border-transparent text-[#9b9a97]'}`}>
                    {id === 'input'
                      ? '기본 입력'
                      : id === 'tree'
                        ? '사건 검토'
                        : id === 'calc'
                          ? '계산 상세'
                          : id === 'summary'
                            ? '지분 요약'
                            : '구체적 상속분'}
                  </button>
                ))}
              </div>
              <div className={`border border-[#e9e9e7] dark:border-neutral-700 rounded-xl shadow-sm min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col relative z-0 ${activeTab === 'tree' ? 'p-5' : 'p-10'}`}>
                {activeTab === 'input' && (
                  <InputPanel
                    tree={tree} activeDeceasedTab={activeDeceasedTab} activeTabObj={activeTabObj} getBriefingInfo={getBriefingInfo}
                    finalShares={finalShares} issues={blockingIssues} handleUpdate={handleUpdate} removeHeir={removeHeir}
                    removeAllHeirs={removeAllHeirs} addHeir={() => {}} appendResolvedHeirs={appendResolvedHeirs}
                    handleKeyDown={handleKeyDown} handleRootUpdate={handleRootUpdate} handleDragEnd={handleDragEnd}
                    sensors={sensors} setAiTargetId={setAiTargetId} setIsAiModalOpen={setIsAiModalOpen}
                    isMainQuickActive={isMainQuickActive} setIsMainQuickActive={setIsMainQuickActive}
                    mainQuickVal={mainQuickVal} setMainQuickVal={setMainQuickVal}
                    handleQuickSubmit={handleQuickSubmit} setActiveDeceasedTab={setActiveDeceasedTab}
                    reviewContext={reviewContext}
                  />
                )}
                  {activeTab === 'tree' && (
                    <div className="flex-1 min-h-0">
                      <TreePanel 
                        tree={tree} 
                        treeToggleSignal={treeToggleSignal} 
                        isAllExpanded={isAllExpanded}
                        setTreeToggleSignal={setTreeToggleSignal}
                        setIsAllExpanded={setIsAllExpanded}
                        calcSteps={calcSteps} 
                        handleNavigate={handleNavigate} 
                        removeHeir={removeHeir}
                        viewMode={treeViewMode}
                        setViewMode={setTreeViewMode}
                        navigationSignal={navigationSignal}
                        reviewContext={reviewContext}
                        onCompleteReview={() => {
                          if (reviewContext) {
                            toggleGuideChecked(reviewContext.guideKey);
                            setReviewContext(null);
                          }
                        }}
                        onOpenInInput={(targetId) => {
                          setReviewContext(null);
                          setActiveTab('input');
                          if (targetId) setActiveDeceasedTab(targetId);
                        }}
                      />
                    </div>
                  )}
                {activeTab === 'calc' && (
                  <CalcPanel
                    calcSteps={calcSteps}
                    issues={blockingIssues}
                    handleNavigate={handleNavigate}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                  />
                )}
                {activeTab === 'summary' && <SummaryPanel tree={tree} finalShares={finalShares} calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} matchIds={matchIds} currentMatchIdx={currentMatchIdx} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={summaryViewMode} setViewMode={setSummaryViewMode} />}
                {activeTab === 'amount' && <AmountPanel tree={tree} finalShares={finalShares} amountCalculations={amountCalculations} propertyValue={propertyValue} setPropertyValue={setPropertyValue} specialBenefits={specialBenefits} setSpecialBenefits={setSpecialBenefits} contributions={contributions} setContributions={setContributions} />}
              </div>
            </div>
          </div>
        </main>
      </div>
      <AiImportModal
        isOpen={isAiModalOpen}
        targetName={aiTargetId === 'root' ? (tree.name || '?쇱긽?띿씤') : aiTargetId}
        aiInputText={aiInputText}
        setAiInputText={setAiInputText}
        onClose={() => setIsAiModalOpen(false)}
        onCopyPrompt={() => navigator.clipboard.writeText(AI_PROMPT).then(() => alert('AI ?덈궡臾몄씠 蹂듭궗?섏뿀?듬땲??'))}
        onPrintPrompt={() => printAiPromptDocument()}
        onSubmit={(text) => ingestAiJsonInput({ input: text, aiTargetId, tree, setTree, setActiveTab, setIsAiModalOpen, setAiInputText })}
        onTextareaAutoSubmit={(text) => ingestAiJsonInput({ input: text, aiTargetId, tree, setTree, setActiveTab, setIsAiModalOpen, setAiInputText })}
      />
      <ResetConfirmModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSaveAndReset={() => {
            saveFactTreeToFile(tree, { propertyValue, specialBenefits, contributions, isAmountActive });
            resetAllState();
          }}
          onResetOnly={() => {
            resetAllState();
          }}
        />
        <PersonEditModal
          isOpen={!!personEditModal}
          onClose={() => setPersonEditModal(null)}
          onOpenInInputTab={() => {
            const { foundTabId } = personEditModal || {};
            setPersonEditModal(null);
          setActiveTab('input');
          if (foundTabId) setActiveDeceasedTab(foundTabId);
          }}
          onOpenInTreeTab={(personId) => {
            setPersonEditModal(null);
            setActiveTab('tree');
            setTreeViewMode('flow');
            setNavigationSignal({ targetId: personId, at: Date.now(), source: 'guide-event' });
          }}
          node={personEditModalData?.node ?? null}
          parentNode={personEditModalData?.parentNode ?? null}
          inheritedDate={
            personEditModal?.sourceEventDate ||
            personEditModalData?.parentNode?.deathDate ||
            tree.deathDate
          }
          rootDeathDate={tree.deathDate}
          rootIsHoju={tree.isHoju !== false}
          sourceEventName={personEditModal?.sourceEventName || ''}
          sourceEventDate={personEditModal?.sourceEventDate || ''}
          handleUpdate={handleUpdate}
        />
    </>
  );
}

export default App;

