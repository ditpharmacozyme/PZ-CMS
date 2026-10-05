import { describe, it, expect } from 'vitest';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from './promptCategories';
import { Prompt } from '../types';

const p = (id: string, category: string): Prompt => ({
  id, title: id, promptText: 'text', category, images: [], videoLinks: [],
  createdBy: 'Tester', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
});

describe('applyCategoryRename', () => {
  it('renames matching prompts', () => {
    const out = applyCategoryRename([p('a', 'Hook Ideas'), p('b', 'Hashtags')], 'Hook Ideas', 'Hooks');
    expect(out.map((x) => x.category)).toEqual(['Hooks', 'Hashtags']);
  });
  it('is case-insensitive on the old name', () => {
    const out = applyCategoryRename([p('a', 'hook ideas')], 'Hook Ideas', 'Hooks');
    expect(out[0].category).toBe('Hooks');
  });
});

describe('applyCategoryDelete', () => {
  it('reassigns matching prompts to Uncategorized', () => {
    const out = applyCategoryDelete([p('a', 'Hook Ideas'), p('b', 'Hashtags')], 'Hook Ideas');
    expect(out.map((x) => x.category)).toEqual([UNCATEGORIZED, 'Hashtags']);
  });
});
