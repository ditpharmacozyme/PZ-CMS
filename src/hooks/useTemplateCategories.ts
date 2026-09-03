import { useEffect, useMemo, useState } from 'react';
import { BrandId, TemplateCategory } from '../types';
import {
  getStoredCategories,
  saveStoredCategories,
  fetchRemoteCategories,
  upsertRemoteCategory,
  deleteRemoteCategory,
  subscribeRemoteCategories,
} from '../utils/storage';

/**
 * Manages the editable list of template categories (per brand + a 'shared'
 * scope). Categories only — reassigning PostTemplates when a category is
 * renamed or deleted is the component's job (Task 10), not this hook's.
 * localStorage is the always-available fast path; Supabase is best-effort.
 */
export function useTemplateCategories() {
  const [categories, setCategories] = useState<TemplateCategory[]>(() => getStoredCategories());

  useEffect(() => {
    // `fetchRemoteCategories` returns null on error but [] on a successful
    // query of an empty/absent table — and [] is truthy. Guard on length so an
    // empty remote never clobbers locally-added categories (mirrors
    // BrandsContext's `remote && remote.length` guard).
    fetchRemoteCategories().then((r) => { if (r && r.length) setCategories(r); });
    const unsub = subscribeRemoteCategories((r) => { if (r && r.length) setCategories(r); });
    return () => unsub();
  }, []);

  useEffect(() => { saveStoredCategories(categories); }, [categories]);

  const categoriesFor = (scope: BrandId | 'shared') =>
    categories.filter((c) => c.brandId === scope).sort((a, b) => a.sortOrder - b.sortOrder);

  const addCategory = async (scope: BrandId | 'shared', name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categoriesFor(scope).some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const cat: Omit<TemplateCategory, 'createdAt'> = {
      id: crypto.randomUUID(),
      brandId: scope,
      name: trimmed,
      sortOrder: categoriesFor(scope).length,
    };
    setCategories((prev) => [...prev, { ...cat, createdAt: new Date().toISOString() }]);
    await upsertRemoteCategory(cat);
  };

  /**
   * Returns true only when the rename actually persisted. Returns false on an
   * empty new name or a case-insensitive collision with another category in
   * the same scope — the caller must NOT run its template cascade on false.
   */
  const renameCategory = async (scope: BrandId | 'shared', oldName: string, newName: string): Promise<boolean> => {
    const target = categoriesFor(scope).find((c) => c.name.toLowerCase() === oldName.toLowerCase());
    if (!target || !newName.trim()) return false;
    // Refuse a rename that would collide with another category in this scope
    // (mirrors addCategory's dedupe check).
    if (categoriesFor(scope).some((c) => c.id !== target.id && c.name.toLowerCase() === newName.trim().toLowerCase())) return false;
    const updated = { ...target, name: newName.trim() };
    setCategories((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    await upsertRemoteCategory({ id: updated.id, brandId: updated.brandId, name: updated.name, sortOrder: updated.sortOrder });
    return true;
  };

  const deleteCategory = async (scope: BrandId | 'shared', name: string) => {
    const target = categoriesFor(scope).find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    await deleteRemoteCategory(target.id);
  };

  const reorderCategories = async (scope: BrandId | 'shared', orderedIds: string[]) => {
    const next = categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx >= 0 && c.brandId === scope ? { ...c, sortOrder: idx } : c;
    });
    setCategories(next);
    await Promise.all(
      next
        .filter((c) => c.brandId === scope)
        .map((c) => upsertRemoteCategory({ id: c.id, brandId: c.brandId, name: c.name, sortOrder: c.sortOrder })),
    );
  };

  return useMemo(
    () => ({ categories, categoriesFor, addCategory, renameCategory, deleteCategory, reorderCategories }),
    [categories],
  );
}
