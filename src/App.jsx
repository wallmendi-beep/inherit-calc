import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  IconCalculator, IconUserPlus, IconSave, IconFolderOpen,
  IconPrinter, IconNetwork, IconTable, IconList,
  IconReset, IconFileText, IconXCircle, IconX, IconChevronRight,
  IconSun, IconMoon, IconUndo, IconRedo, IconUserGroup, IconTrash2
} from './components/Icons';
import { DateInput } from './components/DateInput';
import HeirRow from './components/HeirRow';
import TreeReportNode from './components/TreeReportNode';
import { math, getLawEra, getRelStr, formatKorDate, formatMoney, isBefore } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { useSmartGuide } from './hooks/useSmartGuide';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const getWarningState = (n, rootDeathDate, level = 1) => {
  if (!n) return { isDirect: false, hasDescendant: false };
  
  // 1. 상속포기, 상속인없음 등 소급 무시되는 상태는 경고창 완전히 차단
  if (n.isExcluded && (n.exclusionOption === 'no_heir' || n.exclusionOption === 'renounce' || !n.exclusionOption)) {
    return { isDirect: false, hasDescendant: false };
  }

  // 2. 배우자 선사망 체크 (배우자는 선사망 시 대습상속이 없으므로 예외 처리)
  const isRootSpouse = level === 1 && ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(n.relation);
  const isPreDeceasedSpouse = isRootSpouse && n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);

  const requiresHeirsIfExcluded = n.isExcluded && ['lost', 'disqualified'].includes(n.exclusionOption);
  
  // 💡 수정: 선사망(대습)이든 후사망(재상속)이든 '사망'했다면 무조건 하위 상속인이 필요함! (단, 선사망 배우자는 제외)
  const requiresHeirsIfDeceased = !n.isExcluded && n.isDeceased && !isPreDeceasedSpouse;

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

