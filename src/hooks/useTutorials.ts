import { useEffect, useMemo, useState, useCallback } from 'react';
import { Tutorial, BrandId } from '../types';
import {
  getStoredTutorials,
  saveStoredTutorials,
  fetchRemoteTutorials,
  upsertRemoteTutorial,
  deleteRemoteTutorial,
  subscribeRemoteTutorials
} from '../utils/tutorialStorage';

export function useTutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => getStoredTutorials());

  useEffect(() => {
    fetchRemoteTutorials().then((r) => {
      if (r && r.length) setTutorials(r);
    });
    const unsub = subscribeRemoteTutorials((r) => {
      if (r && r.length) setTutorials(r);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    saveStoredTutorials(tutorials);
  }, [tutorials]);

  const addTutorial = useCallback(
    async (item: Omit<Tutorial, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tutorial> => {
      const now = new Date().toISOString();
      const newTutorial: Tutorial = {
        ...item,
        id: `tutorial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now
      };

      setTutorials((prev) => [newTutorial, ...prev]);
      await upsertRemoteTutorial(newTutorial);
      return newTutorial;
    },
    []
  );

  const updateTutorial = useCallback(async (item: Tutorial): Promise<void> => {
    const updated: Tutorial = {
      ...item,
      updatedAt: new Date().toISOString()
    };

    setTutorials((prev) => prev.map((t) => (t.id === item.id ? updated : t)));
    await upsertRemoteTutorial(updated);
  }, []);

  const deleteTutorial = useCallback(async (id: string): Promise<void> => {
    setTutorials((prev) => prev.filter((t) => t.id !== id));
    await deleteRemoteTutorial(id);
  }, []);

  const setTutorialsList = useCallback(async (next: Tutorial[]): Promise<void> => {
    setTutorials(next);
    await Promise.all(next.map((t) => upsertRemoteTutorial(t)));
  }, []);

  const getFilteredTutorials = useCallback(
    (brandFilter: BrandId | 'all', categoryFilter: string, searchQuery: string): Tutorial[] => {
      return tutorials.filter((t) => {
        // Brand filter: if 'all', include everything. If specific brand, include that brand AND 'shared'
        if (brandFilter !== 'all' && t.brandId !== brandFilter && t.brandId !== 'shared') {
          return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && (t.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = t.title.toLowerCase().includes(q);
          const descMatch = t.description.toLowerCase().includes(q);
          const tagMatch = t.tags.some((tag) => tag.toLowerCase().includes(q));
          const promptMatch = t.prompts.some(
            (p) => p.title.toLowerCase().includes(q) || p.promptText.toLowerCase().includes(q)
          );
          if (!titleMatch && !descMatch && !tagMatch && !promptMatch) {
            return false;
          }
        }

        return true;
      });
    },
    [tutorials]
  );

  return useMemo(
    () => ({
      tutorials,
      addTutorial,
      updateTutorial,
      deleteTutorial,
      setTutorialsList,
      getFilteredTutorials
    }),
    [tutorials, addTutorial, updateTutorial, deleteTutorial, setTutorialsList, getFilteredTutorials]
  );
}
