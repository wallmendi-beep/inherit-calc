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
import PrintReport from './components/PrintReport';
import { math, getLawEra, getRelStr, formatKorDate, formatMoney, isBefore } from './engine/utils';
import { calculateInheritance } from './engine/inheritance';
import { getInitialTree, getEmptyTree } from './utils/initialData';
import { useSmartGuide } from './hooks/useSmartGuide';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { QRCodeSVG } from 'qrcode.react'; // 💡 v3.0 오프라인 QR 생성기

// ============================================================================
// 🚀 [v3.0 코어 엔진] 맥락 기반 저장 및 파생(Derived) 조립기
// ============================================================================

// 1️⃣ 저장(마이그레이션) 엔진: 상태값은 버리고 오직 절대 '팩트(Fact)'만 중앙 창고에 보관
export const migrateToVault = (oldTree) => {
  const vault = {
    meta: {
      caseNo: oldTree.caseNo || '',
      rootPersonId: oldTree.personId || oldTree.id || 'root',
      targetShareN: oldTree.shareN || 1,
      targetShareD: oldTree.shareD || 1,
    },
    persons: {},
    relationships: {}
  };

  const traverse = (node, parentId = null) => {
    if (!node) return;
    const pId = node.personId || node.id || `p_${Math.random().toString(36).substr(2,9)}`;
    if (node.id === 'root') vault.meta.rootPersonId = pId;

    // 💡 팩트 저장: 신상 정보는 변하지 않는 진실이므로 그대로 보관
    if (!vault.persons[pId]) {
      vault.persons[pId] = {
        id: pId, name: node.name || '', isDeceased: !!node.isDeceased,
        deathDate: node.deathDate || '', marriageDate: node.marriageDate || '',
        remarriageDate: node.remarriageDate || '', gender: node.gender || ''
      };
    } else {
      const p = vault.persons[pId];
      if (!p.deathDate && node.deathDate) p.deathDate = node.deathDate;
      if (!p.marriageDate && node.marriageDate) p.marriageDate = node.marriageDate;
      if (!p.name && node.name) p.name = node.name;
    }

    // 💡 법적 결단 저장: 포기, 결격, 호주 등 인간이 의도적으로 조작한 스위치만 보존
    if (parentId) {
      if (!vault.relationships[parentId]) vault.relationships[parentId] = [];
      const isManualExclusion = node.exclusionOption === 'renounce' || node.exclusionOption === 'disqualified' || node.exclusionOption === 'predeceased';
      
      const existingLink = vault.relationships[parentId].find(link => link.targetId === pId);
      if (!existingLink) {
        vault.relationships[parentId].push({
          targetId: pId, relation: node.relation || 'son',
          isExcluded: isManualExclusion ? true : !!node.isExcluded, 
          exclusionOption: isManualExclusion ? node.exclusionOption : '',
          isHoju: !!node.isHoju, isSameRegister: node.isSameRegister !== false
        });
      }
    }
    if (node.heirs) node.heirs.forEach(child => traverse(child, pId));
  };
  traverse(oldTree);
  return vault;
};


// 2️⃣ 불러오기(조립) 엔진: 보관된 팩트를 꺼내어 현재 타임라인(맥락)에 맞게 스위치를 자동 해석!
export const buildTreeFromVault = (vault) => {
  if (!vault || !vault.meta) return null;
  const rootId = vault.meta.rootPersonId;
  const rootPerson = vault.persons[rootId];
  if (!rootPerson) return null;

  const buildNode = (personId, parentDeathDate = null, visited = new Set()) => {
    if (visited.has(personId)) return null;
    // 분신(클론) 구조상 같은 personId가 다른 브랜치에 독립적으로 존재할 수 있으므로
    // 브랜치마다 Set을 독립 복사해야 한다 (공유 시 형제 브랜치의 방문이 차단됨)
    const newVisited = new Set(visited);
    newVisited.add(personId);
    const person = vault.persons[personId];
    if (!person) return null;

    const node = { ...person, personId: personId, heirs: [] };
    if (personId === rootId) {
      node.caseNo = vault.meta.caseNo; node.shareN = vault.meta.targetShareN;
      node.shareD = vault.meta.targetShareD; node.id = 'root';
    }

    const effectiveDate = parentDeathDate || node.deathDate; // 타임라인 추적
    const links = vault.relationships[personId] || [];

    links.forEach(link => {
      const childPerson = vault.persons[link.targetId];
      const nextEffectiveDate = (childPerson?.deathDate && !isBefore(childPerson.deathDate, effectiveDate)) 
                                ? childPerson.deathDate : effectiveDate;
                                
      const childNode = buildNode(link.targetId, nextEffectiveDate, newVisited);
      if (childNode) {
        childNode.id = `n_${personId}_${link.targetId}`;
        childNode.relation = link.relation;
        childNode.isHoju = link.isHoju;
        
        // 💡 [실시간 맥락 해석기] 스위치 자동 세팅 로직
        const isPreDeceased = childNode.deathDate && effectiveDate && isBefore(childNode.deathDate, effectiveDate);
        const hasHeirs = childNode.heirs && childNode.heirs.length > 0;
        const isSpouseType = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(childNode.relation);
        const isDaughter = ['daughter', '딸'].includes(childNode.relation);

        childNode.isExcluded = link.isExcluded;
        childNode.exclusionOption = link.exclusionOption;

        if (isPreDeceased && !isSpouseType) {
          childNode.isExcluded = true; 
          childNode.exclusionOption = 'predeceased'; 
        }
        
        if (isDaughter && childNode.marriageDate && effectiveDate && isBefore(childNode.marriageDate, effectiveDate)) {
          childNode.isSameRegister = false; 
        } else {
          childNode.isSameRegister = link.isSameRegister;
        }

        node.heirs.push(childNode);
      }
    });
    return node;
  };
  return buildNode(rootId, rootPerson.deathDate);
};
// ============================================================================

