import React, { useState, useEffect } from 'react';
import { AppNotification, BrandId, TeamMember } from '../types';
import { BRANDS } from '../data/brands';
import { NavTab } from './SideNav';
import { provisionTeamMemberAccount } from '../utils/storage';
import { NotificationDrawer } from './NotificationDrawer';
import { getRollingBackups, deleteRollingBackup, RollingBackupSummary, WorkspaceBackupPayload } from '../utils/autoBackup';
import { useConfirm } from './ui/ConfirmDialog';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onSelectNotificationPost: (postId: string) => void;
  onOpenNewPostModal: () => void;
  onToggleMobileNav: () => void;
  selectedBrandFilter: BrandId | 'all';
  onSelectBrandFilter: (brand: BrandId | 'all') => void;
  onPublishNow: () => void;
  onResetData: () => void;
  onSelectTab?: (tab: NavTab) => void;
  teamMembers: TeamMember[];
  onSaveTeamMembers: (members: TeamMember[]) => void;
  onTeamMemberCreated: (member: TeamMember) => void;
  isRemoteConfigured?: boolean;
  onImportLocalData?: () => void;
  isImportingData?: boolean;
  activeTeammate: TeamMember | null;
  onLogout?: () => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  onCreateSnapshotNow?: () => void;
  onRestoreSnapshot?: (payload: WorkspaceBackupPayload) => void;
}

const AVATAR_COLORS = [
  '#4f46e5', '#0A66C2', '#d97706', '#7c3aed',
  '#db2777', '#059669', '#dc2626', '#0891b2'
];

