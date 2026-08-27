import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Post, PostTemplate, BrandAsset, AppNotification, BrandId, ContentBankItem, TeamMember, ResearchItem } from './types';
import {
  getStoredTemplates,
  saveStoredTemplates,
  getStoredAssets,
  saveStoredAssets,
  getStoredContentBank,
  saveStoredContentBank,
  getStoredResearchItems,
  saveStoredResearchItems,
  fetchRemoteTemplates,
  upsertRemoteTemplate,
  deleteRemoteTemplate,
  subscribeRemoteTemplates,
  fetchRemoteContentBank,
  upsertRemoteContentBankItem,
  deleteRemoteContentBankItem,
  subscribeRemoteContentBank,
  fetchRemoteResearchItems,
  upsertRemoteResearchItem,
  deleteRemoteResearchItem,
  subscribeRemoteResearchItems,
  fetchRemoteAssets,
  upsertRemoteAsset,
  deleteRemoteAsset,
  subscribeRemoteAssets,
  upsertRemotePost,
  upsertRemotePosts,
  removeTeamMemberAccount,
  upsertRemoteTeamMember,
  importLocalDataToRemote,
  isSupabaseConfigured,
} from './utils/storage';
import { supabase } from './lib/supabase';
import { BRANDS } from './data/brands';
import { applyBrandTypography } from './utils/brandTypography';
import { exportPostsToCSV, exportFullWorkspaceJSON } from './utils/export';
import { checkAndTriggerAutoBackup, saveRollingBackup, WorkspaceBackupPayload } from './utils/autoBackup';
import { SideNav, NavTab } from './components/SideNav';
import { TopNav } from './components/TopNav';
import { CalendarView } from './components/CalendarView';
import { TemplateLibrary } from './components/TemplateLibrary';
import { BrandControlCenter } from './components/BrandControlCenter';
import { AssetLibrary } from './components/AssetLibrary';
import { MissionControlDashboard } from './components/MissionControlDashboard';
import { MyWork } from './components/MyWork';
import { GoogleAppsScriptHub } from './components/GoogleAppsScriptHub';
import { PostDetailModal } from './components/PostDetailModal';
import { NewPostModal } from './components/NewPostModal';
import { ContentBank } from './components/ContentBank';
import { ResearchPlans } from './components/ResearchPlans';
import { CommandPalette } from './components/CommandPalette';
import { LoginPage } from './components/LoginPage';
import { AuditLogView } from './components/AuditLogView';
import { SmartMemoryRibbon } from './components/SmartMemoryRibbon';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTeamAndAuth } from './hooks/useTeamAndAuth';
import { usePosts } from './hooks/usePosts';
import { useNotifications } from './hooks/useNotifications';
import { useSmartMemory } from './hooks/useSmartMemory';
import { logTimestamp } from './utils/date';
import { logAuditEvent, buildAuditEvent } from './utils/audit';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { deriveStatus } from './utils/postStatus';
import { setStageDone } from './utils/stages';

interface ToastState {
  message: string;
  action?: { label: string; onClick: () => void };
}

// Multiple search inputs share this shortcut's target (TopNav's desktop bar,
// TopNav's mobile toggle bar, CalendarFilters' own box) and only one is ever
// actually visible/rendered at a time depending on tab and viewport. A single
// hardcoded id used to grab whichever one happened to sit first in the DOM
// (TopNav's desktop input) even when it was `hidden md:flex` off-screen, so
// `/` silently focused a display:none element on mobile. Try each candidate
// in DOM order and focus the first one that's actually visible.
function focusFirstVisibleSearchInput(): void {
  const candidateIds = ['calendar-search-input', 'mobile-search-input', 'app-search-input'];
  for (const id of candidateIds) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el && el.offsetParent !== null) {
      el.focus();
      return;
    }
  }
}

