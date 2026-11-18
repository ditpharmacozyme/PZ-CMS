import React from 'react';

interface AdsItemActionsProps {
  name: string;
  hidden: boolean;
  onShare: () => void;
  onToggleHidden: () => void;
  /** Omit to hide the Edit button (e.g. the Unsorted system set). */
  onEdit?: () => void;
  /** Omit to hide the Delete button (not permitted / system set). */
  onDelete?: () => void;
}

const btn =
  'min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border border-[#efefed] bg-white text-[#5f5f5b] hover:text-[#1b1c1a] hover:bg-[#f4f4f3] cursor-pointer';

const IconButton: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`${btn} ${danger ? 'hover:!text-[#b3261e]' : ''}`}
  >
    <span aria-hidden="true" className="material-symbols-outlined text-lg">{icon}</span>
  </button>
);

/** Share / hide / edit / delete cluster rendered on every course, ad set and ad card. */
export const AdsItemActions: React.FC<AdsItemActionsProps> = ({
  name, hidden, onShare, onToggleHidden, onEdit, onDelete,
}) => (
  <div className="flex flex-wrap items-center justify-end gap-1">
    {hidden && (
      <span className="px-2 py-0.5 rounded-md bg-[#f4f4f3] text-[#5f5f5b] text-[10px] font-semibold">
        Hidden from public page
      </span>
    )}
    <IconButton icon="share" label={`Share ${name}`} onClick={onShare} />
    <IconButton
      icon={hidden ? 'visibility' : 'visibility_off'}
      label={`${hidden ? 'Unhide' : 'Hide'} ${name}`}
      onClick={onToggleHidden}
    />
    {onEdit && <IconButton icon="edit" label={`Edit ${name}`} onClick={onEdit} />}
    {onDelete && <IconButton icon="delete" label={`Delete ${name}`} onClick={onDelete} danger />}
  </div>
);
