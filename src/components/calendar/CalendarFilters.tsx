import React, { useState } from 'react';
import { PostStatus, Platform, TeamMember } from '../../types';

interface CalendarFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: PostStatus | 'all';
  setStatusFilter: (status: PostStatus | 'all') => void;
  platformFilter: Platform | 'all';
  setPlatformFilter: (platform: Platform | 'all') => void;
  assigneeFilter: string;
  setAssigneeFilter: (assignee: string) => void;
  uniqueAssignees: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeTeammate?: TeamMember | null;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  setStatusFilter,
  platformFilter,
  setPlatformFilter,
  assigneeFilter,
  setAssigneeFilter,
  uniqueAssignees,
  onClearFilters,
  hasActiveFilters,
  activeTeammate
}) => {
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (platformFilter !== 'all' ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const isMyPostsActive = Boolean(
    activeTeammate && assigneeFilter === activeTeammate.name
  );

  const toggleMyPosts = () => {
    if (!activeTeammate) return;
    if (isMyPostsActive) {
      setAssigneeFilter('all');
    } else {
      setAssigneeFilter(activeTeammate.name);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-[#f7f6f2] p-2.5 sm:p-3 rounded-xl border border-[#e5e4de] shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#707a67]">
            search
          </span>
          <input
            id="app-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, tag, caption..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#bfcab4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a] placeholder-[#707a67]"
          />
        </div>

        {/* ── Quick "My Posts" Chip ── */}
        {activeTeammate && (
          <button
            type="button"
            onClick={toggleMyPosts}
            className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isMyPostsActive
                ? 'bg-[#296c00] text-white shadow-xs'
                : 'bg-white border border-[#bfcab4] text-[#404a39] hover:bg-[#efeeea]'
            }`}
            title="Filter to posts assigned to you"
          >
            <span className="material-symbols-outlined text-sm">person</span>
            <span>My Posts</span>
          </button>
        )}

        {/* ── Mobile Filter Trigger Button ── */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMobileFilterSheet(true)}
            className="flex-1 py-2 px-3 bg-white border border-[#bfcab4] rounded-lg text-xs font-label-caps font-bold text-[#1b1c1a] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-[#296c00]">tune</span>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#296c00] text-white text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="py-2 px-3 bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-xs font-label-caps font-bold cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Desktop Filter Dropdowns ── */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PostStatus | 'all')}
            className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
          >
            <option value="all">All Statuses</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="ready-to-post">Ready to Post</option>
            <option value="posted">Posted</option>
          </select>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | 'all')}
            className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
          >
            <option value="all">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">Twitter / X</option>
            <option value="web">Website / Blog</option>
            <option value="email">Email Broadcast</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-2.5 py-1.5 text-xs font-bold font-label-caps text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Filter Bottom Sheet Drawer ── */}
      {showMobileFilterSheet && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-fadeIn">
          <div className="bg-[#FAF9F5] border-t border-[#bfcab4] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl p-5 space-y-4 animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e4de]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#296c00]">tune</span>
                <h3 className="font-display-xl text-base font-bold text-[#1b1c1a]">Filter Calendar</h3>
              </div>
              <button
                onClick={() => setShowMobileFilterSheet(false)}
                className="p-1.5 text-[#707a67] hover:text-[#1b1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
              {/* Status Section */}
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'not-started', 'in-progress', 'ready-to-post', 'posted'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer ${
                        statusFilter === st
                          ? 'bg-[#296c00] text-white shadow-xs'
                          : 'bg-white border border-[#bfcab4] text-[#404a39]'
                      }`}
                    >
                      {st === 'all' ? 'All' : st.replace(/-/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Section */}
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-2">
                  Platform
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'instagram', 'linkedin', 'twitter', 'web', 'email'] as const).map((pl) => (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => setPlatformFilter(pl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer ${
                        platformFilter === pl
                          ? 'bg-[#296c00] text-white shadow-xs'
                          : 'bg-white border border-[#bfcab4] text-[#404a39]'
                      }`}
                    >
                      {pl === 'all' ? 'All' : pl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee Section */}
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-2">
                  Assignee
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssigneeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer ${
                      assigneeFilter === 'all'
                        ? 'bg-[#296c00] text-white shadow-xs'
                        : 'bg-white border border-[#bfcab4] text-[#404a39]'
                    }`}
                  >
                    All Assignees
                  </button>
                  {uniqueAssignees.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAssigneeFilter(a)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer ${
                        assigneeFilter === a
                          ? 'bg-[#296c00] text-white shadow-xs'
                          : 'bg-white border border-[#bfcab4] text-[#404a39]'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#e5e4de]">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="flex-1 py-2.5 bg-[#ffdad6] text-[#ba1a1a] font-label-caps text-xs font-bold rounded-xl"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMobileFilterSheet(false)}
                className="flex-1 py-2.5 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded-xl shadow-md"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
