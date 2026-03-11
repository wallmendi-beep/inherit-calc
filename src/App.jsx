import React, { useState, useEffect, useMemo } from 'react';
import { 
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen, 
  IconPrinter, IconNetwork, IconTable, IconList, 
  IconReset, IconFileText, IconXCircle, IconX,
  IconSun, IconMoon
} from './components/Icons';
import { DateInput } from './components/DateInput';
import HeirRow from './components/HeirRow';
import TreeReportNode from './components/TreeReportNode';
import { math, relStr, formatKorDate, formatMoney } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const MiniTreeView = ({ node, level = 0, onSelectNode, visitedHeirs = new Set() }) => {
  const [isExpanded, setIsExpanded] = React.useState(level === 0); // 루트는 기본 확장
  if (!node) return null;
  
  // 🎨 항렬별/상태별 색상 정의
  const getLevelColor = (lvl, isDead) => {
    if (isDead) return 'text-[#ef4444] dark:text-red-500 font-black';
    if (lvl === 0) return 'text-[#0ea5e9] dark:text-sky-400 font-black';
    if (lvl === 1) return 'text-[#22c55e] dark:text-green-400 font-bold';
    if (lvl === 2) return 'text-[#f97316] dark:text-orange-400 font-bold';
    return 'text-[#a855f7] dark:text-purple-400 font-bold';
  };

  const nameColorClass = getLevelColor(level, node.isDeceased);
  const hasHeirs = node.heirs && node.heirs.length > 0;

  // 중복 노출 방지 로직 (간소화 유지)
  const isDuplicate = node.name && visitedHeirs.has(node.name) && level > 0;
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
          className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded ${nameColorClass} ${hasHeirs ? 'underline underline-offset-4 decoration-current decoration-1' : ''}`}
        >
          {node.name || (level === 0 ? '피상속인' : '(이름 없음)')}
        </span>
        {level > 0 && <span className={`text-[10px] font-bold shrink-0 opacity-40 uppercase tracking-tighter ${node.isDeceased ? 'text-[#ef4444]' : 'text-[#787774]'}`}>[{relStr[node.relation] || '자녀'}]</span>}
      </div>
      
      {isExpanded && !isDuplicate && hasHeirs && (
        <div className="border-l border-[#e9e9e7] dark:border-neutral-700 ml-1.5 pl-1.5 pb-1 transition-colors">
          {node.heirs.map((h, i) => (
            <MiniTreeView key={h.id || i} node={h} level={level + 1}
              onSelectNode={onSelectNode}
              visitedHeirs={visitedHeirs}
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
  const [rawTree, setRawTree] = useState(getInitialTree());

  // 데이터 무결성 강제 확보: 중복 ID 제거 (순환 참조 및 동일 요소 반복 렌더링 방지)
  const tree = useMemo(() => {
    const seenIds = new Set();
    const sanitize = (node) => {
      // 이미 처리된 ID의 노드(객체 참조 복사본 포함)는 하위 트리 탐색을 중단하거나 필터링함
      if (!node) return null;
      if (seenIds.has(node.id)) return null; 
      seenIds.add(node.id);
      
      const copy = { ...node };
      if (copy.heirs && Array.isArray(copy.heirs)) {
        // 배열 내 중복 ID 제거 및 하위 정제
        copy.heirs = copy.heirs
          .map(sanitize)
          .filter(Boolean); // null 제거
      }
      return copy;
    };
    return sanitize(rawTree) || getInitialTree();
  }, [rawTree]);

  const setTree = setRawTree; // 하위 로직 호환성을 위해 setTree 맵핑

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [inputToggleSignal, setInputToggleSignal] = useState(0); 
  const [isInputAllExpanded, setIsInputAllExpanded] = useState(true); 
  const [propertyValue, setPropertyValue] = useState(''); 
  const [isAmountActive, setIsAmountActive] = useState(false);
  const [isFolderFocused, setIsFolderFocused] = useState(false); // 서류철 포커스 모드 (폴더 열기)
  const [mainQuickVal, setMainQuickVal] = useState('');          // 메인 입력창용 퀵 입력 값
  const [isMainQuickActive, setIsMainQuickActive] = useState(false); // 메인 입력창용 퀵 입력 활성화


  // 💡 사이드 패널 상태
  // 💡 퀵 입력 상태
  const [activeQuickId, setActiveQuickId] = useState(null);
  const [quickVal, setQuickVal] = useState('');

  // 퀵 입력 제출: 이름들을 파싱해서 상속인 추가 + 부모 노드 자동 사망 처리
  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) { setActiveQuickId(null); return; }
    const names = value.split(/[,，、\s]+/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    setTree(prev => {
      let newTree = JSON.parse(JSON.stringify(prev));

      const markDeceasedAndAdd = (node) => {
        if (node.id === parentId) {
          // 부모 노드 사망 처리
          if (!node.isDeceased) node.isDeceased = true;
          // 기존 배우자 여부 확인
          const hasSpouse = (node.heirs || []).some(h => h.relation === 'wife' || h.relation === 'husband');
          names.forEach((name, idx) => {
            const isSpouse = idx === 0 && !hasSpouse;
            const isRootFemale = parentNode.gender === 'female';
            node.heirs = node.heirs || [];
            node.heirs.push({
              id: `h_${Date.now()}_${idx}`,
              name,
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

      // 루트 노드 자체에 추가하는 경우
      if (newTree.id === parentId) {
        const hasSpouse = (newTree.heirs || []).some(h => h.relation === 'wife' || h.relation === 'husband');
        names.forEach((name, idx) => {
          const isSpouse = idx === 0 && !hasSpouse;
          const isRootFemale = newTree.gender === 'female';
          newTree.heirs = newTree.heirs || [];
          newTree.heirs.push({
            id: `h_${Date.now()}_${idx}`,
            name,
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
    setActiveQuickId(null);
    setQuickVal('');
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
      style: { activeBorder: 'border-[#2383e2]', activeText: 'text-[#2383e2]', inactiveBg: 'bg-[#eef4fb]', inactiveBorder: 'border-[#d0e2f5]', inactiveText: 'text-[#6080a0]' } 
    },
    { id: 'tree', label: '가계도', icon: <IconNetwork className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#16a34a]', activeText: 'text-[#16a34a]', inactiveBg: 'bg-[#eaf5ec]', inactiveBorder: 'border-[#cbe6d2]', inactiveText: 'text-[#5a8065]' } 
    },
    { id: 'calc', label: '계산표', icon: <IconTable className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#eab308]', activeText: 'text-[#ca8a04]', inactiveBg: 'bg-[#fef8e6]', inactiveBorder: 'border-[#fbeba6]', inactiveText: 'text-[#9c8238]' } 
    },
    { id: 'summary', label: '요약표', icon: <IconList className="w-4 h-4"/>, 
      style: { activeBorder: 'border-[#a855f7]', activeText: 'text-[#9333ea]', inactiveBg: 'bg-[#f6effa]', inactiveBorder: 'border-[#e5d4f5]', inactiveText: 'text-[#7e609c]' } 
    },
  ];
  
  const activeStyle = tabData.find(t => t.id === activeTab).style;

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsResetModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
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
    let targetName = null;
    const syncFields = ['isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    
    if (syncFields.includes(field) && field !== 'name') {
      const findNode = (n) => {
        if (n.id === id) targetName = n.name;
        if (!targetName && n.heirs) n.heirs.forEach(findNode);
      };
      findNode(tree);
      
      // 자기 자신이 아닌 동명이인이 있는지 검사
      let hasSameName = false;
      const countSameName = (n) => {
        if (n.id !== id && n.name === targetName && n.name.trim() !== '') hasSameName = true;
        if (!hasSameName && n.heirs) n.heirs.forEach(countSameName);
      };
      if (targetName && targetName.trim() !== '') countSameName(tree);

      if (hasSameName) {
        setSyncRequest({ id, name: targetName, field, value });
        return; // 팝업에서 승인/거절할 때까지 실제 업데이트 보류
      }
    }

    // 동기화 필요 없는 일반 업데이트
    applyUpdate(id, field, value, false);
  };

  const applyUpdate = (id, field, value, syncGlobal = false, syncName = '') => {
    const updateNode = (n) => {
      if (n.id === id || (syncGlobal && n.name === syncName && n.name.trim() !== '')) {
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
    const newHeir = { id: `h_${Date.now()}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] };
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

  // 📂 폴더-탭 상태: 사망한 인물별 탭 목록 생성
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
    if (!lineage || lineage.length === 0) return { pathStr: '', shareStr: '', sources: [] };

    const targetNode = lineage[lineage.length - 1];
    if (!targetNode) return { name: '', relationInfo: '', shareStr: '0', sources: [], isRoot: false };
    
    const isRoot = activeDeceasedTab === 'root';
    const name = targetNode.name || (isRoot ? '피상속인' : '(이름없음)');
    let relationInfo = '';
    
    if (isRoot) {
      relationInfo = '(피상속인)';
    } else if (lineage.length > 1) {
      const parent = lineage[lineage.length - 2];
      const rel = relStr[targetNode.relation] || '상속인';
      relationInfo = `(${parent.name || '피상속인'}의 ${rel})`;
    }

    const sourceList = [];
    let totalN = 0;
    let totalD = 1;

    if (calcSteps && Array.isArray(calcSteps)) {
      calcSteps.forEach(s => {
        const myShare = s.dists?.find(d => d.h?.name === targetNode.name && targetNode.name !== '');
        if (myShare && myShare.n > 0) {
          sourceList.push({ 
            from: s.dec?.name || '피상속인', 
            n: myShare.sn, 
            d: myShare.sd, 
            fn: myShare.n, 
            fd: myShare.d 
          });
          const [nn, nd] = (math && math.add) ? math.add(totalN, totalD, myShare.n, myShare.d) : [totalN, totalD];
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

  // 트리를 순회하여 사망한 인물들의 순서 목록 생성 (세대 레벨 포함, 중복 절대 방지)
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredNames = new Set();

    // 피상속인(root) 기본 추가
    tabMap.set('root', { id: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 1 });
    if (tree.name) registeredNames.add(tree.name);
    
    const visit = (node, currentLevel) => {
      if (!node.heirs) return;
      node.heirs.forEach(h => {
        if (h.isDeceased) {
          // 배우자(wife/husband)는 현재 노드와 동일 레벨, 나머지는 다음 레벨
          const nextLevel = (h.relation === 'wife' || h.relation === 'husband') ? currentLevel : currentLevel + 1;
          
          const isAnonymous = !h.name || h.name.trim() === '';
          const nameToRegister = isAnonymous ? h.id : h.name.trim();

          // 이름(또는 익명 식별자)이 한 번도 탭으로 등록되지 않은 경우에만 추가
          if (!registeredNames.has(nameToRegister)) {
            tabMap.set(h.id, {
              id: h.id,
              name: h.name || '(상속인)',
              node: h,
              parentNode: node,
              parentName: node.id === 'root' ? (tree.name || '피상속인') : node.name,
              relation: h.relation,
              level: nextLevel
            });
            registeredNames.add(nameToRegister);
            
            // 사망한 경우에만 하위 탐색 (독립 폴더)
            if (h.heirs && h.heirs.length > 0) {
              visit(h, nextLevel);
            }
          }
        } else {
          // 사망하지 않았더라도 그 하위(자손)에 사망자가 있을 수 있으므로 탐색
          visit(h, currentLevel + 1);
        }
      });
    };
    
    visit(tree, 1);
    return Array.from(tabMap.values());
  }, [tree]);

  // 탭 목록이 변경되면 현재 탭이 업는지 확인
  useEffect(() => {
    const tabIds = deceasedTabs.map(t => t.id);
    if (!tabIds.includes(activeDeceasedTab)) {
      setActiveDeceasedTab('root');
    }
  }, [deceasedTabs]);

  // 노드를 ID로 찾는 활용 함수
  const findNodeById = (node, id) => {
    if (node.id === id) return node;
    for (const h of (node.heirs || [])) {
      const found = findNodeById(h, id);
      if (found) return found;
    }
    return null;
  };

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
      rows.push([f.name, f.relation, f.n, f.d, f.un, f.ud]);
    });
    (finalShares.subGroups || []).forEach(g => {
      rows.push(['', `└ ${g.ancestor?.name || ''} 의 대습상속분`, '', '', '', '']);
      g.shares.forEach(f => {
        rows.push([f.name, f.relation, f.n, f.d, f.un, f.ud]);
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
    <div className="w-full min-h-screen relative flex flex-col items-center pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900">
      
      <div id="print-footer" className="hidden print:block fixed bottom-0 right-0 font-['Dancing_Script'] text-neutral-300 text-sm">
        Designed by J.H. Lee (v1.0.7)
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

                const tabIds = deceasedTabs.map(t => t.id);
                const tabNames = deceasedTabs.map(t => t.name);

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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2 text-[#37352f]">동일 인물 정보 동기화</h2>
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

      {/* 헤더 */}
      <div className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex justify-center shadow-sm transition-colors duration-200">
        <div className="w-full max-w-[1400px] px-6 flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
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
            <div className="flex items-baseline gap-2">
              <div className="flex items-center text-[#37352f] dark:text-neutral-100 font-bold text-[18px] tracking-tight">
                <IconCalculator className="w-5 h-5 mr-1.5 text-[#787774] dark:text-neutral-400" />
                상속지분 계산기 PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400">v1.0.7</span>
              </div>
              <span className="designer-sign text-[#a3a3a3] dark:text-neutral-500 text-[14px]">Designed by J.H. Lee · <span className="opacity-60">v1.0.7</span></span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-7 h-7 flex justify-center items-center rounded-full text-[#787774] hover:bg-[#efefed] dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors mr-1 focus:outline-none">
              {isDarkMode ? <IconSun className="w-4 h-4 text-amber-300" /> : <IconMoon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 bg-[#f7f7f5] dark:bg-neutral-700 px-2.5 py-1 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-2 transition-colors">
              <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">사건: <span className="text-[#37352f] dark:text-neutral-200">{tree.caseNo || '미입력'}</span></span>
              <div className="w-px h-2.5 bg-[#d4d4d4] dark:bg-neutral-600 mx-0.5"></div>
              <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">피상속인:</span>
              <span className="text-[13px] font-black text-[#0b6e99] dark:text-blue-400 whitespace-nowrap">{tree.name || '미입력'}</span>
            </div>

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
            <button onClick={handlePrint} className="text-white bg-[#2383e2] hover:bg-[#0073ea] px-3 py-1 rounded text-[12px] font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap">
              <IconPrinter className="h-3.5 w-3.5" /> 인쇄
            </button>
          </div>
        </div>
      </div>

      {/* 💡 메인 컨텐츠 - 웹 브라우저 앱 스타일 중앙 캔버스 */}
      <div 
        className="flex flex-col w-full max-w-[1280px] px-6 mt-6 print-compact transition-all duration-500 print:!ml-0 print:!max-w-none relative z-10"
        style={{ marginLeft: sidebarOpen ? sidebarWidth : 0 }}
      >
        {/* 상단 탭 (네비게이션) - 더 미니멀하고 플랫하게 */}
        <div className="flex items-end pl-2 gap-1 no-print relative z-20">
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
        <div className="border border-[#e9e9e7] dark:border-neutral-700 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:hidden min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col p-10 relative z-0 transition-colors">
          
          {activeTab === 'input' && (() => {
            const activeTabObj = deceasedTabs.find(t => t.id === activeDeceasedTab);
            const currentNode = activeTabObj ? findNodeById(tree, activeTabObj.id) : tree;
            const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
            const isRootNode = currentNode && currentNode.id === 'root';
            
            return (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
                {/* 상단 기본정보 섹션 - 미니멀 개편 */}
                <div className="bg-[#fcfcfb] dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-3 flex items-center gap-6 transition-colors shadow-none">
                  <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2383e2]" />
                    <span className="text-[12px] font-black text-[#37352f] dark:text-neutral-200 uppercase tracking-widest opacity-60">기본정보</span>
                  </div>
                  
                  <div className="flex flex-1 items-center gap-6 overflow-x-auto no-scrollbar">
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[11px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사건번호</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1 text-[13px] font-medium outline-none transition-all bg-white dark:bg-neutral-900 dark:text-neutral-200" placeholder="번호 입력" />
                    </div>
                    
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[11px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">성명</label>
                      <input type="text" onKeyDown={handleKeyDown} value={currentNode?.name || ''} onChange={e=>currentNode && handleUpdate(currentNode.id, 'name', e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1 text-[13px] font-bold text-[#2383e2] dark:text-blue-400 outline-none transition-all bg-white dark:bg-neutral-900" placeholder="이름" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[11px] text-[#c93f3a] dark:text-red-400 font-bold whitespace-nowrap">사망일자</label>
                      <DateInput value={currentNode?.deathDate || ''} onKeyDown={handleKeyDown} onChange={v=>currentNode && handleUpdate(currentNode.id, 'deathDate', v)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1 text-[12px] font-medium outline-none transition-all bg-white dark:bg-neutral-900 dark:text-neutral-200" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[11px] text-[#2383e2] dark:text-blue-400 font-bold whitespace-nowrap">호주</label>
                      <input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#2383e2]" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[11px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">지분</label>
                      <div className="flex items-center bg-white dark:bg-neutral-900 rounded border border-[#e9e9e7] dark:border-neutral-700 px-1 py-0.5">
                        <input type="number" min="1" value={currentNode?.shareD || 1} onChange={e=>handleUpdate(currentNode.id, 'shareD', Math.max(1, parseInt(e.target.value)||1))} className="w-8 bg-transparent text-[12px] text-center font-bold outline-none dark:text-neutral-200" />
                        <span className="text-[#bbb] text-[10px]">/</span>
                        <input type="number" min="1" max={currentNode?.shareD || 1} value={currentNode?.shareN || 1} onChange={e=>handleUpdate(currentNode.id, 'shareN', Math.min(currentNode.shareD||1, Math.max(1, parseInt(e.target.value)||1)))} className="w-8 bg-transparent text-[12px] text-center font-bold outline-none dark:text-neutral-200" />
                      </div>
                    </div>

                    <div className="ml-auto shrink-0">
                      <button 
                        onClick={() => {
                          setIsMainQuickActive(true);
                          setIsFolderFocused(true);
                          setTimeout(() => {
                            const input = document.querySelector('input[placeholder*="한꺼번에"]');
                            if (input) input.focus();
                          }, 100);
                        }}
                        className="bg-[#2383e2] hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-[12px] font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                      >
                        <IconUserPlus className="w-3.5 h-3.5" /> 상속인 입력
                      </button>
                    </div>
                  </div>
                </div>

                {/* 폴더-탭 구조: 사망한 인물별 탭 (Filing Cabinet) */}
                <div className="transition-colors flex-1 flex flex-col">
                  {(() => {
                    const levels = Array.from(new Set(deceasedTabs.map(t => t.level))).sort((a, b) => a - b);
                    const levelPalette = {
                      1: { activeBorder: 'border-[#2383e2]', activeText: 'text-[#2383e2]', activeBg: 'bg-white dark:bg-neutral-800', inactiveBg: 'bg-[#f0f7ff] dark:bg-neutral-800/40', inactiveBorder: 'border-[#d0e2f5] dark:border-neutral-700', inactiveText: 'text-[#5c7c9c] dark:text-neutral-500' },
                      2: { activeBorder: 'border-[#00a35c]', activeText: 'text-[#00a35c]', activeBg: 'bg-white dark:bg-neutral-800', inactiveBg: 'bg-[#f0fff4] dark:bg-neutral-800/40', inactiveBorder: 'border-[#c6f6d5] dark:border-neutral-700', inactiveText: 'text-[#4c8c64] dark:text-neutral-500' },
                      3: { activeBorder: 'border-[#f2711c]', activeText: 'text-[#d46016]', activeBg: 'bg-white dark:bg-neutral-800', inactiveBg: 'bg-[#fff5f0] dark:bg-neutral-800/40', inactiveBorder: 'border-[#ffdfba] dark:border-neutral-700', inactiveText: 'text-[#9c5a2a] dark:text-neutral-500' },
                      4: { activeBorder: 'border-[#9b51e0]', activeText: 'text-[#7e42c0]', activeBg: 'bg-white dark:bg-neutral-800', inactiveBg: 'bg-[#f8f0ff] dark:bg-neutral-800/40', inactiveBorder: 'border-[#e9d8fd] dark:border-neutral-700', inactiveText: 'text-[#7a5c9a] dark:text-neutral-500' },
                      5: { activeBorder: 'border-[#eb5757]', activeText: 'text-[#c64444]', activeBg: 'bg-white dark:bg-neutral-800', inactiveBg: 'bg-[#fff0f0] dark:bg-neutral-800/40', inactiveBorder: 'border-[#fed7d7] dark:border-neutral-700', inactiveText: 'text-[#a64d4d] dark:text-neutral-500' },
                    };
                    
                    return (
                      <div className="flex no-print relative z-10 gap-0">
                        {/* 📂 우측 수직 배치 탭 리스트 (Filing Cabinet) */}
                        <div className="fixed right-0 top-[110px] bottom-0 flex flex-col pt-10 px-0 pointer-events-none z-[70]">
                          <div className="flex flex-col gap-1 items-end pointer-events-auto">
                            {levels.map(lv => (
                              <div key={lv} className="flex flex-col items-end gap-1.5 pr-0">
                                {deceasedTabs.filter(t => t.level === lv).map((tab) => {
                                  const isActive = activeDeceasedTab === tab.id;
                                  const p = levelPalette[lv] || levelPalette[5];
                                  return (
                                    <button
                                      key={tab.id}
                                      ref={el => tabRefs.current[tab.id] = el}
                                      onClick={() => {
                                        setActiveDeceasedTab(tab.id);
                                        setIsFolderFocused(true);
                                      }}
                                      className={`px-4 py-3 rounded-l-xl font-bold text-[13px] flex items-center gap-2.5 transition-all relative cursor-pointer border-2 border-r-0 whitespace-nowrap shrink-0 shadow-lg ${
                                        isActive
                                          ? `${p.activeBg} ${p.activeBorder} ${p.activeText} -mr-[2px] z-50 scale-[1.05] translate-x-[-5px]`
                                          : `${p.inactiveBg} ${p.inactiveBorder} ${p.inactiveText} opacity-80 z-10 hover:opacity-100 hover:translate-x-[-5px]`
                                      }`}
                                    >
                                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-gray-400/50'}`} />
                                      {tab.name}
                                      <span className="ml-1 text-[9px] opacity-60 font-black tracking-tighter">{lv}대</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>

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
                                <span className="text-[15px] font-black text-neutral-800 dark:text-neutral-100">
                                  {getBriefingInfo.name}
                                  <span className="text-[13px] text-neutral-400 font-bold ml-1">{getBriefingInfo.relationInfo}</span>
                                </span>
                                <span className="text-[14px] font-black text-blue-600 dark:text-blue-400 ml-3">
                                  {getBriefingInfo.isRoot ? '상속할 지분' : '상속 지분'} : {getBriefingInfo.shareStr}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4">
                                {getBriefingInfo.sources.map((src, sidx) => (
                                  <span key={sidx} className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                    {src.from} 지분 {src.d}분의 {src.n}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {/* 닫기 버튼 제거됨 */}
                            </div>
                          </div>

                          {/* 📄 폴더 내부 */}
                          <div className="p-10 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
                            {isMainQuickActive && (
                              <div className="mb-8 p-6 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex flex-col gap-3">
                                  <div className="text-[12px] font-bold text-amber-600 dark:text-amber-500/80 flex items-center gap-2">
                                    상속인 이름을 쉼표(,)로 구분하여 한꺼번에 입력하세요
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
                                        if (e.key === 'Escape') setIsMainQuickActive(false);
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
                                      inheritedDate={currentNode.deathDate || tree.deathDate}
                                      onKeyDown={handleKeyDown}
                                      toggleSignal={inputToggleSignal}
                                      rootIsHoju={tree.isHoju !== false}
                                      showSubHeirs={false}
                                    />
                                  ))}
                                  {nodeHeirs.length === 0 && (
                                    <div className="py-20 text-center flex flex-col items-center gap-4 text-[#a3a3a3] dark:text-neutral-500">
                                      <IconUserPlus className="w-12 h-12 opacity-20" />
                                      <p className="text-[14px] font-medium italic">아직 등록된 상속인이 없습니다.</p>
                                    </div>
                                  )}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
            <div className="flex flex-col h-full">
              <div className="space-y-6 print-mt-4">
                {calcSteps.map((s, i) => (
                  <div key={i} className="break-inside-avoid border border-[#f1f1ef] dark:border-neutral-700/50 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-neutral-900/40">
                    <div className="bg-[#fcfcfb] dark:bg-neutral-800/60 px-6 py-4 flex justify-between items-center transition-colors border-b border-[#f1f1ef] dark:border-neutral-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-[15px] font-black text-[#37352f] dark:text-neutral-200">
                          피상속인 <span className="text-[#2383e2] dark:text-blue-400 mx-1">{s.dec.name}</span> 
                          <span className="ml-2 font-bold text-[#787774] dark:text-neutral-400 text-[13px] opacity-60">[지분: {s.inN}/{s.inD}]</span>
                        </span>
                        <span className="text-[#c93f3a] dark:text-red-400 font-bold text-[13px] opacity-70">({s.dec.deathDate} 사망)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* 금액 계산 UI는 요약표 탭으로 이동됨 */}
                      </div>
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40 border-b border-[#f1f1ef] dark:border-neutral-700/50">
                        <tr className="text-[#787774] dark:text-neutral-400 text-[11px] font-black uppercase tracking-widest">
                          <th className="py-3 px-6">상속인</th>
                          <th className="py-3 px-6 text-center">산출 지분</th>
                          <th className="py-3 px-6">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1ef] dark:divide-neutral-700/30">
                        {s.dists.map((d, di) => {
                          const isSpecial = d.mod && d.mod.length > 0;
                          return (
                            <tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                              <td className="px-6 py-4">
                                <span className={`text-[15px] font-black ${d.h.isDeceased ? 'text-[#787774] dark:text-neutral-500 line-through decoration-red-500/50' : 'text-[#37352f] dark:text-neutral-100'}`}>{d.h.name}</span>
                                <span className="ml-2 text-[11px] font-bold text-[#a3a3a3] dark:text-neutral-500 uppercase">[{relStr[d.h.relation] || '상속인'}]</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-black text-[17px] text-[#2383e2] dark:text-blue-400">{d.n} / {d.d}</span>
                                  <span className="text-[11px] text-[#a3a3a3] dark:text-neutral-500 font-bold whitespace-nowrap">(= {s.inN}/{s.inD} × {d.sn}/{d.sd})</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                  {d.ex ? (
                                    <span className="text-[#c93f3a] dark:text-red-400 text-[12px] font-black px-2 py-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded inline-block">{d.ex}</span>
                                  ) : isSpecial ? (
                                    <span className={`text-[11px] font-black px-2 py-1 rounded border inline-block whitespace-nowrap ${
                                      d.mod.includes('호주') ? 'text-[#1d4ed8] dark:text-blue-300 bg-[#f0f7ff] dark:bg-blue-900/20 border-[#bae6fd] dark:border-blue-800/40' :
                                      d.mod.includes('출가녀') ? 'text-[#b91c1c] dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40' :
                                      d.mod.includes('가산') ? 'text-[#166534] dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/40' :
                                      'text-[#4c4c4c] dark:text-neutral-300 bg-gray-50 dark:bg-neutral-800/40 border-gray-200 dark:border-neutral-700'
                                    }`}>
                                      ※ {d.mod}
                                    </span>
                                  ) : null}
                                  {d.h.isDeceased && <span className="text-[#c93f3a] dark:text-red-400 text-[10px] font-bold">({d.h.deathDate} 사망)</span>}
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

          {activeTab === 'summary' && (
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
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[20%]' : 'w-[30%]'} border-r border-[#d4d4d4] dark:border-neutral-600`}>상속인 성명</th>
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center border-r border-[#d4d4d4] dark:border-neutral-600`}>최종 지분 (통분 전)</th>
                      <th className={`py-3 px-4 ${isAmountActive ? 'w-[25%]' : 'w-[35%]'} text-center ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-600' : ''}`}>최종 지분 (통분 후)</th>
                      {isAmountActive && <th className="py-3 px-4 w-[30%] text-center">상속 금액</th>}
                    </tr>
                  </thead>
                  <tbody className="text-[#37352f] dark:text-neutral-300">
                    {finalShares.direct?.map((f, i) => (
                      <tr key={'d'+i} className="border-b border-[#d4d4d4] dark:border-neutral-600 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-[16px] border-r border-[#d4d4d4] dark:border-neutral-600 text-[#0b6e99] dark:text-blue-400 bg-white/50 dark:bg-neutral-800/50">{f.name}</td>
                        <td className="py-2.5 px-4 text-center border-r border-[#d4d4d4] dark:border-neutral-600 font-bold text-[16px]">{f.n} / {f.d}</td>
                        <td className={`py-2.5 px-4 text-center font-bold text-[16px] ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-600' : ''}`}>{f.un} / {f.ud}</td>
                        {isAmountActive && <td className="py-2.5 px-4 text-right pr-6 font-black text-[16px] text-[#0b6e99] dark:text-blue-400 bg-[#eff6ff] dark:bg-blue-900/20">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                      </tr>
                    ))}
                    {finalShares.subGroups?.map((group, gIdx) => (
                      <React.Fragment key={'g'+gIdx}>
                        <tr className="border-b border-[#d4d4d4] dark:border-neutral-600 bg-[#37352f]/5 dark:bg-neutral-700/50 print:bg-[#f1f1ef]">
                          <td colSpan={isAmountActive ? "4" : "3"} className="py-2.5 px-4 text-[14px] font-bold text-[#504f4c] dark:text-neutral-400">※ 공동상속인 중 [{group.ancestor.name}]은(는) {formatKorDate(group.ancestor.deathDate)} 사망하였으므로 상속인</td>
                        </tr>
                        {group.shares.map((f, i) => (
                          <tr key={'gs'+gIdx+'-'+i} className="border-b border-[#d4d4d4] dark:border-neutral-700 transition-colors">
                            <td className="py-2.5 px-4 font-bold pl-10 border-r border-[#d4d4d4] dark:border-neutral-700 text-[#0b6e99] dark:text-blue-400"><span className="text-[#a1a1aa] dark:text-neutral-500 mr-2">└</span>{f.name}</td>
                            <td className="py-2.5 px-4 text-center border-r border-[#d4d4d4] dark:border-neutral-700 font-bold">{f.n} / {f.d}</td>
                            <td className={`py-2.5 px-4 text-center font-bold ${isAmountActive ? 'border-r border-[#d4d4d4] dark:border-neutral-700' : ''}`}>{f.un} / {f.ud}</td>
                            {isAmountActive && <td className="py-2.5 px-4 text-right pr-6 font-black text-[#0b6e99] dark:text-blue-400 bg-[#eff6ff] dark:bg-blue-900/20">{formatMoney(propertyValue ? Math.floor((Number(propertyValue)*f.un)/f.ud) : 0)}원</td>}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div className="mt-8 text-[13px] text-[#787774] dark:text-neutral-400 space-y-1 text-right font-medium transition-colors">
                  <p>※ 본 계산서는 대습 및 순차 상속 법리를 기초로 산출되었습니다.</p>
                  <p>※ 상속 개시 시점(사망일)에 따른 1960년, 1979년, 1991년 개정 민법 비율이 자동 적용되었습니다.</p>
                  {isAmountActive && <p className="text-[#0b6e99] dark:text-blue-400 font-bold mt-2">※ 계산된 상속 금액은 원 단위 이하를 내림하여 표기하였습니다.</p>}
                </div>
              </div>
            </div>
          )}
          {/* 인쇄 전용 보고서 표 (화면에서는 숨김, 인쇄 시에만 표시) */}
          <div className="hidden print:block w-full">
            <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-4">
              <div>
                <h1 className="text-[24pt] font-black text-black mb-2">상속지분 계산 결과 보고서</h1>
                <div className="flex items-center gap-8 text-[12pt] text-black">
                  <span><strong>사건번호:</strong> {tree.caseNo || '(미입력)'}</span>
                  <span><strong>피상속인:</strong> <span className="font-black text-[14pt] underline">{tree.name || '(미입력)'}</span> ({formatKorDate(tree.deathDate)} 사망)</span>
                </div>
              </div>
              <div className="text-right text-[10pt] text-gray-500">
                인쇄일: {new Date().toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-8">
              {/* 1. 상속인 지분 요약 표 */}
              <section>
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
                            ※ {group.ancestor.name}의 대습/순차 상속분
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

              {/* 2. 상세 계산 근거 (간략화) */}
              <section className="break-before-page">
                <h2 className="text-[16pt] font-bold mb-3 border-l-4 border-black pl-3 flex items-center gap-2">
                  <IconTable className="w-5 h-5"/> 상세 계산 근거
                </h2>
                <div className="space-y-4">
                  {calcSteps.map((s, i) => (
                    <div key={'p-s'+i} className="border border-gray-300 p-4 rounded">
                      <div className="font-bold text-[11pt] mb-2 text-gray-800">
                        [단위 상속] 피상속인 {s.dec.name} ({s.dec.deathDate} 사망) ─ 피상속지분: {s.inN}/{s.inD}
                      </div>
                      <table className="w-full border-collapse border border-gray-400 text-[10pt]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-400">
                            <th className="py-1 px-2 text-left">수유자</th>
                            <th className="py-1 px-2 text-center">비율</th>
                            <th className="py-1 px-2 text-left">적용 법리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.dists.map((d, di) => (
                            <tr key={di} className="border-b border-gray-200">
                              <td className="py-1 px-2 font-bold">{d.h.name}</td>
                              <td className="py-1 px-2 text-center">{d.n}/{d.d} <span className="text-gray-400 text-[9pt]">({s.inN}/{s.inD}×{d.sn}/{d.sd})</span></td>
                              <td className="py-1 px-2 text-[9pt]">{d.mod || '본위 상속'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="mt-12 text-[10pt] text-gray-400 text-center italic border-t pt-4">
              본 보고서는 상속지분 계산기 PRO (Designed by J.H. Lee)를 통해 법령에 기초하여 자동 생성되었습니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
