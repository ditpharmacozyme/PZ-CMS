/**
 * Date helpers.
 *
 * Note: `new Date().toISOString().split('T')[0]` returns the UTC date, which is
 * the wrong day for anyone whose local date differs from UTC at the time of the
 * call. Everything here works off local time instead.
 */

import { Post } from '../types';
import { deriveStatus } from './postStatus';

/** Format a Date as a local `YYYY-MM-DD` string. */
export function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as a local `YYYY-MM-DD` string. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/**
 * The dates the mobile calendar date-strip should render.
 *
 * Always drops filler cells (empty `dateStr`, or days spilling in from an
 * adjacent month). When `hidePastDays` is set — the strip is showing the month
 * that contains today — days before `todayIso` are dropped too, so the strip
 * opens on today rather than the 1st. Past and future months pass `false` and
 * render in full.
 */
export function visibleStripDates<T extends { dateStr: string; isCurrentMonth: boolean }>(
  cells: T[],
  todayIso: string,
  hidePastDays: boolean
): T[] {
  return cells.filter(
    (c) => c.dateStr && c.isCurrentMonth && (!hidePastDays || c.dateStr >= todayIso)
  );
}

/** Parse a `YYYY-MM-DD` string as a local Date (not UTC midnight). */
export function fromDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Day index with Monday as 0 — the order the calendar header renders in.
 * `Date.getDay()` uses Sunday as 0, which misaligns a Monday-first grid.
 */
export function mondayFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The Monday on or before the given date. */
export function startOfWeek(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() - mondayFirstDay(result));
  return result;
}

/** A timestamp in the `YYYY-MM-DD HH:MM` shape used by comments and activity log. */
export function logTimestamp(): string {
  const d = new Date();
  return `${toDateStr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * True when a post's own date has passed and it still isn't posted.
 *
 * This used to be re-implemented in four different components as `status ===
 * 'not-started' || 'in-progress'`, which meant a post stuck at `ready-to-post`
 * past its date was NEVER flagged overdue -- the one state that most clearly
 * means "someone forgot to actually post it". The real rule is simpler: any
 * status other than `posted`, once the date has passed, is late.
 *
 * Checks the derived status (utils/postStatus.ts), not the raw stored
 * `post.status` field, for the same reason getPostStatusConfig does: status
 * is no longer directly settable, so the derived value is the only one that
 * can't go stale.
 */
export function isOverdue(post: Post): boolean {
  return Boolean(post.scheduledDate) && post.scheduledDate < todayStr() && deriveStatus(post) !== 'posted';
}
