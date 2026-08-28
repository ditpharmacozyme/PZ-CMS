import React, { useRef, useState } from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { getPostStatusConfig } from '../../utils/statusConfig';
import { toggleStage, Stage } from '../../utils/stages';
import { StatusChip } from '../ui/StatusChip';
import { AssigneePopover } from '../AssigneePopover';

const PLATFORM_ICONS: Record<string, string> = {
  instagram: 'photo_camera',
  linkedin: 'work',
  twitter: 'tag',
  web: 'language',
  email: 'mail'
};

interface PostCardProps {
  post: Post;
  isSelected?: boolean;
  isSelectMode?: boolean;
  isMobileDevice?: boolean;
  onSelectPost: (post: Post, e: React.MouseEvent) => void;
  onToggleSelect?: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  onPlaceholderClick?: (post: Post) => void;
  onQuickUpdatePost?: (updatedPost: Post) => void;
  /** Name of the person currently using the app, for *DoneBy attribution on quick toggles. */
  currentUserName?: string;
  variant?: 'month' | 'week' | 'list' | 'mobile-list';
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onLongPress?: (postId: string) => void;
  /** For the assignee badge's inline AssigneePopover -- tapping it sets
   * assignees[] and taskRoles without opening the full post detail modal. */
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isSelected = false,
  isSelectMode = false,
  isMobileDevice = false,
  onSelectPost,
  onToggleSelect,
  onPlaceholderClick,
  onQuickUpdatePost,
  currentUserName,
  variant = 'month',
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onLongPress,
  teamMembers = [],
  activeTeammate = null
}) => {
  const brand = BRANDS[post.brandId];
  const statusCfg = getPostStatusConfig(post);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assigneeTriggerRef = useRef<HTMLButtonElement>(null);
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (onTouchStart) onTouchStart(e);
    if (onLongPress && isMobileDevice && !isSelectMode) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress(post.id);
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (onTouchMove) onTouchMove(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (onTouchEnd) onTouchEnd(e);
  };

  // 1-Click Quick Stage Toggle (🎨 / 🚀 / 💬). Status is no longer set
  // directly here -- it derives from stages (see utils/postStatus.ts), so
  // there's exactly one thing to click, not two that can disagree.
  const handleQuickStageToggle = (stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onQuickUpdatePost) return;
    onQuickUpdatePost(toggleStage(post, stage, currentUserName || 'Someone'));
  };

  // Render placeholder ghost card. The underlying post.title still carries a
  // " (Slot)" suffix internally (CalendarView.tsx uses it to strip back to the
  // series title on materialize) -- only the visible copy changes here, not
  // that data.
  if ((post as any).isPlaceholder) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (onPlaceholderClick) onPlaceholderClick(post);
        }}
        style={{ borderLeftColor: brand?.primaryColor || '#e9e9e7' }}
        className="p-1.5 bg-[#f4f4f3] border border-dashed border-[#e9e9e7] border-l-3 hover:border-[#4f46e5] hover:bg-[#eef2ff] transition-all rounded-md text-left opacity-70 hover:opacity-100 cursor-pointer group"
        title="Repeating slot — click to create"
      >
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-[#5f5f5b] group-hover:text-[#4f46e5]">
            replay
          </span>
          <p className="text-[10px] font-medium text-[#5f5f5b] group-hover:text-[#1b1c1a] truncate leading-tight">
            Repeating slot — click to create
          </p>
        </div>
      </div>
    );
  }

  const initials = post.assignees.length > 0
    ? post.assignees[0].split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const extraAssignees = Math.max(0, post.assignees.length - 1);
  const platformIcon = PLATFORM_ICONS[post.platform] || 'tag';

  if (variant === 'mobile-list') {
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (isSelectMode && onToggleSelect) {
            onToggleSelect(post.id, e);
          } else {
            onSelectPost(post, e);
          }
        }}
        style={{ borderLeftColor: brand?.primaryColor || statusCfg.color }}
        className={`p-3 bg-white border border-[#efefed] border-l-4 rounded-lg shadow-2xs flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer relative ${
          isSelected ? 'bg-[#eef2ff] ring-2 ring-[#4f46e5] border-[#4f46e5]' : 'hover:border-[#e9e9e7]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {(isSelectMode || isSelected) && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect && onToggleSelect(post.id, e)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5]"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white font-label-caps"
                style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
              >
                {brand?.shortCode || post.brandId}
              </span>
              <span className="text-[10px] text-[#5f5f5b] font-medium flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">{platformIcon}</span>
                <span>{post.scheduledTime || '10:00'}</span>
              </span>

              {/* 1-Click Status Chip */}
              {/* Status is derived from the stages below, not clickable here. */}
              <StatusChip post={post} variant="pill" title="Updates automatically as design/publish are checked below" />
            </div>

            <h4 className="font-semibold text-xs text-[#1b1c1a] line-clamp-1">{post.title}</h4>

            {/* Quick Interactive Task Roles */}
            {post.taskRoles && (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
              <div className="flex flex-wrap gap-1 mt-1 text-[9px]">
                {post.taskRoles.designer && (
                  <button
                    type="button"
                    onClick={(e) => handleQuickStageToggle('design', e)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      post.stageCompletion?.designDone
                        ? 'bg-[#15803d] text-white font-bold'
                        : 'bg-[#f1f1f0] text-[#57574f] hover:bg-[#e9e9e7]'
                    }`}
                    title={`Design: ${post.taskRoles.designer} (Click to toggle complete)`}
                  >
                    🎨 {post.taskRoles.designer} {post.stageCompletion?.designDone ? '✓' : ''}
                  </button>
                )}
                {post.taskRoles.publisher && (
                  <button
                    type="button"
                    onClick={(e) => handleQuickStageToggle('publish', e)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      post.stageCompletion?.publishDone
                        ? 'bg-[#15803d] text-white font-bold'
                        : 'bg-[#f1f1f0] text-[#57574f] hover:bg-[#e9e9e7]'
                    }`}
                    title={`Publisher: ${post.taskRoles.publisher} (Click to toggle complete)`}
                  >
                    🚀 {post.taskRoles.publisher} {post.stageCompletion?.publishDone ? '✓' : ''}
                  </button>
                )}
                {post.taskRoles.engagementLead && (
                  <button
                    type="button"
                    onClick={(e) => handleQuickStageToggle('engagement', e)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      post.stageCompletion?.engagementDone
                        ? 'bg-[#15803d] text-white font-bold'
                        : 'bg-[#f1f1f0] text-[#57574f] hover:bg-[#e9e9e7]'
                    }`}
                    title={`Lead: ${post.taskRoles.engagementLead} (Click to toggle complete)`}
                  >
                    💬 {post.taskRoles.engagementLead} {post.stageCompletion?.engagementDone ? '✓' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          ref={assigneeTriggerRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsAssigneePopoverOpen((v) => !v); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-[#4f46e5] hover:ring-offset-1 transition-all"
          style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
          title={`Assigned to: ${post.assignees.join(', ') || 'nobody'} (tap to change)`}
        >
          {initials}
        </button>
        <AssigneePopover
          post={post}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
          isOpen={isAssigneePopoverOpen}
          onClose={() => setIsAssigneePopoverOpen(false)}
          anchorRef={assigneeTriggerRef}
          onSavePost={onQuickUpdatePost || (() => {})}
        />
      </div>
    );
  }

  // ── Month / Week Default Compact Chip View ──
  return (
    <>
    <div
      draggable={!isMobileDevice}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', post.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (isSelectMode || e.ctrlKey || e.metaKey) {
          if (onToggleSelect) onToggleSelect(post.id, e);
        } else {
          onSelectPost(post, e);
        }
      }}
      className={`p-1.5 border rounded-lg shadow-2xs transition-all text-left cursor-pointer group select-none relative ${
        isSelected
          ? 'ring-2 ring-[#4f46e5] border-[#4f46e5] bg-[#eef2ff]'
          : 'bg-white border-[#e9e9e7] hover:border-[#d8d8d5] hover:bg-[#fbfbfa]'
      }`}
    >
      {/* Row 1: Checkbox/Brand code + Status pill */}
      <div className="flex items-center gap-1">
        {(isSelectMode || isSelected) && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect && onToggleSelect(post.id, e as any)}
            onClick={(e) => e.stopPropagation()}
            className="w-3 h-3 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5] cursor-pointer"
          />
        )}
        <span
          className="text-[8px] font-bold rounded px-1 shrink-0 whitespace-nowrap text-white font-label-caps leading-none"
          style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
        >
          {brand?.shortCode || post.brandId}
        </span>
        {/* Status is derived from the stage toggles below, not clickable here. */}
        <StatusChip post={post} variant="pill" className="ml-auto" title="Updates automatically as stages are checked" />
      </div>

      {/* Row 2: Post Title */}
      <p className="font-medium text-[11px] text-[#1b1c1a] line-clamp-2 leading-snug mt-0.5">
        {post.title}
      </p>

      {/* Row 3 (footer): platform icon + time + Quick Stage Toggles + Assignee */}
      <div className="mt-1 pt-0.5 border-t border-[#efefed] flex items-center gap-1 text-[8px] text-[#5f5f5b]">
        <span className="material-symbols-outlined text-[10px] text-[#5f5f5b]">
          {platformIcon}
        </span>
        <span className="font-code-sm">{post.scheduledTime || '10:00'}</span>

        {/* Assignee initials badge & Quick Stage Toggles */}
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
          {post.taskRoles?.designer && (
            <button
              type="button"
              onClick={(e) => handleQuickStageToggle('design', e)}
              className={`text-[8px] p-0.5 rounded cursor-pointer ${post.stageCompletion?.designDone ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
              title={`Designer: ${post.taskRoles.designer} (Click to toggle)`}
            >
              🎨
            </button>
          )}
          {post.taskRoles?.publisher && (
            <button
              type="button"
              onClick={(e) => handleQuickStageToggle('publish', e)}
              className={`text-[8px] p-0.5 rounded cursor-pointer ${post.stageCompletion?.publishDone ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
              title={`Publisher: ${post.taskRoles.publisher} (Click to toggle)`}
            >
              🚀
            </button>
          )}
          {post.taskRoles?.engagementLead && (
            <button
              type="button"
              onClick={(e) => handleQuickStageToggle('engagement', e)}
              className={`text-[8px] p-0.5 rounded cursor-pointer ${post.stageCompletion?.engagementDone ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
              title={`Engagement: ${post.taskRoles.engagementLead} (Click to toggle)`}
            >
              💬
            </button>
          )}
          <button
            ref={assigneeTriggerRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsAssigneePopoverOpen((v) => !v); }}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-bold text-[7px] cursor-pointer hover:ring-1 hover:ring-[#4f46e5] hover:ring-offset-1 transition-all"
            style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
            title={`Assigned to: ${post.assignees.join(', ') || 'nobody'} (tap to change)`}
          >
            {initials}
          </button>
          {extraAssignees > 0 && <span className="text-[7px] font-bold text-[#5f5f5b]">+{extraAssignees}</span>}
        </div>
      </div>
    </div>
    <AssigneePopover
      post={post}
      teamMembers={teamMembers}
      activeTeammate={activeTeammate}
      isOpen={isAssigneePopoverOpen}
      onClose={() => setIsAssigneePopoverOpen(false)}
      anchorRef={assigneeTriggerRef}
      onSavePost={onQuickUpdatePost || (() => {})}
    />
    </>
  );
};
