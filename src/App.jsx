import React, { useState, useEffect, useMemo } from 'react';
import {
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen,
  IconPrinter, IconNetwork, IconTable, IconList,
  IconReset, IconFileText, IconXCircle, IconX, IconChevronRight,
  IconSun, IconMoon, IconUndo, IconRedo, IconUserGroup
} from './components/Icons';
import { DateInput } from './components/DateInput';
import HeirRow from './components/HeirRow';
import TreeReportNode from './components/TreeReportNode';
import { math, getLawEra, getRelStr, formatKorDate, formatMoney, isBefore } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const getWarningState = (n, rootDeathDate, level = 1) => {
  if (!n) return { isDirect: false, hasDescendant: false };
  // 💡 핵심 픽스: 상속포기, 상속인없음 등 소급 무시되는 상태는 경고창 완전히 차단
  if (n.isExcluded && (n.exclusionOption === 'no_heir' || n.exclusionOption === 'renounce' || !n.exclusionOption)) {
    return { isDirect: false, hasDescendant: false };
  }

  const isRootSpouse = level === 1 && ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(n.relation);
  const isPreDeceasedSpouse = isRootSpouse && n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);
  const isPreDeceasedContext = n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);

  const requiresHeirsIfExcluded = n.isExcluded && ['lost', 'disqualified'].includes(n.exclusionOption);
  const requiresHeirsIfDeceased = !n.isExcluded && n.isDeceased && !isPreDeceasedSpouse && isPreDeceasedContext;

  const isDirect = n.id !== 'root' && 
    (requiresHeirsIfExcluded || requiresHeirsIfDeceased) && 
    (!n.heirs || n.heirs.length === 0);
    
  let hasDescendant = false;
  if (n.heirs && n.heirs.length > 0) {
    hasDescendant = n.heirs.some(h => {
      const childState = getWarningState(h, rootDeathDate, level + 1);
      return childState.isDirect || childState.hasDescendant;
    });
  }
  
  return { isDirect, hasDescendant };
};

