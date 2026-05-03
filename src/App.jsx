import React, { useState, useEffect, useMemo } from 'react';
import {
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen,
  IconPrinter, IconNetwork, IconTable, IconList,
  IconReset, IconFileText, IconXCircle, IconX, IconChevronRight,
  IconSun, IconMoon, IconUndo, IconRedo, IconUserGroup, IconTrash2, IconSparkles
} from './components/Icons';
import PrintReport from './components/PrintReport';
import SummaryPanel from './components/SummaryPanel';
import AmountPanel from './components/AmountPanel';
import AcquisitionPanel from './components/AcquisitionPanel';
import InputPanel from './components/InputPanel';
import TreePanel from './components/TreePanel';
import AiImportModal from './components/AiImportModal';
import ResetConfirmModal from './components/ResetConfirmModal';
import PersonEditModal from './components/PersonEditModal';
import SmartGuidePanel from './components/SmartGuidePanel';
import SidebarTreePanel from './components/SidebarTreePanel';
import TopToolbar from './components/TopToolbar';
import { math, getRelStr } from './engine/utils';
import { AI_PROMPT } from './utils/aiPromptUtf8';
import { updateDeathInfo, updateHistoryInfo, updateRelationInfo, setHojuStatus, setPrimaryHojuSuccessor, applyNodeUpdates, appendQuickHeirs } from './utils/treeDomain';
import { collectImportValidationIssues } from './utils/importValidationV2';
import { ingestAiJsonInput, loadTreeFromJsonFile, printAiPromptDocument, printCurrentTab, saveFactTreeToFile } from './utils/appActions';
import { useSmartGuide } from './hooks/useSmartGuide';
import { useVaultState } from './hooks/useVaultState';
import { useDeceasedTabs } from './hooks/useDeceasedTabs';
import { useCalcResult } from './hooks/useCalcResult';
import { useAmountCalc } from './hooks/useAmountCalc';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const CHANGELOG_LIMIT = 300;
const CHANGELOG_STORAGE_KEY = 'inheritance-calc-action-log-v1';
const SIDEBAR_MIN_WIDTH = 250;
const SIDEBAR_MAX_WIDTH = 600;

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

