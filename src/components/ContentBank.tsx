import React, { useState, useMemo } from 'react';
import { ContentBankItem, BrandId } from '../types';
import { BRANDS } from '../data/brands';
import { todayStr } from '../utils/date';
import { useConfirm } from './ui/ConfirmDialog';

interface ContentBankProps {
  contentBank: ContentBankItem[];
  selectedBrandFilter: BrandId | 'all';
  onAddBankItem: (item: ContentBankItem) => void;
  onUpdateBankItem: (item: ContentBankItem) => void;
  onDeleteBankItem: (id: string) => void;
  onCreatePostFromCopy?: (text: string, brandId: BrandId) => void;
}

export const ContentBank: React.FC<ContentBankProps> = ({
  contentBank,
  selectedBrandFilter,
  onAddBankItem,
  onUpdateBankItem,
  onDeleteBankItem,
  onCreatePostFromCopy
}) => {
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<BrandId | 'shared' | 'all'>(
    selectedBrandFilter === 'all' ? 'all' : selectedBrandFilter
  );
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentBankItem | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Form states
  const [text, setText] = useState('');
  const [brandId, setBrandId] = useState<BrandId | 'shared'>('shared');
  const [tagsInput, setTagsInput] = useState('');
  const [source, setSource] = useState('');

  // Unique tags for tag selector
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    contentBank.forEach(item => {
      item.tags.forEach(tag => tagsSet.add(tag.trim()));
    });
    return Array.from(tagsSet);
  }, [contentBank]);

  // Filter content bank
  const filteredItems = useMemo(() => {
    return contentBank.filter(item => {
      // Brand filter
      if (selectedBrand !== 'all') {
        if (item.brandId !== selectedBrand) return false;
      } else if (selectedBrandFilter !== 'all') {
        // Respect global brand filter if selectedBrand is 'all'
        if (item.brandId !== 'shared' && item.brandId !== selectedBrandFilter) return false;
      }
      
      // Tag filter
      if (selectedTag !== 'all' && !item.tags.includes(selectedTag)) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = item.text.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
        if (!matchText && !matchSource && !matchTags) return false;
      }

      return true;
    });
  }, [contentBank, selectedBrand, selectedBrandFilter, selectedTag, searchQuery]);

  const handleCopyText = (item: ContentBankItem) => {
    navigator.clipboard.writeText(item.text);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2000);
  };

  const resetForm = () => {
    setText('');
    setBrandId(selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter);
    setTagsInput('');
    setSource('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEditModal = (item: ContentBankItem) => {
    setEditingItem(item);
    setText(item.text);
    setBrandId(item.brandId);
    setTagsInput(item.tags.join(', '));
    setSource(item.source);
  };

  const handleSaveItem = () => {
    if (!text.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (editingItem) {
      const updated: ContentBankItem = {
        ...editingItem,
        text: text.trim(),
        brandId,
        tags,
        source: source.trim() || 'Manual Entry'
      };
      onUpdateBankItem(updated);
      setEditingItem(null);
    } else {
      const newItem: ContentBankItem = {
        id: `cb-${Date.now()}`,
        text: text.trim(),
        brandId,
        tags,
        source: source.trim() || 'Manual Entry',
        savedDate: todayStr()
      };
      onAddBankItem(newItem);
      setShowAddModal(false);
    }
    resetForm();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bfcab4]">
        <div>
          <span className="font-label-caps text-xs text-[#296951] uppercase font-bold tracking-widest">
            Content Bank & Swipe File
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Reusable Copy, Captions & Hooks
          </h2>
          <p className="text-xs text-[#707a67] mt-1">
            Browse high-performing copy, hooks, and captions to deploy or copy instantly.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-[#296c00] text-white font-label-caps text-xs px-4 py-2.5 rounded shadow-sm hover:bg-[#1f5700] transition-all flex items-center gap-2 font-bold whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm font-bold">add</span>
          <span>Add Reusable Copy</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-4 border border-[#bfcab4] rounded shadow-2xs">
        {/* Search */}
        <div className="sm:col-span-2 relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-[#707a67] text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search copy content, tags, or sources..."
            className="w-full bg-[#faf9f5] border border-[#bfcab4] pl-9 pr-8 py-2 font-body-md text-xs text-[#1b1c1a] focus:bg-white focus:border-[#296c00] focus:outline-none rounded"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-[#707a67] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Brand Filter */}
        <div>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value as any)}
            className="w-full bg-[#faf9f5] border border-[#bfcab4] px-3 py-2 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
          >
            <option value="all">All Brands / Shared</option>
            <option value="shared">Shared Ecosystem Copy</option>
            {Object.values(BRANDS).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full bg-[#faf9f5] border border-[#bfcab4] px-3 py-2 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
          >
            <option value="all">All Copy Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Copy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full bg-white border border-[#bfcab4] p-12 text-center text-xs font-body-md text-[#707a67]">
            No reusable copy items found matching the selected parameters.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isShared = item.brandId === 'shared';
            const brand = !isShared ? BRANDS[item.brandId] : null;

            return (
              <div
                key={item.id}
                className="bg-white border border-[#bfcab4] rounded-lg p-5 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all gap-4 relative group"
              >
                {/* Header Labels */}
                <div className="flex justify-between items-center">
                  <span
                    className="font-label-caps text-[9px] px-2 py-0.5 rounded text-white font-bold uppercase shadow-2xs"
                    style={{ backgroundColor: brand?.primaryColor || '#5A38F0' }}
                  >
                    {brand ? brand.shortCode : 'SHARED ECOSYSTEM'}
                  </span>
                  <span className="font-code-sm text-[9px] text-[#707a67]">{item.savedDate}</span>
                </div>

                {/* Text Body */}
                <div className="flex-1">
                  <blockquote className="font-body-md text-xs sm:text-sm text-[#1b1c1a] leading-relaxed italic border-l-2 border-[#bfcab4] pl-3 py-1 bg-[#faf9f5]/50">
                    "{item.text}"
                  </blockquote>
                </div>

                {/* Footer Details & Tags */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="font-label-caps text-[8px] sm:text-[9px] bg-[#efeeea] border border-[#bfcab4] px-1.5 py-0.5 rounded text-[#404a39] font-bold"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-[10px] font-code-sm text-[#707a67] flex items-center justify-between">
                    <span>Source: {item.source}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-[#bfcab4]/50">
                    <button
                      onClick={() => handleCopyText(item)}
                      className={`flex-1 font-label-caps text-[10px] font-bold py-2 rounded border transition-colors flex items-center justify-center gap-1 min-h-[36px] ${
                        copiedItemId === item.id
                          ? 'bg-[#296c00] text-white border-[#296c00]'
                          : 'bg-[#faf9f5] border-[#bfcab4] text-[#296c00] hover:bg-[#efeeea]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedItemId === item.id ? 'check_circle' : 'content_copy'}
                      </span>
                      <span>{copiedItemId === item.id ? 'Copied!' : 'Copy Text'}</span>
                    </button>

                    {onCreatePostFromCopy && !isShared && (
                      <button
                        onClick={() => onCreatePostFromCopy(item.text, item.brandId as BrandId)}
                        className="flex-1 bg-[#296c00] text-white font-label-caps text-[10px] font-bold py-2 rounded hover:bg-[#1f5700] transition-colors flex items-center justify-center gap-1 min-h-[36px]"
                      >
                        <span className="material-symbols-outlined text-xs">add_box</span>
                        <span>Use Copy</span>
                      </button>
                    )}

                    {onCreatePostFromCopy && isShared && (
                      <button
                        onClick={() => {
                          const userBrand = selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter;
                          onCreatePostFromCopy(item.text, userBrand);
                        }}
                        className="flex-1 bg-[#296c00] text-white font-label-caps text-[10px] font-bold py-2 rounded hover:bg-[#1f5700] transition-colors flex items-center justify-center gap-1 min-h-[36px]"
                      >
                        <span className="material-symbols-outlined text-xs">add_box</span>
                        <span>Use Copy</span>
                      </button>
                    )}
                  </div>

                  {/* Edit/Delete Overlay Icons on Hover */}
                  <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 bg-white border border-[#bfcab4] text-[#1b1c1a] rounded shadow-xs hover:bg-[#efeeea]"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">edit</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this item from the content bank?', confirmLabel: 'Delete', tone: 'danger' })) {
                          onDeleteBankItem(item.id);
                        }
                      }}
                      className="p-1.5 bg-[#ffdad6] text-[#ba1a1a] border border-[#ffb4ab] rounded shadow-xs hover:bg-[#ffdad6]/80"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Swipe Item Modal */}
      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#bfcab4] max-w-lg w-full p-6 rounded shadow-2xl relative space-y-4 my-8">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingItem(null);
              }}
              className="absolute top-4 right-4 text-[#707a67] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
              {editingItem ? 'Edit Reusable Copy Item' : 'Add Reusable Copy Item'}
            </h2>

            <div className="space-y-4 text-xs font-body-md">
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Brand Ownership
                </label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value as any)}
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 font-label-caps text-xs focus:outline-none rounded"
                >
                  <option value="shared">Shared Ecosystem (All Brands)</option>
                  {Object.values(BRANDS).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Copy Text (Captions, Hooks, Snippets) *
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder="Paste or write the swipe copy here..."
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-3 text-xs leading-relaxed focus:outline-none focus:bg-white rounded"
                  required
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. Clinical, Oncology, Promo, Hook"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 text-xs focus:outline-none rounded"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Source Reference / Attribution
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Weekly Quiz #4, Dr. Alex, Efficacy report"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 text-xs focus:outline-none rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#bfcab4]">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700]"
              >
                {editingItem ? 'Update Swipe Item' : 'Save Swipe Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
