import { describe, it, expect } from 'vitest';
import { deriveStatus } from './postStatus';
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

describe('deriveStatus', () => {
  it('is not-started for a backlog idea with no date and no stages', () => {
    expect(deriveStatus(makePost({ scheduledDate: '' }))).toBe('not-started');
  });

  it('is in-progress once dated but design not done', () => {
    expect(deriveStatus(makePost({ scheduledDate: '2026-01-01' }))).toBe('in-progress');
  });

  it('is ready-to-post once design is done but not published', () => {
    const post = makePost({ scheduledDate: '2026-01-01', stageCompletion: { designDone: true } });
    expect(deriveStatus(post)).toBe('ready-to-post');
  });

  it('is posted once published, even without a date', () => {
    const post = makePost({ scheduledDate: '', stageCompletion: { publishDone: true } });
    expect(deriveStatus(post)).toBe('posted');
  });

  it('is posted when publishDone is true regardless of designDone', () => {
    const post = makePost({ scheduledDate: '2026-01-01', stageCompletion: { designDone: false, publishDone: true } });
    expect(deriveStatus(post)).toBe('posted');
  });

  it('ignores the stored status field entirely -- it is display-derived, not read', () => {
    const post = makePost({ scheduledDate: '2026-01-01', status: 'posted', stageCompletion: undefined });
    expect(deriveStatus(post)).toBe('in-progress');
  });

  it('engagementDone alone never changes status', () => {
    const post = makePost({ scheduledDate: '2026-01-01', stageCompletion: { engagementDone: true } });
    expect(deriveStatus(post)).toBe('in-progress');
  });
});
