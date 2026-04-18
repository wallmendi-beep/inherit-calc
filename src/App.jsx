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

  // [v4.64] 데이터 핵심 상태 선언 (초기화 순서 문제 해결을 위해 최상단 이동)
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

  // [v4.64] 모든 상태 변수 선언을 최상단으로 통합하여 초기화 순서 문제 해결
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
    tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });
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
            id: pId, personId: pId, name: node.name || '(상속인)', node: node, parentNode: parentNode, 
            parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name, 
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
      return { name: tree.name || '피상속인', relation: '피상속인', deathDate: tree.deathDate };
    }
    const tab = deceasedTabs.find((t) => t.id === activeDeceasedTab);
    return { name: tab?.name || '(상속인)', relation: tab?.relation, deathDate: tab?.node?.deathDate };
  }, [tree, deceasedTabs, activeDeceasedTab]);

  const [personEditModal, setPersonEditModal] = useState(null); // null | { nodeId, foundTabId }
  const personEditModalData = useMemo(() => {
    if (!personEditModal?.nodeId || !tree) return null;

    // 사건 검토에서 연 모달은 "현재 사건 탭의 노드"를 우선 사용해야 한다.
    // 그렇지 않으면 전체 트리에서 같은 personId의 첫 노드를 집어 와서
    // 이전 사건의 제외 상태를 잘못 보여줄 수 있다.
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

  // [v4.64] 사이드바 및 레이아웃 상태
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth, setNavigatorWidth] = useState(310);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(0);

  // [v4.64] 테마 및 가이드 상태
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

  // [v4.64] 스마트 저장 팝업 제어
  useEffect(() => {
    if (!proposedTab) return;

    if (activeTab === 'input' && isDirty) {
      const confirmSave = window.confirm("수정된 내용이 있습니다. 파일로 저장하시겠습니까?\n\n[확인]을 누르면 저장 후 이동하며, [취소]를 누르면 저장 없이 이동합니다.");
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
    
    // 1. 단순 탭 이동 처리
    const specialTabs = ['summary', 'result', 'calc', 'history', 'amount'];
    if (specialTabs.includes(nodeId)) {
      setActiveTab(nodeId);
      return;
    }

    // 2. 가계도/시뮬레이션 관련 타겟 판단
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

    // 3. 목적지에 따른 탭 전환 (단일 상태 업데이트로 번쩍임 차단)
    if (isStructuralErrorNode || isTreeRequest) {
      if (activeTab !== 'tree') {
        setActiveTab('tree');
        // setSidebarOpen(false); // useEffect에서 공통 처리됨
      }
      setTreeViewMode('tree');
      setNavigationSignal({ targetId: nodeId, at: Date.now() });
    } else {
      // 일반 인물/데이터 수정 목적
      // input 탭이 아닌 경우 탭 전환 대신 편집 모달 오픈
      if (activeTab !== 'input' && nodeId !== 'root') {
          setPersonEditModal({
            nodeId,
            foundTabId,
            sourceTabId: activeDeceasedTab,
            sourceEventName:
              activeDeceasedTab === 'root'
              ? (tree.name || '피상속인')
              : (activeTabObj?.name || tree.name || '피상속인'),
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

    // 4. 스크롤 및 하이라이트 효과
    setTimeout(() => {
      const targetDomId = resolvedNodeId || nodeId;
      const element = document.querySelector(`[data-node-id="${targetDomId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Tailwind 우선순위에 밀리지 않도록 인라인 스타일로 매우 강렬한 시각적 피드백 제공
        const originalBg = element.style.backgroundColor;
        const originalBoxShadow = element.style.boxShadow;
        const originalTransform = element.style.transform;
        
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        element.style.backgroundColor = '#eff6ff'; // Tailwind blue-50 
        element.style.boxShadow = '0 0 0 3px #1d4ed8, 0 8px 25px -5px rgba(29, 78, 216, 0.5)'; // 매우 굵은 파란 링 + 그림자
        element.style.transform = 'scale(1.02)'; // 살짝 튀어나옴
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

  const handleUpdate = (id, changes, value) => {
    // [v4.64] 객체 기반 Dispatch 호출 지원 (HeirRow 등에서 사용)
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

    // 표준 필드 기반 업데이트 (InputPanel 등에서 사용)
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

      // 1. 개인 정보 업데이트 (persons 테이블)
      const personalKeys = ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'divorceDate', 'restoreDate', 'gender', 'successorStatus'];
      personalKeys.forEach(k => {
        if (updates[k] !== undefined) prev.persons[targetPersonId][k] = updates[k];
      });

      // 2. 관계 정보 업데이트 (relationships 테이블)
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
          repairHints={guideInfo?.repairHints} handleNavigate={handleNavigate}
          showAutoCalcNotice={guideInfo?.showAutoCalcNotice} autoCalculatedNames={guideInfo?.autoCalculatedNames}
          removeHeir={removeHeir}
        />
        <TopToolbar
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} tree={tree}
          setAiTargetId={setAiTargetId} setIsAiModalOpen={setIsAiModalOpen}
          undoTree={undoTree} redoTree={redoTree} canUndo={vaultState.currentIndex > 0} canRedo={vaultState.currentIndex < vaultState.history.length - 1}
          loadFile={(e) => {
            loadTreeFromJsonFile(e.target.files[0], { setTree, setActiveTab, setImportIssues, setPropertyValue, setSpecialBenefits, setContributions, setIsAmountActive });
            setIsDirty(false); // 새 파일 로드 시 수정 상태 초기화
          }}
          saveFile={() => {
            saveFactTreeToFile(tree, { propertyValue, specialBenefits, contributions, isAmountActive });
            setIsDirty(false); // 저장 완료 시 수정 상태 초기화
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
                    {id === 'input' ? '데이터 입력' : id === 'tree' ? '사건 검토' : id === 'calc' ? '계산 상세' : id === 'summary' ? '지분 요약' : '구체적 상속분'}
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
                      />
                    </div>
                  )}
                {activeTab === 'calc' && <CalcPanel calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} />}
                {activeTab === 'summary' && <SummaryPanel tree={tree} finalShares={finalShares} calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} matchIds={matchIds} currentMatchIdx={currentMatchIdx} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={summaryViewMode} setViewMode={setSummaryViewMode} />}
                {activeTab === 'amount' && <AmountPanel tree={tree} finalShares={finalShares} amountCalculations={amountCalculations} propertyValue={propertyValue} setPropertyValue={setPropertyValue} specialBenefits={specialBenefits} setSpecialBenefits={setSpecialBenefits} contributions={contributions} setContributions={setContributions} />}
              </div>
            </div>
          </div>
        </main>
      </div>
      <AiImportModal
        isOpen={isAiModalOpen}
        targetName={aiTargetId === 'root' ? (tree.name || '피상속인') : aiTargetId}
        aiInputText={aiInputText}
        setAiInputText={setAiInputText}
        onClose={() => setIsAiModalOpen(false)}
        onCopyPrompt={() => navigator.clipboard.writeText(AI_PROMPT).then(() => alert('AI 안내문이 복사되었습니다.'))}
        onPrintPrompt={() => printAiPromptDocument()}
        onSubmit={(text) => ingestAiJsonInput({ input: text, aiTargetId, tree, setTree, setActiveTab, setIsAiModalOpen, setAiInputText })}
        onTextareaAutoSubmit={(text) => ingestAiJsonInput({ input: text, aiTargetId, tree, setTree, setActiveTab, setIsAiModalOpen, setAiInputText })}
      />
      <ResetConfirmModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} onConfirm={() => {}} />
        <PersonEditModal
          isOpen={!!personEditModal}
          onClose={() => setPersonEditModal(null)}
          onOpenInInputTab={() => {
            const { foundTabId } = personEditModal || {};
            setPersonEditModal(null);
          setActiveTab('input');
          if (foundTabId) setActiveDeceasedTab(foundTabId);
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

