import { Post, BrandConfig, BrandId } from '../types';

/**
 * A CSV import (or research-item "Auto-fill Content Calendar") has no
 * memory of what it already added -- clicking it twice just doubles the
 * calendar. This matches incoming rows against what's already scheduled so
 * the caller can warn before writing duplicates.
 */
function matchKey(p: Pick<Post, 'title' | 'scheduledDate' | 'brandId'>): string {
  return `${p.brandId}|${p.scheduledDate}|${p.title.trim().toLowerCase()}`;
}

export function findDuplicateMatches(candidates: Post[], existing: Post[]): Post[] {
  const existingKeys = new Set(existing.map(matchKey));
  return candidates.filter((c) => existingKeys.has(matchKey(c)));
}

/** "Pharmacozyme, 2026-10-02 – 2026-11-22" (or a single date when every post shares one). */
export function formatImportSummary(posts: Post[], brands: Record<BrandId, BrandConfig>): string {
  if (posts.length === 0) return '';
  const brandNames = Array.from(new Set(posts.map((p) => brands[p.brandId]?.name || p.brandId))).sort();
  const dates = Array.from(new Set(posts.map((p) => p.scheduledDate).filter(Boolean))).sort();
  const dateRange = dates.length <= 1 ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`;
  return `${brandNames.join(', ')}, ${dateRange}`;
}
