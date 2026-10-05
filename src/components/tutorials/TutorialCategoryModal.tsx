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
      setErrorMsg('A category with that name already exists.');
    }
  };

  const handleMove = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const copy = [...categories];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    void onReorderCategories(copy.map((c) => c.id));
  };

  const handleDelete = async (name: string) => {
    if (name.toLowerCase() === UNCATEGORIZED.toLowerCase()) {
      setErrorMsg(`Cannot delete default category "${UNCATEGORIZED}".`);
      return;
    }
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
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 -mt-2">
        <p className="text-xs text-slate-400">
          Organize course and tutorial topics. Deleting a category moves existing tutorials to{' '}
          <strong className="text-slate-200">{UNCATEGORIZED}</strong>.
        </p>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Categories List */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {categories.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No categories found. Add one below.
            </div>
          ) : (
            categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
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
                      className="flex-1 px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveRename(cat)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <span className="material-symbols-outlined text-sm">check</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-500 hover:text-slate-400"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <span className="font-medium text-slate-200 truncate">{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors"
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
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:hover:text-slate-500"
                    title="Move up"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:hover:text-slate-500"
                    title="Move down"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(cat.name)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-1"
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
        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-3 border-t border-slate-800">
          <input
            type="text"
            placeholder="New category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newCategoryName.trim()}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            <span>Add</span>
          </button>
        </form>
      </div>
    </Modal>
  );
};
