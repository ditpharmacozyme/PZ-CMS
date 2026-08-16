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
        message: post.assignees.length > 0
          ? `Due ${post.scheduledDate} — assigned to ${post.assignees.join(', ')}.`
          : `Due ${post.scheduledDate} — nobody's assigned yet.`,
        date: post.scheduledDate,
        postId: post.id,
        brandId: post.brandId
      });
    }
  }

  // Unassigned but dated — someone needs to own this before it's due.
  for (const post of scheduled) {
    if (post.assignees.length > 0 || post.status === 'posted') continue;
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

  const todayIso = todayStr();
  for (const post of scheduled) {
    // Overdue
    if (post.scheduledDate < todayIso && (post.status === 'not-started' || post.status === 'in-progress')) {
      notifications.push({
        id: `overdue-${post.id}`,
        type: 'overdue',
        title: post.title,
        message: `Overdue since ${post.scheduledDate}.`,
        date: post.scheduledDate,
        postId: post.id,
        brandId: post.brandId
      });
    }

    // Approval needed
    if (post.status === 'ready-to-post' && !post.approved) {
      notifications.push({
        id: `approval-${post.id}`,
        type: 'approval',
        title: post.title,
        message: `Ready to post but needs approval.`,
        date: post.scheduledDate,
        postId: post.id,
        brandId: post.brandId
      });
    }

    // Stage Complete (just tracking if any are done, for demo/awareness)
    if (post.stageCompletion) {
      const stages = [];
      if (post.stageCompletion.designDone) stages.push('Design');
      if (post.stageCompletion.publishDone) stages.push('Publishing');
      if (post.stageCompletion.engagementDone) stages.push('Engagement');

      if (stages.length > 0) {
        notifications.push({
          id: `stage-${post.id}`,
          type: 'stage_complete',
          title: post.title,
          message: `${stages.join(', ')} complete.`,
          date: post.scheduledDate,
          postId: post.id,
          brandId: post.brandId
        });
      }
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
