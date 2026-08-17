import React from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { STATUS_CONFIG } from '../../utils/statusConfig';
import { todayStr, fromDateStr } from '../../utils/date';

function getPostStatusConfig(post: Post) {
  const isOverdue =
    post.scheduledDate &&
    post.scheduledDate < todayStr() &&
    (post.status === 'not-started' || post.status === 'in-progress');
  return isOverdue ? STATUS_CONFIG['overdue'] : STATUS_CONFIG[post.status] || STATUS_CONFIG['not-started'];
}

interface CalendarCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

interface MobileDateStripViewProps {
  calendarCells: CalendarCell[];
  postsByDate: Record<string, any[]>;
  todayIso: string;
  selectedMobileDate: string;
  onSelectMobileDate: (dateStr: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  onSelectPost: (post: Post) => void;
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  onToggleSelect: (postId: string, e?: React.MouseEvent) => void;
  onLongPressPost: (postId: string) => void;
  teamMembers: TeamMember[];
}

export const MobileDateStripView: React.FC<MobileDateStripViewProps> = ({
  calendarCells,
  postsByDate,
  todayIso,
  selectedMobileDate,
  onSelectMobileDate,
  onOpenNewPostModal,
  onSelectPost,
  selectedPostIds,
  isSelectMode,
  onToggleSelect,
  onLongPressPost,
  teamMembers
}) => {
  return (
    <div className="md:hidden flex flex-col">
      {/* Horizontal Date Strip */}
      <div className="flex overflow-x-auto bg-[#efeeea] border-b border-[#bfcab4] p-2 gap-2 hide-scrollbar">
        {calendarCells
          .filter((cell) => cell.dateStr && cell.isCurrentMonth)
          .map((cell) => {
            const d = cell.dateStr ? fromDateStr(cell.dateStr) : null;
            const dayShort = d ? d.toLocaleDateString('default', { weekday: 'short' }) : '';
            const dayNum = d ? d.getDate() : '';
            const isSelected = cell.dateStr === selectedMobileDate;
            const isToday = cell.dateStr === todayIso;
            const dayPosts = cell.dateStr ? postsByDate[cell.dateStr] || [] : [];

            return (
              <button
                key={cell.dateStr}
                onClick={() => onSelectMobileDate(cell.dateStr!)}
                className={`flex flex-col items-center justify-center min-w-[3.5rem] py-2 rounded-lg transition-colors relative flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#296c00] text-white shadow-xs'
                    : isToday
                    ? 'bg-white border border-[#296c00] text-[#296c00]'
                    : 'bg-white border border-[#bfcab4] text-[#1b1c1a]'
                }`}
              >
                <span className="font-label-caps text-[9px] uppercase font-bold opacity-80">{dayShort}</span>
                <span className="font-headline-md text-base font-bold mt-0.5">{dayNum}</span>
                {dayPosts.length > 0 && (
                  <div
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-label-caps text-[8px] font-bold ${
                      isSelected ? 'bg-white text-[#296c00]' : 'bg-[#296c00] text-white'
                    }`}
                  >
                    {dayPosts.length}
                  </div>
                )}
              </button>
            );
          })}
      </div>

      {/* Selected Day Posts List */}
      <div className="p-3 sm:p-4 bg-[#faf9f5]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
            {fromDateStr(selectedMobileDate).toLocaleDateString('default', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
          <button
            onClick={() => onOpenNewPostModal(selectedMobileDate)}
            className="flex items-center gap-1 text-[#296c00] font-label-caps text-xs font-bold bg-[#f0fae8] px-3 py-1.5 rounded-full hover:bg-[#aceecf] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Post
          </button>
        </div>

        {(() => {
          const dayPosts = postsByDate[selectedMobileDate] || [];
          if (dayPosts.length === 0) {
            return (
              <div className="text-center py-10 text-[#707a67] bg-white border border-[#bfcab4] rounded-lg">
                <span className="material-symbols-outlined text-3xl mb-2 opacity-50">calendar_today</span>
                <p className="font-body-md text-sm">No posts scheduled</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {dayPosts.map((post: Post) => {
                const brand = BRANDS[post.brandId];
                const primaryAssignee = post.assignees[0] || '';
                const assigneeMember = teamMembers.find((m) => m.name === primaryAssignee);
                const initials = assigneeMember
                  ? assigneeMember.avatarInitials
                  : (primaryAssignee || '?')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                const bgColor = assigneeMember ? assigneeMember.color : '#bfcab4';
                const extraAssignees = post.assignees.length - 1;
                const isMobileSelected = selectedPostIds.has(post.id);
                const statusCfg = getPostStatusConfig(post);

                return (
                  <div
                    key={post.id}
                    onTouchStart={(e) => {
                      // Long-press handled in PostCard — we keep this here for
                      // compatibility with the existing timer approach in mobile cards.
                      const timer = setTimeout(() => {
                        onLongPressPost(post.id);
                      }, 500);
                      (e.currentTarget as any).dataset.longPressTimer = timer.toString();
                    }}
                    onTouchEnd={(e) => {
                      const timer = (e.currentTarget as any).dataset.longPressTimer;
                      if (timer) clearTimeout(parseInt(timer));
                    }}
                    onTouchMove={(e) => {
                      const timer = (e.currentTarget as any).dataset.longPressTimer;
                      if (timer) clearTimeout(parseInt(timer));
                    }}
                    onClick={(e) => {
                      if (isSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                        onToggleSelect(post.id, e);
                      } else {
                        onSelectPost(post);
                      }
                    }}
                    style={{ borderLeftColor: brand?.primaryColor }}
                    className={`flex items-start gap-3 p-3 border border-l-4 rounded-lg shadow-2xs active:scale-[0.98] transition-transform cursor-pointer ${
                      isMobileSelected ? 'bg-[#f0fae8] ring-2 ring-[#296c00] border-[#296c00]' : 'bg-white border-[#bfcab4]'
                    }`}
                  >
                    {(isSelectMode || selectedPostIds.size > 0) && (
                      <input
                        type="checkbox"
                        checked={isMobileSelected}
                        onChange={() => onToggleSelect(post.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 mt-1 text-[#296c00] border-[#bfcab4] rounded flex-shrink-0"
                      />
                    )}

                    {post.visualUrl && (
                      <div className="w-14 h-14 mt-0.5 rounded overflow-hidden border border-[#bfcab4] bg-[#faf9f5] flex-shrink-0">
                        <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="font-label-caps text-[9px] font-bold uppercase" style={{ color: brand?.primaryColor }}>
                        {brand?.name} • {post.scheduledTime}
                      </span>
                      <p className="font-headline-md text-sm font-bold text-[#1b1c1a] leading-tight mb-1">
                        {post.title}
                      </p>

                      {/* Status Badge */}
                      <span
                        className="font-label-caps text-[9px] font-bold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                      >
                        {statusCfg.icon && (
                          <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>
                            {statusCfg.icon}
                          </span>
                        )}
                        {statusCfg.label}
                      </span>

                      {/* Task Role Badges */}
                      {post.taskRoles &&
                        (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
                          <div className="flex flex-wrap gap-1 mt-2 text-[9px] font-label-caps">
                            {post.taskRoles.designer && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  post.stageCompletion?.designDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                🎨 {post.taskRoles.designer}
                              </span>
                            )}
                            {post.taskRoles.publisher && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  post.stageCompletion?.publishDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                🚀 {post.taskRoles.publisher}
                              </span>
                            )}
                            {post.taskRoles.engagementLead && (
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  post.stageCompletion?.engagementDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                💬 {post.taskRoles.engagementLead}
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    <div
                      className="relative w-8 h-8 rounded-full flex items-center justify-center text-white font-label-caps text-[10px] font-bold flex-shrink-0 shadow-xs"
                      style={{ backgroundColor: bgColor }}
                      title={post.assignees.join(', ')}
                    >
                      {initials}
                      {extraAssignees > 0 && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1b1c1a] text-white text-[8px] font-bold flex items-center justify-center border border-white">
                          +{extraAssignees}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
