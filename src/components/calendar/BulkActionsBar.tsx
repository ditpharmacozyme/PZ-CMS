import React, { useRef, useState } from 'react';
import { TeamMember } from '../../types';
import { Popover } from '../ui/Popover';

interface BulkActionsBarProps {
  selectedCount: number;
  isSelectMode: boolean;
  setIsSelectMode: (val: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApplyBulkAssignees: (assignees: string[]) => void;
  onBulkDelete: () => void;
  teamMembers: TeamMember[];
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  isSelectMode,
  setIsSelectMode,
  onSelectAll,
  onClearSelection,
  onApplyBulkAssignees,
  onBulkDelete,
  teamMembers
}) => {
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [checkedNames, setCheckedNames] = useState<Set<string>>(new Set());
  const assignButtonRef = useRef<HTMLButtonElement>(null);

  if (!isSelectMode && selectedCount === 0) return null;

  const toggleName = (name: string) => {
    setCheckedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleApply = () => {
    if (checkedNames.size === 0) return;
    onApplyBulkAssignees(Array.from(checkedNames));
    setCheckedNames(new Set());
    setIsAssignOpen(false);
  };

  return (
    <>
      {/* Top Banner when in Select Mode */}
      {isSelectMode && (
        <div className="bg-[#eef2ff] border border-[#4f46e5] p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs font-bold text-[#4f46e5]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">checklist</span>
            <span>Select Mode Active — Tap or click cards to select</span>
          </div>
          <button
            onClick={() => {
              setIsSelectMode(false);
              onClearSelection();
            }}
            className="px-2.5 py-1 bg-white border border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white font-label-caps text-[10px] rounded-md transition-all"
          >
            Exit Select Mode
          </button>
        </div>
      )}

      {/* Sticky Floating Bottom Actions Toolbar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1b1c1a] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#57574f] flex items-center gap-3 max-w-[95vw] sm:max-w-xl overflow-x-auto scrollbar-thin animate-slideUp">
          <span className="font-bold text-xs font-label-caps text-[#e9e9e7] whitespace-nowrap">
            {selectedCount} selected
          </span>

          <div className="h-4 w-[1px] bg-[#57574f]" />

          {/* Select All */}
          <button
            onClick={onSelectAll}
            className="text-xs font-bold text-white hover:text-[#a5b4fc] font-label-caps transition-all whitespace-nowrap"
          >
            Select All
          </button>

          {/* Assign People (multi-select) */}
          <button
            ref={assignButtonRef}
            onClick={() => setIsAssignOpen((v) => !v)}
            className="bg-[#2a2b27] text-white text-xs font-label-caps py-1 px-2 rounded border border-[#57574f] hover:border-[#4f46e5] transition-all flex-shrink-0 whitespace-nowrap"
          >
            Assign People
          </button>
          <Popover isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} anchorRef={assignButtonRef} ariaLabel="Assign people to selected posts" className="w-64">
            <div className="p-2.5 border-b border-[var(--color-line-subtle)]">
              <p className="font-label-caps text-[10px] font-bold text-[var(--color-ink-muted)]">Assign to selected posts</p>
            </div>
            {teamMembers.length === 0 ? (
              <p className="p-3 text-[11px] font-body-md text-[var(--color-ink-muted)] italic">No team members to assign.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-line-subtle)]">
                {teamMembers.map((m) => {
                  const checked = checkedNames.has(m.name);
                  return (
                    <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-[var(--color-muted)] transition-colors cursor-pointer min-h-[36px]">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.avatarInitials}
                      </span>
                      <span className="font-body-md text-[12px] text-[var(--color-ink)] truncate flex-1">{m.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleName(m.name)}
                        aria-label={m.name}
                        className="w-3.5 h-3.5 text-[var(--color-accent)] border-[var(--color-line)] rounded flex-shrink-0 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            )}
            {checkedNames.size > 0 && (
              <div className="p-2 border-t border-[var(--color-line-subtle)]">
                <button
                  onClick={handleApply}
                  className="w-full py-1.5 bg-[var(--color-accent)] text-white font-label-caps text-xs font-bold rounded hover:opacity-90 transition-opacity"
                >
                  Apply to {checkedNames.size === 1 ? '1 person' : `${checkedNames.size} people`}
                </button>
              </div>
            )}
          </Popover>

          {/* Delete Button */}
          <button
            onClick={onBulkDelete}
            className="p-1.5 rounded text-[#ffb4ab] hover:bg-[#3b0908] hover:text-white transition-all ml-auto"
            title="Delete Selected"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>

          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="p-1.5 rounded text-[#c4c8ba] hover:bg-[#2a2b27] transition-all"
            title="Clear Selection"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </>
  );
};