const MiniTreeView = ({ node, level = 0, onSelectNode, visitedHeirs = new Set(), deathDate, toggleSignal }) => {
  // 기본 상태: 루트(level 0)만 펼침. 즉, 1대 상속인까지만 화면에 보임
  const [isExpanded, setIsExpanded] = React.useState(level === 0);
  
  // 외부 토글 신호(모두 접기/펼치기) 감지 및 재귀적 적용
  React.useEffect(() => {
    if (toggleSignal > 0) {
      setIsExpanded(true); // 모두 펼침
    } else if (toggleSignal < 0) {
      setIsExpanded(level === 0); // 모두 접기 시 기본 상태(1대만 노출)로 복귀
    }
  }, [toggleSignal, level]);

  if (!node) return null;

  // ⚠️ 누락 경고 상태 계산 (법적 예외 로직 적용)
  const { isDirect: isDirectMissing, hasDescendant: hasMissingDescendant } = getWarningState(node, deathDate);
  const showWarning = isDirectMissing || (!isExpanded && hasMissingDescendant);
  const warningTitle = isDirectMissing 
    ? "하위 상속인 입력 누락 의심 (지분 계산에서 제외될 수 있습니다)"
    : "하위 상속인 중 입력 누락 의심 (펼쳐서 확인하세요)";
  
  // 🎨 상태별 스타일 정의 (생존 상속인 강조 및 사망자 선명한 검정색)
  const getStatusStyle = (node, hasSubHeirs) => {
    const isAlive = !node.deathDate && !node.isDeceased;
    
    // 생존자: 뚜렷하고 차분한 남색 (기본 굵기)
    let colorClass = 'text-[#1e56a0] dark:text-[#60a5fa]'; 
    
    if (!isAlive) {
      // 사망자: 선명한 검정색/흰색 (기본 굵기)
      colorClass = 'text-black dark:text-white'; 
    }
    
    let underlineClass = '';
    if (hasSubHeirs) underlineClass = 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4';
    
    return `${colorClass} ${underlineClass}`;
  };

  const hasHeirs = node.heirs && node.heirs.length > 0;
  const itemStyleClass = getStatusStyle(node, hasHeirs);

  // 중복 호출 방지 로직 (간소화 유지)
  if (node.name && level > 0) visitedHeirs.add(node.name);

  return (
    <div className={`flex flex-col ${level > 0 ? 'ml-3' : ''}`}>
      <div className="flex items-center gap-1.5 py-1 pr-1 group">
        {level > 0 && <span className="text-[#d4d4d4] dark:text-neutral-600 text-[12px] shrink-0 font-bold opacity-40">└</span>}
        <span 
          onClick={() => {
            if (hasHeirs) setIsExpanded(!isExpanded);
            onSelectNode && onSelectNode(node.id);
          }}
          className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded ${itemStyleClass}`}
        >
          {node.name || (level === 0 ? '피상속인' : '(이름 없음)')}
        </span>
        
        {/* 💡 수정: 경고 아이콘을 관계 표시 앞으로 이동 + 깜빡임(pulse) 제거 + 고정 정렬 */}
        <div className="flex items-center gap-1 shrink-0">
          {showWarning && (
            <span className="text-[12px] cursor-help opacity-100" title={warningTitle}>⚠️</span>
          )}
          {level > 0 && (
            <span className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${node.isDeceased ? 'text-[#ef4444]' : 'text-[#787774]'}`}>
              [{getRelStr(node.relation, deathDate) || '자녀'}]
            </span>
          )}
        </div>
      </div>
      
      {isExpanded && hasHeirs && (
        <div className="border-l border-[#e9e9e7] dark:border-neutral-700 ml-1.5 pl-1.5 pb-1 transition-colors">
          {node.heirs.map((h, i) => (
            <MiniTreeView key={h.id || i} node={h} level={level + 1}
              onSelectNode={onSelectNode}
              visitedHeirs={visitedHeirs}
              deathDate={node.deathDate || deathDate}
              toggleSignal={toggleSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('input'); 
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [syncRequest, setSyncRequest] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Undo/Redo 위한 History 기능 추가
  const [treeState, setTreeState] = useState({
    history: [getInitialTree()],
    currentIndex: 0
  });

  const rawTree = treeState.history[treeState.currentIndex] || getInitialTree();

  const setTree = (action) => {
    setTreeState(prev => {
      const currentTree = prev.history[prev.currentIndex];
      const newTree = typeof action === 'function' ? action(currentTree) : action;
      const parsedTree = JSON.parse(JSON.stringify(newTree)); // 깊은 복사 보장
      
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(parsedTree);
      if (newHistory.length > 50) newHistory.shift();
      
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    });
  };

  // 1. Tree 파싱 및 구버전 JSON 마이그레이션 (personId 자동 부여)
  const tree = useMemo(() => {
    const seenIds = new Set();
    const nameToPersonId = new Map(); // 구버전 데이터의 동명이인 자동 묶음용

    const sanitize = (node) => {
      if (!node) return null;
      if (seenIds.has(node.id)) return null; 
      seenIds.add(node.id);
      
      const copy = { ...node };
      
      // 💡 핵심: personId가 없으면 생성 (구버전 호환)
      if (!copy.personId) {
         if (copy.name && nameToPersonId.has(copy.name)) {
             copy.personId = nameToPersonId.get(copy.name);
         } else {
             copy.personId = `p_${copy.id.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random().toString(36).substr(2,4)}`;
             if (copy.name) nameToPersonId.set(copy.name, copy.personId);
         }
      } else {
         if (copy.name) nameToPersonId.set(copy.name, copy.personId);
      }

      if (copy.heirs && Array.isArray(copy.heirs)) {
        copy.heirs = copy.heirs.map(sanitize).filter(Boolean);
      }
      return copy;
    };
    return sanitize(rawTree) || getInitialTree();
  }, [rawTree]);

  // 트리를 순회하여 사망한 인물들의 순서 목록 생성 (세대 레벨 및 기둥 ID 포함)
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredNames = new Set();
    tabMap.set('root', { id: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });
    if (tree.name) registeredNames.add(tree.name);

    // 깊이 우선 탐색(DFS) 대신 너비 우선 탐색(BFS) 큐 방식 사용
    const queue = [];
    if (tree.heirs) {
      tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.id }));
    }

    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();

      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouseOfRoot = parentNode.id === 'root' && (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse');
      const isDisqualifiedSpouse = isSpouseOfRoot && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);

      let currentBranchRootId = branchRootId;
      const isAnonymous = !node.name || node.name.trim() === '';
      const nameToCheck = isAnonymous ? node.id : node.name.trim();

      if (isTarget && !isDisqualifiedSpouse) {
        if (!registeredNames.has(nameToCheck)) {
          tabMap.set(node.id, {
            id: node.id,
            name: node.name || '(상속인)',
            node: node,
            parentNode: parentNode,
            parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name,
            relation: node.relation,
            level: level,
            branchRootId: currentBranchRootId
          });
          registeredNames.add(nameToCheck);
        } else {
          // 이미 1세대 기둥으로 등록된 인물인 경우 (배우자 탭 하위로 중복 복사된 자녀 등)
          // 원래 본인의 1세대 기둥 ID를 찾아서 하위 상속인들이 올바른 위치에 뜨도록 교정
          const existingTabs = Array.from(tabMap.values());
          const existingTab = existingTabs.find(t => t.name === nameToCheck);
          if (existingTab) {
            currentBranchRootId = existingTab.branchRootId;
          }
        }
      } else if (!isTarget && registeredNames.has(nameToCheck)) {
          // 사망자가 아니더라도 하위에 사망자가 있을 수 있으므로 기둥 ID 교정
          const existingTabs = Array.from(tabMap.values());
          const existingTab = existingTabs.find(t => t.name === nameToCheck);
          if (existingTab) {
            currentBranchRootId = existingTab.branchRootId;
          }
      }

      // 하위 상속인들을 큐에 추가
      if (node.heirs && node.heirs.length > 0) {
        node.heirs.forEach(h => {
           queue.push({ node: h, parentNode: node, level: level + 1, branchRootId: currentBranchRootId });
        });
      }
    }

    return Array.from(tabMap.values());
  }, [tree]);

  const undoTree = () => {
    setTreeState(prev => prev.currentIndex > 0 ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev);
  };
  const redoTree = () => {
    setTreeState(prev => prev.currentIndex < prev.history.length - 1 ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev);
  };


  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [inputToggleSignal] = useState(0);  
  const [propertyValue, setPropertyValue] = useState(''); 
  const [isAmountActive, setIsAmountActive] = useState(false);
  const [isFolderFocused, setIsFolderFocused] = useState(false); // 서류철 포커스 모드 (폴더 열기)
  const [summaryExpanded, setSummaryExpanded] = useState(true); // 가계도 요약 표시 여부
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(1); // 가계도 요약 전체 접기/펼침 신호 (1: 펼침, -1: 접힘)
  const [mainQuickVal, setMainQuickVal] = useState('');          // 메인 입력창용 퀵 입력 값
  const [isMainQuickActive, setIsMainQuickActive] = useState(false); // 메인 입력창용 퀵 입력 활성화

  // 🤝 중복 성명 및 동일인 관리 상태
  const [duplicateRequest, setDuplicateRequest] = useState(null); // { name, parentName, relation, onConfirm(isSame) }

  // 트리 전체에서 특정 이름을 가진 노드들(본인 제외)을 찾는 헬퍼
  const findDuplicates = (node, name, excludeId, results = []) => {
    if (!name || name.trim() === '') return results;
    if (node.id !== excludeId && node.name === name.trim()) {
      results.push(node);
    }
    if (node.heirs) node.heirs.forEach(h => findDuplicates(h, name, excludeId, results));
    return results;
  };

  // 특정 노드의 부모 노드를 찾는 헬퍼 (위치 정보 표시용)
  const findParentNode = (root, targetId) => {
    if (root.heirs && root.heirs.some(h => h.id === targetId)) return root;
    if (root.heirs) {
      for (const h of root.heirs) {
        const p = findParentNode(h, targetId);
        if (p) return p;
      }
    }
    return null;
  };
  // 퀵 입력 제출: 이름들을 파싱해서 상속인 추가 + 부모 노드 자동 사망 처리
  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) return;
    const names = value.split(/[,，、\s]+/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    setTree(prev => {
      let newTree = JSON.parse(JSON.stringify(prev));
      const usedNames = new Set((parentNode.heirs || []).map(h => h.name));

      const markDeceasedAndAdd = (node) => {
        if (node.id === parentId) {
          if (!node.isDeceased) node.isDeceased = true;
          const hasSpouse = (node.heirs || []).some(h => h.relation === 'wife' || h.relation === 'husband');
          
          names.forEach((name, idx) => {
            const isSpouse = idx === 0 && !hasSpouse;
            const isRootFemale = parentNode.gender === 'female';
            
            // 🏷️ 중복 이름 자동 구분 (접미사 부여)
            let finalName = name;
            if (usedNames.has(finalName)) {
               let suffix = 2;
               while(usedNames.has(`${name}(${suffix})`)) suffix++;
               finalName = `${name}(${suffix})`;
            }
            usedNames.add(finalName);

            node.heirs = node.heirs || [];
            node.heirs.push({
              id: `h_${Date.now()}_${idx}`,
              name: finalName,
              relation: isSpouse ? (isRootFemale ? 'husband' : 'wife') : 'son',
              isDeceased: false,
              isSameRegister: true,
              heirs: []
            });
          });
          return true;
        }
        if (node.heirs) return node.heirs.some(markDeceasedAndAdd);
        return false;
      };

      if (newTree.id === parentId) {
        const hasSpouse = (newTree.heirs || []).some(h => h.relation === 'wife' || h.relation === 'husband');
        names.forEach((name, idx) => {
          const isSpouse = idx === 0 && !hasSpouse;
          const isRootFemale = newTree.gender === 'female';
          
          let finalName = name;
          if (usedNames.has(finalName)) {
             let suffix = 2;
             while(usedNames.has(`${name}(${suffix})`)) suffix++;
             finalName = `${name}(${suffix})`;
          }
          usedNames.add(finalName);

          newTree.heirs = newTree.heirs || [];
          newTree.heirs.push({
            id: `h_${Date.now()}_${idx}`,
            name: finalName,
            relation: isSpouse ? (isRootFemale ? 'husband' : 'wife') : 'son',
            isDeceased: false,
            isSameRegister: true,
            heirs: []
          });
        });
      } else {
        (newTree.heirs || []).forEach(markDeceasedAndAdd);
      }
      return newTree;
    });
  };

  // 💡 사이드 패널 상태
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizing = React.useRef(false);
  const startX = React.useRef(0);
  const startWidth = React.useRef(0);

  const handleResizeMouseDown = (e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(480, Math.max(160, startWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const tabData = [
    { id: 'input', label: '데이터 입력', icon: <IconFileText className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'tree', label: '가계도', icon: <IconNetwork className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'calc', label: '계산표', icon: <IconTable className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'result', label: '계산결과', icon: <IconCalculator className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'summary', label: '요약표', icon: <IconList className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
  ];

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // ⌨️ 단축키 지원: Ctrl + Z (이전), Ctrl + Y (재실행)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoTree();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoTree();
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsResetModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleKeyDown = (e) => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!navKeys.includes(e.key)) return;
    if (isResetModalOpen) return;

    const all = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
    const i = all.indexOf(e.target);
    if (i === -1) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter') { 
      e.preventDefault(); if(i < all.length - 1) all[i+1].focus(); 
    } else if (e.key === 'ArrowUp' || e.key === 'Tab') { 
      e.preventDefault(); if(i > 0) all[i-1].focus(); 
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const row = e.target.closest('.nav-row, .grid');
      if (!row) return;
      const rowEls = Array.from(row.querySelectorAll('input, select, button'));
      const ri = rowEls.indexOf(e.target);
      if (e.key === 'ArrowLeft' && ri > 0) { e.preventDefault(); rowEls[ri-1].focus(); }
      else if (e.key === 'ArrowRight' && ri < rowEls.length-1) { e.preventDefault(); rowEls[ri+1].focus(); }
    }
  };

  const handleUpdate = (id, field, value) => {
    // 🏷️ 이름 변경 시 중복 체크 로직
    if (field === 'name' && value.trim() !== '') {
      const trimmedValue = value.trim();
      // 기본 이름뿐만 아니라 (2), (3) 등 접미사 붙은 이름들도 모두 찾기 (3번째+ 동명이인 처리)
      const baseName = trimmedValue.replace(/\(\d+\)$/, '');
      const dups = findDuplicates(tree, trimmedValue, id);
      // 접미사가 붙은 형제들도 카운트 (예: 김세환, 김세환(2), 김세환(3))
      const allSameBaseDups = dups.length > 0
        ? (() => { const r = []; const scan = (n) => { if (n.id !== id && n.name && (n.name === baseName || n.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)$`)))) r.push(n); if (n.heirs) n.heirs.forEach(scan); }; scan(tree); return r; })()
        : [];
      if (dups.length > 0) {
        const existingNode = dups[0];
        const parentNodeOfExisting = findParentNode(tree, existingNode.id);
        const parentNodeOfCurrent = findParentNode(tree, id);
        
        // 1. 동일 트리(같은 부모) 내 중복
        if (parentNodeOfExisting?.id === parentNodeOfCurrent?.id) {
          setDuplicateRequest({
            name: trimmedValue,
            parentName: parentNodeOfExisting?.name || '피상속인',
            relation: existingNode.relation,
            isSameBranch: true,
            onConfirm: (isSame) => {
              if (isSame) {
                // 동일인인 경우: 같은 부모 아래 한 사람이 두 번 있을 수 없으므로 차단
                alert(`'${trimmedValue}'님은 이미 이 단계의 상속인으로 등록되어 있습니다.\n동일인이라면 한 번만 등록해 주세요.`);
              } else {
                // 동명이인: 기존 baseName 노드를 (1)로 먼저 변경 (baseName(1)이 아직 없으면)
                setTree(prev => {
                  const renameBase = (n) => {
                    if (n.id === existingNode.id && n.name === baseName) {
                      return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] };
                    }
                    return { ...n, heirs: n.heirs?.map(renameBase) || [] };
                  };
                  return renameBase(prev);
                });
                // 신규 노드는 (2)부터 시작
                const nextSuffix = allSameBaseDups.length + 1;
                applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false);
              }
              setDuplicateRequest(null);
            },
            onCancel: () => setDuplicateRequest(null)
          });
          return;
        }

        // 2. 다른 트리(다른 부모) 내 중복: 동일인 여부 확인
        const parentName = parentNodeOfExisting ? (parentNodeOfExisting.name || '피상속인') : '피상속인';
        setDuplicateRequest({
          name: trimmedValue,
          parentName,
          relation: existingNode.relation,
          isSameBranch: false,
          onConfirm: (isSame) => {
            if (isSame) {
              // 동일인: 기존 인물의 ID를 부여하여 실질적으로 같은 사람으로 연동
              const syncIdInTree = (n) => {
                if (n.id === id) return { ...n, name: trimmedValue, personId: existingNode.personId };
                return { ...n, heirs: n.heirs?.map(syncIdInTree) || [] };
              };
              setTree(prev => syncIdInTree(prev));
            } else {
              // 동명이인: 기존 baseName 노드를 (1)로 먼저 변경 (baseName(1)이 아직 없으면)
              setTree(prev => {
                const renameBase = (n) => {
                  if (n.id === existingNode.id && n.name === baseName) {
                    return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] };
                  }
                  return { ...n, heirs: n.heirs?.map(renameBase) || [] };
                };
                return renameBase(prev);
              });
              // 신규 노드는 (2)부터 시작
              const nextSuffix = allSameBaseDups.length + 1;
              applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false);
            }
            setDuplicateRequest(null);
          },
          onCancel: () => setDuplicateRequest(null)
        });
        return;
      }
    }

    let targetName = null;
    const syncFields = ['isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    
    if (syncFields.includes(field) && field !== 'name') {
      const findNode = (n) => {
        if (n.id === id) targetName = n.name;
        if (!targetName && n.heirs) n.heirs.forEach(findNode);
      };
      findNode(tree);
      
      // 자기 자신이 아닌 동일 ID(동일인)가 있는지 검사 (이름 기반에서 ID 기반 동기화로 업그레이드)
      let hasSamePerson = false;
      const findSamePerson = (n) => {
        if (n.id === id && n !== tree) { /* 자기 자신 탐색 중 (root 제외) */ }
        // 여기서 id가 같으면 동일인임
        const getMyId = (nodeId) => {
           // 현재 노드의 ID가 tree에서 어디 있는지 찾아서 반환
           let foundId = null;
           const search = (node) => {
             if (node.id === nodeId) { foundId = node.id; return; }
             if (node.heirs) node.heirs.forEach(search);
           };
           search(tree);
           return foundId;
        };
        // 최적화: field별 동기화는 이미 같은 ID를 공유하고 있으므로, 
        // 한 군데의 데이터만 바꿔도 됨 (applyUpdate가 id 기반이므로 자동으로 반영됨)
      };
    }

    // ⚖️ 호주 상속인 단일 선택 로직: 한 명을 호주로 지정하면 다른 형제의 호주 상태를 해제
    if (field === 'isHoju' && value === true) {
      setTree(prev => {
        const updateSingleHoju = (n) => {
          if (n.heirs && n.heirs.some(h => h.id === id)) {
            return {
              ...n,
              heirs: n.heirs.map(h => ({
                ...h,
                isHoju: h.id === id ? true : false
              }))
            };
          }
          return { ...n, heirs: n.heirs?.map(updateSingleHoju) || [] };
        };
        return updateSingleHoju(prev);
      });
      return;
    }

    // 동기화 필요 없는 일반 업데이트 (applyUpdate 내부에서 id 기반으로 자동 연동됨)
    applyUpdate(id, field, value, false);
  };

  const applyUpdate = (id, changes, value, syncGlobal = false, syncName = '') => {
    // changes는 { field: value } 형태의 객체
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };

    let targetPersonId = null;
    const findPersonId = (n) => {
      if (n.id === id) targetPersonId = n.personId;
      if (!targetPersonId && n.heirs) n.heirs.forEach(findPersonId);
    };
    findPersonId(tree);

    const updateNode = (n) => {
      // 💡 화면 ID가 달라도 personId가 같으면 일괄 수정 (이름, 사망일 등 완벽 동기화)
      if (n.id === id || (targetPersonId && n.personId === targetPersonId)) {
         return { ...n, personId: targetPersonId || n.personId, ...updates };
      }
      return { ...n, heirs: n.heirs?.map(updateNode) || [] };
    };
    setTree(prev => updateNode(prev));
  };

  const handleSyncConfirm = (shouldSync) => {
    if (!syncRequest) return;
    applyUpdate(syncRequest.id, syncRequest.field, syncRequest.value, shouldSync, syncRequest.name);
    setSyncRequest(null);
  };

  const handleRootUpdate = (field, value) => {
    setTree(prev => ({ ...prev, [field]: value }));
  };

  const addHeir = (parentId) => {
    const newHash = Math.random().toString(36).substr(2, 9);
    const newHeir = { 
      id: `n_${newHash}`, 
      personId: `p_${newHash}`, // 진짜 인물 ID 부여
      name: '', 
      relation: 'son', 
      isDeceased: false, 
      isSameRegister: true, 
      heirs: [] 
    };
    const addFn = (n) => {
      if (n.id === parentId) return { ...n, heirs: [...(n.heirs || []), newHeir] };
      return { ...n, heirs: n.heirs?.map(addFn) || [] };
    };
    setTree(prev => addFn(prev));
  };

  const removeHeir = (id) => {
    const rmFn = (n) => ({ ...n, heirs: n.heirs?.filter(x => x.id !== id).map(rmFn) || [] });
    setTree(prev => rmFn(prev));
  };



  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { finalShares, calcSteps } = useMemo(() => {
    return calculateInheritance(tree, propertyValue);
  }, [tree, propertyValue]);



  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const tabRefs = React.useRef({});

  // 🧭 상속 경로 및 브리핑 정보 계산
  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => {
      if (!curr) return null;
      const newPath = [...currentPath, curr];
      if (curr.id === target) return newPath;
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
    const name = targetNode.name || (isRoot ? '피상속인' : '(이름없음)');
    let relationInfo = '';
    
    if (isRoot) {
      relationInfo = '(피상속인)';
    } else if (lineage.length > 1) {
      const parent = lineage[lineage.length - 2];
      const isChild = targetNode.relation === 'son' || targetNode.relation === 'daughter';
      
      let parentNames = parent.name || '피상속인';
      
      if (isChild) {
        const parentIsSp = parent.relation === 'wife' || parent.relation === 'husband' || parent.relation === 'spouse';
        if (lineage.length > 2 && parentIsSp) {
          const grandparent = lineage[lineage.length - 3];
          if (grandparent?.name) {
            parentNames = `${grandparent.name}·${parent.name}`;
          }
        } else if (parent.heirs) {
          const spouse = parent.heirs.find(h => 
            h.id !== targetNode.id &&
            (h.relation === 'wife' || h.relation === 'husband' || h.relation === 'spouse') && 
            h.name && h.name.trim() !== ''
          );
          if (spouse) {
            parentNames = `${parent.name}·${spouse.name}`;
          }
        }
      }
      relationInfo = `(${parentNames}의 ${getRelStr(targetNode.relation, tree.deathDate)})`;
    }

    const sourceList = [];
    let totalN = 0;
    let totalD = 1;

    if (calcSteps && Array.isArray(calcSteps)) {
      calcSteps.forEach(s => {
        const myShare = s.dists?.find(d => d.h?.id === targetNode.id); // 🔑 ID 기준으로 지분 합산
        if (myShare && myShare.n > 0) {
          sourceList.push({ 
            from: s.dec?.name || '피상속인', 
            n: myShare.sn, 
            d: myShare.sd, 
            fn: myShare.n, 
            fd: myShare.d 
          });
          const [nn, nd] = math.add(totalN, totalD, myShare.n, myShare.d);
          totalN = nn;
          totalD = nd;
        }
      });
    }

    const shareStr = isRoot ? '1분의 1' : (totalN > 0 ? `${totalD}분의 ${totalN}` : '0');
    return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps]);

  // 탭 변경 시 자동 스크롤 (활성 탭이 화면 중앙에 오도록)
  useEffect(() => {
    const activeEl = tabRefs.current[activeDeceasedTab];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeDeceasedTab]);

  // 탭 목록이 변경되면 현재 탭이 있는지 확인
  useEffect(() => {
    const tabIds = deceasedTabs.map(t => t.id);
    if (!tabIds.includes(activeDeceasedTab)) {
      setActiveDeceasedTab('root');
    }
  }, [activeDeceasedTab, deceasedTabs]);

  useEffect(() => {
    if (activeTab === 'input' && !deceasedTabs.find(t => t.id === activeDeceasedTab)) {
      if (deceasedTabs.length > 0) {
        setActiveDeceasedTab(deceasedTabs[0].id);
      }
    }
  }, [deceasedTabs, activeTab, activeDeceasedTab]);

  // 노드를 ID로 찾는 활용 함수
  const findNodeById = (node, id) => {
    if (node.id === id) return node;
    for (const h of (node.heirs || [])) {
      const found = findNodeById(h, id);
      if (found) return found;
    }
    return null;
  };

  // 진행 중인 활성 탭 객체 참조 (부모, 레벨 정보 포함)
  const activeTabObj = useMemo(() => {
    if (!deceasedTabs) return null;
    return deceasedTabs.find(t => t.id === activeDeceasedTab) || null;
  }, [deceasedTabs, activeDeceasedTab]);

  const moveHeir = (activeId, overId) => {
    setTree(prev => {
      const newTree = JSON.parse(JSON.stringify(prev));
      const reorderList = (list) => {
        if (!list) return false;
        const activeIdx = list.findIndex(item => item.id === activeId);
        const overIdx = list.findIndex(item => item.id === overId);
        if (activeIdx !== -1 && overIdx !== -1) {
          const [movedItem] = list.splice(activeIdx, 1);
          list.splice(overIdx, 0, movedItem);
          return true;
        }
        for (let item of list) {
          if (item.heirs && item.heirs.length > 0) {
            if (reorderList(item.heirs)) return true;
          }
        }
        return false;
      };
      reorderList(newTree.heirs);
      return newTree;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveHeir(active.id, over.id);
    }
  };



  const handlePrint = () => {
    if (activeTab === 'input') {
      alert('보고서 탭(가계도, 계산표, 요약표) 중 하나를 선택한 후 인쇄해주세요.');
      return;
    }
    window.print();
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    a.download = `${safeCaseNo}_${safeName}_상속지분계산_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const addPersonIdRec = (n) => ({ ...n, personId: n.personId || `p_${Math.random().toString(36).substr(2,9)}`, heirs: (n.heirs || []).map(addPersonIdRec) });
        // 구버전(트리) 형식: id === 'root' 또는 heirs 배열 보유
        if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
          setTree(addPersonIdRec(data));
          setActiveTab('calc');
        } else if (data.people && Array.isArray(data.people)) {
          // 신버전(그래프) 형식 - 기본 정보만 추출하여 트리 초기화
          alert('이 파일은 이전 버전의 그래프 형식입니다. 일부 데이터가 누락될 수 있습니다.');
          const root = data.people.find(p => p.isRoot || p.id === 'root');
          if (root) {
            setTree({ id: 'root', name: root.name || '', gender: root.gender || 'male',
              deathDate: root.deathDate || '', caseNo: data.caseNo || '',
              isHoju: root.isHoju !== false, shareN: data.shareN || 1, shareD: data.shareD || 1,
              heirs: [] });
            setActiveTab('input');
          }
        } else {
          alert('인식할 수 없는 파일 형식입니다.');
        }
      } catch (err) { alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExcelExport = () => {
    // CSV 형태로 지분 요약 정보를 내보냄
    const rows = [
      ['사건번호', tree.caseNo || ''],
      ['피상속인', tree.name || ''],
      ['사망일자', tree.deathDate || ''],
      [''],
      ['상속인', '관계', '지분(분자)', '지분(분모)', '통분 지분(분자)', '통분 지분(분모)'],
    ];
    finalShares.direct.forEach(f => {
      rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
    });
    (finalShares.subGroups || []).forEach(g => {
      rows.push(['', `※ 공동상속인 중 [${g.ancestor?.name || ''}]은(는) ${formatKorDate(g.ancestor?.deathDate)} 사망하였으므로 상속인`, '', '', '', '']);
      g.shares.forEach(f => {
        rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
      });
    });
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    a.download = `상속지분_${safeName}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const performReset = (withSave) => {

    if (withSave) saveFile();
    setTree(getEmptyTree());
    setActiveTab('input');
    setIsResetModalOpen(false);
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col items-start pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900 min-w-[1280px] print:min-w-0 print:w-full print:max-w-full">
      
      <div id="print-footer" className="hidden print:block fixed bottom-0 right-0 font-['Dancing_Script'] text-neutral-300 text-sm">
        Designed by J.H. Lee
      </div>

      {/* 💡 사이드 패널 - 탭에 상관없이 항상 고정 표시 */}
      {sidebarOpen && (
        <div
          className="fixed left-0 top-[54px] bottom-0 flex flex-col bg-white dark:bg-neutral-900 border-r border-[#e9e9e7] dark:border-neutral-700 z-[40] no-print transition-colors select-none"
          style={{ width: sidebarWidth }}
        >
          {/* 사이드바 헤더: 타이틀 + 토글 / 안내 콜아웃 */}
          <div className="flex flex-col border-b border-[#f1f1ef] dark:border-neutral-700 shrink-0 transition-colors select-none">
            {/* 1열: 타이틀 및 모두펼침 버튼 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center text-[12px] font-black text-[#37352f] dark:text-neutral-200 uppercase tracking-widest opacity-60">
                <IconNetwork className="w-3.5 h-3.5 shrink-0 mr-2"/> 가계도 요약
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#787774] dark:text-neutral-500">모두펼침</span>
                <button 
                  onClick={() => setSidebarToggleSignal(prev => prev > 0 ? -Math.abs(prev)-1 : Math.abs(prev)+1)}
                  className={`relative w-8 h-4 rounded-full transition-all duration-300 focus:outline-none shadow-inner border border-transparent ${sidebarToggleSignal > 0 ? 'bg-[#2383e2] border-blue-600' : 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'}`}
                  title={sidebarToggleSignal > 0 ? '모두 접기' : '모두 펼치기'}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-md transform ${sidebarToggleSignal > 0 ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            
            {/* 2열: 노션 스타일 인라인 안내 콜아웃 */}
            <div className="px-3 pb-3">
              <div className="bg-[#f7f7f5] dark:bg-neutral-800/40 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-md p-2 flex items-start gap-2">
                <span className="text-[12px] opacity-80 shrink-0 leading-none mt-0.5">💡</span>
                <p className="text-[10.5px] leading-[1.5] font-medium text-[#787774] dark:text-neutral-400">
                  이름을 클릭하면 해당 상속인 입력 화면으로 이동합니다.
                </p>
              </div>
            </div>
          </div>
          {/* 트리 내용: 실제 요약 리스트만 스크롤되도록 분리 */}
          {summaryExpanded && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 pb-10 text-[13px] animate-in fade-in slide-in-from-top-1 duration-200 sidebar-content-wrapper">
              <MiniTreeView node={tree} level={0}
                toggleSignal={sidebarToggleSignal}
                onSelectNode={(id) => {
                  const targetNode = findNodeById(tree, id);
                  if (!targetNode) return;

                  // 1. 직접 매칭 확인 (ID 또는 이름)
                  let matchedTab = deceasedTabs.find(t => t.id === id);
                  if (!matchedTab && targetNode.name) {
                    matchedTab = deceasedTabs.find(t => t.name === targetNode.name);
                  }

                  if (matchedTab) {
                    setActiveDeceasedTab(matchedTab.id);
                    setActiveTab('input');
                    return;
                  }

                  // 2. 조상을 거슬러 올라가며 탭 소유자 찾기
                  const getAncestorPath = (root, targetId, path = []) => {
                    if (root.id === targetId) return path;
                    if (root.heirs) {
                      for (const h of root.heirs) {
                        const res = getAncestorPath(h, targetId, [...path, root]);
                        if (res) return res;
                      }
                    }
                    return null;
                  };

                  const ancestors = getAncestorPath(tree, id);
                  if (ancestors && ancestors.length > 0) {
                    // 가장 가까운(최하위) 조상부터 탐색
                    for (let i = ancestors.length - 1; i >= 0; i--) {
                      const anc = ancestors[i];
                      let ancTab = deceasedTabs.find(t => t.id === anc.id);
                      if (!ancTab && anc.name) {
                        ancTab = deceasedTabs.find(t => t.name === anc.name);
                      }
                      
                      if (ancTab) {
                        setActiveDeceasedTab(ancTab.id);
                        setActiveTab('input');
                        return;
                      }
                    }
                  }
                }}
                visitedHeirs={new Set()}
                deathDate={tree.deathDate}
              />
            </div>
          )}
          {/* 드래그 리사이즈 핸들 */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#2383e2]/60 dark:hover:bg-blue-500/60 active:bg-[#2383e2] transition-colors"
            title="드래그하여 폭 조절"
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 15mm !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 100% !important;
            min-width: 0 !important;
          }
          #root {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #root > div {
            min-width: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          table { table-layout: fixed; width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; }
          .no-print { display: none !important; }
        }
      ` }} />

      {/* 🖨️ 인쇄 전용 보고서 영역 - 210mm 전체 폭 + 내부 15mm 패딩으로 직접 여백 관리 */}
      <div className="hidden print:block w-[210mm] max-w-[210mm] bg-white text-black min-h-screen relative z-0">
        <div className="p-[15mm] space-y-10 w-full">
          {activeTab === 'tree' && (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-5 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconNetwork className="w-5 h-5"/> 상속 가계도
              </h2>
              <div className="border border-gray-300 p-8 rounded-xl bg-white">
                <TreeReportNode node={tree} level={0} treeToggleSignal={1} />
              </div>
            </section>
          )}

          {activeTab === 'summary' && (() => {
            const pShareById = new Map();
            (finalShares.direct || []).forEach(s => pShareById.set(s.id, s));
            (finalShares.subGroups || []).forEach(g => g.shares.forEach(s => pShareById.set(s.id, s)));

            const pBuildGroups = (node, parentDeathDate) => {
              const directShares = [];
              const subGroups = [];
              (node.heirs || []).forEach(h => {
                if (!h.isDeceased) {
                  const s = pShareById.get(h.id);
                  if (s && s.n > 0) directShares.push(s);
                } else {
                  const type = (h.deathDate && isBefore(h.deathDate, parentDeathDate)) ? '대습상속' : '재상속';
                  const child = pBuildGroups(h, h.deathDate || parentDeathDate);
                  if (child.directShares.length > 0 || child.subGroups.length > 0) {
                    subGroups.push({ ancestor: h, type, ...child });
                  }
                }
              });
              return { directShares, subGroups };
            };

            const pTopDirect = [];
            const pTopGroups = [];
            (tree.heirs || []).forEach(h => {
              if (!h.isDeceased) {
                const s = pShareById.get(h.id);
                if (s && s.n > 0) pTopDirect.push(s);
              } else {
                const type = (h.deathDate && isBefore(h.deathDate, tree.deathDate)) ? '대습상속' : '재상속';
                const child = pBuildGroups(h, h.deathDate || tree.deathDate);
                if (child.directShares.length > 0 || child.subGroups.length > 0) {
                  pTopGroups.push({ ancestor: h, type, ...child });
                }
              }
            });

            const pRenderShareRow = (f, depth, key) => (
              <tr key={key} className="text-black">
                <td className="border border-black py-1.5 px-3 text-[10pt]" style={{paddingLeft: `${12 + depth * 16}px`}}>└ {f.name}</td>
                <td className="border border-black py-1.5 px-3 text-center text-[10pt]">{f.n} / {f.d}</td>
                <td className="border border-black py-1.5 px-3 text-center font-bold text-[10pt]">{f.un} / {f.ud}</td>
              </tr>
            );

            const pRenderGroup = (group, depth, parentName, keyPrefix) => (
              <React.Fragment key={keyPrefix}>
                <tr className="bg-gray-50">
                  <td colSpan="3" className="border border-black py-1.5 text-[9pt] text-gray-700 italic" style={{paddingLeft: `${8 + depth * 16}px`}}>
                    {depth > 0 && '└ '}
                    {parentName ? `※ [${parentName}]의 상속인 중 [${group.ancestor.name}]은(는)` : `※ 공동상속인 중 [${group.ancestor.name}]은(는)`}
                    {' '}{formatKorDate(group.ancestor.deathDate)} 사망 → {group.type} 발생, 상속인
                  </td>
                </tr>
                {group.directShares.map((f, i) => pRenderShareRow(f, depth + 1, `${keyPrefix}-d${i}`))}
                {group.subGroups.map((sg, i) => pRenderGroup(sg, depth + 1, group.ancestor.name, `${keyPrefix}-sg${i}`))}
              </React.Fragment>
            );

            return (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-2 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconList className="w-5 h-5"/> 최종 상속 지분 요약
              </h2>
              <p className="text-[10pt] text-gray-700 mb-3 pl-1">
                피상속인: <strong>{tree.name || '미입력'}</strong>
                &nbsp;|&nbsp;사망일자: <strong>{tree.deathDate || '미입력'}</strong>
                &nbsp;|&nbsp;상속지분: <strong>{tree.shareN || 1} / {tree.shareD || 1}</strong>
                &nbsp;|&nbsp;적용법령: <strong>{getLawEra(tree.deathDate)}년 민법</strong>
              </p>
              <table className="w-full border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 text-black">
                    <th className="border border-black py-2 px-3 text-[11pt] w-[25%] font-bold">상속인 성명</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[35%] font-bold">최종 지분 (기본)</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[40%] font-bold">최종 지분 (통분)</th>
                  </tr>
                </thead>
                <tbody>
                  {pTopDirect.map((f, i) => pRenderShareRow(f, 0, 'p-d'+i))}
                  {pTopGroups.map((g, i) => pRenderGroup(g, 0, null, 'p-g'+i))}
                </tbody>
              </table>
            </section>
          );
          })()}

          {activeTab === 'calc' && (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-3 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconTable className="w-5 h-5"/> 상세 계산 근거
              </h2>
              <div className="space-y-4">
                {calcSteps.map((s, i) => (
                  <div key={'p-s'+i} className="border border-gray-300 p-4 rounded">
                    <div className="font-bold text-[11pt] mb-2 text-gray-800">
                      피상속인 {s.dec.name} ({s.dec.deathDate} 사망) ─ 피상속지분: {s.inN}/{s.inD}
                      {s.mergeSources && s.mergeSources.length > 1 && (
                        <span className="ml-2 text-[10pt] font-bold text-teal-700">
                          (= {s.mergeSources.map((src, si) => (
                            <React.Fragment key={si}>
                              {si > 0 && ' + '}
                              {src.from} {src.d}분의 {src.n}
                            </React.Fragment>
                          ))})
                        </span>
                      )}
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-[10pt]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-400">
                          <th className="py-1 px-2 text-left w-[20%]">상속인</th>
                          <th className="py-1 px-2 text-center w-[40%]">산출 지분 계산식</th>
                          <th className="py-1 px-2 text-left w-[40%]">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.dists.map((d, di) => (
                          <tr key={di} className="border-b border-gray-200">
                            <td className="py-1 px-2 font-bold">{d.h.name}</td>
                            <td className="py-1 px-2 text-center">{s.inN}/{s.inD} × {d.sn}/{d.sd} = <strong>{d.n}/{d.d}</strong></td>
                            <td className="py-1 px-2 text-[9pt]">{d.mod ? ('※ ' + d.mod) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'result' && (() => {
            const heirMap = new Map();
            calcSteps.forEach(s => {
              s.dists.forEach(d => {
                if (d.n > 0) {
                  const key = d.h.id; // 🔑 이름 대신 고유 ID 기준으로 집계
                  if (!heirMap.has(key)) {
                    heirMap.set(key, { name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
                  }
                  heirMap.get(key).sources.push({ decName: s.dec.name, n: d.n, d: d.d });
                }
              });
            });
            const results = Array.from(heirMap.values()).filter(r => !r.isDeceased);
            return (
              <section className="w-full">
                <h2 className="text-[16pt] font-bold mb-3 border-l-4 border-black pl-3 flex items-center gap-2">
                  <IconCalculator className="w-5 h-5"/> 상속인별 상속지분 계산 결과표
                </h2>
                <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                  <thead>
                    <tr className="bg-gray-100 font-bold border-b border-black">
                      <th className="border border-black py-1.5 px-2 w-[15%] text-center">상속인</th>
                      <th className="border border-black py-1.5 px-2 w-[60%] text-center">상속지분 구성 및 계산 내역</th>
                      <th className="border border-black py-1.5 px-2 w-[25%] text-center font-bold">최종 상속 지분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const total = r.sources.reduce((acc, s) => {
                        const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                        return { n: nn, d: nd };
                      }, { n: 0, d: 1 });
                      return (
                        <tr key={i} className="border-b border-gray-400">
                          <td className="border border-black py-2 px-2 text-center font-bold">{r.name}</td>
                          <td className="border border-black py-2 px-3">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {r.sources.map((s, si) => (
                                <React.Fragment key={si}>
                                  {si > 0 && <span className="font-bold">+</span>}
                                  <span className="whitespace-nowrap">{s.n}/{s.d}({s.decName})</span>
                                </React.Fragment>
                              ))}
                            </div>
                          </td>
                          <td className="border border-black py-2 px-2 text-center font-bold text-[11pt]">{total.n} / {total.d}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 text-[9pt] text-gray-500 italic">
                  ※ 위 지분은 각 피상속인으로부터 승계받은 지분의 합계입니다.
                </div>
              </section>
            );
          })()}

          <div className="mt-12 text-[10pt] text-gray-400 text-center italic border-t pt-4">
            본 보고서는 상속지분 계산기 PRO (Designed by J.H. Lee)를 통해 법령에 기초하여 자동 생성되었습니다.
          </div>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center no-print">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2 text-[#37352f]">새 작업 시작</h2>
            <p className="text-[14px] text-[#787774] mb-6">현재 작성 중인 모든 데이터가 삭제됩니다.<br/>어떻게 처리할까요?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => performReset(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">백업 저장 후 초기화</button>
              <button onClick={() => performReset(false)} className="w-full py-2.5 bg-[#ffe2dd] hover:bg-[#ffc1b8] text-[#d44c47] font-medium rounded transition-colors text-[14px]">저장 없이 그냥 초기화</button>
              <button onClick={() => setIsResetModalOpen(false)} className="w-full py-2.5 mt-2 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">취소</button>
            </div>
          </div>
        </div>
      )}

      {syncRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print text-[#37352f]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2">동일 인물 정보 동기화</h2>
            <p className="text-[14px] text-[#787774] mb-6">
              <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 정보를 변경하셨습니다.<br/>
              가계도 내의 다른 <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 동일 정보도 같이 수정할까요?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSyncConfirm(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">예, 모두 동기화합니다</button>
              <button onClick={() => handleSyncConfirm(false)} className="w-full py-2.5 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">아니요, 현재 인물만 수정합니다</button>
            </div>
          </div>
        </div>
      )}

      {/* 🤝 동일인 확인 모달 */}
      {duplicateRequest && (() => {
        // "예 (동명이인)" → isDifferent=true → isSame=false → 접미사 부여
        // "아니오 (동일인)" → isDifferent=false → isSame=true → ID 연동 or 차단
        const handleToggleConfirm = (isDifferent) => {
          duplicateRequest.onConfirm(!isDifferent);
        };

        return (
          <div className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center no-print text-[#37352f] backdrop-blur-[2px]">
            <div className="bg-white p-10 rounded-[24px] shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300 border border-[#e9e9e7] text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-[#f0f9ff] dark:bg-blue-900/10 rounded-full flex items-center justify-center border border-[#bae6fd]">
                  <IconUserGroup className="w-10 h-10 text-[#2383e2]" />
                </div>
              </div>
              
              <h2 className="text-[20px] font-black mb-3">동일인 여부 확인</h2>
              
              <p className="text-[15px] leading-relaxed mb-8 text-[#504f4c]">
                <span className="font-bold text-[#2383e2]">'{duplicateRequest.name}'</span>님이 두 번 입력되었습니다.<br/>
                이 두 분은 <span className="font-black text-rose-500">서로 다른 인물(동명이인)</span>인가요?
              </p>

              {/* 🎨 파스텔 슬라이드 토글 */}
              <div className="relative w-full h-[52px] bg-[#f1f1ef] dark:bg-neutral-800 rounded-full p-1.5 flex items-center mb-8 border border-[#e9e9e7]">
                <div 
                  className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-neutral-700 rounded-full shadow-md transition-all duration-300 ease-out"
                  id="toggle-slider"
                  style={{ left: '6px' }}
                />
                
                <button 
                  onClick={(e) => {
                    const slider = e.currentTarget.parentElement.querySelector('#toggle-slider');
                    slider.style.transform = 'translateX(0%)';
                    setTimeout(() => handleToggleConfirm(true), 300);
                  }}
                  className="relative flex-1 text-center text-[15px] font-black z-10 text-[#2383e2] transition-colors"
                >
                  예 (동명이인)
                </button>
                <button 
                  onClick={(e) => {
                    const slider = e.currentTarget.parentElement.querySelector('#toggle-slider');
                    slider.style.transform = 'translateX(100%)';
                    setTimeout(() => handleToggleConfirm(false), 300);
                  }}
                  className="relative flex-1 text-center text-[15px] font-black z-10 text-[#787774] transition-colors"
                >
                  아니오 (동일인)
                </button>
              </div>

              <button 
                onClick={duplicateRequest.onCancel}
                className="text-[13px] font-bold text-[#a1a1aa] hover:text-[#787774] underline underline-offset-4 transition-colors p-2"
              >
                취소 후 직접 수정하기
              </button>
            </div>
          </div>
        );
      })()}

      {/* 💡 헤더 (리본 메뉴) - 화면 왼쪽 끝 절대 고정 (사이드바 연동 없음) */}
      <div 
        className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex justify-start transition-all duration-300 shadow-sm overflow-hidden"
      >
        <div className="w-[1080px] min-w-[1080px] shrink-0 px-6 flex items-center justify-between h-full flex-nowrap">
          <div className="flex items-center gap-3 flex-nowrap shrink-0">
            {/* 사이드바 토글 버튼 */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className={`w-7 h-7 flex flex-col justify-center items-center rounded-md gap-1 transition-all no-print ${
                sidebarOpen 
                  ? 'bg-[#f0f0ee] dark:bg-neutral-700 text-[#2383e2] dark:text-blue-400' 
                  : 'text-[#787774] dark:text-neutral-400 hover:bg-[#efefed] dark:hover:bg-neutral-700'
              }`}
              title={sidebarOpen ? '가계도 패널 닫기' : '가계도 패널 열기'}
            >
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
            </button>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0 overflow-visible">
              <div className="flex items-center text-[#37352f] dark:text-neutral-100 font-bold text-[18px] tracking-tight whitespace-nowrap shrink-0">
                <IconCalculator className="w-5 h-5 mr-1.5 text-[#787774] dark:text-neutral-400 shrink-0" />
                상속지분 계산기 PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">v1.8.7</span>
              </div>
              <span className="designer-sign text-[#a3a3a3] dark:text-neutral-500 text-[14px] ml-8 whitespace-nowrap shrink-0">Designed by J.H. Lee</span>
            </div>
          </div>
          {/* 다크모드 버튼이 이동된 자리 - 기존 spacing 유지를 위한 placeholder */}
          <div className="w-9 shrink-0" />
          
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#f7f7f5] dark:bg-neutral-700 px-2.5 py-1 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-2 transition-colors">
              <div className="min-w-[120px] flex items-center gap-1 overflow-hidden">
                <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">사건:</span>
                <span className="text-[11px] font-bold text-[#37352f] dark:text-neutral-200 truncate">{tree.caseNo || '미입력'}</span>
              </div>
              <div className="w-px h-2.5 bg-[#d4d4d4] dark:bg-neutral-600 mx-0.5"></div>
              <div className="min-w-[140px] flex items-center gap-1 overflow-hidden">
                <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">피상속인:</span>
                <span className="text-[13px] font-black text-[#0b6e99] dark:text-blue-400 truncate">{tree.name || '미입력'}</span>
              </div>
            </div>

            <button onClick={undoTree} disabled={treeState.currentIndex <= 0} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconUndo className="w-3.5 h-3.5" /> 이전
            </button>
            <button onClick={redoTree} disabled={treeState.currentIndex >= treeState.history.length - 1} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconRedo className="w-3.5 h-3.5" /> 재실행
            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] dark:bg-neutral-600 mx-0.5"></div>

            <button onClick={() => setIsResetModalOpen(true)} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconReset className="h-3.5 w-3.5" /> 초기화
            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] mx-0.5"></div>
            <label className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1 cursor-pointer">
              <IconFolderOpen className="h-3.5 w-3.5" /> 불러오기<input type="file" accept=".json" onChange={loadFile} className="hidden" />
            </label>
            <button onClick={saveFile} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconSave className="h-3.5 w-3.5" /> 저장
            </button>
            <button onClick={handleExcelExport} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconTable className="h-3.5 w-3.5" /> 엑셀
            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] mx-0.5"></div>
            <button onClick={handlePrint} className="text-white bg-[#2383e2] hover:bg-[#0073ea] px-3 py-1 rounded text-[12px] font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap mr-1">
              <IconPrinter className="h-3.5 w-3.5" /> 인쇄
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-7 h-7 flex justify-center items-center rounded-full text-[#787774] hover:bg-[#efefed] dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors mr-2 focus:outline-none" title={isDarkMode ? '라이트 모드' : '다크 모드'}>
              {isDarkMode ? <IconSun className="w-4 h-4 text-amber-300" /> : <IconMoon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <main 
        className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
        style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 50) : 0 }}
      >
        {/* 💡 가변(max-w)을 버리고 절대 고정폭(w-[1080px]) 적용 */}
        <div className="flex flex-col w-[1080px] min-w-[1080px] shrink-0 px-6 mt-6 print-compact print:!px-0 print:!min-w-0 print:!w-full relative z-10">
          {/* 상단 탭 (네비게이션) - 제목과 정렬 동기화 */}
          <div className="flex items-end pl-[48px] gap-1 no-print relative z-20">
          {tabData.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} 
                className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] flex items-center gap-2 transition-all relative cursor-pointer border-2 border-b-0 ${
                  isActive
                    ? `bg-white dark:bg-neutral-800 ${t.style.activeBorder} ${t.style.activeText} pb-3 top-[2px] z-20`
                    : `${t.style.inactiveBg} dark:bg-neutral-800/40 ${t.style.inactiveBorder} dark:border-neutral-700 ${t.style.inactiveText} dark:text-neutral-500 pb-2.5 top-[1px] z-10 hover:brightness-95`
                }`}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
        <div className="border border-[#e9e9e7] dark:border-neutral-700 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:border-none print:shadow-none print:bg-transparent print:p-0 min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col p-10 relative z-0 transition-colors">
          <div className="no-print">
            {activeTab === 'input' && (() => {
            const activeTabObj = deceasedTabs.find(t => t.id === activeDeceasedTab);
            const currentNode = activeTabObj ? findNodeById(tree, activeTabObj.id) : tree;
            const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
            const isRootNode = currentNode && currentNode.id === 'root';
            
            const siblings = activeTabObj ? activeTabObj.parentNode?.heirs : null;
            const isSp = currentNode?.relation === 'wife' || currentNode?.relation === 'husband';
            const isChild = currentNode?.relation === 'son' || currentNode?.relation === 'daughter';

            const canAutoFillSp = !isRootNode && isSp;
            const canAutoFillChild = !isRootNode && isChild;

            const handleAutoFill = () => {
              const clone = (n) => ({ 
                ...n, 
                id: `n_${Math.random().toString(36).substr(2,9)}`, // UI용 새 좌석 번호
                personId: n.personId, // 💡 핵심: 진짜 인물 ID는 복제본도 똑같이 공유!
                heirs: n.heirs?.map(clone) || [] 
              });
              const existingNames = new Set(nodeHeirs.map(h => h.name).filter(n => n.trim() !== ''));
              
              if (canAutoFillSp) {
                const children = siblings ? siblings.filter(s => s.relation === 'son' || s.relation === 'daughter') : [];
                let newItems = children.filter(c => c.name.trim() === '' || !existingNames.has(c.name));
                if (children.length > 0 && newItems.length === 0) { alert('더 이상 불러올 동일한 상속인이 없습니다. (모두 등록됨)'); return; }
                const toAdd = newItems.length > 0 ? newItems.map(clone) : [{ id: `auto_${Date.now()}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] }];
                handleUpdate(currentNode.id, 'heirs', [...nodeHeirs, ...toAdd]);
              } else if (canAutoFillChild) {
                const siblingList = siblings ? siblings.filter(s => s.id !== currentNode.id && (s.relation === 'son' || s.relation === 'daughter')).map(s => ({ ...clone(s), relation: 'sibling', heirs: [] })) : [];
                let newItems = siblingList.filter(s => s.name.trim() === '' || !existingNames.has(s.name));
                if (siblingList.length > 0 && newItems.length === 0) { alert('더 이상 불러올 동일한 상속인이 없습니다. (모두 등록됨)'); return; }
                const toAdd = newItems.length > 0 ? newItems.map(clone) : [{ id: `auto_${Date.now()}`, name: '', relation: 'sibling', isDeceased: false, isSameRegister: true, heirs: [] }];
                handleUpdate(currentNode.id, 'heirs', [...nodeHeirs, ...toAdd]);
              }
            };
            
            return (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
                {/* 상단 기본정보 섹션 - 노션 스타일 미니멀 개편 */}
                <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-3 flex items-center gap-6 transition-colors shadow-sm">
                  <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 uppercase tracking-widest">기본정보</span>
                  </div>
                  
                  <div className="flex flex-1 items-center gap-5 overflow-x-auto no-scrollbar">
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사건번호</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo || ''} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="번호 입력" />
                    </div>
                    
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">성명</label>
                      {/* 성명 칸 너비 112px (w-28) 로 고정 */}
                      <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="이름" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사망일자</label>
                      {/* 사망일자 칸 너비 112px (w-28) 로 고정 */}
                      <DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={v=>handleRootUpdate('deathDate', v)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" />
                    </div>

                    {getLawEra(tree.deathDate) !== '1991' && (
                      <div className="shrink-0 flex items-center gap-2">
                        <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">호주</label>
                        <input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" />
                      </div>
                    )}

                    <div className="shrink-0 flex items-center gap-2">
                       <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">상속할 지분</label>
                       <div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1">
                         <input type="number" min="1" value={tree.shareD || 1} onChange={e=>handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value)||1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분모" />
                         <span className="text-[#787774] dark:text-neutral-500 text-[12px] font-medium mx-0.5">/</span>
                         <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={e=>handleRootUpdate('shareN', Math.min(tree.shareD||1, Math.max(1, parseInt(e.target.value)||1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분자" />
                       </div>
                    </div>
                  </div>
                </div>

                {/* 폴더-탭 구조: 사망한 인물별 탭 (Filing Cabinet) */}
                <div className="transition-colors flex-1 flex flex-col">
                  {(() => {
                    const getLevelStyle = (lv) => {
                      switch(lv) {
                        case 0: // Root
                        case 1: return { bg: 'bg-[#eff6ff]', border: 'border-[#bfdbfe]', text: 'text-[#1e40af]', darkBg: 'dark:bg-blue-900/30', darkBorder: 'dark:border-blue-800' };
                        case 2: return { bg: 'bg-[#f5f3ff]', border: 'border-[#ddd6fe]', text: 'text-[#5b21b6]', darkBg: 'dark:bg-purple-900/30', darkBorder: 'dark:border-purple-800' };
                        case 3: return { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', text: 'text-[#166534]', darkBg: 'dark:bg-green-900/30', darkBorder: 'dark:border-green-800' };
                        case 4: return { bg: 'bg-[#fefce8]', border: 'border-[#fef08a]', text: 'text-[#854d0e]', darkBg: 'dark:bg-yellow-900/30', darkBorder: 'dark:border-yellow-800' };
                        case 5: return { bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]', text: 'text-[#9a3412]', darkBg: 'dark:bg-orange-900/30', darkBorder: 'dark:border-orange-800' };
                        default: return { bg: 'bg-[#f5f5f4]', border: 'border-[#e7e5e4]', text: 'text-[#44403c]', darkBg: 'dark:bg-neutral-800', darkBorder: 'dark:border-neutral-700' };
                      }
                    };

                    const activeBranchId = activeTabObj ? activeTabObj.branchRootId : null;
                    const primaryTabs = deceasedTabs.filter(t => t.id === 'root' || t.level === 1);
                    const activeSubTabs = deceasedTabs.filter(t => t.level > 1 && t.branchRootId === activeBranchId);

                    const renderTab = (tab, isRootSpecial = false) => {
                      const isActive = activeDeceasedTab === tab.id;
                      const s = getLevelStyle(tab.level);
                      const isSub = tab.level > 1;
                      
                      return (
                        <button
                          key={tab.id}
                          ref={el => tabRefs.current[tab.id] = el}
                          onClick={() => {
                            setActiveDeceasedTab(tab.id);
                            setIsFolderFocused(true);
                          }}
                          className={`rounded-r-md font-bold transition-all cursor-pointer border border-l-0 text-left overflow-hidden shadow-sm w-fit ${
                            isRootSpecial 
                              ? 'max-w-[150px] min-w-[80px] px-3 py-2 text-[13px] leading-tight mb-2' 
                              : `max-w-[74px] min-w-[40px] px-2 py-1.5 text-[10.5px] ${isSub ? 'opacity-90' : ''}`
                          } ${
                            isActive
                              ? `z-50 shadow-md ${s.bg} ${s.darkBg} ${s.border} ${s.darkBorder} ${s.text} dark:text-neutral-100 -translate-x-[1.5px]`
                              : `z-10 opacity-70 hover:opacity-100 hover:z-20 ${s.bg} ${s.darkBg} ${s.border} ${s.darkBorder} ${s.text} dark:text-neutral-100/70`
                          }`}
                        >
                          {isRootSpecial ? (
                            <div className="flex flex-col truncate">
                              <span className="truncate">최초 {tab.name}</span>
                              <span className="text-[9px] opacity-70 mt-0.5 font-medium tracking-tighter">바로가기</span>
                            </div>
                          ) : (
                            <span className="truncate block w-full">{tab.name}</span>
                          )}
                        </button>
                      );
                    };
                    
                    return (
                      <div className="flex no-print relative z-10 gap-0">
                        {/* 📂 Post-it 탭 그룹 (최적화된 계층형 레이아웃) */}
                        <div className="absolute top-[20px] left-full -ml-[1px] flex flex-col pointer-events-auto z-0 border-l border-[#e9e9e7] dark:border-neutral-700/50">
                          
                          {/* 1. 최상위 피상속인 탭 (가장 넓은 지붕) */}
                          {primaryTabs.filter(t => t.id === 'root').map(t => renderTab(t, true))}
                          
                          {/* 2. 1세대 탭 리스트 (콤팩트 유지) */}
                          <div className="flex flex-col gap-1">
                            {primaryTabs.filter(t => t.id !== 'root').map(t => {
                              const isParentOfActive = t.id === activeBranchId;
                              return (
                                <div key={t.id} className="relative w-fit">
                                  {/* 1세대 탭: 이름 길이에 따라 줄어듬 */}
                                  {renderTab(t)}
                                  
                                  {/* 하위 탭 (2세대 이상): 부모 탭 우측 끝에서 시작 (다른 1세대 탭을 밀어내지 않음) */}
                                  {isParentOfActive && activeSubTabs.length > 0 && (
                                    <div className="absolute left-full top-0 flex flex-col gap-1 ml-[1px] border-l border-[#e9e9e7]/50 dark:border-neutral-700/50 z-[60] animate-in fade-in slide-in-from-left-1 duration-200">
                                      {activeSubTabs.map(st => renderTab(st))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                        {/* 📄 폴더 콘텐츠 영역 */}
                        <div className={`relative transition-all duration-300 flex-1 ${
                          isFolderFocused 
                            ? 'bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-xl' 
                            : 'bg-transparent'
                        }`}>
                          {/* 📁 폴더 상단 액션 바 - 평면화 */}
                          <div className="flex items-center justify-between px-8 py-5 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl transition-colors">
                            <div className="flex flex-col gap-1">
                              {/* 🔙 상위 화면으로 돌아가기 (Breadcrumb Navigation) */}
                              {activeTabObj && activeTabObj.parentNode && activeDeceasedTab !== 'root' && (
                                <div className="mb-2 flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDeceasedTab(activeTabObj.parentNode.id);
                                      setIsFolderFocused(true);
                                    }}
                                    className="group flex items-center gap-1.5 text-[12px] font-bold text-neutral-400 dark:text-neutral-500 hover:text-[#2383e2] dark:hover:text-blue-400 transition-colors px-2 py-1 -ml-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  >
                                    <svg className="w-3.5 h-3.5 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                    {activeTabObj.parentNode.id === 'root' 
                                      ? `최초 피상속인(${tree.name || '이름 없음'}) 화면으로` 
                                      : `상위 상속인 (${activeTabObj.parentNode.name}) 화면으로 돌아가기`}
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[15px] font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                                  {getBriefingInfo.name}
                                  <span className="text-[13px] text-neutral-400 font-bold">{getBriefingInfo.relationInfo}</span>
                                </span>
                                <span className="flex items-center gap-1 bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 px-2 py-0.5 rounded text-[11px] font-bold tracking-tight whitespace-nowrap shadow-sm ml-2">
                                  ⚖️ {getLawEra(currentNode?.deathDate || tree.deathDate)}년 {getLawEra(currentNode?.deathDate || tree.deathDate) === '1960' ? '제정' : '개정'} 민법 적용
                                </span>
                                <span className="text-[14px] font-black text-blue-600 dark:text-blue-400 ml-3">
                                  {getBriefingInfo.isRoot ? '상속할 지분' : '상속 지분'} : {getBriefingInfo.shareStr}
                                </span>
                                {!getBriefingInfo.isRoot && currentNode?.deathDate && (
                                  <span className="text-[12px] font-bold text-[#c93f3a] dark:text-red-400 ml-2">
                                    ({formatKorDate(currentNode.deathDate)} 사망)
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4">
                                {getBriefingInfo.sources.map((src, sidx) => (
                                  <span key={sidx} className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                    {src.from} 지분 {src.d}분의 {src.n}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {/* 🍎 애플 스타일 '상속인 없음' 토글 스위치 (축소 버전) */}
                              {!isRootNode && (
                                <div className="flex items-center gap-1.5 mr-1 bg-[#f7f7f5] dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700 px-2.5 py-1 rounded-full shadow-none hover:border-neutral-300 transition-colors">
                                  <span 
                                    className={`text-[11.5px] font-bold transition-colors select-none cursor-pointer ${currentNode.isExcluded ? 'text-[#37352f] dark:text-neutral-200' : 'text-[#787774]'}`}
                                    onClick={() => {
                                      const nextVal = !currentNode.isExcluded;
                                      handleUpdate(currentNode.id, 'isExcluded', nextVal);
                                      if (nextVal) {
                                        const defaultOption = currentNode.isDeceased ? 'no_heir' : 'renounce';
                                        handleUpdate(currentNode.id, 'exclusionOption', defaultOption);
                                      }
                                    }}
                                  >
                                    상속인 없음(제외)
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={currentNode.isExcluded || false}
                                    onClick={() => {
                                      const nextVal = !currentNode.isExcluded;
                                      handleUpdate(currentNode.id, 'isExcluded', nextVal);
                                      if (nextVal) {
                                        const defaultOption = currentNode.isDeceased ? 'no_heir' : 'renounce';
                                        handleUpdate(currentNode.id, 'exclusionOption', defaultOption);
                                      }
                                    }}
                                    className={`relative inline-flex h-4 w-7 items-center shrink-0 cursor-pointer rounded-full border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      currentNode.isExcluded ? 'bg-[#37352f] dark:bg-neutral-300' : 'bg-neutral-300 dark:bg-neutral-600'
                                    }`}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                                        currentNode.isExcluded ? 'translate-x-3' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>
                              )}
                              {!isRootNode && isSp && (
                                <button type="button" onClick={handleAutoFill} className="text-[12px] text-[#37352f] dark:text-neutral-200 font-bold bg-white hover:bg-[#f7f7f5] dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 shadow-none">
                                  <IconFolderOpen className="w-3 h-3 mr-1.5 opacity-60" /> 불러오기
                                </button>
                              )}
                              <button 
                                type="button"
                                onClick={() => {
                                  if (isMainQuickActive) {
                                    setIsMainQuickActive(false);
                                  } else {
                                    setIsMainQuickActive(true);
                                    setIsFolderFocused(true);
                                    setTimeout(() => {
                                      const input = document.querySelector('input[placeholder*="한꺼번에"]');
                                      if (input) input.focus();
                                    }, 100);
                                  }
                                }}
                                className="text-[12px] text-[#37352f] dark:text-neutral-200 font-bold bg-white hover:bg-[#f7f7f5] dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 shadow-none gap-1.5"
                              >
                                <IconUserPlus className="w-3 h-3 opacity-60" /> 상속인 입력
                              </button>
                            </div>
                          </div>

                          {/* 📄 폴더 내부 */}
                          <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
                            {isMainQuickActive && (
                              <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">
                                      상속인 이름을 쉼표(,)로 구분하여 한꺼번에 입력하세요
                                    </div>
                                    <button
                                      onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }}
                                      className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors"
                                      title="닫기"
                                    >
                                      <IconX className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={mainQuickVal}
                                      onChange={e => setMainQuickVal(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal);
                                          setIsMainQuickActive(false);
                                          setMainQuickVal('');
                                        }
                                        if (e.key === 'Escape') { setIsMainQuickActive(false); setMainQuickVal(''); }
                                      }}
                                      placeholder="예: 홍길동, 김철수, 이영희"
                                      className="flex-1 text-[13px] border border-[#e9e9e7] dark:border-neutral-700 rounded-md px-3 py-1.5 outline-none focus:border-[#d4d4d4] bg-white dark:bg-neutral-900 dark:text-neutral-200 transition-all font-medium text-[#37352f]"
                                    />
                                    <button
                                      onClick={() => {
                                        handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal);
                                        setIsMainQuickActive(false);
                                        setMainQuickVal('');
                                      }}
                                      className="px-4 py-1.5 bg-white dark:bg-neutral-800 hover:bg-[#efefed] dark:hover:bg-neutral-700 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 text-[13px] font-bold rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                    >
                                      일괄 등록
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 📋 엑셀 스타일 컬럼 헤더 (HeirRow와 너비 100% 동기화) */}
                            {nodeHeirs.length > 0 && (
                              <div className="flex items-center px-2 py-2 mb-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-md border border-[#e9e9e7] dark:border-neutral-700 text-[12px] font-bold text-[#787774] dark:text-neutral-400 select-none animate-in fade-in duration-300 w-full overflow-hidden">
                                <div className="w-[68px] shrink-0 text-center ml-[10px]">상태</div>
                                <div className="w-[72px] shrink-0 text-center ml-[50px]">성명</div>
                                <div className="w-[96px] shrink-0 text-center ml-[30px]">관계</div>
                                <div className="w-[150px] shrink-0 text-center ml-[30px]">사망여부/일자</div>
                                <div className="w-[180px] shrink-0 text-center ml-[10px] relative">
                                  <span className="relative left-[20px]">특수조건 (가감산)</span>
                                </div>
                                <div className="w-[180px] shrink-0 text-center ml-[10px] relative">
                                  <span className="whitespace-nowrap relative left-[20px]">재/대습상속</span>
                                </div>
                                <div className="w-12 shrink-0 text-center ml-0 mr-[10px]">
                                  <span className="whitespace-nowrap">삭제</span>
                                </div>
                              </div>
                            )}

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                              <SortableContext items={nodeHeirs.map(h => h.id)} strategy={verticalListSortingStrategy}>
                                <div className={`space-y-1.5 transition-all duration-300`}>
                                  {nodeHeirs.map(h => (
                                    <HeirRow
                                      key={h.id}
                                      node={h}
                                      level={1}
                                      handleUpdate={handleUpdate}
                                      removeHeir={removeHeir}
                                      addHeir={addHeir}
                                      siblings={nodeHeirs}
                                      inheritedDate={currentNode?.deathDate || tree.deathDate}
                                      rootDeathDate={tree.deathDate}
                                      onKeyDown={handleKeyDown}
                                      toggleSignal={inputToggleSignal}
                                      rootIsHoju={tree.isHoju !== false}
                                      showSubHeirs={false}
                                      isRootChildren={activeDeceasedTab === 'root'}
                                      onTabClick={(id) => {
                                        setActiveDeceasedTab(id);
                                        setIsFolderFocused(true);
                                      }}
                                    />
                                  ))}
                                  {(() => {
                                    if (nodeHeirs.length > 0) return null;
                                    
                                    let potentialHeirsStr = '';
                                    let potentialHeirsLabel = '';
                                    
                                    const parentDeathDate = activeTabObj && activeTabObj.parentNode ? 
                                        (activeTabObj.parentNode.id === 'root' ? tree.deathDate : activeTabObj.parentNode.deathDate) : tree.deathDate;
                                    const isPreDeceasedContext = currentNode?.deathDate && parentDeathDate && isBefore(currentNode.deathDate, parentDeathDate);

                                    if (isPreDeceasedContext && ['son', 'daughter', 'sibling'].includes(currentNode?.relation)) {
                                        potentialHeirsLabel = '대습상속 불가';
                                    } else if (activeTabObj && activeTabObj.parentNode) {
                                      const parentHeirs = activeTabObj.parentNode.heirs || [];
                                      const relation = currentNode?.relation || '';
                                      
                                      if (relation === 'wife' || relation === 'husband') {
                                        const children = parentHeirs.filter(s => s.relation === 'son' || s.relation === 'daughter');
                                        const names = children.map(c => c.name || '(이름없음)');
                                        if (names.length > 0) {
                                          potentialHeirsLabel = '피대습자의 자녀';
                                          potentialHeirsStr = names.join(', ');
                                        }
                                      } else if (relation === 'son' || relation === 'daughter') {
                                        const siblings = parentHeirs.filter(s => s.id !== currentNode.id && (s.relation === 'son' || s.relation === 'daughter'));
                                        const names = siblings.map(c => c.name || '(이름없음)');
                                        if (names.length > 0) {
                                          potentialHeirsLabel = '형제자매';
                                          potentialHeirsStr = names.join(', ');
                                        }
                                      }
                                    }

                                    return (
                                        <div className="py-20 text-center flex flex-col items-center gap-4 text-[#a3a3a3] dark:text-neutral-500 bg-[#fbfbfb] dark:bg-neutral-800/20 border-2 border-dashed border-[#e9e9e7] dark:border-neutral-700/50 rounded-lg">
                                            <IconUserPlus className="w-12 h-12 opacity-20 mb-2" />
                                            <p className="text-[14px] font-bold text-neutral-400">아직 등록된 상속인이 없습니다.</p>
                                            
                                            {activeDeceasedTab !== 'root' && (
                                                <div className="mt-2 flex flex-col items-center gap-1.5 opacity-80">
                                                    <p className="text-[13px] font-medium text-[#b45309] dark:text-amber-500/80">
                                                        {potentialHeirsLabel === '피대습자의 자녀' 
                                                            ? '별도의 상속인을 입력하지 않으면 공동 상속인인 자녀(피상속인의 직계비속)를 상속인으로 간주하여 상속지분을 자동으로 계산합니다.' 
                                                            : potentialHeirsLabel === '대습상속 불가'
                                                            ? '대습상속의 경우 미혼이거나 무자녀라면 상단의 [상속인 없음(제외)] 스위치를 켜서 제외 처리를 해주세요.'
                                                            : '상속인을 입력하지 않으면 2순위(직계존속)를 우선하며, 직계존속 부재 시 3순위(형제자매)가 상속하는 것으로 계산합니다.'}
                                                    </p>
                                                    {potentialHeirsStr && potentialHeirsLabel !== '대습상속 불가' && (
                                                        <p className="text-[13px] font-bold text-[#b45309] dark:text-amber-500 mt-1">
                                                            [{potentialHeirsLabel === '피대습자의 자녀' ? '공동 상속인인 자녀' : potentialHeirsLabel}] {potentialHeirsStr}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                  })()}
                                </div>
                              </SortableContext>
                            </DndContext>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}


          {activeTab === 'tree' && (
            <div className="py-2 flex flex-col h-full animate-in fade-in duration-300">
              <div className="mb-5 p-4 bg-[#f8f8f7] dark:bg-neutral-800/50 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg text-[#787774] dark:text-neutral-300 text-[14px] font-semibold flex justify-between items-center no-print transition-colors shadow-none">
                <div className="flex items-center gap-2">
                  <IconNetwork className="w-5 h-5 shrink-0 opacity-50" />
                  <span>이름을 클릭하여 하위 상속인(배우자/자녀) 관계도를 접거나 펼쳐서 확인하실 수 있습니다.</span>
                </div>
                <button onClick={() => {
                  const next = Math.abs(treeToggleSignal) + 1;
                  setTreeToggleSignal(isAllExpanded ? -next : next);
                  setIsAllExpanded(!isAllExpanded);
                }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-[#d4d4d4] dark:border-neutral-600 hover:bg-[#efefed] dark:hover:bg-neutral-700 text-[#37352f] dark:text-neutral-200 rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap">
                  {isAllExpanded ? '모두 접기' : '모두 펼치기'}
                </button>
              </div>
              <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 shadow-sm overflow-hidden transition-colors">
                <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
              </div>
            </div>
          )}

          {/* 공통 기본정보 헤더 (미니멀 텍스트) */}
          {(activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary') && (
            <div className="w-full mb-6 pb-3 border-b border-[#e9e9e7] dark:border-neutral-700 text-[13px] text-[#504f4c] dark:text-neutral-400 flex flex-wrap gap-8 no-print">
              <span>사건번호: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.caseNo || '미입력'}</span></span>
              <span>피상속인: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.name || '미입력'}</span></span>
              <span>사망일자: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.deathDate || '미입력'}</span></span>
              <span>적용법령: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{getLawEra(tree.deathDate)}년 민법</span></span>
            </div>
          )}

          {activeTab === 'calc' && (
            <section className="w-full text-[#37352f] dark:text-neutral-200">
              <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
                ※ 피상속인부터 시작하여 각 대습/재상속 발생 시점마다 지분이 산출된 계산 흐름표입니다.
              </div>
              <div className="space-y-6 print-mt-4">
                {calcSteps.map((s, i) => (
                  <div key={'p-s'+i}>
                    <div className="mb-2 text-[13px] text-[#504f4c] dark:text-neutral-300">
                      [STEP {i+1}] <span className="font-medium text-[#37352f] dark:text-neutral-100">망 {s.dec.name}</span> ({formatKorDate(s.dec.deathDate)} 사망) ─ 분배 지분: {s.inN}/{s.inD}
                      {s.mergeSources && s.mergeSources.length > 1 && (
                        <span className="text-[#787774]">
                          {` (= ${s.mergeSources.map(src => `${src.from} ${src.d}분의 ${src.n}`).join(' + ')})`}
                        </span>
                      )}
                    </div>
                    <table className="w-full border-collapse text-[13px]">
                      <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                        <tr>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[15%] text-[#787774] dark:text-neutral-400">성명</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[12%] text-[#787774] dark:text-neutral-400">관계</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[25%] text-[#787774] dark:text-neutral-400">계산식</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[18%] text-[#787774] dark:text-neutral-400">계산된 지분</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-left w-[30%] pl-4 text-[#787774] dark:text-neutral-400">비고 (사유)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.dists.map((d, di) => {
                          const isSpecial = d.mod && d.mod.length > 0;
                          const hasDeathInfoInEx = d.ex && (d.ex.includes('사망') || d.ex.includes('선사망'));
                          
                          let memo = [];
                          if (d.ex) memo.push(`상속권 없음(${d.ex})`);
                          if (d.h.isDeceased && !hasDeathInfoInEx) memo.push('망인');
                          if (isSpecial) memo.push(...d.mod.split(',').map(m => m.trim()));
                          
                          return (
                            <tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">
                                {d.h.name}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">
                                {getRelStr(d.h.relation, s.dec.deathDate) || '상속인'}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">
                                {s.inN}/{s.inD} × {d.sn}/{d.sd}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">
                                {d.n}/{d.d}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-left pl-4 text-[#787774]">
                                {memo.join(', ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'result' && (() => {
            const heirMap = new Map();
            calcSteps.forEach(s => {
              s.dists.forEach(d => {
                if (d.n > 0) {
                  const key = d.h.personId; 
                  if (!heirMap.has(key)) {
                    heirMap.set(key, { name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
                  }
                  heirMap.get(key).sources.push({ decName: s.dec.name, n: d.n, d: d.d });
                }
              });
            });
            const results = Array.from(heirMap.values()).filter(r => !r.isDeceased);

            return (
              <section className="w-full text-[#37352f] dark:text-neutral-200">
                <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
                  ※ 최종 생존 상속인 기준으로 승계받은 지분들을 합산한 검증표입니다.
                </div>
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">최종 상속인</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[60%] text-[#787774]">지분 취득 내역 (합산식)</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">최종 합계 지분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const total = r.sources.reduce((acc, s) => {
                        const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                        return { n: nn, d: nd };
                      }, { n: 0, d: 1 });
                      
                      const sourceText = r.sources.map(s => `${s.n}/${s.d} (망 ${s.decName})`).join('  +  ');

                      return (
                        <tr key={i} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                          <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                            {r.name} <span className="text-[#787774] font-normal ml-1">[{getRelStr(r.relation, tree.deathDate)}]</span>
                          </td>
                          <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center text-[#787774]">
                            {sourceText}
                          </td>
                          <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                            {total.n} / {total.d}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })()}

          {activeTab === 'summary' && (() => {
            const shareByPersonId = new Map();
            (finalShares.direct || []).forEach(s => shareByPersonId.set(s.personId, s));
            (finalShares.subGroups || []).forEach(g => g.shares.forEach(s => shareByPersonId.set(s.personId, s)));

            const calculateTotalSum = () => {
              let tn = 0, td = 1;
              const collectFinalShares = (nodes) => {
                nodes.forEach(s => {
                  if (s && s.n > 0) {
                    const [nn, nd] = math.add(tn, td, s.n, s.d);
                    tn = nn; td = nd;
                  }
                });
              };
              collectFinalShares(finalShares.direct || []);
              (finalShares.subGroups || []).forEach(g => collectFinalShares(g.shares || []));
              return math.simplify(tn, td);
            };

            const [totalSumN, totalSumD] = calculateTotalSum();
            const targetN = tree.shareN || 1;
            const targetD = tree.shareD || 1;
            const [simpleTargetN, simpleTargetD] = math.simplify(targetN, targetD);
            const isMatch = totalSumN === simpleTargetN && totalSumD === simpleTargetD;

            const getMismatchReasons = (rootNode) => {
              const reasons = [];
              const rootDeathDate = rootNode.deathDate;

              if (!rootNode.heirs || rootNode.heirs.length === 0) {
                reasons.push("입력된 상속인이 없어 분배할 지분이 계산되지 않았습니다.");
              }

              const scanMissingHeirs = (n) => {
                if (n.id !== 'root') {
                  const isRootSpouse = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(n.relation);
                  const isPreDeceasedSpouse = isRootSpouse && n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);
                  const isPreDeceasedContext = n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);

                  const requiresHeirsIfExcluded = n.isExcluded && ['lost', 'disqualified'].includes(n.exclusionOption);
                  const requiresHeirsIfDeceased = !n.isExcluded && n.isDeceased && !isPreDeceasedSpouse && isPreDeceasedContext;

                  if ((requiresHeirsIfDeceased || requiresHeirsIfExcluded) && (!n.heirs || n.heirs.length === 0)) {
                    if (requiresHeirsIfDeceased) {
                      reasons.push(`망 ${n.name}(${getRelStr(n.relation, rootDeathDate)})의 대습상속인이 누락되었습니다. (미혼/무자녀인 경우 '상속권 없음' 토글 켜기)`);
                    } else {
                      reasons.push(`${n.name}의 상속권 상실/결격에 따른 대습상속인이 누락되었습니다.`);
                    }
                  }
                }

                // 💡 수정 코드: 포기/없음 상태면 하위 순회 및 누락 에러 표시 안 함
                if (n.isExcluded && (n.exclusionOption === 'no_heir' || n.exclusionOption === 'renounce' || !n.exclusionOption)) return;

                if (n.heirs) n.heirs.forEach(scanMissingHeirs);
              };
              
              if (rootNode.heirs && rootNode.heirs.length > 0) {
                scanMissingHeirs(rootNode);
              }

              if (reasons.length === 0) {
                 if (totalSumN === 0) {
                   reasons.push("💡 현재 모든 상속인이 '상속포기' 또는 '상속권 없음' 상태입니다.");
                   reasons.push("민법 제1000조에 따라 차순위 상속인(직계존속 또는 형제자매)을 상속인 입력 창에 새로 추가하여 지분을 분배해 주세요.");
                 } else {
                   reasons.push("지분 일부가 '상속권 없음(소멸)' 처리되어 전체 합계가 피상속인 지분에 미달합니다.");
                   reasons.push("지분을 공동상속인끼리 나누어 갖게 하려면 제외 사유를 '상속포기'로 변경해 주세요.");
                 }
              }
              
              return Array.from(new Set(reasons));
            };

            const mismatchReasons = !isMatch ? getMismatchReasons(tree) : [];

            const printedPersonIds = new Set();

            const buildGroups = (node, parentDeathDate) => {
              const directShares = [];
              const subGroups = [];
              const seenInThisGroup = new Set();

              (node.heirs || []).forEach(h => {
                if (seenInThisGroup.has(h.personId)) return;
                seenInThisGroup.add(h.personId);

                if (!h.isDeceased) {
                  const s = shareByPersonId.get(h.personId);
                  if (s && s.n > 0 && !printedPersonIds.has(h.personId)) {
                    directShares.push(s);
                    printedPersonIds.add(h.personId);
                  }
                } else {
                  const type = (h.deathDate && isBefore(h.deathDate, parentDeathDate)) ? '대습상속' : '재상속';
                  const child = buildGroups(h, h.deathDate || parentDeathDate);
                  if (child.directShares.length > 0 || child.subGroups.length > 0) {
                    subGroups.push({ ancestor: h, type, ...child });
                  }
                }
              });
              return { directShares, subGroups };
            };

            const topDirect = [];
            const topGroups = [];
            const topSeen = new Set();
            
            (tree.heirs || []).forEach(h => {
              if (topSeen.has(h.personId)) return;
              topSeen.add(h.personId);

              if (!h.isDeceased) {
                const s = shareByPersonId.get(h.personId);
                if (s && s.n > 0 && !printedPersonIds.has(h.personId)) {
                  topDirect.push(s);
                  printedPersonIds.add(h.personId);
                }
              } else {
                const type = (h.deathDate && isBefore(h.deathDate, tree.deathDate)) ? '대습상속' : '재상속';
                const child = buildGroups(h, h.deathDate || tree.deathDate);
                if (child.directShares.length > 0 || child.subGroups.length > 0) {
                  topGroups.push({ ancestor: h, type, ...child });
                }
              }
            });

            const renderShareRow = (f, depth) => {
              const pl = `${12 + (depth > 0 ? 16 : 0)}px`; 
              return (
                <tr key={'sr-'+f.id} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                  <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left font-medium" style={{paddingLeft: pl}}>
                    {f.name} <span className="text-[#787774] font-normal ml-1">[{getRelStr(f.relation, tree.deathDate)}]</span>
                  </td>
                  <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center text-[#504f4c]">{f.n} / {f.d}</td>
                  <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{f.un} / {f.ud}</td>
                  {isAmountActive && (
                    <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-right">
                      {formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}
                    </td>
                  )}
                </tr>
              );
            };

            const renderGroup = (group, depth) => {
              const heirTypeStr = group.type === '대습상속' ? '대습상속인' : '상속인';
              const reasonText = `${formatKorDate(group.ancestor.deathDate)} 공동상속인 중 ${group.ancestor.name}은(는) 사망하였으므로 그 ${heirTypeStr}`;
              
              return (
                <React.Fragment key={'grp-'+group.ancestor.id}>
                  <tr className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <td colSpan={isAmountActive ? 4 : 3} className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[#504f4c] dark:text-neutral-400 pl-4">
                      ※ {reasonText}
                    </td>
                  </tr>
                  {group.directShares.map(f => renderShareRow(f, depth + 1))}
                  {group.subGroups.map(sg => renderGroup(sg, depth + 1))}
                </React.Fragment>
              );
            };

            return (
              <div className="w-full text-[#37352f] dark:text-neutral-200">
                <div className="mb-4 flex items-center justify-between no-print">
                  <div className="text-[13px] text-[#787774]">
                    ※ 등기신청서 작성 등에 활용할 수 있는 일렬 종대 형식의 최종 지분 요약표입니다.
                  </div>
                  <div className="flex items-center gap-3">
                     <label className="flex items-center gap-1.5 cursor-pointer text-[13px] text-[#504f4c]">
                       <input type="checkbox" checked={isAmountActive} onChange={(e) => { setIsAmountActive(e.target.checked); if (!e.target.checked) setPropertyValue(''); }} className="w-3.5 h-3.5 accent-neutral-500" />
                       금액 계산 포함
                     </label>
                     {isAmountActive && (
                       <input type="text" value={formatMoney(propertyValue)} onChange={(e) => setPropertyValue(e.target.value.replace(/[^0-9]/g, ''))} className="w-32 px-2.5 py-1.5 border border-[#e9e9e7] bg-transparent text-right outline-none text-[13px] rounded-md focus:bg-neutral-50" placeholder="상속재산 입력" />
                     )}
                  </div>
                </div>

                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">상속인 성명</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">최종 지분 (통분 전)</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">최종 지분 (통분 후)</th>
                      {isAmountActive && <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">상속 금액(원)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {topDirect.map(f => renderShareRow(f, 0))}
                    {topGroups.map(g => renderGroup(g, 0))}
                  </tbody>
                  <tfoot className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-right font-medium text-[#787774]">합계 검증</td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                        {totalSumN} / {totalSumD}
                      </td>
                      <td colSpan={isAmountActive ? 2 : 1} className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[12.5px]">
                        {isMatch ? (
                          <span className="text-[#504f4c]">✔️ 피상속인 지분과 일치 ({simpleTargetN}/{simpleTargetD})</span>
                        ) : (
                          <span className="text-red-500 font-bold">⚠️ 지분 합계 불일치 (아래 안내 참조)</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* 💡 표 바깥으로 분리된 불일치 경고 메시지 영역 */}
                {!isMatch && mismatchReasons.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 dark:text-red-400 font-bold text-[14px]">⚠️ 상속 지분 배분 안내</span>
                    </div>
                    <ul className="list-disc pl-5 text-[#c93f3a] dark:text-red-400 space-y-1.5 text-[13px] font-medium leading-relaxed">
                      {mismatchReasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>

        {/* 위로 가기 버튼 */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white/20 dark:border-neutral-700/30 text-[#2383e2] dark:text-blue-400 px-5 py-2.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-bold no-print"
          >
            <span className="text-[16px]">↑</span> 맨 위로
          </button>
        )}
      </div>
    </main>
  </div>
);
}

export default App;