function App() {

  const { tree, setTree, setVault, undoTree, redoTree, canUndo, canRedo } = useVaultState();

  const [activeTab, setActiveTab] = useState('input');
  const [proposedTab, setProposedTab] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [changeLog, setChangeLog] = useState([]);
  const [treeViewMode, setTreeViewMode] = useState('flow');
  const [acquisitionViewMode, setAcquisitionViewMode] = useState('card');
  const [navigationSignal, setNavigationSignal] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const { deceasedTabs, activeDeceasedTab, setActiveDeceasedTab, activeTabObj, getBriefingInfo } = useDeceasedTabs(tree);

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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [navigatorWidth] = useState(310);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(0);

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

  useEffect(() => {
    setSidebarOpen(activeTab !== 'tree');
  }, [activeTab]);

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
      } catch {
        // ignore
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [changeLog, tree.caseNo, tree.name]);

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
    const specialTabs = ['input', 'tree', 'acquisition', 'summary'];
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
      setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, startWidth + deltaX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const { finalShares, calcSteps, warnings, transitShares, blockingIssues } = useCalcResult(tree, propertyValue, activeTab);

  const amountCalculations = useAmountCalc(finalShares, propertyValue, specialBenefits, contributions);

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
    
    // 타겟 노드가 배열로 존재하는 모든 가이드에 대해 하이라이트 기능을 범용적으로 적용
    const hasTargetNodes = Array.isArray(guide.targetNodeIds) && guide.targetNodeIds.length > 0;
    const navigationMode = guide.navigationMode || 'auto';

    setPersonEditModal(null);

    if (navigationMode === 'input') {
      if (activeTab !== 'input') setActiveTab('input');
      if (guide.targetTabId && guide.targetTabId !== activeDeceasedTab) {
        setActiveDeceasedTab(guide.targetTabId);
      }
      setReviewContext({
        guideKey: guide.uniqueKey,
        guideText: guide.text,
        targetNodeIds: guide.targetNodeIds || [guide.targetNodeId].filter(Boolean),
      });
      setTimeout(() => {
        const nodeIds = (guide.targetNodeIds || [guide.targetNodeId]).filter(Boolean);
        for (const id of nodeIds) {
          const el = document.querySelector(`[data-node-id="${id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, 400);
      return;
    }

    if (hasTargetNodes) {
      if (activeTab !== 'input') setActiveTab('input');
      if (guide.targetTabId && guide.targetTabId !== activeDeceasedTab) {
        setActiveDeceasedTab(guide.targetTabId);
      }
      
      // InputPanel의 isHighlighted 하이라이트를 활성화하기 위해 reviewContext 설정
      // 상태 업데이트 배칭(Batching)으로 인해 탭 이동과 컨텍스트 설정이 동시에 안전하게 적용됩니다.
      setReviewContext({
        guideKey: guide.uniqueKey,
        guideText: guide.text,
        targetNodeIds: guide.targetNodeIds || [],
      });
      
      const nodeIds = (guide.targetNodeIds || []).filter(Boolean);
      
      // 렌더링이 완전히 끝난 후 DOM에 확실하게 접근하기 위해 약간의 여유(400ms)를 둡니다.
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
            
            // 인라인 스타일로 확실한 시각적 피드백 제공
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
            
            // 애니메이션 원복
            setTimeout(() => {
              try {
                if (el) {
                  el.style.backgroundColor = origBg;
                  el.style.boxShadow = origShadow;
                  el.style.transform = origTransform;
                  el.style.zIndex = origZIndex;
                  el.style.transition = origTransition;
                }
              } catch {
                // DOM 요소가 언마운트된 경우 조용히 무시
              }
            }, 2500);
          } catch (error) {
            console.error('Highlight DOM Error:', error);
          }
        });
        
        // 애니메이션이 완전히 종료된 후 하이라이트 상태(파란 테두리 등)를 원복하기 위해 Context 초기화
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

  const handleExcelExport = () => {
    const direct = finalShares?.direct || [];
    const fromSubGroups = (finalShares?.subGroups || []).flatMap((g) => g.shares || []);
    const survivors = [...direct, ...fromSubGroups];
    const commonDenominator = survivors.reduce((acc, s) => math.lcm(acc || 1, s.d || 1), 1) || 1;
    const rows = survivors.map((s) => {
      const simplifiedN = s.n || 0;
      const simplifiedD = s.d || 1;
      const commonN = simplifiedN * (commonDenominator / simplifiedD);
      return [
        s.name || '',
        getRelStr(s.relation, tree.deathDate) || s.relation || '',
        simplifiedN,
        simplifiedD,
        commonN,
        commonDenominator,
        s.path || '',
      ];
    });
    const header = ['성명', '관계', '법정지분 분자', '법정지분 분모', '통분 분자', '통분 분모', '상속경로'];
    const csv = [header, ...rows].map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCaseNo = (tree.caseNo || '미입력').replace(/[^\w가-힣-]/g, '');
    const safeName = (tree.name || '피상속인').replace(/[^\w가-힣-]/g, '');
    a.href = url;
    a.download = `${safeCaseNo}_${safeName}_상속지분_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const effectiveSidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, sidebarWidth);

  return (
    <>
      <PrintReport tree={tree} activeTab={activeTab} activeDeceasedTab={activeDeceasedTab} finalShares={finalShares} calcSteps={calcSteps} amountCalculations={amountCalculations} propertyValue={propertyValue} />
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
          undoTree={undoTree} redoTree={redoTree} canUndo={canUndo} canRedo={canRedo}
          setIsResetModalOpen={setIsResetModalOpen}
          loadFile={(e) => {
            loadTreeFromJsonFile(e.target.files[0], { setTree, setActiveTab, setImportIssues, setPropertyValue, setSpecialBenefits, setContributions, setIsAmountActive });
            setIsDirty(false);
          }}
          saveFile={() => {
            saveFactTreeToFile(tree, { propertyValue, specialBenefits, contributions, isAmountActive });
            setIsDirty(false);
          }}
          handleExcelExport={handleExcelExport}
          handlePrint={() => printCurrentTab({ activeTab, tree })}
          zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        />
        <SidebarTreePanel
          sidebarOpen={sidebarOpen} sidebarWidth={effectiveSidebarWidth} tree={tree} handleNavigate={handleNavigate}
          sidebarSearchQuery={sidebarSearchQuery} setSidebarSearchQuery={setSidebarSearchQuery}
          sidebarMatchIds={sidebarMatchIds} sidebarCurrentMatchIdx={sidebarCurrentMatchIdx}
          handleSidebarPrevMatch={handleSidebarPrevMatch} handleSidebarNextMatch={handleSidebarNextMatch}
          sidebarToggleSignal={sidebarToggleSignal} setSidebarToggleSignal={setSidebarToggleSignal}
          handleResizeMouseDown={handleResizeMouseDown}
          removeHeir={removeHeir}
        />
        <main className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`} style={{ paddingLeft: sidebarOpen ? (effectiveSidebarWidth + 10) : 0, paddingRight: showNavigator ? (navigatorWidth + 10) : 0 }}>
          <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: (sidebarOpen || showNavigator) ? 'flex-start' : 'center' }}>
            <div
                className={`flex flex-col shrink-0 mt-6 print-compact relative z-10 transition-all duration-300 ${
                activeTab === 'tree' ? 'w-full px-2' : 'w-[1080px] min-w-[1080px] px-6'
                }`}
            >
              <div className="flex items-end pl-[48px] gap-1 no-print relative z-20">
                {['input', 'tree', 'acquisition', 'summary'].map(id => (
                  <button key={id} onClick={() => handleTabChange(id)} className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] border-2 border-b-0 transition-all ${activeTab === id ? 'bg-white dark:bg-neutral-800 border-[#37352f] text-[#37352f]' : 'bg-transparent border-transparent text-[#9b9a97]'}`}>
                    {id === 'input' ? '데이터 입력' : id === 'tree' ? '사건 검토' : id === 'acquisition' ? '취득경로' : '상속지분'}
                  </button>
                ))}
              </div>
              <div className={`border border-[#e9e9e7] dark:border-neutral-600 rounded-xl shadow-sm min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col relative z-0 ${activeTab === 'tree' ? 'p-5' : 'p-10'}`}>
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
                {activeTab === 'acquisition' && <AcquisitionPanel tree={tree} calcSteps={calcSteps} finalShares={finalShares} issues={blockingIssues} handleNavigate={handleNavigate} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={acquisitionViewMode} setViewMode={setAcquisitionViewMode} />}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <SummaryPanel tree={tree} finalShares={finalShares} calcSteps={calcSteps} issues={blockingIssues} handleNavigate={handleNavigate} matchIds={matchIds} currentMatchIdx={currentMatchIdx} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    <div className="border-t border-[#e9e9e7] dark:border-neutral-600 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsAmountActive(v => !v)}
                        className={`flex w-full items-center justify-between rounded-xl border px-5 py-3 text-left text-[14px] font-bold transition-all ${isAmountActive ? 'border-[#3b5f8a] bg-[#f0f6ff] text-[#3b5f8a] dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'border-[#e9e9e7] bg-white text-[#37352f] hover:bg-[#f7f7f5] dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200'}`}
                      >
                        <span>구체적 상속분 산정</span>
                        <span className="text-[12px] font-normal text-[#787774] dark:text-neutral-400">{isAmountActive ? '접기 ▲' : '펼치기 ▼'}</span>
                      </button>
                      {isAmountActive && (
                        <div className="mt-3">
                          <AmountPanel tree={tree} finalShares={finalShares} amountCalculations={amountCalculations} propertyValue={propertyValue} setPropertyValue={setPropertyValue} specialBenefits={specialBenefits} setSpecialBenefits={setSpecialBenefits} contributions={contributions} setContributions={setContributions} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
