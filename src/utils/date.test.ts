import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOverdue, todayStr } from './date';
import { Post } from '../types';

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1',
    brandId: 'pharmacozyme',
    title: 'Test post',
    caption: '',
    platform: 'instagram',
    specType: 'feed-post',
    scheduledDate: '',
    scheduledTime: '',
    status: 'not-started',
    assignees: [],
    visualUrl: '',
    approved: false,
    comments: [],
    activityLog: [],
    tags: [],
    ...overrides
  } as Post;
}

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers());

  it('is true for a past date stuck at ready-to-post', () => {
    // This is the exact case the old duplicated rule missed everywhere: it
    // only checked status === 'not-started' | 'in-progress', so a post left
    // at ready-to-post past its date was never flagged.
    const post = makePost({ scheduledDate: '2000-01-01', status: 'ready-to-post' });
    expect(isOverdue(post)).toBe(true);
  });

  it('is true for a past date still not-started', () => {
    const post = makePost({ scheduledDate: '2000-01-01', status: 'not-started' });
    expect(isOverdue(post)).toBe(true);
  });

  it('is false once the post is posted, regardless of date', () => {
    // isOverdue checks the derived status (utils/postStatus.ts), not the raw
    // stored `status` field, so "posted" here means publishDone: true.
    const post = makePost({ scheduledDate: '2000-01-01', stageCompletion: { publishDone: true } });
    expect(isOverdue(post)).toBe(false);
  });

  it('is false with no scheduled date (backlog idea)', () => {
    const post = makePost({ scheduledDate: '', status: 'not-started' });
    expect(isOverdue(post)).toBe(false);
  });

  it('is false for today', () => {
    const post = makePost({ scheduledDate: todayStr(), status: 'not-started' });
    expect(isOverdue(post)).toBe(false);
  });

  it('is false for a future date', () => {
    const post = makePost({ scheduledDate: '2999-01-01', status: 'not-started' });
    expect(isOverdue(post)).toBe(false);
  });
});
