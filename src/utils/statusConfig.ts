import { Post, PostStatus } from '../types';
import { isOverdue } from './date';
import { deriveStatus } from './postStatus';

export const STATUS_CONFIG: Record<PostStatus | 'overdue', { color: string, bgColor: string, label: string, icon?: string }> = {
  'not-started': { color: '#52525B', bgColor: '#F1F1F0', label: 'Not Started' },
  'in-progress': { color: '#B45309', bgColor: '#FBF0E1', label: 'In Progress' },
  'ready-to-post': { color: '#4F46E5', bgColor: '#EEF2FF', label: 'Ready to Post' },
  'posted': { color: '#15803D', bgColor: '#E6F4EA', label: 'Posted', icon: 'check_circle' },
  'overdue': { color: '#DC2626', bgColor: '#FCEBEB', label: 'Overdue', icon: 'error' },
};

/**
 * The single source of truth for "what status chip does this post show".
 * Was copy-pasted with a narrower (buggy) overdue rule in four components
 * (PostCard, CalendarListView, CalendarView, MobileDateStripView) -- now they
 * all import this instead.
 *
 * Reads the derived status (see utils/postStatus.ts), not the raw stored
 * `post.status` field -- status is no longer directly settable by users, and
 * deriving fresh here means old rows whose stored status disagrees with
 * their stage flags self-correct on screen with no migration needed.
 */
export function getPostStatusConfig(post: Post) {
  return isOverdue(post) ? STATUS_CONFIG['overdue'] : STATUS_CONFIG[deriveStatus(post)];
}
