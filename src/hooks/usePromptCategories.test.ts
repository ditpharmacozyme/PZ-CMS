import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const fetchRemotePromptCategories = vi.fn();
const upsertRemotePromptCategory = vi.fn().mockResolvedValue(undefined);
const deleteRemotePromptCategory = vi.fn().mockResolvedValue(undefined);
const subscribeRemotePromptCategories = vi.fn().mockReturnValue(() => {});
const getStoredPromptCategories = vi.fn().mockReturnValue([]);
const saveStoredPromptCategories = vi.fn();

vi.mock('../utils/storage', () => ({
  fetchRemotePromptCategories: (...a: unknown[]) => fetchRemotePromptCategories(...a),
  upsertRemotePromptCategory: (...a: unknown[]) => upsertRemotePromptCategory(...a),
  deleteRemotePromptCategory: (...a: unknown[]) => deleteRemotePromptCategory(...a),
  subscribeRemotePromptCategories: (...a: unknown[]) => subscribeRemotePromptCategories(...a),
  getStoredPromptCategories: (...a: unknown[]) => getStoredPromptCategories(...a),
  saveStoredPromptCategories: (...a: unknown[]) => saveStoredPromptCategories(...a),
}));

import { usePromptCategories } from './usePromptCategories';

beforeEach(() => {
  vi.clearAllMocks();
  getStoredPromptCategories.mockReturnValue([]);
  fetchRemotePromptCategories.mockResolvedValue([]);
  subscribeRemotePromptCategories.mockReturnValue(() => {});
});

describe('usePromptCategories', () => {
  it('adds a category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hook Ideas'); });
    expect(result.current.categories.map((c) => c.name)).toEqual(['Hook Ideas']);
    expect(upsertRemotePromptCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hook Ideas', sortOrder: 0 }));
  });

  it('refuses a case-insensitive duplicate name', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.addCategory('hooks'); });
    expect(result.current.categories).toHaveLength(1);
  });

  it('renames a category and returns true on success', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    let ok = false;
    await act(async () => { ok = await result.current.renameCategory('Hooks', 'Hook Ideas'); });
    expect(ok).toBe(true);
    expect(result.current.categories[0].name).toBe('Hook Ideas');
  });

  it('refuses a rename that collides with another existing category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.addCategory('Captions'); });
    let ok = true;
    await act(async () => { ok = await result.current.renameCategory('Hooks', 'captions'); });
    expect(ok).toBe(false);
    expect(result.current.categories.map((c) => c.name).sort()).toEqual(['Captions', 'Hooks']);
  });

  it('deletes a category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.deleteCategory('Hooks'); });
    expect(result.current.categories).toHaveLength(0);
    expect(deleteRemotePromptCategory).toHaveBeenCalled();
  });

  it('loads categories fetched from Supabase on mount', async () => {
    fetchRemotePromptCategories.mockResolvedValue([
      { id: 'c1', name: 'Hashtags', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
    ]);
    const { result } = renderHook(() => usePromptCategories());
    await waitFor(() => expect(result.current.categories.map((c) => c.name)).toEqual(['Hashtags']));
  });
});
