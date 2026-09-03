import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTemplateCategories } from './useTemplateCategories';
import { TemplateCategory } from '../types';

vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteCategories: vi.fn().mockResolvedValue(null),
    subscribeRemoteCategories: vi.fn().mockReturnValue(() => {}),
    upsertRemoteCategory: vi.fn().mockResolvedValue(undefined),
    deleteRemoteCategory: vi.fn().mockResolvedValue(undefined),
  };
});

const seed = (cats: TemplateCategory[]) =>
  localStorage.setItem('pharmacozyme_brandops_template_categories_v1', JSON.stringify(cats));

const cat = (id: string, name: string, sortOrder: number): TemplateCategory => ({
  id, brandId: 'shared', name, sortOrder, createdAt: '2026-01-01',
});

beforeEach(() => localStorage.clear());

describe('useTemplateCategories.renameCategory', () => {
  it('returns false and changes nothing on a case-insensitive collision', async () => {
    seed([cat('a', 'Clinical', 0), cat('b', 'Editorial', 1)]);
    const { result } = renderHook(() => useTemplateCategories());

    let ret: boolean | undefined;
    await act(async () => { ret = await result.current.renameCategory('shared', 'Editorial', 'clinical'); });

    expect(ret).toBe(false);
    expect(result.current.categoriesFor('shared').map((c) => c.name)).toEqual(['Clinical', 'Editorial']);
  });

  it('returns true and persists a real rename', async () => {
    seed([cat('a', 'Clinical', 0), cat('b', 'Editorial', 1)]);
    const { result } = renderHook(() => useTemplateCategories());

    let ret: boolean | undefined;
    await act(async () => { ret = await result.current.renameCategory('shared', 'Editorial', 'Protocols'); });

    expect(ret).toBe(true);
    await waitFor(() =>
      expect(result.current.categoriesFor('shared').map((c) => c.name)).toEqual(['Clinical', 'Protocols']),
    );
  });
});
