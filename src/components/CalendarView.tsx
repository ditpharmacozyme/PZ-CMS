import React, { useState, useMemo, useRef } from 'react';
import { Post, BrandId, PostStatus, Platform, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { toDateStr, todayStr, fromDateStr, mondayFirstDay, startOfWeek, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';
import { parseCalendarCsv, convertCsvRowsToPosts } from '../utils/researchParse';
import { getPostStatusConfig } from '../utils/statusConfig';
import { deriveStatus } from '../utils/postStatus';
import { isMine } from '../utils/postOwnership';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarFilters } from './calendar/CalendarFilters';
import { BulkActionsBar } from './calendar/BulkActionsBar';
import { CalendarMonthView } from './calendar/CalendarMonthView';
import { MobileDateStripView } from './calendar/MobileDateStripView';
import { CalendarWeekView } from './calendar/CalendarWeekView';
import { CalendarListView } from './calendar/CalendarListView';
import { IdeaBacklog } from './calendar/IdeaBacklog';

interface CalendarViewProps {
  posts: Post[];
  selectedBrandFilter: BrandId | 'all';
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  searchQuery: string;
  onSavePost: (post: Post) => void;
  onAddPost: (post: Post) => void;
  onBatchAddPosts?: (posts: Post[]) => void;
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
}

type CalendarDisplayMode = 'month' | 'week' | 'list';

interface PostFilters {
  brand: BrandId | 'all';
  status: PostStatus | 'all';
  platform: Platform | 'all';
  assignee: string;
  search: string;
  onlyMine: boolean;
  activeTeammate: TeamMember | null;
}

function matchesFilters(post: Post, f: PostFilters): boolean {
  if (f.brand !== 'all' && post.brandId !== f.brand) return false;
  if (f.status !== 'all' && deriveStatus(post) !== f.status) return false;
  if (f.platform !== 'all' && post.platform !== f.platform) return false;
  if (f.assignee !== 'all' && !post.assignees.includes(f.assignee)) return false;
  if (f.onlyMine && !isMine(post, f.activeTeammate)) return false;
  const query = f.search.trim().toLowerCase();
  if (query) {
    const haystack = [post.title, post.caption, ...post.assignees, ...post.tags];
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
  onBatchAddPosts,
  teamMembers = [],
  activeTeammate = null
}) => {
  const today = useMemo(() => new Date(), []);
  const todayIso = todayStr();
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // ── View State ──────────────────────────────────────────────────────────────
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('month');
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(todayIso);

  // ── Filter State ────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  // ── Multi-Select State ──────────────────────────────────────────────────────
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState<string>('');
  const [lastSelectedPostId, setLastSelectedPostId] = useState<string | null>(null);

  // ── Drag/Touch State ────────────────────────────────────────────────────────
  const [touchDraggedPostId, setTouchDraggedPostId] = useState<string | null>(null);
  const [touchHoverDate, setTouchHoverDate] = useState<string | null>(null);

  // ── Upload State ────────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Backlog State ───────────────────────────────────────────────────────────
  const [mobileBacklogOpen, setMobileBacklogOpen] = useState(false);
  const [clearCaptionsOnDuplicate, setClearCaptionsOnDuplicate] = useState(false);

  // ── Inspector State ─────────────────────────────────────────────────────────
  const [selectedPostForInspector, setSelectedPostForInspector] = useState<Post | null>(null);

  // ── Derived Data ────────────────────────────────────────────────────────────
  const defaultAssignee = teamMembers.length > 0 ? teamMembers[0].name : '';
  // Whoever is logged in, for *DoneBy attribution on quick stage toggles.
  const currentUserName = activeTeammate?.name || 'Someone';
  const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;

  const backlogPosts = useMemo(() => posts.filter((p) => !p.scheduledDate), [posts]);
  const calendarPosts = useMemo(() => posts.filter((p) => !!p.scheduledDate), [posts]);

  const filters: PostFilters = useMemo(
    () => ({ brand: selectedBrandFilter, status: statusFilter, platform: platformFilter, assignee: assigneeFilter, search: searchQuery, onlyMine, activeTeammate }),
    [selectedBrandFilter, statusFilter, platformFilter, assigneeFilter, searchQuery, onlyMine, activeTeammate]
  );

  const filteredBacklogPosts = useMemo(() => backlogPosts.filter((p) => matchesFilters(p, filters)), [backlogPosts, filters]);
  const filteredCalendarPosts = useMemo(() => calendarPosts.filter((p) => matchesFilters(p, filters)), [calendarPosts, filters]);

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.assignees.forEach((a) => a && set.add(a)));
    return Array.from(set);
  }, [posts]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const leadingBlanks = mondayFirstDay(new Date(currentYear, currentMonth, 1));
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });

  const calendarCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = leadingBlanks - 1; i >= 0; i--) {
      cells.push({ dateStr: '', dayNum: prevMonthDays - i, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: toDateStr(new Date(currentYear, currentMonth, d)), dayNum: d, isCurrentMonth: true });
    }
    for (let d = 1; cells.length % 7 !== 0; d++) {
      cells.push({ dateStr: '', dayNum: d, isCurrentMonth: false });
    }
    return cells;
  }, [currentYear, currentMonth, daysInMonth, leadingBlanks]);

  const recurrencePlaceholders = useMemo(() => {
    const placeholders: Record<string, any[]> = {};
    const recurringSeries = posts.filter((p) => p.recurrenceRule && p.recurrenceRule !== 'none');
    if (recurringSeries.length === 0) return placeholders;
    calendarCells.forEach((cell) => {
      if (!cell.dateStr) return;
      const cellDate = fromDateStr(cell.dateStr);
      const cellDay = cellDate.getDay();
      recurringSeries.forEach((series) => {
        let matches = false;
        if (series.recurrenceRule === 'weekly:monday' && cellDay === 1) matches = true;
        else if (series.recurrenceRule === 'weekly:friday' && cellDay === 5) matches = true;
        else if (series.recurrenceRule === 'monthly' && series.scheduledDate) {
          const sd = fromDateStr(series.scheduledDate);
          if (!isNaN(sd.getTime()) && sd.getDate() === cellDate.getDate()) matches = true;
        }
        if (matches) {
          const realPostsOnDay = posts.filter((p) => p.scheduledDate === cell.dateStr && p.brandId === series.brandId);
          const hasRealPost = realPostsOnDay.some((p) => p.title.includes(series.title) || p.templateId === series.templateId);
          if (!hasRealPost) {
            if (!placeholders[cell.dateStr]) placeholders[cell.dateStr] = [];
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
              assignees: series.assignees,
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

  const postsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredCalendarPosts.forEach((p) => {
      if (!map[p.scheduledDate]) map[p.scheduledDate] = [];
      map[p.scheduledDate].push(p);
    });
    Object.keys(recurrencePlaceholders).forEach((dateStr) => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr] = [...map[dateStr], ...recurrencePlaceholders[dateStr]];
    });
    return map;
  }, [filteredCalendarPosts, recurrencePlaceholders]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDraggedPostId) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellEl = targetEl?.closest('[data-date-cell]');
    const dateStr = cellEl?.getAttribute('data-date-cell');
    setTouchHoverDate(dateStr || null);
  };

  const handleTouchEnd = () => {
    if (touchDraggedPostId && touchHoverDate) {
      const draggedPost = posts.find((p) => p.id === touchDraggedPostId);
      if (draggedPost) {
        const actorName = activeTeammate ? activeTeammate.name : (draggedPost.assignees[0] || defaultAssignee || 'Someone');
        onSavePost({
          ...draggedPost,
          scheduledDate: touchHoverDate,
          scheduledTime: draggedPost.scheduledTime || '10:00',
          emailReminderEnabled: true,
          reminderEmail: draggedPost.reminderEmail || activeTeammate?.email || (teamMembers.length > 0 ? teamMembers[0].email : ''),
          activityLog: [
            { id: `act-${Date.now()}`, actor: actorName, action: `Scheduled/Moved to ${touchHoverDate}`, timestamp: logTimestamp() },
            ...draggedPost.activityLog
          ]
        });
      }
    }
    setTouchDraggedPostId(null);
    setTouchHoverDate(null);
  };

  const handleDropOnCell = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const postId = e.dataTransfer.getData('text/plain');
    const draggedPost = posts.find((p) => p.id === postId);
    if (draggedPost) {
      const wasUnscheduled = !draggedPost.scheduledDate;
      const actorName = activeTeammate ? activeTeammate.name : (draggedPost.assignees[0] || defaultAssignee || 'Someone');
      onSavePost({
        ...draggedPost,
        scheduledDate: dateStr,
        scheduledTime: draggedPost.scheduledTime || '10:00',
        emailReminderEnabled: true,
        reminderEmail: draggedPost.reminderEmail || activeTeammate?.email || (teamMembers.length > 0 ? teamMembers[0].email : ''),
        activityLog: [
          { id: `act-${Date.now()}`, actor: actorName, action: wasUnscheduled ? `Scheduled for ${dateStr}` : `Moved to ${dateStr}`, timestamp: logTimestamp() },
          ...draggedPost.activityLog
        ]
      });
    }
  };

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
      assignees: placeholder.assignees || [],
      visualUrl: placeholder.visualUrl,
      approved: false,
      emailReminderEnabled: true,
      reminderEmail: activeTeammate?.email || (teamMembers.length > 0 ? teamMembers[0].email : ''),
      tags: ['RecurrentSlot'],
      comments: [],
      activityLog: [{ id: `act-${Date.now()}`, actor: activeTeammate?.name || placeholder.assignees?.[0] || defaultAssignee || 'Someone', action: 'Created from a repeating slot', timestamp: logTimestamp() }]
    };
    onAddPost(materialized);
    onSelectPost(materialized);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetPost?: Post, targetDate?: string) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);
      if (targetPost) {
        onSavePost({ ...targetPost, visualUrl: url, activityLog: [{ id: `act-${Date.now()}`, actor: targetPost.assignees[0] || defaultAssignee || 'Someone', action: `Added image "${file.name}"`, timestamp: logTimestamp() }, ...targetPost.activityLog] });
      } else {
        const newPost: Post = { id: `post-${Date.now()}`, brandId: selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter, title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled post', caption: '', platform: 'instagram', specType: 'feed-post', scheduledDate: targetDate || '', scheduledTime: targetDate ? '10:00' : '', status: 'not-started', assignees: defaultAssignee ? [defaultAssignee] : [], visualUrl: url, approved: false, emailReminderEnabled: !!targetDate, reminderEmail: activeTeammate?.email || (teamMembers.length > 0 ? teamMembers[0].email : ''), tags: [], comments: [], activityLog: [{ id: `act-${Date.now()}`, actor: defaultAssignee || 'Someone', action: `Created from image "${file.name}"`, timestamp: logTimestamp() }] };
        onAddPost(newPost);
        onSelectPost(newPost);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onBatchAddPosts) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const text = await file.text();
      const result = parseCalendarCsv(text);
      if (result.error) { setUploadError(`CSV Import Error: ${result.error}`); return; }
      if (result.rows) {
        const brandFallback = selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter;
        const ownerFallback = activeTeammate?.name || teamMembers[0]?.name || '';
        const ownerEmailFallback = activeTeammate?.email || teamMembers[0]?.email || '';
        const postsToImport = convertCsvRowsToPosts(result.rows, brandFallback, ownerFallback, ownerEmailFallback);
        onBatchAddPosts(postsToImport);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to read CSV.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePrev = () => {
    if (displayMode === 'week') {
      setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; });
    } else if (currentMonth === 0) {
      setCurrentMonth(11); setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (displayMode === 'week') {
      setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; });
    } else if (currentMonth === 11) {
      setCurrentMonth(0); setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setWeekStart(startOfWeek(now));
    setSelectedMobileDate(todayIso);
  };

  const toggleSelectPost = (postId: string, e?: React.MouseEvent | React.TouchEvent | React.ChangeEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (e && 'shiftKey' in e && e.shiftKey && lastSelectedPostId && displayMode === 'list') {
        const postIds = filteredCalendarPosts.map((p) => p.id);
        const startIdx = postIds.indexOf(lastSelectedPostId);
        const endIdx = postIds.indexOf(postId);
        if (startIdx !== -1 && endIdx !== -1) {
          const minIdx = Math.min(startIdx, endIdx);
          const maxIdx = Math.max(startIdx, endIdx);
          for (let i = minIdx; i <= maxIdx; i++) next.add(postIds[i]);
          setLastSelectedPostId(postId);
          return next;
        }
      }
      if (next.has(postId)) { next.delete(postId); setLastSelectedPostId(null); }
      else { next.add(postId); setLastSelectedPostId(postId); }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPostIds(new Set());
    setBulkAssignee('');
  };

  const applyBulkAssignee = (assignee: string) => {
    filteredCalendarPosts.filter((p) => selectedPostIds.has(p.id)).forEach((post) => {
      onSavePost({ ...post, assignees: assignee ? [assignee] : [], activityLog: [{ id: `act-${Date.now()}-${post.id}`, actor: assignee || 'Someone', action: `Reassigned to ${assignee || 'nobody'} (bulk update)`, timestamp: logTimestamp() }, ...post.activityLog] });
    });
    setBulkAssignee('');
    clearSelection();
  };

  const handleBulkDelete = () => {
    if (selectedPostIds.size === 0 || !onDeletePost) return;
    const count = selectedPostIds.size;
    if (window.confirm(`Are you sure you want to delete ${count} selected post${count > 1 ? 's' : ''}?`)) {
      Array.from(selectedPostIds).forEach((id) => onDeletePost(id));
      clearSelection();
    }
  };

  const handleDuplicateWeekForward = () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = toDateStr(weekEnd);
    const weekStartStr = toDateStr(weekStart);
    const postsThisWeek = posts.filter((p) => p.scheduledDate && p.scheduledDate >= weekStartStr && p.scheduledDate <= weekEndStr);
    if (postsThisWeek.length === 0) { alert('No posts scheduled this week to duplicate.'); return; }
    if (!confirm(`Duplicate ${postsThisWeek.length} post${postsThisWeek.length === 1 ? '' : 's'} to next week?`)) return;
    postsThisWeek.forEach((post) => {
      const originalDate = fromDateStr(post.scheduledDate);
      const nextWeekDate = new Date(originalDate);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const actorName = activeTeammate ? activeTeammate.name : (post.assignees[0] || defaultAssignee || 'Someone');
      const duplicated: Post = {
        ...post,
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scheduledDate: toDateStr(nextWeekDate),
        status: 'not-started',
        approved: false,
        approvedBy: undefined,
        caption: clearCaptionsOnDuplicate ? '' : post.caption,
        activityLog: [{ id: `act-${Date.now()}`, actor: actorName, action: `Duplicated from week of ${weekStartStr}`, timestamp: logTimestamp() }]
      };
      onAddPost(duplicated);
    });
  };

  const hasActiveFilters = statusFilter !== 'all' || platformFilter !== 'all' || assigneeFilter !== 'all' || onlyMine || !!searchQuery.trim();
  const inspectorPost = selectedPostForInspector;

  return (
    <div className="flex-1 flex flex-row bg-[#FAF9F5] min-h-screen">
      {/* ── Idea Backlog (desktop sidebar + mobile sheet) ── */}
      <IdeaBacklog
        filteredBacklogPosts={filteredBacklogPosts}
        isMobileDevice={isMobileDevice}
        touchDraggedPostId={touchDraggedPostId}
        onTouchStart={(postId) => setTouchDraggedPostId(postId)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onSelectPost={onSelectPost}
        onSavePost={onSavePost}
        onAddPost={onAddPost}
        onImageUpload={(e) => handleImageFileUpload(e)}
        setMobileBacklogOpen={setMobileBacklogOpen}
        selectedBrandFilter={selectedBrandFilter}
        activeTeammate={activeTeammate}
        defaultAssignee={defaultAssignee}
        mobileBacklogOpen={mobileBacklogOpen}
      />

      {/* ── Main Schedule Canvas ── */}
      <div className="flex-1 flex flex-col xl:flex-row bg-[#FAF9F5] min-h-screen overflow-hidden relative">
        {isUploading && (
          <div className="absolute inset-0 bg-[#FAF9F5]/75 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div className="w-8 h-8 rounded-full border-2 border-[#296c00] border-t-transparent animate-spin mb-2" />
            <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase tracking-wider">Uploading Image...</p>
          </div>
        )}

        <div className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Header + Navigation */}
          <CalendarHeader
            displayMode={displayMode}
            setDisplayMode={(mode) => { setDisplayMode(mode); clearSelection(); }}
            selectedBrandFilter={selectedBrandFilter}
            currentYear={currentYear}
            currentMonth={currentMonth}
            monthName={monthName}
            weekStart={weekStart}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleGoToToday}
            onOpenNewPostModal={onOpenNewPostModal}
            onCsvFileSelect={handleCsvImport}
            csvFileInputRef={csvFileInputRef}
            isUploading={isUploading}
            mobileBacklogOpen={mobileBacklogOpen}
            setMobileBacklogOpen={setMobileBacklogOpen}
            backlogCount={filteredBacklogPosts.length}
            onDuplicateWeekForward={handleDuplicateWeekForward}
          />

          {/* Filter Strip */}
          <CalendarFilters
            searchQuery={searchQuery}
            onSearchChange={() => {}} // searchQuery is owned by TopNav / App
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
            assigneeFilter={assigneeFilter}
            setAssigneeFilter={setAssigneeFilter}
            uniqueAssignees={uniqueAssignees}
            onClearFilters={() => { setStatusFilter('all'); setPlatformFilter('all'); setAssigneeFilter('all'); setOnlyMine(false); }}
            hasActiveFilters={hasActiveFilters}
            activeTeammate={activeTeammate}
            isMyPostsActive={onlyMine}
            onToggleMyPosts={() => setOnlyMine((v) => !v)}
          />

          {/* Bulk Actions (select mode banner + floating bar) */}
          <BulkActionsBar
            selectedCount={selectedPostIds.size}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
            onSelectAll={() => setSelectedPostIds(new Set(filteredCalendarPosts.map((p) => p.id)))}
            onClearSelection={clearSelection}
            bulkAssignee={bulkAssignee}
            onApplyBulkAssignee={applyBulkAssignee}
            onBulkDelete={handleBulkDelete}
            teamMembers={teamMembers}
          />

          {uploadError && (
            <div className="bg-[#ffdad6] border border-[#ffb4ab] text-[#ba1a1a] text-xs font-body-md p-3 rounded">
              {uploadError}
            </div>
          )}

          {/* ── MONTH VIEW ── */}
          {displayMode === 'month' && (
            <div className="bg-white border border-[#bfcab4] shadow-xs rounded-sm overflow-hidden">
              {/* Mobile Strip View */}
              <MobileDateStripView
                calendarCells={calendarCells}
                postsByDate={postsByDate}
                todayIso={todayIso}
                selectedMobileDate={selectedMobileDate}
                onSelectMobileDate={setSelectedMobileDate}
                onOpenNewPostModal={onOpenNewPostModal}
                onSelectPost={(post) => { setSelectedPostForInspector(post); onSelectPost(post); }}
                selectedPostIds={selectedPostIds}
                isSelectMode={isSelectMode}
                onToggleSelect={toggleSelectPost}
                onLongPressPost={(postId) => { setIsSelectMode(true); if (!selectedPostIds.has(postId)) toggleSelectPost(postId); }}
                teamMembers={teamMembers}
                onSavePost={onSavePost}
                currentUserName={currentUserName}
              />
              {/* Desktop Month Grid */}
              <CalendarMonthView
                calendarCells={calendarCells}
                postsByDate={postsByDate}
                todayIso={todayIso}
                touchHoverDate={touchHoverDate}
                selectedPostIds={selectedPostIds}
                isSelectMode={isSelectMode}
                isMobileDevice={isMobileDevice}
                onSelectPost={(post) => { setSelectedPostForInspector(post); onSelectPost(post); }}
                onOpenNewPostModal={onOpenNewPostModal}
                onDropOnCell={handleDropOnCell}
                onToggleSelect={toggleSelectPost}
                onPlaceholderClick={handlePlaceholderClick}
                onImageUpload={handleImageFileUpload}
                teamMembers={teamMembers}
                onSavePost={onSavePost}
                currentUserName={currentUserName}
              />
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {displayMode === 'week' && (
            <CalendarWeekView
              weekStart={weekStart}
              setWeekStart={setWeekStart}
              postsByDate={postsByDate}
              todayIso={todayIso}
              touchHoverDate={touchHoverDate}
              selectedPostIds={selectedPostIds}
              isSelectMode={isSelectMode}
              isMobileDevice={isMobileDevice}
              clearCaptionsOnDuplicate={clearCaptionsOnDuplicate}
              onSetClearCaptionsOnDuplicate={setClearCaptionsOnDuplicate}
              onDuplicateWeekForward={handleDuplicateWeekForward}
              onDropOnCell={handleDropOnCell}
              onSelectPost={(post) => { setSelectedPostForInspector(post); onSelectPost(post); }}
              onOpenNewPostModal={onOpenNewPostModal}
              onToggleSelect={toggleSelectPost}
              teamMembers={teamMembers}
              onSavePost={onSavePost}
              currentUserName={currentUserName}
            />
          )}

          {/* ── LIST VIEW ── */}
          {displayMode === 'list' && (
            <CalendarListView
              filteredCalendarPosts={filteredCalendarPosts}
              selectedPostIds={selectedPostIds}
              isSelectMode={isSelectMode}
              bulkAssignee={bulkAssignee}
              onApplyBulkAssignee={applyBulkAssignee}
              uniqueAssignees={uniqueAssignees}
              onClearSelection={clearSelection}
              onSelectPost={(post) => { setSelectedPostForInspector(post); onSelectPost(post); }}
              onDeletePost={onDeletePost}
              onSavePost={onSavePost}
              onToggleSelect={toggleSelectPost}
              setSelectedPostIds={setSelectedPostIds}
              currentUserName={currentUserName}
            />
          )}
        </div>

        {/* Right Side Inspector Panel */}
        <aside className="w-full xl:w-80 border-t xl:border-t-0 xl:border-l border-[#bfcab4] bg-[#faf9f5] p-4 sm:p-6 space-y-5">
          <div className="pb-3 border-b border-[#bfcab4] flex items-center justify-between">
            <div>
              <span className="font-label-caps text-xs text-[#296951] uppercase font-bold">Selected post</span>
              <h3 className="font-headline-md text-lg sm:text-xl font-bold text-[#1b1c1a] mt-0.5">
                {inspectorPost ? inspectorPost.title : 'Nothing selected'}
              </h3>
            </div>
          </div>

          {inspectorPost ? (
            <div className="space-y-5 text-xs font-body-md text-[#1b1c1a]">
              {/* Image Preview */}
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block mb-2 uppercase">Image</label>
                <div className="h-36 sm:h-40 w-full bg-white border border-[#bfcab4] rounded overflow-hidden flex items-center justify-center relative">
                  {inspectorPost.visualUrl ? (
                    <img src={inspectorPost.visualUrl} alt={inspectorPost.title} className="w-full h-full object-cover" />
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
                <label className={`mt-2 w-full bg-white border border-[#296c00] text-[#296c00] hover:bg-[#296c00] hover:text-white font-label-caps text-xs py-1.5 px-3 rounded font-bold transition-colors flex items-center justify-center gap-1.5 ${isUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                  <span className="material-symbols-outlined text-sm">upload</span>
                  <span>{isUploading ? 'Uploading…' : inspectorPost.visualUrl ? 'Replace image' : 'Upload image'}</span>
                  <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, inspectorPost)} className="hidden" />
                </label>
                {uploadError && (
                  <p className="mt-2 text-[11px] font-body-md text-[#ba1a1a] bg-[#ffdad6] border border-[#ffb4ab] rounded p-2">{uploadError}</p>
                )}
              </div>

              {/* Post Details */}
              <div className="space-y-2.5">
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold">Details</label>
                {[
                  ['Brand', <span key="brand" className="font-label-caps font-bold text-[#296c00]">{BRANDS[inspectorPost.brandId]?.name}</span>],
                  ['Owner', <span key="owner" className="font-label-caps font-bold">{inspectorPost.assignees.length > 0 ? inspectorPost.assignees.join(', ') : 'Unassigned'}</span>],
                  ['Status', (() => { const st = getPostStatusConfig(inspectorPost); return <span key="status" className="font-label-caps text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: st.bgColor, color: st.color }}>{st.icon && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{st.icon}</span>}{st.label}</span>; })()],
                  ['Reminder', <span key="reminder" className="font-code-sm font-bold text-[#296951]">{inspectorPost.scheduledDate ? `${inspectorPost.scheduledDate} ${inspectorPost.scheduledTime || '10:00'}` : 'No date set'}</span>],
                  ['Approved', <span key="approved" className={`font-label-caps font-bold ${inspectorPost.approved ? 'text-[#296c00]' : 'text-[#707a67]'}`}>{inspectorPost.approved ? 'Yes' : 'Not yet'}</span>],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-1 border-b border-[#bfcab4]/50">
                    <span className="text-[#707a67]">{label}</span>
                    {value}
                  </div>
                ))}
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
                    onClick={() => { if (confirm(`Delete "${inspectorPost.title}"?`)) onDeletePost(inspectorPost.id); }}
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
      </div>
    </div>
  );
};
