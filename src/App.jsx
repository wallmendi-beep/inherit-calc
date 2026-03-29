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

const MiniTreeView = ({ node, level = 0, onSelectNode, visitedHeirs = new Set(), deathDate }) => {
  const [isExpanded, setIsExpanded] = React.useState(level === 0); // 루트는 기본 확장
  if (!node) return null;
  
  // 🎨 상태별 스타일 정의 (사용자 커스텀)
  const getStatusStyle = (isDead, hasSubHeirs) => {
    let colorClass = 'text-[#2563eb] dark:text-blue-400 font-medium'; // 기본 상속인 (파란색, 미디엄 두께)
    if (isDead) colorClass = 'text-[#37352f] dark:text-neutral-100 font-bold'; // 사망자 (검정, 볼드 두께)
    
    let underlineClass = '';
    if (hasSubHeirs) underlineClass = 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4'; // 하위 존재 시 빨간색 언더라인 (2px로 조정)
    
    return `${colorClass} ${underlineClass}`;
  };

  const hasHeirs = node.heirs && node.heirs.length > 0;
  const itemStyleClass = getStatusStyle(node.isDeceased, hasHeirs);

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
        {level > 0 && <span className={`text-[10px] font-bold shrink-0 opacity-40 uppercase tracking-tighter ${node.isDeceased ? 'text-[#ef4444]' : 'text-[#787774]'}`}>[{getRelStr(node.relation, deathDate) || '자녀'}]</span>}
      </div>
      
      {isExpanded && hasHeirs && (
        <div className="border-l border-[#e9e9e7] dark:border-neutral-700 ml-1.5 pl-1.5 pb-1 transition-colors">
          {node.heirs.map((h, i) => (
            <MiniTreeView key={h.id || i} node={h} level={level + 1}
              onSelectNode={onSelectNode}
              visitedHeirs={visitedHeirs}
              deathDate={deathDate}
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

  const tree = useMemo(() => {
    const seenIds = new Set();
    const sanitize = (node) => {
      if (!node) return null;
      if (seenIds.has(node.id)) return null; 
      seenIds.add(node.id);
      const copy = { ...node };
      if (copy.heirs && Array.isArray(copy.heirs)) {
        copy.heirs = copy.heirs.map(sanitize).filter(Boolean);
      }
      return copy;
    };
    return sanitize(rawTree) || getInitialTree();
  }, [rawTree]);

  // 트리를 순회하여 사망한 인물들의 순서 목록 생성 (세대 레벨 포함, 중복 절대 방지) - 🚀 런타임 오류 방지를 위해 최상단으로 이동
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredNames = new Set();
    tabMap.set('root', { id: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 1 });
    if (tree.name) registeredNames.add(tree.name);
    
    const visit = (node, currentLevel) => {
      if (!node.heirs) return;
      node.heirs.forEach(h => {
        // 사망자이거나 상속권 상실/결격자인 경우 탭 생성 (대습상속 입력 필요)
        const isTarget = h.isDeceased || (h.isExcluded && (h.exclusionOption === 'lost' || h.exclusionOption === 'disqualified'));
        
        if (isTarget) {
          const isSpouseOfRoot = node.id === 'root' && (h.relation === 'wife' || h.relation === 'husband');
          const isDisqualifiedSpouse = isSpouseOfRoot && h.deathDate && tree.deathDate && isBefore(h.deathDate, tree.deathDate);
          if (!isDisqualifiedSpouse) {
            const nextLevel = (h.relation === 'wife' || h.relation === 'husband') ? currentLevel : currentLevel + 1;
            const isAnonymous = !h.name || h.name.trim() === '';
            const nameToRegister = isAnonymous ? h.id : h.name.trim();
            if (!registeredNames.has(nameToRegister)) {
              tabMap.set(h.id, { id: h.id, name: h.name || '(상속인)', node: h, parentNode: node, parentName: node.id === 'root' ? (tree.name || '피상속인') : node.name, relation: h.relation, level: nextLevel });
              registeredNames.add(nameToRegister);
              if (h.heirs && h.heirs.length > 0) visit(h, nextLevel);
            }
          }
        } else {
          visit(h, currentLevel + 1);
        }
      });
    };
    visit(tree, 1);
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
                if (n.id === id) return { ...n, name: trimmedValue, id: existingNode.id };
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

  const applyUpdate = (id, field, value, syncGlobal = false, syncName = '') => {
    const updateNode = (n) => {
      // ID가 일치하는 모든 노드를 업데이트 (동일인 연동의 핵심)
      if (n.id === id) {
         return { ...n, [field]: value };
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
    const newHeir = { id: `h_${Math.random().toString(36).substr(2, 9)}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] };
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
        // 구버전(트리) 형식: id === 'root' 또는 heirs 배열 보유
        if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
          setTree(data);
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
          className="fixed left-0 top-[54px] bottom-0 flex flex-col bg-white dark:bg-neutral-900 border-r border-[#e9e9e7] dark:border-neutral-700 z-30 no-print overflow-hidden transition-colors select-none"
          style={{ width: sidebarWidth }}
        >
          <div className="text-[13px] font-black text-[#37352f] dark:text-neutral-200 flex items-center gap-2 border-b border-[#f1f1ef] dark:border-neutral-700 px-4 py-3 shrink-0 transition-colors uppercase tracking-widest opacity-60">
            <IconNetwork className="w-3.5 h-3.5 shrink-0"/> 가계도 요약
          </div>
          {/* 트리 내용 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 pb-10 text-[13px]">
            <MiniTreeView node={tree} level={0}
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

          {activeTab === 'summary' && (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-3 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconList className="w-5 h-5"/> 최종 상속 지분 요약
              </h2>
              <table className="w-full border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 text-black">
                    <th className="border border-black py-2 px-3 text-[11pt] w-[25%] font-bold">상속인 성명</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[35%] font-bold">최종 지분 (기본)</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[40%] font-bold">최종 지분 (통분)</th>
                  </tr>
                </thead>
                <tbody>
                  {finalShares.direct?.map((f, i) => (
                    <tr key={'p-d'+i} className="text-black">
                      <td className="border border-black py-2 px-3 text-center font-bold text-[12pt]">{f.name}</td>
                      <td className="border border-black py-2 px-3 text-center">{f.n} / {f.d}</td>
                      <td className="border border-black py-2 px-3 text-center font-bold">{f.un} / {f.ud}</td>
                    </tr>
                  ))}
                  {finalShares.subGroups?.map((group, gIdx) => (
                    <React.Fragment key={'p-g'+gIdx}>
                      <tr className="bg-gray-50">
                        <td colSpan="3" className="border border-black py-1.5 px-3 text-[10pt] text-gray-700 italic">
                          ※ 공동상속인 중 [{group.ancestor.name}]은(는) {formatKorDate(group.ancestor.deathDate)} 사망하였으므로 상속인
                        </td>
                      </tr>
                      {group.shares.map((f, i) => (
                        <tr key={'p-gs'+gIdx+'-'+i} className="text-black">
                          <td className="border border-black py-2 px-3 text-center pl-6">└ {f.name}</td>
                          <td className="border border-black py-2 px-3 text-center">{f.n} / {f.d}</td>
                          <td className="border border-black py-2 px-3 text-center font-bold">{f.un} / {f.ud}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          )}

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

      {/* 💡 헤더 (리본 메뉴) - 본문과 정렬 동기화 [절대 줄바꿈 방지] */}
      <div 
        className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex transition-all duration-300 shadow-sm overflow-hidden"
      >
        <div className="w-full max-w-[1160px] min-w-[1140px] px-4 mx-0 flex items-center justify-between h-full flex-nowrap">
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
                상속지분 계산기 PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">v1.6.5</span>
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

      <main className="flex-1">

      {/* 💡 메인 컨텐츠 - 웹 브라우저 앱 스타일 중앙 캔버스 */}
      <div 
        className="flex flex-col w-full max-w-[1160px] px-4 mt-6 print-compact transition-all duration-500 print:!ml-0 print:!max-w-none relative z-10"
        style={{ 
          marginLeft: sidebarOpen ? sidebarWidth : 0
        }}
      >
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
              const clone = (n) => ({ ...n, id: `auto_${Math.random().toString(36).substr(2,9)}`, heirs: n.heirs?.map(clone) || [] });
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
                {/* 상단 기본정보 섹션 - 미니멀 개편 */}
                <div className="bg-[#fcfcfb] dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-3 flex items-center gap-6 transition-colors shadow-none">
                  <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2383e2]" />
                    <span className="text-[12px] font-black text-[#37352f] dark:text-neutral-200 uppercase tracking-widest">기본정보</span>
                  </div>
                  
                  <div className="flex flex-1 items-center gap-6 overflow-x-auto no-scrollbar">
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사건번호</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium outline-none transition-all bg-white dark:bg-neutral-900 dark:text-neutral-200" placeholder="번호 입력" />
                    </div>
                    
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">성명</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-white dark:bg-neutral-900" placeholder="이름" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#c93f3a] dark:text-red-400 font-bold whitespace-nowrap">사망일자</label>
                      <DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={v=>handleRootUpdate('deathDate', v)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium outline-none transition-all bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400" />
                    </div>

                    {getLawEra(tree.deathDate) !== '1991' && (
                      <div className="shrink-0 flex items-center gap-2">
                        <label className="text-[12px] text-[#2383e2] dark:text-blue-400 font-bold whitespace-nowrap">호주</label>
                        <input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#2383e2]" />
                      </div>
                    )}

                    <div className="shrink-0 flex items-center gap-2">
                       <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">상속할 지분</label>
                       <div className="flex items-center bg-white dark:bg-neutral-900 rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1">
                         <input type="number" min="1" value={tree.shareD || 1} onChange={e=>handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value)||1))} className="w-10 bg-transparent text-[14px] text-center font-bold outline-none dark:text-neutral-200" title="분모" />
                         <span className="text-[#787774] dark:text-neutral-500 text-[12px] font-bold mx-0.5">분의</span>
                         <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={e=>handleRootUpdate('shareN', Math.min(tree.shareD||1, Math.max(1, parseInt(e.target.value)||1)))} className="w-10 bg-transparent text-[14px] text-center font-bold outline-none dark:text-neutral-200" title="분자" />
                       </div>
                    </div>

                    <div className="ml-auto shrink-0 flex gap-2">
                    </div>
                  </div>
                </div>

                {/* 폴더-탭 구조: 사망한 인물별 탭 (Filing Cabinet) */}
                <div className="transition-colors flex-1 flex flex-col">
                  {(() => {
                    const getLevelStyle = (lv) => {
                      switch(lv) {
                        case 1: return { bg: 'bg-[#eff6ff]', border: 'border-[#bfdbfe]', text: 'text-[#1e40af]', darkBg: 'dark:bg-blue-900/30', darkBorder: 'dark:border-blue-800' };
                        case 2: return { bg: 'bg-[#f5f3ff]', border: 'border-[#ddd6fe]', text: 'text-[#5b21b6]', darkBg: 'dark:bg-purple-900/30', darkBorder: 'dark:border-purple-800' };
                        case 3: return { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', text: 'text-[#166534]', darkBg: 'dark:bg-green-900/30', darkBorder: 'dark:border-green-800' };
                        case 4: return { bg: 'bg-[#fefce8]', border: 'border-[#fef08a]', text: 'text-[#854d0e]', darkBg: 'dark:bg-yellow-900/30', darkBorder: 'dark:border-yellow-800' };
                        case 5: return { bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]', text: 'text-[#9a3412]', darkBg: 'dark:bg-orange-900/30', darkBorder: 'dark:border-orange-800' };
                        default: return { bg: 'bg-[#f5f5f4]', border: 'border-[#e7e5e4]', text: 'text-[#44403c]', darkBg: 'dark:bg-neutral-800', darkBorder: 'dark:border-neutral-700' };
                      }
                    };

                    // 레이아웃 분리 로직: 15-20개 초과 시 3대부터는 옆으로
                    const shouldSplit = deceasedTabs.length > 15 && deceasedTabs.some(t => t.level >= 3);
                    const col1 = shouldSplit ? deceasedTabs.filter(t => t.level <= 2) : deceasedTabs;
                    const col2 = shouldSplit ? deceasedTabs.filter(t => t.level >= 3) : [];

                    const renderTab = (tab) => {
                      const isActive = activeDeceasedTab === tab.id;
                      const s = getLevelStyle(tab.level);
                      return (
                        <button
                          key={tab.id}
                          ref={el => tabRefs.current[tab.id] = el}
                          onClick={() => {
                            setActiveDeceasedTab(tab.id);
                            setIsFolderFocused(true);
                          }}
                          className={`px-3 py-2 rounded-r-md font-bold text-[13px] transition-all cursor-pointer border border-l-0 whitespace-nowrap text-left ${
                            isActive
                              ? `z-50 shadow-md ${s.bg} ${s.darkBg} ${s.border} ${s.darkBorder} ${s.text} dark:text-neutral-100 -translate-x-[1px]`
                              : `z-10 opacity-70 hover:opacity-100 hover:z-20 ${s.bg} ${s.darkBg} ${s.border} ${s.darkBorder} ${s.text} dark:text-neutral-100/70`
                          }`}
                        >
                          {tab.name}
                        </button>
                      );
                    };
                    
                    return (
                      <div className="flex no-print relative z-10 gap-0">
                        {/* 📂 Post-it 탭 그룹 (다단 지원) - 바짝 붙여서 배치, 좌측 여백 제거 */}
                        <div className="absolute top-[20px] left-full -ml-[1px] flex gap-0 pointer-events-auto z-0 border-l border-[#e9e9e7] dark:border-neutral-700/50">
                          <div className="flex flex-col gap-1">
                            {col1.map(renderTab)}
                          </div>
                          {col2.length > 0 && (
                            <div className="flex flex-col gap-1 border-l border-[#e9e9e7]/50 dark:border-neutral-700/50 pl-0">
                              {col2.map(renderTab)}
                            </div>
                          )}
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
                            <div className="flex items-center gap-2">
                              {!isRootNode && isSp && (
                                <button type="button" onClick={handleAutoFill} className="text-[13px] text-[#2383e2] dark:text-blue-400 font-bold bg-[#eff6ff] hover:bg-[#dbeafe] dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded transition-colors flex items-center border border-[#bfdbfe] dark:border-blue-800/50 shadow-sm">
                                  <IconFolderOpen className="w-3.5 h-3.5 mr-1.5" /> 상속인 불러오기
                                </button>
                              )}
                              <button type="button" onClick={() => addHeir(currentNode.id)} onKeyDown={handleKeyDown} className="text-[13px] text-[#166534] dark:text-green-400 font-bold bg-[#f0fdf4] hover:bg-[#dcfce7] dark:bg-green-900/20 dark:hover:bg-green-900/40 px-3 py-1.5 rounded transition-colors flex items-center border border-[#bbf7d0] dark:border-green-800/50 shadow-sm ml-1">
                                  + 상속인 추가
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsMainQuickActive(true);
                                  setIsFolderFocused(true);
                                  setTimeout(() => {
                                    const input = document.querySelector('input[placeholder*="한꺼번에"]');
                                    if (input) input.focus();
                                  }, 100);
                                }}
                                className="text-[13px] text-[#b45309] dark:text-amber-500 font-bold bg-[#fffbeb] hover:bg-[#fef3c7] dark:bg-amber-900/20 dark:hover:bg-amber-900/40 px-3 py-1.5 rounded transition-colors flex items-center border border-[#fde68a] dark:border-amber-800/50 shadow-sm gap-1.5"
                              >
                                <IconUserPlus className="w-3.5 h-3.5" /> 상속인 일괄입력
                              </button>
                            </div>
                          </div>

                          {/* 📄 폴더 내부 */}
                          <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
                            {isMainQuickActive && (
                              <div className="mb-8 p-6 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[12px] font-bold text-amber-600 dark:text-amber-500/80">
                                      상속인 이름을 쉼표(,)로 구분하여 한꺼번에 입력하세요
                                    </div>
                                    <button
                                      onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }}
                                      className="text-[#787774] dark:text-neutral-400 hover:text-[#37352f] dark:hover:text-neutral-100 p-1 rounded transition-colors"
                                      title="닫기"
                                    >
                                      <IconX className="w-4 h-4" />
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
                                      className="flex-1 text-[14px] border border-amber-200 dark:border-amber-800/50 rounded-md px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/20 bg-white dark:bg-neutral-900 dark:text-neutral-200 transition-all"
                                    />
                                    <button
                                      onClick={() => {
                                        handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal);
                                        setIsMainQuickActive(false);
                                        setMainQuickVal('');
                                      }}
                                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[14px] font-black rounded-md transition-all shadow-md active:scale-95"
                                    >
                                      일괄 등록
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 📋 엑셀 스타일 컬럼 헤더 (HeirRow와 너비 100% 동기화) */}
                            {nodeHeirs.length > 0 && (
                              <div className="flex items-center px-2 py-2 mb-2 bg-[#f8f8f7] dark:bg-neutral-800/50 rounded-md border border-[#e5e5e5] dark:border-neutral-700 text-[13px] font-bold text-[#787774] dark:text-neutral-400 select-none animate-in fade-in duration-300">
                                <div className="w-[90px] flex justify-start shrink-0 pl-[53px]">상태</div>
                                <div className="w-28 pl-[28px] shrink-0">성명</div>
                                <div className="w-24 pl-[28px] shrink-0">관계</div>
                                <div className="w-[140px] pl-[43px] shrink-0">사망여부 및 일자</div>
                                <div className="flex-1 pl-[51px] shrink-0">특수조건 (가감산 등)</div>
                                <div className="w-28 flex justify-center shrink-0">재상속/대습상속</div>
                                <div className="w-20 flex justify-end shrink-0 pr-2">
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if(confirm('모든 상속인 데이터를 삭제하시겠습니까?')) {
                                        if(currentNode.id === 'root') setTree({ ...tree, heirs: [] });
                                        else handleUpdate(currentNode.id, 'heirs', []);
                                      }
                                    }} 
                                    className="text-[11px] text-red-500 hover:text-red-700 px-2 py-0.5 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 rounded transition-colors font-bold"
                                  >
                                    전체 삭제
                                  </button>
                                </div>
                              </div>
                            )}

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                              <SortableContext items={nodeHeirs.map(h => h.id)} strategy={verticalListSortingStrategy}>
                                <div className={`space-y-1.5 transition-all duration-300 ${isFolderFocused ? 'p-2' : ''}`}>
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
                                    
                                    if (activeTabObj && activeTabObj.parentNode) {
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
                                                ? '별도의 상속인을 입력하지 않으면 피대습자의 자녀를 상속인으로 간주하여 상속지분을 계산합니다.' 
                                                : '상속인을 입력하지 않으면 2순위(직계존속)를 우선하며, 계모나 부재 시 3순위(형제자매)가 상속하는 것으로 계산합니다.'}
                                            </p>
                                            {potentialHeirsStr && (
                                              <p className="text-[13px] font-bold text-[#b45309] dark:text-amber-500 mt-1">
                                                [{potentialHeirsLabel}] {potentialHeirsStr}
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
            <div className="py-2 flex flex-col h-full">
              <div className="mb-5 p-3.5 bg-[#f0fdf4] dark:bg-green-900/20 border border-[#bbf7d0] dark:border-green-800/50 text-[#166534] dark:text-green-300 rounded-lg text-[14px] font-semibold flex justify-between items-center shadow-sm no-print transition-colors">
                <div className="flex items-center gap-2">
                  <IconNetwork className="w-5 h-5 shrink-0" />
                  <span>사람 이름을 클릭하면 해당 인물의 상속인(배우자/자녀)을 접거나 펼쳐서 관계도를 직관적으로 확인할 수 있습니다.</span>
                </div>
                <button onClick={() => {
                  const next = Math.abs(treeToggleSignal) + 1;
                  setTreeToggleSignal(isAllExpanded ? -next : next);
                  setIsAllExpanded(!isAllExpanded);
                }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-[#bbf7d0] dark:border-green-800/50 hover:bg-[#dcfce7] dark:hover:bg-green-800/40 text-[#166534] dark:text-green-300 rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap">
                  {isAllExpanded ? '모두 접기' : '모두 펼치기'}
                </button>
              </div>
              <div className="bg-[#fafafa] dark:bg-neutral-900/50 p-6 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 shadow-inner overflow-hidden transition-colors">
                <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
              </div>
            </div>
          )}

          {activeTab === 'calc' && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="space-y-6 print-mt-4">
                {calcSteps.map((s, i) => (
                  <div key={i} className="break-inside-avoid border border-[#e5e5e5] dark:border-neutral-700/50 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-neutral-900/40">
                    <div className="bg-[#f8f8f7] dark:bg-neutral-800/60 px-5 py-3 flex justify-between items-center transition-colors border-b border-[#e5e5e5] dark:border-neutral-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#37352f] dark:bg-neutral-400" />
                        <span className="text-[15px] font-black text-[#37352f] dark:text-neutral-200">
                          피상속인 <span className="mx-1">{s.dec.name}</span> 
                          <span className="ml-2 font-bold text-[#787774] dark:text-neutral-400 text-[13px] opacity-80">[승계 지분: {s.inN}/{s.inD}]</span>
                          {s.mergeSources && s.mergeSources.length > 1 && (
                            <span className="ml-2 text-[12px] font-bold text-[#787774] dark:text-neutral-500 opacity-80">
                              (= {s.mergeSources.map((src, si) => (
                                <React.Fragment key={si}>
                                  {si > 0 && ' + '}
                                  {src.from} {src.d}분의 {src.n}
                                </React.Fragment>
                              ))})
                            </span>
                          )}
                        </span>
                        <span className="text-[#787774] dark:text-neutral-400 font-bold text-[13px]">({s.dec.deathDate} 사망)</span>
                      </div>
                    </div>
                    <table className="w-full text-left table-fixed">
                      <thead className="bg-white dark:bg-neutral-800/40 border-b border-[#f1f1ef] dark:border-neutral-700/50">
                        <tr className="text-[#787774] dark:text-neutral-400 text-[12px] font-bold uppercase tracking-widest text-center">
                          <th className="py-2 px-5 w-[15%] text-left">상속인</th>
                          <th className="py-2 px-5 w-[45%]">산출 지분 계산식</th>
                          <th className="py-2 px-5 w-[40%] text-left">비고 (특수조건)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1ef] dark:divide-neutral-700/30">
                        {s.dists.map((d, di) => {
                          const isSpecial = d.mod && d.mod.length > 0;
                          // ⚖️ 사유 뱃지에 이미 사망 정보가 포함되어 있는지 체크
                          const hasDeathInfoInEx = d.ex && (d.ex.includes('사망') || d.ex.includes('선사망'));
                          
                          return (
                            <tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-[20px]">
                                  <span className={`text-[16px] font-bold ${d.h.isDeceased ? 'text-black dark:text-white' : 'text-[#37352f] dark:text-neutral-100'}`}>{d.h.name}</span>
                                  <span className="text-[13px] font-bold text-[#787774] dark:text-neutral-500 uppercase whitespace-nowrap">[{getRelStr(d.h.relation, s.dec.deathDate) || '상속인'}]</span>
                                </div>
                              </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="inline-flex items-center gap-2 whitespace-nowrap text-[16px] font-medium">
                                    <span className="text-[#787774] dark:text-neutral-400">{s.inN}/{s.inD}</span>
                                    <span className="text-[#a3a3a3] dark:text-neutral-500 font-normal">×</span>
                                    <span className="text-[#787774] dark:text-neutral-400">{d.sn}/{d.sd}</span>
                                    <span className="text-[#a3a3a3] dark:text-neutral-500 font-normal mx-1">=</span>
                                    <span className="text-[18px] text-[#37352f] dark:text-neutral-200 font-normal bg-[#f1f1ef] dark:bg-neutral-700 px-2 py-0.5 rounded">{d.n}/{d.d}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                <div className="flex gap-2 flex-wrap items-center">
                                  {/* 1. 상속권 없음 및 사유 (검정색 + 그레이 음영 배경 - 보통체로 변경) */}
                                  {d.ex && (
                                    <span className="text-black dark:text-white text-[13px] font-medium bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-600 shadow-sm whitespace-nowrap">
                                      상속권 없음 ({d.ex})
                                    </span>
                                  )}
                                  
                                  {/* 2. 사망 정보 (사유 뱃지에 사망 정보가 없을 때만 노출) */}
                                  {d.h.isDeceased && !hasDeathInfoInEx && (
                                    <span className="text-[#787774] dark:text-neutral-500 text-[13px] font-bold">
                                      사망 ({d.h.deathDate})
                                    </span>
                                  )}

                                  {/* 3. 특수 조건 (가감산 등) - 흰색 배경 + 80% 투명도 + 어두운 톤 색상 */}
                                  {isSpecial && (() => {
                                    const mods = d.mod.split(',').map(m => m.trim());
                                    return mods.map((mod, midx) => {
                                      let styleClass = "";
                                      let icon = null;
                                      
                                      if (mod.includes('호주')) {
                                        styleClass = "text-sky-800/80 dark:text-sky-400/80 bg-white dark:bg-neutral-900 border-sky-800/80 dark:border-sky-400/80";
                                        icon = <span className="text-[10px] mr-1 opacity-80">◆</span>;
                                      } else if (mod.includes('+') || mod.includes('가산') || mod.includes('기여')) {
                                        styleClass = "text-emerald-800/80 dark:text-emerald-400/80 bg-white dark:bg-neutral-900 border-emerald-800/80 dark:border-emerald-400/80";
                                        icon = <span className="text-[10px] mr-1 opacity-80">▲</span>;
                                      } else if (mod.includes('-') || mod.includes('감산') || mod.includes('출가') || mod.includes('수익')) {
                                        styleClass = "text-rose-800/80 dark:text-rose-400/80 bg-white dark:bg-neutral-900 border-rose-800/80 dark:border-rose-400/80";
                                        icon = <span className="text-[10px] mr-1 opacity-80">▼</span>;
                                      } else {
                                        styleClass = "text-neutral-500/80 bg-white dark:bg-neutral-900 border-neutral-500/80";
                                      }

                                      return (
                                        <span key={midx} className={`flex items-center px-2 py-0.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${styleClass}`}>
                                          {icon}{mod}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'result' && (() => {
            const heirMap = new Map();
            calcSteps.forEach(s => {
              s.dists.forEach(d => {
                if (d.n > 0) {
                  const key = d.h.id; 
                  if (!heirMap.has(key)) {
                    heirMap.set(key, { name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
                  }
                  heirMap.get(key).sources.push({ decName: s.dec.name, n: d.n, d: d.d });
                }
              });
            });
            const results = Array.from(heirMap.values()).filter(r => !r.isDeceased);

            return (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="mb-6 p-4 bg-[#f8f8f7] dark:bg-neutral-800/50 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg text-[14px] font-semibold text-[#787774] dark:text-neutral-300 flex items-center gap-2 no-print">
                  <IconCalculator className="w-5 h-5 opacity-50" />
                  <span>각 상속인이 승계받은 모든 지분을 합산하여 최종 상속분을 산출하는 과정입니다.</span>
                </div>

                {/* 📋 계산결과 헤더 (Excel 스타일) */}
                <div className="flex items-center px-5 py-2.5 mb-2 bg-[#f8f8f7] dark:bg-neutral-800/80 rounded-t-lg border border-[#e5e5e5] dark:border-neutral-700 text-[13px] font-bold text-[#787774] dark:text-neutral-400 select-none">
                  <div className="w-[18%] shrink-0">상속인</div>
                  <div className="flex-1 px-4">상속지분 구성 요소</div>
                  <div className="w-[22%] text-center shrink-0">최종 산출 지분</div>
                </div>

                <div className="space-y-1 pb-10">
                  {results.map((r, i) => {
                    const total = r.sources.reduce((acc, s) => {
                      const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                      return { n: nn, d: nd };
                    }, { n: 0, d: 1 });
                    
                    return (
                      <div key={i} className="flex items-center px-5 py-3.5 bg-white dark:bg-neutral-900/40 border border-[#f1f1ef] dark:border-neutral-700/50 hover:bg-[#fcfcfb] transition-colors">
                        {/* 1. 상속인 성명 */}
                        <div className="w-[18%] shrink-0 flex items-center gap-2">
                          <span className="text-[16px] font-bold text-[#37352f] dark:text-neutral-200">{r.name}</span>
                          <span className="text-[11px] font-bold text-[#a3a3a3] uppercase tracking-tighter">[{getRelStr(r.relation, tree.deathDate) || '상속인'}]</span>
                        </div>
                        
                        {/* 2. 구성 요소 (수식 흐름) */}
                        <div className="flex-1 px-4 flex items-center gap-2 flex-wrap">
                          {r.sources.map((s, si) => (
                            <React.Fragment key={si}>
                              {si > 0 && <span className="text-[#a3a3a3] mx-0.5 text-[13px] font-bold">+</span>}
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f8f8f7] dark:bg-neutral-800/50 rounded border border-[#eeeeee] dark:border-neutral-700/50">
                                <span className="text-[14px] font-medium text-[#37352f] dark:text-neutral-200">{s.n}/{s.d}</span>
                                <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-500">({s.decName})</span>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>

                        {/* 3. 최종 산출 지분 */}
                        <div className="w-[22%] shrink-0 flex justify-center items-center gap-2">
                          <span className="text-[#a3a3a3] text-[13px] font-bold">=</span>
                          <div className="px-2.5 py-1 bg-[#f1f1ef] dark:bg-neutral-700 rounded border border-[#e5e5e5] dark:border-neutral-600 shadow-sm min-w-[80px] text-center">
                            <span className="text-[15px] font-medium text-[#37352f] dark:text-neutral-100">{total.n} / {total.d}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {activeTab === 'summary' && (() => {
            return (
            <div className="flex flex-col h-full">
              <div className="mb-4 flex justify-end no-print">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#504f4c] dark:text-neutral-300 font-bold text-[13px] hover:text-[#37352f] dark:hover:text-neutral-100 select-none transition-colors">
                    <input type="checkbox" checked={isAmountActive} onChange={(e) => { setIsAmountActive(e.target.checked); if (!e.target.checked) setPropertyValue(''); }} className="w-4 h-4 cursor-pointer accent-[#2383e2]" />
                    금액 계산 활성화
                  </label>
                  {isAmountActive && (
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 px-3 py-1.5 rounded border border-[#cccccc] dark:border-neutral-600 shadow-sm animate-in fade-in zoom-in duration-200">
                      <span className="text-[13px] font-bold text-[#504f4c] dark:text-neutral-300">총 상속재산</span>
                      <input type="text" value={formatMoney(propertyValue)} onChange={(e) => setPropertyValue(e.target.value.replace(/[^0-9]/g, ''))} className="w-60 px-2 text-right text-[15px] font-black text-[#0b6e99] dark:text-blue-400 outline-none bg-transparent" placeholder="금액 입력" />
                      <span className="text-[13px] font-bold text-[#504f4c] dark:text-neutral-300">원</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="print-mt-4 break-inside-avoid">
                <table className="w-full text-left print-table border border-[#d4d4d4] dark:border-neutral-600">
                  <thead>
                    <tr className="print-table-top text-[#37352f] dark:text-neutral-200 text-[15px] font-bold bg-white/80 dark:bg-neutral-800/80">
                      <th className={`py-2 px-4 ${isAmountActive ? 'w-[20%]' : 'w-[30%]'} border-r border-[#d4d4d4] dark:border-neutral-600`}>상속인 성명</th>
                      <th className={`py-2 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center border-r border-[#d4d4d4] dark:border-neutral-600`}>최종 지분 (통분 전)</th>
                      <th className={`py-2 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-600' : ''}`}>최종 지분 (통분 후)</th>
                      {isAmountActive && <th className="py-2 px-4 w-[30%] text-center">상속 금액</th>}
                    </tr>
                  </thead>
                  <tbody className="text-[#37352f] dark:text-neutral-300">
                    {finalShares.direct?.map((f, i) => (
                      <tr key={'d'+i} className="border-b border-[#d4d4d4] dark:border-neutral-600 transition-colors">
                        <td className="py-1.5 px-4 font-medium text-[16px] border-r border-[#d4d4d4] dark:border-neutral-600 text-[#37352f] dark:text-neutral-100 bg-white/50 dark:bg-neutral-800/50">{f.name}</td>
                        <td className="py-1.5 px-4 text-center border-r border-[#d4d4d4] dark:border-neutral-600 font-medium text-[16px]">
                          <span>{f.n} / {f.d}</span>
                        </td>
                        <td className={`py-1.5 px-4 text-center font-medium text-[16px] ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-600' : ''}`}>{f.un} / {f.ud}</td>
                        {isAmountActive && <td className="py-1.5 px-4 text-right pr-6 font-medium text-[16px] text-[#37352f] dark:text-neutral-100 bg-[#f8f8f7] dark:bg-neutral-800">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                      </tr>
                    ))}
                    {finalShares.subGroups?.map((group, gIdx) => (
                      <React.Fragment key={'g'+gIdx}>
                        <tr className="border-b border-[#d4d4d4] dark:border-neutral-600 bg-[#37352f]/5 dark:bg-neutral-700/50 print:bg-[#f1f1ef]">
                          <td colSpan={isAmountActive ? "4" : "3"} className="py-2.5 px-4 text-[14px] font-bold text-[#504f4c] dark:text-neutral-400">※ 공동상속인 중 [{group.ancestor.name}]은(는) {formatKorDate(group.ancestor.deathDate)} 사망하였으므로 상속인</td>
                        </tr>
                        {group.shares.map((f, i) => (
                          <tr key={'gs'+gIdx+'-'+i} className="border-b border-[#d4d4d4] dark:border-neutral-700 transition-colors">
                            <td className="py-2.5 px-4 font-medium pl-10 border-r border-[#d4d4d4] dark:border-neutral-700 text-[#37352f] dark:text-neutral-100"><span className="text-[#a1a1aa] dark:text-neutral-500 mr-2">└</span>{f.name}</td>
                            <td className="py-2.5 px-4 text-center border-r border-[#d4d4d4] dark:border-neutral-700 font-medium text-[16px]">
                              <span>{f.n} / {f.d}</span>
                            </td>
                            <td className={`py-2.5 px-4 text-center font-medium text-[16px] ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-700' : ''}`}>{f.un} / {f.ud}</td>
                            {isAmountActive && <td className="py-2.5 px-4 text-right pr-6 font-medium text-[16px] text-[#37352f] dark:text-neutral-100 bg-[#f8f8f7] dark:bg-neutral-800/80">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div className="mt-8 text-[13px] text-[#787774] dark:text-neutral-400 space-y-1 text-right font-medium transition-colors">
                  <p>※ 본 계산서는 대습 및 순차 상속 법리를 기초로 산출되었습니다.</p>
                  {isAmountActive && <p className="text-[#37352f] dark:text-neutral-300 font-bold mt-2">※ 계산된 상속 금액은 원 단위 이하를 내림하여 표기하였습니다.</p>}
                </div>
              </div>
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
