import React, { useEffect, useRef, useState } from 'react';
import { useBrands } from '../context/BrandsContext';
import { BrandId } from '../types';

interface QuickAddBarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Title only. Enter saves; the post inherits the active brand and is assigned to you. */
  onAdd: (title: string) => void;
  selectedBrandFilter: BrandId | 'all';
  activeTeammateName?: string;
}

/**
 * The global fast-capture path (opened with `a`, or from the command palette).
 * One field, Enter to save straight into the Idea Backlog -- no wizard, no
 * date, no modal chrome. Deliberately a thin bar rather than a new page: the
 * real authoring surface is still NewPostModal.
 */
export const QuickAddBar: React.FC<QuickAddBarProps> = ({
  isOpen,
  onClose,
  onAdd,
  selectedBrandFilter,
  activeTeammateName,
}) => {
  const { brands } = useBrands();
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      restoreFocusRef.current?.focus?.();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const brandLabel = selectedBrandFilter === 'all' ? 'Pharmacozyme' : brands[selectedBrandFilter]?.name || 'Pharmacozyme';

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-start justify-center pt-[16vh] px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick add idea"
        className="bg-white border border-[#e9e9e7] w-full max-w-lg rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e9e9e7]">
          <span className="material-symbols-outlined text-[#15803d]">bolt</span>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Quick idea — press Enter to save"
            className="flex-1 bg-transparent text-sm text-[#1b1c1a] focus:outline-none placeholder:text-[#e9e9e7]"
          />
          <kbd className="text-[10px] font-label-caps text-[#5f5f5b] border border-[#e9e9e7] rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#f4f4f3]">
          <p className="text-[11px] font-body-md text-[#5f5f5b]">
            Lands in the Idea Backlog · <span className="font-bold text-[#57574f]">{brandLabel}</span>
            {activeTeammateName ? <> · assigned to <span className="font-bold text-[#57574f]">{activeTeammateName}</span></> : null}
          </p>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="bg-[#4f46e5] text-white font-label-caps text-[11px] font-bold px-4 rounded hover:bg-[#4338ca] disabled:opacity-40 min-h-[44px]"
          >
            Add idea
          </button>
        </div>
      </div>
    </div>
  );
};