export function App() {
  // ── Toast ───────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, action?: ToastState['action'], durationMs = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, action });
    toastTimeoutRef.current = setTimeout(() => setToast(null), durationMs);
  };

  // ── Smart Memory & Continuation ──────────────────────────────────────────────
  const {
    persistedTab,
    updateActiveTab,
    persistedBrand,
    updateBrandFilter,
    savedDraft,
    clearDraft,
    recentPostIds,
    trackRecentPost,
  } = useSmartMemory();

  // ── Auth + Team ──────────────────────────────────────────────────────────────
  const {
    teamMembers,
    setTeamMembers,
    session,
    authChecked,
    mustSetPassword,
    setMustSetPassword,
    activeTeammate,
    noProfileMatch,
    handleLogout,
  } = useTeamAndAuth(showToast);

  const authEmail = session?.user?.email?.toLowerCase() || null;

  // ── Posts ───────────────────────────────────────────────────────────────────
  const {
    posts,
    setPosts,
    handleAddPost,
    handleSavePost,
    handleDeletePost: deletePostBase,
    handleDuplicatePost: duplicatePostBase,
    handleBatchAddPosts,
  } = usePosts(showToast, activeTeammate);

  const [activeModalPost, setActiveModalPost] = useState<Post | null>(null);

  // Wrap delete/duplicate to manage modal state
  const handleDeletePost = (postId: string) => {
    deletePostBase(postId, () => {
      if (activeModalPost?.id === postId) setActiveModalPost(null);
    });
  };

  const handleDuplicatePost = (originalPost: Post) => {
    duplicatePostBase(originalPost, (newPost) => {
      setActiveModalPost(newPost);
      trackRecentPost(newPost.id);
    });
  };

  const handleSelectPost = (post: Post) => {
    setActiveModalPost(post);
    trackRecentPost(post.id);
  };

  // Derive recent post objects from IDs
  const recentPosts = useMemo(() => {
    return recentPostIds
      .map((id) => posts.find((p) => p.id === id))
      .filter((p): p is Post => Boolean(p));
  }, [recentPostIds, posts]);

  // ── Notifications ────────────────────────────────────────────────────────────
  const {
    notifications,
    setNotifications,
    handleMarkNotificationRead,
    handleClearNotifications,
  } = useNotifications(posts);

  // ── Other State ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<PostTemplate[]>(() => getStoredTemplates());
  const [assets, setAssets] = useState<BrandAsset[]>(() => getStoredAssets());
  const [contentBank, setContentBank] = useState<ContentBankItem[]>(() => getStoredContentBank());
  const [researchItems, setResearchItems] = useState<ResearchItem[]>(() => getStoredResearchItems());

  const [currentTab, setCurrentTabState] = useState<NavTab>(persistedTab);
  const [selectedBrandFilter, setSelectedBrandFilterState] = useState<BrandId | 'all'>(persistedBrand);

  const setCurrentTab = (tab: NavTab) => {
    setCurrentTabState(tab);
    updateActiveTab(tab);
  };

  const setSelectedBrandFilter = (brand: BrandId | 'all') => {
    setSelectedBrandFilterState(brand);
    updateBrandFilter(brand);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState<boolean>(false);
  const [newPostInitialDate, setNewPostInitialDate] = useState<string | undefined>(undefined);
  const [presetTemplateId, setPresetTemplateId] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [importingData, setImportingData] = useState(false);

  // ── Brand Typography Specimen Setup ──────────────────────────────────────────
  useEffect(() => {
    const activeBrand = selectedBrandFilter === 'all' ? BRANDS.pharmacozyme : BRANDS[selectedBrandFilter];
    applyBrandTypography(activeBrand);
  }, [selectedBrandFilter]);

  // ── Persist Secondary Data ────────────────────────────────────────────────────
  useEffect(() => { saveStoredTemplates(templates); }, [templates]);
  useEffect(() => { saveStoredAssets(assets); }, [assets]);
  useEffect(() => { saveStoredContentBank(contentBank); }, [contentBank]);
  useEffect(() => { saveStoredResearchItems(researchItems); }, [researchItems]);

  // ── Remote Bootstrap + Realtime Subscriptions ─────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      const [remoteTemplates, remoteAssets, remoteBank, remoteResearch] = await Promise.all([
        fetchRemoteTemplates(),
        fetchRemoteAssets(),
        fetchRemoteContentBank(),
        fetchRemoteResearchItems(),
      ]);
      if (remoteTemplates && remoteTemplates.length > 0) setTemplates(remoteTemplates);
      if (remoteAssets && remoteAssets.length > 0) setAssets(remoteAssets);
      if (remoteBank && remoteBank.length > 0) setContentBank(remoteBank);
      if (remoteResearch && remoteResearch.length > 0) setResearchItems(remoteResearch);
    })();
    const unsubs = [
      subscribeRemoteTemplates((data) => setTemplates(data)),
      subscribeRemoteAssets((data) => setAssets(data)),
      subscribeRemoteContentBank((data) => setContentBank(data)),
      subscribeRemoteResearchItems((data) => setResearchItems(data)),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────────
  useKeyboardShortcuts({
    onOpenPalette: () => setIsPaletteOpen(true),
    onNewPost: () => {
      setNewPostInitialDate(undefined);
      setPresetTemplateId(undefined);
      setIsNewPostModalOpen(true);
    },
    onFocusSearch: () => focusFirstVisibleSearchInput(),
    onEscape: () => {
      if (isPaletteOpen) setIsPaletteOpen(false);
      else if (activeModalPost) setActiveModalPost(null);
      else if (isNewPostModalOpen) setIsNewPostModalOpen(false);
    }
  });

  // ── Auth Gate ─────────────────────────────────────────────────────────────────
  if (supabase && !authChecked) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#296c00]/30 border-t-[#296c00] rounded-full animate-spin" />
      </div>
    );
  }
  if (supabase && !session) return <LoginPage />;
  if (supabase && mustSetPassword) return <LoginPage forcedMode="set-password" onPasswordSet={() => setMustSetPassword(false)} />;
  if (noProfileMatch) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-[#bfcab4] rounded-lg shadow-2xs p-6 text-center space-y-3">
          <span className="material-symbols-outlined text-3xl text-[#ba1a1a]">person_off</span>
          <h2 className="font-display-xl text-lg font-bold text-[#1b1c1a]">No matching team profile</h2>
          <p className="font-body-md text-sm text-[#707a67]">
            You're signed in as <strong>{authEmail}</strong>, but no one on the team list has that email. Ask Hamza to add you in Settings → Team, or check you used the right account.
          </p>
          <button onClick={handleLogout} className="w-full bg-[#296c00] hover:bg-[#1f5700] text-white font-bold py-2.5 rounded transition-colors text-sm cursor-pointer">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Template Handlers ─────────────────────────────────────────────────────────
  const handleUseTemplate = (template: PostTemplate) => {
    setNewPostInitialDate(undefined);
    setPresetTemplateId(template.id);
    setCurrentTab('calendar');
    setIsNewPostModalOpen(true);
    const updated = { ...template, usesCount: template.usesCount + 1 };
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
    upsertRemoteTemplate(updated);
  };
  const handleSaveNewTemplate = (newTpl: PostTemplate) => { setTemplates((prev) => [newTpl, ...prev]); upsertRemoteTemplate(newTpl); showToast(`Saved new template: "${newTpl.title}"`); };
  const handleUpdateTemplate = (updatedTpl: PostTemplate) => { setTemplates((prev) => prev.map((t) => (t.id === updatedTpl.id ? updatedTpl : t))); upsertRemoteTemplate(updatedTpl); showToast(`Updated template: "${updatedTpl.title}"`); };
  const handleDeleteTemplate = (id: string) => { setTemplates((prev) => prev.filter((t) => t.id !== id)); deleteRemoteTemplate(id); showToast('Template deleted.'); };

  // ── Asset Handlers ────────────────────────────────────────────────────
  const handleAddAsset = (newAsset: BrandAsset) => { setAssets((prev) => [newAsset, ...prev]); upsertRemoteAsset(newAsset); showToast(`Added brand asset: "${newAsset.title}"`); };
  const handleUpdateAsset = (updatedAsset: BrandAsset) => { setAssets((prev) => prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))); upsertRemoteAsset(updatedAsset); showToast(`Updated asset: "${updatedAsset.title}"`); };
  const handleDeleteAsset = (id: string) => { setAssets((prev) => prev.filter((a) => a.id !== id)); deleteRemoteAsset(id); showToast('Asset deleted.'); };

  // ── Content Bank Handlers ─────────────────────────────────────────────────────
  const handleAddBankItem = (newItem: ContentBankItem) => { setContentBank((prev) => [newItem, ...prev]); upsertRemoteContentBankItem(newItem); showToast('Added copy item to bank.'); };
  const handleUpdateBankItem = (updatedItem: ContentBankItem) => { setContentBank((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))); upsertRemoteContentBankItem(updatedItem); showToast('Updated copy item in bank.'); };
  const handleDeleteBankItem = (id: string) => { setContentBank((prev) => prev.filter((item) => item.id !== id)); deleteRemoteContentBankItem(id); showToast('Deleted copy item from bank.'); };

  // ── Research Handlers ─────────────────────────────────────────────────────────
  const handleAddResearchItem = (newItem: ResearchItem) => {
    setResearchItems((prev) => [newItem, ...prev]);
    upsertRemoteResearchItem(newItem);
    showToast(`Uploaded "${newItem.title}".`);
    if (activeTeammate) {
      logAuditEvent(buildAuditEvent({ actorId: activeTeammate.id, actorName: activeTeammate.name, actionType: 'research_uploaded', entityType: 'research', entityId: newItem.id, entityTitle: newItem.title, afterValue: { title: newItem.title, brand: newItem.brand, type: newItem.type } }));
    }
  };
  const handleDeleteResearchItem = (id: string) => {
    const removed = researchItems.find((item) => item.id === id);
    setResearchItems((prev) => prev.filter((item) => item.id !== id));
    deleteRemoteResearchItem(id);
    showToast(removed ? `Deleted "${removed.title}".` : 'Research item deleted.');
    if (activeTeammate && removed) {
      logAuditEvent(buildAuditEvent({ actorId: activeTeammate.id, actorName: activeTeammate.name, actionType: 'research_deleted', entityType: 'research', entityId: id, entityTitle: removed.title, beforeValue: { title: removed.title, brand: removed.brand, type: removed.type } }));
    }
  };

  // ── Notification Handlers ─────────────────────────────────────────────────────
  const handleMarkAllNotificationsRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const handleSelectNotificationPost = (postId: string) => {
    const found = posts.find((p) => p.id === postId);
    if (found) {
      handleSelectPost(found);
      setCurrentTab('calendar');
    }
  };

  // ── Content Bank → Post Crossover ─────────────────────────────────────────────
  const handleCreatePostFromCopy = (text: string, brandId: BrandId) => {
    setCurrentTab('calendar');
    setNewPostInitialDate(undefined);
    const defaultAssignee = teamMembers && teamMembers.length > 0 ? teamMembers[0].name : '';
    const creatorName = activeTeammate ? activeTeammate.name : (defaultAssignee || 'Someone');
    const newPost: Post = {
      id: `post-${Date.now()}`,
      brandId,
      title: 'Untitled post',
      caption: text,
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
      activityLog: [{ id: `act-${Date.now()}`, actor: creatorName, action: 'Created from a content bank item', timestamp: logTimestamp() }]
    };
    setPosts((prev) => [newPost, ...prev]);
    upsertRemotePost(newPost);
    handleSelectPost(newPost);
    showToast('Created backlog post from swipe copy.');
  };

  // ── Publish Now ───────────────────────────────────────────────────────────────
  // Status is derived from the stage checkboxes (see utils/postStatus.ts), so
  // "publish now" means marking the Publish stage done, not writing `status`
  // directly -- writing status alone would just get overridden the next time
  // anything recomputes it from the (still-unset) stages.
  const handlePublishNow = () => {
    const actorName = activeTeammate?.name || 'Someone';
    const toMarkPosted = posts
      .filter((p) => deriveStatus(p) === 'ready-to-post')
      .map((p) => setStageDone(p, 'publish', true, actorName));
    setPosts((prev) => prev.map((p) => toMarkPosted.find((u) => u.id === p.id) || p));
    toMarkPosted.forEach((p) => upsertRemotePost(p));
    showToast('Marked all "Ready to post" items as posted.');
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const handleResetData = () => {
    if (typeof window !== 'undefined') { window.location.reload(); }
  };

  // ── Team Save ─────────────────────────────────────────────────────────────────
  const handleSaveTeamMembers = async (members: TeamMember[]) => {
    const previous = teamMembers;
    const removedIds = previous.filter((m) => !members.some((nm) => nm.id === m.id)).map((m) => m.id);
    const changed = members.filter((m) => previous.find((pm) => pm.id === m.id) !== m);
    setTeamMembers(members);
    if (activeTeammate) {
      removedIds.forEach((id) => {
        const removedMember = previous.find((m) => m.id === id);
        logAuditEvent(buildAuditEvent({ actorId: activeTeammate.id, actorName: activeTeammate.name, actionType: 'member_removed', entityType: 'member', entityId: id, entityTitle: removedMember?.name ?? id, beforeValue: removedMember ? { name: removedMember.name, role: removedMember.userRole } : undefined }));
      });
    }
    const results = await Promise.all([...changed.map((m) => upsertRemoteTeamMember(m)), ...removedIds.map((id) => removeTeamMemberAccount(id))]);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) { setTeamMembers(previous); showToast(`Couldn't save team changes: ${firstError}`); }
  };

  const handleTeamMemberCreated = (member: TeamMember) => {
    setTeamMembers((prev) => [...prev, member]);
    if (activeTeammate) {
      logAuditEvent(buildAuditEvent({ actorId: activeTeammate.id, actorName: activeTeammate.name, actionType: 'member_added', entityType: 'member', entityId: member.id, entityTitle: member.name, afterValue: { name: member.name, role: member.userRole, email: member.email } }));
    }
  };

  const handleImportLocalData = async () => {
    setImportingData(true);
    try {
      const counts = await importLocalDataToRemote();
      showToast(`Imported ${counts.posts} posts, ${counts.templates} templates, ${counts.assets} assets, ${counts.contentBank} bank items, ${counts.team} people, ${counts.research} research items.`);
    } finally {
      setImportingData(false);
    }
  };

  // ── Automated Rolling Local Backups ──────────────────────────────────────────
  useEffect(() => {
    if (posts.length > 0) {
      checkAndTriggerAutoBackup({
        version: '1.0',
        timestamp: new Date().toISOString(),
        posts,
        contentBank,
        researchPlans: researchItems,
        templates,
        teamMembers
      });
    }
  }, [posts, contentBank, researchItems, templates, teamMembers]);

  const handleCreateSnapshotNow = () => {
    saveRollingBackup({
      version: '1.0',
      timestamp: new Date().toISOString(),
      posts,
      contentBank,
      researchPlans: researchItems,
      templates,
      teamMembers
    });
    showToast('Manual backup snapshot created successfully!');
  };

  const handleRestoreSnapshot = async (payload: WorkspaceBackupPayload) => {
    if (payload.posts && payload.posts.length > 0) {
      setPosts(payload.posts);
    }
    if (payload.contentBank) {
      setContentBank(payload.contentBank);
      saveStoredContentBank(payload.contentBank);
    }
    if (payload.researchPlans) {
      setResearchItems(payload.researchPlans);
      saveStoredResearchItems(payload.researchPlans);
    }
    if (payload.templates) {
      setTemplates(payload.templates);
      saveStoredTemplates(payload.templates);
    }
    showToast('Workspace successfully restored from snapshot!');
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <ConfirmProvider>
    <div className="min-h-screen bg-[#FAF9F5] text-[#1b1c1a] font-body-md flex flex-col md:flex-row">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1b1c1a] text-white font-label-caps text-[11px] px-5 py-3.5 rounded-xl warm-shadow-lg border-l-4 border-[#296c00] toast-in">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78d24b] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#296c00]" />
          </span>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { toast.action?.onClick(); if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); setToast(null); }}
              className="text-[#78d24b] font-bold hover:underline flex-shrink-0 cursor-pointer"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Side Nav */}
      <SideNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNewPostModal={() => { setNewPostInitialDate(undefined); setIsNewPostModalOpen(true); }}
        isMobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onSelectNotificationPost={handleSelectNotificationPost}
          onOpenNewPostModal={() => { setNewPostInitialDate(undefined); setIsNewPostModalOpen(true); }}
          onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
          selectedBrandFilter={selectedBrandFilter}
          onSelectBrandFilter={setSelectedBrandFilter}
          onPublishNow={handlePublishNow}
          onResetData={handleResetData}
          onSelectTab={setCurrentTab}
          teamMembers={teamMembers}
          onSaveTeamMembers={handleSaveTeamMembers}
          onTeamMemberCreated={handleTeamMemberCreated}
          isRemoteConfigured={isSupabaseConfigured()}
          onImportLocalData={handleImportLocalData}
          isImportingData={importingData}
          activeTeammate={activeTeammate}
          onLogout={handleLogout}
          onExportCSV={() => exportPostsToCSV(posts)}
          onExportJSON={() => exportFullWorkspaceJSON(posts, templates, contentBank, researchItems)}
          onCreateSnapshotNow={handleCreateSnapshotNow}
          onRestoreSnapshot={handleRestoreSnapshot}
        />

        {/* Smart Memory & Work Continuation Ribbon */}
        <SmartMemoryRibbon
          savedDraft={savedDraft}
          onRestoreDraft={() => {
            setIsNewPostModalOpen(true);
          }}
          onDiscardDraft={clearDraft}
          recentPosts={recentPosts}
          onSelectPost={handleSelectPost}
        />

        <main className="flex-1 overflow-x-hidden mobile-content-pad">
          {currentTab === 'my-work' && (
            <MyWork
              posts={posts}
              activeTeammate={activeTeammate}
              onSelectPost={handleSelectPost}
              onSavePost={handleSavePost}
            />
          )}
          {currentTab === 'calendar' && (
            <CalendarView
              posts={posts}
              selectedBrandFilter={selectedBrandFilter}
              onSelectPost={handleSelectPost}
              onDeletePost={handleDeletePost}
              onOpenNewPostModal={(dateStr) => { setNewPostInitialDate(dateStr); setIsNewPostModalOpen(true); }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSavePost={handleSavePost}
              onAddPost={handleAddPost}
              onBatchAddPosts={handleBatchAddPosts}
              teamMembers={teamMembers}
              activeTeammate={activeTeammate}
            />
          )}
          {currentTab === 'templates' && (
            <TemplateLibrary templates={templates} onUseTemplate={handleUseTemplate} onSaveNewTemplate={handleSaveNewTemplate} onUpdateTemplate={handleUpdateTemplate} onDeleteTemplate={handleDeleteTemplate} selectedBrandFilter={selectedBrandFilter} />
          )}
          {currentTab === 'brand-kit' && (
            <BrandControlCenter selectedBrandFilter={selectedBrandFilter} onSelectBrandFilter={setSelectedBrandFilter} />
          )}
          {currentTab === 'assets' && (
            <AssetLibrary assets={assets} selectedBrandFilter={selectedBrandFilter} onAddAsset={handleAddAsset} onUpdateAsset={handleUpdateAsset} onDeleteAsset={handleDeleteAsset} />
          )}
          {currentTab === 'dashboard' && (
            <MissionControlDashboard posts={posts} teamMembers={teamMembers} onOpenNewPostModal={() => { setNewPostInitialDate(undefined); setIsNewPostModalOpen(true); }} onSelectPost={handleSelectPost} onDeletePost={handleDeletePost} activeTeammate={activeTeammate} />
          )}
          {currentTab === 'integrations' && (
            <GoogleAppsScriptHub posts={posts} onUploadComplete={(newUrl) => showToast(`Asset uploaded! Direct URL: ${newUrl}`)} />
          )}
          {currentTab === 'content-bank' && (
            <ContentBank contentBank={contentBank} selectedBrandFilter={selectedBrandFilter} onAddBankItem={handleAddBankItem} onUpdateBankItem={handleUpdateBankItem} onDeleteBankItem={handleDeleteBankItem} onCreatePostFromCopy={handleCreatePostFromCopy} />
          )}
          {currentTab === 'research' && (
            <ResearchPlans researchItems={researchItems} selectedBrandFilter={selectedBrandFilter} teamMembers={teamMembers} activeTeammate={activeTeammate} onAddResearchItem={handleAddResearchItem} onDeleteResearchItem={handleDeleteResearchItem} onBatchAddPosts={handleBatchAddPosts} />
          )}
          {currentTab === 'audit' && <AuditLogView teamMembers={teamMembers} />}
        </main>
      </div>

      {/* Post Detail Modal */}
      {activeModalPost && (
        <PostDetailModal post={activeModalPost} onSavePost={handleSavePost} onDeletePost={handleDeletePost} onDuplicatePost={handleDuplicatePost} onClose={() => setActiveModalPost(null)} contentBank={contentBank} teamMembers={teamMembers} activeTeammate={activeTeammate} />
      )}

      {/* New Post Modal */}
      {isNewPostModalOpen && (
        <NewPostModal
          initialDate={newPostInitialDate}
          initialTemplateId={presetTemplateId}
          initialDraft={savedDraft}
          templates={templates}
          selectedBrandFilter={selectedBrandFilter}
          onAddPost={handleAddPost}
          onClose={() => { setIsNewPostModalOpen(false); setPresetTemplateId(undefined); }}
          contentBank={contentBank}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
        />
      )}

      {/* Command Palette */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} posts={posts} onSelectTab={setCurrentTab} onSelectBrandFilter={setSelectedBrandFilter} onSelectPost={handleSelectPost} onOpenNewPostModal={() => { setNewPostInitialDate(undefined); setPresetTemplateId(undefined); setIsNewPostModalOpen(true); }} />

      {/* Mobile Bottom Tab Bar */}
      <nav className="bottom-tab-bar" aria-label="Mobile navigation">
        <button className={`bottom-tab-item ${currentTab === 'my-work' ? 'active' : ''}`} onClick={() => setCurrentTab('my-work')} aria-label="My Work">
          <span className="material-symbols-outlined text-xl">checklist</span>
          <span className="bottom-tab-label">My Work</span>
        </button>
        <button className={`bottom-tab-item ${currentTab === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentTab('calendar')} aria-label="Calendar">
          <span className="material-symbols-outlined text-xl">calendar_month</span>
          <span className="bottom-tab-label">Calendar</span>
        </button>
        <button className="bottom-tab-item" onClick={() => { setNewPostInitialDate(undefined); setIsNewPostModalOpen(true); }} aria-label="New Post">
          <span className="w-10 h-10 rounded-full bg-[#296c00] text-white flex items-center justify-center shadow-lg -mt-5">
            <span className="material-symbols-outlined text-xl">add</span>
          </span>
          <span className="bottom-tab-label mt-1">New</span>
        </button>
        <button className={`bottom-tab-item ${currentTab === 'templates' ? 'active' : ''}`} onClick={() => setCurrentTab('templates')} aria-label="Templates">
          <span className="material-symbols-outlined text-xl">quiz</span>
          <span className="bottom-tab-label">Templates</span>
        </button>
        <button className="bottom-tab-item" onClick={() => setMobileNavOpen(true)} aria-label="More">
          <span className="material-symbols-outlined text-xl">menu</span>
          <span className="bottom-tab-label">More</span>
        </button>
      </nav>
    </div>
    </ConfirmProvider>
  );
}

export default App;
