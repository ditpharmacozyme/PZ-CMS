import React, { useState } from 'react';
import { AppNotification, BrandId, TeamMember } from '../types';
import { BRANDS } from '../data/brands';
import { NavTab } from './SideNav';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onSelectNotificationPost: (postId: string) => void;
  onOpenNewPostModal: () => void;
  onToggleMobileNav: () => void;
  selectedBrandFilter: BrandId | 'all';
  onPublishNow: () => void;
  onResetData: () => void;
  onSelectTab?: (tab: NavTab) => void;
  teamMembers: TeamMember[];
  onSaveTeamMembers: (members: TeamMember[]) => void;
  isRemoteConfigured?: boolean;
  onImportLocalData?: () => void;
  isImportingData?: boolean;
  activeTeammateId?: string;
  onSelectActiveTeammate?: (id: string) => void;
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
  onSelectNotificationPost,
  onOpenNewPostModal,
  onToggleMobileNav,
  selectedBrandFilter,
  onPublishNow,
  onResetData,
  onSelectTab,
  teamMembers,
  onSaveTeamMembers,
  isRemoteConfigured = false,
  onImportLocalData,
  isImportingData = false,
  activeTeammateId,
  onSelectActiveTeammate,
  onLogout
}) => {
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showActiveTeammatePopover, setShowActiveTeammatePopover] = useState(false);

  const activeTeammate = teamMembers.find(m => m.id === activeTeammateId) || teamMembers[0] || null;

  // Team management local state
  const [settingsTab, setSettingsTab] = useState<'team' | 'system'>('team');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '', role: '', email: '', color: AVATAR_COLORS[0]
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSaveNewMember = () => {
    // Only the owner can set a custom role — everyone else's addition
    // defaults to "Editor" regardless of what's in the (disabled) field.
    const role = activeTeammate?.name === 'Hamza Ansari' ? newMember.role?.trim() : 'Editor';
    if (!newMember.name?.trim() || !role) return;
    const member: TeamMember = {
      id: `tm-${Date.now()}`,
      name: newMember.name.trim(),
      role,
      email: newMember.email?.trim() || '',
      color: newMember.color || AVATAR_COLORS[0],
      avatarInitials: getInitials(newMember.name.trim())
    };
    onSaveTeamMembers([...teamMembers, member]);
    setNewMember({ name: '', role: '', email: '', color: AVATAR_COLORS[0] });
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

            {showNotificationsPopover && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 bg-white border border-[#bfcab4] shadow-2xl rounded-lg z-50 p-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[#bfcab4] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#296c00]">notifications_active</span>
                    <h3 className="font-label-caps text-xs font-bold text-[#1b1c1a]">ALERTS</h3>
                  </div>
                  <button onClick={() => setShowNotificationsPopover(false)} className="sm:hidden text-[#707a67] p-1">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs font-body-md text-[#707a67] py-4 text-center">No alerts right now.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onMarkNotificationRead(n.id);
                          if (n.postId) onSelectNotificationPost(n.postId);
                          setShowNotificationsPopover(false);
                        }}
                        className={`p-3 border rounded-md text-left transition-all cursor-pointer active:scale-[0.99] ${
                          n.read ? 'bg-[#faf9f5] border-[#bfcab4] opacity-75' : 'bg-white border-[#296c00] shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-label-caps text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            n.type === 'collision_alert'
                              ? 'bg-[#efeeea] text-[#404a39]'
                              : n.type === 'unassigned'
                              ? 'bg-[#aceecf] text-[#07513b]'
                              : 'bg-[#beb4ff] text-[#180064]'
                          }`}>
                            {n.type === 'collision_alert' ? 'Same day' : n.type === 'unassigned' ? 'Unassigned' : 'Due soon'}
                          </span>
                          <span className="font-code-sm text-[10px] text-[#707a67]">{n.date}</span>
                        </div>
                        <h4 className="font-headline-md text-xs font-bold text-[#1b1c1a]">{n.title}</h4>
                        <p className="font-body-md text-xs text-[#404a39] mt-1">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings — hidden on mobile */}
          <button
            onClick={() => { setShowSettingsModal(true); setSettingsTab('team'); }}
            className="hidden sm:flex p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#404a39] hover:bg-[#efeeea] rounded-full transition-colors"
            title="Settings"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>

          {/* Mark as Posted — hidden on mobile */}
          <button
            onClick={onPublishNow}
            className="hidden sm:block bg-[#296c00] text-white font-label-caps text-xs font-bold px-3 sm:px-4 py-2 rounded shadow-xs hover:bg-[#1f5700] active:scale-95 transition-all min-h-[38px] whitespace-nowrap"
          >
            Mark Posted
          </button>

          {/* Active Teammate Selector / Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActiveTeammatePopover(!showActiveTeammatePopover)}
              className="flex items-center gap-1.5 p-1 hover:bg-[#efeeea] rounded-full sm:rounded-lg transition-all focus:outline-none min-h-[38px]"
              title={`Acting as: ${activeTeammate ? activeTeammate.name : 'Guest'}`}
            >
              <div
                className="w-8 h-8 rounded-full border border-[#bfcab4] flex items-center justify-center flex-shrink-0 text-white font-label-caps text-[11px] font-bold shadow-2xs relative"
                style={{ backgroundColor: activeTeammate?.color || '#296c00' }}
              >
                {activeTeammate ? (activeTeammate.avatarInitials || getInitials(activeTeammate.name)) : 'G'}
                {/* Active pulse dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#78d24b] border border-white rounded-full" />
              </div>
              <div className="hidden lg:flex flex-col text-left pr-1.5 max-w-[120px]">
                <span className="font-headline-md text-[11px] font-bold text-[#1b1c1a] leading-none truncate">
                  {activeTeammate ? activeTeammate.name : 'Guest'}
                </span>
                <span className="font-label-caps text-[8px] text-[#707a67] uppercase tracking-wider mt-0.5 leading-none truncate">
                  {activeTeammate ? activeTeammate.role : 'Guest Editor'}
                </span>
              </div>
              <span className="material-symbols-outlined text-[#707a67] text-base hidden sm:inline-block">arrow_drop_down</span>
            </button>

            {showActiveTeammatePopover && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-64 bg-white border border-[#bfcab4] shadow-2xl rounded-lg z-50 p-3 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-[#bfcab4] mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#296c00] text-lg">supervised_user_circle</span>
                    <h3 className="font-label-caps text-[10px] font-bold text-[#1b1c1a] uppercase tracking-wider">Acting Teammate</h3>
                  </div>
                  <button onClick={() => setShowActiveTeammatePopover(false)} className="text-[#707a67] hover:text-[#1b1c1a] p-0.5">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="space-y-1 overflow-y-auto pr-0.5 max-h-60">
                  {teamMembers.map((member) => {
                    const isSelected = activeTeammate?.id === member.id;
                    return (
                      <button
                        key={member.id}
                        onClick={() => {
                          if (onSelectActiveTeammate) onSelectActiveTeammate(member.id);
                          setShowActiveTeammatePopover(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-md transition-colors text-left ${
                          isSelected ? 'bg-[#f0fae8] border border-[#296c00]/20' : 'hover:bg-[#faf9f5]'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-label-caps text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.avatarInitials || getInitials(member.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body-md text-xs font-bold text-[#1b1c1a] truncate flex items-center gap-1">
                            <span>{member.name}</span>
                            {isSelected && <span className="text-[#296c00] text-[9.5px]">●</span>}
                          </p>
                          <p className="font-label-caps text-[8px] text-[#707a67] uppercase truncate leading-none mt-0.5">{member.role}</p>
                        </div>
                      </button>
                    );
                  })}
                  {teamMembers.length === 0 && (
                    <p className="text-[10px] text-[#707a67] py-2 text-center">No teammates found.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#bfcab4] mt-2 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      setShowSettingsModal(true);
                      setSettingsTab('team');
                    }}
                    className="w-full text-center py-1.5 border border-dashed border-[#bfcab4] text-[#296c00] font-label-caps text-[10px] font-bold rounded hover:bg-[#f0fae8] transition-colors"
                  >
                    + Manage Team
                  </button>

                  {/* System Config (Mobile only) */}
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      setShowSettingsModal(true);
                      setSettingsTab('system');
                    }}
                    className="sm:hidden w-full flex items-center justify-center gap-1.5 py-1.5 text-[#404a39] font-label-caps text-[10px] font-bold hover:bg-[#efeeea] rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">settings</span>
                    <span>System Config</span>
                  </button>

                  {/* Mark All Posted (Mobile only) */}
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      onPublishNow();
                    }}
                    className="sm:hidden w-full flex items-center justify-center gap-1.5 py-1.5 text-[#296c00] font-label-caps text-[10px] font-bold hover:bg-[#f0fae8] rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Mark all Posted</span>
                  </button>

                  {/* Sign Out / Lock */}
                  <button
                    onClick={() => {
                      setShowActiveTeammatePopover(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[#ba1a1a] font-label-caps text-[10px] font-bold hover:bg-[#ffdad6]/40 rounded transition-colors border-t border-[#bfcab4]/60 mt-1"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
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
                    <button
                      onClick={() => { setIsAddingMember(true); setEditingMember(null); }}
                      className="flex items-center gap-1 bg-[#296c00] text-white px-3 py-2 rounded font-label-caps text-xs font-bold hover:bg-[#1f5700] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      Add Person
                    </button>
                  </div>

                  {/* Add new member form */}
                  {isAddingMember && (
                    <div className="p-4 bg-[#f0fdf4] border border-[#296c00]/30 rounded space-y-3">
                      <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">New Team Member</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Full Name *</label>
                          <input
                            type="text"
                            value={newMember.name || ''}
                            onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                            placeholder="e.g. Jane Smith"
                            className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">
                            Role * {activeTeammate?.name !== 'Hamza Ansari' && ' (Hamza only)'}
                          </label>
                          <input
                            type="text"
                            disabled={activeTeammate?.name !== 'Hamza Ansari'}
                            value={activeTeammate?.name === 'Hamza Ansari' ? (newMember.role || '') : 'Editor'}
                            onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                            placeholder="e.g. Designer"
                            className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:bg-[#f3f2ee] disabled:text-[#707a67]"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Email</label>
                          <input
                            type="email"
                            value={newMember.email || ''}
                            onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                            placeholder="jane@pharmacozyme.com"
                            className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Login PIN / Passcode</label>
                          <input
                            type="password"
                            value={newMember.passcode || ''}
                            onChange={e => setNewMember(p => ({ ...p, passcode: e.target.value }))}
                            placeholder="e.g. 1234"
                            className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00]"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="font-label-caps text-[9px] text-[#707a67] uppercase block">Avatar Colour</label>
                          <div className="flex gap-2 flex-wrap">
                            {AVATAR_COLORS.map(c => (
                              <button
                                key={c}
                                onClick={() => setNewMember(p => ({ ...p, color: c }))}
                                className={`w-7 h-7 rounded-full border-2 transition-all ${newMember.color === c ? 'border-[#1b1c1a] scale-110' : 'border-transparent'}`}
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveNewMember} className="flex-1 bg-[#296c00] text-white py-2 font-label-caps text-xs rounded font-bold hover:bg-[#1f5700]">
                          Save Person
                        </button>
                        <button onClick={() => setIsAddingMember(false)} className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea]">
                          Cancel
                        </button>
                      </div>
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
                                  Role * {activeTeammate?.name !== 'Hamza Ansari' && ' (Hamza only)'}
                                </label>
                                <input
                                  type="text"
                                  disabled={activeTeammate?.name !== 'Hamza Ansari'}
                                  value={editingMember.role}
                                  onChange={e => setEditingMember(p => p ? { ...p, role: e.target.value } : p)}
                                  className="w-full bg-white border border-[#bfcab4] p-2 text-xs rounded focus:outline-none focus:border-[#296c00] disabled:bg-[#f3f2ee] disabled:text-[#707a67]"
                                />
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
