import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { Post, BrandId, PostStatus, Platform, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { toDateStr, todayStr, fromDateStr, mondayFirstDay, startOfWeek, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';
import { parseCalendarCsv, convertCsvRowsToPosts } from '../utils/researchParse';
import { getPostStatusConfig } from '../utils/statusConfig';
import { deriveStatus } from '../utils/postStatus';
import { isMine, combineAssigneeEmails } from '../utils/postOwnership';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarFilters } from './calendar/CalendarFilters';
import { BulkActionsBar } from './calendar/BulkActionsBar';
import { CalendarMonthView } from './calendar/CalendarMonthView';
import { MobileDateStripView } from './calendar/MobileDateStripView';
import { CalendarWeekView } from './calendar/CalendarWeekView';
import { CalendarListView } from './calendar/CalendarListView';
import { IdeaBacklog } from './calendar/IdeaBacklog';
import { useConfirm } from './ui/ConfirmDialog';
import { buildQuickPost } from '../utils/quickPost';

interface CalendarViewProps {
  posts: Post[];
  selectedBrandFilter: BrandId | 'all';
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSavePost: (post: Post, opts?: { silent?: boolean }) => void;
  onAddPost: (post: Post) => void;
  onBatchAddPosts?: (posts: Post[]) => void;
  onBatchSavePosts?: (posts: Post[], toastMessage?: string) => void;
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
  showToast?: (
    message: string,
    action?: { label: string; onClick: () => void },
    durationMs?: number,
    variant?: 'success' | 'error'
  ) => void;
}

type CalendarDisplayMode = 'month' | 'week' | 'list';

// The calendar unmounts on every tab switch, so its view mode and filters
// used to reset to Month / all every time. Persist them locally (this also
// wires up what useSmartMemory's orphaned calendarDisplayMode/status/platform
// keys were meant to do, in one place instead of three half-declared ones).
const CAL_PREFS_KEY = 'pz_smart_cal_prefs';
interface CalendarPrefs {
  displayMode: CalendarDisplayMode;
  statusFilter: PostStatus | 'all';
  platformFilter: Platform | 'all';
  assigneeFilter: string;
  onlyMine: boolean;
}
const DEFAULT_CAL_PREFS: CalendarPrefs = {
  displayMode: 'month',
  statusFilter: 'all',
  platformFilter: 'all',
  assigneeFilter: 'all',
  onlyMine: false,
};
function readCalPrefs(): CalendarPrefs {
  if (typeof window === 'undefined') return DEFAULT_CAL_PREFS;
  try {
    const raw = localStorage.getItem(CAL_PREFS_KEY);
    if (raw) return { ...DEFAULT_CAL_PREFS, ...JSON.parse(raw) };
  } catch (_) {}
  return DEFAULT_CAL_PREFS;
}

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
  onSearchChange,
  onSavePost,
  onAddPost,
  onBatchAddPosts,
  onBatchSavePosts,
  teamMembers = [],
  activeTeammate = null,
  showToast
}) => {
  const confirm = useConfirm();
  // The search box stays on the live prop; filtering (and the grid re-render
  // it triggers) reads the deferred value so a fast typist isn't re-filtering
  // every post on every keystroke.
  const deferredSearch = useDeferredValue(searchQuery);
  const today = useMemo(() => new Date(), []);
  const todayIso = todayStr();
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // ── View + Filter State (persisted -- survives tab switches) ─────────────────
  const [initialPrefs] = useState(readCalPrefs);
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>(initialPrefs.displayMode);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(todayIso);

  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>(initialPrefs.statusFilter);
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>(initialPrefs.platformFilter);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(initialPrefs.assigneeFilter);
  const [onlyMine, setOnlyMine] = useState<boolean>(initialPrefs.onlyMine);

  useEffect(() => {
    try {
      localStorage.setItem(
        CAL_PREFS_KEY,
        JSON.stringify({ displayMode, statusFilter, platformFilter, assigneeFilter, onlyMine })
      );
    } catch (_) {}
  }, [displayMode, statusFilter, platformFilter, assigneeFilter, onlyMine]);

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

  // Quick stage toggles on cards/rows are one tap and the row can vanish from a
  // filtered view straight after -- MyWork solves this with sessionPins, the
  // calendar had nothing. Wrap onSavePost so a stage-only change (the shape a
  // quick toggle produces) also raises an Undo toast that restores the snapshot.
  const handleSavePostWithUndo = (updated: Post) => {
    const original = posts.find((p) => p.id === updated.id);
    const stageChanged =
      !!original &&
      JSON.stringify(original.stageCompletion || {}) !== JSON.stringify(updated.stageCompletion || {});
    // For a stage toggle we show our own Undo toast, so suppress the generic
    // "Saved" one -- otherwise every toggle stacks two toasts.
    onSavePost(updated, stageChanged && showToast ? { silent: true } : undefined);
    if (!stageChanged || !showToast || !original) return;
    const snapshot = original;
    showToast('Stage updated', { label: 'Undo', onClick: () => onSavePost(snapshot) }, 5000);
  };
  // Reactive to resize/rotation -- a one-time `window.innerWidth` read at mount
  // used to leave desktop drag-and-drop disabled forever if the window opened
  // narrow and was then widened (or vice versa) without a full reload.
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const backlogPosts = useMemo(() => posts.filter((p) => !p.scheduledDate), [posts]);
  const calendarPosts = useMemo(() => posts.filter((p) => !!p.scheduledDate), [posts]);

  const filters: PostFilters = useMemo(
    () => ({ brand: selectedBrandFilter, status: statusFilter, platform: platformFilter, assignee: assigneeFilter, search: deferredSearch, onlyMine, activeTeammate }),
    [selectedBrandFilter, statusFilter, platformFilter, assigneeFilter, deferredSearch, onlyMine, activeTeammate]
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

  // Week view's desktop grid (CalendarWeekView) is `hidden md:block` with no
  // mobile counterpart of its own -- choosing Week on a phone used to render
  // nothing at all. Reuse the same MobileDateStripView Month view already
  // relies on (it self-hides via `md:hidden`), just scoped to this week's 7
  // days instead of the whole month grid.
  const weekCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      cells.push({ dateStr: toDateStr(d), dayNum: d.getDate(), isCurrentMonth: true });
    }
    return cells;
  }, [weekStart]);

  // recurrencePlaceholders is O(cells x series x posts). It only cares about a
  // post's date / brand / title / templateId / recurrenceRule -- never its
  // stage or status -- so keying the memo on a projection of just those fields
  // keeps a stage toggle (which rewrites `posts`) from re-running the whole
  // sweep on every click.
  const recurrenceInputKey = useMemo(
    () =>
      posts
        .map((p) =>
          [
            p.id, p.scheduledDate, p.brandId, p.title, p.templateId || '', p.recurrenceRule || '',
            // Every field the placeholder objects below copy from the series --
            // otherwise editing e.g. a caption leaves stale ghost cards on the
            // month, and handlePlaceholderClick would materialize the old copy.
            p.caption, p.platform, p.specType, p.scheduledTime, p.visualUrl, (p.assignees || []).join(','),
          ].join('|')
        )
        .join('¦'),
    [posts]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recurrenceInputKey is a stable projection of the only `posts` fields this uses
  }, [recurrenceInputKey, calendarCells]);

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
          // Scheduling a previously-undated idea arms the reminder; moving an
          // already-dated post preserves whatever the user set (so a
          // reschedule never silently re-arms one they turned off). The
          // storage layer can't tell undefined from false, so "was undated"
          // is the reliable "brand new" signal.
          emailReminderEnabled: !draggedPost.scheduledDate ? true : draggedPost.emailReminderEnabled !== false,
          reminderEmail: draggedPost.reminderEmail || combineAssigneeEmails(draggedPost.assignees, teamMembers) || undefined,
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
        emailReminderEnabled: !draggedPost.scheduledDate ? true : draggedPost.emailReminderEnabled !== false,
        reminderEmail: draggedPost.reminderEmail || combineAssigneeEmails(draggedPost.assignees, teamMembers) || undefined,
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
      reminderEmail: combineAssigneeEmails(placeholder.assignees || [], teamMembers) || undefined,
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
        // Prefer the logged-in user over "first person in the roster" -- a
        // quick-created post used to always land on whoever is
        // alphabetically/chronologically first in teamMembers, not on you.
        const imageCreateAssignee = activeTeammate?.name || defaultAssignee;
        const newPost: Post = { id: `post-${Date.now()}`, brandId: selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter, title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled post', caption: '', platform: 'instagram', specType: 'feed-post', scheduledDate: targetDate || '', scheduledTime: targetDate ? '10:00' : '', status: 'not-started', assignees: imageCreateAssignee ? [imageCreateAssignee] : [], visualUrl: url, approved: false, emailReminderEnabled: !!targetDate, reminderEmail: combineAssigneeEmails(imageCreateAssignee ? [imageCreateAssignee] : [], teamMembers) || undefined, tags: [], comments: [], activityLog: [{ id: `act-${Date.now()}`, actor: imageCreateAssignee || 'Someone', action: `Created from image "${file.name}"`, timestamp: logTimestamp() }] };
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

  const shiftWeek = (deltaDays: number) => {
    const n = new Date(weekStart);
    n.setDate(n.getDate() + deltaDays);
    setWeekStart(n);
    // Keep the month/year (and the month picker) in step with the visible week.
    setCurrentYear(n.getFullYear());
    setCurrentMonth(n.getMonth());
  };

  const handlePrev = () => {
    if (displayMode === 'week') {
      shiftWeek(-7);
    } else if (currentMonth === 0) {
      setCurrentMonth(11); setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (displayMode === 'week') {
      shiftWeek(7);
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

  const handleJumpToMonth = (value: string) => {
    // value is "YYYY-MM" from a native month input.
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return;
    setCurrentYear(y);
    setCurrentMonth(m - 1);
    setWeekStart(startOfWeek(new Date(y, m - 1, 1)));
  };

  // Calendar-scoped keyboard shortcuts: t = today, m/w/l = view modes,
  // arrows = prev/next period. Suppressed while typing or when a dialog/
  // modal is focused (the app shell's own N / / / Cmd-K keep working).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      switch (e.key) {
        case 't': case 'T': handleGoToToday(); break;
        case 'm': case 'M': setDisplayMode('month'); break;
        case 'w': case 'W': setDisplayMode('week'); break;
        case 'l': case 'L': setDisplayMode('list'); break;
        case 'ArrowLeft': handlePrev(); break;
        case 'ArrowRight': handleNext(); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

  // Additive (adds the chosen person without dropping existing co-assignees --
  // the previous version replaced the whole `assignees` array with just this
  // one name), spans both dated posts AND the backlog (previously only
  // filteredCalendarPosts, so unscheduled ideas -- the ones most likely to
  // need an owner -- couldn't be bulk-assigned at all), and batched through
  // onBatchSavePosts for one Supabase round-trip and one undoable toast
  // instead of N separate saves and N toasts.
  const applyBulkAssignee = (assignee: string) => {
    if (!assignee) return;
    const selected = [...filteredCalendarPosts, ...filteredBacklogPosts].filter((p) => selectedPostIds.has(p.id));
    if (selected.length === 0) { setBulkAssignee(''); return; }

    const actorName = activeTeammate ? activeTeammate.name : (assignee || 'Someone');
    const updated = selected
      .filter((post) => !post.assignees.includes(assignee))
      .map((post) => ({
        ...post,
        assignees: [...post.assignees, assignee],
        activityLog: [
          { id: `act-${Date.now()}-${post.id}`, actor: actorName, action: `Added ${assignee} as an assignee (bulk update)`, timestamp: logTimestamp() },
          ...post.activityLog
        ]
      }));

    if (updated.length > 0) {
      if (onBatchSavePosts) {
        onBatchSavePosts(updated, `Assigned ${assignee} to ${updated.length} post${updated.length > 1 ? 's' : ''}`);
      } else {
        updated.forEach((post) => onSavePost(post));
      }
    }
    setBulkAssignee('');
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (selectedPostIds.size === 0 || !onDeletePost) return;
    const count = selectedPostIds.size;
    const ok = await confirm({
      title: `Delete ${count} selected post${count > 1 ? 's' : ''}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      Array.from(selectedPostIds).forEach((id) => onDeletePost(id));
      clearSelection();
    }
  };

  const handleDuplicateWeekForward = async () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = toDateStr(weekEnd);
    const weekStartStr = toDateStr(weekStart);
    const postsThisWeek = posts.filter((p) => p.scheduledDate && p.scheduledDate >= weekStartStr && p.scheduledDate <= weekEndStr);
    if (postsThisWeek.length === 0) { showToast?.('No posts scheduled this week to duplicate.', undefined, 3000, 'error'); return; }
    const ok = await confirm({ title: `Duplicate ${postsThisWeek.length} post${postsThisWeek.length === 1 ? '' : 's'} to next week?`, confirmLabel: 'Duplicate' });
    if (!ok) return;
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
    <div className="flex-1 flex flex-row bg-[#f4f4f3] min-h-screen">
      {/* ── Idea Backlog (desktop sidebar + mobile sheet) ── */}
      <IdeaBacklog
        filteredBacklogPosts={filteredBacklogPosts}
        isMobileDevice={isMobileDevice}
        touchDraggedPostId={touchDraggedPostId}
        onTouchStart={(postId) => setTouchDraggedPostId(postId)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onSelectPost={onSelectPost}
        onSavePost={handleSavePostWithUndo}
        onAddPost={onAddPost}
        onImageUpload={(e) => handleImageFileUpload(e)}
        setMobileBacklogOpen={setMobileBacklogOpen}
        selectedBrandFilter={selectedBrandFilter}
        activeTeammate={activeTeammate}
        defaultAssignee={defaultAssignee}
        mobileBacklogOpen={mobileBacklogOpen}
        teamMembers={teamMembers}
        selectedPostIds={selectedPostIds}
        isSelectMode={isSelectMode}
        onToggleSelect={toggleSelectPost}
      />

      {/* ── Main Schedule Canvas ── */}
      <div className="flex-1 flex flex-col xl:flex-row bg-[#f4f4f3] min-h-screen overflow-hidden relative">
        {isUploading && (
          <div className="absolute inset-0 bg-[#f4f4f3]/75 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div className="w-8 h-8 rounded-full border-2 border-[#4f46e5] border-t-transparent animate-spin mb-2" />
            <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold tracking-wider">Uploading Image...</p>
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
            onJumpToMonth={handleJumpToMonth}
            onOpenNewPostModal={onOpenNewPostModal}
            onCsvFileSelect={handleCsvImport}
            csvFileInputRef={csvFileInputRef}
            isUploading={isUploading}
            mobileBacklogOpen={mobileBacklogOpen}
            setMobileBacklogOpen={setMobileBacklogOpen}
            backlogCount={filteredBacklogPosts.length}
            onDuplicateWeekForward={handleDuplicateWeekForward}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
          />

          {/* Filter Strip */}
          <CalendarFilters
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
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
            <div className="bg-[#fcebeb] border border-[#ffb4ab] text-[#dc2626] text-xs font-body-md p-3 rounded">
              {uploadError}
            </div>
          )}

          {/* ── MONTH VIEW ── */}
          {displayMode === 'month' && (
            <div className="bg-white border border-[#e9e9e7] shadow-xs rounded-sm overflow-hidden">
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
                onSavePost={handleSavePostWithUndo}
                currentUserName={currentUserName}
                touchDraggedPostId={touchDraggedPostId}
                touchHoverDate={touchHoverDate}
                onTouchStart={(postId) => setTouchDraggedPostId(postId)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                activeTeammate={activeTeammate}
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
                onInlineCreate={(title, dateStr) =>
                  onAddPost(
                    buildQuickPost(title, {
                      brandFilter: selectedBrandFilter,
                      assignee: activeTeammate?.name || defaultAssignee,
                      scheduledDate: dateStr,
                    })
                  )
                }
                onDropOnCell={handleDropOnCell}
                onToggleSelect={toggleSelectPost}
                onPlaceholderClick={handlePlaceholderClick}
                onImageUpload={handleImageFileUpload}
                teamMembers={teamMembers}
                onSavePost={handleSavePostWithUndo}
                currentUserName={currentUserName}
                activeTeammate={activeTeammate}
              />
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {displayMode === 'week' && (
            <>
              {/* Mobile Strip View -- CalendarWeekView below is desktop-only */}
              <MobileDateStripView
                calendarCells={weekCells}
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
                onSavePost={handleSavePostWithUndo}
                currentUserName={currentUserName}
                touchDraggedPostId={touchDraggedPostId}
                touchHoverDate={touchHoverDate}
                onTouchStart={(postId) => setTouchDraggedPostId(postId)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                activeTeammate={activeTeammate}
              />
              <CalendarWeekView
                weekStart={weekStart}
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
                onSavePost={handleSavePostWithUndo}
                currentUserName={currentUserName}
                activeTeammate={activeTeammate}
              />
            </>
          )}

          {/* ── LIST VIEW ── */}
          {displayMode === 'list' && (
            <CalendarListView
              filteredCalendarPosts={filteredCalendarPosts}
              selectedPostIds={selectedPostIds}
              isSelectMode={isSelectMode}
              onSelectPost={(post) => { setSelectedPostForInspector(post); onSelectPost(post); }}
              onDeletePost={onDeletePost}
              onSavePost={handleSavePostWithUndo}
              onToggleSelect={toggleSelectPost}
              setSelectedPostIds={setSelectedPostIds}
              currentUserName={currentUserName}
              teamMembers={teamMembers}
              activeTeammate={activeTeammate}
            />
          )}
        </div>

        {/* Right Side Inspector Panel -- desktop-only. Selecting a post always
            opens the full PostDetailModal too (see onSelectPost below), so
            below `xl` this panel was pure duplicate real estate: a blank
            "Nothing selected" strip sitting under every phone/tablet calendar
            with no way to interact with it that the modal didn't already cover. */}
        <aside className="hidden xl:block xl:w-80 xl:border-l border-[#e9e9e7] bg-[#f4f4f3] p-4 sm:p-6 space-y-5">
          <div className="pb-3 border-b border-[#e9e9e7] flex items-center justify-between">
            <div>
              <span className="font-label-caps text-xs text-[#4338ca] font-bold">Selected post</span>
              <h3 className="font-headline-md text-lg sm:text-xl font-bold text-[#1b1c1a] mt-0.5">
                {inspectorPost ? inspectorPost.title : 'Nothing selected'}
              </h3>
            </div>
          </div>

          {inspectorPost ? (
            <div className="space-y-5 text-xs font-body-md text-[#1b1c1a]">
              {/* Image Preview */}
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block mb-2">Image</label>
                <div className="h-36 sm:h-40 w-full bg-white border border-[#e9e9e7] rounded overflow-hidden flex items-center justify-center relative">
                  {inspectorPost.visualUrl ? (
                    <img src={inspectorPost.visualUrl} alt={inspectorPost.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 text-[#5f5f5b]">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <p className="font-label-caps text-[10px] mt-1">No image yet</p>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-[#1b1c1a]/80 text-white font-label-caps text-[9px] px-2 py-0.5 rounded">
                    {SPECS[inspectorPost.specType]?.dimensions || inspectorPost.specType}
                  </span>
                </div>
                <label className={`mt-2 w-full bg-white border border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white font-label-caps text-xs py-1.5 px-3 rounded font-bold transition-colors flex items-center justify-center gap-1.5 ${isUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                  <span className="material-symbols-outlined text-sm">upload</span>
                  <span>{isUploading ? 'Uploading…' : inspectorPost.visualUrl ? 'Replace image' : 'Upload image'}</span>
                  <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, inspectorPost)} className="hidden" />
                </label>
                {uploadError && (
                  <p className="mt-2 text-[11px] font-body-md text-[#dc2626] bg-[#fcebeb] border border-[#ffb4ab] rounded p-2">{uploadError}</p>
                )}
              </div>

              {/* Post Details */}
              <div className="space-y-2.5">
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold">Details</label>
                {[
                  ['Brand', <span key="brand" className="font-label-caps font-bold text-[#4f46e5]">{BRANDS[inspectorPost.brandId]?.name}</span>],
                  ['Owner', <span key="owner" className="font-label-caps font-bold">{inspectorPost.assignees.length > 0 ? inspectorPost.assignees.join(', ') : 'Unassigned'}</span>],
                  ['Status', (() => { const st = getPostStatusConfig(inspectorPost); return <span key="status" className="font-label-caps text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: st.bgColor, color: st.color }}>{st.icon && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{st.icon}</span>}{st.label}</span>; })()],
                  ['Reminder', <span key="reminder" className="font-code-sm font-bold text-[#4338ca]">{inspectorPost.scheduledDate ? `${inspectorPost.scheduledDate} ${inspectorPost.scheduledTime || '10:00'}` : 'No date set'}</span>],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-1 border-b border-[#e9e9e7]/50">
                    <span className="text-[#5f5f5b]">{label}</span>
                    {value}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => onSelectPost(inspectorPost)}
                  className="w-full bg-[#4f46e5] text-white font-label-caps text-xs py-3 rounded shadow-sm hover:bg-[#4338ca] active:scale-95 transition-all min-h-[44px] font-bold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>Edit post</span>
                </button>
                {onDeletePost && (
                  <button
                    onClick={async () => { if (await confirm({ title: `Delete "${inspectorPost.title}"?`, confirmLabel: 'Delete', tone: 'danger' })) onDeletePost(inspectorPost.id); }}
                    className="w-full bg-[#fcebeb] text-[#dc2626] font-label-caps text-xs py-2 rounded font-bold hover:bg-[#dc2626] hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete post</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[#5f5f5b]">
              <span className="material-symbols-outlined text-3xl text-[#e9e9e7] block mb-2">ads_click</span>
              <p className="text-xs font-body-md">Pick a post from the calendar to see its details here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
