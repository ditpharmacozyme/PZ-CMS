import React, { useState, useEffect } from 'react';
import { Post, PostTemplate, BrandAsset, AppNotification, BrandId, ContentBankItem, TeamMember } from './types';
import {
  getStoredPosts,
  saveStoredPosts,
  getStoredTemplates,
  saveStoredTemplates,
  getStoredAssets,
  saveStoredAssets,
  getStoredNotifications,
  saveStoredNotifications,
  getStoredContentBank,
  saveStoredContentBank,
  getStoredTeam,
  saveStoredTeam,
  resetToDefaults,
  isSupabaseConfigured,
  fetchRemotePosts,
  upsertRemotePost,
  deleteRemotePost,
  subscribeRemotePosts,
  fetchRemoteTemplates,
  upsertRemoteTemplate,
  deleteRemoteTemplate,
  subscribeRemoteTemplates,
  fetchRemoteContentBank,
  upsertRemoteContentBankItem,
  deleteRemoteContentBankItem,
  subscribeRemoteContentBank,
  fetchRemoteAssets,
  upsertRemoteAsset,
  deleteRemoteAsset,
  subscribeRemoteAssets,
  fetchRemoteTeam,
  upsertRemoteTeamMember,
  deleteRemoteTeamMember,
  subscribeRemoteTeam,
  importLocalDataToRemote
} from './utils/storage';
import { BRANDS } from './data/brands';
import { applyBrandTypography } from './utils/brandTypography';
import { SideNav, NavTab } from './components/SideNav';
import { TopNav } from './components/TopNav';
import { CalendarView } from './components/CalendarView';
import { TemplateLibrary } from './components/TemplateLibrary';
import { BrandControlCenter } from './components/BrandControlCenter';
import { AssetLibrary } from './components/AssetLibrary';
import { MissionControlDashboard } from './components/MissionControlDashboard';
import { GoogleAppsScriptHub } from './components/GoogleAppsScriptHub';
import { PostDetailModal } from './components/PostDetailModal';
import { NewPostModal } from './components/NewPostModal';
import { ContentBank } from './components/ContentBank';
import { CommandPalette } from './components/CommandPalette';
import { LoginPage } from './components/LoginPage';
import { AuditLogView } from './components/AuditLogView';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { logTimestamp } from './utils/date';
import { generateNotifications, mergeNotifications } from './utils/notifications';
import { logAuditEvent, buildAuditEvent, clearSessionId } from './utils/audit';

// Passcodes are never stored remotely (team_members uses the same public
// anon-read policy as every other table), so a fresh remote team snapshot
// never carries one. Re-attach whatever passcode this browser already knows
// for each member, otherwise a realtime team refresh would silently reset
// everyone's PIN to the generic default mid-session.
function mergeLocalPasscodes(remoteTeam: TeamMember[], localTeam: TeamMember[]): TeamMember[] {
  return remoteTeam.map((rm) => {
    const local = localTeam.find((lm) => lm.id === rm.id);
    return local?.passcode ? { ...rm, passcode: local.passcode } : rm;
  });
}

