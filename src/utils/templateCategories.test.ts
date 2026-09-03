import { describe, it, expect } from 'vitest';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from './templateCategories';
import { PostTemplate } from '../types';

const t = (id: string, brandId: PostTemplate['brandId'], category: string): PostTemplate => ({
  id, title: id, description: '', brandId, category, platform: 'instagram', specType: 'feed-post',
  defaultCaption: '', tags: [], imagePreview: '', usesCount: 0,
});

describe('applyCategoryRename', () => {
  it('renames matching templates in scope only', () => {
    const out = applyCategoryRename(
      [t('a', 'med-q', 'Clinical'), t('b', 'pillz', 'Clinical'), t('c', 'med-q', 'Editorial')],
      'med-q', 'Clinical', 'Case Studies',
    );
    expect(out.map((x) => x.category)).toEqual(['Case Studies', 'Clinical', 'Editorial']);
  });
  it('is case-insensitive on the old name', () => {
    const out = applyCategoryRename([t('a', 'shared', 'clinical')], 'shared', 'Clinical', 'X');
    expect(out[0].category).toBe('X');
  });
});

describe('applyCategoryDelete', () => {
  it('reassigns matching templates to Uncategorized', () => {
    const out = applyCategoryDelete([t('a', 'med-q', 'Clinical'), t('b', 'med-q', 'Editorial')], 'med-q', 'Clinical');
    expect(out.map((x) => x.category)).toEqual([UNCATEGORIZED, 'Editorial']);
  });
});
