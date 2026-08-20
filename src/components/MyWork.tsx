import React, { useMemo, useState } from 'react';
import { Post, TeamMember } from '../types';
import { BRANDS } from '../data/brands';
import { todayStr, toDateStr, startOfWeek, isOverdue } from '../utils/date';
import { deriveStatus } from '../utils/postStatus';
import { isMine } from '../utils/postOwnership';
import { toggleStage, Stage } from '../utils/stages';

interface MyWorkProps {
  posts: Post[];
  activeTeammate: TeamMember | null;
  onSelectPost: (post: Post) => void;
  onSavePost: (post: Post) => void;
}

const STAGE_EMOJI: Record<Stage, string> = { design: '🎨', publish: '🚀', engagement: '💬' };
const STAGE_ACTION_LABEL: Record<Stage, string> = {
  design: 'Design not done',
  publish: 'Publish not done',
  engagement: 'Engagement not done',
};
const STAGE_DONE_LABEL: Record<Stage, string> = {
  design: 'Design done',
  publish: 'Publish done',
  engagement: 'Engagement done',
};

/** Whichever of design/publish is blocking this post from moving forward -- the same rule deriveStatus uses. */
function blockingStage(post: Post): Stage {
  return post.stageCompletion?.designDone ? 'publish' : 'design';
}

/** The stage this specific teammate is named against in taskRoles that isn't ticked yet, if any. */
function myPendingStage(post: Post, teammate: TeamMember | null): Stage | null {
  if (!teammate) return null;
  const roles = post.taskRoles;
  if (!roles) return null;
  if (roles.designer === teammate.name && !post.stageCompletion?.designDone) return 'design';
  if (roles.publisher === teammate.name && !post.stageCompletion?.publishDone) return 'publish';
  if (roles.engagementLead === teammate.name && !post.stageCompletion?.engagementDone) return 'engagement';
  return null;
}

interface Row {
  post: Post;
  stage: Stage;
}

/** The four sections with an actionable inline toggle -- "Unscheduled ideas" is deliberately not one of these (see below). */
type ActionableSectionKey = 'late' | 'today' | 'week' | 'waiting';

