import { Post, ActivityLogItem } from '../types';

export interface ActivityFeedItem extends ActivityLogItem {
  postId: string;
  postTitle: string;
  brandId: Post['brandId'];
}

/**
 * Flatten every post's own activity log into one shared feed, newest first.
 * Deliberately small — a feed, not an audit system: no separate table, no
 * pagination, just "what happened recently" pulled from data that already
 * exists on each post (PRD §4 — visibility for the team, not an audit
 * requirement anyone has to fill in).
 */
export function getRecentActivity(posts: Post[], limit = 20): ActivityFeedItem[] {
  const all: ActivityFeedItem[] = posts.flatMap((post) =>
    post.activityLog.map((entry) => ({
      ...entry,
      postId: post.id,
      postTitle: post.title,
      brandId: post.brandId
    }))
  );

  // Timestamps are "YYYY-MM-DD HH:MM" strings — lexicographic sort is chronological.
  all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return all.slice(0, limit);
}