const getWarningState = (n, rootDeathDate, level = 1) => {
  if (!n) return { isDirect: false, hasDescendant: false };
  if (n.isExcluded && (n.exclusionOption === 'no_heir' || n.exclusionOption === 'renounce' || !n.exclusionOption)) {
    return { isDirect: false, hasDescendant: false };
  }
  const isRootSpouse = level === 1 && ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(n.relation);
  const isPreDeceasedSpouse = isRootSpouse && n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);
  const requiresHeirsIfExcluded = n.isExcluded && ['lost', 'disqualified'].includes(n.exclusionOption);
  const requiresHeirsIfDeceased = !n.isExcluded && n.isDeceased && !isPreDeceasedSpouse;
  const isDirect = n.id !== 'root' && (requiresHeirsIfExcluded || requiresHeirsIfDeceased) && (!n.heirs || n.heirs.length === 0);
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
  const hasMatchingDescendant = React.useMemo(() => {
    if (!searchQuery || !matchIds || matchIds.length === 0) return false;
    const check = (n) => {
      if (matchIds.includes(n.id)) return true;
      if (n.heirs) return n.heirs.some(check);
      return false;
    };
    return node.heirs ? node.heirs.some(check) : false;
  }, [node, matchIds, searchQuery]);

  React.useEffect(() => {
    if (toggleSignal > 0) setIsExpanded(true);
    else if (toggleSignal < 0) setIsExpanded(level === 0);
  }, [toggleSignal, level]);

  React.useEffect(() => {
    if (hasMatchingDescendant) setIsExpanded(true);
  }, [hasMatchingDescendant]);

  if (!node) return null;
  const status = guideStatusMap?.[node.id] || guideStatusMap?.[node.name] || {};
  const showMandatory = status.mandatory || (!isExpanded && status.childMandatory);
  const showRecommended = !showMandatory && (status.recommended || (!isExpanded && status.childRecommended));
  const warningTitle = status.mandatory ? "하위 상속인 입력 누락 의심 (필수 조치 필요)" : "하위 상속인 중 입력 누락 의심 (펼쳐서 확인하세요)";
  
  const getStatusStyle = (node, hasSubHeirs) => {
    const isAlive = !node.deathDate && !node.isDeceased;
    let colorClass = isAlive ? 'text-[#1e56a0] dark:text-[#60a5fa]' : 'text-black dark:text-white'; 
    let underlineClass = hasSubHeirs ? 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4' : '';
    return `${colorClass} ${underlineClass}`;
  };

  const hasHeirs = node.heirs && node.heirs.length > 0;
  const itemStyleClass = getStatusStyle(node, hasHeirs);
  const highlightStyle = isCurrentMatch ? 'bg-yellow-200 dark:bg-yellow-800 ring-2 ring-yellow-400 dark:ring-yellow-500 font-black' : isMatch ? 'bg-yellow-100 dark:bg-yellow-900/50' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded';

  if (node.name && level > 0) visitedHeirs.add(node.name);

  return (
    <div className={`flex flex-col ${level > 0 ? 'ml-3' : ''}`}>
      <div className="flex items-center gap-1.5 py-1 pr-1 group">
        {level > 0 && <span className="text-[#d4d4d4] dark:text-neutral-600 text-[12px] shrink-0 font-bold opacity-40">└</span>}
        <span id={`sidebar-node-${node.id}`} onClick={() => { if (hasHeirs) setIsExpanded(!isExpanded); onSelectNode && onSelectNode(node.id); }} className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer ${itemStyleClass} ${highlightStyle}`}>{node.name || (level === 0 ? '피상속인' : '(이름 없음)')}</span>
        <div className="flex items-center gap-1 shrink-0">
          {showMandatory && <span className="text-[12px] cursor-help opacity-100" title={warningTitle}>🚨</span>}
          {!showMandatory && showRecommended && <span className="text-[12px] cursor-help opacity-100" title="권고 사항 (팁)">💡</span>}
          {level > 0 && (() => {
            const isSpouse = ['wife', 'husband', 'spouse', '처', '남편', '배우자'].includes(node.relation);
            const isPre = node.isDeceased && node.deathDate && deathDate && isBefore(node.deathDate, deathDate) && !isSpouse;
            return <span className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${isPre ? 'text-[#787774]' : 'text-[#37352f] dark:text-neutral-100 font-bold opacity-100'}`}>[{getRelStr(node.relation, deathDate) || '자녀'}]</span>;
          })()}
        </div>
      </div>
      {isExpanded && hasHeirs && (
        <div className="border-l border-[#e9e9e7] dark:border-neutral-700 ml-1.5 pl-1.5 pb-1 transition-colors">
          {node.heirs.map((h, i) => (
            <MiniTreeView key={h.id || i} node={h} level={level + 1}
              onSelectNode={onSelectNode} visitedHeirs={visitedHeirs} deathDate={node.deathDate || deathDate} toggleSignal={toggleSignal}
              searchQuery={searchQuery} matchIds={matchIds} currentMatchId={currentMatchId} guideStatusMap={guideStatusMap}
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

  const stickerRef = useRef(null);
  const stickerPos = useRef({ x: 0, y: 0 });
  const [isStickerDragging, setIsStickerDragging] = useState(false);

  const handleStickerMouseDown = (e) => {
    e.preventDefault(); 
    setIsStickerDragging(true);
    const startX = e.clientX - stickerPos.current.x;
    const startY = e.clientY - stickerPos.current.y;
    const handleMouseMove = (moveEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;
      stickerPos.current = { x: newX, y: newY };
      if (stickerRef.current) stickerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };
    const handleMouseUp = () => {
      setIsStickerDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };
  
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
    tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '피상속인', node: tree, parentName: null, level: 0, branchRootId: null });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
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

  // ⌨️ [v3.0] 키보드 네비게이션 및 단축키 핸들러 복구
  const handleKeyDown = (e) => {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!navKeys.includes(e.key)) return;
    if (isResetModalOpen) return;

    // input, select, button 요소들만 추출 (인쇄 제외)
    const all = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
    const i = all.indexOf(e.target);
    if (i === -1) return;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        e.preventDefault(); if (i > 0) all[i-1].focus();
      } else {
        e.preventDefault(); if (i < all.length - 1) all[i+1].focus();
      }
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'Enter') { 
      e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); if (i > 0) all[i-1].focus(); 
    } 
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const row = e.target.closest('.group\\/row, .nav-row, .grid');
      if (!row) return;
      const rowEls = Array.from(row.querySelectorAll('input:not([type="hidden"]), select, button:not(.no-print)'));
      const ri = rowEls.indexOf(e.target);
      if (e.key === 'ArrowLeft' && ri > 0) { e.preventDefault(); rowEls[ri-1].focus(); }
      else if (e.key === 'ArrowRight' && ri < rowEls.length-1) { e.preventDefault(); rowEls[ri+1].focus(); }
    }
  };

  const [treeToggleSignal, setTreeToggleSignal] = useState(0); 
  const [isAllExpanded, setIsAllExpanded] = useState(false); 
  const [showNavigator, setShowNavigator] = useState(true);
  const [isNavigatorRolledUp, setIsNavigatorRolledUp] = useState(false);

  const handleNavigate = (nodeId) => {
    setActiveTab('input');
    if (typeof nodeId === 'string' && nodeId.startsWith('tab:')) {
      const targetTabId = nodeId.split(':')[1];
      setActiveDeceasedTab(targetTabId);
      setIsFolderFocused(true);
      return;
    }
    const findTabIdForNode = (currentNode, currentTabId) => {
      if (currentNode.id === nodeId || currentNode.personId === nodeId) return currentTabId;
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          if (h.id === nodeId || h.personId === nodeId) return currentTabId;
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

  const findDuplicates = (node, name, excludeId, results = []) => {
    if (!name || name.trim() === '') return results;
    if (node.id !== excludeId && node.name === name.trim()) results.push(node);
    if (node.heirs) node.heirs.forEach(h => findDuplicates(h, name, excludeId, results));
    return results;
  };

  const findParentNode = (root, targetId) => {
    if (root.heirs && root.heirs.some(h => h.id === targetId)) return root;
    if (root.heirs) { for (const h of root.heirs) { const p = findParentNode(h, targetId); if (p) return p; } }
    return null;
  };

  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) return;
    const names = value.split(/[,，、\s]+/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setTree(prev => {
      let newTree = JSON.parse(JSON.stringify(prev));
      const usedNames = new Set((parentNode.heirs || []).map(h => h.name));
      let targetPersonId = parentId;
      const findPId = (n) => { if (n.id === parentId) targetPersonId = n.personId; if (n.heirs) n.heirs.forEach(findPId); };
      findPId(newTree);
      const hasSpouse = (parentNode.heirs || []).some(h => ['wife', 'husband', 'spouse'].includes(h.relation));
      const isParentFemale = parentNode.gender === 'female' || ['wife', 'daughter', 'mother', 'sister'].includes(parentNode.relation); 
      const newHeirsBase = [];
      names.forEach((name, idx) => {
        const isSpouse = idx === 0 && !hasSpouse;
        let finalName = name;
        if (usedNames.has(finalName)) { let suffix = 2; while(usedNames.has(`${name}(${suffix})`)) suffix++; finalName = `${name}(${suffix})`; }
        usedNames.add(finalName);
        newHeirsBase.push({ baseId: `h_${Date.now()}_${idx}`, personId: `p_${Date.now()}_${idx}`, name: finalName, relation: isSpouse ? (isParentFemale ? 'husband' : 'wife') : 'son', isDeceased: false, isSameRegister: true, heirs: [] });
      });
      const syncAllClones = (node) => {
        if (node.id === parentId || node.personId === targetPersonId) {
          if (!node.isDeceased) node.isDeceased = true;
          node.isExcluded = false; node.exclusionOption = ''; node.heirs = node.heirs || [];
          newHeirsBase.forEach(baseHeir => { node.heirs.push({ ...baseHeir, id: `${baseHeir.baseId}_${Math.random().toString(36).substr(2,4)}` }); });
        }
        if (node.heirs) node.heirs.forEach(syncAllClones);
      };
      syncAllClones(newTree);
      return newTree;
    });
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
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
  const startX = React.useRef(0);
  const startWidth = React.useRef(0);

  const handleResizeMouseDown = (e) => {
    isResizing.current = true; startX.current = e.clientX; startWidth.current = sidebarWidth; e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => { if (!isResizing.current) return; const delta = e.clientX - startX.current; const newWidth = Math.min(480, Math.max(160, startWidth.current + delta)); setSidebarWidth(newWidth); };
    const onMouseUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
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

  const handleUpdate = (id, changes, value) => {
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };
    const field = typeof changes === 'string' ? changes : Object.keys(changes)[0];
    const val = updates[field];
    if (field === 'name' && val && val.trim() !== '') {
      const trimmedValue = val.trim(); const baseName = trimmedValue.replace(/\(\d+\)$/, ''); const dups = findDuplicates(tree, trimmedValue, id);
      const allSameBaseDups = dups.length > 0 ? (() => { const r = []; const scan = (n) => { if (n.id !== id && n.name && (n.name === baseName || n.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)$`)))) r.push(n); if (n.heirs) n.heirs.forEach(scan); }; scan(tree); return r; })() : [];
      if (dups.length > 0) {
        const existingNode = dups[0]; const parentNodeOfExisting = findParentNode(tree, existingNode.id); const parentNodeOfCurrent = findParentNode(tree, id);
        if (parentNodeOfExisting?.id === parentNodeOfCurrent?.id) { setDuplicateRequest({ name: trimmedValue, parentName: parentNodeOfExisting?.name || '피상속인', relation: existingNode.relation, isSameBranch: true, onConfirm: (isSame) => { if (isSame) alert(`'${trimmedValue}'님은 이미 이 단계의 상속인으로 등록되어 있습니다.\n동일인이라면 한 번만 등록해 주세요.`); else { setTree(prev => { const renameBase = (n) => { if (n.id === existingNode.id && n.name === baseName) return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] }; return { ...n, heirs: n.heirs?.map(renameBase) || [] }; }; return renameBase(prev); }); const nextSuffix = allSameBaseDups.length + 1; applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false); } setDuplicateRequest(null); }, onCancel: () => setDuplicateRequest(null) }); return; }
        const parentName = parentNodeOfExisting ? (parentNodeOfExisting.name || '피상속인') : '피상속인';
        setDuplicateRequest({ name: trimmedValue, parentName, relation: existingNode.relation, isSameBranch: false, onConfirm: (isSame) => { if (isSame) { const syncIdInTree = (n) => { if (n.id === id) return { ...n, name: trimmedValue, personId: existingNode.personId }; return { ...n, heirs: n.heirs?.map(syncIdInTree) || [] }; }; setTree(prev => syncIdInTree(prev)); } else { setTree(prev => { const renameBase = (n) => { if (n.id === existingNode.id && n.name === baseName) return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] }; return { ...n, heirs: n.heirs?.map(renameBase) || [] }; }; return renameBase(prev); }); const nextSuffix = allSameBaseDups.length + 1; applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false); } setDuplicateRequest(null); }, onCancel: () => setDuplicateRequest(null) }); return;
      }
    }
    if (field === 'relation') {
      const isFemale = ['daughter', 'mother', 'sister', 'wife'].includes(val); const isMale = ['son', 'father', 'brother', 'husband'].includes(val);
      if (isFemale || isMale) {
        let targetPersonId = null; const findPId = (n) => { if (n.id === id) targetPersonId = n.personId; if (!targetPersonId && n.heirs) n.heirs.forEach(findPId); }; findPId(tree);
        setTree(prevTree => { const syncRelation = (n) => { let nextNode = { ...n }; if (nextNode.id === id || (targetPersonId && nextNode.personId === targetPersonId)) { const newHeirs = (nextNode.heirs || []).map(h => { if (['wife', 'husband', 'spouse'].includes(h.relation)) return { ...h, relation: isFemale ? 'husband' : 'wife' }; return h; }); nextNode = { ...nextNode, relation: val, heirs: newHeirs }; } if (nextNode.heirs) nextNode.heirs = nextNode.heirs.map(syncRelation); return nextNode; }; return syncRelation(prevTree); }); return;
      }
    }
    if (field === 'isHoju' && val === true) { setTree(prev => { const updateSingleHoju = (n) => { if (n.heirs && n.heirs.some(h => h.id === id)) return { ...n, heirs: n.heirs.map(h => ({ ...h, isHoju: h.id === id ? true : false })) }; return { ...n, heirs: n.heirs?.map(updateSingleHoju) || [] }; }; return updateSingleHoju(prev); }); }
    setVault(prev => {
      let targetPersonId = id; let parentPersonId = null;
      const findNode = (n, pId) => { if (n.id === id) { targetPersonId = n.personId; parentPersonId = pId; return true; } return (n.heirs || []).some(child => findNode(child, n.personId)); }; findNode(tree, null);
      const personalKeys = ['name', 'isDeceased', 'deathDate', 'marriageDate', 'remarriageDate', 'gender'];
      personalKeys.forEach(k => { if (updates[k] !== undefined) prev.persons[targetPersonId][k] = updates[k]; });
      const linkKeys = ['relation', 'isExcluded', 'exclusionOption', 'isHoju', 'isSameRegister'];
      if (parentPersonId && prev.relationships[parentPersonId]) { const link = prev.relationships[parentPersonId].find(l => l.targetId === targetPersonId); if (link) { linkKeys.forEach(k => { if (updates[k] !== undefined) link[k] = updates[k]; }); } }
      return prev;
    });
  };

  const applyUpdate = (id, changes, value, syncGlobal = false, syncName = '') => {
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };
    let targetPersonId = null; let targetNode = null;
    const findPersonId = (n) => { if (n.id === id) { targetPersonId = n.personId; targetNode = n; } if (!targetPersonId && n.heirs) n.heirs.forEach(findPersonId); }; findPersonId(tree);
    const personalFields = ['name', 'isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    const hasPersonalUpdate = Object.keys(updates).some(k => personalFields.includes(k));
    const isExclusionUpdate = updates.isExcluded !== undefined;
    const isDeadWithoutHeirs = targetNode?.isDeceased && (!targetNode?.heirs || targetNode?.heirs.length === 0);
    const updateNode = (n) => {
      if (n.id === id) return { ...n, personId: targetPersonId || n.personId, ...updates };
      else if (targetPersonId && n.personId === targetPersonId) {
         const filteredUpdates = {};
         if (hasPersonalUpdate) Object.keys(updates).forEach(k => { if (personalFields.includes(k)) filteredUpdates[k] = updates[k]; });
         if (isExclusionUpdate && isDeadWithoutHeirs && (!n.heirs || n.heirs.length === 0)) { filteredUpdates.isExcluded = updates.isExcluded; if (updates.exclusionOption !== undefined) filteredUpdates.exclusionOption = updates.exclusionOption; }
         if (Object.keys(filteredUpdates).length > 0) return { ...n, ...filteredUpdates };
      }
      return { ...n, heirs: n.heirs?.map(updateNode) || [] };
    };
    setTree(prev => updateNode(prev));
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
      prev.persons[newPersonId] = { id: newPersonId, name: '', isDeceased: false, deathDate: '', marriageDate: '', remarriageDate: '', gender: '' };
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

  const { finalShares, calcSteps, warnings } = useMemo(() => {
    const preprocessTree = (n, parentDate, parentNode) => {
      const clone = { ...n }; const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      if (clone.id !== 'root' && !clone.isExcluded) {
        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate); const isDeadWithoutHeirs = clone.isDeceased && (!clone.heirs || clone.heirs.length === 0);
        if (isPre && isDeadWithoutHeirs) { clone.isExcluded = true; clone.exclusionOption = 'renounce'; }
        else if (!isPre && isDeadWithoutHeirs && parentNode) {
          const isSpouseType = ['wife', 'husband', 'spouse'].includes(clone.relation);
          if (!isSpouseType) {
            const pHeirs = parentNode.heirs || []; const aliveAscendants = pHeirs.filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && (!h.isDeceased || (h.deathDate && isBefore(clone.deathDate, h.deathDate))) && !h.isExcluded);
            if (aliveAscendants.length > 0) clone.heirs = aliveAscendants.map(asc => ({ ...asc, id: `auto_${asc.id}`, relation: 'parent', heirs: [] }));
            
            // 🚨 바로 아랫줄! node.id 라고 오타가 나 있던 것을 clone.id 로 수정했습니다.
            else { const siblings = pHeirs.filter(h => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded); if (siblings.length > 0) clone.heirs = siblings.map(sib => ({ ...sib, id: `auto_${sib.id}`, relation: 'sibling', heirs: [] })); }
            
          } else { const stepChildren = parentNode.heirs.filter(h => h.id !== clone.id && ['son', 'daughter'].includes(h.relation) && !h.isExcluded); if (stepChildren.length > 0) clone.heirs = stepChildren.map(child => ({ ...child, id: `auto_${child.id}`, relation: child.relation, heirs: [] })); }
        }
      }
      if (clone.heirs) clone.heirs = clone.heirs.map(h => preprocessTree(h, clone.deathDate || refDate, clone));
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

  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings);
  const { showGlobalWarning, showAutoCalcNotice, globalMismatchReasons, autoCalculatedNames, noSurvivors } = guideInfo || {};

  const multipleSpouseGuides = useMemo(() => {
    const guides = []; const checkSpouses = (node) => { const spouses = (node.heirs || []).filter(h => ['wife', 'husband', 'spouse'].includes(h.relation) && !h.isExcluded); if (spouses.length > 1) { guides.push({ id: node.id, uniqueKey: `multi-spouse-${node.personId}`, targetTabId: node.personId, type: 'mandatory', text: `[${node.name || '이름없음'}] 유효 배우자가 중복 입력되었습니다. 실제 상속받을 1명 외에는 제외 처리해 주세요.` }); } if (node.heirs) node.heirs.forEach(checkSpouses); };
    checkSpouses(tree); return guides;
  }, [tree]);

  const hojuMissingGuides = useMemo(() => {
    const guides = [];
    const checkHoju = (node) => {
      if (node.isDeceased && node.heirs && node.heirs.length > 0) {
        const hasHoju = node.heirs.some(h => h.isHoju && !h.isExcluded);
        const needsHoju = getLawEra(node.deathDate) !== '1991' && (node.id === 'root' || ['son', '아들'].includes(node.relation));
        if (needsHoju && !hasHoju) {
          guides.push({
            id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
            text: `[${node.name || '이름없음'}] 구법(${node.deathDate || '날짜 미상'} 사망) 적용 대상입니다. 하위 상속인 중 호주상속인을 지정해 주세요.`
          });
        }
      }
      if (node.heirs) node.heirs.forEach(checkHoju);
    };
    checkHoju(tree);
    return guides;
  }, [tree]);

  // 💡 [논리적 모순 및 필수 조치 감지 센서]
  const logicalMismatchGuides = useMemo(() => {
    const guides = [];

    if (!tree.name || !tree.name.trim()) {
      guides.push({ id: 'root', uniqueKey: 'missing-root-name', targetTabId: 'root', type: 'mandatory', text: '피상속인의 성명 및 사망일자를 먼저 입력해 주세요.' });
    } else if (!tree.deathDate) {
      guides.push({ id: 'root', uniqueKey: 'missing-root-death', targetTabId: 'root', type: 'mandatory', text: `[${tree.name || '이름없음'}]님의 사망일자를 입력해 주세요. (사망일자 기준으로 적용 법령이 결정됩니다)` });
    }

    const checkMismatch = (node, parentDeathDate, parentPersonId) => {
      const effectiveDate = parentDeathDate || tree.deathDate;
      const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);

      // 1. 출가녀 스위치 (부모 탭으로 이동)
      if (node.relation === 'daughter' && node.marriageDate && effectiveDate) {
        if (isBefore(node.marriageDate, effectiveDate) && node.isSameRegister !== false) {
          guides.push({ id: node.id, uniqueKey: `mismatch-married-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름없음'}] 혼인일(${node.marriageDate})이 상속개시일(${effectiveDate}) 이전입니다. [출가] 스위치를 켜주세요.` });
        }
      }

      // 2. 선사망 스위치 (부모 탭으로 이동)
      if (node.deathDate && effectiveDate && isBefore(node.deathDate, effectiveDate) && !isSpouse) {
        if (!node.isExcluded || node.exclusionOption !== 'predeceased') {
          guides.push({ id: node.id, uniqueKey: `mismatch-predeceased-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름없음'}] 본인 사망(${node.deathDate})이 부모 사망(${effectiveDate})보다 먼저 발생했습니다. [상속권 없음] 스위치를 켜주세요.` });
        }
      }

      // 3. 대습 개시 전 재혼 (배우자 본인) - 🚨 부모 탭(parentPersonId)으로 확실히 꽂아줌!
      if (isSpouse && node.remarriageDate && effectiveDate && isBefore(node.remarriageDate, effectiveDate)) {
        if (!node.isExcluded || node.exclusionOption !== 'remarried') {
          guides.push({ id: node.id, uniqueKey: `mismatch-remarried-self-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름없음'}] 피상속인 사망(${effectiveDate}) 전 재혼(${node.remarriageDate})하여 대습상속권이 소멸했습니다. 스위치를 꺼주세요.` });
        }
      }

      // 4. 날짜 모순 (부모 탭으로 이동)
      if (node.marriageDate && node.deathDate && isBefore(node.deathDate, node.marriageDate)) {
        guides.push({ id: node.id, uniqueKey: `date-mismatch-${node.personId}`, targetTabId: parentPersonId, type: 'mandatory', text: `[${node.name || '이름없음'}] 혼인일(${node.marriageDate})이 본인 사망일(${node.deathDate}) 이후로 설정되어 있습니다. 날짜를 확인하고 수정해 주세요.` });
      }

      if (node.heirs) {
        node.heirs.forEach(h => {
          let nextEffectiveDate = effectiveDate;
          if (node.deathDate && !isBefore(node.deathDate, effectiveDate)) nextEffectiveDate = node.deathDate;
          checkMismatch(h, nextEffectiveDate, node.personId);
        });
      }
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
    const isRoot = activeDeceasedTab === 'root'; const name = targetNode.name || (isRoot ? '피상속인' : '(이름없음)'); let relationInfo = isRoot ? '(피상속인)' : '';
    if (!isRoot && lineage.length > 1) { const parent = lineage[lineage.length - 2]; const isChild = targetNode.relation === 'son' || targetNode.relation === 'daughter'; let parentNames = parent.name || '피상속인'; if (isChild) { const parentIsSp = parent.relation === 'wife' || parent.relation === 'husband' || parent.relation === 'spouse'; if (lineage.length > 2 && parentIsSp) { const grandparent = lineage[lineage.length - 3]; if (grandparent?.name) parentNames = `${grandparent.name}·${parent.name}`; } else if (parent.heirs) { const spouse = parent.heirs.find(h => h.id !== targetNode.id && ['wife', 'husband', 'spouse'].includes(h.relation) && h.name && h.name.trim() !== ''); if (spouse) parentNames = `${parent.name}·${spouse.name}`; } } relationInfo = `(${parentNames}의 ${getRelStr(targetNode.relation, tree.deathDate)})`; }
    let totalN = 0, totalD = 1; const sourceList = []; if (calcSteps && Array.isArray(calcSteps) && targetNode) { const myStep = calcSteps.find(s => s.dec?.personId === targetNode.personId); if (myStep) { totalN = myStep.inN; totalD = myStep.inD; if (myStep.mergeSources && myStep.mergeSources.length > 0) myStep.mergeSources.forEach(src => sourceList.push({ from: src.from, n: src.n, d: src.d })); else sourceList.push({ from: myStep.parentDecName || '피상속인', n: myStep.inN, d: myStep.inD }); } else { const myFinalShare = finalShares.direct.find(f => f.personId === targetNode.personId) || finalShares.subGroups.flatMap(g => g.shares).find(f => f.personId === targetNode.personId); if (myFinalShare) { totalN = myFinalShare.n; totalD = myFinalShare.d; } } }
    const shareStr = isRoot ? '1분의 1' : (totalN > 0 ? `${totalD}분의 ${totalN}` : '0'); return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps, finalShares]);

  useEffect(() => { const activeEl = tabRefs.current[activeDeceasedTab]; if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, [activeDeceasedTab]);
  useEffect(() => { const tabIds = deceasedTabs.map(t => t.id); if (!tabIds.includes(activeDeceasedTab)) { const fallback = (activeTab === 'input' && deceasedTabs.length > 0) ? deceasedTabs[0].id : 'root'; setActiveDeceasedTab(fallback); } }, [deceasedTabs, activeTab]);

  const activeTabObj = useMemo(() => deceasedTabs.find(t => t.id === activeDeceasedTab) || null, [deceasedTabs, activeDeceasedTab]);
  const handleDragEnd = (event) => { const { active, over } = event; if (over && active.id !== over.id) {
    setTree(prev => { const newTree = JSON.parse(JSON.stringify(prev)); const reorderList = (list) => { if (!list) return false; const activeIdx = list.findIndex(item => item.id === active.id); const overIdx = list.findIndex(item => item.id === over.id); if (activeIdx !== -1 && overIdx !== -1) { const [movedItem] = list.splice(activeIdx, 1); list.splice(overIdx, 0, movedItem); return true; } for (let item of list) { if (item.heirs && item.heirs.length > 0 && reorderList(item.heirs)) return true; } return false; }; reorderList(newTree.heirs); return newTree; });
  } };

  const handlePrint = () => { 
    if (activeTab === 'input') { alert('보고서 탭(산출내역, 지분요약, 상속금액) 중 하나를 선택한 후 인쇄해주세요.'); return; } 
    // 탭별 인쇄용 파일명 접미사 매핑
    const tabNames = { input: '가계도', calc: '상속지분_산출내역', summary: '법정상속분_요약표', amount: '구체적상속분_결과' }; 
    const currentTabName = tabNames[activeTab] || '보고서'; 
    const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣_-]/g, ''); 
    const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, ''); 
    const printFileName = `${safeCaseNo}_${safeName}_${currentTabName}_${new Date().toISOString().slice(0, 10)}`; 
    
    // 브라우저 기본 인쇄 파일명 지정을 위해 임시로 타이틀 변경
    const originalTitle = document.title; 
    document.title = printFileName; 
    window.print(); 
    document.title = originalTitle; 
  };
  const saveFile = () => { const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const safeCaseNo = (tree.caseNo || '사건번호없음').replace(/[^a-zA-Z0-9가-힣_-]/g, ''); const safeName = (tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, ''); a.href = url; a.download = `${safeCaseNo}_${safeName}_상속지분계산_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); };
  const loadFile = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target.result); const nameMap = new Map(); const syncPersonIdRec = (n) => { let pId = n.personId; if (n.name && n.name.trim() !== '') { if (nameMap.has(n.name)) pId = nameMap.get(n.name); else { if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`; nameMap.set(n.name, pId); } } else if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`; let exclusionOption = n.exclusionOption; if (n.isExcluded && exclusionOption === 'no_heir' && n.isDeceased) exclusionOption = 'renounce'; return { ...n, personId: pId, exclusionOption, heirs: (n.heirs || []).map(syncPersonIdRec) }; }; if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) { setTree(syncPersonIdRec(data)); setActiveTab('calc'); } else if (data.people && Array.isArray(data.people)) { alert('이 파일은 이전 버전의 그래프 형식입니다. 일부 데이터가 누락될 수 있습니다.'); const root = data.people.find(p => p.isRoot || p.id === 'root'); if (root) { setTree({ id: 'root', name: root.name || '', gender: root.gender || 'male', deathDate: root.deathDate || '', caseNo: data.caseNo || '', isHoju: root.isHoju !== false, shareN: data.shareN || 1, shareD: data.shareD || 1, heirs: [] }); setActiveTab('input'); } } else alert('인식할 수 없는 파일 형식입니다.'); } catch (err) { alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message); } }; reader.readAsText(file); e.target.value = ''; };
  const performReset = (saveFirst) => {
    if (saveFirst) saveFile();
    setVaultState({ history: [migrateToVault(getInitialTree())], currentIndex: 0 });
    setActiveTab('input');
    setActiveDeceasedTab('root');
    setIsResetModalOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoTree(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoTree(); }
      if (e.key === 'Escape' && !isAiModalOpen) { e.preventDefault(); setIsResetModalOpen(true); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAiModalOpen]);

  const handleExcelExport = () => { const rows = [['사건번호', tree.caseNo || ''], ['피상속인', tree.name || ''], ['사망일자', tree.deathDate || ''], [''], ['상속인', '관계', '지분(분자)', '지분(분모)', '통분 지분(분자)', '통분 지분(분모)']]; finalShares.direct.forEach(f => rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud])); (finalShares.subGroups || []).forEach(g => { rows.push(['', `※ 공동상속인 중 [${g.ancestor?.name || ''}]은(는) ${formatKorDate(g.ancestor?.deathDate)} 사망하였으므로 상속인`, '', '', '', '']); g.shares.forEach(f => rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud])); }); const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `상속지분_${(tree.name || '피상속인없음').replace(/[^a-zA-Z0-9가-힣_-]/g, '')}_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); };

  return (
    <>
      <PrintReport 
        tree={tree} 
        activeTab={activeTab} 
        activeDeceasedTab={activeDeceasedTab} 
        finalShares={finalShares} 
        calcSteps={calcSteps} 
        amountCalculations={amountCalculations} 
        propertyValue={propertyValue} 
      />
      
      <div className="w-full min-h-screen relative flex flex-col items-start pb-24 transition-colors duration-200 bg-[#f7f7f5] dark:bg-neutral-900 min-w-[1280px] print:hidden">
        {showNavigator && (
        <div ref={stickerRef} className={`fixed top-28 right-8 z-[9999] no-print ${isStickerDragging ? 'cursor-grabbing' : 'cursor-grab'}`} style={{ transform: `translate3d(${stickerPos.current.x}px, ${stickerPos.current.y}px, 0)`, transition: 'none', willChange: 'transform', touchAction: 'none' }} onMouseDown={handleStickerMouseDown}>
          <div className={`relative w-[340px] ${isNavigatorRolledUp ? 'p-3' : 'p-5'} bg-white dark:bg-neutral-800 shadow-[0_12px_40px_rgb(0,0,0,0.15)] border border-[#e9e9e7] dark:border-neutral-700 rounded-xl select-none transition-all duration-200 ${isStickerDragging ? 'scale-[1.02]' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[#37352f] dark:text-neutral-100"><svg className={`w-5 h-5 ${hasActionItems ? 'text-[#2383e2]' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg><span className="font-black text-[15px]">스마트 가이드</span></div>
              <div className="flex items-center"><button onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsNavigatorRolledUp(!isNavigatorRolledUp)} className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors pointer-events-auto mr-5" title={isNavigatorRolledUp ? "내용 보기" : "제목만 보기"}>{isNavigatorRolledUp ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>}</button><button onMouseDown={(e) => e.stopPropagation()} onClick={() => setShowNavigator(false)} className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors pointer-events-auto"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            </div>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {!isNavigatorRolledUp && (
                <div className="text-[13px] font-bold text-[#504f4c] dark:text-neutral-300 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
                  {noSurvivors && <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg mt-2 mb-4"><span className="text-[#b45309] dark:text-amber-500 font-black text-[14px]">[생존 상속인 없음]</span><span className="text-[#787774] dark:text-neutral-400 text-[11.5px] font-medium leading-relaxed px-4">모든 상속인이 사망/제외 상태입니다.<br/>차순위 상속인을 추가해 주세요.</span></div>}
                  {!hasActionItems && !noSurvivors && <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-lg border border-[#e9e9e7] dark:border-neutral-700/50 mt-2"><span className="text-[#37352f] dark:text-neutral-300 font-black text-[13px]">[검증 완료]</span><span className="text-[#787774] dark:text-neutral-500 text-[11.5px] font-medium leading-snug">현재 단계에서 추가로 확인하실 항목이 없습니다.</span></div>}
                  {activeTab === 'input' && warnings.map((w, i) => (<div key={`w-${i}`} onClick={() => { if (w.targetTabId && deceasedTabs.some(t => t.id === w.targetTabId)) setActiveDeceasedTab(w.targetTabId); else if (w.id) { const findParentTab = (n, currentTabId) => { if (n.id === w.id) return currentTabId; if (n.heirs) { for (let h of n.heirs) { const found = findParentTab(h, (n.isDeceased && n.heirs.length > 0) ? n.id : currentTabId); if (found) return found; } } return null; }; const tabId = findParentTab(tree, 'root'); if (tabId) setActiveDeceasedTab(tabId); } }} className={`pointer-events-auto flex items-start gap-2 p-2.5 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/30 mt-2 transition-all ${w.id ? 'cursor-pointer hover:bg-red-100/60 dark:hover:bg-red-900/20' : ''}`} title={w.id ? "클릭 시 수정을 위해 해당 탭으로 이동합니다" : ""}><span className="mt-0.5">🚨</span><span className={`flex-1 leading-snug text-red-700 dark:text-red-400 font-bold text-[13px] ${w.id ? 'hover:underline decoration-red-400 underline-offset-4' : ''}`}>{w.text || w}</span></div>))}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').map((g, i) => (<button key={`m-${i}`} onMouseDown={(e) => e.stopPropagation()} onClick={() => { if (g.targetTabId) setActiveDeceasedTab(g.targetTabId === tree.personId ? 'root' : g.targetTabId); else if (g.id) { const findParentTab = (n, currentTabId) => { if (n.id === g.id) return currentTabId; if (n.heirs) { for (let h of n.heirs) { const found = findParentTab(h, (n.isDeceased && n.heirs.length > 0) ? n.id : currentTabId); if (found) return found; } } return null; }; const tabId = findParentTab(tree, 'root'); if (tabId) setActiveDeceasedTab(tabId); } }} className="w-full mt-2 text-left flex items-start gap-2 bg-blue-50/60 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200/60 dark:border-blue-800/30 hover:bg-blue-100/80 transition-all group pointer-events-auto shadow-sm"><span className="mt-0.5 text-blue-600 group-hover:scale-125 transition-transform">👉</span><span className="flex-1 leading-snug text-[#37352f] dark:text-neutral-200 font-bold">{g.text}</span></button>))}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').length > 0 && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && <div className="w-full border-t border-dashed border-[#d4d4d4] dark:border-neutral-600 my-4"></div>}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (<><div className={`mt-2 mb-1.5 ${smartGuides.filter(m => m.type === 'mandatory').length === 0 ? 'mt-3' : ''}`}><span className="text-[11px] font-bold text-[#a3a3a3] dark:text-neutral-500 tracking-tight px-1">[다음은 권고사항입니다]</span></div>{smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).map((g, i) => (<div key={`r-${i}`} className="relative group pointer-events-auto mb-1.5"><button onMouseDown={(e) => e.stopPropagation()} onClick={() => { if (g.targetTabId) setActiveDeceasedTab(g.targetTabId === tree.personId ? 'root' : g.targetTabId); else if (g.id) { const findParentTab = (n, currentTabId) => { if (n.id === g.id) return currentTabId; if (n.heirs) { for (let h of n.heirs) { const found = findParentTab(h, (n.isDeceased && n.heirs.length > 0) ? n.id : currentTabId); if (found) return found; } } return null; }; const tabId = findParentTab(tree, 'root'); if (tabId) setActiveDeceasedTab(tabId); } }} className="w-full text-left flex items-start gap-2 bg-[#fbfbfb] dark:bg-neutral-800/40 p-2.5 rounded-lg border border-[#e9e9e7] dark:border-neutral-700 hover:bg-[#f2f2f0] transition-all"><span className="mt-0.5 text-[#a3a3a3] group-hover:text-amber-500 transition-colors">💡</span><span className="flex-1 leading-snug text-[#787774] dark:text-neutral-400 font-medium text-[12.5px] pr-6">{g.text}</span></button><button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); dismissGuide(g.uniqueKey); }} className="absolute top-2.5 right-2 p-1 text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full transition-all opacity-0 group-hover:opacity-100" title="이 권고 무시하기 (사이드바에서도 지워집니다)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>))}</>)}
                  {showGlobalWarning && <div className="mt-3 space-y-3"><div className="text-[#e53e3e] dark:text-red-400 font-black text-[14px]">전체 지분 합계가 일치하지 않습니다.</div>{globalMismatchReasons.length > 0 ? <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">{globalMismatchReasons.map((r, idx) => (<button key={idx} onMouseDown={(e) => e.stopPropagation()} onClick={() => r.id ? handleNavigate(r.id) : null} className="w-full text-left flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all group pointer-events-auto shadow-sm"><span className="mt-0.5 text-red-600 dark:text-red-400 group-hover:scale-125 transition-transform">🚨</span><span className="flex-1 leading-snug text-[#c93f3a] dark:text-red-400 font-bold text-[12.5px]">{r.text || r}</span></button>))}</div> : <div className="p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md"><span className="text-[12.5px] text-[#787774] dark:text-neutral-400 font-bold">지분 일부가 상속권 없음 처리되어 전체 합계가 미달합니다.</span></div>}</div>}
                  {showAutoCalcNotice && <div className="mt-3 p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md"><span className="text-[#37352f] dark:text-neutral-100 font-black block mb-2 border-b border-[#e9e9e7] dark:border-neutral-700 pb-1.5 text-[13px]">자동분배 내역:</span><div className="space-y-1.5">{autoCalculatedNames.map((a, idx) => (<div key={idx} className="text-[12.5px] flex items-center justify-between"><span className="font-bold text-[#504f4c] dark:text-neutral-300">{a.name}</span><span className="text-[#787774] dark:text-neutral-500 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>{a.target}</span></div>))}</div></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex justify-start transition-all duration-300 shadow-sm overflow-hidden">
        <div className="w-[1080px] min-w-[1080px] shrink-0 px-6 flex items-center justify-between h-full flex-nowrap">
          <div className="flex items-center gap-3 flex-nowrap shrink-0">
            <button onClick={() => setSidebarOpen(v => !v)} className={`w-7 h-7 flex flex-col justify-center items-center rounded-md gap-1 transition-all no-print ${sidebarOpen ? 'bg-[#f0f0ee] dark:bg-neutral-700 text-[#2383e2] dark:text-blue-400' : 'text-[#787774] dark:text-neutral-400 hover:bg-[#efefed] dark:hover:bg-neutral-700'}`} title={sidebarOpen ? '가계도 패널 닫기' : '가계도 패널 열기'}><span className="w-3.5 h-0.5 bg-current rounded-full transition-all" /><span className="w-3.5 h-0.5 bg-current rounded-full transition-all" /><span className="w-3.5 h-0.5 bg-current rounded-full transition-all" /></button>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0 overflow-visible"><div className="flex items-center text-[#37352f] dark:text-neutral-100 font-bold text-[18px] tracking-tight whitespace-nowrap shrink-0"><IconCalculator className="w-5 h-5 mr-1.5 text-[#787774] dark:text-neutral-400 shrink-0" />상속지분 계산기 PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">v3.0.0</span></div><span className="designer-sign text-[#a3a3a3] dark:text-neutral-500 text-[14px] ml-8 whitespace-nowrap shrink-0">Designed by J.H. Lee</span></div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#f7f7f5] dark:bg-neutral-700 px-2.5 py-1 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-2 transition-colors"><div className="min-w-[120px] flex items-center gap-1 overflow-hidden"><span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">사건:</span><span className="text-[11px] font-bold text-[#37352f] dark:text-neutral-200 truncate">{tree.caseNo || '미입력'}</span></div><div className="w-px h-2.5 bg-[#d4d4d4] dark:bg-neutral-600 mx-0.5"></div><div className="min-w-[140px] flex items-center gap-1 overflow-hidden"><span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">피상속인:</span><span className="text-[13px] font-black text-[#0b6e99] dark:text-blue-400 truncate">{tree.name || '미입력'}</span></div></div>
            <button onClick={() => { setAiTargetId('root'); setIsAiModalOpen(true); }} title="가계도 전체 AI 자동입력" className="flex items-center justify-center w-8 h-8 shrink-0 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-all shadow-sm hover:scale-105 active:scale-95"><span className="text-[16px] leading-none opacity-100 drop-shadow-sm mt-0.5">✨</span></button>
            <button onClick={() => setShowNavigator(true)} className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm border shrink-0 mx-[10px] active:scale-95 ${hasActionItems ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 dark:hover:bg-indigo-900/40' : 'bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f7f5] hover:text-[#37352f] dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700'}`} title={hasActionItems ? "새로운 스마트 가이드가 있습니다!" : "스마트 가이드 열기"}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActionItems ? 2.5 : 2}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg></button>
            <button onClick={undoTree} disabled={vaultState.currentIndex <= 0} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1"><IconUndo className="w-3.5 h-3.5" /> 이전</button>
            <button onClick={redoTree} disabled={vaultState.currentIndex >= vaultState.history.length - 1} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1"><IconRedo className="w-3.5 h-3.5" /> 재실행</button>
            <div className="w-px h-3.5 bg-[#e9e9e7] dark:bg-neutral-600 mx-0.5"></div>
            <button onClick={() => setIsResetModalOpen(true)} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1"><IconReset className="h-3.5 w-3.5" /> 초기화</button>
            <label className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1 cursor-pointer"><IconFolderOpen className="h-3.5 w-3.5" /> 불러오기<input type="file" accept=".json" onChange={loadFile} className="hidden" /></label>
            <button onClick={saveFile} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1"><IconSave className="h-3.5 w-3.5" /> 저장</button>
            <button onClick={handleExcelExport} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1"><IconTable className="h-3.5 w-3.5" /> 엑셀</button>
            <button onClick={handlePrint} className="text-white bg-[#2383e2] hover:bg-[#0073ea] px-3 py-1 rounded text-[12px] font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap ml-1 mr-1"><IconPrinter className="h-3.5 w-3.5" /> 인쇄</button>
            <div className="flex items-center gap-1 bg-[#f7f7f5] dark:bg-neutral-700 px-1.5 py-0.5 rounded border border-[#e9e9e7] dark:border-neutral-600 transition-colors"><button onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))} className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]">-</button><span className="text-[10px] font-black w-8 text-center text-[#504f4c] dark:text-neutral-300">{Math.round(zoomLevel * 100)}%</span><button onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))} className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]">+</button></div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-7 h-7 flex justify-center items-center rounded-full text-[#787774] hover:bg-[#efefed] dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors focus:outline-none">{isDarkMode ? <IconSun className="w-4 h-4 text-amber-300" /> : <IconMoon className="w-4 h-4" />}</button>
          </div>
        </div>
      </div>
      {sidebarOpen && (
        <aside className="fixed left-0 top-[54px] h-[calc(100vh-54px)] z-30 no-print flex items-stretch" style={{ width: sidebarWidth + 10 }}>
          <div className="flex flex-col bg-white dark:bg-neutral-800 border-r border-[#e9e9e7] dark:border-neutral-700 overflow-hidden" style={{ width: sidebarWidth }}>
            <div className="p-2 border-b border-[#e9e9e7] dark:border-neutral-700 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-1 bg-[#f7f7f5] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2 py-1">
                <svg className="w-3 h-3 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder="이름 검색" value={sidebarSearchQuery} onChange={e => setSidebarSearchQuery(e.target.value)} className="bg-transparent outline-none flex-1 text-[12px] text-[#37352f] dark:text-neutral-200 min-w-0" />
                {sidebarMatchIds.length > 0 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[10px] text-neutral-400">{sidebarCurrentMatchIdx + 1}/{sidebarMatchIds.length}</span>
                    <button onClick={handleSidebarPrevMatch} className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"/></svg></button>
                    <button onClick={handleSidebarNextMatch} className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></button>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setSidebarToggleSignal(s => Math.abs(s) + 1)} className="flex-1 text-[10px] text-[#787774] dark:text-neutral-400 hover:text-[#37352f] hover:bg-[#f0f0ee] dark:hover:bg-neutral-700 py-0.5 rounded transition-colors font-bold">모두 펼치기</button>
                <button onClick={() => setSidebarToggleSignal(s => -(Math.abs(s) + 1))} className="flex-1 text-[10px] text-[#787774] dark:text-neutral-400 hover:text-[#37352f] hover:bg-[#f0f0ee] dark:hover:bg-neutral-700 py-0.5 rounded transition-colors font-bold">모두 접기</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {tree && <MiniTreeView node={tree} onSelectNode={handleNavigate} deathDate={tree.deathDate} toggleSignal={sidebarToggleSignal} searchQuery={sidebarSearchQuery} matchIds={sidebarMatchIds} currentMatchId={sidebarMatchIds[sidebarCurrentMatchIdx]} guideStatusMap={guideStatusMap} />}
            </div>
          </div>
          <div className="w-[10px] cursor-col-resize hover:bg-blue-200/40 dark:hover:bg-blue-900/30 active:bg-blue-300/40 transition-colors shrink-0" onMouseDown={handleResizeMouseDown} />
        </aside>
      )}
      <main className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`} style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 10) : 0 }}>
        <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
          <div className="flex flex-col w-[1080px] min-w-[1080px] shrink-0 px-6 mt-6 print-compact relative z-10">
            <div className="flex items-end pl-[48px] gap-1 no-print relative z-20">
              {tabData.map(t => {
                const isActive = activeTab === t.id;
                return <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-6 py-2.5 rounded-t-xl font-bold text-[14px] flex items-center gap-2 transition-all relative cursor-pointer border-2 border-b-0 ${isActive ? `bg-white dark:bg-neutral-800 ${t.style.activeBorder} ${t.style.activeText} pb-3 top-[2px] z-20` : `${t.style.inactiveBg} dark:bg-neutral-800/40 ${t.style.inactiveBorder} dark:border-neutral-700 ${t.style.inactiveText} dark:text-neutral-500 pb-2.5 top-[1px] z-10 hover:brightness-95`}`}>{t.icon} {t.label}</button>;
              })}
            </div>
            <div className="border border-[#e9e9e7] dark:border-neutral-700 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] print:border-none print:shadow-none min-h-[600px] bg-white dark:bg-neutral-800 flex flex-col p-10 relative z-0 transition-colors">
              {activeTab === 'input' && (() => {
                const currentNode = activeTabObj ? activeTabObj.node : tree; const nodeHeirs = currentNode ? (currentNode.heirs || []) : []; const isRootNode = currentNode && currentNode.id === 'root'; const canAutoFill = !isRootNode && (['wife', 'husband', 'son', 'daughter'].includes(currentNode?.relation));
                const handleAutoFill = () => {
                  const parentHeirs = activeTabObj.parentNode?.heirs || [];
                  const existingNames = new Set(nodeHeirs.map(h => h.name).filter(n => n.trim() !== ''));
                  let baseAdd = [];
                  
                  if (['wife', 'husband', 'spouse'].includes(currentNode.relation)) { 
                    const children = parentHeirs.filter(s => ['son', 'daughter'].includes(s.relation)); 
                    baseAdd = children.filter(c => c.name.trim() === '' || !existingNames.has(c.name)); 
                  } else { 
                    // 부모(피상속인의 배우자)와 형제자매를 모두 가져오되, 선사망한 부모는 대습상속권이 없으므로 제외함
                    const parents = parentHeirs.filter(s => {
                      if (!['wife', 'husband', 'spouse'].includes(s.relation)) return false;
                      // 💡 한국 민법상 직계존속은 대습상속 대상이 아님. 자녀(현재 노드)보다 먼저 사망했다면 상속권 완전 소멸.
                      if (s.isDeceased && s.deathDate && currentNode.deathDate && isBefore(s.deathDate, currentNode.deathDate)) return false;
                      return true;
                    });
                    const siblings = parentHeirs.filter(s => s.id !== currentNode.id && ['son', 'daughter'].includes(s.relation)); 
                    baseAdd = [
                      ...parents.map(item => ({ ...item, relation: 'parent' })),
                      ...siblings.map(item => ({ ...item, relation: 'sibling' }))
                    ].filter(s => s.name.trim() === '' || !existingNames.has(s.name)); 
                  }
                  
                  if (baseAdd.length === 0) { alert('불러올 상속인이 없습니다.'); return; }
                  setTree(prev => { 
                    const syncHeirs = (n) => { 
                      if (n.id === currentNode.id || (currentNode.personId && n.personId === currentNode.personId)) { 
                        const finalAdd = baseAdd.map(item => { 
                          const assignNewIds = (node) => ({ ...node, id: `n_${Math.random().toString(36).substr(2,9)}`, heirs: node.heirs?.map(assignNewIds) || [] }); 
                          return assignNewIds(item); 
                        }); 
                        return { ...n, isExcluded: false, heirs: [...(n.heirs || []), ...finalAdd] }; 
                      } 
                      return { ...n, heirs: n.heirs?.map(syncHeirs) || [] }; 
                    }; 
                    return syncHeirs(prev); 
                  });
                };
                return (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
                    <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-3 flex items-center gap-6 transition-colors shadow-sm">
                      <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1"><div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" /><span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 uppercase tracking-widest">기본정보</span></div>
                      <div className="flex flex-1 items-center gap-5 overflow-x-auto no-scrollbar">
                        <div className="shrink-0 flex items-center gap-2"><label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사건번호</label><input type="text" onKeyDown={handleKeyDown} value={tree.caseNo || ''} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="번호 입력" /></div>
                        <div className="shrink-0 flex items-center gap-2"><label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">성명</label><input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="이름" /></div>
                        <div className="shrink-0 flex items-center gap-2"><label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">사망일자</label><DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={v=>handleRootUpdate('deathDate', v)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" /></div>
                        {getLawEra(tree.deathDate) !== '1991' && <div className="shrink-0 flex items-center gap-2"><label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">호주</label><input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" /></div>}
                        <div className="shrink-0 flex items-center gap-2"><label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">상속할 지분</label><div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1"><input type="number" min="1" value={tree.shareD || 1} onChange={e=>handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value)||1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분모" /><span className="text-[#787774] dark:text-neutral-500 text-[12px] font-medium mx-0.5">/</span><input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={e=>handleRootUpdate('shareN', Math.min(tree.shareD||1, Math.max(1, parseInt(e.target.value)||1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="분자" /></div></div>
                      </div>
                    </div>
                    <div className="transition-colors flex-1 flex flex-col">
                      <div className="relative transition-all duration-300 flex-1 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-xl">
                        <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl min-h-[80px]">
                          <div className="flex items-center gap-5 w-full">
                            <div className="flex items-center shrink-0 pr-4">
                              {activeTabObj?.parentNode ? <button type="button" onClick={() => setActiveDeceasedTab(activeTabObj.parentNode.id === 'root' ? 'root' : activeTabObj.parentNode.personId)} className="flex items-center gap-2 group transition-all"><div className="w-7 h-7 rounded-full border border-[#e9e9e7] dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center justify-center text-[#787774] group-hover:text-[#2383e2] group-hover:border-[#2383e2] shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></div><div className="flex flex-col items-start text-left"><span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 leading-none mb-1 uppercase tracking-tight">상위 단계</span><div className="flex items-baseline gap-1"><span className="text-[16px] font-black text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{activeTabObj.parentNode.id === 'root' ? (tree.name || '피상속인') : activeTabObj.parentNode.name}</span><span className="text-[13px] font-bold text-neutral-400 dark:text-neutral-500 whitespace-nowrap">의 {getRelStr(currentNode.relation, tree.deathDate)}</span></div></div></button> : <div className="flex items-center px-2"><span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 tracking-tight">최초 상속 단계</span></div>}
                            </div>
                            <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
                            <div className="flex flex-col justify-center min-w-[80px] max-w-[140px]"><span className="text-[10px] font-bold text-[#2383e2] dark:text-blue-400 uppercase mb-0.5">{activeDeceasedTab === 'root' ? '피상속인' : '상속인'}</span><div className="flex items-center overflow-hidden"><span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">{getBriefingInfo.name}</span></div></div>
                            <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
                            <div className="flex flex-col justify-center items-center shrink-0"><span className="text-[12px] font-bold text-[#c93f3a] dark:text-red-400 mb-1 leading-none">{currentNode?.deathDate ? `${formatKorDate(currentNode.deathDate)} 사망` : (tree.deathDate ? `${formatKorDate(tree.deathDate)} 사망` : '사망일자 미상')}</span><div className="w-[120px] bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 py-0.5 rounded flex items-center justify-center gap-1 shadow-sm"><span className="text-[9px]">⚖️</span><span className="text-[10px] font-black tracking-tighter whitespace-nowrap">{getLawEra(currentNode?.deathDate || tree.deathDate)}년 민법</span></div></div>
                            <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>
                            <div className="flex flex-col justify-center flex-1 min-w-0"><div className="flex items-baseline gap-2"><span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">지분</span><span className="text-[17px] font-black text-[#1e56a0] dark:text-blue-400 leading-none">{getBriefingInfo.shareStr}</span></div></div>
                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                              {!isRootNode && <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 rounded-full shadow-sm"><span className={`text-[11px] font-bold transition-colors select-none cursor-pointer ${!currentNode.isExcluded ? 'text-[#37352f] dark:text-neutral-200' : 'text-[#787774] dark:text-neutral-500'}`} onClick={() => { if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) { alert("상속인을 먼저 입력해주세요."); return; } const nextVal = !currentNode.isExcluded; handleUpdate(currentNode.id, { isExcluded: nextVal, exclusionOption: nextVal ? '' : 'renounce' }); }}>{currentNode.isExcluded ? '상속권 없음' : '상속 활성'}</span><button type="button" onClick={() => { if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) { alert("상속인을 먼저 입력해주세요."); return; } const nextVal = !currentNode.isExcluded; handleUpdate(currentNode.id, { isExcluded: nextVal, exclusionOption: nextVal ? '' : 'renounce' }); }} className={`relative inline-flex h-3.5 w-6 items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${!currentNode.isExcluded ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-600'}`}><span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-sm transition duration-200 ${!currentNode.isExcluded ? 'translate-x-2.5' : 'translate-x-0.5'}`} /></button></div>}
                              {canAutoFill && <button type="button" onClick={handleAutoFill} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm" title="상위 단계의 동일한 상속인 명단을 그대로 가져옵니다"><IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 불러오기</button>}
                              <button type="button" onClick={() => { setIsMainQuickActive(!isMainQuickActive); if(!isMainQuickActive) setTimeout(() => document.querySelector('input[placeholder*="한꺼번에"]')?.focus(), 100); }} className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"><IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> 상속인 추가</button>
                              <button type="button" onClick={() => { setAiTargetId(activeDeceasedTab); setIsAiModalOpen(true); }} title="현재 상속인 전용 AI 하위 입력" className="flex items-center justify-center w-7 h-7 shrink-0 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-all shadow-sm active:scale-95 ml-1"><span className="text-[14px] leading-none opacity-100 drop-shadow-sm mt-0.5">✨</span></button>
                            </div>
                          </div>
                        </div>
                        <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
                          {isMainQuickActive && <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700 animate-in fade-in slide-in-from-top-1 duration-300"><div className="flex flex-col gap-2"><div className="flex items-center justify-between"><div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">상속인 이름을 쉼표(,)로 구분하여 한꺼번에 입력하세요</div><button onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }} className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors" title="닫기"><IconX className="w-3.5 h-3.5" /></button></div><div className="flex gap-2"><input autoFocus type="text" value={mainQuickVal} onChange={e => setMainQuickVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); setIsMainQuickActive(false); setMainQuickVal(''); } if (e.key === 'Escape') { setIsMainQuickActive(false); setMainQuickVal(''); } }} placeholder="예: 홍길동, 김철수, 이영희" className="flex-1 text-[13px] border border-[#e9e9e7] dark:border-neutral-700 rounded-md px-3 py-1.5 outline-none focus:border-[#d4d4d4] bg-white dark:bg-neutral-900 dark:text-neutral-200 transition-all font-medium text-[#37352f]" /><button onClick={() => { handleQuickSubmit(activeDeceasedTab, currentNode, mainQuickVal); setIsMainQuickActive(false); setMainQuickVal(''); }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 hover:bg-[#efefed] dark:hover:bg-neutral-700 border border-[#e9e9e7] dark:border-neutral-600 text-[#37352f] dark:text-neutral-200 text-[13px] font-bold rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap">일괄 등록</button></div></div></div>}
                          {nodeHeirs.length > 0 && <div className="flex items-center px-2 py-2 mb-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-md border border-[#e9e9e7] dark:border-neutral-700 text-[12px] font-bold text-[#787774] dark:text-neutral-400 select-none w-full overflow-hidden"><div className="w-[68px] shrink-0 text-center ml-[10px]"><span className="relative left-[15px]">상태</span></div><div className="w-[72px] shrink-0 text-center ml-[50px]"><span className="relative left-[-20px]">성명</span></div><div className="w-[76px] shrink-0 text-center ml-[30px]"><span className="relative left-[-30px]">관계</span></div><div className="w-[150px] shrink-0 text-center ml-[30px]"><span className="relative left-[-40px]">사망여부/일자</span></div><div className="w-[180px] shrink-0 text-center ml-[10px] relative"><span className="relative left-[-20px]">특수조건 (가감산)</span></div><div className="w-[180px] shrink-0 text-center ml-[10px] relative"><span className="whitespace-nowrap relative left-[0px] inline-flex items-center">재/대습상속<button type="button" title="현재 탭 상속인 전체 삭제" onClick={() => { if (!nodeHeirs || nodeHeirs.length === 0) { alert('삭제할 상속인이 없습니다.'); return; } if (window.confirm('🚨 현재 탭에 입력된 [모든 상속인]을 정말 삭제하시겠습니까?\n(하위에 입력된 데이터까지 모두 함께 삭제됩니다!)')) { const targetPId = currentNode.personId; setVault(prev => { if (prev.relationships[targetPId]) prev.relationships[targetPId] = []; return prev; }); } }} className="ml-[50px] p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-md"><IconTrash2 className="w-3.5 h-3.5" /></button></span></div><div className="w-12 shrink-0 text-center ml-[40px] mr-[10px]"><span className="whitespace-nowrap">삭제</span></div></div>}
                          {nodeHeirs.length === 0 && <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg text-center gap-2 m-2 mb-4"><span className="text-[#b45309] dark:text-amber-500 font-bold text-[14px]">⚠️ 하위 상속인 데이터가 없습니다.</span><span className="text-[#787774] dark:text-neutral-400 text-[12.5px]">상속인이 없다면 상위 상속인(부모 또는 형제자매)에게 상속분이 자동 분배됩니다.</span></div>}
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={nodeHeirs.map(h => h.id)} strategy={verticalListSortingStrategy}><div className="space-y-1.5">{nodeHeirs.map(h => (<HeirRow key={h.id} node={h} finalShares={finalShares} level={1} handleUpdate={handleUpdate} removeHeir={removeHeir} addHeir={addHeir} siblings={nodeHeirs} inheritedDate={currentNode?.deathDate || tree.deathDate} rootDeathDate={tree.deathDate} onKeyDown={handleKeyDown} rootIsHoju={tree.isHoju !== false} isRootChildren={activeDeceasedTab === 'root'} parentNode={currentNode} onTabClick={(id) => { let targetPId = id; const findPId = (n) => { if (n.id === id) targetPId = n.personId; if (n.heirs) n.heirs.forEach(findPId); }; findPId(tree); setActiveDeceasedTab(targetPId); }} />))}</div></SortableContext></DndContext>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {activeTab === 'tree' && <div className="py-2 flex flex-col h-full animate-in fade-in duration-300"><div className="mb-5 p-4 bg-[#f8f8f7] dark:bg-neutral-800/50 border border-[#e5e5e5] dark:border-neutral-700 rounded-lg text-[#787774] dark:text-neutral-300 text-[14px] font-semibold flex justify-between items-center no-print shadow-none"><div className="flex items-center gap-2"><IconNetwork className="w-5 h-5 shrink-0 opacity-50" /><span>이름을 클릭하여 하위 관계도를 접거나 펼칠 수 있습니다.</span></div><button onClick={() => { const next = Math.abs(treeToggleSignal) + 1; setTreeToggleSignal(isAllExpanded ? -next : next); setIsAllExpanded(!isAllExpanded); }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-[#d4d4d4] dark:border-neutral-600 hover:bg-[#efefed] dark:hover:bg-neutral-700 text-[#37352f] dark:text-neutral-200 rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap">{isAllExpanded ? '모두 접기' : '모두 펼치기'}</button></div><div className="bg-white dark:bg-neutral-900/50 p-8 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 shadow-sm overflow-hidden"><TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} /></div></div>}
              {(activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary' || activeTab === 'amount') && <div className="w-full mb-6 pb-3 border-b border-[#e9e9e7] dark:border-neutral-700 text-[13px] text-[#504f4c] dark:text-neutral-400 flex flex-wrap gap-8 no-print"><span>사건번호: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.caseNo || '미입력'}</span></span><span>피상속인: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.name || '미입력'}</span></span><span>사망일자: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.deathDate || '미입력'}</span></span><span>적용법령: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{getLawEra(tree.deathDate)}년 민법</span></span></div>}
              {activeTab === 'calc' && <section className="w-full text-[#37352f] dark:text-neutral-200"><div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">※ 피상속인부터 시작하여 각 대습/재상속 발생 시점마다 지분이 산출된 계산 흐름표입니다.</div><div className="space-y-6 print-mt-4">{calcSteps.map((s, i) => (<div key={'p-s'+i}><div className="mb-2 text-[13px] text-[#504f4c] dark:text-neutral-300">[STEP {i+1}] <span className="font-medium text-[#37352f] dark:text-neutral-100">망 {s.dec.name}</span> ({formatKorDate(s.dec.deathDate)} 사망) ─ 분배 지분: {s.inN}/{s.inD}{s.mergeSources && s.mergeSources.length > 1 && (<span className="text-[#787774]">{` (= ${s.mergeSources.map(src => `${src.from} ${src.d}분의 ${src.n}`).join(' + ')})`}</span>)}</div><table className="w-full border-collapse text-[13px]"><thead className="bg-[#fcfcfb] dark:bg-neutral-800/40"><tr><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[15%] text-[#787774]">성명</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[12%] text-[#787774]">관계</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[25%] text-[#787774]">계산식</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[18%] text-[#787774]">계산된 지분</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-left w-[30%] pl-4 text-[#787774]">비고</th></tr></thead><tbody>{s.dists.map((d, di) => { const memo = []; if (d.ex) memo.push(`상속권 없음(${d.ex})`); if (d.h.isDeceased && !(d.ex && (d.ex.includes('사망')||d.ex.includes('선사망')))) memo.push('망인'); if (d.mod) memo.push(...d.mod.split(',').map(m => m.trim())); return (<tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20"><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">{d.h.name}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">{getRelStr(d.h.relation, s.dec.deathDate) || '상속인'}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">{s.inN}/{s.inD} × {d.sn}/{d.sd}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">{d.n}/{d.d}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-left pl-4 text-[#787774]">{memo.join(', ')}</td></tr>); })}</tbody></table></div>))}</div></section>}
              {activeTab === 'result' && (() => {
                // 💡 합산 추적 뷰: personId 기준으로 다중 맥락의 지분을 모아서 표시
                const heirMap = new Map();
                calcSteps.forEach(s => {
                  s.dists.forEach(d => {
                    if (d.n > 0) {
                      const key = d.h.personId;
                      if (!heirMap.has(key)) heirMap.set(key, { name: d.h.name, relation: d.h.relation, sources: [], isDeceased: d.h.isDeceased });
                      heirMap.get(key).sources.push({
                        decName: s.dec.name,
                        decDeathDate: s.dec.deathDate,
                        relation: d.h.relation,       // 해당 맥락에서의 관계
                        lawEra: s.lawEra,              // 적용 법률 시대
                        mod: d.mod || '',              // 가감산 사유
                        n: d.n, d: d.d
                      });
                    }
                  });
                });
                const results = Array.from(heirMap.values()).filter(r => !r.isDeceased);
                
                // 법률 시대 한글 변환
                const lawLabel = (era) => {
                  if (era === '1960') return '제정민법';
                  if (era === '1979') return '79년 개정민법';
                  if (era === '1991') return '현행민법';
                  return era + '년 민법';
                };

                return (
                  <section className="w-full text-[#37352f] dark:text-neutral-200">
                    <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">※ 최종 생존 상속인 기준으로 승계받은 지분들을 합산한 검증표입니다. 동일인이 여러 경로로 상속받는 경우 각 경로별 관계·적용법률을 표시합니다.</div>
                    <table className="w-full border-collapse text-[13px]">
                      <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                        <tr>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[18%] text-[#787774]">최종 상속인</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[52%] text-[#787774]">지분 취득 내역 (경로별)</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[15%] text-[#787774]">최종 합계</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[15%] text-[#787774]">통분 지분</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.length > 0 ? results.map((r, i) => {
                          const total = r.sources.reduce((acc, s) => {
                            const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                            return { n: nn, d: nd };
                          }, { n: 0, d: 1 });
                          // 통분용 공통 분모 계산
                          let commonD = 1;
                          results.forEach(res => {
                            const t = res.sources.reduce((acc, s) => { const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d); return { n: nn, d: nd }; }, { n: 0, d: 1 });
                            if (t.n > 0) commonD = math.lcm(commonD, t.d);
                          });
                          const unifiedN = total.n * (commonD / total.d);

                          const isMultiSource = r.sources.length > 1;
                          return (
                            <tr key={i} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 align-top">
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                                {r.name}
                                <span className="text-[#787774] font-normal ml-1">[{getRelStr(r.relation, tree.deathDate)}]</span>
                                {isMultiSource && <span className="block text-[10px] text-blue-500 font-bold mt-0.5">복수 경로</span>}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left">
                                {r.sources.map((src, si) => (
                                  <div key={si} className={`flex items-baseline gap-1 ${si > 0 ? 'mt-1.5 pt-1.5 border-t border-dashed border-[#e9e9e7] dark:border-neutral-700' : ''}`}>
                                    <span className="font-medium text-[#37352f] dark:text-neutral-200 shrink-0">{src.n}/{src.d}</span>
                                    <span className="text-[#787774] dark:text-neutral-500 text-[12px]">
                                      ← 망 {src.decName}의 <span className="font-medium text-[#504f4c] dark:text-neutral-300">{getRelStr(src.relation, src.decDeathDate) || '상속인'}</span>으로서
                                      <span className="ml-1 text-[11px] px-1 py-0.5 rounded bg-[#f4f4f3] dark:bg-neutral-700 text-[#787774] dark:text-neutral-400">{lawLabel(src.lawEra)}</span>
                                      {src.mod && <span className="ml-1 text-[11px] text-[#b45309]">({src.mod})</span>}
                                    </span>
                                  </div>
                                ))}
                                {isMultiSource && (
                                  <div className="mt-1.5 pt-1.5 border-t border-[#e9e9e7] dark:border-neutral-700 text-[12px] text-[#504f4c] dark:text-neutral-400 font-medium">
                                    = {r.sources.map(s => `${s.n}/${s.d}`).join(' + ')} = <span className="text-[#37352f] dark:text-neutral-200 font-bold">{total.n}/{total.d}</span>
                                  </div>
                                )}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{total.n} / {total.d}</td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{unifiedN} / {commonD}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan="4" className="border border-[#e9e9e7] dark:border-neutral-700 p-8 text-center text-[#b45309] font-bold bg-amber-50">최종 생존 상속인이 없습니다.</td></tr>}
                      </tbody>
                    </table>
                  </section>
                );
              })()}
              {activeTab === 'summary' && (() => {
                const shareByPersonId = new Map(); (finalShares.direct || []).forEach(s => shareByPersonId.set(s.personId, s)); (finalShares.subGroups || []).forEach(g => g.shares.forEach(s => shareByPersonId.set(s.personId, s)));  
                const printedPersonIds = new Set();
                const buildGroups = (node, parentDeathDate) => {
                  const directShares = []; const subGroups = []; const seenInThisGroup = new Set();
                  (node.heirs || []).forEach(h => { if (seenInThisGroup.has(h.personId)) return; seenInThisGroup.add(h.personId); if (!h.isDeceased) { const s = shareByPersonId.get(h.personId); if (s && s.n > 0 && !printedPersonIds.has(h.personId)) { directShares.push(s); printedPersonIds.add(h.personId); } } else { const type = (h.deathDate && isBefore(h.deathDate, parentDeathDate)) ? '대습상속' : '재상속'; const child = buildGroups(h, h.deathDate || parentDeathDate); if (child.directShares.length > 0 || child.subGroups.length > 0) subGroups.push({ ancestor: h, type, ...child }); } });
                  return { directShares, subGroups };
                };
                const topDirect = []; const topGroups = []; const topSeen = new Set();
                (tree.heirs || []).forEach(h => { if (topSeen.has(h.personId)) return; topSeen.add(h.personId); if (!h.isDeceased) { const s = shareByPersonId.get(h.personId); if (s && s.n > 0 && !printedPersonIds.has(h.personId)) { topDirect.push(s); printedPersonIds.add(h.personId); } } else { const type = (h.deathDate && isBefore(h.deathDate, tree.deathDate)) ? '대습상속' : '재상속'; const child = buildGroups(h, h.deathDate || tree.deathDate); if (child.directShares.length > 0 || child.subGroups.length > 0) topGroups.push({ ancestor: h, type, ...child }); } });
                const [totalSumN, totalSumD] = (() => { let tn = 0, td = 1; const addShare = (s) => { if (s && s.n > 0) { const [nn, nd] = math.add(tn, td, s.n, s.d); tn = nn; td = nd; } }; topDirect.forEach(addShare); const traverseGroup = (g) => { g.directShares.forEach(addShare); g.subGroups.forEach(traverseGroup); }; topGroups.forEach(traverseGroup); return math.simplify(tn, td); })();
                const isMatch = !showGlobalWarning; const mismatchReasons = globalMismatchReasons;
                const renderShareRow = (f, depth, groupAncestorId = null) => { const pl = `${12 + (depth > 0 ? 16 : 0)}px`; const rowId = groupAncestorId ? `summary-row-${f.personId}-${groupAncestorId}` : `summary-row-${f.personId}`; const isCurrentMatch = matchIds[currentMatchIdx] === rowId; return (<tr key={'sr-'+f.id} id={rowId} className={`transition-colors duration-300 ${isCurrentMatch ? 'bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-l-yellow-500' : 'hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20'}`}><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left font-medium" style={{paddingLeft: pl}}>{f.name} <span className="text-[#787774] font-normal ml-1">[{getRelStr(f.relation, tree.deathDate)}]</span></td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center text-[#504f4c]">{f.n} / {f.d}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{f.un} / {f.ud}</td></tr>); };
                const renderGroup = (group, depth) => (<React.Fragment key={'grp-'+group.ancestor.id}><tr className="bg-[#fcfcfb] dark:bg-neutral-800/40"><td colSpan={3} className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[#504f4c] dark:text-neutral-400 pl-4">※ {formatKorDate(group.ancestor.deathDate)} 공동상속인 중 [{group.ancestor.name}]은(는) 사망하였으므로 그 {group.type === '대습상속' ? '대습상속인' : '상속인'}</td></tr>{group.directShares.map(f => renderShareRow(f, depth + 1, group.ancestor.id))}{group.subGroups.map(sg => renderGroup(sg, depth + 1))}</React.Fragment>);
                return (
                  <div className="w-full text-[#37352f] dark:text-neutral-200">
                    <div className="mb-4 flex items-center justify-between no-print"><div className="flex items-center gap-6"><h2 className="text-lg font-black text-[#37352f] dark:text-neutral-200 flex items-center gap-2"><IconList className="w-5 h-5 text-[#787774]"/> 지분 요약표</h2><div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-full px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100"><svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg><input type="text" placeholder="이름 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-[13px] w-16 focus:w-28 transition-all" />{matchIds.length > 0 && <span className="text-[11px] text-neutral-500 font-medium ml-1">{currentMatchIdx + 1}/{matchIds.length}</span>}</div></div></div>
                    <table className="w-full border-collapse text-[13px]"><thead className="bg-[#fcfcfb] dark:bg-neutral-800/40"><tr><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[40%] text-[#787774]">상속인 성명</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">최종 지분 (통분 전)</th><th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">최종 지분 (통분 후)</th></tr></thead><tbody>{topDirect.map(f => renderShareRow(f, 0))}{topGroups.map(g => renderGroup(g, 0))}</tbody><tfoot className="bg-[#fcfcfb] dark:bg-neutral-800/40"><tr><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-right font-medium text-[#787774]">합계 검증</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">{totalSumN} / {totalSumD}</td><td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[12.5px]">{(() => { const sumVal = totalSumD ? totalSumN / totalSumD : 0; const targetVal = simpleTargetD ? simpleTargetN / simpleTargetD : 1; if (totalSumN === 0) return <span className="text-[#b45309] font-bold">⚠️ 생존 상속인 없음</span>; if (sumVal === targetVal) return <span className="text-[#504f4c]">✅ 법정상속인 지분과 일치</span>; return <span className="text-red-500 font-bold">❌ 지분 합계 불일치</span>; })()}</td></tr></tfoot></table>
                    {!isMatch && mismatchReasons.length > 0 && <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-lg"><div className="flex items-center gap-2 mb-2"><span className="text-red-600 font-bold text-[14px]">⚠️ 상속 지분 배분 안내</span></div><ul className="list-disc pl-5 text-[#c93f3a] space-y-1.5 text-[13px] font-medium">{mismatchReasons.map((r, idx) => (<li key={idx}>{r.text || r}</li>))}</ul></div>}
                  </div>
                );
              })()}
              {activeTab === 'amount' && (() => {
                // 법정상속분 요약표와 동일한 순서로 구체적 상속분 렌더링
                // personId → amountResult 룩업 맵
                const resultMap = new Map();
                (amountCalculations?.results || []).forEach(r => resultMap.set(r.personId, r));

                // 요약표(summary)와 동일한 트리 순서로 행 목록 빌드
                const orderedRows = [];
                const printedAmtIds = new Set();

                const pushAmtRow = (share) => {
                  if (!share || printedAmtIds.has(share.personId)) return;
                  const res = resultMap.get(share.personId);
                  if (!res) return;
                  printedAmtIds.add(share.personId);
                  orderedRows.push({ type: 'row', res });
                };

                // 직접 상속인(root 직계 생존자)
                (finalShares.direct || []).forEach(pushAmtRow);

                // 대습/재상속 그룹 (subGroups 순서 = tree.heirs 순서)
                (finalShares.subGroups || []).forEach(group => {
                  if (group.shares.some(s => resultMap.has(s.personId))) {
                    const isSubst = group.ancestor.deathDate && isBefore(group.ancestor.deathDate, tree.deathDate);
                    orderedRows.push({ type: 'header', ancestor: group.ancestor, label: isSubst ? '대습상속인' : '재상속인' });
                    group.shares.forEach(pushAmtRow);
                  }
                });

                const renderAmtInput = (personId, state, setter, colorClass, ringClass) => (
                  <input
                    type="text"
                    placeholder="0"
                    value={state[personId] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setter(prev => ({ ...prev, [personId]: val ? Number(val).toLocaleString() : '' }));
                    }}
                    className={`w-full px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-600 rounded text-right text-[13px] font-mono bg-white dark:bg-neutral-900 ${colorClass} ${ringClass} outline-none focus:ring-1 transition-all`}
                  />
                );

                return (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* 재산가액 입력 */}
                    <div className="flex items-center gap-4 p-4 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-xl border border-[#e9e9e7] dark:border-neutral-700">
                      <span className="text-[13px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap shrink-0">상속재산가액</span>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          placeholder="예: 1,000,000,000"
                          value={propertyValue}
                          onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setPropertyValue(val ? Number(val).toLocaleString() : ''); }}
                          className="flex-1 max-w-xs px-3 py-2 text-[14px] border border-[#e9e9e7] dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-400 text-right font-mono outline-none"
                        />
                        <span className="text-[13px] text-neutral-500 font-medium">원</span>
                        {amountCalculations && <span className="text-[12px] text-[#787774] dark:text-neutral-400 ml-2">간주상속재산: <span className="font-bold text-[#37352f] dark:text-neutral-200 font-mono">{amountCalculations.deemedEstate.toLocaleString()}</span>원</span>}
                      </div>
                    </div>

                    {/* 구체적 상속분 테이블 */}
                    {orderedRows.length === 0
                      ? <div className="py-16 text-center text-[#787774] dark:text-neutral-500 text-[14px]">법정 상속분 요약표에 상속인이 없습니다.</div>
                      : (
                        <div className="rounded-xl border border-[#e9e9e7] dark:border-neutral-700 overflow-hidden shadow-sm">
                          <table className="w-full text-[13px] border-collapse">
                            <thead className="bg-[#f8f9fa] dark:bg-neutral-900/50 text-[#787774] dark:text-neutral-400 font-bold border-b border-[#e9e9e7] dark:border-neutral-700">
                              <tr>
                                <th className="px-4 py-3 text-center w-[22%]">상속인</th>
                                <th className="px-4 py-3 text-center w-[14%]">법정지분</th>
                                <th className="px-4 py-3 text-center w-[18%]">특별수익 <span className="text-red-400">(-)</span></th>
                                <th className="px-4 py-3 text-center w-[18%]">기여분 <span className="text-green-500">(+)</span></th>
                                <th className="px-4 py-3 text-right w-[28%] text-[#1e56a0] dark:text-blue-400">구체적 상속분 산출액</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f1ef] dark:divide-neutral-700/50">
                              {orderedRows.map((item, idx) => {
                                if (item.type === 'header') {
                                  return (
                                    <tr key={`hdr-${idx}`} className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                                      <td colSpan="5" className="px-4 py-2 text-left text-[#504f4c] dark:text-neutral-400 text-[12px]">
                                        ※ [{item.ancestor.name}] {formatKorDate(item.ancestor.deathDate)} 사망 → {item.label}
                                      </td>
                                    </tr>
                                  );
                                }
                                const { res } = item;
                                return (
                                  <tr key={res.personId} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/30 transition-colors">
                                    <td className="px-4 py-2.5 text-center font-bold text-neutral-800 dark:text-neutral-200">{res.name}</td>
                                    <td className="px-4 py-2.5 text-center font-mono text-[#504f4c] dark:text-neutral-400">{res.un} / {res.ud}</td>
                                    <td className="px-3 py-2">
                                      {renderAmtInput(res.personId, specialBenefits, setSpecialBenefits, 'text-red-600 dark:text-red-400', 'focus:ring-red-400')}
                                    </td>
                                    <td className="px-3 py-2">
                                      {renderAmtInput(res.personId, contributions, setContributions, 'text-green-600 dark:text-green-400', 'focus:ring-green-400')}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[15px] text-neutral-900 dark:text-neutral-100">
                                      {res.finalAmount.toLocaleString()} <span className="text-[12px] font-normal text-neutral-400">원</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-[#f8f9fa] dark:bg-neutral-900/50 border-t-2 border-[#d4d4d4] dark:border-neutral-600">
                              <tr>
                                <td colSpan="4" className="px-4 py-3 text-right text-[13px] font-bold text-[#787774] dark:text-neutral-400">합계:</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-[16px] text-[#1e56a0] dark:text-blue-400">
                                  {amountCalculations?.totalDistributed.toLocaleString() ?? '—'} <span className="text-[12px] font-normal text-neutral-400">원</span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    }

                    {amountCalculations?.remainder > 0 && (
                      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg text-amber-800 dark:text-amber-400">
                        <span className="text-[18px] shrink-0 mt-0.5">ℹ️</span>
                        <div>
                          <h4 className="font-bold text-[13px] mb-1">[단수 처리 안내] 미분배 잔여금 {amountCalculations.remainder.toLocaleString()}원 발생</h4>
                          <p className="text-[12.5px] opacity-90 leading-relaxed">소수점 버림 계산으로 인한 잔여금입니다. 협의서 작성 시 상속인 1명(주로 연장자)의 산출액에 가산하여 총액({amountCalculations.estateVal.toLocaleString()}원)을 맞춰주세요.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </main>
      {showScrollTop && <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white/20 dark:border-neutral-700/30 text-[#2383e2] dark:text-blue-400 px-5 py-2.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-bold no-print"><span className="text-[16px]">↑</span> 맨 위로</button>}
        {isAiModalOpen && (() => {
          const targetTab = deceasedTabs.find(t => t.id === aiTargetId); 
          const targetName = aiTargetId === 'root' ? '전체 가계도' : `[${targetTab?.name || '상속인'}] 하위`;
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30">
                  <h2 className="text-lg font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <span>✨</span> {targetName} AI 자동 입력기 <span className="text-sm font-medium opacity-70 ml-1">(제적등본 / 가계도)</span>
                  </h2>
                  <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <IconX className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-neutral-700/50 rounded-lg border border-gray-200 dark:border-neutral-600">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">1단계: 명령어 복사하기</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                      아래 버튼을 눌러 명령어를 복사한 후, <b>뤼튼, ChatGPT, 클로드, 제미나이</b> 앱에 문서 사진과 함께 붙여넣으세요.<br/>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">※ 공문서(제적등본, 가족관계증명서)는 물론, 신청인이 직접 손으로 그린 가계도 등 사문서 사진도 완벽하게 인식합니다!</span>
                    </p>
                    {(() => {
                      const aiPromptText = `첨부한 문서(제적등본, 가족관계증명서, 가계도 메모 등) 사진을 보고, 아래 [출력 양식]의 JSON 구조에 맞춰 가족 관계를 추출해줘.

                      🚨 [행동 지침: 투스텝(Two-Step) 처리]
                      문서를 분석할 때, 글씨가 흐릿하거나 관계/성별/날짜가 명확하지 않은 부분이 있다면 **절대 임의로 추측해서 JSON을 먼저 만들지 마.** 대신, 아래 [질문 양식]처럼 사용자에게 명확하게 질문을 먼저 던져서 확인받아. 사용자가 답변을 주면, 그때 최종 JSON 코드를 출력해.

                      [질문 양식 예시 (모호한 부분이 있을 때만 이렇게 출력)]
                      완벽한 데이터 입력을 위해 아래 내용의 확인이 필요합니다.

                      1) 이영수 사망일: YYYY-MM-DD (사진상 1972-11-22인지 23인지 불명확함)
                      2) 박민호 가지 구조: 맞다 / 아니다 (수정내용 기재)
                      3) 정하나, 정두리, 정세찌: 각각 남/여 기재
                      4) 강우진: 남/여 기재
                      5) 최은지 재혼 상대: 정확한 이름 (사진상 판독 어려움)

                      가능하면 위 번호 형식에 맞춰 답변을 부탁드립니다. 답변을 주시면 즉시 JSON 코드를 생성하겠습니다.

                      ---

                      [가족 관계 추출 규칙]
                      1. 중심 인물(망인)을 기준으로 남자는 "son", 여자는 "daughter", 배우자는 "wife" 또는 "husband"로 작성해.
                      2. 🚨 [중요/예외] 피상속인 사망일이 1991년 1월 1일 이후인데 문서상 자녀의 성별이 불분명한 경우(예: '자녀'로만 표기), 이 경우는 사용자에게 질문하지 말고 일괄적으로 관계를 "son"으로 임의 지정해서 처리해.
                      3. 사망자는 isDeceased를 true로 하고, deathDate를 "YYYY-MM-DD" 형태로 넣어.
                      4. 🚨 [중요] 제적등본에 전처, 후처 등 배우자가 여러 명 기재되어 있다면 임의로 판단/삭제하지 말고 문서에 있는 대로 일단 전부 다 입력해!
                      5. 문서에 출가일(혼인일)이 있으면 marriageDate에, 재혼일이 있으면 remarriageDate에 "YYYY-MM-DD" 형태로 기재해.
                      6. 자녀들은 반드시 해당 부모의 heirs 배열 안에 정확히 넣어.
                      7. (모든 질문이 해결되었거나 모호한 점이 없을 때) 응답은 무조건 JSON 코드 블록으로만 출력해. 다른 부연 설명은 하지 마.

                      [출력 양식 예시]
                      {
                      "name": "김철수", "isDeceased": true, "deathDate": "1980-01-01",
                      "heirs": [
                      { "name": "이영희", "relation": "wife", "isDeceased": true, "deathDate": "1975-01-01" },
                      { "name": "박영자", "relation": "wife", "remarriageDate": "1985-05-05" },
                      { "name": "김바다", "relation": "daughter", "marriageDate": "1995-10-20" }
                      ]
                      }`;
                      const qrPromptText = `제적등본 등 사진을 보고 아래 JSON으로 추출해.
[규칙]
1. 남:son, 여:daughter, 배우자:wife/husband
2. 1991년 이후 사망자 자녀 성별 모르면 무조건 son
3. 사망 isDeceased:true, deathDate:"YYYY-MM-DD"
4. 전처/후처 등 모든 배우자 입력. 혼인/재혼일 기재
5. 🚨 모호한 글씨나 성별/날짜는 임의추측 금지! 반드시 사용자에게 번호 매겨서 질문 먼저 할 것!
[양식]
{"name":"망인","isDeceased":true,"heirs":[{"name":"배우자","relation":"wife"}]}`;
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => navigator.clipboard.writeText(aiPromptText).then(() => alert('✅ 명령어가 복사되었습니다!'))} className="flex-1 py-2.5 bg-white dark:bg-neutral-800 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 rounded-md font-bold hover:bg-indigo-50 transition-colors shadow-sm">📋 명령어 복사하기</button>
                            <button type="button" onClick={() => setShowQrCode(!showQrCode)} className="flex-1 py-2.5 border-2 border-blue-500 bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 rounded-md font-bold hover:bg-blue-50 shadow-sm">{showQrCode ? '🙈 QR 숨기기' : '📱 스마트폰 QR 전송'}</button>
                          </div>
                          {showQrCode && (
                            <div className="mt-4 flex flex-col items-center justify-center p-6 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-inner">
                              <div className="p-3 bg-white rounded-xl shadow-sm"><QRCodeSVG value={qrPromptText} size={220} level="L" includeMargin={true} /></div>
                              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 font-medium text-center">스마트폰 카메라로 스캔하세요.<br/><span className="text-blue-500 font-bold">인터넷 없이도</span> 프롬프트가 복사됩니다!</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div><h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">2단계: 결과 데이터 붙여넣기</h3><textarea value={aiInputText} onChange={(e) => setAiInputText(e.target.value)} placeholder="AI가 만들어준 코드를 붙여넣으세요." className="w-full h-48 p-3 border border-gray-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200" /></div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-neutral-700 flex justify-end gap-2 bg-gray-50 dark:bg-neutral-800/50">
                  <button onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-md transition-colors">취소</button>
                  <button 
                    onClick={() => {
                      try {
                        const cleanJson = aiInputText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsedTree = JSON.parse(cleanJson);
                        
                        // 1. 전체 가계도를 순회하며 ID를 부여하는 로직
                        const processAiData = (node) => {
                          if (Array.isArray(node)) { node.forEach(processAiData); return; }
                          if (!node.id) node.id = `ai_${Math.random().toString(36).substr(2, 9)}`;
                          
                          // 🚨 [오류 해결] 자녀가 있다고 부모를 무조건 강제 배제(선사망)하던 악성 코드 삭제됨!
                          
                          if (node.heirs) node.heirs.forEach(processAiData);
                        };
                        processAiData(parsedTree);

                        // 2. 전체 덮어쓰기 모드 (피상속인 탭에서 실행 시)
                        if (aiTargetId === 'root') setTree({ ...parsedTree, id: 'root' });
                        
                        // 3. 부분 추가 모드 (특정 상속인 탭에서 실행 시)
                        else {
                          const targetRawIds = [];
                          const findRawIds = (n) => { if (n.id === aiTargetId || n.personId === aiTargetId) targetRawIds.push(n.id); if (n.heirs) n.heirs.forEach(findRawIds); };
                          findRawIds(tree);
                          
                          setTree(prev => {
                            const injectHeirs = (n) => {
                              if (targetRawIds.includes(n.id)) {
                                const generateNewHeirs = (heirsArray) => (heirsArray || []).map(h => ({ ...h, id: `ai_${Math.random().toString(36).substr(2, 9)}`, heirs: generateNewHeirs(h.heirs || []) }));
                                const sourceHeirs = Array.isArray(parsedTree) ? parsedTree : (parsedTree.heirs || []);
                                const newHeirs = generateNewHeirs(sourceHeirs);
                                const nodeUpdates = {};
                                
                                if (!Array.isArray(parsedTree)) { 
                                  if (parsedTree.deathDate) nodeUpdates.deathDate = parsedTree.deathDate; 
                                  if (parsedTree.marriageDate) nodeUpdates.marriageDate = parsedTree.marriageDate; 
                                  if (parsedTree.remarriageDate) nodeUpdates.remarriageDate = parsedTree.remarriageDate; 
                                  if (parsedTree.isDeceased !== undefined) nodeUpdates.isDeceased = parsedTree.isDeceased; 
                                }
                                
                                // 🚨 [오류 해결] 하위 상속인 추가 시 부모를 강제 배제하던 악성 코드 삭제됨!
                                
                                return { ...n, ...nodeUpdates, heirs: [...(n.heirs || []), ...newHeirs] };
                              }
                              return { ...n, heirs: n.heirs?.map(injectHeirs) || [] };
                            };
                            return injectHeirs(prev);
                          });
                        }
                        setIsAiModalOpen(false); setAiInputText(""); alert(`✨ 성공적으로 자동 입력되었습니다!`);
                      } catch (error) { alert("🚨 데이터 형식이 잘못되었습니다."); }
                    }}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold shadow-md transition-colors"
                  >
                    🚀 상속인 자동 입력
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center no-print text-[#37352f]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2">새 작업 시작</h2>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print text-[#37352f]"><div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]"><h2 className="text-xl font-bold mb-2">동일 인물 정보 동기화</h2><p className="text-[14px] text-[#787774] mb-6"><span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 정보를 변경하셨습니다.<br/>가계도 내의 다른 <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>님의 동일 정보도 같이 수정할까요?</p><div className="flex flex-col gap-2"><button onClick={() => handleSyncConfirm(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">예, 모두 동기화합니다</button><button onClick={() => handleSyncConfirm(false)} className="w-full py-2.5 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">아니요, 현재 인물만 수정합니다</button></div></div></div>
      )}
      {duplicateRequest && (() => {
        const handleToggleConfirm = (isDifferent) => { duplicateRequest.onConfirm(!isDifferent); };
        return (
          <div className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center no-print text-[#37352f] backdrop-blur-[2px]"><div className="bg-white p-10 rounded-[24px] shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300 border border-[#e9e9e7] text-center"><div className="mb-6 flex justify-center"><div className="w-20 h-20 bg-[#f0f9ff] dark:bg-blue-900/10 rounded-full flex items-center justify-center border border-[#bae6fd]"><IconUserGroup className="w-10 h-10 text-[#2383e2]" /></div></div><h2 className="text-[20px] font-black mb-3">동일인 여부 확인</h2><p className="text-[15px] leading-relaxed mb-8 text-[#504f4c]"><span className="font-bold text-[#2383e2]">'{duplicateRequest.name}'</span>님이 두 번 입력되었습니다.<br/>이 두 분은 <span className="font-black text-rose-500">서로 다른 인물(동명이인)</span>인가요?</p><div className="relative w-full h-[52px] bg-[#f1f1ef] dark:bg-neutral-800 rounded-full p-1.5 flex items-center mb-8 border border-[#e9e9e7]"><div className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-neutral-700 rounded-full shadow-md transition-all duration-300 ease-out" id="toggle-slider" style={{ left: '6px' }} /><button onClick={(e) => { const slider = e.currentTarget.parentElement.querySelector('#toggle-slider'); slider.style.transform = 'translateX(0%)'; setTimeout(() => handleToggleConfirm(true), 300); }} className="relative flex-1 text-center text-[15px] font-black z-10 text-[#2383e2] transition-colors">예 (동명이인)</button><button onClick={(e) => { const slider = e.currentTarget.parentElement.querySelector('#toggle-slider'); slider.style.transform = 'translateX(100%)'; setTimeout(() => handleToggleConfirm(false), 300); }} className="relative flex-1 text-center text-[15px] font-black z-10 text-[#787774] transition-colors">아니오 (동일인)</button></div><button onClick={duplicateRequest.onCancel} className="text-[13px] font-bold text-[#a1a1aa] hover:text-[#787774] underline underline-offset-4 transition-colors p-2">취소 후 직접 수정하기</button></div></div>
        );
      })()}
    </div>
    </>
  );
}

export default App;
