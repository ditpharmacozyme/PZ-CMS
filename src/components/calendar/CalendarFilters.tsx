import React from 'react';
import { PostStatus, Platform } from '../../types';

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
  hasActiveFilters
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#efeeea] p-2 sm:p-3 rounded-lg border border-[#bfcab4]">
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
          placeholder="Filter by title, tag, caption..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#bfcab4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a] placeholder-[#707a67]"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PostStatus | 'all')}
          className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
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
          className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
        >
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter / X</option>
          <option value="web">Website / Blog</option>
          <option value="email">Email / Newsletter</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="py-1.5 px-2.5 text-xs font-label-caps bg-white border border-[#bfcab4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#296c00] text-[#1b1c1a]"
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
            className="px-2.5 py-1.5 text-xs font-bold font-label-caps text-[#ba1a1a] hover:bg-[#ffdad6] rounded-md transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
