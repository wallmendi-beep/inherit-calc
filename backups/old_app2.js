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
  
  // 1. ?곸냽?ш린, ?곸냽?몄뾾?????뚭툒 臾댁떆?섎뒗 ?곹깭??寃쎄퀬李??꾩쟾??李⑤떒
  if (n.isExcluded && (n.exclusionOption === 'no_heir' || n.exclusionOption === 'renounce' || !n.exclusionOption)) {
    return { isDirect: false, hasDescendant: false };
  }

  // 2. 諛곗슦???좎궗留?泥댄겕 (諛곗슦?먮뒗 ?좎궗留?????듭긽?띿씠 ?놁쑝誘濡??덉쇅 泥섎━)
  const isRootSpouse = level === 1 && ['wife', 'husband', 'spouse', '泥?, '?⑦렪', '諛곗슦??].includes(n.relation);
  const isPreDeceasedSpouse = isRootSpouse && n.deathDate && rootDeathDate && isBefore(n.deathDate, rootDeathDate);

  const requiresHeirsIfExcluded = n.isExcluded && ['lost', 'disqualified'].includes(n.exclusionOption);
  
  // ?뮕 ?섏젙: ?좎궗留?????대뱺 ?꾩궗留??ъ긽???대뱺 '?щ쭩'?덈떎硫?臾댁“嫄??섏쐞 ?곸냽?몄씠 ?꾩슂?? (?? ?좎궗留?諛곗슦?먮뒗 ?쒖쇅)
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

  // ?뮕 ?먯떇/?먯＜ 以묒뿉 寃?됱뼱媛 ?ы븿???몃뱶媛 ?덈뒗吏 ?ㅼ틪 (?덉쑝硫??대뜑瑜??뚯븘???닿린 ?꾪븿!)
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

  // ?뮕 留덈쾿??濡쒖쭅: ???섏쐞 ?대뜑??李얜뒗 ?щ엺???덉쑝硫????대뜑瑜??먮룞?쇰줈 ?쎈땲??
  React.useEffect(() => {
    if (hasMatchingDescendant) setIsExpanded(true);
  }, [hasMatchingDescendant]);

  if (!node) return null;

  // ?좑툘 ?꾨씫 寃쎄퀬 ?곹깭 怨꾩궛 (踰뺤쟻 ?덉쇅 濡쒖쭅 ?곸슜)
  const { isDirect: isDirectMissing, hasDescendant: hasMissingDescendant } = getWarningState(node, deathDate);
  
  // ?뮕 ?덈줈??媛?대뱶 ?곹깭 留??곕룞 濡쒖쭅
  const status = guideStatusMap?.[node.id] || guideStatusMap?.[node.name] || {};
  const showMandatory = status.mandatory || isDirectMissing || (!isExpanded && hasMissingDescendant);
  const showRecommended = status.recommended; // ?뮕 沅뚭퀬 ?ы빆(?꾨벑) ?좊Т

  const warningTitle = isDirectMissing 
    ? "?섏쐞 ?곸냽???낅젰 ?꾨씫 ?섏떖 (吏遺?怨꾩궛?먯꽌 ?쒖쇅?????덉뒿?덈떎)"
    : "?섏쐞 ?곸냽??以??낅젰 ?꾨씫 ?섏떖 (?쇱퀜???뺤씤?섏꽭??";
  
  // ?렓 ?곹깭蹂??ㅽ????뺤쓽 (?앹〈 ?곸냽??媛뺤“ 諛??щ쭩???좊챸??寃?뺤깋)
  const getStatusStyle = (node, hasSubHeirs) => {
    const isAlive = !node.deathDate && !node.isDeceased;
    
    // ?앹〈?? ?쒕졆?섍퀬 李⑤텇???⑥깋 (湲곕낯 援듦린)
    let colorClass = 'text-[#1e56a0] dark:text-[#60a5fa]'; 
    
    if (!isAlive) {
      // ?щ쭩?? ?좊챸??寃?뺤깋/?곗깋 (湲곕낯 援듦린)
      colorClass = 'text-black dark:text-white'; 
    }
    
    let underlineClass = '';
    if (hasSubHeirs) underlineClass = 'underline decoration-[#ef4444] dark:decoration-red-500 decoration-2 underline-offset-4';
    
    return `${colorClass} ${underlineClass}`;
  };

  const hasHeirs = node.heirs && node.heirs.length > 0;
  const itemStyleClass = getStatusStyle(node, hasHeirs);

  // ?뮕 寃???섏씠?쇱씠???ㅽ???  const highlightStyle = isCurrentMatch
    ? 'bg-yellow-200 dark:bg-yellow-800 ring-2 ring-yellow-400 dark:ring-yellow-500 font-black'
    : isMatch
    ? 'bg-yellow-100 dark:bg-yellow-900/50'
    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 px-1 rounded';

  // 以묐났 ?몄텧 諛⑹? 濡쒖쭅 (媛꾩냼???좎?)
  if (node.name && level > 0) visitedHeirs.add(node.name);

  return (
    <div className={`flex flex-col ${level > 0 ? 'ml-3' : ''}`}>
      <div className="flex items-center gap-1.5 py-1 pr-1 group">
        {level > 0 && <span className="text-[#d4d4d4] dark:text-neutral-600 text-[12px] shrink-0 font-bold opacity-40">??/span>}
        <span 
          id={`sidebar-node-${node.id}`} // ?뮕 ?먮룞 ?ㅽ겕濡ㅼ쓣 ?꾪븳 醫뚰몴 ID
          onClick={() => {
            if (hasHeirs) setIsExpanded(!isExpanded);
            onSelectNode && onSelectNode(node.id);
          }}
          className={`text-[13px] truncate transition-all flex-1 min-w-0 cursor-pointer ${itemStyleClass} ${highlightStyle}`}
        >
          {node.name || (level === 0 ? '?쇱긽?띿씤' : '(?대쫫 ?놁쓬)')}
        </span>
        
        {/* ?뮕 ?섏젙: ?먮윭硫??슚, 沅뚭퀬硫??뮕 瑜??꾩썙以띾땲?? */}
        <div className="flex items-center gap-1 shrink-0">
          {showMandatory && <span className="text-[12px] cursor-help opacity-100" title={warningTitle}>?슚</span>}
          {!showMandatory && showRecommended && <span className="text-[12px] cursor-help opacity-100" title="沅뚭퀬 ?ы빆 (??">?뮕</span>}
          
          {level > 0 && (() => {
            const isSpouse = ['wife', 'husband', 'spouse', '泥?, '?⑦렪', '諛곗슦??].includes(node.relation);
            const isPre = node.isDeceased && node.deathDate && deathDate && isBefore(node.deathDate, deathDate) && !isSpouse;
            return (
              <span className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${isPre ? 'text-[#37352f] opacity-60' : 'text-[#787774]'}`}>
                [{getRelStr(node.relation, deathDate) || '?먮?'}]
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
  const [zoomLevel, setZoomLevel] = useState(1.0); // ?뮕 硫붿씤 ?낅젰李??뺣?/異뺤냼 ?곹깭 異붽?
  
  // ?뮕 1?? ?붿빟???곸냽??寃?됱슜 State ?좎뼵 (理쒖긽??諛곗튂!)
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIds, setMatchIds] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ... (以묐왂: ?ㅽ떚而??붿쭊 諛?History 湲곕뒫 ??湲곗〈 ?곹깭???좎?) ...

  // ?뮕 2?? 怨꾩궛 濡쒖쭅 (finalShares ??
  // (?댄썑 ?꾨옒 肄붾뱶?먯꽌 finalShares媛 ?좎뼵??


  // ?뮕 ?쒕줈 ?쒕젅??Zero-Delay) ?뚮줈???ㅽ떚而??붿쭊
  const stickerRef = useRef(null);
  const stickerPos = useRef({ x: 0, y: 0 });
  const [isStickerDragging, setIsStickerDragging] = useState(false);

  const handleStickerMouseDown = (e) => {
    // ?뮕 1. 釉뚮씪?곗???湲곕낯 ?쒕옒洹?湲곕뒫(?띿뒪??釉붾줉 吏??????媛뺤젣濡?留됱븘 踰꾨쾮嫄곕┝ ?먯쿇 李⑤떒
    e.preventDefault(); 
    
    // 2. ?쒓컖?곸씤 洹몃┝???④낵瑜??꾪빐 ?곹깭留?耳쒕몺 (?닿쾬??湲곕떎由ъ? ?딆쓬!)
    setIsStickerDragging(true);

    // 3. ?대┃???쒓컙??留덉슦???꾩튂? ?ㅽ떚而??꾩튂??李⑥씠瑜?利됱떆 怨꾩궛
    const startX = e.clientX - stickerPos.current.x;
    const startY = e.clientY - stickerPos.current.y;

    // 4. 留덉슦?ㅺ? ?吏곸씪 ?뚮쭏??利됯컖?곸쑝濡?DOM???吏곸씠??吏곹넻 ?⑥닔
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

    // ?뮕 5. ?대┃(MouseDown) ?섏옄留덉옄 0.001珥덉쓽 ?湲곗뿴???놁씠 留덉슦??異붿쟻湲곕? 諛붾줈 ?ъ븘踰꾨┝!
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  // Undo/Redo ?꾪븳 History 湲곕뒫 異붽?
  const [treeState, setTreeState] = useState({
    history: [getInitialTree()],
    currentIndex: 0
  });

  const rawTree = treeState.history[treeState.currentIndex] || getInitialTree();

  const setTree = (action) => {
    setTreeState(prev => {
      const currentTree = prev.history[prev.currentIndex];
      const newTree = typeof action === 'function' ? action(currentTree) : action;
      const parsedTree = JSON.parse(JSON.stringify(newTree)); // 源딆? 蹂듭궗 蹂댁옣
      
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(parsedTree);
      if (newHistory.length > 50) newHistory.shift();
      
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    });
  };

  // 1. Tree ?뚯떛 諛?援щ쾭??JSON 留덉씠洹몃젅?댁뀡 (personId ?먮룞 遺??
  const tree = useMemo(() => {
    const seenIds = new Set();
    const nameToPersonId = new Map(); // 援щ쾭???곗씠?곗쓽 ?숇챸?댁씤 ?먮룞 臾띠쓬??
    const sanitize = (node) => {
      if (!node) return null;
      if (seenIds.has(node.id)) return null; 
      seenIds.add(node.id);
      
      const copy = { ...node };
      
      // ?뮕 ?듭떖: personId媛 ?놁쑝硫??앹꽦 (援щ쾭???명솚)
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
    
    // ?뮕 2?④퀎: ?대줎 ?숆린?????숈씪 personId瑜?怨듭쑀?섎뒗 ?몃뱶?ㅼ쓽 heirs 諛??꾨씫 ?꾨뱶瑜??듭씪
    const syncCloneHeirs = (root) => {
      // (a) ?몃━ ?꾩껜瑜??쒗쉶?섏뿬 personId蹂??몃뱶 李몄“ 紐⑸줉???섏쭛
      const personIdMap = new Map();
      const collectNodes = (node) => {
        if (!node || !node.personId) return;
        if (!personIdMap.has(node.personId)) personIdMap.set(node.personId, []);
        personIdMap.get(node.personId).push(node);
        if (node.heirs) node.heirs.forEach(collectNodes);
      };
      collectNodes(root);

      // (b) 媛?personId 洹몃９???쒗쉶?섎ŉ ?숆린??      for (const [pId, nodes] of personIdMap) {
        if (nodes.length < 2) continue; // ?대줎???놁쑝硫??ㅽ궢
        
        // ?뺣낯 ?좎젙 1: heirs 諛곗뿴??媛??湲??몃뱶
        let master = nodes[0];
        for (const n of nodes) {
          if ((n.heirs?.length || 0) > (master.heirs?.length || 0)) master = n;
        }
        
        // ?슚 ?뺣낯 ?좎젙 2: ?꾧뎔媛 紐낆떆?곸쑝濡??ㅼ쐞移섎? 猿먮뒗吏 ?뺤씤 (臾댁옄? ?щ쭩??媛뺤젣 ?숆린?붿슜)
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
          // (c-1) heirs ?숆린?? ?뺣낯蹂대떎 ?곸쑝硫?deep-copy
          const masterHeirs = master.heirs || [];
          if (masterHeirs.length > 0 && (clone.heirs?.length || 0) < masterHeirs.length) {
            clone.heirs = masterHeirs.map(h => {
              const deepClone = (n) => ({
                ...n,
                id: `n_${Math.random().toString(36).substr(2, 9)}`, // ?붾㈃ 異⑸룎 諛⑹?????ID
                personId: n.personId, // 吏꾩쭨 ?몃Ъ DNA???좎?
                heirs: (n.heirs || []).map(deepClone)
              });
              return deepClone(h);
            });
            // ?먮?媛 蹂듭궗?섏뼱 ?앷꼈?쇰?濡?媛뺤젣濡??ㅼ쐞移?ON (?뺤긽??
            clone.isExcluded = false;
            clone.exclusionOption = '';
          }
          // ?슚 (c-2) ?듭떖 ?쎌뒪: ?먮?媛 0紐낆씤 ?щ쭩?먯씤???ㅻⅨ 諛⑹뿉???ㅼ쐞移섍? 爰쇱졇?덈떎硫? 
          // ?닿쾬? "臾쇰━???좎궗留?臾댁옄?"?대?濡?臾댁“嫄?紐⑤뱺 諛⑹쓽 ?ㅼ쐞移섎? ?④퍡 ?뺣땲??
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

  // ?㎛ ?곸냽????紐⑸줉 (?뮕 湲곗???id?먯꽌 personId濡??꾨㈃ ?듯빀!)
  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set(); // ?대쫫???꾨땶 DNA(personId) 湲곗??쇰줈 以묐났 諛⑹?
    
    tabMap.set('root', { id: 'root', personId: 'root', name: tree.name || '?쇱긽?띿씤', node: tree, parentName: null, level: 0, branchRootId: null });

    const queue = [];
    if (tree.heirs) tree.heirs.forEach(h => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));

    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      const isTarget = node.isDeceased || (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified'));
      const isSpouseOfRoot = parentNode.id === 'root' && (node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse');
      const isDisqualifiedSpouse = isSpouseOfRoot && node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);

      let currentBranchRootId = branchRootId;
      const pId = node.personId; // ?뮕 猿띾뜲湲?id媛 ?꾨땶 怨좎쑀 personId ?ъ슜

      if (isTarget && !isDisqualifiedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          // ?뮕 ??쓽 怨좎쑀 ID ?먯껜瑜?personId濡?諛쒓툒??踰꾨┝!
          tabMap.set(pId, { 
            id: pId, 
            personId: pId, 
            name: node.name || '(?곸냽??', 
            node: node, 
            parentNode: parentNode, 
            parentName: parentNode.id === 'root' ? (tree.name || '?쇱긽?띿씤') : parentNode.name, 
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

  // ?뮕 Phase 3: AI ?대퉬寃뚯씠???곹깭 (蹂?踰꾪듉? '耳? 湲곕뒫留??섑뻾)
  const [showNavigator, setShowNavigator] = useState(true);
  const [isNavigatorRolledUp, setIsNavigatorRolledUp] = useState(false);

  // ?뮕 ?뱀젙 ?곸냽???꾩튂濡??대룞 諛??섏씠?쇱씠??(Warp 湲곕뒫 媛쒖꽑: ???먮룞 ?꾪솚 ?ы븿)
  const handleNavigate = (nodeId) => {
    setActiveTab('input');
    
    // 1. ?대떦 nodeId媛 ?대뒓 ??deceasedTabs)???랁빐 ?덈뒗吏 李얠뒿?덈떎.
    let targetTabId = 'root';
    const findTabIdForNode = (currentNode, currentTabId) => {
      if (currentNode.id === nodeId) return currentTabId;
      if (currentNode.heirs) {
        for (const h of currentNode.heirs) {
          // ?щ쭩???щ엺?대굹 ?뱀젙 ?ъ쑀媛 ?덈뒗 ?щ엺? ?먭린留뚯쓽 ??personId)??媛吏묐땲??
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

    // 2. ???꾪솚 ???붿냼媛 ?뚮뜑留곷맆 ?쒓컙??以 ???ㅽ겕濡?諛??섏씠?쇱씠??    setTimeout(() => {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'bg-blue-50/50');
        }, 2000);
      }
    }, 150); // ???꾪솚 ?湲곕? ?꾪빐 ?쒓컙???뚰룺 ?섎┝
  };

  // ?뮕 Phase 3: AI 媛怨꾨룄 留덈쾿???곹깭
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({ name: '', deathDate: '', hasSpouse: true, sons: 0, daughters: 0 });

  // ?뮕 留덈쾿???꾨즺 ??媛怨꾨룄 ?먮룞 ?앹꽦 ?⑥닔
  const applyWizard = () => {
    const genId = () => Math.random().toString(36).substring(2, 9);
    const newTree = {
      id: 'root',
      personId: 'root',
      name: wizardData.name || '?쇱긽?띿씤',
      deathDate: wizardData.deathDate || '',
      shareN: 1, shareD: 1,
      heirs: []
    };

    if (wizardData.hasSpouse) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: '諛곗슦??, relation: 'wife', isDeceased: false });
    }
    for(let i=0; i<wizardData.sons; i++) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: `?꾨뱾${i+1}`, relation: 'son', isDeceased: false });
    }
    for(let i=0; i<wizardData.daughters; i++) {
      newTree.heirs.push({ id: `h_${genId()}`, personId: `p_${genId()}`, name: `??{i+1}`, relation: 'daughter', isDeceased: false });
    }

    setTree(newTree);
    setShowWizard(false);
    setWizardStep(0);
    setActiveTab('input');
  };

  const [isFolderFocused, setIsFolderFocused] = useState(false); // ?쒕쪟泥??ъ빱??紐⑤뱶 (?대뜑 ?닿린)
  const [summaryExpanded, setSummaryExpanded] = useState(true); // 媛怨꾨룄 ?붿빟 ?쒖떆 ?щ?
  const [sidebarToggleSignal, setSidebarToggleSignal] = useState(1); // 媛怨꾨룄 ?붿빟 ?꾩껜 ?묎린/?쇱묠 ?좏샇 (1: ?쇱묠, -1: ?묓옒)
  const [mainQuickVal, setMainQuickVal] = useState('');          // 硫붿씤 ?낅젰李쎌슜 ???낅젰 媛?  const [isMainQuickActive, setIsMainQuickActive] = useState(false); // 硫붿씤 ?낅젰李쎌슜 ???낅젰 ?쒖꽦??
  // ?쩃 以묐났 ?깅챸 諛??숈씪??愿由??곹깭
  const [duplicateRequest, setDuplicateRequest] = useState(null); // { name, parentName, relation, onConfirm(isSame) }

  // ?몃━ ?꾩껜?먯꽌 ?뱀젙 ?대쫫??媛吏??몃뱶??蹂몄씤 ?쒖쇅)??李얜뒗 ?ы띁
  const findDuplicates = (node, name, excludeId, results = []) => {
    if (!name || name.trim() === '') return results;
    if (node.id !== excludeId && node.name === name.trim()) {
      results.push(node);
    }
    if (node.heirs) node.heirs.forEach(h => findDuplicates(h, name, excludeId, results));
    return results;
  };

  // ?뱀젙 ?몃뱶??遺紐??몃뱶瑜?李얜뒗 ?ы띁 (?꾩튂 ?뺣낫 ?쒖떆??
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
  // ???낅젰 ?쒖텧: ?대쫫?ㅼ쓣 ?뚯떛?댁꽌 ?곸냽??異붽? + 紐⑤뱺 ?대줎(遺꾩떊) ?숆린??  const handleQuickSubmit = (parentId, parentNode, value) => {
    if (!value.trim()) return;
    const names = value.split(/[,竊뚣?s]+/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    setTree(prev => {
      let newTree = JSON.parse(JSON.stringify(prev));
      const usedNames = new Set((parentNode.heirs || []).map(h => h.name));

      // ?뮕 1. ??쓽 二쇱씤??媛吏?吏꾩쭨 DNA(personId) 李얘린
      let targetPersonId = parentId;
      const findPId = (n) => {
        if (n.id === parentId) targetPersonId = n.personId;
        if (n.heirs) n.heirs.forEach(findPId);
      };
      findPId(newTree);

      // ?뮕 2. ?덈줈 異붽????곸냽?몃뱾??'湲곕낯 ?' 誘몃━ 留뚮뱾湲?
      // (?대줎?ㅻ쭏???쒕줈 ?ㅻⅨ personId媛 諛쒓툒?섎뒗 ?李몄궗瑜?留됯린 ?꾪빐!)
      const hasSpouse = (parentNode.heirs || []).some(h => ['wife', 'husband', 'spouse'].includes(h.relation));
      
      // ?뮕 遺紐⑥쓽 ?깅퀎 ?먮룞 ?먮퀎 (?먮???諛곗슦?먯쓽 愿怨??곗씠?곕? ?쎌뼱?듬땲??
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
          personId: `p_${Date.now()}_${idx}`, // 紐⑤몢媛 怨듭쑀??怨좎쑀 DNA
          name: finalName,
          relation: isSpouse ? (isParentFemale ? 'husband' : 'wife') : 'son',
          isDeceased: false,
          isSameRegister: true,
          heirs: []
        });
      });

      // ?뮕 3. ?몃━瑜??앷퉴吏 ???ㅼ?硫?紐⑤뱺 遺꾩떊?먭쾶 鍮좎쭚?놁씠 異붽? (.some ???.forEach ?ъ슜)
      const syncAllClones = (node) => {
        if (node.id === parentId || node.personId === targetPersonId) {
          if (!node.isDeceased) node.isDeceased = true;
          
          // ?뮕 ?먮?媛 ?낅젰?섎뒗 ?쒓컙, 遺紐⑥쓽 ?곸냽沅??ㅼ쐞移섎? ?먮룞?쇰줈 耳?땲???뺤긽??.
          node.isExcluded = false;
          node.exclusionOption = '';
          
          node.heirs = node.heirs || [];
          newHeirsBase.forEach(baseHeir => {
            node.heirs.push({
              ...baseHeir,
              id: `${baseHeir.baseId}_${Math.random().toString(36).substr(2,4)}` // ?붾㈃??ID留??ㅻⅤ寃??앹꽦
            });
          });
        }
        if (node.heirs) node.heirs.forEach(syncAllClones);
      };

      syncAllClones(newTree);
      return newTree;
    });
  };


  // ?뮕 ?ъ씠???⑤꼸 ?곹깭
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  
  // ?뮕 ?ъ씠?쒕컮 媛怨꾨룄 ?꾩슜 寃???붿쭊 State
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
    
    // ?몃━ ?꾩껜瑜??ㅼ졇???대쫫???쇱튂?섎뒗 ?몃뱶 ID ?섏쭛
    const scan = (n) => {
      if (n.name && n.name.toLowerCase().includes(query)) matches.push(n.id);
      if (n.heirs) n.heirs.forEach(scan);
    };
    scan(tree);
    
    setSidebarMatchIds(matches);
    setSidebarCurrentMatchIdx(0);
  }, [sidebarSearchQuery, tree]);

  // 寃??寃곌낵媛 諛붾뚭굅???붿궡?쒕? ?꾨Ⅴ硫??대떦 ?꾩튂濡??ㅻⅤ瑜??ㅽ겕濡?
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
    { id: 'input', label: '?곗씠???낅젰', icon: <IconFileText className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'tree', label: '媛怨꾨룄', icon: <IconNetwork className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'calc', label: '怨꾩궛??, icon: <IconTable className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'result', label: '怨꾩궛寃곌낵', icon: <IconCalculator className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
    { id: 'summary', label: '?붿빟??, icon: <IconList className="w-4 h-4"/>,
      style: { activeBorder: 'border-[#37352f]', activeText: 'text-[#37352f] dark:text-neutral-100', inactiveBg: 'bg-transparent', inactiveBorder: 'border-transparent', inactiveText: 'text-[#9b9a97]' }
    },
  ];

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // ?⑨툘 ?⑥텞??吏?? Ctrl + Z (?댁쟾), Ctrl + Y (?ъ떎??
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

    // ?뮕 Tab ?? ?먯뿰?ㅻ읇寃??ㅼ쓬 移몄쑝濡??대룞 (Shift ?꾨Ⅴ硫??댁쟾 移?
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        e.preventDefault(); if (i > 0) all[i-1].focus();
      } else {
        e.preventDefault(); if (i < all.length - 1) all[i+1].focus();
      }
      return;
    }

    // ?뮕 ????Enter ??    if (e.key === 'ArrowDown' || e.key === 'Enter') { 
      e.preventDefault(); if (i < all.length - 1) all[i+1].focus(); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); if (i > 0) all[i-1].focus(); 
    } 
    // ?뮕 醫???諛⑺뼢??(媛숈? ???덉뿉???대룞)
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
    // ?뤇截??대쫫 蹂寃???以묐났 泥댄겕 濡쒖쭅
    if (field === 'name' && value.trim() !== '') {
      const trimmedValue = value.trim();
      // 湲곕낯 ?대쫫肉먮쭔 ?꾨땲??(2), (3) ???묐???遺숈? ?대쫫?ㅻ룄 紐⑤몢 李얘린 (3踰덉㎏+ ?숇챸?댁씤 泥섎━)
      const baseName = trimmedValue.replace(/\(\d+\)$/, '');
      const dups = findDuplicates(tree, trimmedValue, id);
      // ?묐??ш? 遺숈? ?뺤젣?ㅻ룄 移댁슫??(?? 源?명솚, 源?명솚(2), 源?명솚(3))
      const allSameBaseDups = dups.length > 0
        ? (() => { const r = []; const scan = (n) => { if (n.id !== id && n.name && (n.name === baseName || n.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)$`)))) r.push(n); if (n.heirs) n.heirs.forEach(scan); }; scan(tree); return r; })()
        : [];
      if (dups.length > 0) {
        const existingNode = dups[0];
        const parentNodeOfExisting = findParentNode(tree, existingNode.id);
        const parentNodeOfCurrent = findParentNode(tree, id);
        
        // 1. ?숈씪 ?몃━(媛숈? 遺紐? ??以묐났
        if (parentNodeOfExisting?.id === parentNodeOfCurrent?.id) {
          setDuplicateRequest({
            name: trimmedValue,
            parentName: parentNodeOfExisting?.name || '?쇱긽?띿씤',
            relation: existingNode.relation,
            isSameBranch: true,
            onConfirm: (isSame) => {
              if (isSame) {
                // ?숈씪?몄씤 寃쎌슦: 媛숈? 遺紐??꾨옒 ???щ엺????踰??덉쓣 ???놁쑝誘濡?李⑤떒
                alert(`'${trimmedValue}'?섏? ?대? ???④퀎???곸냽?몄쑝濡??깅줉?섏뼱 ?덉뒿?덈떎.\n?숈씪?몄씠?쇰㈃ ??踰덈쭔 ?깅줉??二쇱꽭??`);
              } else {
                // ?숇챸?댁씤: 湲곗〈 baseName ?몃뱶瑜?(1)濡?癒쇱? 蹂寃?(baseName(1)???꾩쭅 ?놁쑝硫?
                setTree(prev => {
                  const renameBase = (n) => {
                    if (n.id === existingNode.id && n.name === baseName) {
                      return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] };
                    }
                    return { ...n, heirs: n.heirs?.map(renameBase) || [] };
                  };
                  return renameBase(prev);
                });
                // ?좉퇋 ?몃뱶??(2)遺???쒖옉
                const nextSuffix = allSameBaseDups.length + 1;
                applyUpdate(id, 'name', `${baseName}(${nextSuffix})`, false);
              }
              setDuplicateRequest(null);
            },
            onCancel: () => setDuplicateRequest(null)
          });
          return;
        }

        // 2. ?ㅻⅨ ?몃━(?ㅻⅨ 遺紐? ??以묐났: ?숈씪???щ? ?뺤씤
        const parentName = parentNodeOfExisting ? (parentNodeOfExisting.name || '?쇱긽?띿씤') : '?쇱긽?띿씤';
        setDuplicateRequest({
          name: trimmedValue,
          parentName,
          relation: existingNode.relation,
          isSameBranch: false,
          onConfirm: (isSame) => {
            if (isSame) {
              // ?숈씪?? 湲곗〈 ?몃Ъ??ID瑜?遺?ы븯???ㅼ쭏?곸쑝濡?媛숈? ?щ엺?쇰줈 ?곕룞
              const syncIdInTree = (n) => {
                if (n.id === id) return { ...n, name: trimmedValue, personId: existingNode.personId };
                return { ...n, heirs: n.heirs?.map(syncIdInTree) || [] };
              };
              setTree(prev => syncIdInTree(prev));
            } else {
              // ?숇챸?댁씤: 湲곗〈 baseName ?몃뱶瑜?(1)濡?癒쇱? 蹂寃?(baseName(1)???꾩쭅 ?놁쑝硫?
              setTree(prev => {
                const renameBase = (n) => {
                  if (n.id === existingNode.id && n.name === baseName) {
                    return { ...n, name: `${baseName}(1)`, heirs: n.heirs?.map(renameBase) || [] };
                  }
                  return { ...n, heirs: n.heirs?.map(renameBase) || [] };
                };
                return renameBase(prev);
              });
              // ?좉퇋 ?몃뱶??(2)遺???쒖옉
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
      
      // ?먭린 ?먯떊???꾨땶 ?숈씪 ID(?숈씪??媛 ?덈뒗吏 寃??(?대쫫 湲곕컲?먯꽌 ID 湲곕컲 ?숆린?붾줈 ?낃렇?덉씠??
      let hasSamePerson = false;
      const findSamePerson = (n) => {
        if (n.id === id && n !== tree) { /* ?먭린 ?먯떊 ?먯깋 以?(root ?쒖쇅) */ }
        // ?ш린??id媛 媛숈쑝硫??숈씪?몄엫
        const getMyId = (nodeId) => {
           // ?꾩옱 ?몃뱶??ID媛 tree?먯꽌 ?대뵒 ?덈뒗吏 李얠븘??諛섑솚
           let foundId = null;
           const search = (node) => {
             if (node.id === nodeId) { foundId = node.id; return; }
             if (node.heirs) node.heirs.forEach(search);
           };
           search(tree);
           return foundId;
        };
        // 理쒖쟻?? field蹂??숆린?붾뒗 ?대? 媛숈? ID瑜?怨듭쑀?섍퀬 ?덉쑝誘濡? 
        // ??援곕뜲???곗씠?곕쭔 諛붽퓭????(applyUpdate媛 id 湲곕컲?대?濡??먮룞?쇰줈 諛섏쁺??
      };
    }

    // ?뽳툘 ?몄＜ ?곸냽???⑥씪 ?좏깮 濡쒖쭅: ??紐낆쓣 ?몄＜濡?吏?뺥븯硫??ㅻⅨ ?뺤젣???몄＜ ?곹깭瑜??댁젣
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

    // ?숆린???꾩슂 ?녿뒗 ?쇰컲 ?낅뜲?댄듃 (applyUpdate ?대??먯꽌 id 湲곕컲?쇰줈 ?먮룞 ?곕룞??
    applyUpdate(id, field, value, false);
  };

  const applyUpdate = (id, changes, value, syncGlobal = false, syncName = '') => {
    const updates = (typeof changes === 'object' && changes !== null) ? changes : { [changes]: value };

    let targetPersonId = null;
    let targetNode = null; // ?뮕 ?寃??몃뱶 ?꾩껜 ?뺣낫
    const findPersonId = (n) => {
      if (n.id === id) { targetPersonId = n.personId; targetNode = n; }
      if (!targetPersonId && n.heirs) n.heirs.forEach(findPersonId);
    };
    findPersonId(tree);

    // ?뮕 ?숆린?뷀븷 '媛쒖씤 ?좎긽 ?뺣낫' 紐⑸줉 (湲곕낯?곸쑝濡?踰뺤쟻 吏?꾨뒗 ?낅┰???좎?瑜??꾪빐 ?쒖쇅)
    const personalFields = ['name', 'isDeceased', 'deathDate', 'isRemarried', 'remarriageDate', 'marriageDate'];
    const hasPersonalUpdate = Object.keys(updates).some(k => personalFields.includes(k));

    // ?슚 ?듭떖 ?쎌뒪: ?대쾲 ?낅뜲?댄듃媛 '臾댁옄? ?щ쭩?????ㅼ쐞移?議곗옉?몄? ?먮퀎?⑸땲??
    const isExclusionUpdate = updates.isExcluded !== undefined;
    const isDeadWithoutHeirs = targetNode?.isDeceased && (!targetNode?.heirs || targetNode?.heirs.length === 0);

    const updateNode = (n) => {
      if (n.id === id) {
         // ?寃??몃뱶??紐⑤뱺 ?띿꽦 ?뺤긽 ?낅뜲?댄듃
         return { ...n, personId: targetPersonId || n.personId, ...updates };
      } else if (targetPersonId && n.personId === targetPersonId) {
         const filteredUpdates = {};
         // 1. ?좎긽 ?뺣낫 ?숆린??         if (hasPersonalUpdate) {
           Object.keys(updates).forEach(k => {
             if (personalFields.includes(k)) filteredUpdates[k] = updates[k];
           });
         }
         // 2. ?슚 ?ㅼ쐞移??숆린???덉쇅 ?덉슜: ?寃잛씠 '臾댁옄? ?щ쭩???쇰㈃, ?ㅻⅨ 遺紐???뿉?쒕룄 臾쇰━?곸쑝濡??곸냽??遺덇??섎?濡??ㅼ쐞移??곹깭瑜??묎컳???숆린?뷀빀?덈떎!
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
    
    // ?뮕 遺紐⑥쓽 遺꾩떊(?대줎)?ㅼ쓣 紐⑤몢 李얠븘 ?묎컳???먯떇??異붽?!
    const addFn = (n) => {
      if (n.id === parentId || (targetPersonId && n.personId === targetPersonId)) {
        return { 
          ...n, 
          // ?뮕 媛쒕퀎 異붽? ?쒖뿉???곸냽沅??ㅼ쐞移섎? 利됱떆 ?쒖꽦?뷀빀?덈떎.
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

    // ?뮕 ??젣?섎젮????곸쓽 遺꾩떊(?대줎)?ㅺ퉴吏 ????異붿쟻?댁꽌 ?쇨큵 ??젣!
    const rmFn = (n) => ({ 
      ...n, 
      heirs: n.heirs?.filter(x => !(x.id === id || (targetPersonId && x.personId === targetPersonId))).map(rmFn) || [] 
    });
    setTree(prev => rmFn(prev));
  };



  // ?뮕 Phase 2: ?붿쭊???≪븘?대뒗 ?꾨씫 寃쎄퀬(warnings) 異붽? ?곕룞
  // ?뮕 ?붿빟?쒖뿉???ъ슜??湲곗빟遺꾩닔(紐⑺몴 吏遺? 怨꾩궛 蹂??異붽?!
  const [simpleTargetN, simpleTargetD] = math.simplify(tree.shareN || 1, tree.shareD || 1);

  // ?뮕 ?곸냽 怨꾩궛 ?붿쭊???섍린湲?吏곸쟾, ?좎궗留?臾댁옄?瑜?"?먮룞 ?쒖쇅" ?쒖폒二쇰뒗 ?꾩쿂由?濡쒖쭅
  const { finalShares, calcSteps, warnings = [] } = useMemo(() => {
    const applyAutoExclusion = (n, parentDate) => {
      const clone = { ...n };
      const refDate = clone.id === 'root' ? clone.deathDate : parentDate;
      
      // 猷⑦듃媛 ?꾨땲怨? ?섎룞?쇰줈 爰쇱졇?덉? ?딆? ?몃뱶????섏뿬 寃??      if (clone.id !== 'root' && !clone.isExcluded) {
        // 1. ?쇱긽?띿씤蹂대떎 癒쇱? ?щ쭩?덈뒗媛? (?좎궗留?
        const isPre = clone.deathDate && refDate && isBefore(clone.deathDate, refDate);
        // 2. ?섏쐞???낅젰???먮?媛 ?녿뒗媛? (臾댁옄?)
        const isDeadWithoutHeirs = clone.isDeceased && (!clone.heirs || clone.heirs.length === 0);
        
        // ?슚 ?듭떖: ?좎궗留앹씤??臾댁옄??쇰㈃, ?щ엺???ㅼ쐞移섎? ??爰쇰룄 而댄벂?곌? ?뚯븘???쒖쇅 泥섎━!
        if (isPre && isDeadWithoutHeirs) {
          clone.isExcluded = true;
          clone.exclusionOption = 'renounce'; // ?붿쭊??吏遺꾩쓣 ? ?곸냽?몄뿉寃?遺꾨같?섎룄濡??ш린 泥섎━
        }
      }
      
      // ?섏쐞 ?몃뱶?ㅻ룄 ?ш??곸쑝濡??낆깄??寃??      if (clone.heirs) {
        clone.heirs = clone.heirs.map(h => applyAutoExclusion(h, clone.deathDate || refDate));
      }
      return clone;
    };
    
    // ?꾩쿂由ш? ?꾨즺???몃━瑜?怨꾩궛 ?붿쭊???ъ엯!
    const calcTree = applyAutoExclusion(tree, tree.deathDate);
    return calculateInheritance(calcTree, propertyValue);
  }, [tree, propertyValue]);

  // ?뮕 ?붿빟??寃?됱뼱 ?낅젰 ??留ㅼ묶?섎뒗 ?곸냽??李얘린 濡쒖쭅 (珥덇린???ㅻ쪟 諛⑹?瑜??꾪빐 finalShares ?꾨옒濡??대룞)
  useEffect(() => {
    if (!searchQuery.trim() || !finalShares || activeTab !== 'summary') {
      setMatchIds([]);
      setCurrentMatchIdx(0);
      return;
    }
    const query = searchQuery.trim().toLowerCase();
    const matches = [];

    // ?붿빟???뚮뜑留?援ъ“(rowId)??留욎떠 ?좊땲?ы븳 ?ㅺ컪 ?앹꽦 諛?留ㅼ묶 ?뺤씤
    if (finalShares.direct) {
      finalShares.direct.forEach(s => {
        if (s.name && s.name.toLowerCase().includes(query)) matches.push(`summary-row-${s.personId}`);
      });
    }
    
    // ?뮕 李멸퀬: finalShares.subGroups 援ъ“???곕씪 ?ш??곸쑝濡??먯깋
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

  // ?뮕 寃??寃곌낵 ?좏깮 ??遺?쒕읇寃??붾㈃ 以묒븰?쇰줈 ?먮룞 ?ㅽ겕濡?  useEffect(() => {
    if (matchIds.length > 0 && activeTab === 'summary') {
      const targetId = matchIds[currentMatchIdx];
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIdx, matchIds, activeTab]);

  // ?㎛ ?ㅻ쭏??媛?대뱶 ?붿쭊 ?몄텧 (遺꾩꽍 濡쒖쭅 ?몃? 遺꾨━)
  const guideInfo = useSmartGuide(tree, finalShares, activeTab, warnings);
  const { 
    showGlobalWarning, showAutoCalcNotice, globalMismatchReasons, 
    autoCalculatedNames, smartGuides, noSurvivors, hasActionItems 
  } = guideInfo;

  // ------------------------------------------------------------------
  // ?뮕 ?ъ슜?먭? [X]瑜??뚮윭 ?④릿 沅뚭퀬 媛?대뱶瑜?湲곗뼲?섎뒗 硫붾え由?  const [hiddenGuideKeys, setHiddenGuideKeys] = useState(new Set());
  const dismissGuide = (key) => setHiddenGuideKeys(prev => new Set(prev).add(key));

  // ?뮕 ?ъ씠?쒕컮???꾩슱 媛?대뱶 ?곹깭 留?(?붿쭊 怨꾩궛 寃곌낵 湲곕컲)
  const guideStatusMap = useMemo(() => {
    const map = {};
    (smartGuides || []).forEach(g => {
      // ?④릿 沅뚭퀬 媛?대뱶??留듭뿉???쒖쇅 (?꾩씠肄섎룄 吏?뚯쭚)
      if (g.type === 'recommended' && hiddenGuideKeys.has(g.uniqueKey)) return;
      
      // 1. ID 湲곗? 留ㅽ븨
      if (g.id) {
        if (!map[g.id]) map[g.id] = { mandatory: false, recommended: false };
        if (g.type === 'mandatory') map[g.id].mandatory = true;
        if (g.type === 'recommended') map[g.id].recommended = true;
      }
      // 2. ?대쫫 湲곗? 留ㅽ븨 (遺꾩떊 ??泥섎━瑜??꾪빐 ?띿뒪????[?대쫫] 異붿텧)
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

  // ?㎛ ?곸냽 寃쎈줈 諛?釉뚮━???뺣낫 怨꾩궛 (吏遺??⑹궛 濡쒖쭅 ?꾩쟾 媛쒗렪!)
  const getBriefingInfo = useMemo(() => {
    const findPath = (curr, target, currentPath = []) => {
      if (!curr) return null;
      const newPath = [...currentPath, curr];
      // ?뮕 ?듭떖 ?쎌뒪: id肉먮쭔 ?꾨땲??personId濡쒕룄 留ㅼ묶 ?щ?瑜??뺤씤?섏뿬 ??쓽 二쇱씤???뺥솗??李얠뒿?덈떎.
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
    const name = targetNode.name || (isRoot ? '?쇱긽?띿씤' : '(?대쫫?놁쓬)');
    let relationInfo = '';
    
    if (isRoot) {
      relationInfo = '(?쇱긽?띿씤)';
    } else if (lineage.length > 1) {
      const parent = lineage[lineage.length - 2];
      const isChild = targetNode.relation === 'son' || targetNode.relation === 'daughter';
      let parentNames = parent.name || '?쇱긽?띿씤';
      
      if (isChild) {
        const parentIsSp = parent.relation === 'wife' || parent.relation === 'husband' || parent.relation === 'spouse';
        if (lineage.length > 2 && parentIsSp) {
          const grandparent = lineage[lineage.length - 3];
          if (grandparent?.name) parentNames = `${grandparent.name}쨌${parent.name}`;
        } else if (parent.heirs) {
          const spouse = parent.heirs.find(h => h.id !== targetNode.id && ['wife', 'husband', 'spouse'].includes(h.relation) && h.name && h.name.trim() !== '');
          if (spouse) parentNames = `${parent.name}쨌${spouse.name}`;
        }
      }
      relationInfo = `(${parentNames}??${getRelStr(targetNode.relation, tree.deathDate)})`;
    }

    let totalN = 0, totalD = 1;
    const sourceList = [];

    // ?뮕 ?듭떖 ?쎌뒪: '諛쏅뒗 ?щ엺'???꾨땲??'?섎닠二쇰뒗 ?щ엺(dec)'?쇰줈?쒖쓽 吏遺꾩쓣 媛?몄샃?덈떎. 
    // (?대? ?묒そ?먯꽌 諛쏆? 吏遺꾩씠 蹂묓빀?섏뼱 ?덉쑝誘濡??꾨꼍?섍쾶 14/117???섏샃?덈떎!)
    if (calcSteps && Array.isArray(calcSteps) && targetNode) {
      const myStep = calcSteps.find(s => s.dec?.personId === targetNode.personId);
      if (myStep) {
        totalN = myStep.inN;
        totalD = myStep.inD;
        if (myStep.mergeSources && myStep.mergeSources.length > 0) {
          myStep.mergeSources.forEach(src => sourceList.push({ from: src.from, n: src.n, d: src.d }));
        } else {
          sourceList.push({ from: myStep.parentDecName || '?쇱긽?띿씤', n: myStep.inN, d: myStep.inD });
        }
      } else {
        // ?앹〈?먮씪???섎닠以 ?ㅽ뀦???녿떎硫? 理쒖쥌 寃곌낵?쒖뿉??蹂몄씤 吏遺꾩쓣 李얠쓬
        const myFinalShare = finalShares.direct.find(f => f.personId === targetNode.personId) || 
                             finalShares.subGroups.flatMap(g => g.shares).find(f => f.personId === targetNode.personId);
        if (myFinalShare) {
          totalN = myFinalShare.n;
          totalD = myFinalShare.d;
        }
      }
    }

    const shareStr = isRoot ? '1遺꾩쓽 1' : (totalN > 0 ? `${totalD}遺꾩쓽 ${totalN}` : '0');
    return { name, relationInfo, shareStr, sources: sourceList, isRoot };
  }, [tree, activeDeceasedTab, calcSteps, finalShares]);

  // ??蹂寃????먮룞 ?ㅽ겕濡?(?쒖꽦 ??씠 ?붾㈃ 以묒븰???ㅻ룄濡?
  useEffect(() => {
    const activeEl = tabRefs.current[activeDeceasedTab];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeDeceasedTab]);

  // ??紐⑸줉??蹂寃쎈릺硫??꾩옱 ??씠 ?덈뒗吏 ?뺤씤
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

  // ?몃뱶瑜?ID濡?李얜뒗 ?쒖슜 ?⑥닔
  const findNodeById = (node, id) => {
    if (node.id === id) return node;
    for (const h of (node.heirs || [])) {
      const found = findNodeById(h, id);
      if (found) return found;
    }
    return null;
  };

  // 吏꾪뻾 以묒씤 ?쒖꽦 ??媛앹껜 李몄“ (遺紐? ?덈꺼 ?뺣낫 ?ы븿)
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
    // 1. ?낅젰 ??뿉?쒕뒗 ?몄뇙 遺덇? 泥섎━
    if (activeTab === 'input') {
      alert('蹂닿퀬????媛怨꾨룄, 怨꾩궛?? 怨꾩궛寃곌낵, ?붿빟?? 以??섎굹瑜??좏깮?????몄뇙?댁＜?몄슂.');
      return;
    }

    // 2. ?꾩옱 ?대젮?덈뒗 ??쓽 ?곷Ц ID瑜??쒓? ?대쫫?쇰줈 蹂??    const tabNames = {
      tree: '媛怨꾨룄',
      calc: '怨꾩궛??,
      result: '怨꾩궛寃곌낵',
      summary: '?붿빟??
    };
    const currentTabName = tabNames[activeTab] || '蹂닿퀬??;

    // 3. ?ш굔踰덊샇? ?쇱긽?띿씤 ?대쫫 媛?몄삤湲?(?뱀닔臾몄옄 ?쒓굅?섏뿬 ?덉쟾???뚯씪紐??앹꽦)
    const safeCaseNo = (tree.caseNo || '?ш굔踰덊샇?놁쓬').replace(/[^a-zA-Z0-9媛-??-]/g, '');
    const safeName = (tree.name || '?쇱긽?띿씤?놁쓬').replace(/[^a-zA-Z0-9媛-??-]/g, '');

    // 4. ?ㅻ뒛 ?좎쭨 援ы븯湲?(YYYY-MM-DD ?뺤떇)
    const today = new Date().toISOString().slice(0, 10);

    // 5. 理쒖쥌 ?몄뇙???뚯씪紐?議고빀 (?? 67890_源?곸“_?붿빟??2026-03-31)
    const printFileName = `${safeCaseNo}_${safeName}_${currentTabName}_${today}`;

    // 6. ?먮옒 釉뚮씪?곗? ???대쫫(Title) ?꾩떆 ???    const originalTitle = document.title;

    // 7. 釉뚮씪?곗? ???대쫫???몄뇙???뚯씪紐낆쑝濡?蹂寃?    document.title = printFileName;

    // 8. ?몄뇙(PDF ??? ??붿긽???몄텧! (?대븣 蹂寃쎈맂 title???뚯씪紐낆쑝濡??≫옓?덈떎)
    window.print();

    // 9. ?몄뇙 李쎌씠 ?④퀬 ?섎㈃, ?ㅼ떆 ?먮옒 釉뚮씪?곗? ???대쫫?쇰줈 ?먯긽蹂듦뎄
    document.title = originalTitle;
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCaseNo = (tree.caseNo || '?ш굔踰덊샇?놁쓬').replace(/[^a-zA-Z0-9媛-??-]/g, '');
    const safeName = (tree.name || '?쇱긽?띿씤?놁쓬').replace(/[^a-zA-Z0-9媛-??-]/g, '');
    a.download = `${safeCaseNo}_${safeName}_?곸냽吏遺꾧퀎??${new Date().toISOString().slice(0,10)}.json`;
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
        
        // ?슚 珥덇컯??媛뺤젣 ?숆린??濡쒖쭅: ?뚯씪??瑗ъ씤 ID媛 ??λ릺???덈뜑?쇰룄, ?대쫫??媛숈쑝硫?臾댁“嫄??섎굹濡??듭씪!
        const nameMap = new Map();
        const syncPersonIdRec = (n) => {
          let pId = n.personId;
          
          if (n.name && n.name.trim() !== '') {
            if (nameMap.has(n.name)) {
              // ?대? ?깅줉???대쫫?대㈃, ?뚯씪???곹엺 遺덈웾 ID瑜?臾댁떆?섍퀬 湲곗〈 ID濡?媛뺤젣 ??뼱?곌린!
              pId = nameMap.get(n.name); 
            } else {
              if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`;
              nameMap.set(n.name, pId);
            }
          } else {
            if (!pId) pId = `p_${Math.random().toString(36).substr(2,9)}`;
          }

          // 援щ쾭??no_heir ??renounce 留덉씠洹몃젅?댁뀡 (?좎궗留앹옄 吏遺??щ텇諛?泥섎━)
          let exclusionOption = n.exclusionOption;
          if (n.isExcluded && exclusionOption === 'no_heir' && n.isDeceased) {
            exclusionOption = 'renounce';
          }

          return { ...n, personId: pId, exclusionOption, heirs: (n.heirs || []).map(syncPersonIdRec) };
        };

        // 援щ쾭???몃━) ?뺤떇: id === 'root' ?먮뒗 heirs 諛곗뿴 蹂댁쑀
        if (data.id === 'root' || (Array.isArray(data.heirs) && data.name !== undefined)) {
          setTree(syncPersonIdRec(data));
          setActiveTab('calc');
        } else if (data.people && Array.isArray(data.people)) {
          alert('???뚯씪? ?댁쟾 踰꾩쟾??洹몃옒???뺤떇?낅땲?? ?쇰? ?곗씠?곌? ?꾨씫?????덉뒿?덈떎.');
          const root = data.people.find(p => p.isRoot || p.id === 'root');
          if (root) {
            setTree({ id: 'root', name: root.name || '', gender: root.gender || 'male',
              deathDate: root.deathDate || '', caseNo: data.caseNo || '',
              isHoju: root.isHoju !== false, shareN: data.shareN || 1, shareD: data.shareD || 1,
              heirs: [] });
            setActiveTab('input');
          }
        } else {
          alert('?몄떇?????녿뒗 ?뚯씪 ?뺤떇?낅땲??');
        }
      } catch (err) { alert('?뚯씪???쎈뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExcelExport = () => {
    // CSV ?뺥깭濡?吏遺??붿빟 ?뺣낫瑜??대낫??    const rows = [
      ['?ш굔踰덊샇', tree.caseNo || ''],
      ['?쇱긽?띿씤', tree.name || ''],
      ['?щ쭩?쇱옄', tree.deathDate || ''],
      [''],
      ['?곸냽??, '愿怨?, '吏遺?遺꾩옄)', '吏遺?遺꾨え)', '?듬텇 吏遺?遺꾩옄)', '?듬텇 吏遺?遺꾨え)'],
    ];
    finalShares.direct.forEach(f => {
      rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
    });
    (finalShares.subGroups || []).forEach(g => {
      rows.push(['', `??怨듬룞?곸냽??以?[${g.ancestor?.name || ''}]?(?? ${formatKorDate(g.ancestor?.deathDate)} ?щ쭩?섏??쇰?濡??곸냽??, '', '', '', '']);
      g.shares.forEach(f => {
        rows.push([f.name, getRelStr(f.relation, tree.deathDate) || f.relation, f.n, f.d, f.un, f.ud]);
      });
    });
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tree.name || '?쇱긽?띿씤?놁쓬').replace(/[^a-zA-Z0-9媛-??-]/g, '');
    a.download = `?곸냽吏遺?${safeName}_${new Date().toISOString().slice(0,10)}.csv`;
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
      
      {/* ?㎛ ?ㅻ쭏??媛?대뱶 ?앹뾽李?(?꾩닔/沅뚭퀬 遺꾨━??+ ?섏묠諛??꾩씠肄? */}
      {showNavigator && (
        <div
          ref={stickerRef}
          className={`fixed top-28 right-8 z-[9999] no-print ${isStickerDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ transform: `translate3d(${stickerPos.current.x}px, ${stickerPos.current.y}px, 0)`, transition: 'none', willChange: 'transform', touchAction: 'none' }}
          onMouseDown={handleStickerMouseDown}
        >
          <div className={`relative w-[340px] ${isNavigatorRolledUp ? 'p-3' : 'p-5'} bg-white dark:bg-neutral-800 shadow-[0_12px_40px_rgb(0,0,0,0.15)] border border-[#e9e9e7] dark:border-neutral-700 rounded-xl select-none transition-all duration-200 ${isStickerDragging ? 'scale-[1.02]' : ''}`}>
            
            {/* ?뤇截??ㅻ뜑 ?곸뿭: ??댄?怨?踰꾪듉?ㅼ쓣 ???됱뿉 諛곗튂?섏뿬 ?섏쭅 ?뺣젹 ?쇱튂 */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[#37352f] dark:text-neutral-100">
                <svg className={`w-5 h-5 ${hasActionItems ? 'text-[#2383e2]' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
                <span className="font-black text-[15px]">?ㅻ쭏??媛?대뱶</span>
              </div>

              <div className="flex items-center">
                {/* 濡ㅼ뾽/濡ㅻ떎??踰꾪듉 (?リ린 踰꾪듉怨?20px 媛꾧꺽 ?좎?) */}
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={() => setIsNavigatorRolledUp(!isNavigatorRolledUp)} 
                  className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 transition-colors pointer-events-auto mr-5"
                  title={isNavigatorRolledUp ? "?댁슜 蹂닿린" : "?쒕ぉ留?蹂닿린"}
                >
                  {isNavigatorRolledUp ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  )}
                </button>

                {/* ?リ린(X) 踰꾪듉 */}
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
                  
                  {/* ?슚 理쒖슦???뚮┝: ?앹〈 ?곸냽???꾨㈇ ?곹깭 */}
                  {noSurvivors && (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg mt-2 mb-4">
                      <span className="text-2xl mb-1">?뫅?랅윉⒱랅윉㎮랅윉?/span>
                      <span className="text-[#b45309] dark:text-amber-500 font-black text-[14px]">?앹〈 ?곸냽???놁쓬</span>
                      <span className="text-[#787774] dark:text-neutral-400 text-[11.5px] font-medium leading-relaxed px-4">
                        ?꾩옱 紐⑤뱺 ?곸냽?몄씠 '?щ쭩' ?먮뒗 '?쒖쇅' ?곹깭?낅땲??<br/>
                        ?ㅼ젣 ?곸냽??諛쏆쓣 ?앹〈?먮? ?낅젰?섍굅??<br/>
                        李⑥닚???곸냽?몄쓣 異붽???二쇱꽭??
                      </span>
                    </div>
                  )}

                  {/* ?꾨꼍 ?곹깭 (?앹〈?먭? 1紐낆씠?쇰룄 ?덇퀬 ?먮윭媛 ?놁쓣 ?뚮쭔 ?몄텧) */}
                  {!hasActionItems && !noSurvivors && (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-lg border border-[#e9e9e7] dark:border-neutral-700/50 mt-2">
                      <span className="text-2xl mb-1">??/span>
                      <span className="text-[#37352f] dark:text-neutral-300 font-black text-[13px]">?꾨꼍?⑸땲??</span>
                      <span className="text-[#787774] dark:text-neutral-500 text-[11.5px] font-medium leading-snug">
                        ?꾩옱 ?④퀎?먯꽌 媛?대뱶媛 異붿쿇??br/>異붽? ?낅젰/?섏젙 ??ぉ???놁뒿?덈떎.
                      </span>
                    </div>
                  )}

                  {/* ?슚 ?섎뱶 ?붿쭊 寃쎄퀬 */}
                  {activeTab === 'input' && warnings.map((w, i) => (
                    <div key={`w-${i}`} className="flex items-start gap-2 text-red-600 p-2.5 bg-red-50/50 rounded-lg border border-red-100 mt-2">
                      <span className="mt-0.5">?좑툘</span><span className="flex-1 leading-snug">{w}</span>
                    </div>
                  ))}

                  {/* ?몛 1. ?꾩닔 ?ы빆 (Mandatory) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').map((g, i) => (
                    <button 
                      key={`m-${i}`} 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleNavigate(g.id)}
                      className="w-full mt-2 text-left flex items-start gap-2 bg-blue-50/60 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200/60 dark:border-blue-800/30 hover:bg-blue-100/80 transition-all group pointer-events-auto shadow-sm"
                    >
                      <span className="mt-0.5 text-blue-600 group-hover:scale-125 transition-transform">?몛</span>
                      <span className="flex-1 leading-snug text-[#37352f] dark:text-neutral-200 font-bold">{g.text}</span>
                    </button>
                  ))}

                  {/* ?귨툘 ?먯꽑 援щ텇??(?꾩닔? 沅뚭퀬媛 ?????덉쓣 ?뚮쭔 ?몄텧) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'mandatory').length > 0 && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (
                    <div className="w-full border-t border-dashed border-[#d4d4d4] dark:border-neutral-600 my-4"></div>
                  )}

                  {/* ?뮕 2. 沅뚭퀬 ?ы빆 ?ㅻ뜑 諛?紐⑸줉 (Recommended) */}
                  {activeTab === 'input' && smartGuides.filter(g => g.type === 'recommended' && !hiddenGuideKeys.has(g.uniqueKey)).length > 0 && (
                    <>
                      <div className={`mt-2 mb-1.5 ${smartGuides.filter(m => m.type === 'mandatory').length === 0 ? 'mt-3' : ''}`}>
                        <span className="text-[11px] font-bold text-[#a3a3a3] dark:text-neutral-500 tracking-tight px-1">[?ㅼ쓬? 沅뚭퀬?ы빆?낅땲??</span>
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
                            <span className="mt-0.5 text-[#a3a3a3] group-hover:text-amber-500 transition-colors">?뮕</span>
                            <span className="flex-1 leading-snug text-[#787774] dark:text-neutral-400 font-medium text-[12.5px] pr-6">{g.text}</span>
                          </button>
                          
                          {/* ?뮕 沅뚭퀬??媛?대뱶?먮쭔 ?ъ븘二쇰뒗 留덈쾿???リ린(X) 踰꾪듉! */}
                          <button 
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); dismissGuide(g.uniqueKey); }} 
                            className="absolute top-2.5 right-2 p-1 text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full transition-all opacity-0 group-hover:opacity-100"
                            title="??沅뚭퀬 臾댁떆?섍린 (?ъ씠?쒕컮?먯꽌??吏?뚯쭛?덈떎)"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* ?슚 吏遺?遺덉씪移??곸꽭 ?덈궡 (?곗씠???낅젰 ???ы븿 紐⑤뱺 怨녹뿉???몄텧!) */}
                  {showGlobalWarning && (
                    <div className="mt-3 space-y-3">
                      <div className="text-[#e53e3e] dark:text-red-400 font-black text-[14px]">?꾩껜 吏遺??⑷퀎媛 ?쇱튂?섏? ?딆뒿?덈떎.</div>
                      
                      {/* ?뮕 ?붿빟?쒖? ?숈씪???곸꽭 硫붿떆吏 異쒕젰 */}
                      {globalMismatchReasons.length > 0 ? (
                        <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">
                          {globalMismatchReasons.map((r, idx) => (
                            <button
                              key={idx}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => r.id ? handleNavigate(r.id) : null}
                              className="w-full text-left flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all group pointer-events-auto shadow-sm"
                            >
                              <span className="mt-0.5 text-red-600 dark:text-red-400 group-hover:scale-125 transition-transform">?슚</span>
                              {/* ?뮕 ?듭떖: r.text 濡?媛앹껜 ?덉쓽 湲?⑤쭔 ??鍮쇱꽌 ?뚮뜑留? */}
                              <span className="flex-1 leading-snug text-[#c93f3a] dark:text-red-400 font-bold text-[12.5px]">{r.text || r}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md">
                          <span className="text-[12.5px] text-[#787774] dark:text-neutral-400 font-bold">吏遺??쇰?媛 ?곸냽沅??놁쓬 泥섎━?섏뼱 ?꾩껜 ?⑷퀎媛 誘몃떖?⑸땲??</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* ?먮룞遺꾨같 ?댁뿭 (紐⑤뱺 ???몄텧) */}
                  {showAutoCalcNotice && (
                    <div className="mt-3 p-3 bg-[#f9f9f8] dark:bg-neutral-900 border border-[#e9e9e7] dark:border-neutral-700 rounded-md">
                      <span className="text-[#37352f] dark:text-neutral-100 font-black block mb-2 border-b border-[#e9e9e7] dark:border-neutral-700 pb-1.5 text-[13px]">?먮룞遺꾨같 ?댁뿭:</span>
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

      {/* ?뮕 ?ъ씠???⑤꼸 - ??뿉 ?곴??놁씠 ??긽 怨좎젙 ?쒖떆 */}
      {sidebarOpen && (
        <div
          className="fixed left-0 top-[54px] bottom-0 flex flex-col bg-white dark:bg-neutral-900 border-r border-[#e9e9e7] dark:border-neutral-700 z-[40] no-print transition-colors select-none"
          style={{ width: sidebarWidth }}
        >
          {/* ?ъ씠?쒕컮 ?ㅻ뜑: ??댄? + ?좉? / ?덈궡 肄쒖븘??*/}
          <div className="flex flex-col border-b border-[#f1f1ef] dark:border-neutral-700 shrink-0 transition-colors select-none">
            {/* 1?? ??댄? 諛?紐⑤몢?쇱묠 踰꾪듉 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center text-[12px] font-black text-[#37352f] dark:text-neutral-200 uppercase tracking-widest opacity-60">
                <IconNetwork className="w-3.5 h-3.5 shrink-0 mr-2"/> 媛怨꾨룄 ?붿빟
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#787774] dark:text-neutral-500">紐⑤몢?쇱묠</span>
                <button 
                  onClick={() => setSidebarToggleSignal(prev => prev > 0 ? -Math.abs(prev)-1 : Math.abs(prev)+1)}
                  className={`relative inline-flex h-4 w-7 items-center shrink-0 cursor-pointer rounded-full transition-all duration-200 ease-in-out focus:outline-none ${sidebarToggleSignal > 0 ? 'bg-[#15803d] opacity-80' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                  title={sidebarToggleSignal > 0 ? '紐⑤몢 ?묎린' : '紐⑤몢 ?쇱튂湲?}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${sidebarToggleSignal > 0 ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* ?뮕 ?덈줈 異붽???2?? ?ъ씠?쒕컮 寃?됱갹 */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1.5 bg-[#f0f9ff] dark:bg-blue-900/20 border border-[#bae6fd] dark:border-blue-800/50 rounded-lg px-2 py-1.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-200">
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input
                  type="text"
                  placeholder="?곸냽??李얘린..."
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
            
            {/* 3?? ?몄뀡 ?ㅽ????몃씪???덈궡 肄쒖븘??*/}
            <div className="px-3 pb-3">
              <div className="bg-[#f7f7f5] dark:bg-neutral-800/40 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-md p-2 flex items-start gap-2">
                <span className="text-[12px] opacity-80 shrink-0 leading-none mt-0.5">?뮕</span>
                <p className="text-[10.5px] leading-[1.5] font-medium text-[#787774] dark:text-neutral-400">
                  ?대쫫???대┃?섎㈃ ?대떦 ?곸냽???낅젰 ?붾㈃?쇰줈 ?대룞?⑸땲??
                </p>
              </div>
            </div>
          </div>
          {/* ?몃━ ?댁슜: ?ㅼ젣 ?붿빟 由ъ뒪?몃쭔 ?ㅽ겕濡ㅻ릺?꾨줉 遺꾨━ */}
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

                  // 1. 吏곸젒 留ㅼ묶 ?뺤씤 (ID ?먮뒗 ?대쫫)
                  let matchedTab = deceasedTabs.find(t => t.id === id);
                  if (!matchedTab && targetNode.name) {
                    matchedTab = deceasedTabs.find(t => t.name === targetNode.name);
                  }

                  if (matchedTab) {
                    setActiveDeceasedTab(matchedTab.id);
                    setActiveTab('input');
                    return;
                  }

                  // 2. 議곗긽??嫄곗뒳???щ씪媛硫????뚯쑀??李얘린
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
                    // 媛??媛源뚯슫(理쒗븯?? 議곗긽遺???먯깋
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
          {/* ?쒕옒洹?由ъ궗?댁쫰 ?몃뱾 */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#2383e2]/60 dark:hover:bg-blue-500/60 active:bg-[#2383e2] transition-colors"
            title="?쒕옒洹명븯????議곗젅"
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

      {/* ?뼥截??몄뇙 ?꾩슜 蹂닿퀬???곸뿭 - 210mm ?꾩껜 ??+ ?대? 15mm ?⑤뵫?쇰줈 吏곸젒 ?щ갚 愿由?*/}
      <div className="hidden print:block w-[210mm] max-w-[210mm] bg-white text-black min-h-screen relative z-0">
        <div className="p-[15mm] space-y-10 w-full">
          {activeTab === 'tree' && (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-5 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconNetwork className="w-5 h-5"/> ?곸냽 媛怨꾨룄
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
                  const type = (h.deathDate && isBefore(h.deathDate, parentDeathDate)) ? '??듭긽?? : '?ъ긽??;
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
                const type = (h.deathDate && isBefore(h.deathDate, tree.deathDate)) ? '??듭긽?? : '?ъ긽??;
                const child = pBuildGroups(h, h.deathDate || tree.deathDate);
                if (child.directShares.length > 0 || child.subGroups.length > 0) {
                  pTopGroups.push({ ancestor: h, type, ...child });
                }
              }
            });

            const pRenderShareRow = (f, depth, key) => (
              <tr key={key} className="text-black">
                <td className="border border-black py-1.5 px-3 text-[10pt]" style={{paddingLeft: `${12 + depth * 16}px`}}>??{f.name}</td>
                <td className="border border-black py-1.5 px-3 text-center text-[10pt]">{f.n} / {f.d}</td>
                <td className="border border-black py-1.5 px-3 text-center font-bold text-[10pt]">{f.un} / {f.ud}</td>
              </tr>
            );

            const pRenderGroup = (group, depth, parentName, keyPrefix) => (
              <React.Fragment key={keyPrefix}>
                <tr className="bg-gray-50">
                  <td colSpan="3" className="border border-black py-1.5 text-[9pt] text-gray-700 italic" style={{paddingLeft: `${8 + depth * 16}px`}}>
                    {depth > 0 && '??'}
                    {parentName ? `??[${parentName}]???곸냽??以?[${group.ancestor.name}]?(??` : `??怨듬룞?곸냽??以?[${group.ancestor.name}]?(??`}
                    {' '}{formatKorDate(group.ancestor.deathDate)} ?щ쭩 ??{group.type} 諛쒖깮, ?곸냽??                  </td>
                </tr>
                {group.directShares.map((f, i) => pRenderShareRow(f, depth + 1, `${keyPrefix}-d${i}`))}
                {group.subGroups.map((sg, i) => pRenderGroup(sg, depth + 1, group.ancestor.name, `${keyPrefix}-sg${i}`))}
              </React.Fragment>
            );

            return (
            <section className="w-full">
              <h2 className="text-[16pt] font-bold mb-2 border-l-4 border-black pl-3 flex items-center gap-2">
                <IconList className="w-5 h-5"/> 理쒖쥌 ?곸냽 吏遺??붿빟
              </h2>
              <p className="text-[10pt] text-gray-700 mb-3 pl-1">
                ?쇱긽?띿씤: <strong>{tree.name || '誘몄엯??}</strong>
                &nbsp;|&nbsp;?щ쭩?쇱옄: <strong>{tree.deathDate || '誘몄엯??}</strong>
                &nbsp;|&nbsp;?곸냽吏遺? <strong>{tree.shareN || 1} / {tree.shareD || 1}</strong>
                &nbsp;|&nbsp;?곸슜踰뺣졊: <strong>{getLawEra(tree.deathDate)}??誘쇰쾿</strong>
              </p>
              <table className="w-full border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 text-black">
                    <th className="border border-black py-2 px-3 text-[11pt] w-[25%] font-bold">?곸냽???깅챸</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[35%] font-bold">理쒖쥌 吏遺?(湲곕낯)</th>
                    <th className="border border-black py-2 px-3 text-[11pt] w-[40%] font-bold">理쒖쥌 吏遺?(?듬텇)</th>
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
                <IconTable className="w-5 h-5"/> ?곸꽭 怨꾩궛 洹쇨굅
              </h2>
              <div className="space-y-4">
                {calcSteps.map((s, i) => (
                  <div key={'p-s'+i} className="border border-gray-300 p-4 rounded">
                    <div className="font-bold text-[11pt] mb-2 text-gray-800">
                      ?쇱긽?띿씤 {s.dec.name} ({s.dec.deathDate} ?щ쭩) ? ?쇱긽?띿?遺? {s.inN}/{s.inD}
                      {s.mergeSources && s.mergeSources.length > 1 && (
                        <span className="ml-2 text-[10pt] font-bold text-teal-700">
                          (= {s.mergeSources.map((src, si) => (
                            <React.Fragment key={si}>
                              {si > 0 && ' + '}
                              {src.from} {src.d}遺꾩쓽 {src.n}
                            </React.Fragment>
                          ))})
                        </span>
                      )}
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-[10pt]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-400">
                          <th className="py-1 px-2 text-left w-[20%]">?곸냽??/th>
                          <th className="py-1 px-2 text-center w-[40%]">?곗텧 吏遺?怨꾩궛??/th>
                          <th className="py-1 px-2 text-left w-[40%]">鍮꾧퀬</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.dists.map((d, di) => (
                          <tr key={di} className="border-b border-gray-200">
                            <td className="py-1 px-2 font-bold">{d.h.name}</td>
                            <td className="py-1 px-2 text-center">{s.inN}/{s.inD} 횞 {d.sn}/{d.sd} = <strong>{d.n}/{d.d}</strong></td>
                            <td className="py-1 px-2 text-[9pt]">{d.mod ? ('??' + d.mod) : ''}</td>
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
                  const key = d.h.id; // ?뵎 ?대쫫 ???怨좎쑀 ID 湲곗??쇰줈 吏묎퀎
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
                  <IconCalculator className="w-5 h-5"/> ?곸냽?몃퀎 ?곸냽吏遺?怨꾩궛 寃곌낵??                </h2>
                <table className="w-full border-collapse border border-black text-[10pt] table-fixed">
                  <thead>
                    <tr className="bg-gray-100 font-bold border-b border-black">
                      <th className="border border-black py-1.5 px-2 w-[15%] text-center">?곸냽??/th>
                      <th className="border border-black py-1.5 px-2 w-[60%] text-center">?곸냽吏遺?援ъ꽦 諛?怨꾩궛 ?댁뿭</th>
                      <th className="border border-black py-1.5 px-2 w-[25%] text-center font-bold">理쒖쥌 ?곸냽 吏遺?/th>
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
                  ????吏遺꾩? 媛??쇱긽?띿씤?쇰줈遺???밴퀎諛쏆? 吏遺꾩쓽 ?⑷퀎?낅땲??
                </div>
              </section>
            );
          })()}

          <div className="mt-12 text-[10pt] text-gray-400 text-center italic border-t pt-4">
            蹂?蹂닿퀬?쒕뒗 ?곸냽吏遺?怨꾩궛湲?PRO (Designed by J.H. Lee)瑜??듯빐 踰뺣졊??湲곗큹?섏뿬 ?먮룞 ?앹꽦?섏뿀?듬땲??
          </div>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center no-print">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2 text-[#37352f]">???묒뾽 ?쒖옉</h2>
            <p className="text-[14px] text-[#787774] mb-6">?꾩옱 ?묒꽦 以묒씤 紐⑤뱺 ?곗씠?곌? ??젣?⑸땲??<br/>?대뼸寃?泥섎━?좉퉴??</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => performReset(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">諛깆뾽 ?????珥덇린??/button>
              <button onClick={() => performReset(false)} className="w-full py-2.5 bg-[#ffe2dd] hover:bg-[#ffc1b8] text-[#d44c47] font-medium rounded transition-colors text-[14px]">????놁씠 洹몃깷 珥덇린??/button>
              <button onClick={() => setIsResetModalOpen(false)} className="w-full py-2.5 mt-2 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">痍⑥냼</button>
            </div>
          </div>
        </div>
      )}

      {syncRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center no-print text-[#37352f]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[#e9e9e7]">
            <h2 className="text-xl font-bold mb-2">?숈씪 ?몃Ъ ?뺣낫 ?숆린??/h2>
            <p className="text-[14px] text-[#787774] mb-6">
              <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>?섏쓽 ?뺣낫瑜?蹂寃쏀븯?⑥뒿?덈떎.<br/>
              媛怨꾨룄 ?댁쓽 ?ㅻⅨ <span className="font-bold text-[#0b6e99]">{syncRequest.name}</span>?섏쓽 ?숈씪 ?뺣낫??媛숈씠 ?섏젙?좉퉴??
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSyncConfirm(true)} className="w-full py-2.5 bg-[#2383e2] hover:bg-[#0073ea] text-white font-medium rounded transition-colors text-[14px]">?? 紐⑤몢 ?숆린?뷀빀?덈떎</button>
              <button onClick={() => handleSyncConfirm(false)} className="w-full py-2.5 bg-white border border-[#d4d4d4] hover:bg-[#efefed] text-[#37352f] font-medium rounded transition-colors text-[14px]">?꾨땲?? ?꾩옱 ?몃Ъ留??섏젙?⑸땲??/button>
            </div>
          </div>
        </div>
      )}

      {/* ?쩃 ?숈씪???뺤씤 紐⑤떖 */}
      {duplicateRequest && (() => {
        // "??(?숇챸?댁씤)" ??isDifferent=true ??isSame=false ???묐???遺??        // "?꾨땲??(?숈씪??" ??isDifferent=false ??isSame=true ??ID ?곕룞 or 李⑤떒
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
              
              <h2 className="text-[20px] font-black mb-3">?숈씪???щ? ?뺤씤</h2>
              
              <p className="text-[15px] leading-relaxed mb-8 text-[#504f4c]">
                <span className="font-bold text-[#2383e2]">'{duplicateRequest.name}'</span>?섏씠 ??踰??낅젰?섏뿀?듬땲??<br/>
                ????遺꾩? <span className="font-black text-rose-500">?쒕줈 ?ㅻⅨ ?몃Ъ(?숇챸?댁씤)</span>?멸???
              </p>

              {/* ?렓 ?뚯뒪???щ씪?대뱶 ?좉? */}
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
                  ??(?숇챸?댁씤)
                </button>
                <button 
                  onClick={(e) => {
                    const slider = e.currentTarget.parentElement.querySelector('#toggle-slider');
                    slider.style.transform = 'translateX(100%)';
                    setTimeout(() => handleToggleConfirm(false), 300);
                  }}
                  className="relative flex-1 text-center text-[15px] font-black z-10 text-[#787774] transition-colors"
                >
                  ?꾨땲??(?숈씪??
                </button>
              </div>

              <button 
                onClick={duplicateRequest.onCancel}
                className="text-[13px] font-bold text-[#a1a1aa] hover:text-[#787774] underline underline-offset-4 transition-colors p-2"
              >
                痍⑥냼 ??吏곸젒 ?섏젙?섍린
              </button>
            </div>
          </div>
        );
      })()}

      {/* ?뮕 ?ㅻ뜑 (由щ낯 硫붾돱) - ?붾㈃ ?쇱そ ???덈? 怨좎젙 (?ъ씠?쒕컮 ?곕룞 ?놁쓬) */}
      <div 
        className="bg-white dark:bg-neutral-800 border-b border-[#e9e9e7] dark:border-neutral-700 h-[54px] sticky top-0 z-50 no-print w-full flex justify-start transition-all duration-300 shadow-sm overflow-hidden"
      >
        <div className="w-[1080px] min-w-[1080px] shrink-0 px-6 flex items-center justify-between h-full flex-nowrap">
          <div className="flex items-center gap-3 flex-nowrap shrink-0">
            {/* ?ъ씠?쒕컮 ?좉? 踰꾪듉 */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className={`w-7 h-7 flex flex-col justify-center items-center rounded-md gap-1 transition-all no-print ${
                sidebarOpen 
                  ? 'bg-[#f0f0ee] dark:bg-neutral-700 text-[#2383e2] dark:text-blue-400' 
                  : 'text-[#787774] dark:text-neutral-400 hover:bg-[#efefed] dark:hover:bg-neutral-700'
              }`}
              title={sidebarOpen ? '媛怨꾨룄 ?⑤꼸 ?リ린' : '媛怨꾨룄 ?⑤꼸 ?닿린'}
            >
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
              <span className="w-3.5 h-0.5 bg-current rounded-full transition-all" />
            </button>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0 overflow-visible">
              <div className="flex items-center text-[#37352f] dark:text-neutral-100 font-bold text-[18px] tracking-tight whitespace-nowrap shrink-0">
                <IconCalculator className="w-5 h-5 mr-1.5 text-[#787774] dark:text-neutral-400 shrink-0" />
                ?곸냽吏遺?怨꾩궛湲?PRO <span className="ml-1.5 text-[11px] font-medium bg-[#e9e9e7] dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[#787774] dark:text-neutral-400 shrink-0">v2.0.8</span>
              </div>
              <span className="designer-sign text-[#a3a3a3] dark:text-neutral-500 text-[14px] ml-8 whitespace-nowrap shrink-0">Designed by J.H. Lee</span>
            </div>
          </div>
          {/* ?ㅽ겕紐⑤뱶 踰꾪듉???대룞???먮━ - 湲곗〈 spacing ?좎?瑜??꾪븳 placeholder */}
          <div className="w-9 shrink-0" />
          
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#f7f7f5] dark:bg-neutral-700 px-2.5 py-1 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-2 transition-colors">
              <div className="min-w-[120px] flex items-center gap-1 overflow-hidden">
                <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">?ш굔:</span>
                <span className="text-[11px] font-bold text-[#37352f] dark:text-neutral-200 truncate">{tree.caseNo || '誘몄엯??}</span>
              </div>
              <div className="w-px h-2.5 bg-[#d4d4d4] dark:bg-neutral-600 mx-0.5"></div>
              <div className="min-w-[140px] flex items-center gap-1 overflow-hidden">
                <span className="text-[11px] font-bold text-[#787774] dark:text-neutral-400 whitespace-nowrap">?쇱긽?띿씤:</span>
                <span className="text-[13px] font-black text-[#0b6e99] dark:text-blue-400 truncate">{tree.name || '誘몄엯??}</span>
              </div>
            </div>

            {/* ?㎛ ?ㅻ쭏??媛?대뱶 ?몄텧 踰꾪듉 (醫뚯슦 10px ?щ갚 ?뺣낫) */}
            <button 
              onClick={() => setShowNavigator(true)} 
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm border shrink-0 mx-[10px] ${
                hasActionItems 
                  ? 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/60 dark:text-blue-400 dark:border-blue-800' 
                  : 'bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f7f5] hover:text-[#37352f] dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700'
              }`}
              title={hasActionItems ? "?덈줈???ㅻ쭏??媛?대뱶媛 ?덉뒿?덈떎!" : "?ㅻ쭏??媛?대뱶 ?닿린"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActionItems ? 2.5 : 2}>
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </button>

            <button onClick={undoTree} disabled={treeState.currentIndex <= 0} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconUndo className="w-3.5 h-3.5" /> ?댁쟾
            </button>
            <button onClick={redoTree} disabled={treeState.currentIndex >= treeState.history.length - 1} className="disabled:opacity-40 disabled:cursor-not-allowed text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconRedo className="w-3.5 h-3.5" /> ?ъ떎??            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] dark:bg-neutral-600 mx-0.5"></div>

            <button onClick={() => setIsResetModalOpen(true)} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconReset className="h-3.5 w-3.5" /> 珥덇린??            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] mx-0.5"></div>
            <label className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1 cursor-pointer">
              <IconFolderOpen className="h-3.5 w-3.5" /> 遺덈윭?ㅺ린<input type="file" accept=".json" onChange={loadFile} className="hidden" />
            </label>
            <button onClick={saveFile} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconSave className="h-3.5 w-3.5" /> ???            </button>
            <button onClick={handleExcelExport} className="text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] px-2 py-1 rounded border border-transparent hover:border-[#d4d4d4] text-[12px] font-bold transition-colors flex items-center gap-1">
              <IconTable className="h-3.5 w-3.5" /> ?묒?
            </button>
            <div className="w-px h-3.5 bg-[#e9e9e7] mx-0.5"></div>

            <button onClick={handlePrint} className="text-white bg-[#2383e2] hover:bg-[#0073ea] px-3 py-1 rounded text-[12px] font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap mr-1">
              <IconPrinter className="h-3.5 w-3.5" /> ?몄뇙
            </button>

            {/* ?뮕 ?뺣?/異뺤냼 而⑦듃濡ㅻ윭 (?몄뇙 ?곗륫, ?ㅽ겕紐⑤뱶 醫뚯륫?쇰줈 ?대룞) */}
            <div className="flex items-center gap-1 bg-[#f7f7f5] dark:bg-neutral-700 px-1.5 py-0.5 rounded border border-[#e9e9e7] dark:border-neutral-600 mr-1 transition-colors">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
                className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]"
                title="異뺤냼"
              >-</button>
              <span className="text-[10px] font-black w-8 text-center text-[#504f4c] dark:text-neutral-300">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                className="w-5 h-5 flex items-center justify-center text-[#787774] hover:text-[#37352f] dark:text-neutral-400 dark:hover:text-neutral-200 font-bold text-[14px]"
                title="?뺣?"
              >+</button>
            </div>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-7 h-7 flex justify-center items-center rounded-full text-[#787774] hover:bg-[#efefed] dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors mr-2 focus:outline-none" title={isDarkMode ? '?쇱씠??紐⑤뱶' : '?ㅽ겕 紐⑤뱶'}>
              {isDarkMode ? <IconSun className="w-4 h-4 text-amber-300" /> : <IconMoon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <main 
        className={`flex-1 flex w-full transition-all duration-300 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
        style={{ paddingLeft: sidebarOpen ? (sidebarWidth + 50) : 0 }}
      >
        {/* ?뮕 ?듭떖: 硫붿씤 肄섑뀗痢???+ ?낅젰李?留??뺣?/異뺤냼?섎뒗 以??붿쭊 ?곸슜 */}
        <div style={{ zoom: zoomLevel, width: '100%', display: 'flex', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
          <div className="flex flex-col w-[1080px] min-w-[1080px] shrink-0 px-6 mt-6 print-compact print:!px-0 print:!min-w-0 print:!w-full relative z-10">
            {/* ?곷떒 ??(?ㅻ퉬寃뚯씠?? - ?쒕ぉ怨??뺣젹 ?숆린??*/}
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
            // ?뮕 ?듭떖 ?쎌뒪: 媛怨꾨룄瑜??ㅼ떆 ?ㅼ쭏 ?꾩슂 ?놁씠, ??뿉 ?대? ??ν빐??'吏꾩쭨 ?몃Ъ(node)'??諛붾줈 爰쇰궡 ?곷땲??
            const currentNode = activeTabObj ? activeTabObj.node : tree; 
            const nodeHeirs = currentNode ? (currentNode.heirs || []) : [];
            const isRootNode = currentNode && currentNode.id === 'root';
            
            const siblings = activeTabObj ? activeTabObj.parentNode?.heirs : null;
            const isSp = currentNode?.relation === 'wife' || currentNode?.relation === 'husband';
            const isChild = currentNode?.relation === 'son' || currentNode?.relation === 'daughter';

            const canAutoFillSp = !isRootNode && isSp;
            const canAutoFillChild = !isRootNode && isChild;

            const handleAutoFill = () => {
              // ?뮕 1?④퀎: 蹂듭젣???먮낯 ?곗씠??baseAdd)瑜?癒쇱? 留뚮벊?덈떎
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
                if (children.length > 0 && newItems.length === 0) { alert('???댁긽 遺덈윭???숈씪???곸냽?몄씠 ?놁뒿?덈떎. (紐⑤몢 ?깅줉??'); return; }
                baseAdd = newItems.length > 0 ? newItems.map(cloneBase) : [{ personId: `p_${Date.now()}`, name: '', relation: 'son', isDeceased: false, isSameRegister: true, heirs: [] }];
              } else if (canAutoFillChild) {
                const siblingList = siblings ? siblings.filter(s => s.id !== currentNode.id && (s.relation === 'son' || s.relation === 'daughter')) : [];
                let newItems = siblingList.filter(s => s.name.trim() === '' || !existingNames.has(s.name));
                if (siblingList.length > 0 && newItems.length === 0) { alert('???댁긽 遺덈윭???숈씪???곸냽?몄씠 ?놁뒿?덈떎. (紐⑤몢 ?깅줉??'); return; }
                baseAdd = newItems.length > 0 ? newItems.map(item => ({ ...cloneBase(item), relation: 'sibling' })) : [{ personId: `p_${Date.now()}`, name: '', relation: 'sibling', isDeceased: false, isSameRegister: true, heirs: [] }];
              }

              // ?뮕 2?④퀎: 媛怨꾨룄瑜??낆깄???ㅼ졇??'?ㅼ쥌????紐⑤뱺 遺꾩떊(Clone)?ㅼ뿉寃?鍮좎쭚?놁씠 ?먮??ㅼ쓣 苑귥븘?ｌ뒿?덈떎!
              setTree(prev => {
                const syncHeirs = (n) => {
                  if (n.id === currentNode.id || (currentNode.personId && n.personId === currentNode.personId)) {
                    // 媛?遺꾩떊留덈떎 ?붾㈃ 異⑸룎??留됯린 ?꾪빐 怨좎쑀 id瑜??덈줈 諛쒓툒
                    const finalAdd = baseAdd.map(item => {
                       const assignNewIds = (node) => ({ ...node, id: `n_${Math.random().toString(36).substr(2,9)}`, heirs: node.heirs?.map(assignNewIds) || [] });
                       return assignNewIds(item);
                    });
                    // ?ㅼ쐞移섎룄 ?먮룞?쇰줈 耳쒖쨲
                    return { ...n, isExcluded: false, exclusionOption: '', heirs: [...(n.heirs || []), ...finalAdd] };
                  }
                  return { ...n, heirs: n.heirs?.map(syncHeirs) || [] };
                };
                return syncHeirs(prev);
              });
            };
            
            return (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col flex-1">
                {/* ?곷떒 湲곕낯?뺣낫 ?뱀뀡 - ?몄뀡 ?ㅽ???誘몃땲硫 媛쒗렪 */}
                <div className="bg-white dark:bg-neutral-800/20 border border-[#e9e9e7] dark:border-neutral-700 rounded-lg px-6 py-3 flex items-center gap-6 transition-colors shadow-sm">
                  <div className="flex items-center gap-2 shrink-0 border-r border-[#f1f1ef] dark:border-neutral-700/50 pr-6 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 uppercase tracking-widest">湲곕낯?뺣낫</span>
                  </div>
                  
                  <div className="flex flex-1 items-center gap-5 overflow-x-auto no-scrollbar">
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">?ш굔踰덊샇</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.caseNo || ''} onChange={e=>handleRootUpdate('caseNo',e.target.value)} className="w-32 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="踰덊샇 ?낅젰" />
                    </div>
                    
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">?깅챸</label>
                      <input type="text" onKeyDown={handleKeyDown} value={tree.name || ''} onChange={e=>handleRootUpdate('name',e.target.value)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-bold text-[#37352f] dark:text-neutral-100 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" placeholder="?대쫫" />
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">?щ쭩?쇱옄</label>
                      <DateInput value={tree.deathDate || ''} onKeyDown={handleKeyDown} onChange={v=>handleRootUpdate('deathDate', v)} className="w-28 border border-[#e9e9e7] dark:border-neutral-700 rounded px-2.5 py-1.5 text-[14px] font-medium text-[#37352f] dark:text-neutral-200 outline-none transition-all bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-800" />
                    </div>

                    {getLawEra(tree.deathDate) !== '1991' && (
                      <div className="shrink-0 flex items-center gap-2">
                        <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">?몄＜</label>
                        <input type="checkbox" disabled={!isRootNode} checked={isRootNode ? tree.isHoju !== false : false} onChange={e=>handleRootUpdate('isHoju', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-neutral-500" />
                      </div>
                    )}

                    <div className="shrink-0 flex items-center gap-2">
                       <label className="text-[12px] text-[#787774] dark:text-neutral-400 font-bold whitespace-nowrap">?곸냽??吏遺?/label>
                       <div className="flex items-center bg-transparent rounded border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 gap-1">
                         <input type="number" min="1" value={tree.shareD || 1} onChange={e=>handleRootUpdate('shareD', Math.max(1, parseInt(e.target.value)||1))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="遺꾨え" />
                         <span className="text-[#787774] dark:text-neutral-500 text-[12px] font-medium mx-0.5">/</span>
                         <input type="number" min="1" max={tree.shareD || 1} value={tree.shareN || 1} onChange={e=>handleRootUpdate('shareN', Math.min(tree.shareD||1, Math.max(1, parseInt(e.target.value)||1)))} className="w-10 bg-transparent text-[14px] text-center font-medium text-[#37352f] outline-none dark:text-neutral-200" title="遺꾩옄" />
                       </div>
                    </div>
                  </div>
                </div>

                {/* ?대뜑-??援ъ“: ?щ쭩???몃Ъ蹂???(Filing Cabinet) */}
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
                              <span className="truncate">理쒖큹 {tab.name}</span>
                              <span className="text-[9px] opacity-70 mt-0.5 font-medium tracking-tighter">諛붾줈媛湲?/span>
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

                  {/* ?뱞 ?대뜑 肄섑뀗痢??곸뿭 */}
                  <div className={`relative transition-all duration-300 flex-1 ${
                    isFolderFocused 
                      ? 'bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700/50 rounded-xl' 
                      : 'bg-transparent'
                  }`}>
                    {/* ?뱚 ?대뜑 ?곷떒 ?≪뀡 諛?- ?섏묠諛섑삎 ?덉씠?꾩썐 ?꾨㈃ 媛쒗렪 */}
                    <div className="flex items-stretch px-6 py-3 border-b border-[#f1f1ef] dark:border-neutral-700/50 bg-[#f8f9fa] dark:bg-neutral-900/40 rounded-t-xl transition-colors min-h-[80px]">
                      <div className="flex items-center gap-5 w-full">
                        
                        {/* 1. 怨꾩듅 寃쎈줈 (?곸쐞 ?곸냽??紐?+ 愿怨? - ?대쫫 湲몄씠???곕씪 ?좊룞?곸쑝濡??섏뼱??*/}
                        <div className="flex items-center shrink-0 pr-4">
                          {activeTabObj && activeTabObj.parentNode && activeDeceasedTab !== 'root' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDeceasedTab(activeTabObj.parentNode.id);
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
                                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 leading-none mb-1 uppercase tracking-tight">?곸쐞 ?④퀎</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-[16px] font-black text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                                    {activeTabObj.parentNode.id === 'root' ? (tree.name || '?쇱긽?띿씤') : activeTabObj.parentNode.name}
                                  </span>
                                  <span className="text-[13px] font-bold text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                                    ??{getRelStr(currentNode.relation, tree.deathDate)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center px-2">
                              <span className="text-[12px] font-bold text-[#787774] dark:text-neutral-400 tracking-tight">理쒖큹 ?곸냽 ?④퀎</span>
                            </div>
                          )}                        </div>
                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 2. ?꾩옱 ?낅젰 ??곸옄 (?깊븿留?媛뺤“) */}
                        <div className="flex flex-col justify-center min-w-[80px] max-w-[140px]">
                          <span className="text-[10px] font-bold text-[#2383e2] dark:text-blue-400 uppercase tracking-tight mb-0.5">
                            {(() => {
                              if (activeDeceasedTab === 'root') return '?쇱긽?띿씤';
                              
                              // 遺紐??몃뱶???щ쭩??媛?몄삤湲?                              const pDeathDate = activeTabObj?.parentNode?.id === 'root' ? tree.deathDate : activeTabObj?.parentNode?.deathDate;
                              
                              // ??듭긽??議곌굔: 寃곌꺽/?곸떎?닿굅?? 遺紐⑤낫??癒쇱? ?щ쭩(?좎궗留???寃쎌슦
                              const isExcludedDaeseup = currentNode?.isExcluded && ['lost', 'disqualified'].includes(currentNode?.exclusionOption);
                              const isPreDeceased = currentNode?.deathDate && pDeathDate && isBefore(currentNode.deathDate, pDeathDate);
                              
                              return (isExcludedDaeseup || isPreDeceased) ? '?쇰??듭긽?띿씤' : '?쇱긽?띿씤';
                            })()}
                          </span>
                          <div className="flex items-center overflow-hidden">
                            <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100 truncate">
                              {getBriefingInfo.name}
                            </span>
                          </div>
                        </div>
                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 3. ?щ쭩?쇱옄 & 踰뺣졊 諭껋? (?뽳툘 ?꾩씠肄?蹂듦뎄, 120px 怨좎젙) */}
                        <div className="flex flex-col justify-center items-center shrink-0">
                          <span className="text-[12px] font-bold text-[#c93f3a] dark:text-red-400 mb-1 leading-none">
                            {(!getBriefingInfo.isRoot && currentNode?.deathDate) ? `${formatKorDate(currentNode.deathDate)} ?щ쭩` : (tree.deathDate ? `${formatKorDate(tree.deathDate)} ?щ쭩` : '?щ쭩?쇱옄 誘몄긽')}
                          </span>
                          <div className="w-[120px] bg-[#fefce8] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-500 border border-[#fef08a] dark:border-yellow-700/50 py-0.5 rounded flex items-center justify-center gap-1 shadow-sm">
                            <span className="text-[9px]">?뽳툘</span>
                            <span className="text-[10px] font-black tracking-tighter whitespace-nowrap">
                              {getLawEra(currentNode?.deathDate || tree.deathDate)}??{getLawEra(currentNode?.deathDate || tree.deathDate) === '1960' ? '?쒖젙' : '媛쒖젙'} 誘쇰쾿
                            </span>
                          </div>
                        </div>

                        <div className="w-px h-8 bg-[#e9e9e7] dark:bg-neutral-700 shrink-0"></div>

                        {/* 4. ?곸냽 吏遺?(?곸꽭 異쒖쿂 ?쒓굅) */}
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">吏遺?/span>
                            <span className="text-[17px] font-black text-[#1e56a0] dark:text-blue-400 leading-none">
                              {getBriefingInfo.shareStr}
                            </span>
                          </div>
                        </div>
                        {/* ?곗륫 ?≪뀡??*/}
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          {!isRootNode && (
                            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border border-[#e9e9e7] dark:border-neutral-700 px-2 py-1 rounded-full shadow-sm">
                              <span 
                                className={`text-[11px] font-bold transition-colors select-none cursor-pointer ${!currentNode.isExcluded ? 'text-[#37352f] dark:text-neutral-200' : 'text-[#787774] dark:text-neutral-500'}`}
                                onClick={() => {
                                  if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) {
                                    alert("?곸냽?몄쓣 癒쇱? ?낅젰?댁＜?몄슂. ?낅젰???꾨즺?섎㈃ ?먮룞?쇰줈 ?ㅼ쐞移섍? 耳쒖쭛?덈떎.");
                                    return;
                                  }
                                  const nextVal = !currentNode.isExcluded;
                                  handleUpdate(currentNode.id, { isExcluded: nextVal, exclusionOption: nextVal ? '' : 'renounce' });
                                }}
                              >
                                {(() => {
                                  if (currentNode.isExcluded) return '?곸냽沅??놁쓬';
                                  // ?뮕 ?щ쭩??鍮꾧탳瑜??듯빐 ????ъ긽???⑹뼱 ?먮룞 ?좏깮
                                  const pDeathDate = activeTabObj?.parentNode?.id === 'root' ? tree.deathDate : activeTabObj?.parentNode?.deathDate;
                                  const isPre = currentNode?.deathDate && pDeathDate && isBefore(currentNode.deathDate, pDeathDate);
                                  const isExcludedDaeseup = currentNode?.isExcluded && ['lost', 'disqualified'].includes(currentNode?.exclusionOption);
                                  
                                  return (isPre || isExcludedDaeseup) ? '??듭긽?? : '?ъ긽??;
                                })()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // ?뮕 ?ㅼ쐞移?踰꾪듉 ?대┃ ?쒖뿉???숈씪??諛⑹뼱 濡쒖쭅 ?곸슜
                                  if (currentNode.isExcluded && (!currentNode.heirs || currentNode.heirs.length === 0)) {
                                    alert("?곸냽?몄쓣 癒쇱? ?낅젰?댁＜?몄슂. ?낅젰???꾨즺?섎㈃ ?먮룞?쇰줈 ?ㅼ쐞移섍? 耳쒖쭛?덈떎.");
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
                          {/* ?뮕 蹂듦뎄??湲곕뒫: ?곸냽??遺덈윭?ㅺ린 (諛곗슦?먮굹 ?먮? ??뿉?쒕쭔 ?쒖꽦?붾맖) */}
                          {(canAutoFillSp || canAutoFillChild) && (
                            <button 
                              type="button"
                              onClick={handleAutoFill}
                              className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"
                              title="?곸쐞 ?④퀎???숈씪???곸냽??紐낅떒??洹몃?濡?媛?몄샃?덈떎"
                            >
                              <IconUserGroup className="w-3.5 h-3.5 text-emerald-600" /> 遺덈윭?ㅺ린
                            </button>
                          )}

                          <button 
                            type="button"
                            onClick={() => {
                              setIsMainQuickActive(!isMainQuickActive);
                              if(!isMainQuickActive) {
                                setIsFolderFocused(true);
                                setTimeout(() => document.querySelector('input[placeholder*="?쒓볼踰덉뿉"]')?.focus(), 100);
                              }
                            }}
                            className="text-[11.5px] text-[#37352f] dark:text-neutral-200 font-bold bg-white dark:bg-neutral-800 hover:bg-[#f7f7f5] dark:hover:bg-neutral-700 px-2.5 py-1.5 rounded transition-colors flex items-center border border-[#e9e9e7] dark:border-neutral-700 gap-1.5 shadow-sm"
                          >
                            <IconUserPlus className="w-3.5 h-3.5 text-[#2383e2]" /> ?곸냽??異붽?
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ?뱞 ?대뜑 ?대? */}
                    <div className="px-10 pb-10 pt-6 bg-white dark:bg-neutral-800 rounded-b-xl border border-t-0 border-[#f1f1ef] dark:border-neutral-700/50">
                      {isMainQuickActive && (
                        <div className="mb-4 p-4 rounded-lg bg-[#fcfcfb] dark:bg-neutral-800/50 border border-[#e9e9e7] dark:border-neutral-700 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">
                                ?곸냽???대쫫???쇳몴(,)濡?援щ텇?섏뿬 ?쒓볼踰덉뿉 ?낅젰?섏꽭??                              </div>
                              <button
                                onClick={() => { setIsMainQuickActive(false); setMainQuickVal(''); }}
                                className="text-[#a3a3a3] dark:text-neutral-500 hover:text-[#37352f] dark:hover:text-neutral-300 p-0.5 rounded transition-colors"
                                title="?リ린"
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
                                placeholder="?? ?띻만?? 源泥좎닔, ?댁쁺??
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
                                ?쇨큵 ?깅줉
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ?뱥 ?묒? ?ㅽ???而щ읆 ?ㅻ뜑 (HeirRow? ?덈퉬 100% ?숆린?? */}
                      {nodeHeirs.length > 0 && (
                        <div className="flex items-center px-2 py-2 mb-2 bg-[#fcfcfb] dark:bg-neutral-800/50 rounded-md border border-[#e9e9e7] dark:border-neutral-700 text-[12px] font-bold text-[#787774] dark:text-neutral-400 select-none animate-in fade-in duration-300 w-full overflow-hidden">
                          <div className="w-[68px] shrink-0 text-center ml-[10px]"><span className="relative left-[15px]">?곹깭</span></div>
                          <div className="w-[72px] shrink-0 text-center ml-[50px]"><span className="relative left-[-20px]">?깅챸</span></div>
                          <div className="w-[96px] shrink-0 text-center ml-[30px]"><span className="relative left-[-30px]">愿怨?/span></div>
                          <div className="w-[150px] shrink-0 text-center ml-[30px]"><span className="relative left-[-40px]">?щ쭩?щ?/?쇱옄</span></div>
                          <div className="w-[180px] shrink-0 text-center ml-[10px] relative">
                            <span className="relative left-[-20px]">?뱀닔議곌굔 (媛媛먯궛)</span>
                          </div>
                          <div className="w-[180px] shrink-0 text-center ml-[10px] relative group/del-all">
                            <span className="whitespace-nowrap relative left-[-35px]">
                              ????듭긽??                              {/* ?뮕 ?꾩껜 ??젣 踰꾪듉 (30px 媛꾧꺽 ?좎?) */}
                              <button
                                type="button"
                                onClick={() => handleUpdate(currentNode.id, 'heirs', [])}
                                className="absolute left-[calc(100%+30px)] top-1/2 -translate-y-1/2 opacity-0 group-hover/del-all:opacity-100 transition-all text-[#a3a3a3] hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="?꾩껜??젣"
                              >
                                <IconTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </div>
                          <div className="w-12 shrink-0 text-center ml-0 mr-[10px]">
                            <span className="whitespace-nowrap">??젣</span>
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
                                parentNode={currentNode} // ?뮕 異붽?: ?꾩옱 ??二쇱씤???뺣낫瑜??섍꺼以띾땲??
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
                                  potentialHeirsLabel = '??듭긽??遺덇?';
                              } else if (activeTabObj && activeTabObj.parentNode) {
                                const parentHeirs = activeTabObj.parentNode.heirs || [];
                                const relation = currentNode?.relation || '';
                                
                                if (relation === 'wife' || relation === 'husband') {
                                  const children = parentHeirs.filter(s => s.relation === 'son' || s.relation === 'daughter');
                                  const names = children.map(c => c.name || '(?대쫫?놁쓬)');
                                  if (names.length > 0) {
                                    potentialHeirsLabel = '?쇰??듭옄???먮?';
                                    potentialHeirsStr = names.join(', ');
                                  }
                                } else if (relation === 'son' || relation === 'daughter') {
                                  const siblings = parentHeirs.filter(s => s.id !== currentNode.id && (s.relation === 'son' || s.relation === 'daughter'));
                                  const names = siblings.map(c => c.name || '(?대쫫?놁쓬)');
                                  if (names.length > 0) {
                                    potentialHeirsLabel = '?뺤젣?먮ℓ';
                                    potentialHeirsStr = names.join(', ');
                                  }
                                }
                              }

                              return (
                                  <div className="py-20 text-center flex flex-col items-center gap-4 text-[#a3a3a3] dark:text-neutral-500 bg-[#fbfbfb] dark:bg-neutral-800/20 border-2 border-dashed border-[#e9e9e7] dark:border-neutral-700/50 rounded-lg">
                                      <IconUserPlus className="w-12 h-12 opacity-20 mb-2" />
                                      <p className="text-[14px] font-bold text-neutral-400">?꾩쭅 ?깅줉???곸냽?몄씠 ?놁뒿?덈떎.</p>
                                      
                                      {activeDeceasedTab !== 'root' && (
                                          <div className="mt-2 flex flex-col items-center gap-1.5 opacity-80">
                                              <p className="text-[13px] font-medium text-[#b45309] dark:text-amber-500/80">
                                                  {potentialHeirsLabel === '?쇰??듭옄???먮?' 
                                                      ? '蹂꾨룄???곸냽?몄쓣 ?낅젰?섏? ?딆쑝硫?怨듬룞 ?곸냽?몄씤 ?먮?(?쇱긽?띿씤??吏곴퀎鍮꾩냽)瑜??곸냽?몄쑝濡?媛꾩＜?섏뿬 ?곸냽吏遺꾩쓣 ?먮룞?쇰줈 怨꾩궛?⑸땲??' 
                                                      : potentialHeirsLabel === '??듭긽??遺덇?'
                                                      ? '??듭긽?띿씤???낅젰?댁＜?몄슂. 誘명샎?대굹 臾댁옄??쇰㈃ ?곷떒??[??듭긽?? ?ㅼ쐞移섎? OFF ?댁＜?몄슂.'
                                                      : '?곸냽?몄쓣 ?낅젰?섏? ?딆쑝硫?2?쒖쐞(吏곴퀎議댁냽)瑜??곗꽑?섎ŉ, 吏곴퀎議댁냽 遺????3?쒖쐞(?뺤젣?먮ℓ)媛 ?곸냽?섎뒗 寃껋쑝濡?怨꾩궛?⑸땲??'}
                                              </p>
                                              {potentialHeirsStr && potentialHeirsLabel !== '??듭긽??遺덇?' && (
                                                  <p className="text-[13px] font-bold text-[#b45309] dark:text-amber-500 mt-1">
                                                      [{potentialHeirsLabel === '?쇰??듭옄???먮?' ? '怨듬룞 ?곸냽?몄씤 ?먮?' : potentialHeirsLabel}] {potentialHeirsStr}
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
                  <span>?대쫫???대┃?섏뿬 ?섏쐞 ?곸냽??諛곗슦???먮?) 愿怨꾨룄瑜??묎굅???쇱퀜???뺤씤?섏떎 ???덉뒿?덈떎.</span>
                </div>
                <button onClick={() => {
                  const next = Math.abs(treeToggleSignal) + 1;
                  setTreeToggleSignal(isAllExpanded ? -next : next);
                  setIsAllExpanded(!isAllExpanded);
                }} className="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-[#d4d4d4] dark:border-neutral-600 hover:bg-[#efefed] dark:hover:bg-neutral-700 text-[#37352f] dark:text-neutral-200 rounded transition-colors text-[13px] font-bold shadow-sm whitespace-nowrap">
                  {isAllExpanded ? '紐⑤몢 ?묎린' : '紐⑤몢 ?쇱튂湲?}
                </button>
              </div>
              <div className="bg-white dark:bg-neutral-900/50 p-8 rounded-xl border border-[#e9e9e7] dark:border-neutral-700 shadow-sm overflow-hidden transition-colors">
                <TreeReportNode node={tree} level={0} treeToggleSignal={treeToggleSignal} />
              </div>
            </div>
          )}

          {/* 怨듯넻 湲곕낯?뺣낫 ?ㅻ뜑 (誘몃땲硫 ?띿뒪?? */}
          {(activeTab === 'calc' || activeTab === 'result' || activeTab === 'summary') && (
            <div className="w-full mb-6 pb-3 border-b border-[#e9e9e7] dark:border-neutral-700 text-[13px] text-[#504f4c] dark:text-neutral-400 flex flex-wrap gap-8 no-print">
              <span>?ш굔踰덊샇: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.caseNo || '誘몄엯??}</span></span>
              <span>?쇱긽?띿씤: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.name || '誘몄엯??}</span></span>
              <span>?щ쭩?쇱옄: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.deathDate || '誘몄엯??}</span></span>
              <span>?곸슜踰뺣졊: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{getLawEra(tree.deathDate)}??誘쇰쾿</span></span>
            </div>
          )}

          {activeTab === 'calc' && (
            <section className="w-full text-[#37352f] dark:text-neutral-200">
              <div className="mb-4 text-[13px] text-[#787774] dark:text-neutral-500">
                ???쇱긽?띿씤遺???쒖옉?섏뿬 媛?????ъ긽??諛쒖깮 ?쒖젏留덈떎 吏遺꾩씠 ?곗텧??怨꾩궛 ?먮쫫?쒖엯?덈떎.
              </div>
              <div className="space-y-6 print-mt-4">
                {calcSteps.map((s, i) => (
                  <div key={'p-s'+i}>
                    <div className="mb-2 text-[13px] text-[#504f4c] dark:text-neutral-300">
                      [STEP {i+1}] <span className="font-medium text-[#37352f] dark:text-neutral-100">留?{s.dec.name}</span> ({formatKorDate(s.dec.deathDate)} ?щ쭩) ? 遺꾨같 吏遺? {s.inN}/{s.inD}
                      {s.mergeSources && s.mergeSources.length > 1 && (
                        <span className="text-[#787774]">
                          {` (= ${s.mergeSources.map(src => `${src.from} ${src.d}遺꾩쓽 ${src.n}`).join(' + ')})`}
                        </span>
                      )}
                    </div>
                    <table className="w-full border-collapse text-[13px]">
                      <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                        <tr>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[15%] text-[#787774] dark:text-neutral-400">?깅챸</th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[12%] text-[#787774] dark:text-neutral-400">愿怨?/th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[25%] text-[#787774] dark:text-neutral-400">怨꾩궛??/th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-center w-[18%] text-[#787774] dark:text-neutral-400">怨꾩궛??吏遺?/th>
                          <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2 font-medium text-left w-[30%] pl-4 text-[#787774] dark:text-neutral-400">鍮꾧퀬 (?ъ쑀)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.dists.map((d, di) => {
                          const isSpecial = d.mod && d.mod.length > 0;
                          const hasDeathInfoInEx = d.ex && (d.ex.includes('?щ쭩') || d.ex.includes('?좎궗留?));
                          
                          let memo = [];
                          if (d.ex) memo.push(`?곸냽沅??놁쓬(${d.ex})`);
                          if (d.h.isDeceased && !hasDeathInfoInEx) memo.push('留앹씤');
                          if (isSpecial) memo.push(...d.mod.split(',').map(m => m.trim()));
                          
                          return (
                            <tr key={di} className="hover:bg-[#fcfcfb] dark:hover:bg-neutral-800/20 transition-colors">
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center font-medium">
                                {d.h.name}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">
                                {getRelStr(d.h.relation, s.dec.deathDate) || '?곸냽??}
                              </td>
                              <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2 text-center text-[#787774]">
                                {s.inN}/{s.inD} 횞 {d.sn}/{d.sd}
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
                  ??理쒖쥌 ?앹〈 ?곸냽??湲곗??쇰줈 ?밴퀎諛쏆? 吏遺꾨뱾???⑹궛??寃利앺몴?낅땲??
                </div>
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">理쒖쥌 ?곸냽??/th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[60%] text-[#787774]">吏遺?痍⑤뱷 ?댁뿭 (?⑹궛??</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">理쒖쥌 ?⑷퀎 吏遺?/th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length > 0 ? results.map((r, i) => {
                      const total = r.sources.reduce((acc, s) => {
                        const [nn, nd] = math.add(acc.n, acc.d, s.n, s.d);
                        return { n: nn, d: nd };
                      }, { n: 0, d: 1 });
                      
                      const sourceText = r.sources.map(s => `${s.n}/${s.d} (留?${s.decName})`).join('  +  ');

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
                          理쒖쥌 ?앹〈 ?곸냽?몄씠 ?놁뒿?덈떎.
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
                  const type = (h.deathDate && isBefore(h.deathDate, parentDeathDate)) ? '??듭긽?? : '?ъ긽??;
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
                const type = (h.deathDate && isBefore(h.deathDate, tree.deathDate)) ? '??듭긽?? : '?ъ긽??;
                const child = buildGroups(h, h.deathDate || tree.deathDate);
                if (child.directShares.length > 0 || child.subGroups.length > 0) {
                  topGroups.push({ ancestor: h, type, ...child });
                }
              }
            });

            // ?뮕 由ы뙥?좊쭅: useSmartGuide?먯꽌 ?대? 怨꾩궛??媛믪쓣 ?ъ슜?섎룄濡??꾨㈃ 援먯껜
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
              const heirTypeStr = group.type === '??듭긽?? ? '??듭긽?띿씤' : '?곸냽??;
              const reasonText = `${formatKorDate(group.ancestor.deathDate)} 怨듬룞?곸냽??以?${group.ancestor.name}?(?? ?щ쭩?섏??쇰?濡?洹?${heirTypeStr}`;
              
              return (
                <React.Fragment key={'grp-'+group.ancestor.id}>
                  <tr className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <td colSpan={isAmountActive ? 4 : 3} className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[#504f4c] dark:text-neutral-400 pl-4">
                      ??{reasonText}
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
                      <IconList className="w-5 h-5 text-[#787774]"/> 吏遺??붿빟??                    </h2>
                    
                    {/* ?뮕 ?붿빟???곸냽??寃?됱갹 (媛?대뱶???곕Ⅸ 理쒖쥌 踰꾩쟾) */}
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-[#e5e5e5] dark:border-neutral-700 rounded-full px-3 py-1.5 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30">
                      <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input
                        type="text"
                        placeholder="?대쫫 寃??
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
                            <button onClick={handlePrevMatch} title="?댁쟾 李얘린" className="p-0.5 text-neutral-400 hover:text-[#37352f] dark:hover:text-white transition-colors rounded">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                            </button>
                            <button onClick={handleNextMatch} title="?ㅼ쓬 李얘린" className="p-0.5 text-neutral-400 hover:text-[#37352f] dark:hover:text-white transition-colors rounded">
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
                       湲덉븸 怨꾩궛 ?ы븿
                     </label>
                     {isAmountActive && (
                       <input type="text" value={formatMoney(propertyValue)} onChange={(e) => setPropertyValue(e.target.value.replace(/[^0-9]/g, ''))} className="w-32 px-2.5 py-1.5 border border-[#e9e9e7] bg-transparent text-right outline-none text-[13px] rounded-md focus:bg-neutral-50" placeholder="?곸냽?ъ궛 ?낅젰" />
                     )}
                  </div>
                </div>

                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">?곸냽???깅챸</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">理쒖쥌 吏遺?(?듬텇 ??</th>
                      <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[20%] text-[#787774]">理쒖쥌 吏遺?(?듬텇 ??</th>
                      {isAmountActive && <th className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 font-medium text-center w-[30%] text-[#787774]">?곸냽 湲덉븸(??</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {topDirect.map(f => renderShareRow(f, 0))}
                    {topGroups.map(g => renderGroup(g, 0))}
                  </tbody>
                  <tfoot className="bg-[#fcfcfb] dark:bg-neutral-800/40">
                    <tr>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-right font-medium text-[#787774]">?⑷퀎 寃利?/td>
                      <td className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-center font-medium">
                        {totalSumN} / {totalSumD}
                      </td>
                      <td colSpan={isAmountActive ? 2 : 1} className="border border-[#e9e9e7] dark:border-neutral-700 p-2.5 text-left text-[12.5px]">
                        {(() => {
                          const sumVal = totalSumD ? totalSumN / totalSumD : 0;
                          const targetVal = simpleTargetD ? simpleTargetN / simpleTargetD : 1;
                          
                          if (totalSumN === 0) {
                            return <span className="text-[#b45309] dark:text-amber-500 font-bold">?좑툘 ?곸냽?몄씠 ?낅젰?섏? ?딆븯嫄곕굹, 紐⑤몢 ?щ쭩/?쒖쇅?섏뼱 ?앹〈 ?곸냽?몄씠 ?놁뒿?덈떎.</span>;
                          } else if (sumVal === targetVal) {
                            if (mismatchReasons && mismatchReasons.length > 0) {
                              return <span className="text-red-500 font-bold">?좑툘 ?⑷퀎???쇱튂?섎굹, ?섏쐞 ??듭긽?띿씤 ?꾨씫???섏떖?⑸땲?? (?꾨옒 ?덈궡 李몄“)</span>;
                            }
                            return <span className="text-[#504f4c] dark:text-neutral-300">?뷂툘 ?쇱긽?띿씤 吏遺꾧낵 ?쇱튂 ({simpleTargetN}/{simpleTargetD})</span>;
                          } else if (sumVal < targetVal) {
                            return <span className="text-red-500 font-bold">?좑툘 吏遺??⑷퀎 誘몃떖 (?꾨씫??吏遺꾩씠 ?덉뒿?덈떎. ?꾨옒 ?덈궡 李몄“)</span>;
                          } else {
                            return <span className="text-red-500 font-bold">?좑툘 吏遺??⑷퀎 珥덇낵 (?ㅻ쪟)</span>;
                          }
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* ?뮕 ??諛붽묑?쇰줈 遺꾨━??遺덉씪移?寃쎄퀬 硫붿떆吏 ?곸뿭 */}
                {!isMatch && mismatchReasons.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 no-print">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 dark:text-red-400 font-bold text-[14px]">?좑툘 ?곸냽 吏遺?諛곕텇 ?덈궡</span>
                    </div>
                    <ul className="list-disc pl-5 text-[#c93f3a] dark:text-red-400 space-y-1.5 text-[13px] font-medium leading-relaxed">
                      {mismatchReasons.map((r, idx) => (
                        <li 
                          key={idx} 
                          onClick={() => r.id && r.id !== 'root' ? handleNavigate(r.id) : null}
                          className={`transition-all ${r.id && r.id !== 'root' ? 'cursor-pointer hover:underline decoration-red-400 underline-offset-4' : ''}`}
                          title={r.id && r.id !== 'root' ? "?대┃ ???대떦 ?곸냽???꾩튂濡??대룞?⑸땲?? : ""}
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

        {/* ?꾨줈 媛湲?踰꾪듉 */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white/20 dark:border-neutral-700/30 text-[#2383e2] dark:text-blue-400 px-5 py-2.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-bold no-print"
          >
            <span className="text-[16px]">??/span> 留??꾨줈
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
