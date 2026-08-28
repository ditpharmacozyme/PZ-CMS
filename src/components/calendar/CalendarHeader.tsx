import React from 'react';
import { BrandId } from '../../types';
import { BRANDS } from '../../data/brands';

interface CalendarHeaderProps {
  displayMode: 'month' | 'week' | 'list';
  setDisplayMode: (mode: 'month' | 'week' | 'list') => void;
  selectedBrandFilter: BrandId | 'all';
  currentYear: number;
  currentMonth: number;
  monthName: string;
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Jump straight to a month/year ("YYYY-MM"); hidden in list mode. */
  onJumpToMonth?: (value: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  onCsvFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  mobileBacklogOpen: boolean;
  setMobileBacklogOpen: (open: boolean) => void;
  backlogCount: number;
  onDuplicateWeekForward: () => void;
  /** Desktop had no visible way into bulk-select mode at all -- Ctrl/Cmd-click
   * on a card was the only path in. This button is that entry point. */
  isSelectMode?: boolean;
  setIsSelectMode?: (val: boolean) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  displayMode,
  setDisplayMode,
  selectedBrandFilter,
  currentYear,
  currentMonth,
  monthName,
  weekStart,
  onPrev,
  onNext,
  onToday,
  onJumpToMonth,
  onOpenNewPostModal,
  onCsvFileSelect,
  csvFileInputRef,
  isUploading,
  mobileBacklogOpen,
  setMobileBacklogOpen,
  backlogCount,
  onDuplicateWeekForward,
  isSelectMode = false,
  setIsSelectMode
}) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-[#e9e9e7] shadow-xs">
      {/* Hidden File Input for CSV Upload */}
      <input
        type="file"
        ref={csvFileInputRef}
        onChange={onCsvFileSelect}
        accept=".csv,.txt"
        className="hidden"
      />

      {/* Left: View Mode Toggle & Navigation */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Month / Week / List Selector */}
        <div className="inline-flex p-1 bg-[#f1f1f0] rounded-lg border border-[#e9e9e7]">
          <button
            onClick={() => setDisplayMode('month')}
            className={`px-2.5 py-1 text-xs font-bold font-label-caps rounded-md transition-all ${
              displayMode === 'month' ? 'bg-white text-[#1b1c1a] shadow-2xs' : 'text-[#5f5f5b] hover:text-[#1b1c1a]'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setDisplayMode('week')}
            className={`px-2.5 py-1 text-xs font-bold font-label-caps rounded-md transition-all ${
              displayMode === 'week' ? 'bg-white text-[#1b1c1a] shadow-2xs' : 'text-[#5f5f5b] hover:text-[#1b1c1a]'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setDisplayMode('list')}
            className={`px-2.5 py-1 text-xs font-bold font-label-caps rounded-md transition-all ${
              displayMode === 'list' ? 'bg-white text-[#1b1c1a] shadow-2xs' : 'text-[#5f5f5b] hover:text-[#1b1c1a]'
            }`}
          >
            List
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="w-8 h-8 rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] flex items-center justify-center text-[#1b1c1a] transition-all"
            title="Previous"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button
            onClick={onToday}
            className="px-2.5 py-1 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#1b1c1a] transition-all"
          >
            Today
          </button>
          <button
            onClick={onNext}
            className="w-8 h-8 rounded-lg border border-[#e9e9e7] hover:bg-[#f1f1f0] flex items-center justify-center text-[#1b1c1a] transition-all"
            title="Next"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {/* Current Date Display -- on month view the picker below carries the
            label on small screens, so this text only shows from md up. */}
        <h2 className="font-title-lg text-base sm:text-lg font-bold text-[#1b1c1a] ml-1">
          {displayMode === 'month' && <span className="hidden md:inline">{`${monthName} ${currentYear}`}</span>}
          {displayMode === 'week' &&
            `${weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(
              'default',
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}`}
          {displayMode === 'list' && 'All Scheduled Posts'}
        </h2>

        {/* Jump to any month/year -- reaching next March used to mean clicking ›
            seven times. Native month picker keeps it one interaction. */}
        {displayMode !== 'list' && onJumpToMonth && (
          <input
            type="month"
            aria-label="Jump to month"
            title="Jump to month"
            value={`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`}
            onChange={(e) => e.target.value && onJumpToMonth(e.target.value)}
            className="w-[10rem] bg-white border border-[#e9e9e7] rounded-lg px-2 py-1.5 text-xs font-label-caps text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#296c00]"
          />
        )}
      </div>

      {/* Right: Actions (Import, Week Duplicate, Mobile Backlog, + New Post) */}
      <div className="flex items-center gap-2 flex-wrap">
        {displayMode === 'week' && (
          <button
            onClick={onDuplicateWeekForward}
            className="px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] bg-[#f1f1f0] hover:bg-[#e4e2dc] text-[#57574f] flex items-center gap-1.5 transition-all"
            title="Duplicate all posts in visible week to next week"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            <span className="hidden sm:inline">Duplicate Week</span>
          </button>
        )}

        {setIsSelectMode && (
          <button
            onClick={() => setIsSelectMode(!isSelectMode)}
            className={`px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border flex items-center gap-1.5 transition-all ${
              isSelectMode
                ? 'bg-[#296c00] border-[#296c00] text-white'
                : 'bg-white border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#57574f]'
            }`}
            title="Select multiple posts for bulk actions"
          >
            <span className="material-symbols-outlined text-sm">checklist</span>
            <span className="hidden sm:inline">{isSelectMode ? 'Selecting…' : 'Select'}</span>
          </button>
        )}

        <button
          onClick={() => csvFileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] bg-white hover:bg-[#f1f1f0] text-[#57574f] flex items-center gap-1.5 transition-all disabled:opacity-50"
          title="Import Posts from CSV"
        >
          <span className="material-symbols-outlined text-sm">upload_file</span>
          <span className="hidden sm:inline">{isUploading ? 'Importing...' : 'Import CSV'}</span>
        </button>

        {/* Mobile Backlog Toggle Button */}
        <button
          onClick={() => setMobileBacklogOpen(!mobileBacklogOpen)}
          className="md:hidden px-3 py-1.5 text-xs font-bold font-label-caps rounded-lg border border-[#e9e9e7] bg-[#f1f1f0] text-[#57574f] flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">lightbulb</span>
          <span>Backlog ({backlogCount})</span>
        </button>

        {/* Primary + New Post Button */}
        <button
          onClick={() => onOpenNewPostModal()}
          className="px-3.5 py-1.5 text-xs font-bold font-label-caps rounded-lg bg-[#296c00] hover:bg-[#205400] text-white flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>New Post</span>
        </button>
      </div>
    </div>
  );
};
