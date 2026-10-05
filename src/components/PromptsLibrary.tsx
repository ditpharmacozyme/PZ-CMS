import React, { useMemo, useState } from 'react';
import { Prompt } from '../types';
import { usePromptCategories } from '../hooks/usePromptCategories';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from '../utils/promptCategories';
import { PromptEditorModal } from './PromptEditorModal';
import { useConfirm } from './ui/ConfirmDialog';

export interface PromptsLibraryProps {
  prompts: Prompt[];
  onAddPrompt: (p: Prompt) => void;
  onUpdatePrompt: (p: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  activeTeammateName: string;
  showToast?: (message: string) => void;
}

export const PromptsLibrary: React.FC<PromptsLibraryProps> = ({
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  activeTeammateName,
  showToast,
}) => {
  const confirm = useConfirm();
  const { categories, addCategory, renameCategory, deleteCategory } = usePromptCategories();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q && !p.title.toLowerCase().includes(q) && !p.promptText.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prompts, categoryFilter, searchQuery]);

  const handleCopy = async (p: Prompt) => {
    await navigator.clipboard.writeText(p.promptText);
    setCopiedId(p.id);
    showToast?.('Prompt copied to clipboard');
    setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 2000);
  };

  const handleSave = (p: Prompt) => {
    if (editingPrompt) onUpdatePrompt(p); else onAddPrompt(p);
  };

  const handleDeleteCategory = async (name: string) => {
    const ok = await confirm({
      title: `Delete category "${name}"?`,
      body: `Prompts in it move to "${UNCATEGORIZED}".`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await addCategory(UNCATEGORIZED);
    applyCategoryDelete(prompts, name)
      .filter((p, i) => p !== prompts[i])
      .forEach((p) => onUpdatePrompt(p));
    await deleteCategory(name);
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    const ok = await renameCategory(oldName, trimmed);
    if (!ok) return false;
    applyCategoryRename(prompts, oldName, trimmed)
      .filter((p, i) => p !== prompts[i])
      .forEach((p) => onUpdatePrompt(p));
    return true;
  };

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-headline-md text-lg font-bold text-[#1b1c1a]">Prompts Library</h1>
        <button
          onClick={() => { setEditingPrompt(undefined); setEditorOpen(true); }}
          className="px-3.5 py-2 text-xs font-bold font-label-caps rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Prompt
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-[#5f5f5b]">search</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#e9e9e7] rounded-lg"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-1 min-w-0">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-2 font-label-caps text-xs rounded-xl whitespace-nowrap ${categoryFilter === 'all' ? 'bg-[#1b1c1a] text-white font-bold' : 'bg-white border border-[#efefed] text-[#57574f]'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.name)}
              className={`px-3.5 py-2 font-label-caps text-xs rounded-xl whitespace-nowrap ${categoryFilter === c.name ? 'bg-[#1b1c1a] text-white font-bold' : 'bg-white border border-[#efefed] text-[#57574f]'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowManageCategories((v) => !v)}
          className={`px-3 py-2 font-label-caps text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${showManageCategories ? 'bg-[#4f46e5] text-white' : 'bg-white border border-[#e9e9e7] text-[#57574f]'}`}
        >
          Manage categories
        </button>
      </div>

      {showManageCategories && (
        <div className="bg-white border border-[#efefed] rounded-2xl p-4 space-y-3">
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    const el = e.currentTarget;
                    if (!el.value.trim()) { el.value = c.name; return; }
                    void handleRenameCategory(c.name, el.value).then((ok) => { if (!ok) el.value = c.name; });
                  }}
                  className="flex-1 min-w-0 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-bold"
                />
                <button
                  type="button"
                  aria-label={`Delete category "${c.name}"`}
                  onClick={() => { void handleDeleteCategory(c.name); }}
                  className="p-1.5 bg-[#fcebeb] hover:bg-[#dc2626] text-[#dc2626] hover:text-white rounded-lg"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-3 border-t border-[#efefed]">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs"
            />
            <button
              onClick={() => { void addCategory(newCategoryName); setNewCategoryName(''); }}
              disabled={!newCategoryName.trim()}
              className="bg-[#4f46e5] text-white font-label-caps text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Add category
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.id} data-testid="prompt-card" className="bg-white border border-[#e9e9e7] rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-headline-md text-sm font-bold text-[#1b1c1a] cursor-pointer" onClick={() => { setEditingPrompt(p); setEditorOpen(true); }}>
                {p.title}
              </h3>
              <span className="font-label-caps text-[9px] font-bold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 rounded-full whitespace-nowrap">{p.category}</span>
            </div>
            <p className="font-body-md text-xs text-[#5f5f5b] line-clamp-3 cursor-pointer" onClick={() => { setEditingPrompt(p); setEditorOpen(true); }}>
              {p.promptText}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-label-caps text-[#5f5f5b]">
              {p.images.length > 0 && <span>{p.images.length} image{p.images.length > 1 ? 's' : ''}</span>}
              {p.videoLinks.length > 0 && <span>{p.videoLinks.length} video link{p.videoLinks.length > 1 ? 's' : ''}</span>}
            </div>
            <button
              onClick={() => handleCopy(p)}
              className={`w-full py-1.5 text-xs font-bold font-label-caps rounded-lg flex items-center justify-center gap-1.5 ${copiedId === p.id ? 'bg-[#16a34a] text-white' : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'}`}
            >
              <span className="material-symbols-outlined text-sm">{copiedId === p.id ? 'check' : 'content_copy'}</span>
              {copiedId === p.id ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        ))}
      </div>

      {editorOpen && (
        <PromptEditorModal
          key={editingPrompt?.id ?? 'new'}
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          prompt={editingPrompt}
          categories={categories}
          activeTeammateName={activeTeammateName}
          onSave={handleSave}
          onDelete={editingPrompt ? onDeletePrompt : undefined}
        />
      )}
    </div>
  );
};