export const MyWork: React.FC<MyWorkProps> = ({ posts, activeTeammate, onSelectPost, onSavePost }) => {
  // Toggling a stage from this screen can make a row stop naturally
  // qualifying for the section it's in (e.g. its "waiting on me" stage
  // just got ticked) -- without this, the row would vanish instantly with
  // no way to undo a mis-tap short of opening the post. Pinning it keeps
  // the row (and the done-state button styling) visible and reversible in
  // place for the rest of this viewing session.
  const [sessionPins, setSessionPins] = useState<Record<string, { sectionKey: ActionableSectionKey; stage: Stage }>>({});

  const handleToggle = (post: Post, stage: Stage, sectionKey: ActionableSectionKey) => {
    setSessionPins((prev) => ({ ...prev, [post.id]: { sectionKey, stage } }));
    onSavePost(toggleStage(post, stage, activeTeammate?.name || 'Someone'));
  };

  const { late, today, thisWeek, waitingOnMe, unscheduledIdeas } = useMemo(() => {
    const late: Row[] = [];
    const today: Row[] = [];
    const thisWeek: Row[] = [];
    const waitingOnMe: Row[] = [];
    const unscheduledIdeas: Post[] = [];

    if (!activeTeammate) return { late, today, thisWeek, waitingOnMe, unscheduledIdeas };

    const todayIso = todayStr();
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndIso = toDateStr(weekEnd);

    // Deliberately cross-brand -- this is a personal task list, not scoped
    // to whatever brand happens to be selected elsewhere in the app (matches
    // MissionControlDashboard, which is also cross-brand). Scoping it would
    // silently hide overdue/pending work under other brands behind a calm
    // "nothing to do" empty state.
    const mine = posts.filter((p) => isMine(p, activeTeammate));
    const mineById = new Map(mine.map((p) => [p.id, p]));

    mine.forEach((post) => {
      const status = deriveStatus(post);
      const pending = myPendingStage(post, activeTeammate);

      if (status !== 'posted' && isOverdue(post)) {
        late.push({ post, stage: blockingStage(post) });
        return;
      }
      if (status !== 'posted' && post.scheduledDate === todayIso) {
        today.push({ post, stage: blockingStage(post) });
        return;
      }
      if (status !== 'posted' && post.scheduledDate && post.scheduledDate > todayIso && post.scheduledDate <= weekEndIso) {
        thisWeek.push({ post, stage: blockingStage(post) });
        return;
      }
      if (pending) {
        waitingOnMe.push({ post, stage: pending });
        return;
      }
      if (status !== 'posted' && !post.scheduledDate) {
        unscheduledIdeas.push(post);
      }
    });

    // Re-attach any row that was manually toggled from this screen but no
    // longer naturally qualifies for the section it was toggled in, using
    // the stage it was toggled on (not a freshly recomputed one) so the
    // exact action taken stays visible and can be tapped again to undo.
    const pinInto = (sectionKey: ActionableSectionKey, rows: Row[]): Row[] => {
      const present = new Set(rows.map((r) => r.post.id));
      const pinned: Row[] = [];
      Object.entries(sessionPins).forEach(([postId, pin]) => {
        if (pin.sectionKey !== sectionKey || present.has(postId)) return;
        const post = mineById.get(postId);
        if (post) pinned.push({ post, stage: pin.stage });
      });
      return [...rows, ...pinned];
    };

    const lateWithPins = pinInto('late', late);
    const todayWithPins = pinInto('today', today);
    const weekWithPins = pinInto('week', thisWeek);
    const waitingWithPins = pinInto('waiting', waitingOnMe);

    const byDateTime = (a: Row, b: Row) =>
      (a.post.scheduledDate || '').localeCompare(b.post.scheduledDate || '') ||
      (a.post.scheduledTime || '').localeCompare(b.post.scheduledTime || '');

    lateWithPins.sort(byDateTime);
    todayWithPins.sort(byDateTime);
    weekWithPins.sort(byDateTime);
    waitingWithPins.sort(byDateTime);
    unscheduledIdeas.sort((a, b) => a.title.localeCompare(b.title));

    return { late: lateWithPins, today: todayWithPins, thisWeek: weekWithPins, waitingOnMe: waitingWithPins, unscheduledIdeas };
  }, [posts, activeTeammate, sessionPins]);

  if (!activeTeammate) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-[#bfcab4] rounded shadow-xs p-8 text-center space-y-2">
          <span className="material-symbols-outlined text-3xl text-[#bfcab4] block">person_off</span>
          <p className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">No teammate identified</p>
          <p className="font-body-md text-xs text-[#707a67] mt-1">
            Add yourself in Settings → Team to see your personalized work list here.
          </p>
        </div>
      </div>
    );
  }

  const renderRow = (sectionKey: ActionableSectionKey) => ({ post, stage }: Row) => {
    const brand = BRANDS[post.brandId];
    const isDone =
      stage === 'design' ? post.stageCompletion?.designDone : stage === 'publish' ? post.stageCompletion?.publishDone : post.stageCompletion?.engagementDone;

    return (
      <div
        key={post.id}
        onClick={() => onSelectPost(post)}
        className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-white hover:bg-[#faf9f5] transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className="flex-shrink-0 px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          >
            {brand?.shortCode || post.brandId}
          </span>
          <div className="min-w-0">
            <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a] truncate">{post.title}</h4>
            <p className="font-code-sm text-[10px] text-[#707a67]">
              {post.scheduledDate ? `${post.scheduledDate}${post.scheduledTime ? ` · ${post.scheduledTime}` : ''}` : 'No date set'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(post, stage, sectionKey);
          }}
          className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg font-label-caps text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
            isDone ? 'bg-[#296c00] text-white' : 'bg-[#ffddb0] text-[#935c00] hover:bg-[#ffcb80]'
          }`}
          title={`Click to mark ${stage} ${isDone ? 'not done' : 'done'}`}
        >
          <span>{STAGE_EMOJI[stage]}</span>
          <span>{isDone ? STAGE_DONE_LABEL[stage] : STAGE_ACTION_LABEL[stage]}</span>
        </button>
      </div>
    );
  };

  // Unscheduled ideas get no stage-toggle button, deliberately -- a dateless
  // idea whose design happens to already be done would otherwise show
  // blockingStage()'s "🚀 Publish not done", letting one tap mark a still-
  // unscheduled idea as posted. The real next action here is picking a
  // date, so the row just opens the post instead.
  const renderIdeaRow = (post: Post) => {
    const brand = BRANDS[post.brandId];
    return (
      <div
        key={post.id}
        onClick={() => onSelectPost(post)}
        className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-white hover:bg-[#faf9f5] transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className="flex-shrink-0 px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          >
            {brand?.shortCode || post.brandId}
          </span>
          <div className="min-w-0">
            <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a] truncate">{post.title}</h4>
            <p className="font-code-sm text-[10px] text-[#707a67]">No date set</p>
          </div>
        </div>

        <span className="flex-shrink-0 px-2.5 py-1.5 rounded-lg font-label-caps text-[10px] font-bold uppercase flex items-center gap-1.5 bg-[#efeeea] text-[#707a67]">
          <span className="material-symbols-outlined text-sm">event</span>
          <span>Needs a date</span>
        </span>
      </div>
    );
  };

  const actionableSections: { key: ActionableSectionKey; label: string; icon: string; emptyMessage: string; rows: Row[] }[] = [
    { key: 'late', label: 'Late', icon: 'error', emptyMessage: 'Nothing overdue. Nice work.', rows: late },
    { key: 'today', label: 'Today', icon: 'today', emptyMessage: 'Nothing due today.', rows: today },
    { key: 'week', label: 'This week', icon: 'date_range', emptyMessage: 'Nothing else due this week.', rows: thisWeek },
    { key: 'waiting', label: 'Waiting on me', icon: 'hourglass_empty', emptyMessage: 'No stages waiting on you.', rows: waitingOnMe },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-[#bfcab4]">
        <span className="font-label-caps text-xs text-[#296951] uppercase font-bold tracking-widest">
          Welcome back, {activeTeammate.name}
        </span>
        <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">My Work</h2>
        <p className="font-body-md text-sm text-[#707a67] mt-1">What needs your attention, in order.</p>
      </div>

      {actionableSections.map((section) => (
        <div key={section.key} className="bg-white border border-[#bfcab4] rounded shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#bfcab4] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#296c00] text-lg">{section.icon}</span>
            <h3 className="font-label-caps text-xs font-bold text-[#1b1c1a] uppercase">{section.label}</h3>
            <span className="font-label-caps text-[10px] text-[#707a67] bg-[#efeeea] px-1.5 py-0.2 rounded-full">
              {section.rows.length}
            </span>
          </div>

          {section.rows.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-body-md text-xs text-[#707a67]">{section.emptyMessage}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0eee6]">{section.rows.map(renderRow(section.key))}</div>
          )}
        </div>
      ))}

      <div className="bg-white border border-[#bfcab4] rounded shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#bfcab4] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#296c00] text-lg">lightbulb</span>
          <h3 className="font-label-caps text-xs font-bold text-[#1b1c1a] uppercase">Unscheduled ideas that are mine</h3>
          <span className="font-label-caps text-[10px] text-[#707a67] bg-[#efeeea] px-1.5 py-0.2 rounded-full">
            {unscheduledIdeas.length}
          </span>
        </div>

        {unscheduledIdeas.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-body-md text-xs text-[#707a67]">No unscheduled ideas assigned to you.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0eee6]">{unscheduledIdeas.map(renderIdeaRow)}</div>
        )}
      </div>
    </div>
  );
};
