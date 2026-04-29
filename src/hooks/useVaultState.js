import { useState, useMemo } from 'react';
import { migrateToVault, buildTreeFromVault } from '../utils/vaultTransforms';
import { getInitialTree } from '../utils/initialData';

const HISTORY_LIMIT = 10;

const cloneDeep = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export function useVaultState() {
  const [vaultState, setVaultState] = useState({
    history: [migrateToVault(getInitialTree())],
    currentIndex: 0,
  });

  const rawVault = vaultState.history[vaultState.currentIndex];

  const setVault = (action) => {
    setVaultState((prev) => {
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
    setVaultState((prev) => {
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

  const undoTree = () =>
    setVaultState((prev) =>
      prev.currentIndex > 0 ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev
    );

  const redoTree = () =>
    setVaultState((prev) =>
      prev.currentIndex < prev.history.length - 1
        ? { ...prev, currentIndex: prev.currentIndex + 1 }
        : prev
    );

  return {
    tree,
    setTree,
    setVault,
    undoTree,
    redoTree,
    canUndo: vaultState.currentIndex > 0,
    canRedo: vaultState.currentIndex < vaultState.history.length - 1,
  };
}
