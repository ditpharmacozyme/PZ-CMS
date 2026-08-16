import React, { useState } from 'react';
import { AppNotification, BrandId, TeamMember } from '../types';
import { BRANDS } from '../data/brands';
import { NavTab } from './SideNav';
import { provisionTeamMemberAccount } from '../utils/storage';
import { NotificationDrawer } from './NotificationDrawer';

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
}

const AVATAR_COLORS = [
  '#296c00', '#0A66C2', '#d97706', '#7c3aed',
  '#db2777', '#059669', '#dc2626', '#0891b2'
];

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
  onLogout
}) => {
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showActiveTeammatePopover, setShowActiveTeammatePopover] = useState(false);

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
    <header className="sticky top-0 z-40 bg-white border-b border-[#bfcab4] min-h-16 px-3 md:px-8 flex flex-col justify-center shadow-xs">
      <div className="flex items-center justify-between h-16 gap-2">

        {/* Left: Mobile menu button + brand context */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#404a39] hover:bg-[#efeeea] active:bg-[#e0dfdb] rounded-lg transition-colors"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#296c00] text-2xl hidden sm:inline-block">science</span>
            <div>
              <p className="font-headline-md text-base sm:text-lg font-bold text-[#296c00] tracking-tight leading-none">
                {selectedBrandFilter === 'all'
                  ? 'All 5 Brands'
                  : (BRANDS[selectedBrandFilter]?.name || 'Pharmacozyme')}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-label-caps text-[9px] text-[#707a67] uppercase tracking-wider">Brand-Ops Studio</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#78d24b] animate-pulse flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Center: Search (desktop) */}
        <div className="hidden md:flex items-center relative w-72 lg:w-80">
          <span className="material-symbols-outlined absolute left-3 text-[#707a67] text-lg pointer-events-none">search</span>
          <input
            id="app-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search posts, captions, tags..."
            className="w-full bg-[#f5f4f0] border-b-2 border-[#bfcab4] pl-9 pr-8 py-2 font-label-caps text-xs text-[#1b1c1a] focus:bg-white focus:border-[#296c00] focus:outline-none transition-all rounded-xs"
          />
          {searchQuery ? (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 text-[#707a67] hover:text-[#1b1c1a]">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : (
            <kbd className="absolute right-2.5 text-[9px] font-label-caps text-[#707a67] border border-[#bfcab4] rounded px-1 py-0.5 pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {/* Mobile search toggle */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#404a39] hover:bg-[#efeeea] rounded-full transition-colors"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-xl">search</span>
          </button>

          {/* New Post button (desktop) */}
          <button
            onClick={onOpenNewPostModal}
            className="hidden sm:flex items-center gap-1 bg-[#efeeea] border border-[#bfcab4] px-3 py-2 rounded font-label-caps text-xs text-[#296c00] hover:bg-[#296c00] hover:text-white transition-all font-bold min-h-[38px]"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>+ Post</span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
              className="relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#404a39] hover:bg-[#efeeea] active:bg-[#e0dfdb] rounded-full transition-colors"
              title="Alerts"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-[#ba1a1a] text-white text-[10px] font-label-caps font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
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

          {/* Settings — visible to Admin and Manager only */}
          {(activeTeammate?.userRole === 'Admin' || activeTeammate?.userRole === 'Manager') && (
            <button
              onClick={() => { setShowSettingsModal(true); setSettingsTab('team'); }}
              className="hidden sm:flex p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#404a39] hover:bg-[#efeeea] rounded-full transition-colors"
              title="Settings"
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
          )}

          {/* Mark as Posted — hidden on mobile */}
          <button
            onClick={onPublishNow}
            className="hidden sm:block bg-[#296c00] text-white font-label-caps text-xs font-bold px-3 sm:px-4 py-2 rounded shadow-xs hover:bg-[#1f5700] active:scale-95 transition-all min-h-[38px] whitespace-nowrap"
          >
            Mark Posted
          </button>

          {/* Active Teammate Profile / Logout Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActiveTeammatePopover(!showActiveTeammatePopover)}
              className="flex items-center gap-1.5 p-1 hover:bg-[#efeeea] rounded-full sm:rounded-lg transition-all focus:outline-none min-h-[38px]"
              title={`Logged in as: ${activeTeammate ? activeTeammate.name : 'Guest'}`}
            >
              <div
                className="w-8 h-8 rounded-full border border-[#bfcab4] flex items-center justify-center flex-shrink-0 text-white font-label-caps text-[11px] font-bold shadow-2xs relative"
                style={{ backgroundColor: activeTeammate?.color || '#296c00' }}
              >
                {activeTeammate ? (activeTeammate.avatarInitials || getInitials(activeTeammate.name)) : 'G'}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#78d24b] border border-white rounded-full" />
              </div>
              <div className="hidden lg:flex flex-col text-left pr-1.5 max-w-[120px]">
                <span className="font-headline-md text-[11px] font-bold text-[#1b1c1a] leading-none truncate">
                  {activeTeammate ? activeTeammate.name : 'Guest'}
                </span>
                <span className="font-label-caps text-[8px] text-[#707a67] uppercase tracking-wider mt-0.5 leading-none truncate">
                  {activeTeammate ? activeTeammate.userRole || activeTeammate.role : 'Editor'}
                </span>
              </div>
              <span className="material-symbols-outlined text-[#707a67] text-base hidden sm:inline-block">arrow_drop_down</span>
            </button>

            {showActiveTeammatePopover && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-64 bg-white border border-[#bfcab4] shadow-2xl rounded-lg z-50 p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#bfcab4]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#296c00] text-lg">account_circle</span>
                    <h3 className="font-label-caps text-[10px] font-bold text-[#1b1c1a] uppercase tracking-wider">Authenticated Profile</h3>
                  </div>
                  <button onClick={() => setShowActiveTeammatePopover(false)} className="text-[#707a67] hover:text-[#1b1c1a] p-0.5">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                {activeTeammate && (
                  <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded-lg flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: activeTeammate.color }}
                    >
                      {activeTeammate.avatarInitials || getInitials(activeTeammate.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1b1c1a] truncate">{activeTeammate.name}</p>
                      <p className="text-[10px] text-[#707a67] truncate">{activeTeammate.email}</p>
                      <span className="inline-block mt-1 font-label-caps text-[8px] font-bold uppercase bg-[#296c00]/15 text-[#296c00] px-1.5 py-0.5 rounded">
                        {activeTeammate.userRole || 'Editor'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Settings — mobile only; desktop has the dedicated header icon */}
                {(activeTeammate?.userRole === 'Admin' || activeTeammate?.userRole === 'Manager') && (
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      setShowSettingsModal(true);
                      setSettingsTab('team');
                    }}
                    className="sm:hidden w-full flex items-center justify-center gap-2 bg-[#efeeea] hover:bg-[#bfcab4]/40 text-[#1b1c1a] font-label-caps text-xs font-bold py-2 px-3 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">settings</span>
                    <span>Settings</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-[#ffdad6] hover:bg-[#ba1a1a] text-[#ba1a1a] hover:text-white font-label-caps text-xs font-bold py-2 px-3 rounded transition-colors"
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
        <div className="md:hidden pb-3 pt-1 border-t border-[#bfcab4]/50">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#707a67] text-lg pointer-events-none">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search posts, captions, tags..."
              autoFocus
              className="w-full bg-[#f5f4f0] border border-[#bfcab4] pl-9 pr-8 py-2 font-label-caps text-xs text-[#1b1c1a] focus:bg-white focus:border-[#296c00] focus:outline-none rounded"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-2 text-[#707a67]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#bfcab4] max-w-lg w-full rounded-lg shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="p-5 border-b border-[#bfcab4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#296c00]">settings</span>
                <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">Settings</h2>
              </div>
              <button
                onClick={() => { setShowSettingsModal(false); setEditingMember(null); setIsAddingMember(false); }}
                className="p-2 text-[#707a67] hover:text-[#1b1c1a] min-w-[40px] min-h-[40px] flex items-center justify-center rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-[#bfcab4]">
              <button
                onClick={() => setSettingsTab('team')}
                className={`flex-1 py-2.5 font-label-caps text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'team'
                    ? 'border-[#296c00] text-[#296c00] bg-[#f9f9f6]'
                    : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">group</span>
                Team Members
              </button>
              <button
                onClick={() => setSettingsTab('system')}
                className={`flex-1 py-2.5 font-label-caps text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'system'
                    ? 'border-[#296c00] text-[#296c00] bg-[#f9f9f6]'
                    : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
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
                      <p className="font-body-md text-xs text-[#707a67] mt-0.5">Add or edit the people who work on posts.</p>
                    </div>
                    {activeTeammate?.userRole === 'Admin' && (
                      <button
                        onClick={() => { setIsAddingMember(true); setEditingMember(null); }}
                        className="flex items-center gap-1 bg-[#296c00] text-white px-3 py-2 rounded font-label-caps text-xs font-bold hover:bg-[#1f5700] transition-colors"
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
                    <div className="p-4 bg-[#f0fdf4] border border-[#296c00]/30 rounded space-y-3">
                      {inviteSentTo ? (
                        <>
                          <div className="p-3 rounded bg-white border border-[#296c00]/20 text-[#296c00] text-xs font-body-md">
                            Invite sent to <strong>{inviteSentTo}</strong> — they'll get an email to set their password and log in.
                          </div>
                          <button onClick={handleCloseAddMember} className="w-full bg-[#296c00] text-white py-2 font-label-caps text-xs rounded font-bold hover:bg-[#1f5700]">
                            Done
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">New Team Member</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Full Name *</label>
                              <input
                                type="text"
                                value={newMember.name || ''}
                                onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Jane Smith"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:opacity-50"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Role *</label>
                              <input
                                type="text"
                                value={newMember.role || ''}
                                onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                                placeholder="e.g. Designer"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:opacity-50"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Email *</label>
                              <input
                                type="email"
                                value={newMember.email || ''}
                                onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                                placeholder="jane@pharmacozyme.com"
                                disabled={isCreatingAccount}
                                className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:opacity-50"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Avatar Colour</label>
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
                            <div className="p-2.5 rounded bg-[#fce8e6] border border-[#ba1a1a]/20 text-[#ba1a1a] text-xs font-body-md">
                              {createMemberError}
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleSaveNewMember}
                              disabled={isCreatingAccount || !newMember.name?.trim() || !newMember.role?.trim() || !newMember.email?.trim()}
                              className="flex-1 bg-[#296c00] text-white py-2 font-label-caps text-xs rounded font-bold hover:bg-[#1f5700] disabled:opacity-40 disabled:cursor-not-allowed"
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
                              className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea] disabled:opacity-50"
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
                      <div key={member.id} className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded">
                        {editingMember?.id === member.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Name</label>
                                <input
                                  type="text"
                                  value={editingMember.name}
                                  onChange={e => setEditingMember(p => p ? { ...p, name: e.target.value } : p)}
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">
                                  Role * {activeTeammate?.userRole !== 'Admin' && ' (Admin only)'}
                                </label>
                                <input
                                  type="text"
                                  disabled={activeTeammate?.userRole !== 'Admin'}
                                  value={editingMember.role}
                                  onChange={e => setEditingMember(p => p ? { ...p, role: e.target.value } : p)}
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:bg-[#f3f2ee] disabled:text-[#707a67]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">
                                  Permission Level {activeTeammate?.userRole !== 'Admin' && ' (Admin only)'}
                                </label>
                                <select
                                  disabled={activeTeammate?.userRole !== 'Admin'}
                                  value={editingMember.userRole}
                                  onChange={e => setEditingMember(p => p ? { ...p, userRole: e.target.value as TeamMember['userRole'] } : p)}
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:bg-[#f3f2ee] disabled:text-[#707a67]"
                                >
                                  <option value="Admin">Admin</option>
                                  <option value="Manager">Manager</option>
                                  <option value="Editor">Editor</option>
                                  <option value="Viewer">Viewer</option>
                                </select>
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Email</label>
                                <input
                                  type="email"
                                  value={editingMember.email}
                                  onChange={e => setEditingMember(p => p ? { ...p, email: e.target.value } : p)}
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Login PIN / Passcode</label>
                                <input
                                  type="password"
                                  value={editingMember.passcode || ''}
                                  onChange={e => setEditingMember(p => p ? { ...p, passcode: e.target.value } : p)}
                                  placeholder="Leave blank to keep current"
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Colour</label>
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
                              <button onClick={handleSaveEdit} className="flex-1 bg-[#296c00] text-white py-1.5 font-label-caps text-xs rounded font-bold hover:bg-[#1f5700]">Save</button>
                              <button onClick={() => setEditingMember(null)} className="px-4 py-1.5 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea]">Cancel</button>
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
                              <p className="font-label-caps text-[9px] text-[#707a67] uppercase truncate">{member.role}</p>
                              {member.email && <p className="font-body-md text-[10px] text-[#707a67] truncate">{member.email}</p>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingMember({ ...member, passcode: '' })}
                                className="p-1.5 text-[#296c00] hover:bg-[#efeeea] rounded"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                onClick={() => { if (confirm(`Remove ${member.name}?`)) handleDeleteMember(member.id); }}
                                className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded"
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
                      <p className="text-xs text-[#707a67] font-body-md text-center py-4">No team members yet. Add your first person above.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── SYSTEM TAB ── */}
              {settingsTab === 'system' && (
                <div className="space-y-4 text-xs font-body-md text-[#404a39]">
                  <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded">
                    <p className="font-label-caps text-[10px] text-[#296c00] font-bold mb-1 uppercase">Approver</p>
                    <p>All posts go through one approver: <strong>{teamMembers && teamMembers.length > 0 ? teamMembers[0].name : 'Team Lead'}</strong>. One sign-off covers all 5 brands.</p>
                  </div>

                  <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
                    <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">Google Drive / Apps Script</p>
                    <p>Images upload straight to Google Drive via Apps Script — nothing is stored on this device.</p>
                    {onSelectTab && (
                      <button
                        onClick={() => { onSelectTab('appscript'); setShowSettingsModal(false); }}
                        className="w-full mt-1 bg-[#296c00] text-white py-2 px-3 font-label-caps text-xs rounded hover:bg-[#1f5700] font-bold flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        <span>Open Automation Settings</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2">
                    <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">Shared Data</p>
                    {isRemoteConfigured ? (
                      <>
                        <p className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#296c00] flex-shrink-0" />
                          Connected — every change syncs live for everyone with this app. Nothing to click.
                        </p>
                        {onImportLocalData && (
                          <>
                            <p className="text-[11px] text-[#707a67] pt-1">
                              This button is only for a browser that had posts saved locally <em>before</em> shared data was turned on — everyday edits already sync automatically.
                            </p>
                            <button
                              onClick={() => {
                                if (confirm("Push everything in this browser's local data up to the shared store? This won't delete anything already there.")) {
                                  onImportLocalData();
                                }
                              }}
                              disabled={isImportingData}
                              className="w-full mt-1 bg-white border border-[#296c00] text-[#296c00] py-2 px-3 font-label-caps text-xs rounded hover:bg-[#296c00] hover:text-white disabled:opacity-50 font-bold flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">cloud_upload</span>
                              <span>{isImportingData ? 'Importing…' : 'Import old local data (one-time)'}</span>
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#bfcab4] flex-shrink-0" />
                        Not connected — data stays on this device only. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to share it with the team.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#bfcab4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-label-caps text-xs text-[#ba1a1a] font-bold">Reset All Data</p>
                      <p className="text-[11px] text-[#707a67]">Clears all posts, templates and settings</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('This will delete all posts and settings. Are you sure?')) {
                          onResetData();
                          setShowSettingsModal(false);
                        }
                      }}
                      className="bg-[#ba1a1a] text-white px-3 py-2 font-label-caps text-xs rounded hover:bg-[#93000a] min-h-[40px]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#bfcab4] flex justify-end">
              <button
                onClick={() => { setShowSettingsModal(false); setEditingMember(null); setIsAddingMember(false); }}
                className="bg-[#296c00] text-white px-5 py-2.5 font-label-caps text-xs font-bold rounded min-h-[40px] hover:bg-[#1f5700]"
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
