import { Post, PostStatus } from '../types';

/**
 * Status used to be a fully independent, manually-set field that never
 * agreed with the 🎨🚀💬 stage checkboxes -- a post could be `posted` with
 * every stage unticked, or fully staged and still read "Not Started". This
 * derives status from what's actually known about the post instead, so
 * there is exactly one thing to update, not two.
 *
 * Only 🎨 design and 🚀 publish drive status (💬 engagement never does --
 * confirmed with the team). Two booleans can't cover four statuses on their
 * own, so `scheduledDate` breaks the tie: a post with no date is still just
 * an idea, so it can't be "in progress" yet.
 *
 *   no scheduledDate                -> not-started
 *   has a date, design not done     -> in-progress
 *   design done, publish not done   -> ready-to-post
 *   publish done                    -> posted
 */
export function deriveStatus(post: Post): PostStatus {
  const stages = post.stageCompletion;
  if (stages?.publishDone) return 'posted';
  if (stages?.designDone) return 'ready-to-post';
  if (post.scheduledDate) return 'in-progress';
  return 'not-started';
}
