import React from 'react';
import { Post, PostStatus } from '../../types';
import { BRANDS } from '../../data/brands';
import { STATUS_CONFIG } from '../../utils/statusConfig';
import { todayStr } from '../../utils/date';

function getPostStatusConfig(post: Post) {
  const isOverdue =
    post.scheduledDate &&
    post.scheduledDate < todayStr() &&
    (post.status === 'not-started' || post.status === 'in-progress');
  return isOverdue ? STATUS_CONFIG['overdue'] : STATUS_CONFIG[post.status] || STATUS_CONFIG['not-started'];
}

interface CalendarListViewProps {
  filteredCalendarPosts: Post[];
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  bulkStatus: PostStatus | '';
  onApplyBulkStatus: (status: PostStatus) => void;
  bulkAssignee: string;
  onApplyBulkAssignee: (assignee: string) => void;
  uniqueAssignees: string[];
  onClearSelection: () => void;
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  setSelectedPostIds: (fn: (prev: Set<string>) => Set<string>) => void;
}

export const CalendarListView: React.FC<CalendarListViewProps> = ({
  filteredCalendarPosts,
  selectedPostIds,
  isSelectMode,
  bulkStatus,
  onApplyBulkStatus,
  bulkAssignee,
  onApplyBulkAssignee,
  uniqueAssignees,
  onClearSelection,
  onSelectPost,
  onDeletePost,
  onToggleSelect,
  setSelectedPostIds
}) => {
  const allSelected = filteredCalendarPosts.length > 0 && selectedPostIds.size === filteredCalendarPosts.length;

  return (
    <div className="bg-white border border-[#bfcab4] shadow-xs rounded-sm overflow-hidden">
      {/* In-list bulk action bar */}
      {selectedPostIds.size > 0 && (
        <div className="p-3 bg-[#f0fae8] border-b border-[#296c00]/30 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-label-caps text-xs font-bold text-[#296c00]">{selectedPostIds.size} selected</span>
          <select
            value={bulkStatus}
            onChange={(e) => e.target.value && onApplyBulkStatus(e.target.value as PostStatus)}
            className="bg-white border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs rounded min-h-[36px]"
          >
            <option value="">Set status…</option>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="ready-to-post">Ready to post</option>
            <option value="posted">Posted</option>
          </select>
          <select
            value={bulkAssignee}
            onChange={(e) => e.target.value && onApplyBulkAssignee(e.target.value)}
            className="bg-white border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs rounded min-h-[36px]"
          >
            <option value="">Reassign to…</option>
            {uniqueAssignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={onClearSelection}
            className="ml-auto text-[#707a67] font-label-caps text-xs hover:text-[#1b1c1a] px-2 py-1.5"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Column Headers (desktop) */}
      <div className="p-3 sm:p-4 bg-[#efeeea] border-b border-[#bfcab4] hidden md:flex items-center justify-between font-label-caps text-xs font-bold text-[#1b1c1a]">
        <span className="w-7 flex-shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelectedPostIds(
                allSelected ? () => new Set() : () => new Set(filteredCalendarPosts.map((p) => p.id))
              )
            }
            className="w-4 h-4"
          />
        </span>
        <span className="w-28">DATE & TIME</span>
        <span className="w-32">BRAND</span>
        <span className="flex-1">TITLE & CAPTION</span>
        <span className="w-28">STATUS</span>
        <span className="w-28">ASSIGNEE</span>
        <span className="w-20 text-right">ACTION</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#bfcab4]">
        {filteredCalendarPosts.length === 0 ? (
          <div className="p-8 text-center text-xs font-body-md text-[#707a67]">
            No scheduled posts match current filters or search parameters.
          </div>
        ) : (
          filteredCalendarPosts.map((post) => {
            const brand = BRANDS[post.brandId];
            const isSelected = selectedPostIds.has(post.id);
            const statusCfg = getPostStatusConfig(post);

            return (
              <div
                key={post.id}
                onClick={(e) => {
                  if (isSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                    onToggleSelect(post.id, e);
                  } else {
                    onSelectPost(post);
                  }
                }}
                className={`p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#f0fae8]' : 'hover:bg-[#faf9f5]'
                }`}
              >
                {/* Checkbox (desktop) */}
                <span className="hidden md:flex w-7 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => onToggleSelect(post.id, e)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                </span>

                {/* Date & Brand chip (mobile shows inline) */}
                <div className="flex items-center justify-between md:block md:w-28 font-code-sm text-xs text-[#1b1c1a]">
                  <span className="font-bold">
                    {post.scheduledDate} ({post.scheduledTime})
                  </span>
                  <span
                    className="md:hidden px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
                    style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                  >
                    {brand?.shortCode}
                  </span>
                </div>

                {/* Brand (desktop) */}
                <div className="hidden md:block w-32">
                  <span
                    className="px-2 py-1 font-label-caps text-[10px] uppercase font-bold rounded text-white inline-block"
                    style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                  >
                    {brand?.name}
                  </span>
                </div>

                {/* Title & Caption */}
                <div className="flex-1">
                  <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a]">{post.title}</h4>
                  <p className="font-body-md text-xs text-[#707a67] line-clamp-1 mt-0.5">{post.caption}</p>
                </div>

                {/* Status & Assignee & Actions */}
                <div className="flex items-center justify-between md:contents">
                  <div className="md:w-28">
                    <span
                      className="font-label-caps text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center justify-center gap-1"
                      style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                    >
                      {statusCfg.icon && (
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                          {statusCfg.icon}
                        </span>
                      )}
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="md:w-28 font-body-md text-xs text-[#404a39]">
                    {post.assignees.length > 0 ? post.assignees.join(', ') : 'Unassigned'}
                  </div>

                  <div className="md:w-36 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPost(post);
                      }}
                      className="text-[#296c00] font-label-caps text-xs font-bold hover:underline px-2 py-1 bg-[#efeeea] rounded"
                    >
                      Edit
                    </button>
                    {onDeletePost && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete post "${post.title}"?`)) {
                            onDeletePost(post.id);
                          }
                        }}
                        className="text-[#ba1a1a] font-label-caps text-xs font-bold hover:underline px-2 py-1 bg-[#ffdad6] rounded"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
