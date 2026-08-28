import React, { useMemo, useState } from 'react';
import { Post, TeamMember } from '../types';
import { toDateStr, todayStr } from '../utils/date';
import { getRecentActivity } from '../utils/activity';
import { deriveStatus } from '../utils/postStatus';
import { isMine } from '../utils/postOwnership';
import { useConfirm } from './ui/ConfirmDialog';

interface MissionControlDashboardProps {
  posts: Post[];
  teamMembers: TeamMember[];
  onOpenNewPostModal: () => void;
  onSelectPost?: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  activeTeammate?: TeamMember | null;
}

export const MissionControlDashboard: React.FC<MissionControlDashboardProps> = ({
  posts,
  teamMembers,
  onOpenNewPostModal,
  onSelectPost,
  onDeletePost,
  activeTeammate = null
}) => {
  const confirm = useConfirm();
  const [selectedTeammateName, setSelectedTeammateName] = useState<string | null>(null);

  const selectedTeammate = useMemo(
    () => teamMembers.find((m) => m.name === selectedTeammateName) || null,
    [teamMembers, selectedTeammateName]
  );

  const filteredPosts = useMemo(() => {
    if (!selectedTeammate) return posts;
    return posts.filter(p => isMine(p, selectedTeammate));
  }, [posts, selectedTeammate]);

  const readyToPostCount = filteredPosts.filter((p) => deriveStatus(p) === 'ready-to-post').length;
  const inProgressCount = filteredPosts.filter((p) => deriveStatus(p) === 'in-progress').length;
  const postedCount = filteredPosts.filter((p) => deriveStatus(p) === 'posted').length;
  const backlogCount = filteredPosts.filter((p) => !p.scheduledDate).length;

  // Team performance: count posts assigned to each person (assignees or taskRoles -- see isMine)
  const teamStats = teamMembers.map(member => {
    const assigned = posts.filter(p => isMine(p, member));
    const posted = assigned.filter(p => deriveStatus(p) === 'posted').length;
    const ready = assigned.filter(p => deriveStatus(p) === 'ready-to-post').length;
    const inProg = assigned.filter(p => deriveStatus(p) === 'in-progress').length;
    return { member, total: assigned.length, posted, ready, inProg };
  }).sort((a, b) => b.total - a.total);

  // Next 5 upcoming reminders, soonest first -- was raw array order over ALL
  // filtered posts (including past ones), so "Upcoming Posts" could show
  // stale, already-past reminders ahead of ones actually coming up.
  const upcomingPosts = useMemo(() => {
    const todayIso = todayStr();
    return filteredPosts
      .filter((p) => p.scheduledDate && p.scheduledDate >= todayIso)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
      .slice(0, 5);
  }, [filteredPosts]);

  // Real 14-day view: how many posts land on each of the next 14 days.
  const upcomingDays = useMemo(() => {
    const days: { dateStr: string; label: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = toDateStr(d);
      days.push({
        dateStr,
        label: d.toLocaleDateString('default', { weekday: 'short' }),
        count: filteredPosts.filter((p) => p.scheduledDate === dateStr).length
      });
    }
    return days;
  }, [filteredPosts]);
  const maxDayCount = Math.max(1, ...upcomingDays.map((d) => d.count));

  const recentActivity = useMemo(() => {
    const act = getRecentActivity(posts, 50);
    if (!selectedTeammateName) return act.slice(0, 15);
    return act.filter(entry => entry.actor === selectedTeammateName).slice(0, 15);
  }, [posts, selectedTeammateName]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e9e9e7]">
        <div>
          <span className="font-label-caps text-xs text-[#4338ca] uppercase font-bold tracking-widest">
            Overview
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Team Dashboard
          </h2>
          <p className="font-body-md text-sm text-[#5f5f5b] mt-1">
            We post manually on Instagram — this is your reminder-based workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTeammate && (
            <button
              type="button"
              onClick={() => setSelectedTeammateName(selectedTeammateName === activeTeammate.name ? null : activeTeammate.name)}
              className={`px-3 py-2.5 rounded text-xs font-label-caps font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                selectedTeammateName === activeTeammate.name
                  ? 'bg-[#4f46e5] text-white shadow-xs'
                  : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
              }`}
              title="Filter dashboard stats to your own posts"
            >
              <span className="material-symbols-outlined text-sm">person</span>
              <span>My Posts</span>
            </button>
          )}
          <button
            onClick={onOpenNewPostModal}
            className="bg-[#4f46e5] text-white font-label-caps text-xs px-4 py-2.5 rounded shadow-sm hover:bg-[#4338ca] transition-all flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-sm">add_task</span>
            <span>New Post</span>
          </button>
        </div>
      </div>

      {selectedTeammateName && (
        <div className="p-3 bg-[#eef2ff] border border-[#4f46e5]/30 rounded flex items-center justify-between text-xs font-body-md text-[#4f46e5] shadow-2xs drawer-slide-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">filter_list</span>
            <span>Showing dashboard statistics and workload for <strong className="font-bold underline">{selectedTeammateName}</strong> only.</span>
          </div>
          <button
            onClick={() => setSelectedTeammateName(null)}
            className="font-label-caps text-[9px] px-2.5 py-1 rounded bg-[#4f46e5] text-white hover:bg-[#4338ca] transition-colors font-bold uppercase"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-[#e9e9e7] rounded shadow-xs space-y-2">
          <span className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">Posted</span>
          <div className="font-display-xl text-3xl font-bold text-[#15803d]">{postedCount}</div>
          <p className="font-code-sm text-[10px] text-[#15803d]">Published to Instagram</p>
        </div>

        <div className="p-5 bg-white border border-[#e9e9e7] rounded shadow-xs space-y-2">
          <span className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">Ready to Post</span>
          <div className="font-display-xl text-3xl font-bold text-[#1b1c1a]">{readyToPostCount}</div>
          <p className="font-code-sm text-[10px] text-[#5f5f5b]">Reminder Set</p>
        </div>

        <div className="p-5 bg-white border border-[#e9e9e7] rounded shadow-xs space-y-2">
          <span className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">In Progress</span>
          <div className="font-display-xl text-3xl font-bold text-[#c77a00]">{inProgressCount}</div>
          <p className="font-code-sm text-[10px] text-[#c77a00]">Being worked on</p>
        </div>

        <div className="p-5 bg-white border border-[#e9e9e7] rounded shadow-xs space-y-2">
          <span className="font-label-caps text-[10px] text-[#5f5f5b] uppercase font-bold block">Ideas</span>
          <div className="font-display-xl text-3xl font-bold text-[#5a38f0]">{backlogCount}</div>
          <p className="font-code-sm text-[10px] text-[#5a38f0]">No date set yet</p>
        </div>
      </div>

      {/* Two-column: activity chart + upcoming posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next 14 days at a glance */}
        <div className="lg:col-span-2 bg-white border border-[#e9e9e7] p-6 rounded shadow-xs space-y-4">
          <h3 className="font-label-caps text-xs font-bold text-[#4f46e5] uppercase">Posts over the next 14 days</h3>

          <div className="h-44 bg-[#f4f4f3] border border-[#e9e9e7] rounded p-4 flex flex-col justify-between">
            {upcomingDays.every((d) => d.count === 0) ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-xs font-body-md text-[#5f5f5b]">Nothing scheduled in the next two weeks yet.</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-24 flex-1">
                {upcomingDays.map((day) => (
                  <div
                    key={day.dateStr}
                    style={{ height: `${Math.max(6, (day.count / maxDayCount) * 100)}%` }}
                    className="flex-1 bg-[#4f46e5] rounded-xs hover:bg-[#4338ca] transition-colors"
                    title={`${day.count} post${day.count === 1 ? '' : 's'} on ${day.dateStr}`}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-between items-center font-code-sm text-[10px] text-[#5f5f5b]">
              <span>{upcomingDays[0]?.label}</span>
              <span>{upcomingDays[7]?.label}</span>
              <span>{upcomingDays[13]?.label}</span>
            </div>
          </div>
        </div>

        {/* Upcoming posts / reminders */}
        <div className="bg-white border border-[#e9e9e7] p-6 rounded shadow-xs space-y-4">
          <h3 className="font-label-caps text-xs font-bold text-[#4f46e5] uppercase">
            Upcoming Posts
          </h3>

          <div className="space-y-3">
            {upcomingPosts.length === 0 ? (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-[#e9e9e7] block mb-2">notifications_none</span>
                <p className="font-label-caps text-[10px] text-[#5f5f5b] uppercase">No posts yet</p>
                <p className="font-body-md text-xs text-[#5f5f5b] mt-1">No upcoming posts found matching filters.</p>
              </div>
            ) : (
              upcomingPosts.map((post) => (
                <div key={post.id} className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded text-xs space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-label-caps font-bold text-[#4f46e5] truncate max-w-[140px]">
                      {post.title}
                    </span>
                    {(post.scheduledDate || post.scheduledTime) ? (
                      <span className="flex-shrink-0 font-label-caps text-[9px] px-1.5 py-0.5 bg-[#f1f1f0] border border-[#e9e9e7] text-[#5f5f5b] rounded uppercase">
                        ⏰ {post.scheduledDate}{post.scheduledTime ? ` ${post.scheduledTime}` : ''}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 font-label-caps text-[9px] px-1.5 py-0.5 bg-[#f4f4f3] border border-[#e9e9e7] text-[#e9e9e7] rounded uppercase">
                        No Reminder
                      </span>
                    )}
                  </div>
                  {post.reminderEmail && (
                    <div className="flex items-center gap-1 font-code-sm text-[10px] text-[#5f5f5b]">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>mail</span>
                      <span className="truncate">{post.reminderEmail}</span>
                    </div>
                  )}
                  <p className="font-body-md text-[#57574f] line-clamp-1">{post.caption}</p>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#e9e9e7]/40">
                    {onSelectPost && (
                      <button
                        onClick={() => onSelectPost(post)}
                        className="font-label-caps text-[10px] text-[#4f46e5] font-bold hover:underline px-2 py-0.5 bg-[#f1f1f0] rounded"
                      >
                        Edit ✏️
                      </button>
                    )}
                    {onDeletePost && (
                      <button
                        onClick={async () => {
                          if (await confirm({ title: `Delete "${post.title}"?`, confirmLabel: 'Delete', tone: 'danger' })) {
                            onDeletePost(post.id);
                          }
                        }}
                        className="font-label-caps text-[10px] text-[#dc2626] font-bold hover:underline px-2 py-0.5 bg-[#fcebeb] rounded"
                      >
                        Delete 🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity — a shared feed pulled from each post's own log, not a separate audit system */}
      <div className="bg-white border border-[#e9e9e7] rounded shadow-xs">
        <div className="p-5 border-b border-[#e9e9e7]">
          <h3 className="font-label-caps text-xs font-bold text-[#4f46e5] uppercase">Recent Activity</h3>
          <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">Status changes, reschedules, and stage completions across the team</p>
        </div>

        {recentActivity.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-[#e9e9e7] block mb-2">history</span>
            <p className="font-label-caps text-[10px] text-[#5f5f5b] uppercase">Nothing yet</p>
            <p className="font-body-md text-xs text-[#5f5f5b] mt-1">No recent activity matching filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e9e9e7] max-h-80 overflow-y-auto">
            {recentActivity.map((entry) => {
              const actorMember = teamMembers.find(m => m.name === entry.actor);
              const initials = actorMember ? actorMember.avatarInitials : entry.actor.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const bgColor = actorMember ? actorMember.color : '#e9e9e7';
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    const post = posts.find((p) => p.id === entry.postId);
                    if (post && onSelectPost) onSelectPost(post);
                  }}
                  className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-[#f4f4f3] transition-colors border-b border-[#e9e9e7]/20 last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-label-caps text-[10px] font-bold flex-shrink-0"
                      style={{ background: bgColor }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-body-md text-[#1b1c1a] leading-tight">
                        <strong className="text-[#4f46e5]">{entry.actor}</strong> {entry.action}
                      </p>
                      <p className="font-label-caps text-[9px] text-[#5f5f5b] truncate mt-1">{entry.postTitle}</p>
                    </div>
                  </div>
                  <span className="font-code-sm text-[10px] text-[#5f5f5b] flex-shrink-0">{entry.timestamp}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Performance Section */}
      <div className="bg-white border border-[#e9e9e7] rounded shadow-xs">
        <div className="p-5 border-b border-[#e9e9e7] flex items-center justify-between">
          <div>
            <h3 className="font-label-caps text-xs font-bold text-[#4f46e5] uppercase">Who Did the Most Work</h3>
            <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">Posts assigned and completed per team member</p>
          </div>
          <span className="material-symbols-outlined text-[#4f46e5]">leaderboard</span>
        </div>

        {teamMembers.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-[#e9e9e7] block mb-2">group</span>
            <p className="font-label-caps text-[10px] text-[#5f5f5b] uppercase">No team members added yet</p>
            <p className="font-body-md text-xs text-[#5f5f5b] mt-1">Go to Settings → Team to add your team.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e9e9e7]">
            {teamStats.map(({ member, total, posted, ready, inProg }, idx) => {
              const isSelected = selectedTeammateName === member.name;
              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedTeammateName(isSelected ? null : member.name)}
                  className={`p-4 flex items-center gap-4 cursor-pointer transition-all ${
                    isSelected ? 'bg-[#eef2ff] hover:bg-[#e0e7ff] border-l-4 border-[#4f46e5]' : 'hover:bg-[#f4f4f3]'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 text-center font-label-caps text-xs text-[#5f5f5b] font-bold flex-shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-label-caps text-xs font-bold flex-shrink-0"
                    style={{ background: member.color }}
                  >
                    {member.avatarInitials}
                  </div>

                  {/* Name & role */}
                  <div className="flex-1 min-w-0">
                    <p className="font-body-md text-sm font-bold text-[#1b1c1a] truncate flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {isSelected && <span className="bg-[#4f46e5] text-white px-1.5 py-0.2 rounded font-bold uppercase text-[8px] font-label-caps">Filter On</span>}
                    </p>
                    <p className="font-label-caps text-[9px] text-[#5f5f5b] uppercase">{member.role}</p>
                  </div>

                  {/* Mini stat badges */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center px-1">
                      <div className="font-display-xl text-base font-bold text-[#1b1c1a]">{total}</div>
                      <div className="font-label-caps text-[8px] text-[#5f5f5b] uppercase">Assigned</div>
                    </div>
                    <div className="text-center px-1">
                      <div className="font-display-xl text-base font-bold text-[#15803d]">{posted}</div>
                      <div className="font-label-caps text-[8px] text-[#5f5f5b] uppercase">Posted</div>
                    </div>
                    <div className="text-center px-1 hidden sm:block">
                      <div className="font-display-xl text-base font-bold text-[#c77a00]">{inProg}</div>
                      <div className="font-label-caps text-[8px] text-[#5f5f5b] uppercase">Active</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {total > 0 && (
                    <div className="w-20 hidden md:block">
                      <div className="h-2 bg-[#f1f1f0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#15803d] rounded-full transition-all"
                          style={{ width: `${Math.round((posted / total) * 100)}%` }}
                        />
                      </div>
                      <p className="font-label-caps text-[9px] text-[#5f5f5b] mt-0.5 text-center">
                        {total > 0 ? Math.round((posted / total) * 100) : 0}% done
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned posts */}
            {(() => {
              const knownNames = teamMembers.map(m => m.name);
              const unassignedCount = posts.filter(p => p.assignees.length === 0 || !p.assignees.some(a => knownNames.includes(a))).length;
              return unassignedCount > 0 ? (
                <div className="p-4 flex items-center gap-4">
                  <div className="w-6 flex-shrink-0" />
                  <div className="w-10 h-10 rounded-full bg-[#f1f1f0] border border-[#e9e9e7] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#5f5f5b] text-lg">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body-md text-sm font-bold text-[#5f5f5b] truncate">Other / Unassigned</p>
                    <p className="font-label-caps text-[9px] text-[#e9e9e7] uppercase">Not in current team list</p>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="font-display-xl text-lg font-bold text-[#5f5f5b]">{unassignedCount}</div>
                    <div className="font-label-caps text-[9px] text-[#5f5f5b] uppercase">Total</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
