import React, { useState, useMemo } from 'react';
import { Post, BrandId, PostStatus, Platform, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { toDateStr, todayStr, fromDateStr, mondayFirstDay, startOfWeek, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';

interface CalendarViewProps {
  posts: Post[];
  selectedBrandFilter: BrandId | 'all';
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  searchQuery: string;
  onSavePost: (post: Post) => void;
  onAddPost: (post: Post) => void;
  teamMembers?: TeamMember[];
}

type CalendarDisplayMode = 'month' | 'week' | 'list';

interface PostFilters {
  brand: BrandId | 'all';
  status: PostStatus | 'all';
  platform: Platform | 'all';
  assignee: string;
  search: string;
}

/** Shared predicate for both the backlog list and the calendar grid. */
function matchesFilters(post: Post, f: PostFilters): boolean {
  if (f.brand !== 'all' && post.brandId !== f.brand) return false;
  if (f.status !== 'all' && post.status !== f.status) return false;
  if (f.platform !== 'all' && post.platform !== f.platform) return false;
  if (f.assignee !== 'all' && post.assignee !== f.assignee) return false;

  const query = f.search.trim().toLowerCase();
  if (query) {
    const haystack = [post.title, post.caption, post.assignee, ...post.tags];
    if (!haystack.some((v) => (v || '').toLowerCase().includes(query))) return false;
  }
  return true;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  posts,
  selectedBrandFilter,
  onSelectPost,
  onDeletePost,
  onOpenNewPostModal,
  searchQuery,
  onSavePost,
  onAddPost,
  teamMembers = []
}) => {
  const today = useMemo(() => new Date(), []);
  const todayIso = todayStr();

  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedPostForInspector, setSelectedPostForInspector] = useState<Post | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mobileBacklogOpen, setMobileBacklogOpen] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PostStatus | ''>('');
  const [bulkAssignee, setBulkAssignee] = useState<string>('');
  const [clearCaptionsOnDuplicate, setClearCaptionsOnDuplicate] = useState(false);

  /** Default owner for quick-created posts — never a hardcoded placeholder name. */
  const defaultAssignee = teamMembers.length > 0 ? teamMembers[0].name : '';

  // State for Backlog Idea form
  const [newBacklogTitle, setNewBacklogTitle] = useState('');

  // Partition posts into Backlog (no date) and Calendar (with date)
  const backlogPosts = useMemo(() => {
    return posts.filter((p) => !p.scheduledDate);
  }, [posts]);

  const calendarPosts = useMemo(() => {
    return posts.filter((p) => !!p.scheduledDate);
  }, [posts]);

  const filters: PostFilters = useMemo(
    () => ({
      brand: selectedBrandFilter,
      status: statusFilter,
      platform: platformFilter,
      assignee: assigneeFilter,
      search: searchQuery
    }),
    [selectedBrandFilter, statusFilter, platformFilter, assigneeFilter, searchQuery]
  );

  const filteredBacklogPosts = useMemo(
    () => backlogPosts.filter((p) => matchesFilters(p, filters)),
    [backlogPosts, filters]
  );

  const filteredCalendarPosts = useMemo(
    () => calendarPosts.filter((p) => matchesFilters(p, filters)),
    [calendarPosts, filters]
  );

  // Unique assignees for filter (includes both scheduled & backlog)
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.assignee) set.add(p.assignee);
    });
    return Array.from(set);
  }, [posts]);

  // Month details calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Monday-first offset — the header row renders MON..SUN, so Date.getDay()
  // (Sunday = 0) would shift the whole grid by a day.
  const leadingBlanks = mondayFirstDay(new Date(currentYear, currentMonth, 1));
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', {
    month: 'long'
  });

  // Generate calendar grid cells array
  const calendarCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    for (let i = leadingBlanks - 1; i >= 0; i--) {
      cells.push({ dateStr: '', dayNum: prevMonthDays - i, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: toDateStr(new Date(currentYear, currentMonth, d)),
        dayNum: d,
        isCurrentMonth: true
      });
    }
    // Pad the final row so the grid always ends flush.
    for (let d = 1; cells.length % 7 !== 0; d++) {
      cells.push({ dateStr: '', dayNum: d, isCurrentMonth: false });
    }
    return cells;
  }, [currentYear, currentMonth, daysInMonth, leadingBlanks]);

  // Calculate recurrence placeholders for the currently viewed month
  const recurrencePlaceholders = useMemo(() => {
    const placeholders: Record<string, any[]> = {};
    const recurringSeries = posts.filter(p => p.recurrenceRule && p.recurrenceRule !== 'none');
    
    if (recurringSeries.length === 0) return placeholders;

    calendarCells.forEach(cell => {
      if (!cell.dateStr) return;
      const cellDate = fromDateStr(cell.dateStr);
      const cellDay = cellDate.getDay(); // 0 = Sun, 1 = Mon, ...

      recurringSeries.forEach(series => {
        let matches = false;

        if (series.recurrenceRule === 'weekly:monday' && cellDay === 1) {
          matches = true;
        } else if (series.recurrenceRule === 'weekly:friday' && cellDay === 5) {
          matches = true;
        } else if (series.recurrenceRule === 'monthly' && series.scheduledDate) {
          const seriesDate = fromDateStr(series.scheduledDate);
          if (!isNaN(seriesDate.getTime()) && seriesDate.getDate() === cellDate.getDate()) {
            matches = true;
          }
        }
        
        if (matches) {
          const realPostsOnDay = posts.filter(p => p.scheduledDate === cell.dateStr && p.brandId === series.brandId);
          const hasRealPost = realPostsOnDay.some(p => p.title.includes(series.title) || p.templateId === series.templateId);
          
          if (!hasRealPost) {
            if (!placeholders[cell.dateStr]) {
              placeholders[cell.dateStr] = [];
            }
            placeholders[cell.dateStr].push({
              id: `placeholder-${series.id}-${cell.dateStr}`,
              brandId: series.brandId,
              title: `${series.title} (Slot)`,
              caption: series.caption,
              platform: series.platform,
              specType: series.specType,
              scheduledDate: cell.dateStr,
              scheduledTime: series.scheduledTime,
              status: 'not-started',
              assignee: series.assignee,
              visualUrl: series.visualUrl,
              approved: false,
              isPlaceholder: true,
              originalSeriesId: series.id
            });
          }
        }
      });
    });
    
    return placeholders;
  }, [posts, calendarCells]);

  // Combined real posts and recurrence placeholders by date
  const postsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredCalendarPosts.forEach((p) => {
      if (!map[p.scheduledDate]) map[p.scheduledDate] = [];
      map[p.scheduledDate].push(p);
    });
    // Overlay recurrence placeholders
    Object.keys(recurrencePlaceholders).forEach(dateStr => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr] = [...map[dateStr], ...recurrencePlaceholders[dateStr]];
    });
    return map;
  }, [filteredCalendarPosts, recurrencePlaceholders]);

  // Add a quick backlog idea
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
      assignee: defaultAssignee,
      visualUrl: '',
      approved: false,
      tags: [],
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: defaultAssignee || 'Someone',
          action: 'Created idea',
          timestamp: logTimestamp()
        }
      ]
    };
    onAddPost(newPost);
    setNewBacklogTitle('');
  };

  // Drag and drop drop handler
  const handleDropOnCell = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const postId = e.dataTransfer.getData("text/plain");
    const draggedPost = posts.find(p => p.id === postId);
    if (draggedPost) {
      const wasUnscheduled = !draggedPost.scheduledDate;
      const updated: Post = {
        ...draggedPost,
        scheduledDate: dateStr,
        scheduledTime: draggedPost.scheduledTime || '10:00',
        activityLog: [
          {
            id: `act-${Date.now()}`,
            actor: draggedPost.assignee || defaultAssignee || 'Someone',
            action: wasUnscheduled ? `Scheduled for ${dateStr}` : `Moved to ${dateStr}`,
            timestamp: logTimestamp()
          },
          ...draggedPost.activityLog
        ]
      };
      onSavePost(updated);
    }
  };

  // Materialize placeholder click handler
  const handlePlaceholderClick = (placeholder: any) => {
    const materialized: Post = {
      id: `post-${Date.now()}`,
      brandId: placeholder.brandId,
      title: placeholder.title.replace(' (Slot)', ''),
      caption: placeholder.caption,
      platform: placeholder.platform,
      specType: placeholder.specType,
      scheduledDate: placeholder.scheduledDate,
      scheduledTime: placeholder.scheduledTime,
      status: 'not-started',
      assignee: placeholder.assignee,
      visualUrl: placeholder.visualUrl,
      approved: false,
      tags: ['RecurrentSlot'],
      comments: [],
      activityLog: [{
        id: `act-${Date.now()}`,
        actor: placeholder.assignee || defaultAssignee || 'Someone',
        action: 'Created from a repeating slot',
        timestamp: logTimestamp()
      }]
    };
    onAddPost(materialized);
    onSelectPost(materialized);
  };

  // Direct image upload — goes to Drive, never stores base64 on the post.
  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetPost?: Post,
    targetDate?: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);

      if (targetPost) {
        onSavePost({
          ...targetPost,
          visualUrl: url,
          activityLog: [
            {
              id: `act-${Date.now()}`,
              actor: targetPost.assignee || defaultAssignee || 'Someone',
              action: `Added image "${file.name}"`,
              timestamp: logTimestamp()
            },
            ...targetPost.activityLog
          ]
        });
      } else {
        const newPost: Post = {
          id: `post-${Date.now()}`,
          brandId: selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter,
          title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled post',
          caption: '',
          platform: 'instagram',
          specType: 'feed-post',
          scheduledDate: targetDate || '',
          scheduledTime: targetDate ? '10:00' : '',
          status: 'not-started',
          assignee: defaultAssignee,
          visualUrl: url,
          approved: false,
          tags: [],
          comments: [],
          activityLog: [
            {
              id: `act-${Date.now()}`,
              actor: defaultAssignee || 'Someone',
              action: `Created from image "${file.name}"`,
              timestamp: logTimestamp()
            }
          ]
        };
        onAddPost(newPost);
        onSelectPost(newPost);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Bulk selection helpers (List view)
  const toggleSelectPost = (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPostIds(new Set());
    setBulkStatus('');
    setBulkAssignee('');
  };

  const applyBulkStatus = (status: PostStatus) => {
    filteredCalendarPosts
      .filter((p) => selectedPostIds.has(p.id))
      .forEach((post) => {
        onSavePost({
          ...post,
          status,
          activityLog: [
            {
              id: `act-${Date.now()}-${post.id}`,
              actor: post.assignee || defaultAssignee || 'Someone',
              action: `Changed status to "${status.replace(/-/g, ' ')}" (bulk update)`,
              timestamp: logTimestamp()
            },
            ...post.activityLog
          ]
        });
      });
    setBulkStatus('');
    clearSelection();
  };

  const applyBulkAssignee = (assignee: string) => {
    filteredCalendarPosts
      .filter((p) => selectedPostIds.has(p.id))
      .forEach((post) => {
        onSavePost({
          ...post,
          assignee,
          activityLog: [
            {
              id: `act-${Date.now()}-${post.id}`,
              actor: assignee || 'Someone',
              action: `Reassigned to ${assignee || 'nobody'} (bulk update)`,
              timestamp: logTimestamp()
            },
            ...post.activityLog
          ]
        });
      });
    setBulkAssignee('');
    clearSelection();
  };

  // Duplicate everything scheduled in the visible week to the same days next
  // week (PRD §5.5) — so the slot exists on the calendar before content is written.
  const handleDuplicateWeekForward = () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = toDateStr(weekEnd);
    const weekStartStr = toDateStr(weekStart);

    const postsThisWeek = posts.filter(
      (p) => p.scheduledDate && p.scheduledDate >= weekStartStr && p.scheduledDate <= weekEndStr
    );

    if (postsThisWeek.length === 0) {
      alert('No posts scheduled this week to duplicate.');
      return;
    }
    if (!confirm(`Duplicate ${postsThisWeek.length} post${postsThisWeek.length === 1 ? '' : 's'} to next week?`)) {
      return;
    }

    postsThisWeek.forEach((post) => {
      const originalDate = fromDateStr(post.scheduledDate);
      const nextWeekDate = new Date(originalDate);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);

      const duplicated: Post = {
        ...post,
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scheduledDate: toDateStr(nextWeekDate),
        caption: clearCaptionsOnDuplicate ? '' : post.caption,
        status: 'not-started',
        approved: false,
        approvedBy: undefined,
        approvedAt: undefined,
        comments: [],
        activityLog: [
          {
            id: `act-${Date.now()}`,
            actor: post.assignee || defaultAssignee || 'Someone',
            action: `Duplicated forward one week from "${post.title}"`,
            timestamp: logTimestamp()
          }
        ]
      };
      onAddPost(duplicated);
    });
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setWeekStart(startOfWeek(now));
  };

  // Only ever the post the user actually picked — no arbitrary fallback.
  const inspectorPost = selectedPostForInspector;

  // Mobile selected day sheet state
  const [activeMobileDate, setActiveMobileDate] = useState<string | null>(null);

  // Idea Backlog content, shared between the desktop sidebar and the mobile
  // full-screen sheet — it was previously `hidden lg:flex`, making the backlog
  // completely unreachable on a phone (PRD §7 requires full mobile editing).
  const backlogPanel = (
    <>
      {/* Backlog header */}
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

      {/* Quick-add backlog idea */}
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
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFileUpload(e)}
              className="hidden"
            />
          </label>
        </div>
      </form>

      {/* Backlog list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredBacklogPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-[#bfcab4] gap-2">
            <span className="material-symbols-outlined text-3xl">lightbulb</span>
            <p className="text-xs font-body-md text-[#707a67]">No ideas yet.<br/>Type an idea above or upload an image.</p>
          </div>
        ) : (
          filteredBacklogPosts.map((post) => {
            const brand = BRANDS[post.brandId];
            return (
              <div
                key={post.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", post.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => { onSelectPost(post); setMobileBacklogOpen(false); }}
                className="group bg-white border border-[#bfcab4] rounded p-2.5 cursor-grab active:cursor-grabbing hover:border-[#296c00] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span
                    className="text-[9px] font-label-caps font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: (brand?.primaryColor || '#296c00') + '22', color: brand?.primaryColor || '#296c00' }}
                  >
                    {brand?.name?.split(' ')[0] ?? post.brandId}
                  </span>
                  <span className="material-symbols-outlined text-[#bfcab4] group-hover:text-[#296c00] transition-colors opacity-0 group-hover:opacity-100 hidden lg:inline" style={{ fontSize: '14px' }}>drag_indicator</span>
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
    <div className="flex-1 flex flex-row bg-[#FAF9F5] min-h-screen">
      {/* ── Idea Backlog Sidebar (desktop) ── */}
      <div className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-[#bfcab4] bg-[#f3f2ee] overflow-y-auto shrink-0">
        {backlogPanel}
      </div>

      {/* ── Idea Backlog floating access (mobile/tablet) ── */}
      <button
        onClick={() => setMobileBacklogOpen(true)}
        className="lg:hidden fixed bottom-5 left-4 z-40 flex items-center gap-2 bg-[#1b1c1a] text-white font-label-caps text-xs font-bold pl-3 pr-4 py-3 rounded-full shadow-lg active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-base">lightbulb</span>
        <span>Ideas ({filteredBacklogPosts.length})</span>
      </button>

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
            <div className="flex flex-col overflow-hidden flex-1">{backlogPanel}</div>
          </div>
        </div>
      )}

      {/* ── Main Schedule Content Canvas ── */}
      <div className="flex-1 flex flex-col xl:flex-row bg-[#FAF9F5] min-h-screen overflow-hidden">
      {/* Main Schedule Content Canvas */}
      <div className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Calendar Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 pb-3 border-b border-[#bfcab4]">
          <div>
            <span className="font-label-caps text-[10px] sm:text-xs text-[#296951] tracking-widest uppercase font-bold">
              Calendar
            </span>
            <h2 className="font-display-xl text-xl sm:text-3xl md:text-4xl text-[#1b1c1a] font-bold mt-0.5">
              {monthName} {currentYear}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
            {/* View Mode Selector */}
            <div className="flex bg-[#efeeea] border border-[#bfcab4] rounded p-1">
              <button
                onClick={() => { setDisplayMode('month'); clearSelection(); }}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[36px] font-label-caps text-xs transition-all ${
                  displayMode === 'month' ? 'bg-white font-bold text-[#296c00] shadow-xs' : 'text-[#707a67]'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => { setDisplayMode('week'); clearSelection(); }}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[36px] font-label-caps text-xs transition-all ${
                  displayMode === 'week' ? 'bg-white font-bold text-[#296c00] shadow-xs' : 'text-[#707a67]'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[36px] font-label-caps text-xs transition-all ${
                  displayMode === 'list' ? 'bg-white font-bold text-[#296c00] shadow-xs' : 'text-[#707a67]'
                }`}
              >
                List
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-1 bg-white border border-[#bfcab4] rounded p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-[#efeeea] text-[#1b1c1a]"
                title="Previous Month"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button
                onClick={handleGoToToday}
                className="font-label-caps text-xs px-2.5 py-1.5 min-h-[36px] text-[#296c00] font-bold hover:bg-[#efeeea] rounded"
                title="Jump to today"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-[#efeeea] text-[#1b1c1a]"
                title="Next Month"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 border border-[#bfcab4] rounded shadow-xs">
          <span className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold mr-1">
            FILTERS:
          </span>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PostStatus | 'all')}
            className="bg-[#faf9f5] border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none min-h-[36px] rounded-xs flex-1 sm:flex-none"
          >
            <option value="all">All statuses</option>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="ready-to-post">Ready to post</option>
            <option value="posted">Posted</option>
          </select>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | 'all')}
            className="bg-[#faf9f5] border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none min-h-[36px] rounded-xs flex-1 sm:flex-none"
          >
            <option value="all">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">X / Twitter</option>
            <option value="web">Web Portal</option>
            <option value="email">Email Broadcast</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-[#faf9f5] border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none min-h-[36px] rounded-xs flex-1 sm:flex-none"
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {(statusFilter !== 'all' || platformFilter !== 'all' || assigneeFilter !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setPlatformFilter('all');
                setAssigneeFilter('all');
              }}
              className="text-[#ba1a1a] font-label-caps text-xs hover:underline ml-auto py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* MONTH VIEW */}
        {displayMode === 'month' && (
          <div className="bg-white border border-[#bfcab4] shadow-xs rounded-sm overflow-hidden">
            {/* Day Header Row */}
            <div className="grid grid-cols-7 border-b border-[#bfcab4] bg-[#efeeea]">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayShort, idx) => {
                const fullDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                return (
                  <div
                    key={idx}
                    className="py-1.5 sm:py-2 text-center font-label-caps text-[10px] sm:text-xs font-bold text-[#404a39] border-r border-[#bfcab4] last:border-r-0"
                  >
                    <span className="hidden sm:inline">{fullDays[idx]}</span>
                    <span className="sm:hidden">{dayShort}</span>
                  </div>
                );
              })}
            </div>

            {/* Month Cells Grid */}
            <div className="grid grid-cols-7 bg-[#bfcab4] gap-[1px]">
              {calendarCells.map((cell, idx) => {
                const dayPosts = cell.dateStr ? postsByDate[cell.dateStr] || [] : [];
                const distinctBrands = new Set(dayPosts.map((p) => p.brandId));
                const isCollision = distinctBrands.size > 1;
                const isToday = cell.dateStr === todayIso;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!cell.dateStr) return;
                      // On mobile (< sm), tap date opens mobile day sheet!
                      if (window.innerWidth < 640) {
                        setActiveMobileDate(cell.dateStr);
                      } else {
                        onOpenNewPostModal(cell.dateStr);
                      }
                    }}
                    onDragOver={(e) => {
                      if (cell.dateStr) {
                        e.preventDefault();
                        e.currentTarget.classList.add('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                    }}
                    onDrop={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                      if (cell.dateStr) handleDropOnCell(e, cell.dateStr);
                    }}
                    className={`min-h-[64px] sm:min-h-[110px] md:min-h-[120px] p-1 sm:p-2 bg-white flex flex-col justify-between transition-colors relative group cursor-pointer ${
                      !cell.isCurrentMonth ? 'bg-[#faf9f5] opacity-50' : 'hover:bg-[#f5f4f0]'
                    } ${isToday ? 'ring-1 ring-[#296c00] ring-inset' : ''}`}
                  >
                    {/* Top Date Header */}
                    <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                      <span
                        className={`font-label-caps text-[11px] sm:text-xs font-bold ${
                          isToday
                            ? 'bg-[#296c00] text-white w-5 h-5 rounded-full inline-flex items-center justify-center'
                            : cell.isCurrentMonth
                            ? 'text-[#1b1c1a]'
                            : 'text-[#707a67]'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {/* Multiple brands on one day — awareness only, never a blocker (PRD §5.2) */}
                      {isCollision && (
                        <span
                          className="font-label-caps text-[8px] sm:text-[9px] bg-[#efeeea] border border-[#bfcab4] text-[#404a39] px-1 sm:px-1.5 py-0.5 rounded font-bold leading-tight"
                          title={`${distinctBrands.size} brands posting this day`}
                        >
                          {distinctBrands.size} brands
                        </span>
                      )}
                    </div>

                    {/* Mobile Dot Indicators (< sm screens) */}
                    <div className="sm:hidden flex flex-wrap gap-1 my-1">
                      {dayPosts.map((post) => {
                        const brand = BRANDS[post.brandId];
                        return (
                          <span
                            key={post.id}
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                            title={post.title}
                          />
                        );
                      })}
                      {dayPosts.length === 0 && (
                        <span className="text-[9px] text-[#bfcab4] font-code-sm">.</span>
                      )}
                    </div>

                    {/* Desktop Posts Cards Stack (>= sm screens) */}
                    <div className="hidden sm:block space-y-1.5 flex-1 overflow-y-auto max-h-[100px] pr-0.5">
                      {dayPosts.map((post) => {
                        const brand = BRANDS[post.brandId];

                        // Render recurring slot placeholders as ghost cards
                        if ((post as any).isPlaceholder) {
                          return (
                            <div
                              key={post.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaceholderClick(post);
                              }}
                              style={{ borderLeftColor: brand?.primaryColor || '#bfcab4' }}
                              className="p-1.5 bg-[#faf9f5] border border-dashed border-[#bfcab4] border-l-4 hover:border-[#296c00] hover:bg-[#f0fae8] transition-all rounded-xs text-left opacity-60 hover:opacity-100 cursor-pointer"
                              title="Click to create this recurring slot"
                            >
                              <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px', color: brand?.primaryColor || '#bfcab4' }}>replay</span>
                                <p className="font-headline-md text-[9px] text-[#707a67] line-clamp-1 leading-tight">
                                  {post.title}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={post.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPostForInspector(post);
                              onSelectPost(post);
                            }}
                            style={{ borderLeftColor: brand?.primaryColor || '#296c00' }}
                            className="p-1.5 bg-white border border-[#bfcab4] border-l-4 shadow-2xs hover:shadow-md transition-all rounded-xs text-left"
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span
                                className="font-label-caps text-[9px] font-bold uppercase truncate"
                                style={{ color: brand?.primaryColor || '#296c00' }}
                              >
                                {brand?.shortCode || post.brandId}
                              </span>
                              <span className="font-code-sm text-[9px] text-[#707a67]">
                                {post.scheduledTime}
                              </span>
                            </div>

                            <p className="font-headline-md text-xs font-bold text-[#1b1c1a] line-clamp-1 leading-tight">
                              {post.title}
                            </p>

                            {post.visualUrl && (
                              <div className="my-1 h-10 w-full rounded overflow-hidden border border-[#bfcab4] bg-[#faf9f5]">
                                <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-1 text-[9px] font-label-caps text-[#707a67]">
                              <span className="capitalize">{post.status?.replace('-', ' ')}</span>
                              {post.approved && (
                                <span className="text-[#296c00] font-bold">✓ Approved</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Add & Direct Image Upload Buttons on Hover (Desktop) */}
                    <div className="hidden sm:flex opacity-0 group-hover:opacity-100 mt-1 justify-between items-center text-[10px] font-label-caps">
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#296c00] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                        title="Upload image directly to this date"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add_photo_alternate</span>
                        <span>Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileUpload(e, undefined, cell.dateStr)}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cell.dateStr) onOpenNewPostModal(cell.dateStr);
                        }}
                        className="text-[#707a67] hover:text-[#1b1c1a] flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                        <span>Post</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {displayMode === 'week' && (
          <div className="bg-white border border-[#bfcab4] p-3 sm:p-4 shadow-xs rounded-sm">
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
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
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
                    onChange={(e) => setClearCaptionsOnDuplicate(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  Clear captions
                </label>
                <button
                  onClick={handleDuplicateWeekForward}
                  className="flex items-center gap-1.5 bg-[#efeeea] border border-[#bfcab4] text-[#296c00] hover:bg-[#296c00] hover:text-white transition-colors font-label-caps text-xs font-bold px-3 py-1.5 rounded min-h-[36px]"
                  title="Copy this week's posts to next week"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span className="hidden sm:inline">Duplicate week forward</span>
                  <span className="sm:hidden">Duplicate</span>
                </button>
              </div>
            </div>
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
                    className={`p-3 border rounded min-h-[160px] sm:min-h-[220px] ${
                      isToday ? 'bg-white border-[#296c00] ring-1 ring-[#296c00]/30' : 'bg-[#faf9f5] border-[#bfcab4]'
                    }`}
                  >
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

                    <div className="space-y-2">
                      {dayPosts.map((post) => {
                        const brand = BRANDS[post.brandId];
                        return (
                          <div
                            key={post.id}
                            onClick={() => {
                              setSelectedPostForInspector(post);
                              onSelectPost(post);
                            }}
                            style={{ borderLeftColor: brand?.primaryColor }}
                            className="p-2 bg-white border border-[#bfcab4] border-l-4 shadow-xs rounded cursor-pointer hover:border-[#296c00]"
                          >
                            <span className="font-label-caps text-[9px] font-bold text-[#296c00] uppercase">
                              {brand?.name}
                            </span>
                            <h4 className="font-headline-md text-xs font-bold text-[#1b1c1a] line-clamp-2">
                              {post.title}
                            </h4>
                            <div className="flex justify-between items-center mt-2 text-[10px] font-code-sm text-[#707a67]">
                              <span>{post.scheduledTime}</span>
                              <span className="uppercase font-bold">{post.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {displayMode === 'list' && (
          <div className="bg-white border border-[#bfcab4] shadow-xs rounded-sm overflow-hidden">
            {/* Bulk action bar — appears once something is selected */}
            {selectedPostIds.size > 0 && (
              <div className="p-3 bg-[#f0fae8] border-b border-[#296c00]/30 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-label-caps text-xs font-bold text-[#296c00]">
                  {selectedPostIds.size} selected
                </span>
                <select
                  value={bulkStatus}
                  onChange={(e) => e.target.value && applyBulkStatus(e.target.value as PostStatus)}
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
                  onChange={(e) => e.target.value && applyBulkAssignee(e.target.value)}
                  className="bg-white border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs rounded min-h-[36px]"
                >
                  <option value="">Reassign to…</option>
                  {uniqueAssignees.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button
                  onClick={clearSelection}
                  className="ml-auto text-[#707a67] font-label-caps text-xs hover:text-[#1b1c1a] px-2 py-1.5"
                >
                  Clear selection
                </button>
              </div>
            )}

            <div className="p-3 sm:p-4 bg-[#efeeea] border-b border-[#bfcab4] hidden md:flex items-center justify-between font-label-caps text-xs font-bold text-[#1b1c1a]">
              <span className="w-7 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={filteredCalendarPosts.length > 0 && selectedPostIds.size === filteredCalendarPosts.length}
                  onChange={() =>
                    setSelectedPostIds(
                      selectedPostIds.size === filteredCalendarPosts.length
                        ? new Set()
                        : new Set(filteredCalendarPosts.map((p) => p.id))
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

            <div className="divide-y divide-[#bfcab4]">
              {filteredCalendarPosts.length === 0 ? (
                <div className="p-8 text-center text-xs font-body-md text-[#707a67]">
                  No scheduled posts match current filters or search parameters.
                </div>
              ) : (
                filteredCalendarPosts.map((post) => {
                  const brand = BRANDS[post.brandId];
                  const isSelected = selectedPostIds.has(post.id);
                  return (
                    <div
                      key={post.id}
                      onClick={() => {
                        setSelectedPostForInspector(post);
                        onSelectPost(post);
                      }}
                      className={`p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#f0fae8]' : 'hover:bg-[#faf9f5]'
                      }`}
                    >
                      <span className="hidden md:flex w-7 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => toggleSelectPost(post.id, e)}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                      </span>

                      <div className="flex items-center justify-between md:block md:w-28 font-code-sm text-xs text-[#1b1c1a]">
                        <span className="font-bold">{post.scheduledDate} ({post.scheduledTime})</span>
                        <span
                          className="md:hidden px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
                          style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                        >
                          {brand?.shortCode}
                        </span>
                      </div>

                      <div className="hidden md:block w-32">
                        <span
                          className="px-2 py-1 font-label-caps text-[10px] uppercase font-bold rounded text-white inline-block"
                          style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                        >
                          {brand?.name}
                        </span>
                      </div>

                      <div className="flex-1">
                        <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a]">
                          {post.title}
                        </h4>
                        <p className="font-body-md text-xs text-[#707a67] line-clamp-1 mt-0.5">
                          {post.caption}
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:contents">
                        <div className="md:w-28">
                          <span className="font-label-caps text-[10px] px-2 py-1 bg-[#efeeea] border border-[#bfcab4] rounded uppercase font-bold">
                            {post.status}
                          </span>
                        </div>

                        <div className="md:w-28 font-body-md text-xs text-[#404a39]">
                          {post.assignee || 'Unassigned'}
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
        )}

      </div>

      {/* Right Side Inspector Panel (Responsive Drawer on Mobile) */}
      <aside className="w-full xl:w-80 border-t xl:border-t-0 xl:border-l border-[#bfcab4] bg-[#faf9f5] p-4 sm:p-6 space-y-5">
        <div className="pb-3 border-b border-[#bfcab4] flex items-center justify-between">
          <div>
            <span className="font-label-caps text-xs text-[#296951] uppercase font-bold">
              Selected post
            </span>
            <h3 className="font-headline-md text-lg sm:text-xl font-bold text-[#1b1c1a] mt-0.5">
              {inspectorPost ? inspectorPost.title : 'Nothing selected'}
            </h3>
          </div>
        </div>

        {inspectorPost ? (
          <div className="space-y-5 text-xs font-body-md text-[#1b1c1a]">
            {/* Visual Attachment Preview & Upload */}
            <div>
              <label className="font-label-caps text-[10px] text-[#707a67] block mb-2 uppercase">
                Image
              </label>
              <div className="h-36 sm:h-40 w-full bg-white border border-[#bfcab4] rounded overflow-hidden flex items-center justify-center relative">
                {inspectorPost.visualUrl ? (
                  <img
                    src={inspectorPost.visualUrl}
                    alt={inspectorPost.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-[#707a67]">
                    <span className="material-symbols-outlined text-3xl">image</span>
                    <p className="font-label-caps text-[10px] mt-1">No image yet</p>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 bg-[#1b1c1a]/80 text-white font-label-caps text-[9px] px-2 py-0.5 rounded">
                  {SPECS[inspectorPost.specType]?.dimensions || inspectorPost.specType}
                </span>
              </div>
              <label
                className={`mt-2 w-full bg-white border border-[#296c00] text-[#296c00] hover:bg-[#296c00] hover:text-white font-label-caps text-xs py-1.5 px-3 rounded font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  isUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-sm">upload</span>
                <span>
                  {isUploading ? 'Uploading…' : inspectorPost.visualUrl ? 'Replace image' : 'Upload image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileUpload(e, inspectorPost)}
                  className="hidden"
                />
              </label>
              {uploadError && (
                <p className="mt-2 text-[11px] font-body-md text-[#ba1a1a] bg-[#ffdad6] border border-[#ffb4ab] rounded p-2">
                  {uploadError}
                </p>
              )}
            </div>

            {/* Properties Table */}
            <div className="space-y-2.5">
              <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold">
                Details
              </label>

              <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                <span className="text-[#707a67]">Brand</span>
                <span className="font-label-caps font-bold text-[#296c00]">
                  {BRANDS[inspectorPost.brandId]?.name}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                <span className="text-[#707a67]">Owner</span>
                <span className="font-label-caps font-bold">{inspectorPost.assignee || 'Unassigned'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                <span className="text-[#707a67]">Status</span>
                <span className="font-label-caps font-bold capitalize">
                  {inspectorPost.status.replace(/-/g, ' ')}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                <span className="text-[#707a67]">Reminder</span>
                <span className="font-code-sm font-bold text-[#296951]">
                  {inspectorPost.scheduledDate
                    ? `${inspectorPost.scheduledDate} ${inspectorPost.scheduledTime || '10:00'}`
                    : 'No date set'}
                </span>
              </div>

              {inspectorPost.reminderEmail && (
                <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                  <span className="text-[#707a67]">Email to</span>
                  <span className="font-code-sm text-[11px] truncate max-w-[160px] text-[#707a67]">
                    {inspectorPost.reminderEmail}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                <span className="text-[#707a67]">Approved</span>
                <span className={`font-label-caps font-bold ${inspectorPost.approved ? 'text-[#296c00]' : 'text-[#707a67]'}`}>
                  {inspectorPost.approved ? 'Yes' : 'Not yet'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => onSelectPost(inspectorPost)}
                className="w-full bg-[#296c00] text-white font-label-caps text-xs py-3 rounded shadow-sm hover:bg-[#1f5700] active:scale-95 transition-all min-h-[44px] font-bold flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Edit post</span>
              </button>
              {onDeletePost && (
                <button
                  onClick={() => {
                    if (confirm(`Delete "${inspectorPost.title}"?`)) onDeletePost(inspectorPost.id);
                  }}
                  className="w-full bg-[#ffdad6] text-[#ba1a1a] font-label-caps text-xs py-2 rounded font-bold hover:bg-[#ba1a1a] hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete post</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-[#707a67]">
            <span className="material-symbols-outlined text-3xl text-[#bfcab4] block mb-2">ads_click</span>
            <p className="text-xs font-body-md">Pick a post from the calendar to see its details here.</p>
          </div>
        )}
      </aside>

      {/* Mobile Day Bottom Sheet Drawer */}
      {activeMobileDate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end sm:hidden">
          <div className="bg-[#FAF9F5] border-t border-[#bfcab4] rounded-t-2xl p-5 max-h-[80vh] flex flex-col space-y-4 shadow-2xl animate-slideUp">
            <div className="flex justify-between items-center pb-2 border-b border-[#bfcab4]">
              <div>
                <span className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">
                  Schedule Slot Summary
                </span>
                <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                  {activeMobileDate}
                </h3>
              </div>
              <button
                onClick={() => setActiveMobileDate(null)}
                className="p-2 text-[#707a67] hover:text-[#1b1c1a]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 max-h-60 pr-1">
              {(postsByDate[activeMobileDate] || []).length === 0 ? (
                <p className="text-xs font-body-md text-[#707a67] py-4 text-center">
                  No posts scheduled for this day yet.
                </p>
              ) : (
                (postsByDate[activeMobileDate] || []).map((post) => {
                  const brand = BRANDS[post.brandId];
                  return (
                    <div
                      key={post.id}
                      onClick={() => {
                        setSelectedPostForInspector(post);
                        onSelectPost(post);
                        setActiveMobileDate(null);
                      }}
                      style={{ borderLeftColor: brand?.primaryColor || '#296c00' }}
                      className="p-3 bg-white border border-[#bfcab4] border-l-4 rounded shadow-xs active:bg-[#efeeea]"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className="font-label-caps text-[10px] font-bold uppercase"
                          style={{ color: brand?.primaryColor || '#296c00' }}
                        >
                          {brand?.name}
                        </span>
                        <span className="font-code-sm text-[10px] text-[#707a67]">
                          {post.scheduledTime}
                        </span>
                      </div>
                      <h4 className="font-headline-md text-xs font-bold text-[#1b1c1a]">
                        {post.title}
                      </h4>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  const dateToPass = activeMobileDate;
                  setActiveMobileDate(null);
                  onOpenNewPostModal(dateToPass);
                }}
                className="w-full bg-[#296c00] text-white font-label-caps text-xs py-3 rounded font-bold min-h-[44px]"
              >
                + Schedule Post For This Date
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end flex-1 inner wrapper */}
    </div>
  );
};
