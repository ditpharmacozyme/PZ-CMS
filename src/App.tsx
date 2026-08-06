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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { logTimestamp } from './utils/date';
import { generateNotifications, mergeNotifications } from './utils/notifications';

export function App() {
  const [posts, setPosts] = useState<Post[]>(() => getStoredPosts());
  const [templates, setTemplates] = useState<PostTemplate[]>(() => getStoredTemplates());
  const [assets, setAssets] = useState<BrandAsset[]>(() => getStoredAssets());
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getStoredNotifications()
  );
  const [contentBank, setContentBank] = useState<ContentBankItem[]>(() => getStoredContentBank());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => getStoredTeam());

  const [currentTab, setCurrentTab] = useState<NavTab>('calendar');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<BrandId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [activeModalPost, setActiveModalPost] = useState<Post | null>(null);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState<boolean>(false);
  const [newPostInitialDate, setNewPostInitialDate] = useState<string | undefined>(undefined);
  const [presetTemplateId, setPresetTemplateId] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);

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
      if (remoteTeam && remoteTeam.length > 0) setTeamMembers(remoteTeam);
    })();

    // Live subscriptions on every table, not just posts — a teammate adding a
    // template, asset, bank item, or team member shows up here without a
    // manual re-import or page refresh.
    const unsubs = [
      subscribeRemotePosts((remotePosts) => setPosts(remotePosts)),
      subscribeRemoteTemplates((remoteTemplates) => setTemplates(remoteTemplates)),
      subscribeRemoteAssets((remoteAssets) => setAssets(remoteAssets)),
      subscribeRemoteContentBank((remoteBank) => setContentBank(remoteBank)),
      subscribeRemoteTeam((remoteTeam) => setTeamMembers(remoteTeam))
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

  // Handlers for Post Operations
  const handleSavePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    upsertRemotePost(updatedPost);
    showToast(`Saved "${updatedPost.title}"`);
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
    } else {
      showToast('Post removed.');
    }
  };

  const handleDuplicatePost = (originalPost: Post) => {
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
          actor: originalPost.assignee || 'Someone',
          action: 'Duplicated from another post',
          timestamp: logTimestamp()
        }
      ]
    };
    setPosts((prev) => [duplicated, ...prev]);
    upsertRemotePost(duplicated);
    setActiveModalPost(duplicated);
    showToast('Post duplicated.');
  };

  const handleAddPost = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    upsertRemotePost(newPost);
    showToast(`Scheduled new post: "${newPost.title}"`);
  };

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
    const assignee = teamMembers && teamMembers.length > 0 ? teamMembers[0].name : '';
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
      assignee,
      visualUrl: '',
      approved: false,
      tags: [],
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: assignee || 'Someone',
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
  const [importingData, setImportingData] = useState(false);
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
        />

        {/* Dynamic View Tab Rendering */}
        <main className="flex-1 overflow-x-hidden">
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
    </div>
  );
}

export default App;
