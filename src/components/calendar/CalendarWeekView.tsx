import React from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { STATUS_CONFIG } from '../../utils/statusConfig';
import { toDateStr, todayStr } from '../../utils/date';
import { PostCard } from './PostCard';

function getPostStatusConfig(post: Post) {
  const isOverdue =
    post.scheduledDate &&
    post.scheduledDate < todayStr() &&
    (post.status === 'not-started' || post.status === 'in-progress');
  return isOverdue ? STATUS_CONFIG['overdue'] : STATUS_CONFIG[post.status] || STATUS_CONFIG['not-started'];
}

interface CalendarWeekViewProps {
  weekStart: Date;
  setWeekStart: (updater: (prev: Date) => Date) => void;
  postsByDate: Record<string, any[]>;
  todayIso: string;
  touchHoverDate: string | null;
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  isMobileDevice: boolean;
  clearCaptionsOnDuplicate: boolean;
  onSetClearCaptionsOnDuplicate: (val: boolean) => void;
  onDuplicateWeekForward: () => void;
  onDropOnCell: (e: React.DragEvent, dateStr: string) => void;
  onSelectPost: (post: Post) => void;
  onOpenNewPostModal: (date?: string) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  teamMembers: TeamMember[];
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  weekStart,
  setWeekStart,
  postsByDate,
  todayIso,
  touchHoverDate,
  selectedPostIds,
  isSelectMode,
  isMobileDevice,
  clearCaptionsOnDuplicate,
  onSetClearCaptionsOnDuplicate,
  onDuplicateWeekForward,
  onDropOnCell,
  onSelectPost,
  onOpenNewPostModal,
  onToggleSelect,
  teamMembers
}) => {
  return (
    <div className="bg-white border border-[#bfcab4] p-3 sm:p-4 shadow-xs rounded-sm">
      {/* Week Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
          Week of {weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1 bg-[#faf9f5] border border-[#bfcab4] rounded p-1">
          <button
            onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; })}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-[#efeeea] rounded"
            title="Previous week"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const day = today.getDay();
              const diff = (day === 0 ? -6 : 1 - day);
              const monday = new Date(today);
              monday.setDate(today.getDate() + diff);
              setWeekStart(() => monday);
            }}
            className="px-2.5 py-1.5 min-h-[36px] font-label-caps text-xs font-bold text-[#296c00] hover:bg-[#efeeea] rounded"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-[#efeeea] rounded"
            title="Next week"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 text-[10px] font-label-caps text-[#707a67] cursor-pointer">
            <input
              type="checkbox"
              checked={clearCaptionsOnDuplicate}
              onChange={(e) => onSetClearCaptionsOnDuplicate(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Clear captions
          </label>
          <button
            onClick={onDuplicateWeekForward}
            className="flex items-center gap-1.5 bg-[#efeeea] border border-[#bfcab4] text-[#296c00] hover:bg-[#296c00] hover:text-white transition-colors font-label-caps text-xs font-bold px-3 py-1.5 rounded min-h-[36px]"
            title="Copy this week's posts to next week"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            <span className="hidden sm:inline">Duplicate week forward</span>
            <span className="sm:hidden">Duplicate</span>
          </button>
        </div>
      </div>

      {/* 7-Day Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          const dateStr = toDateStr(dayDate);
          const dayPosts = postsByDate[dateStr] || [];
          const isToday = dateStr === todayIso;

          return (
            <div
              key={i}
              data-date-cell={dateStr}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                onDropOnCell(e, dateStr);
              }}
              className={`p-3 border rounded min-h-[160px] sm:min-h-[220px] transition-all ${
                isToday ? 'bg-white border-[#296c00] ring-1 ring-[#296c00]/30' : 'bg-[#faf9f5] border-[#bfcab4]'
              } ${touchHoverDate === dateStr ? 'ring-2 ring-[#296c00] bg-[#f0fae8]' : ''}`}
            >
              {/* Day Label + New Post Button */}
              <div className="pb-2 mb-2 border-b border-[#bfcab4] flex justify-between items-center">
                <span className={`font-label-caps text-xs font-bold ${isToday ? 'text-[#296c00]' : 'text-[#1b1c1a]'}`}>
                  {dayDate.toLocaleDateString('default', { weekday: 'short' })} {dayDate.getDate()}
                </span>
                <button
                  onClick={() => onOpenNewPostModal(dateStr)}
                  className="text-[#296c00] hover:bg-[#aceecf] p-1 rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>

              {/* Post Cards */}
              <div className="space-y-2">
                {dayPosts.map((post: Post) => {
                  const brand = BRANDS[post.brandId];
                  const isWeekSelected = selectedPostIds.has(post.id);
                  const statusCfg = getPostStatusConfig(post);
                  const primaryAssignee = post.assignees[0] || '';
                  const assigneeMember = teamMembers.find((m) => m.name === primaryAssignee);
                  const initials = assigneeMember
                    ? assigneeMember.avatarInitials
                    : primaryAssignee.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                  const bgColor = assigneeMember ? assigneeMember.color : '#bfcab4';

                  return (
                    <div
                      key={post.id}
                      draggable={!isMobileDevice}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', post.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => {
                        if (isSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                          onToggleSelect(post.id, e);
                        } else {
                          onSelectPost(post);
                        }
                      }}
                      style={{ borderLeftColor: statusCfg.color }}
                      className={`p-2 border border-l-4 shadow-xs rounded cursor-pointer hover:border-[#296c00] hover:shadow-md transition-all active:scale-[0.98] ${
                        isWeekSelected ? 'bg-[#f0fae8] ring-2 ring-[#296c00] border-[#296c00]' : 'bg-white border-[#bfcab4]'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        {(isSelectMode || selectedPostIds.size > 0) && (
                          <input
                            type="checkbox"
                            checked={isWeekSelected}
                            onChange={() => onToggleSelect(post.id, {} as any)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 text-[#296c00] border-[#bfcab4] rounded flex-shrink-0"
                          />
                        )}
                        <span className="font-label-caps text-[9px] font-bold text-[#296c00] uppercase truncate">
                          {brand?.shortCode || post.brandId}
                        </span>
                      </div>
                      <h4 className="font-headline-md text-xs font-bold text-[#1b1c1a] line-clamp-2">
                        {post.title}
                      </h4>
                      {/* Task Role Badges */}
                      {post.taskRoles &&
                        (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
                          <div className="flex flex-wrap gap-0.5 mt-1 text-[8px] font-label-caps">
                            {post.taskRoles.designer && (
                              <span
                                className={`px-1 py-0.5 rounded ${
                                  post.stageCompletion?.designDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                🎨 {post.taskRoles.designer}
                              </span>
                            )}
                            {post.taskRoles.publisher && (
                              <span
                                className={`px-1 py-0.5 rounded ${
                                  post.stageCompletion?.publishDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                🚀 {post.taskRoles.publisher}
                              </span>
                            )}
                            {post.taskRoles.engagementLead && (
                              <span
                                className={`px-1 py-0.5 rounded ${
                                  post.stageCompletion?.engagementDone ? 'bg-[#296c00] text-white' : 'bg-[#efeeea] text-[#404a39]'
                                }`}
                              >
                                💬 {post.taskRoles.engagementLead}
                              </span>
                            )}
                          </div>
                        )}
                      <div className="flex justify-between items-center mt-2 text-[10px] font-code-sm text-[#707a67] gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          {post.assignees[0] && (
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white font-label-caps text-[7px] font-bold flex-shrink-0"
                              style={{ backgroundColor: bgColor }}
                              title={`Assigned to: ${post.assignees.join(', ')}`}
                            >
                              {initials}
                            </div>
                          )}
                          <span
                            className="font-label-caps text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5"
                            style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                          >
                            {statusCfg.icon && (
                              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>
                                {statusCfg.icon}
                              </span>
                            )}
                            {statusCfg.label}
                          </span>
                        </div>
                        <span>{post.scheduledTime}</span>
                      </div>
                    </div>
                  );
                })}
                {dayPosts.length > 3 && (
                  <button
                    className="w-full text-center py-1 bg-[#efeeea] hover:bg-[#e0dfdb] text-[#404a39] font-label-caps text-[9px] font-bold rounded-xs transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewPostModal(dateStr);
                    }}
                  >
                    +{dayPosts.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
