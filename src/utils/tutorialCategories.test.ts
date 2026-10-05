import { describe, it, expect } from 'vitest';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from './tutorialCategories';
import { Tutorial } from '../types';

const mockTutorials: Tutorial[] = [
  {
    id: 't-1',
    brandId: 'pharmacozyme',
    title: 'Intro to Video Editing',
    description: '',
    category: 'Video Production',
    tags: [],
    videos: [],
    links: [],
    prompts: [],
    files: [],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  },
  {
    id: 't-2',
    brandId: 'shared',
    title: 'SOP: Publishing',
    description: '',
    category: 'Onboarding & SOPs',
    tags: [],
    videos: [],
    links: [],
    prompts: [],
    files: [],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  },
  {
    id: 't-3',
    brandId: 'pz-academy',
    title: 'Advanced Video Mastery',
    description: '',
    category: 'video production', // case-insensitive test
    tags: [],
    videos: [],
    links: [],
    prompts: [],
    files: [],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  }
];

describe('tutorialCategories utilities', () => {
  it('renames matching categories case-insensitively', () => {
    const updated = applyCategoryRename(mockTutorials, 'Video Production', 'Cinematography');
    expect(updated[0].category).toBe('Cinematography');
    expect(updated[1].category).toBe('Onboarding & SOPs');
    expect(updated[2].category).toBe('Cinematography');
  });

  it('cascades deleted categories to Uncategorized', () => {
    const updated = applyCategoryDelete(mockTutorials, 'Video Production');
    expect(updated[0].category).toBe(UNCATEGORIZED);
    expect(updated[1].category).toBe('Onboarding & SOPs');
    expect(updated[2].category).toBe(UNCATEGORIZED);
  });

  it('leaves items unchanged when target category does not match', () => {
    const updated = applyCategoryRename(mockTutorials, 'Non-existent', 'Something');
    expect(updated).toEqual(mockTutorials);
  });
});
