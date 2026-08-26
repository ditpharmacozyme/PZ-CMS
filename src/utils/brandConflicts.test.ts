import { describe, it, expect } from 'vitest';
import { getDayBrandSummary, getPostTimeConflict } from './brandConflicts';
import { Post } from '../types';

const basePost: Post = {
  id: 'p1',
  brandId: 'pharmacozyme',
  title: 'Post 1',
  caption: 'Caption 1',
  platform: 'instagram',
  specType: 'feed-post',
  scheduledDate: '2026-08-26',
  scheduledTime: '10:00 AM',
  status: 'not-started',
  assignees: ['Dr. A'],
  visualUrl: '',
  approved: false,
  tags: [],
  comments: [],
  activityLog: []
};

describe('brandConflicts utility', () => {
  it('returns empty summary when dayPosts is empty', () => {
    const summary = getDayBrandSummary([]);
    expect(summary.brandCount).toBe(0);
    expect(summary.hasCollision).toBe(false);
    expect(summary.timeClashes).toHaveLength(0);
  });

  it('detects multi-brand collision correctly', () => {
    const post2: Post = {
      ...basePost,
      id: 'p2',
      brandId: 'med-q',
      title: 'MedQ Post'
    };

    const summary = getDayBrandSummary([basePost, post2]);
    expect(summary.brandCount).toBe(2);
    expect(summary.hasCollision).toBe(true);
    expect(summary.distinctBrandIds).toContain('pharmacozyme');
    expect(summary.distinctBrandIds).toContain('med-q');
  });

  it('identifies exact time clashes on the same date', () => {
    const post2: Post = {
      ...basePost,
      id: 'p2',
      brandId: 'med-q',
      scheduledTime: '10:00 AM'
    };

    const summary = getDayBrandSummary([basePost, post2]);
    expect(summary.timeClashes).toHaveLength(1);
    expect(summary.timeClashes[0].time).toBe('10:00 AM');
    expect(summary.timeClashes[0].posts).toHaveLength(2);
  });

  it('checks individual post timing conflict', () => {
    const post2: Post = {
      ...basePost,
      id: 'p2',
      brandId: 'pz-academy',
      scheduledTime: '10:00 AM'
    };

    const conflict = getPostTimeConflict(basePost, [basePost, post2]);
    expect(conflict.hasClash).toBe(true);
    expect(conflict.conflictingPost?.id).toBe('p2');

    const noConflict = getPostTimeConflict(basePost, [basePost]);
    expect(noConflict.hasClash).toBe(false);
  });
});
