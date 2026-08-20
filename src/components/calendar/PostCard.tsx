import React, { useRef } from 'react';
import { Post } from '../../types';
import { BRANDS } from '../../data/brands';
import { getPostStatusConfig } from '../../utils/statusConfig';
import { toggleStage, Stage } from '../../utils/stages';

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
  onLongPress
}) => {
  const brand = BRANDS[post.brandId];
  const statusCfg = getPostStatusConfig(post);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Render placeholder ghost card
  if ((post as any).isPlaceholder) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (onPlaceholderClick) onPlaceholderClick(post);
        }}
        style={{ borderLeftColor: brand?.primaryColor || '#bfcab4' }}
        className="p-1.5 bg-[#faf9f5] border border-dashed border-[#bfcab4] border-l-3 hover:border-[#296c00] hover:bg-[#f0fae8] transition-all rounded-md text-left opacity-70 hover:opacity-100 cursor-pointer group"
        title="Click to schedule this repeating slot"
      >
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-[#707a67] group-hover:text-[#296c00]">
            replay
          </span>
          <p className="text-[10px] font-medium text-[#707a67] group-hover:text-[#1b1c1a] truncate leading-tight">
            {post.title}
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
        className={`p-3 bg-white border border-[#e5e4de] border-l-4 rounded-lg shadow-2xs flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer relative ${
          isSelected ? 'bg-[#f0fae8] ring-2 ring-[#296c00] border-[#296c00]' : 'hover:border-[#bfcab4]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {(isSelectMode || isSelected) && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect && onToggleSelect(post.id, e)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00]"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white font-label-caps"
                style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
              >
                {brand?.shortCode || post.brandId}
              </span>
              <span className="text-[10px] text-[#707a67] font-medium flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">{platformIcon}</span>
                <span>{post.scheduledTime || '10:00'}</span>
              </span>

              {/* 1-Click Status Chip */}
              {/* Status is derived from the stages below, not clickable here. */}
              <span
                className="font-label-caps text-[8px] font-bold uppercase px-1.5 py-0.2 rounded"
                style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                title="Updates automatically as design/publish are checked below"
              >
                {statusCfg.label}
              </span>

              {post.approved && (
                <span className="text-[10px] text-[#296c00] font-bold">✓ Approved</span>
              )}
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
                        ? 'bg-[#296c00] text-white font-bold'
                        : 'bg-[#efeeea] text-[#404a39] hover:bg-[#e4e2db]'
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
                        ? 'bg-[#296c00] text-white font-bold'
                        : 'bg-[#efeeea] text-[#404a39] hover:bg-[#e4e2db]'
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
                        ? 'bg-[#296c00] text-white font-bold'
                        : 'bg-[#efeeea] text-[#404a39] hover:bg-[#e4e2db]'
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

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 shadow-xs"
          style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          title={post.assignees.join(', ')}
        >
          {initials}
        </div>
      </div>
    );
  }

  // ── Month / Week Default Compact Chip View ──
  return (
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
      style={{ borderLeftColor: brand?.primaryColor || '#296c00' }}
      className={`p-1.5 border border-l-3 rounded-md shadow-2xs hover:shadow-xs transition-all text-left cursor-pointer group select-none relative ${
        isSelected
          ? 'bg-[#f0fae8] ring-2 ring-[#296c00] border-[#296c00]'
          : 'bg-white border-[#e5e4de] hover:border-[#bfcab4] hover:bg-[#faf9f5]'
      }`}
    >
      {/* Top row: Checkbox/Brand code + Platform icon + Time */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className="flex items-center gap-1 min-w-0">
          {(isSelectMode || isSelected) && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect && onToggleSelect(post.id, e as any)}
              onClick={(e) => e.stopPropagation()}
              className="w-3 h-3 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00] cursor-pointer"
            />
          )}
          <span
            className="px-1 py-0.2 rounded text-[8px] font-bold text-white font-label-caps truncate leading-none"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          >
            {brand?.shortCode || post.brandId}
          </span>
          <span className="material-symbols-outlined text-[10px] text-[#707a67]">
            {platformIcon}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="font-code-sm text-[8px] text-[#707a67]">
            {post.scheduledTime || '10:00'}
          </span>
          {post.approved && (
            <span className="text-[9px] text-[#296c00] font-bold" title="Approved">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Post Title */}
      <p className="font-medium text-[10px] sm:text-[11px] text-[#1b1c1a] line-clamp-1 leading-snug tracking-tight">
        {post.title}
      </p>

      {/* Bottom row: Status (display only) + Quick Stage Toggles + Assignee */}
      <div className="flex items-center justify-between mt-1 pt-0.5 border-t border-[#f0eee6] text-[8px]">
        {/* Status is derived from the stage toggles on the right, not clickable here. */}
        <div className="flex items-center gap-1 min-w-0 px-1 py-0.2" title="Updates automatically as stages are checked">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusCfg.color }}
          />
          <span className="truncate font-medium text-[8px] text-[#707a67]">
            {statusCfg.label}
          </span>
        </div>

        {/* Assignee initials badge & Quick Stage Toggles */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
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
          <span
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-bold text-[7px]"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
            title={`Assigned to: ${post.assignees.join(', ')}`}
          >
            {initials}
          </span>
          {extraAssignees > 0 && <span className="text-[7px] font-bold text-[#707a67]">+{extraAssignees}</span>}
        </div>
      </div>
    </div>
  );
};
