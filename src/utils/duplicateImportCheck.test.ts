import { describe, it, expect } from 'vitest';
import { findDuplicateMatches, formatImportSummary } from './duplicateImportCheck';
import { Post, BrandConfig, BrandId } from '../types';
import { SEED_BRANDS } from '../data/brands';

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1',
    brandId: 'pharmacozyme',
    title: 'Untitled',
    caption: '',
    platform: 'instagram',
    specType: 'feed-post',
    scheduledDate: '2026-10-02',
    scheduledTime: '10:00',
    status: 'not-started',
    assignees: [],
    visualUrl: '',
    images: [],
    approved: false,
    emailReminderEnabled: false,
    comments: [],
    activityLog: [],
    tags: [],
    ...overrides,
  };
}

describe('findDuplicateMatches', () => {
  it('finds a candidate matching an existing post by title + date + brand', () => {
    const existing = [makePost({ id: 'e1', title: 'The Error Nobody Sees', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' })];
    const candidate = makePost({ id: 'c1', title: 'The Error Nobody Sees', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' });
    expect(findDuplicateMatches([candidate], existing)).toEqual([candidate]);
  });

  it('matches titles case-insensitively and ignoring surrounding whitespace', () => {
    const existing = [makePost({ id: 'e1', title: '  the error nobody sees  ', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' })];
    const candidate = makePost({ id: 'c1', title: 'THE ERROR NOBODY SEES', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' });
    expect(findDuplicateMatches([candidate], existing)).toHaveLength(1);
  });

  it('does not match when the date differs', () => {
    const existing = [makePost({ id: 'e1', title: 'Same Title', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' })];
    const candidate = makePost({ id: 'c1', title: 'Same Title', scheduledDate: '2026-10-03', brandId: 'pharmacozyme' });
    expect(findDuplicateMatches([candidate], existing)).toEqual([]);
  });

  it('does not match when the brand differs', () => {
    const existing = [makePost({ id: 'e1', title: 'Same Title', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' })];
    const candidate = makePost({ id: 'c1', title: 'Same Title', scheduledDate: '2026-10-02', brandId: 'med-q' });
    expect(findDuplicateMatches([candidate], existing)).toEqual([]);
  });

  it('returns an empty array when there are no existing posts', () => {
    const candidate = makePost({ id: 'c1' });
    expect(findDuplicateMatches([candidate], [])).toEqual([]);
  });

  it('returns only the candidates that match, not all candidates', () => {
    const existing = [makePost({ id: 'e1', title: 'Matches', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' })];
    const matching = makePost({ id: 'c1', title: 'Matches', scheduledDate: '2026-10-02', brandId: 'pharmacozyme' });
    const nonMatching = makePost({ id: 'c2', title: 'New Post', scheduledDate: '2026-10-05', brandId: 'pharmacozyme' });
    expect(findDuplicateMatches([matching, nonMatching], existing)).toEqual([matching]);
  });
});

describe('formatImportSummary', () => {
  const brands = SEED_BRANDS as Record<BrandId, BrandConfig>;

  it('summarizes a single brand and date range', () => {
    const posts = [
      makePost({ brandId: 'pharmacozyme', scheduledDate: '2026-10-02' }),
      makePost({ brandId: 'pharmacozyme', scheduledDate: '2026-11-22' }),
    ];
    expect(formatImportSummary(posts, brands)).toBe('Pharmacozyme, 2026-10-02 – 2026-11-22');
  });

  it('lists multiple brands when posts span more than one', () => {
    const posts = [
      makePost({ brandId: 'pharmacozyme', scheduledDate: '2026-10-02' }),
      makePost({ brandId: 'med-q', scheduledDate: '2026-10-03' }),
    ];
    expect(formatImportSummary(posts, brands)).toBe('MED-Q, Pharmacozyme, 2026-10-02 – 2026-10-03');
  });

  it('collapses to a single date when every post shares one date', () => {
    const posts = [
      makePost({ brandId: 'pharmacozyme', scheduledDate: '2026-10-02' }),
      makePost({ brandId: 'pharmacozyme', scheduledDate: '2026-10-02' }),
    ];
    expect(formatImportSummary(posts, brands)).toBe('Pharmacozyme, 2026-10-02');
  });

  it('returns an empty string for an empty post list', () => {
    expect(formatImportSummary([], brands)).toBe('');
  });
});
