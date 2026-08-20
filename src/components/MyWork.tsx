import React, { useMemo } from 'react';
import { BrandId, Post, TeamMember } from '../types';
import { BRANDS } from '../data/brands';
import { todayStr, toDateStr, startOfWeek, isOverdue } from '../utils/date';
import { deriveStatus } from '../utils/postStatus';
import { isMine } from '../utils/postOwnership';
import { toggleStage, Stage } from '../utils/stages';

interface MyWorkProps {
  posts: Post[];
  activeTeammate: TeamMember | null;
  selectedBrandFilter: BrandId | 'all';
  onSelectPost: (post: Post) => void;
  onSavePost: (post: Post) => void;
}

const STAGE_EMOJI: Record<Stage, string> = { design: '🎨', publish: '🚀', engagement: '💬' };
const STAGE_ACTION_LABEL: Record<Stage, string> = {
  design: 'Design not done',
  publish: 'Publish not done',
  engagement: 'Engagement not done',
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

export const MyWork: React.FC<MyWorkProps> = ({ posts, activeTeammate, selectedBrandFilter, onSelectPost, onSavePost }) => {
  const handleToggle = (post: Post, stage: Stage) => {
    onSavePost(toggleStage(post, stage, activeTeammate?.name || 'Someone'));
  };

  const { late, today, thisWeek, waitingOnMe, unscheduledIdeas } = useMemo(() => {
    const late: Row[] = [];
    const today: Row[] = [];
    const thisWeek: Row[] = [];
    const waitingOnMe: Row[] = [];
    const unscheduledIdeas: Row[] = [];

    if (!activeTeammate) return { late, today, thisWeek, waitingOnMe, unscheduledIdeas };

    const todayIso = todayStr();
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndIso = toDateStr(weekEnd);

    const brandFiltered = posts.filter((p) => selectedBrandFilter === 'all' || p.brandId === selectedBrandFilter);
    const mine = brandFiltered.filter((p) => isMine(p, activeTeammate));

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
        unscheduledIdeas.push({ post, stage: blockingStage(post) });
      }
    });

    const byDateTime = (a: Row, b: Row) =>
      (a.post.scheduledDate || '').localeCompare(b.post.scheduledDate || '') ||
      (a.post.scheduledTime || '').localeCompare(b.post.scheduledTime || '');

    late.sort(byDateTime);
    today.sort(byDateTime);
    thisWeek.sort(byDateTime);
    waitingOnMe.sort(byDateTime);
    unscheduledIdeas.sort((a, b) => a.post.title.localeCompare(b.post.title));

    return { late, today, thisWeek, waitingOnMe, unscheduledIdeas };
  }, [posts, activeTeammate, selectedBrandFilter]);

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

  const renderRow = ({ post, stage }: Row) => {
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
            handleToggle(post, stage);
          }}
          className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg font-label-caps text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
            isDone ? 'bg-[#296c00] text-white' : 'bg-[#ffddb0] text-[#935c00] hover:bg-[#ffcb80]'
          }`}
          title={`Click to mark ${stage} ${isDone ? 'not done' : 'done'}`}
        >
          <span>{STAGE_EMOJI[stage]}</span>
          <span>{STAGE_ACTION_LABEL[stage]}</span>
        </button>
      </div>
    );
  };

  const sections: { key: string; label: string; icon: string; emptyMessage: string; rows: Row[] }[] = [
    { key: 'late', label: 'Late', icon: 'error', emptyMessage: 'Nothing overdue. Nice work.', rows: late },
    { key: 'today', label: 'Today', icon: 'today', emptyMessage: 'Nothing due today.', rows: today },
    { key: 'week', label: 'This week', icon: 'date_range', emptyMessage: 'Nothing else due this week.', rows: thisWeek },
    { key: 'waiting', label: 'Waiting on me', icon: 'hourglass_empty', emptyMessage: 'No stages waiting on you.', rows: waitingOnMe },
    {
      key: 'ideas',
      label: 'Unscheduled ideas that are mine',
      icon: 'lightbulb',
      emptyMessage: 'No unscheduled ideas assigned to you.',
      rows: unscheduledIdeas,
    },
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

      {sections.map((section) => (
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
            <div className="divide-y divide-[#f0eee6]">{section.rows.map(renderRow)}</div>
          )}
        </div>
      ))}
    </div>
  );
};
