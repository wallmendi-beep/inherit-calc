import { useState, useEffect, useMemo } from 'react';
import { isBefore } from '../engine/utils';

export function useDeceasedTabs(tree) {
  const [activeDeceasedTab, setActiveDeceasedTab] = useState('root');

  const deceasedTabs = useMemo(() => {
    const tabMap = new Map();
    const registeredPersonIds = new Set();
    const visitedNodes = new Set();
    tabMap.set('root', {
      id: 'root', personId: 'root', name: tree.name || '피상속인',
      node: tree, parentName: null, level: 0, branchRootId: null,
    });
    const queue = [];
    if (tree.heirs) tree.heirs.forEach((h) => queue.push({ node: h, parentNode: tree, level: 1, branchRootId: h.personId }));
    while (queue.length > 0) {
      const { node, parentNode, level, branchRootId } = queue.shift();
      if (!node || visitedNodes.has(node.id)) continue;
      visitedNodes.add(node.id);

      const hasEnteredHeirs = node.heirs && node.heirs.length > 0;
      const isTarget =
        node.isDeceased ||
        (node.isExcluded && (node.exclusionOption === 'lost' || node.exclusionOption === 'disqualified')) ||
        hasEnteredHeirs;
      const isSpouseNode = node.relation === 'wife' || node.relation === 'husband' || node.relation === 'spouse';
      const parentDeathDate = parentNode?.deathDate || tree.deathDate;
      const isPredeceasedSpouse = isSpouseNode && node.deathDate && parentDeathDate && isBefore(node.deathDate, parentDeathDate);
      let currentBranchRootId = branchRootId;
      const pId = node.personId;

      if (isTarget && !isPredeceasedSpouse) {
        if (!registeredPersonIds.has(pId)) {
          tabMap.set(pId, {
            id: pId, personId: pId, name: node.name || '(상속인)',
            node: node, parentNode: parentNode,
            parentName: parentNode.id === 'root' ? (tree.name || '피상속인') : parentNode.name,
            parentTabId: parentNode.id === 'root' ? 'root' : parentNode.personId,
            inheritanceType: node.isDeceased ? 'deceased' : 'excluded',
            relation: node.relation, level: level, branchRootId: currentBranchRootId,
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

      if (node.heirs && node.heirs.length > 0)
        node.heirs.forEach((h) => queue.push({ node: h, parentNode: node, level: level + 1, branchRootId: currentBranchRootId }));
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
    [deceasedTabs, activeDeceasedTab]
  );

  const getBriefingInfo = useMemo(() => {
    if (activeDeceasedTab === 'root') {
      return { name: tree.name || '피상속인', relation: '피상속인', deathDate: tree.deathDate };
    }
    const tab = deceasedTabs.find((t) => t.id === activeDeceasedTab);
    return { name: tab?.name || '(상속인)', relation: tab?.relation, deathDate: tab?.node?.deathDate };
  }, [tree, deceasedTabs, activeDeceasedTab]);

  return { deceasedTabs, activeDeceasedTab, setActiveDeceasedTab, activeTabObj, getBriefingInfo };
}