export function App() {
  const [posts, setPosts] = useState<Post[]>(() => getStoredPosts());
  const [templates, setTemplates] = useState<PostTemplate[]>(() => getStoredTemplates());
  const [assets, setAssets] = useState<BrandAsset[]>(() => getStoredAssets());
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );
  const [contentBank, setContentBank] = useState<ContentBankItem[]>(() => getStoredContentBank());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => getStoredTeam());
  const [activeTeammateId, setActiveTeammateId] = useState<string>(() => localStorage.getItem('pharmacozyme_active_teammate_id') || '');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('pharmacozyme_is_logged_in') === 'true');

  const activeTeammate = teamMembers.find(m => m.id === activeTeammateId) || teamMembers[0] || null;

  useEffect(() => {
    if (activeTeammateId) {
      localStorage.setItem('pharmacozyme_active_teammate_id', activeTeammateId);
    } else {
      localStorage.removeItem('pharmacozyme_active_teammate_id');
    }
  }, [activeTeammateId]);


  const handleLogin = (teammate: TeamMember, _rememberMe: boolean) => {
    setActiveTeammateId(teammate.id);
    setIsLoggedIn(true);
    localStorage.setItem('pharmacozyme_is_logged_in', 'true');
    showToast(`Welcome back, ${teammate.name}`);

    logAuditEvent(buildAuditEvent({
      actorId: teammate.id,
      actorName: teammate.name,
      actionType: 'login',
      entityType: 'session',
      entityId: teammate.id,
      entityTitle: `Signed in as ${teammate.name} (${teammate.userRole || 'Editor'})`
    }));
  };

  const handleLogout = () => {
    if (activeTeammate) {
      logAuditEvent(buildAuditEvent({
        actorId: activeTeammate.id,
        actorName: activeTeammate.name,
        actionType: 'logout',
        entityType: 'session',
        entityId: activeTeammate.id,
        entityTitle: `Signed out ${activeTeammate.name}`
      }));
    }
    clearSessionId();
    setIsLoggedIn(false);
    localStorage.removeItem('pharmacozyme_is_logged_in');
    showToast('Logged out.');
  };

  const [currentTab, setCurrentTab] = useState<NavTab>('calendar');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<BrandId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Re-skin the app's display/headline/body fonts to match whichever brand is
  // filtered — falls back to Pharmacozyme (the ecosystem parent brand) when
  // viewing "All 5 Brands". See index.css's --brand-font-* consumers.
  useEffect(() => {
    const activeBrand = selectedBrandFilter === 'all' ? BRANDS.pharmacozyme : BRANDS[selectedBrandFilter];
    applyBrandTypography(activeBrand);
  }, [selectedBrandFilter]);

  // Modals state
  const [activeModalPost, setActiveModalPost] = useState<Post | null>(null);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState<boolean>(false);
  const [newPostInitialDate, setNewPostInitialDate] = useState<string | undefined>(undefined);
  const [presetTemplateId, setPresetTemplateId] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [importingData, setImportingData] = useState(false); // Settings → System one-time Supabase import

  interface ToastState { message: string; action?: { label: string; onClick: () => void } }
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useKeyboardShortcuts({
    onOpenPalette: () => setIsPaletteOpen(true),
    onNewPost: () => {
      setNewPostInitialDate(undefined);
      setPresetTemplateId(undefined);
      setIsNewPostModalOpen(true);
    },
    onFocusSearch: () => document.getElementById('app-search-input')?.focus(),
    onEscape: () => {
      if (isPaletteOpen) setIsPaletteOpen(false);
      else if (activeModalPost) setActiveModalPost(null);
      else if (isNewPostModalOpen) setIsNewPostModalOpen(false);
    }
  });

  // Persist posts. Google Sheets is a manual export only — see Integrations.
  // (The old auto-sync fired on every keystroke and rewrote all 7 tabs each time.)
  useEffect(() => {
    saveStoredPosts(posts);
  }, [posts]);

  useEffect(() => {
    saveStoredTemplates(templates);
  }, [templates]);

  useEffect(() => {
    saveStoredAssets(assets);
  }, [assets]);

  // Notifications are derived from post data, not hand-authored — due-soon
  // reminders, unassigned-but-dated posts, and same-day brand collisions
  // (PRD §5.8). Regenerate whenever posts change; keep prior read/unread state.
  useEffect(() => {
    setNotifications((prev) => mergeNotifications(generateNotifications(posts), prev));
  }, [posts]);

  useEffect(() => {
    saveStoredNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveStoredContentBank(contentBank);
  }, [contentBank]);

  useEffect(() => {
    saveStoredTeam(teamMembers);
  }, [teamMembers]);

  // Initial pull from Supabase + live subscription to posts, so teammates
  // see each other's changes without refreshing. Adopts remote data only when
  // it's non-empty — an empty remote table is ambiguous ("nobody's added
  // anything yet" vs. "this browser hasn't pushed"), so we never let a blank
  // remote silently wipe out real local data. See "Import" in Settings.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    (async () => {
      const [remotePosts, remoteTemplates, remoteAssets, remoteBank, remoteTeam] = await Promise.all([
        fetchRemotePosts(),
        fetchRemoteTemplates(),
        fetchRemoteAssets(),
        fetchRemoteContentBank(),
        fetchRemoteTeam()
      ]);
      if (remotePosts && remotePosts.length > 0) setPosts(remotePosts);
      if (remoteTemplates && remoteTemplates.length > 0) setTemplates(remoteTemplates);
      if (remoteAssets && remoteAssets.length > 0) setAssets(remoteAssets);
      if (remoteBank && remoteBank.length > 0) setContentBank(remoteBank);
      if (remoteTeam && remoteTeam.length > 0) setTeamMembers((prev) => mergeLocalPasscodes(remoteTeam, prev));
    })();

    // Live subscriptions on every table, not just posts — a teammate adding a
    // template, asset, bank item, or team member shows up here without a
    // manual re-import or page refresh.
    const unsubs = [
      subscribeRemotePosts((remotePosts) => setPosts(remotePosts)),
      subscribeRemoteTemplates((remoteTemplates) => setTemplates(remoteTemplates)),
      subscribeRemoteAssets((remoteAssets) => setAssets(remoteAssets)),
      subscribeRemoteContentBank((remoteBank) => setContentBank(remoteBank)),
      subscribeRemoteTeam((remoteTeam) => setTeamMembers((prev) => mergeLocalPasscodes(remoteTeam, prev)))
    ];
    return () => unsubs.forEach((unsub) => unsub());
    // Runs once on mount — deliberately not re-running on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show Toast — optionally with an action button (used for undo).
  const showToast = (message: string, action?: ToastState['action'], durationMs = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, action });
    toastTimeoutRef.current = setTimeout(() => setToast(null), durationMs);
  };

  // Handlers for Post Operations with Audit Logging
  const handleSavePost = (updatedPost: Post) => {
    const existing = posts.find(p => p.id === updatedPost.id);
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    upsertRemotePost(updatedPost);
    showToast(`Saved "${updatedPost.title}"`);

    if (activeTeammate) {
      const actionType = existing && existing.status !== updatedPost.status
        ? 'status_changed'
        : existing && !existing.approved && updatedPost.approved
        ? 'post_approved'
        : 'post_edited';

      logAuditEvent(buildAuditEvent({
        actorId: activeTeammate.id,
        actorName: activeTeammate.name,
        actionType,
        entityType: 'post',
        entityId: updatedPost.id,
        entityTitle: updatedPost.title,
        beforeValue: existing ? { title: existing.title, status: existing.status, scheduledDate: existing.scheduledDate, approved: existing.approved } : undefined,
        afterValue: { title: updatedPost.title, status: updatedPost.status, scheduledDate: updatedPost.scheduledDate, approved: updatedPost.approved }
      }));
    }
  };

  const handleDeletePost = (postId: string) => {
    const removed = posts.find((p) => p.id === postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    deleteRemotePost(postId);
    if (activeModalPost && activeModalPost.id === postId) {
      setActiveModalPost(null);
    }
    if (removed) {
      showToast(
        `Deleted "${removed.title}"`,
        {
          label: 'Undo',
          onClick: () => {
            setPosts((prev) => [removed, ...prev]);
            upsertRemotePost(removed);
          }
        },
        5000
      );

      if (activeTeammate) {
        logAuditEvent(buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType: 'post_deleted',
          entityType: 'post',
          entityId: removed.id,
          entityTitle: removed.title,
          beforeValue: { title: removed.title, status: removed.status, scheduledDate: removed.scheduledDate }
        }));
      }
    } else {
      showToast('Post removed.');
    }
  };

  const handleDuplicatePost = (originalPost: Post) => {
    const actorName = activeTeammate ? activeTeammate.name : (originalPost.assignees[0] || 'Someone');
    const duplicated: Post = {
      ...originalPost,
      id: `post-${Date.now()}`,
      title: `${originalPost.title} (Copy)`,
      status: 'not-started',
      approved: false,
      approvedBy: undefined,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: actorName,
          action: 'Duplicated from another post',
          timestamp: logTimestamp()
        }
      ]
    };
    setPosts((prev) => [duplicated, ...prev]);
    upsertRemotePost(duplicated);
    setActiveModalPost(duplicated);
    showToast('Post duplicated.');

    if (activeTeammate) {
      logAuditEvent(buildAuditEvent({
        actorId: activeTeammate.id,
        actorName: activeTeammate.name,
        actionType: 'post_duplicated',
        entityType: 'post',
        entityId: duplicated.id,
        entityTitle: duplicated.title,
        afterValue: { title: duplicated.title, originalTitle: originalPost.title }
      }));
    }
  };

  const handleAddPost = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    upsertRemotePost(newPost);
    showToast(`Scheduled new post: "${newPost.title}"`);

    if (activeTeammate) {
      logAuditEvent(buildAuditEvent({
        actorId: activeTeammate.id,
        actorName: activeTeammate.name,
        actionType: newPost.scheduledDate ? 'post_scheduled' : 'post_created',
        entityType: 'post',
        entityId: newPost.id,
        entityTitle: newPost.title,
        afterValue: { title: newPost.title, status: newPost.status, scheduledDate: newPost.scheduledDate, brandId: newPost.brandId }
      }));
    }
  };

  if (!isLoggedIn) {
    return <LoginPage teamMembers={teamMembers} onLogin={handleLogin} />;
  }

  // Handlers for Templates
  const handleUseTemplate = (template: PostTemplate) => {
    setNewPostInitialDate(undefined);
    setPresetTemplateId(template.id); // actually applies it — previously the modal opened blank
    setCurrentTab('calendar');
    setIsNewPostModalOpen(true);
    const updated = { ...template, usesCount: template.usesCount + 1 };
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
    upsertRemoteTemplate(updated);
  };

  const handleSaveNewTemplate = (newTpl: PostTemplate) => {
    setTemplates((prev) => [newTpl, ...prev]);
    upsertRemoteTemplate(newTpl);
    showToast(`Saved new template: "${newTpl.title}"`);
  };

  const handleUpdateTemplate = (updatedTpl: PostTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === updatedTpl.id ? updatedTpl : t)));
    upsertRemoteTemplate(updatedTpl);
    showToast(`Updated template: "${updatedTpl.title}"`);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteRemoteTemplate(id);
    showToast('Template deleted.');
  };

  // Handlers for Brand Assets
  const handleAddAsset = (newAsset: BrandAsset) => {
    setAssets((prev) => [newAsset, ...prev]);
    upsertRemoteAsset(newAsset);
    showToast(`Added brand asset: "${newAsset.title}"`);
  };

  const handleUpdateAsset = (updatedAsset: BrandAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)));
    upsertRemoteAsset(updatedAsset);
    showToast(`Updated asset: "${updatedAsset.title}"`);
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    deleteRemoteAsset(id);
    showToast('Asset deleted.');
  };

  // Handlers for Content Bank
  const handleAddBankItem = (newItem: ContentBankItem) => {
    setContentBank((prev) => [newItem, ...prev]);
    upsertRemoteContentBankItem(newItem);
    showToast(`Added copy item to bank.`);
  };

  const handleUpdateBankItem = (updatedItem: ContentBankItem) => {
    setContentBank((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    upsertRemoteContentBankItem(updatedItem);
    showToast(`Updated copy item in bank.`);
  };

  const handleDeleteBankItem = (id: string) => {
    setContentBank((prev) => prev.filter((item) => item.id !== id));
    deleteRemoteContentBankItem(id);
    showToast(`Deleted copy item from bank.`);
  };

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
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: creatorName,
          action: 'Created from a content bank item',
          timestamp: logTimestamp()
        }
      ]
    };
    setPosts((prev) => [newPost, ...prev]);
    upsertRemotePost(newPost);
    setActiveModalPost(newPost);
    showToast(`Created backlog post from swipe copy.`);
  };

  // Handlers for Notifications
  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleSelectNotificationPost = (postId: string) => {
    const found = posts.find((p) => p.id === postId);
    if (found) {
      setActiveModalPost(found);
      setCurrentTab('calendar');
    }
  };

  // Handler for "Publish Now"
  const handlePublishNow = () => {
    const toMarkPosted = posts.filter((p) => p.status === 'ready-to-post');
    setPosts((prev) =>
      prev.map((p) => (p.status === 'ready-to-post' ? { ...p, status: 'posted' } : p))
    );
    toMarkPosted.forEach((p) => upsertRemotePost({ ...p, status: 'posted' }));
    showToast('Marked all "Ready to post" items as posted.');
  };

  // Handler for Resetting Data — clears the local cache only, never remote
  // data other teammates rely on.
  const handleResetData = () => {
    resetToDefaults();
    window.location.reload();
  };

  // Team members are edited as a whole array by TopNav's settings panel
  // (add/edit/remove all call this), so push the diff to Supabase here.
  const handleSaveTeamMembers = (members: TeamMember[]) => {
    const removedIds = teamMembers.filter((m) => !members.some((nm) => nm.id === m.id)).map((m) => m.id);
    setTeamMembers(members);
    members.forEach(upsertRemoteTeamMember);
    removedIds.forEach(deleteRemoteTeamMember);
  };

  // One-time push of this browser's local data up to Supabase (Settings → System).
  const handleImportLocalData = async () => {
    setImportingData(true);
    try {
      const counts = await importLocalDataToRemote();
      showToast(
        `Imported ${counts.posts} posts, ${counts.templates} templates, ${counts.assets} assets, ${counts.contentBank} bank items, ${counts.team} people.`
      );
    } finally {
      setImportingData(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1b1c1a] font-body-md flex flex-col md:flex-row">
      {/* Toast Banner Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1b1c1a] text-white font-label-caps text-[11px] px-5 py-3.5 rounded-lg warm-shadow-lg border-l-4 border-[#296c00] toast-in">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78d24b] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#296c00]"></span>
          </span>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToast(null);
              }}
              className="text-[#78d24b] font-bold hover:underline flex-shrink-0"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Side Navigation */}
      <SideNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        selectedBrandFilter={selectedBrandFilter}
        onSelectBrandFilter={setSelectedBrandFilter}
        onOpenNewPostModal={() => {
          setNewPostInitialDate(undefined);
          setIsNewPostModalOpen(true);
        }}
        isMobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onSelectNotificationPost={handleSelectNotificationPost}
          onOpenNewPostModal={() => {
            setNewPostInitialDate(undefined);
            setIsNewPostModalOpen(true);
          }}
          onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
          selectedBrandFilter={selectedBrandFilter}
          onPublishNow={handlePublishNow}
          onResetData={handleResetData}
          onSelectTab={setCurrentTab}
          teamMembers={teamMembers}
          onSaveTeamMembers={handleSaveTeamMembers}
          isRemoteConfigured={isSupabaseConfigured()}
          onImportLocalData={handleImportLocalData}
          isImportingData={importingData}
          activeTeammateId={activeTeammateId}
          onSelectActiveTeammate={setActiveTeammateId}
          onLogout={handleLogout}
        />

        {/* Dynamic View Tab Rendering */}
        <main className="flex-1 overflow-x-hidden mobile-content-pad">
          {currentTab === 'calendar' && (
            <CalendarView
              posts={posts}
              selectedBrandFilter={selectedBrandFilter}
              onSelectPost={(post) => setActiveModalPost(post)}
              onDeletePost={handleDeletePost}
              onOpenNewPostModal={(dateStr) => {
                setNewPostInitialDate(dateStr);
                setIsNewPostModalOpen(true);
              }}
              searchQuery={searchQuery}
              onSavePost={handleSavePost}
              onAddPost={handleAddPost}
              teamMembers={teamMembers}
              activeTeammate={activeTeammate}
            />
          )}

          {currentTab === 'templates' && (
            <TemplateLibrary
              templates={templates}
              onUseTemplate={handleUseTemplate}
              onSaveNewTemplate={handleSaveNewTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              selectedBrandFilter={selectedBrandFilter}
            />
          )}

          {currentTab === 'brand-kit' && (
            <BrandControlCenter
              selectedBrandFilter={selectedBrandFilter}
              onSelectBrandFilter={setSelectedBrandFilter}
            />
          )}

          {currentTab === 'assets' && (
            <AssetLibrary
              assets={assets}
              selectedBrandFilter={selectedBrandFilter}
              onAddAsset={handleAddAsset}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
            />
          )}

          {currentTab === 'telemetry' && (
            <MissionControlDashboard
              posts={posts}
              teamMembers={teamMembers}
              onOpenNewPostModal={() => {
                setNewPostInitialDate(undefined);
                setIsNewPostModalOpen(true);
              }}
              onSelectPost={(post) => setActiveModalPost(post)}
              onDeletePost={handleDeletePost}
            />
          )}

          {currentTab === 'appscript' && (
            <GoogleAppsScriptHub
              posts={posts}
              onUploadComplete={(newUrl) => {
                showToast(`Asset uploaded! Direct URL: ${newUrl}`);
              }}
            />
          )}

          {currentTab === 'content-bank' && (
            <ContentBank
              contentBank={contentBank}
              selectedBrandFilter={selectedBrandFilter}
              onAddBankItem={handleAddBankItem}
              onUpdateBankItem={handleUpdateBankItem}
              onDeleteBankItem={handleDeleteBankItem}
              onCreatePostFromCopy={handleCreatePostFromCopy}
            />
          )}

          {currentTab === 'audit' && (
            <AuditLogView teamMembers={teamMembers} />
          )}
        </main>
      </div>

      {/* Post Detail & Edit Modal Drawer */}
      {activeModalPost && (
        <PostDetailModal
          post={activeModalPost}
          onSavePost={handleSavePost}
          onDeletePost={handleDeletePost}
          onDuplicatePost={handleDuplicatePost}
          onClose={() => setActiveModalPost(null)}
          contentBank={contentBank}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
        />
      )}

      {/* New Post Creation Modal */}
      {isNewPostModalOpen && (
        <NewPostModal
          initialDate={newPostInitialDate}
          initialTemplateId={presetTemplateId}
          templates={templates}
          selectedBrandFilter={selectedBrandFilter}
          onAddPost={handleAddPost}
          onClose={() => {
            setIsNewPostModalOpen(false);
            setPresetTemplateId(undefined);
          }}
          contentBank={contentBank}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
        />
      )}

      {/* Command Palette (Cmd/Ctrl+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        posts={posts}
        onSelectTab={setCurrentTab}
        onSelectBrandFilter={setSelectedBrandFilter}
        onSelectPost={(post) => setActiveModalPost(post)}
        onOpenNewPostModal={() => {
          setNewPostInitialDate(undefined);
          setPresetTemplateId(undefined);
          setIsNewPostModalOpen(true);
        }}
      />

      {/* ── Mobile Bottom Tab Bar (hidden on md+) ── */}
      <nav className="bottom-tab-bar" aria-label="Mobile navigation">
        <button
          className={`bottom-tab-item ${currentTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setCurrentTab('telemetry')}
          aria-label="Dashboard"
        >
          <span className="material-symbols-outlined text-xl">monitoring</span>
          <span className="bottom-tab-label">Dash</span>
        </button>

        <button
          className={`bottom-tab-item ${currentTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setCurrentTab('calendar')}
          aria-label="Calendar"
        >
          <span className="material-symbols-outlined text-xl">calendar_month</span>
          <span className="bottom-tab-label">Calendar</span>
        </button>

        {/* Centre: New Post FAB-style button */}
        <button
          className="bottom-tab-item"
          onClick={() => {
            setNewPostInitialDate(undefined);
            setIsNewPostModalOpen(true);
          }}
          aria-label="New Post"
        >
          <span
            className="w-10 h-10 rounded-full bg-[#296c00] text-white flex items-center justify-center shadow-lg -mt-5"
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </span>
          <span className="bottom-tab-label mt-1">New</span>
        </button>

        <button
          className={`bottom-tab-item ${currentTab === 'content-bank' ? 'active' : ''}`}
          onClick={() => setCurrentTab('content-bank')}
          aria-label="Content Bank"
        >
          <span className="material-symbols-outlined text-xl">article</span>
          <span className="bottom-tab-label">Copy</span>
        </button>

        <button
          className={`bottom-tab-item ${currentTab === 'templates' ? 'active' : ''}`}
          onClick={() => setCurrentTab('templates')}
          aria-label="Templates"
        >
          <span className="material-symbols-outlined text-xl">quiz</span>
          <span className="bottom-tab-label">Templates</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
