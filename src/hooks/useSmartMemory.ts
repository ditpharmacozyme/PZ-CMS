import { useState, useEffect, useCallback } from 'react';
import { BrandId, Post, PostStatus, Platform } from '../types';
import { NavTab } from '../components/SideNav';

const STORAGE_KEYS = {
  // Bumped from pz_smart_active_tab so existing installs (which already have
  // a stored tab under the old key) also land on the new 'my-work' default,
  // instead of silently keeping 'calendar' forever.
  ACTIVE_TAB: 'pz_smart_active_tab_v2',
  BRAND_FILTER: 'pz_smart_brand_filter',
  CALENDAR_DISPLAY_MODE: 'pz_smart_cal_mode',
  CALENDAR_STATUS_FILTER: 'pz_smart_cal_status',
  CALENDAR_PLATFORM_FILTER: 'pz_smart_cal_platform',
  POST_DRAFT: 'pz_smart_post_draft',
  RECENT_POST_IDS: 'pz_smart_recent_post_ids',
};

export interface PostDraft {
  title: string;
  caption: string;
  brandId: BrandId;
  platform: Platform;
  scheduledDate: string;
  scheduledTime: string;
  assignees: string[];
  visualUrl?: string;
  reminderEmail?: string;
  timestamp: number;
}

export function useSmartMemory() {
  // ── Tab & Brand Persistence ──────────────────────────────────────────────────
  const [persistedTab, setPersistedTab] = useState<NavTab>(() => {
    if (typeof window === 'undefined') return 'my-work';
    return (localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as NavTab) || 'my-work';
  });

  const [persistedBrand, setPersistedBrand] = useState<BrandId | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem(STORAGE_KEYS.BRAND_FILTER) as BrandId | 'all') || 'all';
  });

  const updateActiveTab = useCallback((tab: NavTab) => {
    setPersistedTab(tab);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
    } catch (_) {}
  }, []);

  const updateBrandFilter = useCallback((brand: BrandId | 'all') => {
    setPersistedBrand(brand);
    try {
      localStorage.setItem(STORAGE_KEYS.BRAND_FILTER, brand);
    } catch (_) {}
  }, []);

  // ── Calendar Filter Preferences ──────────────────────────────────────────────
  const [calendarDisplayMode, setCalendarDisplayMode] = useState<'month' | 'week' | 'list'>(() => {
    if (typeof window === 'undefined') return 'month';
    return (localStorage.getItem(STORAGE_KEYS.CALENDAR_DISPLAY_MODE) as 'month' | 'week' | 'list') || 'month';
  });

  const updateCalendarDisplayMode = useCallback((mode: 'month' | 'week' | 'list') => {
    setCalendarDisplayMode(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_DISPLAY_MODE, mode);
    } catch (_) {}
  }, []);

  // ── Post Draft Auto-Save & Recovery ──────────────────────────────────────────
  const [savedDraft, setSavedDraft] = useState<PostDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.POST_DRAFT);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Expire drafts older than 48 hours
        if (Date.now() - parsed.timestamp < 48 * 3600 * 1000) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });

  const saveDraft = useCallback((draft: Omit<PostDraft, 'timestamp'>) => {
    // Only save if there is actual content
    if (!draft.title.trim() && !draft.caption.trim()) {
      return;
    }
    const fullDraft: PostDraft = { ...draft, timestamp: Date.now() };
    setSavedDraft(fullDraft);
    try {
      localStorage.setItem(STORAGE_KEYS.POST_DRAFT, JSON.stringify(fullDraft));
    } catch (_) {}
  }, []);

  const clearDraft = useCallback(() => {
    setSavedDraft(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.POST_DRAFT);
    } catch (_) {}
  }, []);

  // ── Recent Posts Tracking ────────────────────────────────────────────────────
  const [recentPostIds, setRecentPostIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RECENT_POST_IDS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });

  const trackRecentPost = useCallback((postId: string) => {
    setRecentPostIds((prev) => {
      const filtered = prev.filter((id) => id !== postId);
      const updated = [postId, ...filtered].slice(0, 8); // Keep up to 8 recent posts
      try {
        localStorage.setItem(STORAGE_KEYS.RECENT_POST_IDS, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  return {
    persistedTab,
    updateActiveTab,
    persistedBrand,
    updateBrandFilter,
    calendarDisplayMode,
    updateCalendarDisplayMode,
    savedDraft,
    saveDraft,
    clearDraft,
    recentPostIds,
    trackRecentPost,
  };
}
