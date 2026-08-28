import React, { useRef, useState } from 'react';
import { Post, BrandId, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { logTimestamp } from '../../utils/date';
import { AssigneePopover } from '../AssigneePopover';
import { buildQuickPost } from '../../utils/quickPost';
import { combineAssigneeEmails } from '../../utils/postOwnership';

interface IdeaBacklogProps {
  filteredBacklogPosts: Post[];
  isMobileDevice: boolean;
  touchDraggedPostId: string | null;
  onTouchStart: (postId: string) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onSelectPost: (post: Post) => void;
  onSavePost: (post: Post) => void;
  onAddPost: (post: Post) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setMobileBacklogOpen: (open: boolean) => void;
  selectedBrandFilter: BrandId | 'all';
  activeTeammate: TeamMember | null;
  defaultAssignee: string;
  mobileBacklogOpen: boolean;
  teamMembers?: TeamMember[];
  /** Multi-select, shared with the calendar's own bulk-select state -- so a
   * bulk action (e.g. reassign) can span both scheduled posts and backlog
   * ideas in one selection instead of only ever reaching dated posts. */
  selectedPostIds?: Set<string>;
  isSelectMode?: boolean;
  onToggleSelect?: (postId: string, e?: React.MouseEvent | React.ChangeEvent) => void;
}

export const IdeaBacklog: React.FC<IdeaBacklogProps> = ({
  filteredBacklogPosts,
  isMobileDevice,
  touchDraggedPostId,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onSelectPost,
  onSavePost,
  onAddPost,
  onImageUpload,
  setMobileBacklogOpen,
  selectedBrandFilter,
  activeTeammate,
  defaultAssignee,
  mobileBacklogOpen,
  teamMembers = [],
  selectedPostIds = new Set(),
  isSelectMode = false,
  onToggleSelect
}) => {
  const [newBacklogTitle, setNewBacklogTitle] = useState('');
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  // `backlogContent` below is embedded twice in the tree (desktop sidebar +
  // mobile sheet), but the two are always mutually exclusive at any given
  // viewport -- the desktop copy is CSS-hidden (`hidden lg:flex`, not
  // unmounted) below `lg`, and the mobile sheet only mounts at all while
  // `mobileBacklogOpen` is true. A display:none element can never receive a
  // real click, and the mobile sheet's JSX comes after the desktop sidebar's
  // in the returned tree, so whenever both are mounted its ref callbacks
  // commit last and correctly win this shared Map -- a single instance is
  // safe without threading a per-render instance key through.
  const assigneeTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [openAssigneePostId, setOpenAssigneePostId] = useState<string | null>(null);
  const openAssigneePost = openAssigneePostId ? filteredBacklogPosts.find((p) => p.id === openAssigneePostId) : null;

  const handleAddBacklog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBacklogTitle.trim()) return;

    // Prefer the logged-in user over "first person in the roster" -- the
    // fastest creation path in the app used to always assign to whoever is
    // alphabetically/chronologically first in teamMembers, not to you.
    onAddPost(
      buildQuickPost(newBacklogTitle, {
        brandFilter: selectedBrandFilter,
        assignee: activeTeammate?.name || defaultAssignee,
      })
    );
    setNewBacklogTitle('');
  };

  const backlogContent = (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#efefed] flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#78d24b]">lightbulb</span>
            <span className="font-label-caps text-xs tracking-wider text-[#1b1c1a] uppercase font-bold">
              Idea Backlog
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-[#296c00] text-white font-label-caps text-[10px] px-2 py-0.5 rounded-full font-bold">
              {filteredBacklogPosts.length}
            </span>
            <button
              onClick={() => setIsDesktopCollapsed(true)}
              className="hidden lg:flex p-1 text-[#5f5f5b] hover:text-[#1b1c1a] hover:bg-[#f1f1f0] rounded transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#5f5f5b] leading-relaxed">
          <span className="hidden lg:inline">Drag cards onto a calendar day to schedule.</span>
          <span className="lg:hidden">Set a date on an idea to schedule it.</span>
        </p>
      </div>

      {/* Quick-add form */}
      <form onSubmit={handleAddBacklog} className="p-3 border-b border-[#efefed] space-y-2 flex-shrink-0 bg-white/60">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newBacklogTitle}
            onChange={(e) => setNewBacklogTitle(e.target.value)}
            placeholder="+ New idea..."
            className="flex-1 bg-white border border-[#e9e9e7] rounded-lg px-2.5 py-1.5 text-xs text-[#1b1c1a] placeholder:text-[#e9e9e7] focus:outline-none focus:border-[#296c00]"
          />
          <button
            type="submit"
            className="bg-[#296c00] hover:bg-[#205400] text-white rounded-lg px-2.5 py-1.5 min-w-[36px] text-xs font-bold transition-colors cursor-pointer"
            title="Add to backlog"
          >
            <span className="material-symbols-outlined text-sm">add</span>
          </button>
          <label
            className="bg-[#f1f1f0] text-[#296c00] border border-[#e9e9e7] rounded-lg px-2.5 py-1.5 min-w-[36px] text-xs font-bold hover:bg-[#296c00] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Upload an image to create a backlog idea"
          >
            <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
            <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
          </label>
        </div>
      </form>

      {/* Backlog List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredBacklogPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-[#e9e9e7] gap-2">
            <span className="material-symbols-outlined text-3xl">lightbulb</span>
            <p className="text-xs text-[#5f5f5b]">
              No ideas yet.<br />Type an idea above or upload an image.
            </p>
          </div>
        ) : (
          filteredBacklogPosts.map((post) => {
            const brand = BRANDS[post.brandId];
            const isTouchDraggingThis = touchDraggedPostId === post.id;
            const isSelected = selectedPostIds.has(post.id);
            return (
              <div
                key={post.id}
                draggable={!isMobileDevice}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', post.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onTouchStart={() => onTouchStart(post.id)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={(e) => {
                  if ((isSelectMode || e.ctrlKey || e.metaKey) && onToggleSelect) {
                    onToggleSelect(post.id, e);
                    return;
                  }
                  onSelectPost(post);
                  setMobileBacklogOpen(false);
                }}
                className={`group bg-white border border-[#efefed] rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-[#296c00] hover:shadow-xs transition-all relative ${
                  isTouchDraggingThis ? 'opacity-50 ring-2 ring-[#296c00]' : isSelected ? 'bg-[#f0fae8] ring-2 ring-[#296c00] border-[#296c00]' : ''
                }`}
              >
                {(isSelectMode || selectedPostIds.size > 0) && onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelect(post.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 w-4 h-4 text-[#296c00] border-[#e9e9e7] rounded z-10"
                  />
                )}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span
                    className="text-[9px] font-label-caps font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: (brand?.primaryColor || '#296c00') + '20',
                      color: brand?.primaryColor || '#296c00'
                    }}
                  >
                    {brand?.shortCode || post.brandId}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Mobile: quick date-picker to schedule */}
                    <label
                      className="lg:hidden p-1 text-[#296c00] hover:bg-[#f0fae8] rounded flex items-center justify-center cursor-pointer shrink-0"
                      title="Schedule on a date"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      <input
                        type="date"
                        className="sr-only"
                        onChange={(e) => {
                          if (e.target.value) {
                            onSavePost({
                              ...post,
                              scheduledDate: e.target.value,
                              scheduledTime: post.scheduledTime || '10:00',
                              // Giving a backlog idea its first date arms the reminder.
                              emailReminderEnabled: true,
                              reminderEmail: post.reminderEmail || combineAssigneeEmails(post.assignees, teamMembers) || undefined,
                              activityLog: [
                                {
                                  id: `act-${Date.now()}`,
                                  actor: activeTeammate?.name || post.assignees[0] || defaultAssignee || 'Someone',
                                  action: `Scheduled for ${e.target.value}`,
                                  timestamp: logTimestamp()
                                },
                                ...post.activityLog
                              ]
                            });
                            setMobileBacklogOpen(false);
                          }
                        }}
                      />
                    </label>
                    <span
                      className="material-symbols-outlined text-[#e9e9e7] group-hover:text-[#296c00] transition-colors opacity-0 group-hover:opacity-100 hidden lg:inline"
                      style={{ fontSize: '14px' }}
                    >
                      drag_indicator
                    </span>
                  </div>
                </div>

                {post.visualUrl && (
                  <div className="my-1.5 h-16 w-full rounded overflow-hidden border border-[#efefed] bg-[#f4f4f3]">
                    <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <p className="text-xs font-semibold text-[#1b1c1a] leading-snug line-clamp-2">{post.title}</p>
                {post.caption && (
                  <p className="text-[10px] text-[#5f5f5b] mt-1 leading-snug line-clamp-2">{post.caption}</p>
                )}

                <button
                  type="button"
                  ref={(el) => {
                    if (el) assigneeTriggerRefs.current.set(post.id, el);
                    else assigneeTriggerRefs.current.delete(post.id);
                  }}
                  onClick={(e) => { e.stopPropagation(); setOpenAssigneePostId((cur) => (cur === post.id ? null : post.id)); }}
                  className="mt-1.5 text-[9px] font-label-caps text-[#5f5f5b] hover:text-[#296c00] hover:underline cursor-pointer truncate block"
                >
                  {post.assignees.length > 0 ? post.assignees.join(', ') : 'Unassigned — tap to assign'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar (Expandable / Collapsible) ── */}
      {isDesktopCollapsed ? (
        <div className="hidden lg:flex flex-col items-center py-4 w-12 border-r border-[#efefed] bg-[#f4f4f3] shrink-0 space-y-4">
          <button
            onClick={() => setIsDesktopCollapsed(false)}
            className="w-8 h-8 rounded-lg bg-white border border-[#e9e9e7] hover:border-[#296c00] hover:text-[#296c00] text-[#5f5f5b] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
            title="Expand Idea Backlog"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          <div
            onClick={() => setIsDesktopCollapsed(false)}
            className="flex flex-col items-center gap-1 cursor-pointer group py-2"
            title="Click to open backlog"
          >
            <span className="material-symbols-outlined text-lg text-[#78d24b] group-hover:scale-110 transition-transform">
              lightbulb
            </span>
            <span className="bg-[#296c00] text-white font-label-caps text-[9px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredBacklogPosts.length}
            </span>
            <span
              className="font-label-caps text-[9px] text-[#5f5f5b] group-hover:text-[#1b1c1a] uppercase font-bold tracking-widest mt-4"
              style={{ writingMode: 'vertical-rl' }}
            >
              Backlog
            </span>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-[#efefed] bg-[#f4f4f3] overflow-y-auto shrink-0 transition-all">
          {backlogContent}
        </div>
      )}

      {/* ── Mobile Circular Floating Bulb Icon ── */}
      <button
        onClick={() => setMobileBacklogOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 w-12 h-12 rounded-full bg-[#1b1c1a] text-[#78d24b] shadow-2xl flex items-center justify-center border-2 border-white/20 active:scale-95 transition-all cursor-pointer"
        title="Open Idea Backlog"
        aria-label="Idea Backlog"
      >
        <span className="material-symbols-outlined text-2xl animate-pulse">lightbulb</span>
        {filteredBacklogPosts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#296c00] text-white font-label-caps text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1b1c1a]">
            {filteredBacklogPosts.length}
          </span>
        )}
      </button>

      {/* Mobile Slide-Up Sheet */}
      {mobileBacklogOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-fadeIn">
          <div className="bg-[#f4f4f3] border-t border-[#e9e9e7] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-[#efefed]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#78d24b]">lightbulb</span>
                <span className="font-label-caps text-xs font-bold text-[#1b1c1a] uppercase">Idea Backlog</span>
              </div>
              <button
                onClick={() => setMobileBacklogOpen(false)}
                className="p-1.5 text-[#5f5f5b] hover:text-[#1b1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="flex flex-col overflow-hidden flex-1">{backlogContent}</div>
          </div>
        </div>
      )}

      {openAssigneePost && (
        <AssigneePopover
          post={openAssigneePost}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
          isOpen
          onClose={() => setOpenAssigneePostId(null)}
          anchorRef={{ current: assigneeTriggerRefs.current.get(openAssigneePost.id) || null }}
          onSavePost={onSavePost}
        />
      )}
    </>
  );
};
