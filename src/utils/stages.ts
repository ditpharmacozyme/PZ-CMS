import { Post, StageCompletion } from '../types';
import { logTimestamp } from './date';
import { deriveStatus } from './postStatus';

export type Stage = 'design' | 'publish' | 'engagement';

const STAGE_LABEL: Record<Stage, string> = {
  design: 'Design',
  publish: 'Publish',
  engagement: 'Engagement',
};

/** The person named against this stage in taskRoles, e.g. taskRoles.designer for 'design'. */
function roleHolder(post: Post, stage: Stage): string | undefined {
  if (stage === 'design') return post.taskRoles?.designer;
  if (stage === 'publish') return post.taskRoles?.publisher;
  return post.taskRoles?.engagementLead;
}

/**
 * Explicitly sets one stage on or off, stamping *DoneAt/*DoneBy and
 * recomputing `status` (see utils/postStatus.ts) so it can never go stale
 * relative to the stages. `actorName` is whoever clicked; the *DoneBy credit
 * goes to the person named in taskRoles for this stage when one is set
 * (matching PostDetailModal's existing behavior), falling back to the actor.
 */
export function setStageDone(post: Post, stage: Stage, done: boolean, actorName: string): Post {
  const current: StageCompletion = post.stageCompletion || {};
  const creditedName = roleHolder(post, stage) || actorName;
  const timestamp = logTimestamp();

  let updatedStage: StageCompletion;
  if (stage === 'design') {
    updatedStage = { ...current, designDone: done, designDoneAt: done ? timestamp : undefined, designDoneBy: done ? creditedName : undefined };
  } else if (stage === 'publish') {
    updatedStage = { ...current, publishDone: done, publishDoneAt: done ? timestamp : undefined, publishDoneBy: done ? creditedName : undefined };
  } else {
    updatedStage = { ...current, engagementDone: done, engagementDoneAt: done ? timestamp : undefined, engagementDoneBy: done ? creditedName : undefined };
  }

  const updatedPost: Post = {
    ...post,
    stageCompletion: updatedStage,
    activityLog: [
      {
        id: `act-${Date.now()}`,
        actor: actorName,
        action: done ? `Marked ${STAGE_LABEL[stage]} complete (${creditedName})` : `Reopened ${STAGE_LABEL[stage]} stage`,
        timestamp,
      },
      ...post.activityLog,
    ],
  };

  return { ...updatedPost, status: deriveStatus(updatedPost) };
}

/** Flips one stage from whatever it currently is. */
export function toggleStage(post: Post, stage: Stage, actorName: string): Post {
  const current = post.stageCompletion || {};
  const isDone = stage === 'design' ? current.designDone : stage === 'publish' ? current.publishDone : current.engagementDone;
  return setStageDone(post, stage, !isDone, actorName);
}
