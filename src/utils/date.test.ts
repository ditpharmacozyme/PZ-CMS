import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOverdue, todayStr, visibleStripDates } from './date';
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

describe('visibleStripDates', () => {
  const monthCells = [
    { dateStr: '', isCurrentMonth: false },            // leading filler
    { dateStr: '2026-03-01', isCurrentMonth: true },
    { dateStr: '2026-03-02', isCurrentMonth: true },
    { dateStr: '2026-03-15', isCurrentMonth: true },
    { dateStr: '2026-03-16', isCurrentMonth: true },
    { dateStr: '2026-03-31', isCurrentMonth: true },
    { dateStr: '', isCurrentMonth: false },            // trailing filler
  ];

  it('always drops filler cells (empty dateStr / not current month)', () => {
    const out = visibleStripDates(monthCells, '2026-03-15', false);
    expect(out.map((c) => c.dateStr)).toEqual([
      '2026-03-01', '2026-03-02', '2026-03-15', '2026-03-16', '2026-03-31',
    ]);
  });

  it('drops days before today when hidePastDays is set', () => {
    const out = visibleStripDates(monthCells, '2026-03-15', true);
    expect(out.map((c) => c.dateStr)).toEqual(['2026-03-15', '2026-03-16', '2026-03-31']);
  });

  it('keeps today itself when hiding past days', () => {
    const out = visibleStripDates(monthCells, '2026-03-16', true);
    expect(out.map((c) => c.dateStr)).toContain('2026-03-16');
    expect(out.map((c) => c.dateStr)).not.toContain('2026-03-15');
  });

  it('shows the whole month when hidePastDays is false (past/future month)', () => {
    const out = visibleStripDates(monthCells, '2026-06-10', false);
    expect(out).toHaveLength(5);
  });
});
