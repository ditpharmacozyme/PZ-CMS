import React, { useState, useEffect } from 'react';
import { Tutorial, BrandId, TutorialCategory, TutorialVideo, TutorialLink, TutorialPrompt, TutorialFile } from '../../types';
import { Modal } from '../ui/Modal';
import { useBrands } from '../../context/BrandsContext';
import { detectPlatform } from '../../utils/videoEmbed';

interface TutorialEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorial: Tutorial | null;
  categories: TutorialCategory[];
  defaultBrand?: BrandId | 'shared';
  onSave: (data: Omit<Tutorial, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onOpenCategoryManager: () => void;
}

export const TutorialEditorModal: React.FC<TutorialEditorModalProps> = ({
  isOpen,
  onClose,
  tutorial,
  categories,
  defaultBrand = 'shared',
  onSave,
  onOpenCategoryManager
}) => {
  const { brands } = useBrands();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState<BrandId | 'shared'>('shared');
  const [category, setCategory] = useState('Uncategorized');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [links, setLinks] = useState<TutorialLink[]>([]);
  const [prompts, setPrompts] = useState<TutorialPrompt[]>([]);
  const [files, setFiles] = useState<TutorialFile[]>([]);

  useEffect(() => {
    if (tutorial) {
      setTitle(tutorial.title || '');
      setBrandId(tutorial.brandId || 'shared');
      setCategory(tutorial.category || 'Uncategorized');
      setDescription(tutorial.description || '');
      setTagsInput(tutorial.tags ? tutorial.tags.join(', ') : '');
      setVideos(tutorial.videos && tutorial.videos.length > 0 ? [...tutorial.videos] : [{ title: '', url: '' }]);
      setLinks(tutorial.links && tutorial.links.length > 0 ? [...tutorial.links] : []);
      setPrompts(tutorial.prompts && tutorial.prompts.length > 0 ? [...tutorial.prompts] : []);
      setFiles(tutorial.files && tutorial.files.length > 0 ? [...tutorial.files] : []);
    } else {
      setTitle('');
      setBrandId(defaultBrand);
      setCategory(categories[0]?.name || 'Uncategorized');
      setDescription('');
      setTagsInput('');
      setVideos([{ title: '', url: '' }]);
      setLinks([]);
      setPrompts([]);
      setFiles([]);
    }
  }, [tutorial, isOpen, defaultBrand, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const cleanedVideos = videos
        .map((v) => ({ ...v, title: v.title.trim(), url: v.url.trim() }))
        .filter((v) => v.url);

      const cleanedLinks = links
        .map((l) => ({ ...l, title: l.title.trim(), url: l.url.trim() }))
        .filter((l) => l.url);

      const cleanedPrompts = prompts
        .map((p) => ({ ...p, title: p.title.trim(), promptText: p.promptText.trim() }))
        .filter((p) => p.promptText);

      const cleanedFiles = files
        .map((f) => ({ ...f, name: f.name.trim(), url: f.url.trim() }))
        .filter((f) => f.url);

      await onSave(
        {
          title: title.trim(),
          brandId,
          category: category || 'Uncategorized',
          description: description.trim(),
          tags: parsedTags,
          videos: cleanedVideos,
          links: cleanedLinks,
          prompts: cleanedPrompts,
          files: cleanedFiles
        },
        tutorial?.id
      );

      onClose();
    } catch (err) {
      console.error('Failed to save tutorial:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tutorial ? 'Edit Tutorial & Course' : 'Add New Tutorial / Course'}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            {isSubmitting ? 'Saving...' : tutorial ? 'Save Changes' : 'Create Tutorial'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 -mt-2">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Tutorial Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master Video Editing in Premiere & CapCut"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Brand & Category row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Brand Scope
            </label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value as BrandId | 'shared')}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="shared">Shared (All Brands)</option>
              {Object.values(brands).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Category
              </label>
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-xs">settings</span>
                <span>Manage</span>
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Uncategorized">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Video / Course Links (Multi) */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-400">smart_display</span>
              <span>Course & Tutorial Videos (YouTube / Google Drive)</span>
            </span>
            <button
              type="button"
              onClick={() => setVideos([...videos, { title: '', url: '' }])}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Add Video</span>
            </button>
          </div>

          {videos.map((vid, idx) => {
            const platform = detectPlatform(vid.url);
            return (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Video Title / Lesson Name"
                  value={vid.title}
                  onChange={(e) => {
                    const next = [...videos];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setVideos(next);
                  }}
                  className="w-1/3 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://youtube.com/... or https://drive.google.com/..."
                    value={vid.url}
                    onChange={(e) => {
                      const next = [...videos];
                      next[idx] = { ...next[idx], url: e.target.value };
                      setVideos(next);
                    }}
                    className="w-full pl-2.5 pr-16 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  {vid.url && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {platform}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Description & Syllabus */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Description & Notes (Markdown supported)
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Overview of the tutorial, key steps, timestamps, or syllabus..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Associated Prompts Repeater */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-amber-400">psychology</span>
              <span>Associated Prompts</span>
            </span>
            <button
              type="button"
              onClick={() => setPrompts([...prompts, { title: '', promptText: '' }])}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Add Prompt</span>
            </button>
          </div>

          {prompts.map((p, idx) => (
            <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Prompt Label (e.g. Midjourney Thumbnail Prompt)"
                  value={p.title}
                  onChange={(e) => {
                    const next = [...prompts];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setPrompts(next);
                  }}
                  className="w-2/3 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setPrompts(prompts.filter((_, i) => i !== idx))}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Paste the prompt text here (team members can copy with 1 click)..."
                value={p.promptText}
                onChange={(e) => {
                  const next = [...prompts];
                  next[idx] = { ...next[idx], promptText: e.target.value };
                  setPrompts(next);
                }}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>

        {/* Important Links Repeater */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-400">link</span>
              <span>Important Links (Figma, Notion SOPs, Docs)</span>
            </span>
            <button
              type="button"
              onClick={() => setLinks([...links, { title: '', url: '' }])}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Add Link</span>
            </button>
          </div>

          {links.map((lnk, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Link Title (e.g. Figma File)"
                value={lnk.title}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx], title: e.target.value };
                  setLinks(next);
                }}
                className="w-1/3 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <input
                type="url"
                placeholder="https://..."
                value={lnk.url}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx], url: e.target.value };
                  setLinks(next);
                }}
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Files Repeater */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-400">attachment</span>
              <span>Files & Templates (Drive / Asset URLs)</span>
            </span>
            <button
              type="button"
              onClick={() => setFiles([...files, { name: '', url: '' }])}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Add File</span>
            </button>
          </div>

          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="File Name (e.g. Template.psd)"
                value={f.name}
                onChange={(e) => {
                  const next = [...files];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setFiles(next);
                }}
                className="w-1/3 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="url"
                placeholder="Download or Drive View URL"
                value={f.url}
                onChange={(e) => {
                  const next = [...files];
                  next[idx] = { ...next[idx], url: e.target.value };
                  setFiles(next);
                }}
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="sop, editing, ai, video, guide"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </form>
    </Modal>
  );
};
