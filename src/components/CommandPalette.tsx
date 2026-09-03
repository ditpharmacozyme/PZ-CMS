import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Post, BrandId } from '../types';
import { useBrands } from '../context/BrandsContext';
import { NavTab } from './SideNav';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  onSelectTab: (tab: NavTab) => void;
  onSelectBrandFilter: (brand: BrandId | 'all') => void;
  onSelectPost: (post: Post) => void;
  onOpenNewPostModal: () => void;
  /** Capture a one-line idea straight from the palette (title only). */
  onQuickAdd?: (title: string) => void;
}

type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  run: () => void;
};

const TAB_ITEMS: { tab: NavTab; label: string; icon: string }[] = [
  { tab: 'my-work', label: 'Go to My Work', icon: 'checklist' },
  { tab: 'calendar', label: 'Go to Calendar', icon: 'calendar_month' },
  { tab: 'templates', label: 'Go to Templates', icon: 'quiz' },
  { tab: 'content-bank', label: 'Go to Content Bank', icon: 'article' },
  { tab: 'research', label: 'Go to Research & Plans', icon: 'lightbulb' },
  { tab: 'brand-kit', label: 'Go to Brand Kit', icon: 'palette' },
  { tab: 'assets', label: 'Go to Assets', icon: 'layers' },
  { tab: 'dashboard', label: 'Go to Dashboard', icon: 'monitoring' },
  { tab: 'audit', label: 'Go to Activity Log', icon: 'shield_person' },
  { tab: 'integrations', label: 'Go to Integrations', icon: 'terminal' }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  posts,
  onSelectTab,
  onSelectBrandFilter,
  onSelectPost,
  onOpenNewPostModal,
  onQuickAdd
}) => {
  const { brands } = useBrands();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus after the modal has mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      {
        id: 'action-new-post',
        label: 'New post',
        hint: 'Action',
        icon: 'add_circle',
        run: () => { onSelectTab('calendar'); onOpenNewPostModal(); }
      },
      { id: 'brand-all', label: 'Show all 5 brands', hint: 'Brand filter', icon: 'apps', run: () => onSelectBrandFilter('all') },
      ...Object.values(brands).map((b) => ({
        id: `brand-${b.id}`,
        label: b.name,
        hint: 'Brand filter',
        icon: b.icon,
        run: () => onSelectBrandFilter(b.id)
      })),
      ...TAB_ITEMS.map((t) => ({
        id: `tab-${t.tab}`,
        label: t.label,
        hint: 'Navigate',
        icon: t.icon,
        run: () => onSelectTab(t.tab)
      })),
      ...posts.slice(0, 200).map((p) => ({
        id: `post-${p.id}`,
        label: p.title,
        hint: `${brands[p.brandId]?.name || p.brandId} · ${p.scheduledDate || 'Idea'}`,
        icon: 'description',
        run: () => { onSelectTab('calendar'); onSelectPost(p); }
      }))
    ];

    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) return list.slice(0, 8);
    const matches = list.filter((item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)).slice(0, 20);
    // Offer fast capture of the typed text as a backlog idea when nothing
    // matches it exactly -- so a search that finds nothing still does something.
    if (onQuickAdd && !matches.some((m) => m.label.toLowerCase() === q)) {
      matches.unshift({
        id: 'action-quick-add',
        label: `Create idea: “${raw}”`,
        hint: 'Action',
        icon: 'bolt',
        run: () => onQuickAdd(raw),
      });
    }
    return matches;
  }, [query, posts, brands, onSelectTab, onSelectBrandFilter, onSelectPost, onOpenNewPostModal, onQuickAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) {
        item.run();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className="bg-white border border-[#e9e9e7] w-full max-w-lg rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e9e9e7]">
          <span className="material-symbols-outlined text-[#5f5f5b]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a post, brand, or page…"
            className="flex-1 bg-transparent text-sm text-[#1b1c1a] focus:outline-none placeholder:text-[#e9e9e7]"
          />
          <kbd className="text-[10px] font-label-caps text-[#5f5f5b] border border-[#e9e9e7] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="text-xs font-body-md text-[#5f5f5b] text-center py-8">No matches.</p>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => { item.run(); onClose(); }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === activeIndex ? 'bg-[#eef2ff]' : 'hover:bg-[#f4f4f3]'
                }`}
              >
                <span className="material-symbols-outlined text-[#4f46e5] text-lg flex-shrink-0">{item.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[#1b1c1a] truncate">{item.label}</span>
                </span>
                <span className="text-[10px] font-label-caps text-[#5f5f5b] flex-shrink-0">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
