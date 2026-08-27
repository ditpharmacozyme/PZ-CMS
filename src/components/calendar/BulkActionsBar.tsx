import React from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  isSelectMode: boolean;
  setIsSelectMode: (val: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  bulkAssignee: string;
  onApplyBulkAssignee: (assignee: string) => void;
  onBulkDelete: () => void;
  teamMembers: { name: string }[];
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  isSelectMode,
  setIsSelectMode,
  onSelectAll,
  onClearSelection,
  bulkAssignee,
  onApplyBulkAssignee,
  onBulkDelete,
  teamMembers
}) => {
  if (!isSelectMode && selectedCount === 0) return null;

  return (
    <>
      {/* Top Banner when in Select Mode */}
      {isSelectMode && (
        <div className="bg-[#f0fae8] border border-[#296c00] p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs font-bold text-[#296c00]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">checklist</span>
            <span>Select Mode Active — Tap or click cards to select</span>
          </div>
          <button
            onClick={() => {
              setIsSelectMode(false);
              onClearSelection();
            }}
            className="px-2.5 py-1 bg-white border border-[#296c00] text-[#296c00] hover:bg-[#296c00] hover:text-white font-label-caps text-[10px] rounded-md transition-all"
          >
            Exit Select Mode
          </button>
        </div>
      )}

      {/* Sticky Floating Bottom Actions Toolbar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1b1c1a] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#404a39] flex items-center gap-3 max-w-[95vw] sm:max-w-xl overflow-x-auto scrollbar-thin animate-slideUp">
          <span className="font-bold text-xs font-label-caps text-[#bfcab4] whitespace-nowrap">
            {selectedCount} selected
          </span>

          <div className="h-4 w-[1px] bg-[#404a39]" />

          {/* Select All */}
          <button
            onClick={onSelectAll}
            className="text-xs font-bold text-white hover:text-[#90da75] font-label-caps transition-all whitespace-nowrap"
          >
            Select All
          </button>

          {/* Assignee Dropdown */}
          <select
            value={bulkAssignee}
            onChange={(e) => onApplyBulkAssignee(e.target.value)}
            className="bg-[#2a2b27] text-white text-xs font-label-caps py-1 px-2 rounded border border-[#404a39] focus:outline-none focus:ring-1 focus:ring-[#90da75] flex-shrink-0"
          >
            <option value="">Assign To...</option>
            {teamMembers.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>

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
