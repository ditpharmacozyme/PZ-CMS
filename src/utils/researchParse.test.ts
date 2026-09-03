import { describe, it, expect } from 'vitest';
import { mapBrandNameToId, convertCsvRowsToPosts, parseCalendarCsv } from './researchParse';
import { SEED_BRANDS } from '../data/brands';

describe('researchParse brand mapping', () => {
  it('maps a display name to its BrandId using the supplied brands map', () => {
    expect(mapBrandNameToId('PZ Academy', SEED_BRANDS)).toBe('pz-academy');
    expect(mapBrandNameToId('pharmacozyme', SEED_BRANDS)).toBe('pharmacozyme');
    expect(mapBrandNameToId('Unknown Co', SEED_BRANDS)).toBe('shared');
  });

  it('converts CSV rows to posts, resolving the brand from the supplied brands map', () => {
    const csv =
      'date,brand,platform,content_type,title,description,status,owner\n' +
      '2026-09-01,MED-Q,instagram,feed-post,Test,Desc,not-started,Dr. A';
    const parsed = parseCalendarCsv(csv);
    expect(parsed.error).toBeNull();
    const posts = convertCsvRowsToPosts(parsed.rows!, undefined, undefined, undefined, SEED_BRANDS);
    expect(posts).toHaveLength(1);
    expect(posts[0].brandId).toBe('med-q');
  });
});
