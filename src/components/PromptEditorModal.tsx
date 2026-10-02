import React, { useState } from 'react';
import { Prompt, PromptCategory } from '../types';
import { Modal } from './ui/Modal';
import { ImageCarouselField } from './ui/ImageCarouselField';
import { useConfirm } from './ui/ConfirmDialog';
import { UNCATEGORIZED } from '../utils/promptCategories';

export interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: Prompt;
  categories: PromptCategory[];
  activeTeammateName: string;
  onSave: (prompt: Prompt) => void;
  onDelete?: (id: string) => void;
}

export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen,
  onClose,
  prompt,
  categories,
  activeTeammateName,
  onSave,
  onDelete,
}) => {
  const confirm = useConfirm();
  const isEditing = Boolean(prompt);
  const [title, setTitle] = useState(prompt?.title || '');
  const [promptText, setPromptText] = useState(prompt?.promptText || '');
  const [category, setCategory] = useState(prompt?.category || categories[0]?.name || '');
  const [images, setImages] = useState<string[]>(prompt?.images || []);
  const [videoLinks, setVideoLinks] = useState<string[]>(prompt?.videoLinks || []);

  const handleSave = () => {
    if (!title.trim() || !promptText.trim()) return;
    const now = new Date().toISOString();
    const saved: Prompt = {
      id: prompt?.id || `prompt-${Date.now()}`,
      title: title.trim(),
      promptText: promptText.trim(),
      category: category.trim() || 'Uncategorized',
      images,
      videoLinks: videoLinks.map((v) => v.trim()).filter(Boolean),
      createdBy: prompt?.createdBy || activeTeammateName,
      createdAt: prompt?.createdAt || now,
      updatedAt: now,
    };
    onSave(saved);
    onClose();
  };

  const handleDelete = async () => {
    if (!prompt || !onDelete) return;
    const ok = await confirm({
      title: `Delete "${prompt.title}"?`,
      body: 'This removes the prompt from the library for everyone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) { onDelete(prompt.id); onClose(); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Prompt' : 'New Prompt'}
      size="md"
      footer={
        <div className="flex justify-between items-center w-full">
          {isEditing && onDelete ? (
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-xs font-bold font-label-caps text-[#dc2626] hover:bg-[#fcebeb] rounded-lg transition-colors"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-label-caps font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)] rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !promptText.trim()}
              className="px-3.5 py-2 text-xs font-label-caps font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt-title" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Title</label>
          <input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="prompt-category" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Category</label>
          <select
            id="prompt-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-label-caps font-bold"
          >
            {category && !categories.some((c) => c.name === category) && (
              <option value={category}>{category}</option>
            )}
            {category !== UNCATEGORIZED && !categories.some((c) => c.name === UNCATEGORIZED) && (
              <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
            )}
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="prompt-text" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Prompt Text</label>
          <textarea
            id="prompt-text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={8}
            className="w-full font-mono text-[11px] leading-relaxed bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5"
          />
        </div>

        <div>
          <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest mb-1.5">Example Images</p>
          <ImageCarouselField images={images} onChange={setImages} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest">Video Links</p>
            <button
              type="button"
              onClick={() => setVideoLinks((prev) => [...prev, ''])}
              className="text-[10px] font-label-caps font-bold text-[#4f46e5] hover:underline"
            >
              + Add link
            </button>
          </div>
          <div className="space-y-2">
            {videoLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={link}
                  onChange={(e) => setVideoLinks((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  placeholder="Video link (YouTube, Reel, TikTok…)"
                  className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs"
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => setVideoLinks((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-[#5f5f5b] hover:text-[#dc2626]"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
