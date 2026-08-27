import { Post, BrandId } from '../types';
import { logTimestamp } from './date';

interface QuickPostOptions {
  /** The brand filter currently active in the shell -- 'all' falls back to pharmacozyme. */
  brandFilter: BrandId | 'all';
  /** Who to assign -- normally the logged-in teammate. Empty string => unassigned. */
  assignee: string;
  /** Optional date (YYYY-MM-DD). Omitted/empty => the post lands in the Idea Backlog. */
  scheduledDate?: string;
}

/**
 * The one shared shape for every fast capture path -- the backlog's one-line
 * quick-add, the global quick-add bar, and inline day-cell create. Previously
 * this object literal was inlined only inside IdeaBacklog, so the other
 * surfaces had nothing to build on. Matches that original shape exactly
 * (instagram / feed-post / not-started), adding just an optional date.
 */
export function buildQuickPost(title: string, opts: QuickPostOptions): Post {
  const trimmed = title.trim();
  const actor = opts.assignee || 'Someone';
  const now = Date.now();
  return {
    id: `post-${now}`,
    brandId: opts.brandFilter === 'all' ? 'pharmacozyme' : opts.brandFilter,
    title: trimmed,
    caption: '',
    platform: 'instagram',
    specType: 'feed-post',
    scheduledDate: opts.scheduledDate || '',
    scheduledTime: '',
    status: 'not-started',
    assignees: opts.assignee ? [opts.assignee] : [],
    visualUrl: '',
    approved: false,
    tags: [],
    comments: [],
    activityLog: [
      {
        id: `act-${now}`,
        actor,
        action: opts.scheduledDate ? 'Created post' : 'Created idea',
        timestamp: logTimestamp(),
      },
    ],
  };
}
