import React, { useState } from 'react';
import { TutorialCategory } from '../../types';
import { Modal } from '../ui/Modal';
import { UNCATEGORIZED } from '../../utils/tutorialCategories';

interface TutorialCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: TutorialCategory[];
  onAddCategory: (name: string) => Promise<boolean>;
  onRenameCategory: (oldName: string, newName: string) => Promise<boolean>;
  onDeleteCategory: (name: string) => Promise<void>;
  onReorderCategories: (orderedIds: string[]) => Promise<void>;
}

export const TutorialCategoryModal: React.FC<TutorialCategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setErrorMsg(null);

    const ok = await onAddCategory(name);
    if (ok) {
      setNewCategoryName('');
    } else {
      setErrorMsg('Category already exists or is invalid.');
    }
  };

  const startEdit = (cat: TutorialCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setErrorMsg(null);
  };

  const handleSaveRename = async (cat: TutorialCategory) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === cat.name) {
      setEditingId(null);
      return;
    }
    setErrorMsg(null);
    const ok = await onRenameCategory(cat.name, trimmed);
    if (ok) {
      setEditingId(null);
    } else {
      setErrorMsg('Failed to rename category. Name might already be taken.');
    }
  };

  const handleMove = async (currentIndex: number, direction: -1 | 1) => {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await onReorderCategories(reordered.map((c) => c.id));
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(`Delete category "${name}"? Tutorials in this category will be moved to "${UNCATEGORIZED}".`)) {
      await onDeleteCategory(name);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Categories"
      size="sm"
      footer={
        <div className="flex justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#2d2e2b] text-white rounded-lg font-label-caps text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 -mt-2">
        <p className="font-body-md text-xs text-[#5f5f5b]">
          Organize course and tutorial topics. Deleting a category moves existing tutorials to{' '}
          <strong className="text-[#1b1c1a]">{UNCATEGORIZED}</strong>.
        </p>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Categories List */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {categories.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#5f5f5b]">
              No categories found. Add one below.
            </div>
          ) : (
            categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#f4f4f3] border border-[#efefed] text-xs transition-colors hover:bg-white hover:border-[#e9e9e7]"
              >
                {editingId === cat.id ? (
                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveRename(cat);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2.5 py-1 bg-white border border-[#4f46e5] rounded-lg text-xs text-[#1b1c1a] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveRename(cat)}
                      className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-[#5f5f5b] hover:text-[#1b1c1a] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <span className="material-symbols-outlined text-sm text-[#4f46e5]">sell</span>
                    <span className="font-semibold text-[#1b1c1a] truncate">{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-1 text-[#5f5f5b] hover:text-[#4f46e5] transition-colors cursor-pointer"
                      title="Rename"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                    </button>
                  </div>
                )}

                {/* Move & Delete Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="p-1 text-[#5f5f5b] hover:text-[#1b1c1a] disabled:opacity-30 disabled:hover:text-[#5f5f5b] cursor-pointer"
                    title="Move up"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="p-1 text-[#5f5f5b] hover:text-[#1b1c1a] disabled:opacity-30 disabled:hover:text-[#5f5f5b] cursor-pointer"
                    title="Move down"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(cat.name)}
                    className="p-1 text-[#5f5f5b] hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                    title="Delete category"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-3 border-t border-[#efefed]">
          <input
            type="text"
            placeholder="New category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
          />
          <button
            type="submit"
            disabled={!newCategoryName.trim()}
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white rounded-xl font-label-caps text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Add</span>
          </button>
        </form>
      </div>
    </Modal>
  );
};
