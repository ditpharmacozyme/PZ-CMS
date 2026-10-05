import { useEffect, useMemo, useState } from 'react';
import { TutorialCategory } from '../types';
import {
  getStoredTutorialCategories,
  saveStoredTutorialCategories,
  fetchRemoteTutorialCategories,
  upsertRemoteTutorialCategory,
  deleteRemoteTutorialCategory,
  subscribeRemoteTutorialCategories
} from '../utils/tutorialStorage';

export function useTutorialCategories() {
  const [categories, setCategories] = useState<TutorialCategory[]>(() =>
    getStoredTutorialCategories()
  );

  useEffect(() => {
    fetchRemoteTutorialCategories().then((r) => {
      if (r && r.length) setCategories(r);
    });
    const unsub = subscribeRemoteTutorialCategories((r) => {
      if (r && r.length) setCategories(r);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    saveStoredTutorialCategories(categories);
  }, [categories]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const addCategory = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }

    const cat: Omit<TutorialCategory, 'createdAt'> = {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: categories.length
    };

    setCategories((prev) => [
      ...prev,
      { ...cat, createdAt: new Date().toISOString() }
    ]);
    await upsertRemoteTutorialCategory(cat);
    return true;
  };

  const renameCategory = async (
    oldName: string,
    newName: string
  ): Promise<boolean> => {
    const target = categories.find(
      (c) => c.name.toLowerCase() === oldName.toLowerCase()
    );
    const trimmed = newName.trim();
    if (!target || !trimmed) return false;
    if (
      categories.some(
        (c) =>
          c.id !== target.id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      return false;
    }

    const updated = { ...target, name: trimmed };
    setCategories((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    await upsertRemoteTutorialCategory({
      id: updated.id,
      name: updated.name,
      sortOrder: updated.sortOrder
    });
    return true;
  };

  const deleteCategory = async (name: string): Promise<void> => {
    const target = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (!target) return;
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    await deleteRemoteTutorialCategory(target.id);
  };

  const reorderCategories = async (orderedIds: string[]): Promise<void> => {
    const next = categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx >= 0 ? { ...c, sortOrder: idx } : c;
    });
    setCategories(next);
    await Promise.all(
      next.map((c) =>
        upsertRemoteTutorialCategory({
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder
        })
      )
    );
  };

  return useMemo(
    () => ({
      categories: sortedCategories,
      addCategory,
      renameCategory,
      deleteCategory,
      reorderCategories
    }),
    [sortedCategories]
  );
}
