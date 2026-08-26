import { Post, BrandId } from '../types';
import { BRANDS } from '../data/brands';

export interface TimeClash {
  time: string;
  brandIds: BrandId[];
  posts: Post[];
}

export interface DayBrandSummary {
  distinctBrandIds: BrandId[];
  brandCount: number;
  hasCollision: boolean;
  brandNames: string[];
  timeClashes: TimeClash[];
  totalPosts: number;
}

/**
 * Computes multi-brand density and schedule time clashes for a given set of day posts.
 */
export function getDayBrandSummary(dayPosts: Post[]): DayBrandSummary {
  if (!dayPosts || dayPosts.length === 0) {
    return {
      distinctBrandIds: [],
      brandCount: 0,
      hasCollision: false,
      brandNames: [],
      timeClashes: [],
      totalPosts: 0
    };
  }

  const distinctBrandIds: BrandId[] = Array.from(new Set(dayPosts.map((p) => p.brandId)));
  const brandNames = distinctBrandIds.map((bId) => BRANDS[bId]?.name || bId);

  // Group by non-empty scheduledTime to detect exact time clashes
  const byTime: Record<string, Post[]> = {};
  for (const post of dayPosts) {
    const time = (post.scheduledTime || '').trim();
    if (time) {
      if (!byTime[time]) byTime[time] = [];
      byTime[time].push(post);
    }
  }

  const timeClashes: TimeClash[] = [];
  for (const [time, posts] of Object.entries(byTime)) {
    if (posts.length > 1) {
      const clashBrandIds = Array.from(new Set(posts.map((p) => p.brandId)));
      timeClashes.push({
        time,
        brandIds: clashBrandIds,
        posts
      });
    }
  }

  return {
    distinctBrandIds,
    brandCount: distinctBrandIds.length,
    hasCollision: distinctBrandIds.length > 1,
    brandNames,
    timeClashes,
    totalPosts: dayPosts.length
  };
}

/**
 * Checks if a specific post has a timing conflict with another post on the same day.
 */
export function getPostTimeConflict(post: Post, dayPosts: Post[]): { hasClash: boolean; conflictingPost?: Post } {
  if (!post.scheduledTime || !post.scheduledDate || !dayPosts || dayPosts.length <= 1) {
    return { hasClash: false };
  }

  const conflictingPost = dayPosts.find(
    (other) =>
      other.id !== post.id &&
      other.scheduledDate === post.scheduledDate &&
      other.scheduledTime &&
      other.scheduledTime.trim() === post.scheduledTime.trim()
  );

  return {
    hasClash: Boolean(conflictingPost),
    conflictingPost
  };
}
