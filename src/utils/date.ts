/**
 * Date helpers.
 *
 * Note: `new Date().toISOString().split('T')[0]` returns the UTC date, which is
 * the wrong day for anyone whose local date differs from UTC at the time of the
 * call. Everything here works off local time instead.
 */

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
