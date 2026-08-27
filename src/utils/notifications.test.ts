import { describe, it, expect } from 'vitest';
import { mergeNotifications, generateNotifications } from './notifications';
import { AppNotification, Post, TeamMember } from '../types';

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1', brandId: 'pharmacozyme', title: 'Test', caption: '', platform: 'instagram',
    specType: 'feed-post', scheduledDate: '2020-01-01', scheduledTime: '10:00', status: 'not-started',
    assignees: [], visualUrl: '', approved: false, comments: [], activityLog: [], tags: [],
    ...overrides,
  } as Post;
}
const alice: TeamMember = { id: 't1', name: 'Alice', role: 'X', email: 'a@x.com' } as TeamMember;

describe('mergeNotifications', () => {
  it('carries a freshly generated notification into the output', () => {
    // Regression test for the argument-order bug: useNotifications used to
    // call mergeNotifications(prev, generated) against a signature of
    // mergeNotifications(fresh, previous). Since it maps over its first
    // argument, every newly generated notification was silently dropped and
    // a fresh browser (previous === []) showed a permanently empty bell.
    const fresh = [
      { id: 'due-1', type: 'due_soon' as const, title: 'Post A', message: 'Due soon.', date: '2026-08-21' }
    ];
    const result = mergeNotifications(fresh, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('due-1');
  });

  it('preserves read state for a notification that still exists', () => {
    const previous: AppNotification[] = [
      { id: 'due-1', type: 'due_soon', title: 'Post A', message: 'Due soon.', date: '2026-08-21', read: true }
    ];
    const fresh = [
      { id: 'due-1', type: 'due_soon' as const, title: 'Post A', message: 'Due soon.', date: '2026-08-21' }
    ];
    const result = mergeNotifications(fresh, previous);
    expect(result[0].read).toBe(true);
  });

  it('marks a brand-new notification as unread', () => {
    const fresh = [
      { id: 'due-2', type: 'due_soon' as const, title: 'Post B', message: 'Due soon.', date: '2026-08-22' }
    ];
    const result = mergeNotifications(fresh, []);
    expect(result[0].read).toBe(false);
  });

  it('drops a notification whose condition no longer holds, even if unread', () => {
    const previous: AppNotification[] = [
      { id: 'overdue-1', type: 'overdue', title: 'Post C', message: 'Overdue.', date: '2026-08-10', read: false }
    ];
    // post C got posted, so the fresh generation no longer includes it
    const result = mergeNotifications([], previous);
    expect(result).toHaveLength(0);
  });
});

describe('generateNotifications — stage_blocking', () => {
  it("fires when it's genuinely the teammate's turn (earlier stage done, theirs isn't)", () => {
    const post = makePost({
      taskRoles: { designer: 'Bob', publisher: 'Alice' },
      stageCompletion: { designDone: true },
    });
    const out = generateNotifications([post], alice);
    const blk = out.find((n) => n.type === 'stage_blocking');
    expect(blk).toBeTruthy();
    expect(blk!.id).toBe('blocking-p1-publish');
  });

  it("does not fire when an earlier stage the teammate doesn't own is still open", () => {
    const post = makePost({ taskRoles: { designer: 'Bob', publisher: 'Alice' }, stageCompletion: {} });
    const out = generateNotifications([post], alice);
    expect(out.some((n) => n.type === 'stage_blocking')).toBe(false);
  });

  it('does not fire without an active teammate', () => {
    const post = makePost({ taskRoles: { designer: 'Alice' }, stageCompletion: {} });
    expect(generateNotifications([post]).some((n) => n.type === 'stage_blocking')).toBe(false);
  });

  it('does not fire once the post derives to posted (publish done)', () => {
    const post = makePost({ taskRoles: { designer: 'Alice' }, stageCompletion: { publishDone: true } });
    const out = generateNotifications([post], alice);
    expect(out.some((n) => n.type === 'stage_blocking')).toBe(false);
  });
});
