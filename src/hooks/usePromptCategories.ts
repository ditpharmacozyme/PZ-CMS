import { useEffect, useMemo, useState } from 'react';
import { PromptCategory } from '../types';
import {
  getStoredPromptCategories,
  saveStoredPromptCategories,
  fetchRemotePromptCategories,
  upsertRemotePromptCategory,
  deleteRemotePromptCategory,
  subscribeRemotePromptCategories,
} from '../utils/storage';

/**
 * Manages the editable list of prompt categories. No brand scoping -- one
 * shared list for the whole team (see [[pzcms_ai_prompt_and_dedup]] /
 * Prompts Library spec). Categories only -- reassigning Prompts when a
 * category is renamed or deleted is the component's job, not this hook's,
 * mirroring useTemplateCategories's existing split.
 */
export function usePromptCategories() {
  const [categories, setCategories] = useState<PromptCategory[]>(() => getStoredPromptCategories());

  useEffect(() => {
    fetchRemotePromptCategories().then((r) => { if (r && r.length) setCategories(r); });
    const unsub = subscribeRemotePromptCategories((r) => { if (r && r.length) setCategories(r); });
    return () => unsub();
  }, []);

  useEffect(() => { saveStoredPromptCategories(categories); }, [categories]);

  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const cat: Omit<PromptCategory, 'createdAt'> = {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: categories.length,
    };
    setCategories((prev) => [...prev, { ...cat, createdAt: new Date().toISOString() }]);
    await upsertRemotePromptCategory(cat);
  };

  const renameCategory = async (oldName: string, newName: string): Promise<boolean> => {
    const target = categories.find((c) => c.name.toLowerCase() === oldName.toLowerCase());
    if (!target || !newName.trim()) return false;
    if (categories.some((c) => c.id !== target.id && c.name.toLowerCase() === newName.trim().toLowerCase())) return false;
    const updated = { ...target, name: newName.trim() };
    setCategories((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    await upsertRemotePromptCategory({ id: updated.id, name: updated.name, sortOrder: updated.sortOrder });
    return true;
  };

  const deleteCategory = async (name: string) => {
    const target = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    await deleteRemotePromptCategory(target.id);
  };

  const reorderCategories = async (orderedIds: string[]) => {
    const next = categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx >= 0 ? { ...c, sortOrder: idx } : c;
    });
    setCategories(next);
    await Promise.all(next.map((c) => upsertRemotePromptCategory({ id: c.id, name: c.name, sortOrder: c.sortOrder })));
  };

  return useMemo(
    () => ({ categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder), addCategory, renameCategory, deleteCategory, reorderCategories }),
    [categories],
  );
}
