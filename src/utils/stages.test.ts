import { describe, it, expect } from 'vitest';
import { toggleStage, setStageDone } from './stages';
import { Post } from '../types';

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1',
    brandId: 'pharmacozyme',
    title: 'Test post',
    caption: '',
    platform: 'instagram',
    specType: 'feed-post',
    scheduledDate: '2026-01-01',
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

describe('toggleStage', () => {
  it('turning a stage on stamps *DoneAt and *DoneBy with the actor, and recomputes status', () => {
    const post = makePost({});
    const updated = toggleStage(post, 'design', 'Alice');
    expect(updated.stageCompletion?.designDone).toBe(true);
    expect(updated.stageCompletion?.designDoneAt).toBeTruthy();
    expect(updated.stageCompletion?.designDoneBy).toBe('Alice');
    expect(updated.status).toBe('ready-to-post');
  });

  it('credits the named role holder over the clicking actor', () => {
    // This is the actual bug: PostCard/CalendarListView quick toggles used to
    // credit assignees[0] or skip *DoneBy entirely. The detail modal already
    // credited the named role holder correctly -- this keeps that behavior
    // while fixing the quick-toggle callers to match it.
    const post = makePost({ taskRoles: { designer: 'Bob the Designer' } });
    const updated = toggleStage(post, 'design', 'Alice');
    expect(updated.stageCompletion?.designDoneBy).toBe('Bob the Designer');
    // The activity log still records who actually clicked.
    expect(updated.activityLog[0].actor).toBe('Alice');
  });

  it('turning a stage off clears *DoneAt and *DoneBy', () => {
    const post = makePost({ stageCompletion: { designDone: true, designDoneAt: '2026-01-01 10:00', designDoneBy: 'Alice' } });
    const updated = toggleStage(post, 'design', 'Alice');
    expect(updated.stageCompletion?.designDone).toBe(false);
    expect(updated.stageCompletion?.designDoneAt).toBeUndefined();
    expect(updated.stageCompletion?.designDoneBy).toBeUndefined();
  });

  it('never falls back to assignees[0] when no actor name is given', () => {
    const post = makePost({ assignees: ['Should Not Appear'] });
    const updated = toggleStage(post, 'publish', 'Someone');
    expect(updated.stageCompletion?.publishDoneBy).toBe('Someone');
    expect(updated.activityLog[0].actor).toBe('Someone');
  });

  it('setStageDone sets explicitly rather than flipping current state', () => {
    const post = makePost({ stageCompletion: { publishDone: true, publishDoneAt: 'x', publishDoneBy: 'Alice' } });
    const updated = setStageDone(post, 'publish', true, 'Bob');
    // Already true; setStageDone(..., true, ...) re-stamps rather than toggling off.
    expect(updated.stageCompletion?.publishDone).toBe(true);
    expect(updated.status).toBe('posted');
  });
});