function getInitials(name: string): string {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function canAccessSettings(member: TeamMember | null): boolean {
  if (!member) return false;
  const role = (member.userRole || member.role || '').toLowerCase();
  return role.includes('admin') || role.includes('owner') || role.includes('manager');
}

export const TopNav: React.FC<TopNavProps> = ({
  searchQuery,
  onSearchChange,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSelectNotificationPost,
  onOpenNewPostModal,
  onToggleMobileNav,
  selectedBrandFilter,
  onSelectBrandFilter,
  onPublishNow,
  onResetData,
  onSelectTab,
  teamMembers,
  onSaveTeamMembers,
  onTeamMemberCreated,
  isRemoteConfigured = false,
  onImportLocalData,
  isImportingData = false,
  activeTeammate,
  onLogout,
  onExportCSV,
  onExportJSON,
  onCreateSnapshotNow,
  onRestoreSnapshot
}) => {
  const confirm = useConfirm();
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showActiveTeammatePopover, setShowActiveTeammatePopover] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [rollingBackups, setRollingBackups] = useState<RollingBackupSummary[]>([]);

  useEffect(() => {
    if (showSettingsModal) {
      setRollingBackups(getRollingBackups());
    }
  }, [showSettingsModal]);

  // Brand picker options — same shape as the brand-group list SideNav used
  // to render before Phase 7 moved brand selection up here: an 'all' option
  // plus every BRANDS entry, independent of page navigation.
  const brandOptions: { id: BrandId | 'all'; label: string; shortCode: string; icon: string; logoUrl?: string; color?: string }[] = [
    { id: 'all', label: 'All 5 Brands', shortCode: 'ALL', icon: 'hub' },
    ...Object.values(BRANDS).map((b) => ({ id: b.id, label: b.name, shortCode: b.shortCode, icon: b.icon, logoUrl: b.logoUrl, color: b.primaryColor }))
  ];

  // Team management local state
  const [settingsTab, setSettingsTab] = useState<'team' | 'system'>('team');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '', role: '', email: '', color: AVATAR_COLORS[0]
  });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createMemberError, setCreateMemberError] = useState<string | null>(null);
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Adding a member creates a real Supabase Auth account (invite email) via
  // /api/team/create-member, which also writes the team_members row server
  // -side — this only ever reaches an Admin (see the Admin-only gate below),
  // so unlike the edit form, there's no non-Admin "forced to Editor label" case.
  const handleSaveNewMember = async () => {
    const name = newMember.name?.trim();
    const role = newMember.role?.trim();
    const email = newMember.email?.trim();
    if (!name || !role || !email) return;
    setIsCreatingAccount(true);
    setCreateMemberError(null);
    const { member, error } = await provisionTeamMemberAccount({
      name, role, email, color: newMember.color || AVATAR_COLORS[0]
    });
    setIsCreatingAccount(false);
    if (error || !member) {
      setCreateMemberError(error || 'Failed to create the account.');
      return;
    }
    onTeamMemberCreated(member);
    setInviteSentTo(email);
  };

  const handleCloseAddMember = () => {
    setNewMember({ name: '', role: '', email: '', color: AVATAR_COLORS[0] });
    setCreateMemberError(null);
    setInviteSentTo(null);
    setIsAddingMember(false);
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;
    const oldMember = teamMembers.find(m => m.id === editingMember.id);
    const finalPasscode = editingMember.passcode?.trim() || oldMember?.passcode || '1234';
    onSaveTeamMembers(
      teamMembers.map(m =>
        m.id === editingMember.id
          ? { ...editingMember, avatarInitials: getInitials(editingMember.name), passcode: finalPasscode }
          : m
      )
    );
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string) => {
    onSaveTeamMembers(teamMembers.filter(m => m.id !== id));
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#e9e9e7] min-h-16 px-3 md:px-8 flex flex-col justify-center shadow-xs">
      <div className="flex items-center justify-between h-16 gap-2">

        {/* Left: Mobile menu button + brand context */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#57574f] hover:bg-[#f1f1f0] active:bg-[#e4e4e2] rounded-lg transition-colors"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowBrandPicker((prev) => !prev)}
              className="flex items-center gap-2 pr-1.5 py-1 rounded-lg hover:bg-[#f1f1f0] active:bg-[#e4e4e2] transition-colors cursor-pointer"
              title="Switch brand"
              aria-haspopup="listbox"
              aria-expanded={showBrandPicker}
            >
              {selectedBrandFilter !== 'all' && BRANDS[selectedBrandFilter]?.logoUrl && (
                <span className="w-7 h-7 rounded-md bg-white p-0.5 border border-[#e9e9e7]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img
                    src={BRANDS[selectedBrandFilter].logoUrl}
                    alt={BRANDS[selectedBrandFilter].name}
                    className="w-full h-full object-contain"
                  />
                </span>
              )}
              <div className="text-left min-w-0">
                <p className="font-headline-md text-base sm:text-lg font-bold text-[#4f46e5] tracking-tight leading-none flex items-center gap-1 whitespace-nowrap">
                  <span className="truncate max-w-[42vw] sm:max-w-none">
                    {selectedBrandFilter === 'all'
                      ? 'All 5 Brands'
                      : (BRANDS[selectedBrandFilter]?.name || 'Pharmacozyme')}
                  </span>
                  <span className="material-symbols-outlined text-base text-[#5f5f5b] flex-shrink-0">arrow_drop_down</span>
                </p>
                <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
                  <span className="font-label-caps text-[9px] text-[#5f5f5b] tracking-wider">Brand-Ops Studio</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-pulse flex-shrink-0" />
                </div>
              </div>
            </button>

            {showBrandPicker && (
              <>
                <div
                  onClick={() => setShowBrandPicker(false)}
                  className="fixed inset-0 z-40"
                  aria-hidden="true"
                />
                <div
                  role="listbox"
                  className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#e9e9e7] shadow-2xl rounded-lg z-50 p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto"
                >
                  {brandOptions.map((opt) => {
                    const isSelected = selectedBrandFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSelectBrandFilter(opt.id);
                          setShowBrandPicker(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left font-label-caps text-[13px] transition-colors ${
                          isSelected
                            ? 'bg-[#eef2ff] text-[#4338ca] font-bold'
                            : 'text-[#5f5f5b] hover:bg-[#f1f1f0]'
                        }`}
                      >
                        {opt.logoUrl ? (
                          <div className="w-5 h-5 rounded bg-white p-0.5 border border-[#e9e9e7]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <img src={opt.logoUrl} alt={opt.label} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: opt.color }}>
                            {opt.icon}
                          </span>
                        )}
                        <span className="truncate flex-1">{opt.label}</span>
                        {isSelected && <span className="material-symbols-outlined text-base flex-shrink-0">check</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Search (desktop) */}
        <div className="hidden md:flex items-center relative w-72 lg:w-80">
          <span className="material-symbols-outlined absolute left-3 text-[#5f5f5b] text-lg pointer-events-none">search</span>
          <input
            id="app-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search posts, captions, tags..."
            className="w-full bg-[#f4f4f3] border-b-2 border-[#e9e9e7] pl-9 pr-8 py-2 font-label-caps text-xs text-[#1b1c1a] focus:bg-white focus:border-[#4f46e5] focus:outline-none transition-all rounded-xs"
          />
          {searchQuery ? (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 text-[#5f5f5b] hover:text-[#1b1c1a]">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : (
            <kbd className="absolute right-2.5 text-[9px] font-label-caps text-[#5f5f5b] border border-[#e9e9e7] rounded px-1 py-0.5 pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {/* Mobile search toggle */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#57574f] hover:bg-[#f1f1f0] rounded-full transition-colors"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-xl">search</span>
          </button>

          {/* New Post button (desktop) */}
          <button
            onClick={onOpenNewPostModal}
            className="hidden sm:flex items-center gap-1 bg-[#f1f1f0] border border-[#e9e9e7] px-3 py-2 rounded font-label-caps text-xs text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-all font-bold min-h-[38px]"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>+ Post</span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
              className={`relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full transition-colors ${
                unreadCount > 0
                  ? 'text-[#4f46e5] bg-[#eef2ff] hover:bg-[#e0e7ff]'
                  : 'text-[#57574f] hover:bg-[#f1f1f0] active:bg-[#e4e4e2]'
              }`}
              title="Alerts"
              aria-label={unreadCount > 0 ? `Alerts, ${unreadCount} unread` : 'Alerts'}
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#dc2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Drawer overrides the inline popover */}
            <NotificationDrawer
              notifications={notifications}
              isOpen={showNotificationsPopover}
              onClose={() => setShowNotificationsPopover(false)}
              onMarkAsRead={onMarkNotificationRead}
              onMarkAllAsRead={() => {
                if (onMarkAllNotificationsRead) onMarkAllNotificationsRead();
                setShowNotificationsPopover(false);
              }}
              onViewPost={(postId) => {
                onSelectNotificationPost(postId);
                setShowNotificationsPopover(false);
              }}
            />
          </div>

          {/* Settings — visible to Admin, Owner, and Manager */}
          {canAccessSettings(activeTeammate) && (
            <button
              onClick={() => { setShowSettingsModal(true); setSettingsTab('team'); }}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#57574f] hover:bg-[#f1f1f0] rounded-full transition-colors cursor-pointer"
              title="Settings"
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
          )}

          {/* Mark as Posted — hidden on mobile */}
          <button
            onClick={onPublishNow}
            className="hidden sm:block bg-[#4f46e5] text-white font-label-caps text-xs font-bold px-3 sm:px-4 py-2 rounded shadow-xs hover:bg-[#4338ca] active:scale-95 transition-all min-h-[38px] whitespace-nowrap cursor-pointer"
          >
            Mark Posted
          </button>

          {/* Active Teammate Profile / Logout Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActiveTeammatePopover(!showActiveTeammatePopover)}
              className="flex items-center gap-1.5 p-1 hover:bg-[#f1f1f0] rounded-full sm:rounded-lg transition-all focus:outline-none min-h-[38px] cursor-pointer"
              title={`Logged in as: ${activeTeammate ? activeTeammate.name : 'Guest'}`}
            >
              <div
                className="w-8 h-8 rounded-full border border-[#e9e9e7] flex items-center justify-center flex-shrink-0 text-white font-label-caps text-[11px] font-bold shadow-2xs relative"
                style={{ backgroundColor: activeTeammate?.color || '#4f46e5' }}
              >
                {activeTeammate ? (activeTeammate.avatarInitials || getInitials(activeTeammate.name)) : 'G'}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#15803d] border border-white rounded-full" />
              </div>
              <div className="hidden lg:flex flex-col text-left pr-1.5 max-w-[120px]">
                <span className="font-headline-md text-[11px] font-bold text-[#1b1c1a] leading-none truncate">
                  {activeTeammate ? activeTeammate.name : 'Guest'}
                </span>
                <span className="font-label-caps text-[8px] text-[#5f5f5b] tracking-wider mt-0.5 leading-none truncate">
                  {activeTeammate ? activeTeammate.userRole || activeTeammate.role : 'Editor'}
                </span>
              </div>
              <span className="material-symbols-outlined text-[#5f5f5b] text-base hidden sm:inline-block">arrow_drop_down</span>
            </button>

            {showActiveTeammatePopover && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-64 bg-white border border-[#e9e9e7] shadow-2xl rounded-lg z-50 p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#e9e9e7]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#4f46e5] text-lg">account_circle</span>
                    <h3 className="font-label-caps text-[10px] font-bold text-[#1b1c1a] tracking-wider">Authenticated Profile</h3>
                  </div>
                  <button onClick={() => setShowActiveTeammatePopover(false)} className="text-[#5f5f5b] hover:text-[#1b1c1a] p-0.5 cursor-pointer">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                {activeTeammate && (
                  <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: activeTeammate.color }}
                    >
                      {activeTeammate.avatarInitials || getInitials(activeTeammate.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1b1c1a] truncate">{activeTeammate.name}</p>
                      <p className="text-[10px] text-[#5f5f5b] truncate">{activeTeammate.email}</p>
                      <span className="inline-block mt-1 font-label-caps text-[8px] font-bold bg-[#4f46e5]/15 text-[#4f46e5] px-1.5 py-0.5 rounded">
                        {activeTeammate.userRole || 'Admin'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Settings — accessible directly from profile menu for Admins/Managers */}
                {canAccessSettings(activeTeammate) && (
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      setShowSettingsModal(true);
                      setSettingsTab('team');
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-[#f1f1f0] hover:bg-[#e9e9e7]/40 text-[#1b1c1a] font-label-caps text-xs font-bold py-2.5 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">settings</span>
                    <span>Studio Settings</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-[#fcebeb] hover:bg-[#dc2626] text-[#dc2626] hover:text-white font-label-caps text-xs font-bold py-2 px-3 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    <span>Sign Out / Switch User</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="md:hidden pb-3 pt-1 border-t border-[#e9e9e7]/50">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#5f5f5b] text-lg pointer-events-none">search</span>
            <input
              id="mobile-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search posts, captions, tags..."
              autoFocus
              className="w-full bg-[#f4f4f3] border border-[#e9e9e7] pl-9 pr-8 py-2 font-label-caps text-xs text-[#1b1c1a] focus:bg-white focus:border-[#4f46e5] focus:outline-none rounded"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-2 text-[#5f5f5b]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] max-w-lg w-full rounded-xl warm-shadow-lg relative max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="p-5 border-b border-[#e9e9e7] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4f46e5]">settings</span>
                <h2 className="font-headline-md text-[15px] font-bold text-[#1b1c1a]">Settings</h2>
              </div>
              <button
                onClick={() => { setShowSettingsModal(false); setEditingMember(null); setIsAddingMember(false); }}
                className="p-2 text-[#5f5f5b] hover:text-[#1b1c1a] min-w-[40px] min-h-[40px] flex items-center justify-center rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-[#e9e9e7]">
              <button
                onClick={() => setSettingsTab('team')}
                className={`flex-1 py-2.5 font-label-caps text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'team'
                    ? 'border-[#4f46e5] text-[#4f46e5] bg-[#f4f4f3]'
                    : 'border-transparent text-[#5f5f5b] hover:text-[#1b1c1a]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">group</span>
                Team Members
              </button>
              <button
                onClick={() => setSettingsTab('system')}
                className={`flex-1 py-2.5 font-label-caps text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'system'
                    ? 'border-[#4f46e5] text-[#4f46e5] bg-[#f4f4f3]'
                    : 'border-transparent text-[#5f5f5b] hover:text-[#1b1c1a]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                System
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* ── TEAM TAB ── */}
              {settingsTab === 'team' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline-md text-sm font-bold text-[#1b1c1a]">Your Team</p>
                      <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">Add or edit the people who work on posts.</p>
                    </div>
                    {activeTeammate?.userRole === 'Admin' && (
                      <button
                        onClick={() => { setIsAddingMember(true); setEditingMember(null); }}
                        className="flex items-center gap-1 bg-[#4f46e5] text-white px-3 py-2 rounded font-label-caps text-xs font-bold hover:bg-[#4338ca] transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">person_add</span>
                        Add Person
                      </button>
                    )}
                  </div>

                  {/* Add new member form — Admin only: creating a member here also
                      creates their real login (invite email), which only an Admin
                      can trigger (enforced server-side too). */}
                  {isAddingMember && (
                    <div className="p-4 bg-[#eef2ff] border border-[#4f46e5]/30 rounded space-y-3">
                      {inviteSentTo ? (
                        <>
                          <div className="p-3 rounded bg-white border border-[#4f46e5]/20 text-[#4f46e5] text-xs font-body-md">
                            Invite sent to <strong>{inviteSentTo}</strong> — they'll get an email to set their password and log in.
                          </div>
                          <button onClick={handleCloseAddMember} className="w-full bg-[#4f46e5] text-white py-2 font-label-caps text-xs rounded font-bold hover:bg-[#4338ca]">
                            Done
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold">New Team Member</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Full Name *</label>
                              <input
                                type="text"
                                value={newMember.name || ''}
                                onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Jane Smith"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5] disabled:opacity-50"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Role *</label>
                              <input
                                type="text"
                                value={newMember.role || ''}
                                onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                                placeholder="e.g. Designer"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5] disabled:opacity-50"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Email *</label>
                              <input
                                type="email"
                                value={newMember.email || ''}
                                onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                                placeholder="jane@pharmacozyme.com"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5] disabled:opacity-50"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Avatar Colour</label>
                              <div className="flex gap-2 flex-wrap">
                                {AVATAR_COLORS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setNewMember(p => ({ ...p, color: c }))}
                                    disabled={isCreatingAccount}
                                    className={`w-7 h-7 rounded-full border-2 transition-all ${newMember.color === c ? 'border-[#1b1c1a] scale-110' : 'border-transparent'} disabled:opacity-50`}
                                    style={{ background: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {createMemberError && (
                            <div className="p-2.5 rounded bg-[#fce8e6] border border-[#dc2626]/20 text-[#dc2626] text-xs font-body-md">
                              {createMemberError}
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleSaveNewMember}
                              disabled={isCreatingAccount || !newMember.name?.trim() || !newMember.role?.trim() || !newMember.email?.trim()}
                              className="flex-1 bg-[#4f46e5] text-white py-2 font-label-caps text-xs rounded font-bold hover:bg-[#4338ca] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isCreatingAccount ? (
                                <span className="flex items-center justify-center gap-2">
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Creating…
                                </span>
                              ) : 'Save Person'}
                            </button>
                            <button
                              onClick={handleCloseAddMember}
                              disabled={isCreatingAccount}
                              className="px-4 py-2 border border-[#e9e9e7] font-label-caps text-xs rounded hover:bg-[#f1f1f0] disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Team list */}
                  <div className="space-y-2">
                    {teamMembers.map(member => (
                      <div key={member.id} className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded">
                        {editingMember?.id === member.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Name</label>
                                <input
                                  type="text"
                                  value={editingMember.name}
                                  onChange={e => setEditingMember(p => p ? { ...p, name: e.target.value } : p)}
                                  className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">
                                  Role * {activeTeammate?.userRole !== 'Admin' && ' (Admin only)'}
                                </label>
                                <input
                                  type="text"
                                  disabled={activeTeammate?.userRole !== 'Admin'}
                                  value={editingMember.role}
                                  onChange={e => setEditingMember(p => p ? { ...p, role: e.target.value } : p)}
                                  className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5] disabled:bg-[#f1f1f0] disabled:text-[#5f5f5b]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">
                                  Permission Level {activeTeammate?.userRole !== 'Admin' && ' (Admin only)'}
                                </label>
                                <select
                                  disabled={activeTeammate?.userRole !== 'Admin'}
                                  value={editingMember.userRole}
                                  onChange={e => setEditingMember(p => p ? { ...p, userRole: e.target.value as TeamMember['userRole'] } : p)}
                                  className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5] disabled:bg-[#f1f1f0] disabled:text-[#5f5f5b]"
                                >
                                  <option value="Admin">Admin</option>
                                  <option value="Manager">Manager</option>
                                  <option value="Editor">Editor</option>
                                  <option value="Viewer">Viewer</option>
                                </select>
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Email</label>
                                <input
                                  type="email"
                                  value={editingMember.email}
                                  onChange={e => setEditingMember(p => p ? { ...p, email: e.target.value } : p)}
                                  className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Login PIN / Passcode</label>
                                <input
                                  type="password"
                                  value={editingMember.passcode || ''}
                                  onChange={e => setEditingMember(p => p ? { ...p, passcode: e.target.value } : p)}
                                  placeholder="Leave blank to keep current"
                                  className="w-full bg-white border border-[#e9e9e7] p-2 text-xs rounded focus:outline-none focus:border-[#4f46e5]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#5f5f5b] block">Colour</label>
                                <div className="flex gap-2 flex-wrap">
                                  {AVATAR_COLORS.map(c => (
                                    <button
                                      key={c}
                                      onClick={() => setEditingMember(p => p ? { ...p, color: c } : p)}
                                      className={`w-7 h-7 rounded-full border-2 transition-all ${editingMember.color === c ? 'border-[#1b1c1a] scale-110' : 'border-transparent'}`}
                                      style={{ background: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveEdit} className="flex-1 bg-[#4f46e5] text-white py-1.5 font-label-caps text-xs rounded font-bold hover:bg-[#4338ca]">Save</button>
                              <button onClick={() => setEditingMember(null)} className="px-4 py-1.5 border border-[#e9e9e7] font-label-caps text-xs rounded hover:bg-[#f1f1f0]">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-label-caps text-xs font-bold flex-shrink-0"
                              style={{ background: member.color }}
                            >
                              {member.avatarInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body-md text-sm font-bold text-[#1b1c1a] truncate">{member.name}</p>
                              <p className="font-label-caps text-[9px] text-[#5f5f5b] truncate">{member.role}</p>
                              {member.email && <p className="font-body-md text-[10px] text-[#5f5f5b] truncate">{member.email}</p>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingMember({ ...member, passcode: '' })}
                                className="p-1.5 text-[#4f46e5] hover:bg-[#f1f1f0] rounded"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                onClick={async () => { if (await confirm({ title: `Remove ${member.name}?`, confirmLabel: 'Remove', tone: 'danger' })) handleDeleteMember(member.id); }}
                                className="p-1.5 text-[#dc2626] hover:bg-[#fcebeb] rounded"
                                title="Remove"
                              >
                                <span className="material-symbols-outlined text-base">person_remove</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {teamMembers.length === 0 && (
                      <p className="text-xs text-[#5f5f5b] font-body-md text-center py-4">No team members yet. Add your first person above.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── SYSTEM TAB ── */}
              {settingsTab === 'system' && (
                <div className="space-y-4 text-xs font-body-md text-[#57574f]">
                  <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded space-y-2">
                    <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold">Google Drive / Apps Script</p>
                    <p>Images upload straight to Google Drive via Apps Script — nothing is stored on this device.</p>
                    {onSelectTab && (
                      <button
                        onClick={() => { onSelectTab('integrations'); setShowSettingsModal(false); }}
                        className="w-full mt-1 bg-[#4f46e5] text-white py-2 px-3 font-label-caps text-xs rounded hover:bg-[#4338ca] font-bold flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        <span>Open Automation Settings</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded space-y-2">
                    <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold">Shared Data</p>
                    {isRemoteConfigured ? (
                      <>
                        <p className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] flex-shrink-0" />
                          Connected — every change syncs live for everyone with this app. Nothing to click.
                        </p>
                        {onImportLocalData && (
                          <>
                            <p className="text-[11px] text-[#5f5f5b] pt-1">
                              This button is only for a browser that had posts saved locally <em>before</em> shared data was turned on — everyday edits already sync automatically.
                            </p>
                            <button
                              onClick={async () => {
                                if (await confirm({ title: 'Import old local data?', body: "Pushes everything in this browser's local data up to the shared store. This won't delete anything already there.", confirmLabel: 'Import' })) {
                                  onImportLocalData();
                                }
                              }}
                              disabled={isImportingData}
                              className="w-full mt-1 bg-white border border-[#4f46e5] text-[#4f46e5] py-2 px-3 font-label-caps text-xs rounded hover:bg-[#4f46e5] hover:text-white disabled:opacity-50 font-bold flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">cloud_upload</span>
                              <span>{isImportingData ? 'Importing…' : 'Import old local data (one-time)'}</span>
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e9e9e7] flex-shrink-0" />
                        Not connected — data stays on this device only. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to share it with the team.
                      </p>
                    )}
                  </div>

                  {/* Data Export & Backup */}
                  <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded space-y-2">
                    <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>1-Click Offline Backup & Export</span>
                    </p>
                    <p className="text-[11px] text-[#5f5f5b]">
                      Download your content calendar, swipe copy, and research plans as structured files for client reports or offline archiving.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {onExportCSV && (
                        <button
                          onClick={onExportCSV}
                          className="bg-white border border-[#e9e9e7] text-[#1b1c1a] hover:bg-[#f1f1f0] font-label-caps text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm text-[#4f46e5]">csv</span>
                          <span>Export CSV</span>
                        </button>
                      )}
                      {onExportJSON && (
                        <button
                          onClick={onExportJSON}
                          className="bg-white border border-[#e9e9e7] text-[#1b1c1a] hover:bg-[#f1f1f0] font-label-caps text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm text-[#4f46e5]">javascript</span>
                          <span>Export JSON</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Automated Rolling Local Backups */}
                  <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">history</span>
                        <span>Automated Rolling Snapshots</span>
                      </p>
                      {onCreateSnapshotNow && (
                        <button
                          onClick={() => {
                            onCreateSnapshotNow();
                            setRollingBackups(getRollingBackups());
                          }}
                          className="px-2 py-1 bg-white border border-[#e9e9e7] hover:bg-[#4f46e5] hover:text-white text-[#1b1c1a] font-label-caps text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">add</span>
                          <span>Snapshot Now</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#5f5f5b]">
                      Silent background snapshots stored in offline storage (keeps latest 5 versions). 1-click restore if a mistake happens.
                    </p>

                    {rollingBackups.length === 0 ? (
                      <p className="text-[10px] text-[#5f5f5b] italic bg-white p-2 rounded border border-[#efefed]">
                        No local snapshots yet. A snapshot is created automatically every 24h or click &quot;Snapshot Now&quot;.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {rollingBackups.map((b) => (
                          <div
                            key={b.id}
                            className="p-2 bg-white border border-[#efefed] rounded flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-label-caps text-[10px] font-bold text-[#1b1c1a]">
                                {new Date(b.timestamp).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-[#5f5f5b]">
                                {b.postCount} posts • {b.copyCount} copy items • {b.planCount} plans
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {onRestoreSnapshot && (
                                <button
                                  onClick={async () => {
                                    if (await confirm({ title: 'Restore workspace from this snapshot?', body: `Snapshot taken on ${new Date(b.timestamp).toLocaleString()}. This will update your current active session.`, confirmLabel: 'Restore' })) {
                                      onRestoreSnapshot(b.data);
                                      setShowSettingsModal(false);
                                    }
                                  }}
                                  className="px-2 py-1 bg-[#eef2ff] text-[#4f46e5] hover:bg-[#eef2ff] font-label-caps text-[9px] font-bold rounded cursor-pointer transition-colors"
                                >
                                  Restore
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setRollingBackups(deleteRollingBackup(b.id));
                                }}
                                className="p-1 text-[#5f5f5b] hover:text-[#dc2626] cursor-pointer transition-colors"
                                title="Delete snapshot"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#e9e9e7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-label-caps text-xs text-[#dc2626] font-bold">Reset All Data</p>
                      <p className="text-[11px] text-[#5f5f5b]">Clears all posts, templates and settings</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Reset all data?', body: 'This will delete all posts, templates and settings.', confirmLabel: 'Reset everything', tone: 'danger' })) {
                          onResetData();
                          setShowSettingsModal(false);
                        }
                      }}
                      className="bg-[#dc2626] text-white px-3 py-2 font-label-caps text-xs rounded hover:bg-[#b91c1c] min-h-[40px]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#e9e9e7] flex justify-end">
              <button
                onClick={() => { setShowSettingsModal(false); setEditingMember(null); setIsAddingMember(false); }}
                className="bg-[#4f46e5] text-white px-5 py-2.5 font-label-caps text-xs font-bold rounded min-h-[40px] hover:bg-[#4338ca]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
