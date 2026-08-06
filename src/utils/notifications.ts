import { Post, AppNotification } from '../types';
import { fromDateStr, todayStr } from './date';

const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Derive notifications straight from the current posts — due-soon reminders,
 * unassigned-but-dated posts, and same-day multi-brand collisions (PRD §5.8).
 * Pure function: same posts in, same notifications out (minus `read`, which the
 * caller merges back in so dismissals survive regeneration).
 */
export function generateNotifications(posts: Post[]): Omit<AppNotification, 'read'>[] {
  const notifications: Omit<AppNotification, 'read'>[] = [];
  const today = fromDateStr(todayStr());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + DUE_SOON_WINDOW_DAYS);

  const scheduled = posts.filter((p) => p.scheduledDate);

  // Due soon — scheduled within the next few days and not already posted.
  for (const post of scheduled) {
    if (post.status === 'posted') continue;
    const date = fromDateStr(post.scheduledDate);
    if (date >= today && date <= windowEnd) {
      notifications.push({
        id: `due-${post.id}`,
        type: 'due_soon',
        title: post.title,
        message: post.assignee
          ? `Due ${post.scheduledDate} — assigned to ${post.assignee}.`
          : `Due ${post.scheduledDate} — nobody's assigned yet.`,
        date: post.scheduledDate,
        postId: post.id,
        brandId: post.brandId
      });
    }
  }

  // Unassigned but dated — someone needs to own this before it's due.
  for (const post of scheduled) {
    if (post.assignee.trim() || post.status === 'posted') continue;
    notifications.push({
      id: `unassigned-${post.id}`,
      type: 'unassigned',
      title: post.title,
      message: `Scheduled for ${post.scheduledDate} but nobody's assigned.`,
      date: post.scheduledDate,
      postId: post.id,
      brandId: post.brandId
    });
  }

  // Collisions — two or more brands posting the same day (awareness only, PRD §5.2).
  const byDate = new Map<string, Set<string>>();
  for (const post of scheduled) {
    const brands = byDate.get(post.scheduledDate) || new Set<string>();
    brands.add(post.brandId);
    byDate.set(post.scheduledDate, brands);
  }
  for (const [dateStr, brands] of byDate.entries()) {
    if (brands.size > 1) {
      notifications.push({
        id: `collision-${dateStr}`,
        type: 'collision_alert',
        title: `${brands.size} brands post on ${dateStr}`,
        message: `${Array.from(brands).length} brands have posts scheduled the same day — just so you know.`,
        date: dateStr
      });
    }
  }

  return notifications.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge freshly generated notifications with the previous list so `read` state
 * survives regeneration, and drop stale ones whose condition no longer holds
 * (post got assigned, date passed, etc.) even if they were never dismissed.
 */
export function mergeNotifications(
  fresh: Omit<AppNotification, 'read'>[],
  previous: AppNotification[]
): AppNotification[] {
  const previousById = new Map(previous.map((n) => [n.id, n]));
  return fresh.map((n) => ({ ...n, read: previousById.get(n.id)?.read ?? false }));
}
