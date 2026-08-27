import { useState, useEffect, useCallback } from 'react';
import { BrandId, Post, PostStatus, Platform } from '../types';
import { NavTab } from '../components/SideNav';

const STORAGE_KEYS = {
  // Bumped from pz_smart_active_tab so existing installs (which already have
  // a stored tab under the old key) also land on the new 'my-work' default,
  // instead of silently keeping 'calendar' forever.
  ACTIVE_TAB: 'pz_smart_active_tab_v2',
  BRAND_FILTER: 'pz_smart_brand_filter',
  // Calendar view mode + filters now persist in CalendarView itself under
  // 'pz_smart_cal_prefs' (one JSON blob). The three half-wired keys that used
  // to live here were declared but never actually read by any component.
  POST_DRAFT: 'pz_smart_post_draft',
  RECENT_POST_IDS: 'pz_smart_recent_post_ids',
};

// Phase 7 flattened-nav rename: the NavTab ids 'telemetry' and 'appscript'
// became 'dashboard' and 'integrations'. Existing installs may still have
// the old id sitting in localStorage under ACTIVE_TAB — remap it on read
// rather than bumping the storage key again, so the rest of a returning
// user's smart-memory state (draft, recents, calendar prefs, brand filter)
// isn't reset just to fix this one field.
const LEGACY_TAB_REMAP: Record<string, NavTab> = {
  telemetry: 'dashboard',
  appscript: 'integrations',
};

export function remapLegacyTab(rawTab: string | null): NavTab | null {
  if (!rawTab) return null;
  return (LEGACY_TAB_REMAP[rawTab] as NavTab | undefined) ?? (rawTab as NavTab);
}

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
    return remapLegacyTab(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)) || 'my-work';
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
    savedDraft,
    saveDraft,
    clearDraft,
    recentPostIds,
    trackRecentPost,
  };
}