const MiniTreeView = ({ node, level = 0, onSelectNode, visitedHeirs = new Set(), deathDate, toggleSignal, searchQuery, matchIds, currentMatchId, guideStatusMap }) => {
  const [isExpanded, setIsExpanded] = React.useState(level === 0);

  const isMatch = matchIds && matchIds.includes(node.id);
  const isCurrentMatch = currentMatchId === node.id;

  // 💡 자식/손주 중에 검색어가 포함된 노드가 있는지 스캔 (있으면 폴더를 알아서 열기 위함!)
  const hasMatchingDescendant = React.useMemo(() => {
    if (!searchQuery || !matchIds || matchIds.length === 0) return false;
    const check = (n) => {
      if (matchIds.includes(n.id)) return true;
      if (n.heirs) n.heirs.some(check);
      return false;
    };
    return node.heirs ? node.heirs.some(check) : false;
  }, [node, matchIds, searchQuery]);

  React.useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(level === 0);
  }, [toggleSignal, level]);

  // 💡 마법의 로직: 내 하위 폴더에 찾는 사람이 있으면 이 폴더를 자동으로 엽니다!
  React.useEffect(() => {
    if (hasMatchingDescendant) setIsExpanded(true);
  }, [hasMatchingDescendant]);

  if (!node) return null;

  // ⚠️ 누락 경고 상태 계산 (법적 예외 로직 적용)
  const { isDirect: isDirectMissing, hasDescendant: hasMissingDescendant } = getWarningState(node, deathDate);
  
  // 💡 새로운 가이드 상태 맵 연동 로직
  const status = guideStatusMap?.[node.id] || guideStatusMap?.[node.name] || {};
  const showMandatory = status.mandatory || isDirectMissing || (!isExpanded && hasMissingDescendant);
  const showRecommended = status.recommended; // 💡 권고 사항(전등) 유무

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

  // 💡 검색 하이라이트 스타일
  const highlightStyle = isCurrentMatch
    ? 'bg-yellow-200 dark:bg-yellow-800 ring-2 ring-yellow-400 dark:ring-yellow-500 font-black'
    : isMatch
    ? 'bg-yellow-100 dark:bg-yellow-900/50'
    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded';

  // 중복 호출 방지 로직 (간소화 유지)
  if (node.name && level > 0) visitedHeirs.add(node.name);

  return (
    <div className={`flex flex-col ${level > 0 ? 'ml-3' : ''}`}>
      <div className="flex items-center gap-1.5 py-1 pr-1 group">
        {level > 0 && <span className="text-[#d4d4d4] dark:text-neutral-600 text-[12px] shrink-0 font-bold opacity-40">└</span>}
        <span 
          id={`sidebar-node-${node.id}`} // 💡 자동 스크롤을 위한 좌표 ID
          onClick={() => {
            if (hasHeirs) setIsExpanded(!isExpanded);
            onSelectNode && onSelectNode(node.id);
          }}
          className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer ${itemStyleClass} ${highlightStyle}`}
        >
          {node.name || (level === 0 ? '피상속인' : '(이름 없음)')}
        </span>
        
        {/* 💡 수정: 에러면 🚨, 권고면 💡 를 띄워줍니다! */}
        <div className="flex items-center gap-1 shrink-0">
          {showMandatory && <span className="text-[12px] cursor-help opacity-100" title={warningTitle}>🚨</span>}
          {!showMandatory && showRecommended && <span className="text-[12px] cursor-help opacity-100" title="권고 사항 (팁)">💡</span>}
          
          {level > 0 && (() => {
            const isSpouse = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);
            const isPre = node.isDeceased && node.deathDate && deathDate && isBefore(node.deathDate, deathDate) && !isSpouse;
            return (
              <span className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${isPre ? 'text-[#37352f] opacity-60' : 'text-[#787774]'}`}>
                [{getRelStr(node.relation, deathDate) || '자녀'}]
              </span>
            );
          })()}
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
              searchQuery={searchQuery}
              matchIds={matchIds}
              currentMatchId={currentMatchId}
              guideStatusMap={guideStatusMap}
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
  const [zoomLevel, setZoomLevel] = useState(1.0); // 💡 메인 입력창 확대/축소 상태 추가
  
  // 💡 1단: 요약표 상속인 검색용 State 선언 (최상단 배치!)
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIds, setMatchIds] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ... (중략: 스티커 엔진 및 History 기능 등 기존 상태들 유지) ...

  // 💡 2단: 계산 로직 (finalShares 등)
  // (이후 아래 코드에서 finalShares가 선언됨)


  // 💡 제로 딜레이(Zero-Delay) 플로팅 스티커 엔진
  const stickerRef = useRef(null);
  const stickerPos = useRef({ x: 0, y: 0 });
  const [isStickerDragging, setIsStickerDragging] = useState(false);

  const handleStickerMouseDown = (e) => {
    // 💡 1. 브라우저의 기본 드래그 기능(텍스트 블록 지정 등)을 강제로 막아 버벅거림 원천 차단
    e.preventDefault(); 
    
    // 2. 시각적인 그림자 효과를 위해 상태만 켜둠 (이것을 기다리지 않음!)
    setIsStickerDragging(true);

    // 3. 클릭한 순간의 마우스 위치와 스티커 위치의 차이를 즉시 계산
    const startX = e.clientX - stickerPos.current.x;
    const startY = e.clientY - stickerPos.current.y;

    // 4. 마우스가 움직일 때마다 즉각적으로 DOM을 움직이는 직통 함수
    const handleMouseMove = (moveEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;
      stickerPos.current = { x: newX, y: newY };
      
      if (stickerRef.current) {
        stickerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };

    const handleMouseUp = () => {
      setIsStickerDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    // 💡 5. 클릭(MouseDown) 하자마자 0.001초의 대기열도 없이 마우스 추적기를 바로 달아버림!
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };
  
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

    const sanitized = sanitize(rawTree) || getInitialTree();
    
    // 💡 2단계: 클론 동기화 — 동일 personId를 공유하는 노드들의 heirs 및 누락 필드를 통일
    const syncCloneHeirs = (root) => {
      // (a) 트리 전체를 순회하여 personId별 노드 참조 목록을 수집
      const personIdMap = new Map();
      const collectNodes = (node) => {
        if (!node || !node.personId) return;
        if (!personIdMap.has(node.personId)) personIdMap.set(node.personId, []);
        personIdMap.get(node.personId).push(node);
        if (node.heirs) node.heirs.forEach(collectNodes);
      };
      collectNodes(root);

      // (b) 각 personId 그룹을 순회하며 동기화
      for (const [pId, nodes] of personIdMap) {
        if (nodes.length < 2) continue; // 클론이 없으면 스킵
        
        // 정본 선정 1: heirs 배열이 가장 긴 노드
        let master = nodes[0];
        for (const n of nodes) {
          if ((n.heirs?.length || 0) > (master.heirs?.length || 0)) master = n;
        }
        
        // 🚨 정본 선정 2: 누군가 명시적으로 스위치를 껐는지 확인 (무자녀 사망자 강제 동기화용)
        let isExcludedTrue = false;
        let extOption = '';
        for (const n of nodes) {
          if (n.isExcluded === true) {
            isExcludedTrue = true;
            extOption = n.exclusionOption || 'renounce';
            break;
          }
        }
        
        for (const clone of nodes) {
          // (c-1) heirs 동기화: 정본보다 적으면 deep-copy
          const masterHeirs = master.heirs || [];
          if (masterHeirs.length > 0 && (clone.heirs?.length || 0) < masterHeirs.length) {
            clone.heirs = masterHeirs.map(h => {
              const deepClone = (n) => ({
                ...n,
                id: `n_${Math.random().toString(36).substr(2, 9)}`, // 화면 충돌 방지용 새 ID
                personId: n.personId, // 진짜 인물 DNA는 유지
                heirs: (n.heirs || []).map(deepClone)
              });
              return deepClone(h);
            });
            // 자녀가 복사되어 생겼으므로 강제로 스위치 ON (정상화)
            clone.isExcluded = false;
            clone.exclusionOption = '';
          }
          // 🚨 (c-2) 핵심 픽스: 자녀가 0명인 사망자인데 다른 방에서 스위치가 꺼져있다면, 
          // 이것은 "물리적 선사망 무자녀"이므로 무조건 모든 방의 스위치를 함께 끕니다!
          else if ((clone.heirs?.length || 0) === 0 && clone.isDeceased && isExcludedTrue) {
            clone.isExcluded = true;
            clone.exclusionOption = extOption;
          }
        }
      }
      return root;
    };

    return syncCloneHeirs(sanitized);
  }, [rawTree]);

  // 🧭 상속인 탭 목록 (💡 기준을 id에서 personId로 전면 통합!)
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set(); // 이름이 아닌 DNA(personId) 기준으로 중복 방지
    
    tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });

    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));

    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouseOfRoot = parentNode.id === 'root' && (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse');
      const isDisqualifiedSpouse = isSpouseOfRoot && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);

      let currentBranchRootId = branchRootId;
      const pId = node.personId; // 💡 껍데기 id가 아닌 고유 personId 사용

      if (isTarget && !isDisqualifiedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          // 💡 탭의 고유 ID 자체를 personId로 발급해 버림!
          tabMap.set(pId, { 
            id: pId, 
            personId: pId, 
            name: node.name || '(상속인)', 
            node: node, 
            parentNode: parentNode, 
            parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name, 
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
      
      if (node.heirs && node.heirs.length > 0) {
        node.heirs.forEach(h => queue.push({ node: h, parentNode: node, level: level + 1, branchRootId: currentBranchRootId }));
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

  // 💡 Phase 3: AI 내비게이터 상태 (별 버튼은 '켬' 기능만 수행)
  const [showNavigator, setShowNavigator] = useState(true);
  const [isNavigatorRolledUp, setIsNavigatorRolledUp] = useState(false);

  // 💡 특정 상속인 위치로 이동 및 하이라이트 (Warp 기능 개선: 탭 자동 전환 포함)
  const handleNavigate = (nodeId) => {
    setActiveTab('input');
    
    // 1. 해당 nodeId가 어느 탭(deceasedTabs)에 속해 있는지 찾습니다.
    let targetTabId = 'root';
    const findTabIdForNode = (currentNode, currentTabId) => {
      if (currentNode.id === nodeId) return currentTabId;
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          // 사망한 사람이나 특정 사유가 있는 사람은 자기만의 탭(personId)을 가집니다.
          const isTabOwner = h.isDeceased || (h.isExcluded && ['lost', 'disqualified'].includes(h.exclusionOption));
          const nextTabId = isTabOwner ? h.personId : currentTabId;
          const found = findTabIdForNode(h, nextTabId);
          if (found) return found;
        }
      }
      return null;
    };

    const foundTabId = findTabIdForNode(tree, 'root');
    if (foundTabId) setActiveDeceasedTab(foundTabId);

    // 2. 탭 전환 후 요소가 렌더링될 시간을 준 뒤 스크롤 및 하이라이트
    setTimeout(() => {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50');
        }, 2000);
      }
    }, 150); // 탭 전환 대기를 위해 시간을 소폭 늘림
  };

  // 💡 Phase 3: AI 가계도 마법사 상태
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({ name: '', deathDate: '', hasSpouse: true, sons: 0, daughters: 0 });

  // 💡 마법사 완료 시 가계도 자동 생성 함수
  const applyWizard = () => {
    const genId = () => Math.random().toString(36).substring(2, 9);
    const newTree = {
      id: 'root',
      personId: 'root',
      name: wizardData.name || '피상속인',
      deathDate: wizardData.deathDate || '',
      shareN: 1, shareD: 1,
      heirs: []
    };

    if (wizardData.hasSpouse) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: '배우자', relation: 'wife', isDeceased: false });
    }
    for(let i=0; i<wizardData.sons; i++) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: `아들${i+1}`, relation: 'son', isDeceased: false });
    }
    for(let i=0; i<wizardData.daughters; i++) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: `딸${i+1}`, relation: 'daughter', isDeceased: false });
    }

    setTree(newTree);
    setShowWizard(false);
    setWizardStep(0);
    setActiveTab('input');
  };

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
  // 퀵 입력 제출: 이름들을 파싱해서 상속인 추가 + 모든 클론(분신) 동기화
  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) return;
    const names = value.split(/[,，、\s]+/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    setTree(prev => {
      let newTree = JSON.parse(JSON.stringify(prev));
      const usedNames = new Set((parentNode.heirs || []).map(h => h.name));

      // 💡 1. 탭의 주인이 가진 진짜 DNA(personId) 찾기
      let targetPersonId = parentId;
      const findPId = (n) => {
        if (n.id === parentId) targetPersonId = n.personId;
        if (n.heirs) n.heirs.forEach(findPId);
      };
      findPId(newTree);

      // 💡 2. 새로 추가할 상속인들의 '기본 틀' 미리 만들기 
      // (클론들마다 서로 다른 personId가 발급되는 대참사를 막기 위해!)
      const hasSpouse = (parentNode.heirs || []).some(h => ['wife', 'husband', 'spouse'].includes(h.relation));
      
      // 💡 부모의 성별 자동 판별 (자녀나 배우자의 관계 데이터를 읽어옵니다)
      const isParentFemale = parentNode.gender === 'female' || ['wife', 'daughter', 'mother', 'sister'].includes(parentNode.relation); 

      const newHeirsBase = [];
      names.forEach((name, idx) => {
        const isSpouse = idx === 0 && !hasSpouse;
        let finalName = name;
        if (usedNames.has(finalName)) {
           let suffix = 2;
           while(usedNames.has(`${name}(${suffix})`)) suffix++;
           finalName = `${name}(${suffix})`;
        }
        usedNames.add(finalName);

        newHeirsBase.push({
          baseId: `h_${Date.now()}_${idx}`,
          personId: `p_${Date.now()}_${idx}`, // 모두가 공유할 고유 DNA
          name: finalName,
          relation: isSpouse ? (isParentFemale ? 'husband' : 'wife') : 'son',
          isDeceased: false,
          isSameRegister: true,
          heirs: []
        });
      });

      // 💡 3. 트리를 끝까지 다 뒤지며 모든 분신에게 빠짐없이 추가 (.some 대신 .forEach 사용)
      const syncAllClones = (node) => {
        if (node.id === parentId || node.personId === targetPersonId) {
          if (!node.isDeceased) node.isDeceased = true;
          
          // 💡 자녀가 입력되는 순간, 부모의 상속권 스위치를 자동으로 켭니다(정상화).
          node.isExcluded = false;
          node.exclusionOption = '';
          
          node.heirs = node.heirs || [];
          newHeirsBase.forEach(baseHeir => {
            node.heirs.push({
              ...baseHeir,
              id: `${baseHeir.baseId}_${Math.random().toString(36).substr(2,4)}` // 화면용 ID만 다르게 생성
            });
          });
        }
        if (node.heirs) node.heirs.forEach(syncAllClones);
      };

      syncAllClones(newTree);
      return newTree;
    });
  };


  // 💡 사이드 패널 상태
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  
  // 💡 사이드바 가계도 전용 검색 엔진 State
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarMatchIds, setSidebarMatchIds] = useState([]);
  const [sidebarCurrentMatchIdx, setSidebarCurrentMatchIdx] = useState(0);

  useEffect(() => {
    if (!sidebarSearchQuery.trim()) {
      setSidebarMatchIds([]);
      setSidebarCurrentMatchIdx(0);
      return;
    }
    const query = sidebarSearchQuery.trim().toLowerCase();
    const matches = [];
    
    // 트리 전체를 뒤져서 이름이 일치하는 노드 ID 수집
    const scan = (n) => {
      if (n.name && n.name.toLowerCase().includes(query)) matches.push(n.id);
      if (n.heirs) n.heirs.forEach(scan);
    };
    scan(tree);
    
    setSidebarMatchIds(matches);
    setSidebarCurrentMatchIdx(0);
  }, [sidebarSearchQuery, tree]);

  // 검색 결과가 바뀌거나 화살표를 누르면 해당 위치로 스르륵 스크롤!
  useEffect(() => {
    if (sidebarMatchIds.length > 0 && sidebarOpen) {
      const targetId = sidebarMatchIds[sidebarCurrentMatchIdx];
      const element = document.getElementById(`sidebar-node-${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [sidebarCurrentMatchIdx, sidebarMatchIds, sidebarOpen]);

  const handleSidebarPrevMatch = () => setSidebarCurrentMatchIdx(prev => (prev > 0 ? prev - 1 : sidebarMatchIds.length - 1));
  const handleSidebarNextMatch = () => setSidebarCurrentMatchIdx(prev => (prev < sidebarMatchIds.length - 1 ? prev + 1 : 0));

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

    // 💡 Tab 키: 자연스럽게 다음 칸으로 이동 (Shift 누르면 이전 칸)
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        e.preventDefault(); if (i > 0) all[i-1].focus();
      } else {
        e.preventDefault(); if (i < all.length - 1) all[i+1].focus();
      }
      return;
    }

    // 💡 상/하/Enter 키
    if (e.key === 'ArrowDown' || e.key === 'Enter') { 
      e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); if (i > 0) all[i-1].focus(); 
    } 
    // 💡 좌/우 방향키 (같은 행 안에서 이동)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const row = e.target.closest('.group\\/row, .nav-row, .grid');
      if (!row) return;
      const rowEls = Array.from(row.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
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

    // 💡 새로운 기능: 부모 관계(성별) 변경 시 하위 배우자 관계 자동 스위칭!
    if (field === 'relation') {
      const isFemale = ['daughter', 'mother', 'sister', 'wife'].includes(value);
      const isMale = ['son', 'father', 'brother', 'husband'].includes(value);
      
      if (isFemale || isMale) {
        let targetPersonId = null;
        const findPId = (n) => {
          if (n.id === id) targetPersonId = n.personId;
          if (!targetPersonId && n.heirs) n.heirs.forEach(findPId);
        };
        findPId(tree);

        setTree(prev => {
          const syncRelation = (n) => {
            // 모든 분신(Clone) 탭에 동일하게 적용
            if (n.id === id || (targetPersonId && n.personId === targetPersonId)) {
              const newHeirs = (n.heirs || []).map(h => {
                // 하위 상속인 중 배우자가 있다면 성별을 반대로 휙! 뒤집어줍니다.
                if (['wife', 'husband', 'spouse'].includes(h.relation)) {
                  return { ...h, relation: isFemale ? 'husband' : 'wife' };
                }
                return h;
              });
              return { ...n, relation: value, heirs: newHeirs };
            }
            return { ...n, heirs: n.heirs?.map(syncRelation) || [] };
          };
          return syncRelation(prev);
        });
        return; // 자동 스위칭 완료 후 함수 종료
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
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };

    let targetPersonId = null;
    let targetNode = null; // 💡 타겟 노드 전체 확보
    const findPersonId = (n) => {
      if (n.id === id) { targetPersonId = n.personId; targetNode = n; }
      if (!targetPersonId && n.heirs) n.heirs.forEach(findPersonId);
    };
    findPersonId(tree);

    // 💡 동기화할 '개인 신상 정보' 목록 (기본적으로 법적 지위는 독립성 유지를 위해 제외)
    const personalFields = ['name', 'isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    const hasPersonalUpdate = Object.keys(updates).some(k => personalFields.includes(k));

    // 🚨 핵심 픽스: 이번 업데이트가 '무자녀 사망자'의 스위치 조작인지 판별합니다!
    const isExclusionUpdate = updates.isExcluded !== undefined;
    const isDeadWithoutHeirs = targetNode?.isDeceased && (!targetNode?.heirs || targetNode?.heirs.length === 0);

    const updateNode = (n) => {
      if (n.id === id) {
         // 타겟 노드는 모든 속성 정상 업데이트
         return { ...n, personId: targetPersonId || n.personId, ...updates };
      } else if (targetPersonId && n.personId === targetPersonId) {
         const filteredUpdates = {};
         // 1. 신상 정보 동기화
         if (hasPersonalUpdate) {
           Object.keys(updates).forEach(k => {
             if (personalFields.includes(k)) filteredUpdates[k] = updates[k];
           });
         }
         // 2. 🚨 스위치 동기화 예외 허용: 타겟이 '무자녀 사망자'라면, 다른 부모 탭에서도 물리적으로 상속이 불가하므로 스위치 상태를 똑같이 동기화합니다!
         if (isExclusionUpdate && isDeadWithoutHeirs && (!n.heirs || n.heirs.length === 0)) {
             filteredUpdates.isExcluded = updates.isExcluded;
             if (updates.exclusionOption !== undefined) filteredUpdates.exclusionOption = updates.exclusionOption;
         }

         if (Object.keys(filteredUpdates).length > 0) {
            return { ...n, ...filteredUpdates };
         }
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
    let targetPersonId = null;
    const findPId = (n) => {
      if (n.id === parentId) targetPersonId = n.personId;
      if (!targetPersonId && n.heirs) n.heirs.forEach(findPId);
    };
    findPId(tree);

    const newHash = Math.random().toString(36).substr(2, 9);
    const baseHeir = { 
      personId: `p_${newHash}`, 
      name: '', 
      relation: 'son', 
      isDeceased: false, 
      isSameRegister: true, 
      heirs: [] 
    };
    
    // 💡 부모의 분신(클론)들을 모두 찾아 똑같이 자식을 추가!
    const addFn = (n) => {
      if (n.id === parentId || (targetPersonId && n.personId === targetPersonId)) {
        return { 
          ...n, 
          // 💡 개별 추가 시에도 상속권 스위치를 즉시 활성화합니다.
          isExcluded: false,
          exclusionOption: '',
          heirs: [...(n.heirs || []), { ...baseHeir, id: `n_${Math.random().toString(36).substr(2,9)}` }] 
        };
      }
      return { ...n, heirs: n.heirs?.map(addFn) || [] };
    };
    setTree(prev => addFn(prev));
  };

  const removeHeir = (id) => {
    let targetPersonId = null;
    const findPId = (n) => {
      if (n.id === id) targetPersonId = n.personId;
      if (!targetPersonId && n.heirs) n.heirs.forEach(findPId);
    };
    findPId(tree);

    // 💡 삭제하려는 대상의 분신(클론)들까지 싹 다 추적해서 일괄 삭제!
    const rmFn = (n) => ({ 
      ...n, 
      heirs: n.heirs?.filter(x => !(x.id === id || (targetPersonId && x.personId === targetPersonId))).map(rmFn) || [] 
    });
    setTree(prev => rmFn(prev));
  };



  // 💡 Phase 2: 엔진이 잡아내는 누락 경고(warnings) 추가 연동
  // 💡 요약표에서 사용할 기약분수(목표 지분) 계산 변수 추가!
  const [simpleTargetN, simpleTargetD] = math.simplify(tree.shareN || 1, tree.shareD || 1);

  // 💡 상속 계산 엔진에 넘기기 직전, 선사망+무자녀를 "자동 제외" 시켜주는 전처리 로직
  const { finalShares, calcSteps, warnings = [] } = useMemo(() => {
    const applyAutoExclusion = (n, parentDate) => {
      const clone = { ...n };
      const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      
      // 루트가 아니고, 수동으로 꺼져있지 않은 노드에 대하여 검사
      if (clone.id !== 'root' && !clone.isExcluded) {
        // 1. 피상속인보다 먼저 사망했는가? (선사망)
        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate);
        // 2. 하위에 입력된 자녀가 없는가? (무자녀)
        const isDeadWithoutHeirs = clone.isDeceased && (!clone.heirs || clone.heirs.length === 0);
        
        // 🚨 핵심: 선사망인데 무자녀라면, 사람이 스위치를 안 꺼도 컴퓨터가 알아서 제외 처리!
        if (isPre && isDeadWithoutHeirs) {
          clone.isExcluded = true;
          clone.exclusionOption = 'renounce'; // 엔진이 지분을 타 상속인에게 분배하도록 포기 처리
        }
      }
      
      // 하위 노드들도 재귀적으로 샅샅이 검사
      if (clone.heirs) {
        clone.heirs = clone.heirs.map(h => applyAutoExclusion(h, clone.deathDate || refDate));
      }
      return clone;
    };
    
    // 전처리가 완료된 트리를 계산 엔진에 투입!
    const calcTree = applyAutoExclusion(tree, tree.deathDate);
    return calculateInheritance(calcTree, propertyValue);
  }, [tree, propertyValue]);

  // 💡 요약표 검색어 입력 시 매칭되는 상속인 찾기 로직 (초기화 오류 방지를 위해 finalShares 아래로 이동)
  useEffect(() => {
    if (!searchQuery.trim() || !finalShares || activeTab !== 'summary') {
      setMatchIds([]);
      setCurrentMatchIdx(0);
      return;
    }
    const query = searchQuery.trim().toLowerCase();
    const matches = [];

    // 요약표 렌더링 구조(rowId)에 맞춰 유니크한 키값 생성 및 매칭 확인
    if (finalShares.direct) {
      finalShares.direct.forEach(s => {
        if (s.name && s.name.toLowerCase().includes(query)) matches.push(`summary-row-${s.personId}`);
      });
    }
    
    // 💡 참고: finalShares.subGroups 구조에 따라 재귀적으로 탐색
    if (finalShares.subGroups) {
      const scan = (group) => {
        group.shares.forEach(s => {
          if (s.name && s.name.toLowerCase().includes(query)) matches.push(`summary-row-${s.personId}-${group.ancestor.id}`);
        });
        if (group.subGroups) group.subGroups.forEach(scan);
      };
      finalShares.subGroups.forEach(scan);
    }

    setMatchIds(matches);
    setCurrentMatchIdx(0);
  }, [searchQuery, finalShares, activeTab]);

  // 💡 검색 결과 선택 시 부드럽게 화면 중앙으로 자동 스크롤
  useEffect(() => {
    if (matchIds.length > 0 && activeTab === 'summary') {
      const targetId = matchIds[currentMatchIdx];
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIdx, matchIds, activeTab]);

  // 🧭 스마트 가이드 엔진 호출 (분석 로직 외부 분리)
  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings);
  const { 
    showGlobalWarning, showAutoCalcNotice, globalMismatchReasons, 
    autoCalculatedNames, smartGuides, noSurvivors, hasActionItems 
  } = guideInfo;

  // ------------------------------------------------------------------
  // 💡 사용자가 [X]를 눌러 숨긴 권고 가이드를 기억하는 메모리
  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const dismissGuide = (key) => setHiddenGuideKeys(prev => new Set(prev).add(key));

  // 💡 사이드바에 띄울 가이드 상태 맵 (엔진 계산 결과 기반)
  const guideStatusMap = useMemo(() => {
    const map = {};
    (smartGuides || []).forEach(g => {
      // 숨긴 권고 가이드는 맵에서 제외 (아이콘도 지워짐)
      if (g.type === 'recommended' && hiddenGuideKeys.has(g.uniqueKey)) return;
      
      // 1. ID 기준 매핑
      if (g.id) {
        if (!map[g.id]) map[g.id] = { mandatory: false, recommended: false };
        if (g.type === 'mandatory') map[g.id].mandatory = true;
        if (g.type === 'recommended') map[g.id].recommended = true;
      }
      // 2. 이름 기준 매핑 (분신 탭 처리를 위해 텍스트 속 [이름] 추출)
      const nameMatch = g.text.match(/\[(.*?)\]/);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1];
        if (!map[name]) map[name] = { mandatory: false, recommended: false };
        if (g.type === 'mandatory') map[name].mandatory = true;
        if (g.type === 'recommended') map[name].recommended = true;
      }
    });
    return map;
  }, [smartGuides, hiddenGuideKeys]);
  // ------------------------------------------------------------------

  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');
  const tabRefs = React.useRef({});

  // 🧭 상속 경로 및 브리핑 정보 계산 (지분 합산 로직 완전 개편!)
  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => {
      if (!curr) return null;
      const newPath = [...currentPath, curr];
      // 💡 핵심 픽스: id뿐만 아니라 personId로도 매칭 여부를 확인하여 탭의 주인을 정확히 찾습니다.
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
          if (grandparent?.name) parentNames = `${grandparent.name}·${parent.name}`;
        } else if (parent.heirs) {
          const spouse = parent.heirs.find(h => h.id !== targetNode.id && ['wife', 'husband', 'spouse'].includes(h.relation) && h.name && h.name.trim() !== '');
          if (spouse) parentNames = `${parent.name}·${spouse.name}`;
        }
      }
      relationInfo = `(${parentNames}의 ${getRelStr(targetNode.relation, tree.deathDate)})`;
    }

    let totalN = 0, totalD = 1;
    const sourceList = [];

    // 💡 핵심 픽스: '받는 사람'이 아니라 '나눠주는 사람(dec)'으로서의 지분을 가져옵니다. 
    // (이미 양쪽에서 받은 지분이 병합되어 있으므로 완벽하게 14/117이 나옵니다!)
    if (calcSteps && Array.isArray(calcSteps) && targetNode) {
      const myStep = calcSteps.find(s => s.dec?.personId === targetNode.personId);
      if (myStep) {
        totalN = myStep.inN;
        totalD = myStep.inD;
        if (myStep.mergeSources && myStep.mergeSources.length > 0) {
          myStep.mergeSources.forEach(src => sourceList.push({ from: src.from, n: src.n, d: src.d }));
        } else {
          sourceList.push({ from: myStep.parentDecName || '피상속인', n: myStep.inN, d: myStep.inD });
        }
      } else {
        // 생존자라서 나눠준 스텝이 없다면, 최종 결과표에서 본인 지분을 찾음
        const myFinalShare = finalShares.direct.find(f => f.personId === targetNode.personId) || 
                             finalShares.subGroups.flatMap(g => g.shares).find(f => f.personId === targetNode.personId);
        if (myFinalShare) {
          totalN = myFinalShare.n;
          totalD = myFinalShare.d;
        }
      }
    }

    const shareStr = isRoot ? '1분의 1' : (totalN > 0 ? `${totalD}분의 ${totalN}` : '0');
    return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps, finalShares]);

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
    // 1. 입력 탭에서는 인쇄 불가 처리
    if (activeTab === 'input') {
      alert('보고서 탭(가계도, 계산표, 계산결과, 요약표) 중 하나를 선택한 후 인쇄해주세요.');
      return;
    }

    // 2. 현재 열려있는 탭의 영문 ID를 한글 이름으로 변환
    const tabNames = {
      tree: '가계도',
      calc: '계산표',
      result: '계산결과',
      summary: '요약표'
    };
    const currentTabName = tabNames[activeTab] || '보고서';

    // 3. 사건번호와 피상속인 이름 가져오기 (특수문자 제거하여 안전한 파일명 생성)
    const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '');

    // 4. 오늘 날짜 구하기 (YYYY-MM-DD 형식)
    const today = new Date().toISOString().slice(0, 10);

    // 5. 최종 인쇄용 파일명 조합 (예: 67890_김혁조_요약표_2026-03-31)
    const printFileName = `${safeCaseNo}_${safeName}_${currentTabName}_${today}`;

    // 6. 원래 브라우저 탭 이름(Title) 임시 저장
    const originalTitle = document.title;

    // 7. 브라우저 탭 이름을 인쇄용 파일명으로 변경
    document.title = printFileName;

    // 8. 인쇄(PDF 저장) 대화상자 호출! (이때 변경된 title이 파일명으로 잡힙니다)
    window.print();

    // 9. 인쇄 창이 뜨고 나면, 다시 원래 브라우저 탭 이름으로 원상복구
    document.title = originalTitle;
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
        
        // 🚨 초강력 강제 동기화 로직: 파일에 꼬인 ID가 저장되어 있더라도, 이름이 같으면 무조건 하나로 통일!
        const nameMap = new Map();
        const syncPersonIdRec = (n) => {
          let pId = n.personId;
          
          if (n.name && n.name.trim() !== '') {
            if (nameMap.has(n.name)) {
              // 이미 등록된 이름이면, 파일에 적힌 불량 ID를 무시하고 기존 ID로 강제 덮어쓰기!
              pId = nameMap.get(n.name); 
            } else {
              if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`;
              nameMap.set(n.name, pId);
            }
          } else {
            if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`;
          }

          // 구버전 no_heir → renounce 마이그레이션 (선사망자 지분 재분배 처리)
          let exclusionOption = n.exclusionOption;
          if (n.isExcluded && exclusionOption === 'no_heir' && n.isDeceased) {
            exclusionOption = 'renounce';
          }

          return { ...n, personId: pId, exclusionOption, heirs: (n.heirs || []).map(syncPersonIdRec) };
        };

        // 구버전(트리) 형식: id === 'root' 또는 heirs 배열 보유
        if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
          setTree(syncPersonIdRec(data));
          setActiveTab('calc');
        } else if (data.people && Array.isArray(data.people)) {
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
      
      {/* 🧭 스마트 가이드 팝업창 (필수/권고 분리형 + 나침반 아이콘) */}
      {showNavigator && (
        <div
          ref={stickerRef}
          className={`fixed top-28 right-8 z-[9999] no-print ${isStickerDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ transform: `translate3d(${stickerPos.current.x}px, ${stickerPos.current.y}px, 0)`, transition: 'none', willChange: 'transform', touchAction: 'none' }}
          onMouseDown={handleStickerMouseDown}
        >
          <div className={`relative w-[340px] ${isNavigatorRolledUp ? 'p-3' : 'p-5'} bg-white dark:bg-neutral-800 shadow-[0_12px_40px_rgb(0,0,0,0.15)] border border-[#e9e9e7] dark:border-neutral-700 rounded-xl select-none transition-all duration-200 ${isStickerDragging ? 'scale-[1.02]' : ''}`}>
            
            {/* 🏷️ 헤더 영역: 타이틀과 버튼들을 한 행에 배치하여 수직 정렬 일치 */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[#37352f] dark:text-neutral-100">
                <svg className={`w-5 h-5 ${hasActionItems ? 'text-[#2383e2]' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
                <span className="font-black text-[15px]">스마트 가이드</span>
              </div>

              <div className="flex items-center">
                {/* 롤업/롤다운 버튼 (닫기 버튼과 20px 간격 유지) */}
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={() => setIsNavigatorRolledUp(!isNavigatorRolledUp)} 
                  className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors pointer-events-auto mr-5"
                  title={isNavigatorRolledUp ? "내용 보기" : "제목만 보기"}
                >
                  {isNavigatorRolledUp ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  )}
                </button>

                {/* 닫기(X) 버튼 */}
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={() => setShowNavigator(false)} 
                  className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors pointer-events-auto"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {!isNavigatorRolledUp && (
                <div className="text-[13px] font-bold text-[#504f4c] dark:text-neutral-300 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
                  
                  {/* 🚨 최우선 알림: 생존 상속인 전멸 상태 */}
                  {noSurvivors && (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg mt-2 mb-4">
                      <span className="text-2xl mb-1">👨‍👩‍👧‍👦</span>
                      <span className="text-[#b45309] dark:text-amber-500 font-black text-[14px]">생존 상속인 없음</span>
                      <span className="text-[#787774] dark:text-neutral-400 text-[11.5px] font-medium leading-relaxed px-4">
                        현재 모든 상속인이 '사망' 또는 '제외' 상태입니다.<br/>
                        실제 상속을 받을 생존자를 입력하거나,<br/>
                        차순위 상속인을 추가해 주세요.
                      </span>
                    </div>
                  )}

                  {/* 완벽 상태 (생존자가 1명이라도 있고 에러가 없을 때만 노출) */}
                  {!hasActionItems && !noSurvivors && (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-lg border border-[#e9e9e7] dark:border-neutral-700/50 mt-2">
                      <span className="text-2xl mb-1">✅</span>
                      <span className="text-[#37352f] dark:text-neutral-300 font-black text-[13px]">완벽합니다!</span>
                      <span className="text-[#787774] dark:text-neutral-500 text-[11.5px] font-medium leading-snug">
                        현재 단계에서 가이드가 추천할<br/>추가 입력/수정 항목이 없습니다.
                      </span>
                    </div>
                  )}

                  {/* 🚨 하드 엔진 경고 */}
                  {activeTab === 'input' && warnings.map((w, i) => (
                    <div key={`w-${i}`} className="flex items-start gap-2 text-red-600 p-2.5 bg-red-50/50 rounded-lg border border-red-100 mt-2">
                      <span className="mt-0.5">⚠️</span><span className="flex-1 leading-snug">{w}</span>
                    </div>
                  ))}

                  {/* 👉 1. 필수 사항 (Mandatory) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').map((g, i) => (
                    <button 
                      key={`m-${i}`} 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleNavigate(g.id)}
                      className="w-full mt-2 text-left flex items-start gap-2 bg-blue-50/60 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200/60 dark:border-blue-800/30 hover:bg-blue-100/80 transition-all group pointer-events-auto shadow-sm"
                    >
                      <span className="mt-0.5 text-blue-600 group-hover:scale-125 transition-transform">👉</span>
                      <span className="flex-1 leading-snug text-[#37352f] dark:text-neutral-200 font-bold">{g.text}</span>
                    </button>
                  ))}

                  {/* ✂️ 점선 구분선 (필수와 권고가 둘 다 있을 때만 노출) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').length > 0 && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (
                    <div className="w-full border-t border-dashed border-[#d4d4d4] dark:border-neutral-600 my-4"></div>
                  )}

                  {/* 💡 2. 권고 사항 헤더 및 목록 (Recommended) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (
                    <>
                      <div className={`mt-2 mb-1.5 ${smartGuides.filter(m => m.type === 'mandatory').length === 0 ? 'mt-3' : ''}`}>
                        <span className="text-[11px] font-bold text-[#a3a3a3] dark:text-neutral-500 tracking-tight px-1">[다음은 권고사항입니다]</span>
                      </div>
                      {smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).map((g, i) => (
                        <div 
                          key={`r-${i}`}
                          className="relative group pointer-events-auto mb-1.5"
                        >
                          <button 
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => handleNavigate(g.id)}
                            className="w-full text-left flex items-start gap-2 bg-[#fbfbfb] dark:bg-neutral-800/40 p-2.5 rounded-lg border border-[#e9e9e7] dark:border-neutral-700 hover:bg-[#f2f2f0] transition-all"
                          >
                            <span className="mt-0.5 text-[#a3a3a3] group-hover:text-amber-500 transition-colors">💡</span>
                            <span className="flex-1 leading-snug text-[#787774] dark:text-neutral-400 font-medium text-[12.5px] pr-6">{g.text}</span>
                          </button>
                          
                          {/* 💡 권고형 가이드에만 달아주는 마법의 닫기(X) 버튼! */}
                          <button 
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); dismissGuide(g.uniqueKey); }} 
                            className="absolute top-2.5 right-2 p-1 text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full transition-all opacity-0 group-hover:opacity-100"
                            title="이 권고 무시하기 (사이드바에서도 지워집니다)"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* 🚨 지분 불일치 상세 안내 (데이터 입력 탭 포함 모든 곳에서 노출!) */}
                  {showGlobalWarning && (
                    <div className="mt-3 space-y-3">
                      <div className="text-[#e53e3e] dark:text-red-400 font-black text-[14px]">전체 지분 합계가 일치하지 않습니다.</div>
                      
                      {/* 💡 요약표와 동일한 상세 메시지 출력 */}
                      {globalMismatchReasons.length > 0 ? (
                        <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">
                          {globalMismatchReasons.map((r, idx) => (
                            <button
                              key={idx}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => r.id ? handleNavigate(r.id) : null}
                              className="w-full text-left flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all group pointer-events-auto shadow-sm"
                            >
                              <span className="mt-0.5 text-red-600 dark:text-red-400 group-hover:scale-125 transition-transform">🚨</span>
                              {/* 💡 핵심: r.text 로 객체 안의 글씨만 쏙 빼서 렌더링! */}
                              <span className="flex-1 leading-snug text-[#c93f3a] dark:text-red-400 font-bold text-[12.5px]">{r.text || r}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md">
                          <span className="text-[12.5px] text-[#787774] dark:text-neutral-400 font-bold">지분 일부가 상속권 없음 처리되어 전체 합계가 미달합니다.</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* 자동분배 내역 (모든 탭 노출) */}
                  {showAutoCalcNotice && (
                    <div className="mt-3 p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md">
                      <span className="text-[#37352f] dark:text-neutral-100 font-black block mb-2 border-b border-[#e9e9e7] dark:border-neutral-700 pb-1.5 text-[13px]">자동분배 내역:</span>
                      <div className="space-y-1.5">
                        {autoCalculatedNames.map((a, idx) => (
                           <div key={idx} className="text-[12.5px] flex items-center justify-between">
                             <span className="font-bold text-[#504f4c] dark:text-neutral-300">{a.name}</span>
                             <span className="text-[#787774] dark:text-neutral-500 flex items-center gap-1.5">
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                               {a.target}
                             </span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                  className={`relative inline-flex h-4 w-7 items-center shrink-0 cursor-pointer rounded-full transition-all duration-200 ease-in-out focus:outline-none ${sidebarToggleSignal > 0 ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                  title={sidebarToggleSignal > 0 ? '모두 접기' : '모두 펼치기'}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${sidebarToggleSignal > 0 ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* 💡 새로 추가된 2열: 사이드바 검색창 */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1.5 bg-[#f0f9ff] dark:bg-blue-900/20 border border-[#bae6fd] dark:border-blue-800/50 rounded-lg px-2 py-1.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-200">
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input
                  type="text"
                  placeholder="상속인 찾기..."
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-[12px] flex-1 min-w-0 text-[#0b6e99] dark:text-blue-300 font-bold placeholder-blue-300/70"
                />
                {sidebarMatchIds.length > 0 && (
                  <div className="flex items-center gap-1 border-l border-blue-200 dark:border-blue-700/50 pl-1.5 ml-1 shrink-0">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold min-w-[20px] text-center">
                      {sidebarCurrentMatchIdx + 1}/{sidebarMatchIds.length}
                    </span>
                    <button onClick={handleSidebarPrevMatch} className="p-0.5 rounded text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/50 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7"></path></svg>
                    </button>
                    <button onClick={handleSidebarNextMatch} className="p-0.5 rounded text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/50 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 3열: 노션 스타일 인라인 안내 콜아웃 */}
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
                searchQuery={sidebarSearchQuery} 
                matchIds={sidebarMatchIds} 
                currentMatchId={sidebarMatchIds[sidebarCurrentMatchIdx]}
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
                상속지분 계산기 PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">v2.0.8</span>
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

            {/* 🧭 스마트 가이드 호출 버튼 (좌우 10px 여백 확보) */}
            <button 
              onClick={() => setShowNavigator(true)} 
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm border shrink-0 mx-[10px] ${
                hasActionItems 
                  ? 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/60 dark:text-blue-400 dark:border-blue-800' 
                  : 'bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f7f5] hover:text-[#37352f] dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700'
              }`}
              title={hasActionItems ? "새로운 스마트 가이드가 있습니다!" : "스마트 가이드 열기"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActionItems ? 2.5 : 2}>
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </button>

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

            {/* 💡 확대/축소 컨트롤러 (인쇄 우측, 다크모드 좌측으로 이동) */}
            <div className="flex items-center gap-1 bg-[#f7f7f5] dark:bg-neutral-700 px-1.5 py-0.5 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-1 transition-colors">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
                className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]"
                title="축소"
              >-</button>
              <span className="text-[10px] font-black w-8 text-center text-[#504f4c] dark:text-neutral-300">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]"
                title="확대"
              >+</button>
            </div>

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
        {/* 💡 핵심: 메인 콘텐츠(탭 + 입력창)만 확대/축소하는 줌 엔진 적용 */}
        <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
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
            // 💡 핵심 픽스: 가계도를 다시 뒤질 필요 없이, 탭에 이미 저장해둔 '진짜 인물(node)'을 바로 꺼내 씁니다!
            const currentNode = activeTabObj ? activeTabObj.node : tree; 
            const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
            const isRootNode = currentNode && currentNode.id === 'root';
            
            const siblings = activeTabObj ? activeTabObj.parentNode?.heirs : null;
            const isSp = currentNode?.relation === 'wife' || currentNode?.relation === 'husband';
            const isChild = currentNode?.relation === 'son' || currentNode?.relation === 'daughter';

            const canAutoFillSp = !isRootNode && isSp;
            const canAutoFillChild = !isRootNode && isChild;

            const handleAutoFill = () => {
              // 💡 1단계: 복제할 원본 데이터(baseAdd)를 먼저 만듭니다
              const cloneBase = (n) => ({ 
                ...n, 
                personId: n.personId, 
                heirs: n.heirs?.map(cloneBase) || [] 
              });
              const existingNames = new Set(nodeHeirs.map(h => h.name).filter(n => n.trim() !== ''));
              
              let baseAdd = [];

              if (canAutoFillSp) {
                const children = siblings ? siblings.filter(s => s.relation === 'son' || s.relation === 'daughter') : [];
                let newItems = children.filter(c => c.name.trim() === '' || !existingNames.has(c.name));
                if (children.length > 0 && newItems.length === 0) { alert('더 이상 불러올 동일한 상속인이 없습니다. (모두 등록됨)'); return; }
                baseAdd = newItems.length > 0 ? newItems.map(cloneBase) : [{ personId: `p_${Date.now()}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] }];
              } else if (canAutoFillChild) {
                const siblingList = siblings ? siblings.filter(s => s.id !== currentNode.id && (s.relation === 'son' || s.relation === 'daughter')) : [];
                let newItems = siblingList.filter(s => s.name.trim() === '' || !existingNames.has(s.name));
                if (siblingList.length > 0 && newItems.length === 0) { alert('더 이상 불러올 동일한 상속인이 없습니다. (모두 등록됨)'); return; }
                baseAdd = newItems.length > 0 ? newItems.map(item => ({ ...cloneBase(item), relation: 'sibling' })) : [{ personId: `p_${Date.now()}`, name: '', relation: 'sibling', isDeceased: false, isSameRegister: true, heirs: [] }];
              }

              // 💡 2단계: 가계도를 샅샅이 뒤져서 '윤종욱'의 모든 분신(Clone)들에게 빠짐없이 자녀들을 꽂아넣습니다!
              setTree(prev => {
                const syncHeirs = (n) => {
                  if (n.id === currentNode.id || (currentNode.personId && n.personId === currentNode.personId)) {
                    // 각 분신마다 화면 충돌을 막기 위해 고유 id를 새로 발급
                    const finalAdd = baseAdd.map(item => {
                       const assignNewIds = (node) => ({ ...node, id: `n_${Math.random().toString(36).substr(2,9)}`, heirs: node.heirs?.map(assignNewIds) || [] });
                       return assignNewIds(item);
                    });
                    // 스위치도 자동으로 켜줌
                    return { ...n, isExcluded: false, exclusionOption: '', heirs: [...(n.heirs || []), ...finalAdd] };
                  }
                  return { ...n, heirs: n.heirs?.map(syncHeirs) || [] };
                };
                return syncHeirs(prev);
              });
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
                      <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="이름" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사망일자</label>
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
                        case 0:
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
                              : 'max-w-[74px] min-w-[40px] px-2 py-1.5 text-[10.5px]'
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
                        <div className="absolute top-[20px] left-full -ml-[1px] flex flex-col pointer-events-auto z-0 border-l border-[#e9e9e7] dark:border-neutral-700/50">
                          {primaryTabs.filter(t => t.id === 'root').map(t => renderTab(t, true))}
                          <div className="flex flex-col gap-1">
                            {primaryTabs.filter(t => t.id !== 'root').map(t => {
                              const isParentOfActive = t.id === activeBranchId;
                              return (
                                <div key={t.id} className="relative w-fit">
                                  {renderTab(t)}
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
                    {/* 📁 폴더 상단 액션 바 - 나침반형 레이아웃 전면 개편 */}
                    <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl transition-colors min-h-[80px]">
                      <div className="flex items-center gap-5 w-full">
                        
                        {/* 1. 계승 경로 (상위 상속인 명 + 관계) - 이름 길이에 따라 유동적으로 늘어남 */}
                        <div className="flex items-center shrink-0 pr-4">
                          {activeTabObj && activeTabObj.parentNode && activeDeceasedTab !== 'root' ? (
                            <button
                              type="button"
                              onClick={() => {
                                // 💡 고친 부분: 껍데기 id가 아니라 진짜 DNA인 personId로 넘겨야 정상적으로 탭을 찾습니다!
                                const parentTargetId = activeTabObj.parentNode.id === 'root' ? 'root' : activeTabObj.parentNode.personId;
                                setActiveDeceasedTab(parentTargetId);
                                setIsFolderFocused(true);
                              }}
                              className="flex items-center gap-2 group transition-all"
                            >
                              <div className="w-7 h-7 rounded-full border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center justify-center text-[#787774] group-hover:text-[#2383e2] group-hover:border-[#2383e2] shadow-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                              </div>
                              <div className="flex flex-col items-start text-left">
                                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 leading-none mb-1 uppercase tracking-tight">상위 단계</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[16px] font-black text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                                    {activeTabObj.parentNode.id === 'root' ? (tree.name || '피상속인') : activeTabObj.parentNode.name}
                                  </span>
                                  <span className="text-[13px] font-bold text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                                    의 {getRelStr(currentNode.relation, tree.deathDate)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center px-2">
                              <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 tracking-tight">최초 상속 단계</span>
                            </div>
                          )}                        </div>
                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 2. 현재 입력 대상자 (성함만 강조) */}
                        <div className="flex flex-col justify-center min-w-[80px] max-w-[140px]">
                          <span className="text-[10px] font-bold text-[#2383e2] dark:text-blue-400 uppercase tracking-tight mb-0.5">
                            {(() => {
                              if (activeDeceasedTab === 'root') return '피상속인';
                              
                              // 부모 노드의 사망일 가져오기
                              const pDeathDate = activeTabObj?.parentNode?.id === 'root' ? tree.deathDate : activeTabObj?.parentNode?.deathDate;
                              
                              // 대습상속 조건: 결격/상실이거나, 부모보다 먼저 사망(선사망)한 경우
                              const isExcludedDaeseup = currentNode?.isExcluded && ['lost', 'disqualified'].includes(currentNode?.exclusionOption);
                              const isPreDeceased = currentNode?.deathDate && pDeathDate && isBefore(currentNode.deathDate, pDeathDate);
                              
                              return (isExcludedDaeseup || isPreDeceased) ? '피대습상속인' : '피상속인';
                            })()}
                          </span>
                          <div className="flex items-center overflow-hidden">
                            <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                              {getBriefingInfo.name}
                            </span>
                          </div>
                        </div>
                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 3. 사망일자 & 법령 뱃지 (⚖️ 아이콘 복구, 120px 고정) */}
                        <div className="flex flex-col justify-center items-center shrink-0">
                          <span className="text-[12px] font-bold text-[#c93f3a] dark:text-red-400 mb-1 leading-none">
                            {(!getBriefingInfo.isRoot && currentNode?.deathDate) ? `${formatKorDate(currentNode.deathDate)} 사망` : (tree.deathDate ? `${formatKorDate(tree.deathDate)} 사망` : '사망일자 미상')}
                          </span>
                          <div className="w-[120px] bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 py-0.5 rounded flex items-center justify-center gap-1 shadow-sm">
                            <span className="text-[9px]">⚖️</span>
                            <span className="text-[10px] font-black tracking-tighter whitespace-nowrap">
                              {getLawEra(currentNode?.deathDate || tree.deathDate)}년 {getLawEra(currentNode?.deathDate || tree.deathDate) === '1960' ? '제정' : '개정'} 민법
                            </span>
                          </div>
                        </div>

                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 4. 상속 지분 (상세 출처 제거) */}
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">지분</span>
                            <span className="text-[17px] font-black text-[#1e56a0] dark:text-blue-400 leading-none">
                              {getBriefingInfo.shareStr}
                            </span>
                          </div>
                        </div>
                        {/* 우측 액션들 */}
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          {!isRootNode && (
                            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 rounded-full shadow-sm">
                              <span 
                                className={`text-[11px] font-bold transition-colors select-none cursor-pointer ${!currentNode.isExcluded ? 'text-[#37352f] dark:text-neutral-200' : 'text-[#787774] dark:text-neutral-500'}`}
                                onClick={() => {
                                  if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) {
                                    alert("상속인을 먼저 입력해주세요. 입력이 완료되면 자동으로 스위치가 켜집니다.");
                                    return;
                                  }
                                  const nextVal = !currentNode.isExcluded;
                                  handleUpdate(currentNode.id, { isExcluded: nextVal, exclusionOption: nextVal ? '' : 'renounce' });
                                }}
                              >
                                {(() => {
                                  if (currentNode.isExcluded) return '상속권 없음';
                                  // 💡 사망일 비교를 통해 대습/재상속 용어 자동 선택
                                  const pDeathDate = activeTabObj?.parentNode?.id === 'root' ? tree.deathDate : activeTabObj?.parentNode?.deathDate;
                                  const isPre = currentNode?.deathDate && pDeathDate && isBefore(currentNode.deathDate, pDeathDate);
                                  const isExcludedDaeseup = currentNode?.isExcluded && ['lost', 'disqualified'].includes(currentNode?.exclusionOption);
                                  
                                  return (isPre || isExcludedDaeseup) ? '대습상속' : '재상속';
                                })()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // 💡 스위치 버튼 클릭 시에도 동일한 방어 로직 적용
                                  if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) {
                                    alert("상속인을 먼저 입력해주세요. 입력이 완료되면 자동으로 스위치가 켜집니다.");
                                    return;
                                  }
                                  const nextVal = !currentNode.isExcluded;
                                  handleUpdate(currentNode.id, { isExcluded: nextVal, exclusionOption: nextVal ? '' : 'renounce' });
                                }}
                                className={`relative inline-flex h-3.5 w-6 items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
                                  !currentNode.isExcluded ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'
                                }`}
                              >
                                <span className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-sm transition duration-200 ${!currentNode.isExcluded ? 'translate-x-2.5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                          )}
                          {/* 💡 복구된 기능: 상속인 불러오기 (배우자나 자녀 탭에서만 활성화됨) */}
                          {(canAutoFillSp || canAutoFillChild) && (
                            <button 
                              type="button"
                              onClick={handleAutoFill}
                              className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"
                              title="상위 단계의 동일한 상속인 명단을 그대로 가져옵니다"
                            >
                              <IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 불러오기
                            </button>
                          )}

                          <button 
                            type="button"
                            onClick={() => {
                              setIsMainQuickActive(!isMainQuickActive);
                              if(!isMainQuickActive) {
                                setIsFolderFocused(true);
                                setTimeout(() => document.querySelector('input[placeholder*="한꺼번에"]')?.focus(), 100);
                              }
                            }}
                            className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"
                          >
                            <IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 상속인 추가
                          </button>
                        </div>
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
                          <div className="w-[68px] shrink-0 text-center ml-[10px]"><span className="relative left-[15px]">상태</span></div>
                          <div className="w-[72px] shrink-0 text-center ml-[50px]"><span className="relative left-[-20px]">성명</span></div>
                          <div className="w-[96px] shrink-0 text-center ml-[30px]"><span className="relative left-[-30px]">관계</span></div>
                          <div className="w-[150px] shrink-0 text-center ml-[30px]"><span className="relative left-[-40px]">사망여부/일자</span></div>
                          <div className="w-[180px] shrink-0 text-center ml-[10px] relative">
                            <span className="relative left-[-20px]">특수조건 (가감산)</span>
                          </div>
                          <div className="w-[180px] shrink-0 text-center ml-[10px] relative">
                            <span className="whitespace-nowrap relative left-[-10px] inline-flex items-center">
                              재/대습상속
                              {/* 🗑️ 상속인 전체 삭제 버튼 (간격 조정: 글씨 왼쪽 5px, 아이콘 오른쪽 5px 이동) */}
                              <button
                                type="button"
                                title="현재 탭 상속인 전체 삭제"
                                onClick={() => {
                                  if (!nodeHeirs || nodeHeirs.length === 0) {
                                    alert('삭제할 상속인이 없습니다.');
                                    return;
                                  }
                                  if (window.confirm('🚨 현재 탭에 입력된 [모든 상속인]을 정말 삭제하시겠습니까?\n(하위에 입력된 데이터까지 모두 함께 삭제됩니다!)')) {
                                    setTree(prev => {
                                      const cloneTree = JSON.parse(JSON.stringify(prev));

                                      // 💡 트리를 끝까지 순회하며 일치하는 모든 분신의 자식들을 무자비하게 비웁니다!
                                      const clearAll = (n) => {
                                        if (n.id === activeDeceasedTab || n.personId === activeDeceasedTab) {
                                          n.heirs = []; 
                                        }
                                        // return true 로 멈추지 않고 하위 노드까지 무조건 계속 스캔합니다.
                                        if (n.heirs && n.heirs.length > 0) {
                                          n.heirs.forEach(child => clearAll(child));
                                        }
                                      };

                                      clearAll(cloneTree);
                                      return cloneTree;
                                    });
                                  }                                }}
                                className="ml-[30px] p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                              >
                                <IconTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
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
                                finalShares={finalShares}
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
                                isRootChildren={activeDeceasedTab === 'root'}
                                parentNode={currentNode} // 💡 추가: 현재 탭 주인의 정보를 넘겨줍니다!
                                onTabClick={(id) => {
                                  let targetPId = id;
                                  const findPId = (n) => {
                                    if (n.id === id) targetPId = n.personId;
                                    if (n.heirs) n.heirs.forEach(findPId);
                                  };
                                  findPId(tree);
                                  setActiveDeceasedTab(targetPId);
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
                                                      ? '대습상속인을 입력해주세요. 미혼이나 무자녀라면 상단의 [대습상속] 스위치를 OFF 해주세요.'
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
                    {results.length > 0 ? results.map((r, i) => {
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
                    }) : (
                      <tr>
                        <td colSpan="3" className="border border-[#e9e9e7] dark:border-neutral-700 p-8 text-center text-[#b45309] dark:text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/10">
                          최종 생존 상속인이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            );
          })()}

          {activeTab === 'summary' && (() => {
            const shareByPersonId = new Map();
            (finalShares.direct || []).forEach(s => shareByPersonId.set(s.personId, s));
            (finalShares.subGroups || []).forEach(g => g.shares.forEach(s => shareByPersonId.set(s.personId, s)));

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

            // 💡 리팩토링: useSmartGuide에서 이미 계산된 값을 사용하도록 전면 교체
            const [totalSumN, totalSumD] = (() => {
              let tn = 0, td = 1;
              const addShare = (s) => {
                if (s && s.n > 0) {
                  const [nn, nd] = math.add(tn, td, s.n, s.d);
                  tn = nn; td = nd;
                }
              };
              topDirect.forEach(addShare);
              const traverseGroup = (g) => {
                g.directShares.forEach(addShare);
                g.subGroups.forEach(traverseGroup);
              };
              topGroups.forEach(traverseGroup);
              return math.simplify(tn, td);
            })();

            const isMatch = !showGlobalWarning;
            const mismatchReasons = globalMismatchReasons;

            const renderShareRow = (f, depth, groupAncestorId = null) => {
              const pl = `${12 + (depth > 0 ? 16 : 0)}px`; 
              const rowId = groupAncestorId ? `summary-row-${f.personId}-${groupAncestorId}` : `summary-row-${f.personId}`;
              const isCurrentMatch = matchIds[currentMatchIdx] === rowId;
              const isMatch = matchIds.includes(rowId);

              return (
                <tr 
                  key={'sr-'+f.id} 
                  id={rowId}
                  className={`transition-colors duration-300 ${
                    isCurrentMatch 
                      ? 'bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-l-yellow-500' 
                      : isMatch
                      ? 'bg-yellow-50/50 dark:bg-yellow-900/20'
                      : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20'
                  }`}
                >
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
                  {group.directShares.map(f => renderShareRow(f, depth + 1, group.ancestor.id))}
                  {group.subGroups.map(sg => renderGroup(sg, depth + 1))}
                </React.Fragment>
              );
            };

            return (
              <div className="w-full text-[#37352f] dark:text-neutral-200">
                <div className="mb-4 flex items-center justify-between no-print">
                  <div className="flex items-center gap-6">
                    <h2 className="text-lg font-black text-[#37352f] dark:text-neutral-200 flex items-center gap-2">
                      <IconList className="w-5 h-5 text-[#787774]"/> 지분 요약표
                    </h2>
                    
                    {/* 💡 요약표 상속인 검색창 (가이드에 따른 최종 버전) */}
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-full px-3 py-1.5 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30">
                      <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input
                        type="text"
                        placeholder="이름 검색"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-[13px] w-16 focus:w-28 transition-all duration-300 text-[#37352f] dark:text-neutral-200 placeholder-neutral-400"
                      />
                      {matchIds.length > 0 && (
                        <div className="flex items-center gap-1.5 border-l border-neutral-200 dark:border-neutral-700 pl-2 ml-1 animate-fadeIn">
                          <span className="text-[11px] text-neutral-500 font-medium min-w-[24px] text-center">
                            {currentMatchIdx + 1} / {matchIds.length}
                          </span>
                          <div className="flex items-center">
                            <button onClick={handlePrevMatch} title="이전 찾기" className="p-0.5 text-neutral-400 hover:text-[#37352f] dark:hover:text-white transition-colors rounded">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button onClick={handleNextMatch} title="다음 찾기" className="p-0.5 text-neutral-400 hover:text-[#37352f] dark:hover:text-white transition-colors rounded">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
                        {(() => {
                          const sumVal = totalSumD ? totalSumN / totalSumD : 0;
                          const targetVal = simpleTargetD ? simpleTargetN / simpleTargetD : 1;
                          
                          if (totalSumN === 0) {
                            return <span className="text-[#b45309] dark:text-amber-500 font-bold">⚠️ 상속인이 입력되지 않았거나, 모두 사망/제외되어 생존 상속인이 없습니다.</span>;
                          } else if (sumVal === targetVal) {
                            if (mismatchReasons && mismatchReasons.length > 0) {
                              return <span className="text-red-500 font-bold">⚠️ 합계는 일치하나, 하위 대습상속인 누락이 의심됩니다. (아래 안내 참조)</span>;
                            }
                            return <span className="text-[#504f4c] dark:text-neutral-300">✔️ 피상속인 지분과 일치 ({simpleTargetN}/{simpleTargetD})</span>;
                          } else if (sumVal < targetVal) {
                            return <span className="text-red-500 font-bold">⚠️ 지분 합계 미달 (누락된 지분이 있습니다. 아래 안내 참조)</span>;
                          } else {
                            return <span className="text-red-500 font-bold">⚠️ 지분 합계 초과 (오류)</span>;
                          }
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* 💡 표 바깥으로 분리된 불일치 경고 메시지 영역 */}
                {!isMatch && mismatchReasons.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 no-print">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 dark:text-red-400 font-bold text-[14px]">⚠️ 상속 지분 배분 안내</span>
                    </div>
                    <ul className="list-disc pl-5 text-[#c93f3a] dark:text-red-400 space-y-1.5 text-[13px] font-medium leading-relaxed">
                      {mismatchReasons.map((r, idx) => (
                        <li 
                          key={idx} 
                          onClick={() => r.id && r.id !== 'root' ? handleNavigate(r.id) : null}
                          className={`transition-all ${r.id && r.id !== 'root' ? 'cursor-pointer hover:underline decoration-red-400 underline-offset-4' : ''}`}
                          title={r.id && r.id !== 'root' ? "클릭 시 해당 상속인 위치로 이동합니다" : ""}
                        >
                          {r.text || r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>
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
      </main>
    </div>
  );
}

export default App;
