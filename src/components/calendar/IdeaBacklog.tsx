import React, { useState } from 'react';
import { Post, BrandId, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { logTimestamp } from '../../utils/date';

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
  mobileBacklogOpen
}) => {
  const [newBacklogTitle, setNewBacklogTitle] = useState('');

  const handleAddBacklog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBacklogTitle.trim()) return;

    const newPost: Post = {
      id: `post-${Date.now()}`,
      brandId: selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter,
      title: newBacklogTitle.trim(),
      caption: '',
      platform: 'instagram',
      specType: 'feed-post',
      scheduledDate: '',
      scheduledTime: '',
      status: 'not-started',
      assignees: defaultAssignee ? [defaultAssignee] : [],
      visualUrl: '',
      approved: false,
      tags: [],
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: activeTeammate?.name || defaultAssignee || 'Someone',
          action: 'Created idea',
          timestamp: logTimestamp()
        }
      ]
    };
    onAddPost(newPost);
    setNewBacklogTitle('');
  };

  const backlogContent = (
    <>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#bfcab4] flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-label-caps text-[10px] tracking-widest text-[#296951] uppercase font-bold">
            Idea Backlog
          </span>
          <span className="bg-[#296c00] text-white font-label-caps text-[10px] px-2 py-0.5 rounded-full">
            {filteredBacklogPosts.length}
          </span>
        </div>
        <p className="text-[10px] text-[#707a67] leading-relaxed">
          <span className="hidden lg:inline">Drag items onto a calendar day to schedule them.</span>
          <span className="lg:hidden">Open a post and set a date to schedule it.</span>
        </p>
      </div>

      {/* Quick-add form */}
      <form onSubmit={handleAddBacklog} className="p-3 border-b border-[#bfcab4] space-y-2 flex-shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newBacklogTitle}
            onChange={(e) => setNewBacklogTitle(e.target.value)}
            placeholder="+ New idea, press Enter"
            className="flex-1 bg-white border border-[#bfcab4] rounded px-2.5 py-2 text-xs text-[#1b1c1a] placeholder:text-[#bfcab4] focus:outline-none focus:border-[#296c00]"
          />
          <button
            type="submit"
            className="bg-[#296c00] text-white rounded px-2.5 py-2 min-w-[40px] text-xs font-bold hover:bg-[#1f5700] transition-colors"
            title="Add to backlog"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          </button>
          <label
            className="bg-[#efeeea] text-[#296c00] border border-[#bfcab4] rounded px-2.5 py-2 min-w-[40px] text-xs font-bold hover:bg-[#296c00] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Upload an image to create a backlog idea"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add_photo_alternate</span>
            <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
          </label>
        </div>
      </form>

      {/* Backlog List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredBacklogPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-[#bfcab4] gap-2">
            <span className="material-symbols-outlined text-3xl">lightbulb</span>
            <p className="text-xs font-body-md text-[#707a67]">
              No ideas yet.<br />Type an idea above or upload an image.
            </p>
          </div>
        ) : (
          filteredBacklogPosts.map((post) => {
            const brand = BRANDS[post.brandId];
            const isTouchDraggingThis = touchDraggedPostId === post.id;
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
                onClick={() => {
                  onSelectPost(post);
                  setMobileBacklogOpen(false);
                }}
                className={`group bg-white border border-[#bfcab4] rounded p-2.5 cursor-grab active:cursor-grabbing hover:border-[#296c00] hover:shadow-sm transition-all ${
                  isTouchDraggingThis ? 'opacity-50 ring-2 ring-[#296c00]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span
                    className="text-[9px] font-label-caps font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: (brand?.primaryColor || '#296c00') + '22',
                      color: brand?.primaryColor || '#296c00'
                    }}
                  >
                    {brand?.name?.split(' ')[0] ?? post.brandId}
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
                              emailReminderEnabled: true,
                              reminderEmail: post.reminderEmail || activeTeammate?.email || '',
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
                      className="material-symbols-outlined text-[#bfcab4] group-hover:text-[#296c00] transition-colors opacity-0 group-hover:opacity-100 hidden lg:inline"
                      style={{ fontSize: '14px' }}
                    >
                      drag_indicator
                    </span>
                  </div>
                </div>

                {post.visualUrl && (
                  <div className="my-1.5 h-16 w-full rounded overflow-hidden border border-[#bfcab4] bg-[#faf9f5]">
                    <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <p className="text-[11px] font-semibold text-[#1b1c1a] leading-snug line-clamp-2">{post.title}</p>
                {post.caption && (
                  <p className="text-[10px] text-[#707a67] mt-1 leading-snug line-clamp-2">{post.caption}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-[#bfcab4] bg-[#f3f2ee] overflow-y-auto shrink-0">
        {backlogContent}
      </div>

      {/* Mobile FAB trigger */}
      <button
        onClick={() => setMobileBacklogOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 flex items-center gap-2 bg-[#1b1c1a] text-white font-label-caps text-xs font-bold pl-3 pr-4 py-3 rounded-full shadow-xl active:scale-95 transition-all border border-white/20"
      >
        <span className="material-symbols-outlined text-base text-[#78d24b]">lightbulb</span>
        <span>Ideas ({filteredBacklogPosts.length})</span>
      </button>

      {/* Mobile slide-up sheet */}
      {mobileBacklogOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#f3f2ee] border-t border-[#bfcab4] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-slideUp">
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                onClick={() => setMobileBacklogOpen(false)}
                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#707a67] hover:text-[#1b1c1a]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex flex-col overflow-hidden flex-1">{backlogContent}</div>
          </div>
        </div>
      )}
    </>
  );
};
