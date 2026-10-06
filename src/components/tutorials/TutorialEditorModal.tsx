import React, { useState, useEffect, useRef } from 'react';
import { Tutorial, BrandId, TutorialCategory, TutorialVideo, TutorialLink, TutorialPrompt, TutorialFile } from '../../types';
import { Modal } from '../ui/Modal';
import { useBrands } from '../../context/BrandsContext';
import { detectPlatform, getEmbedInfo } from '../../utils/videoEmbed';
import { uploadAsset } from '../../utils/uploadAsset';

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

  // Thumbnail upload & URL state
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailStoragePath, setThumbnailStoragePath] = useState<string | undefined>(undefined);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Repeaters
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
      setThumbnailUrl(tutorial.thumbnailUrl || '');
      setThumbnailStoragePath(tutorial.thumbnailStoragePath);
      setShowManualUrlInput(Boolean(tutorial.thumbnailUrl && !tutorial.thumbnailStoragePath));
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
      setThumbnailUrl('');
      setThumbnailStoragePath(undefined);
      setShowManualUrlInput(false);
      setVideos([{ title: '', url: '' }]);
      setLinks([]);
      setPrompts([]);
      setFiles([]);
    }
    setThumbnailError(null);
  }, [tutorial, isOpen, defaultBrand, categories]);

  // Handle image upload
  const handleThumbnailUpload = async (file: File | undefined) => {
    if (!file) return;
    setThumbnailError(null);
    setIsUploadingThumbnail(true);

    try {
      const res = await uploadAsset(file, 'assets');
      setThumbnailUrl(res.url);
      setThumbnailStoragePath(res.storagePath);
    } catch (err) {
      setThumbnailError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setIsUploadingThumbnail(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearThumbnail = () => {
    setThumbnailUrl('');
    setThumbnailStoragePath(undefined);
    setThumbnailError(null);
  };

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
          thumbnailUrl: thumbnailUrl.trim() || undefined,
          thumbnailStoragePath: thumbnailStoragePath || undefined,
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

  // Video preview thumbnail if user hasn't uploaded a custom one
  const autoVideoThumbnail = videos[0]?.url ? getEmbedInfo(videos[0].url)?.thumbnailUrl : undefined;

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
            className="px-4 py-2 text-xs font-label-caps font-bold text-[#57574f] hover:text-[#1b1c1a] bg-white border border-[#e9e9e7] hover:bg-[#f4f4f3] rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white rounded-xl font-label-caps text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Saving...</span>
              </>
            ) : tutorial ? (
              'Save Changes'
            ) : (
              'Create Tutorial'
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 -mt-2">
        {/* Title */}
        <div>
          <label className="block font-label-caps text-xs text-[#1b1c1a] font-bold mb-1">
            Tutorial Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master Video Editing in Premiere & CapCut"
            className="w-full px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
          />
        </div>

        {/* Brand & Category row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-label-caps text-xs text-[#1b1c1a] font-bold mb-1">
              Brand Scope
            </label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value as BrandId | 'shared')}
              className="w-full px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
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
              <label className="block font-label-caps text-xs text-[#1b1c1a] font-bold">
                Category
              </label>
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="text-[11px] text-[#4f46e5] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
              >
                <span className="material-symbols-outlined text-xs">tune</span>
                <span>Manage</span>
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
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

        {/* ── THUMBNAIL UPLOAD SECTION ── */}
        <div className="p-4 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#4f46e5]">image</span>
              <span>Course Thumbnail (Cover Image)</span>
            </span>
            {thumbnailUrl && (
              <button
                type="button"
                onClick={handleClearThumbnail}
                className="text-[11px] font-label-caps text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">delete</span>
                <span>Remove Custom Thumbnail</span>
              </button>
            )}
          </div>

          {thumbnailError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>{thumbnailError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            {/* Thumbnail Preview (16:9) */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#e9e9e7] bg-[#f4f4f3] flex items-center justify-center">
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                    onError={() => setThumbnailError('Could not load image from provided URL.')}
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-label-caps font-bold backdrop-blur-xs">
                    Custom Cover
                  </div>
                </>
              ) : autoVideoThumbnail ? (
                <>
                  <img
                    src={autoVideoThumbnail}
                    alt="Auto video thumbnail"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-label-caps font-bold backdrop-blur-xs">
                    Auto Video Preview
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-3 text-[#5f5f5b]">
                  <span className="material-symbols-outlined text-3xl text-[#4f46e5]/40 mb-1">
                    add_photo_alternate
                  </span>
                  <span className="font-label-caps text-[10px] font-bold">No Cover</span>
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div className="sm:col-span-2 flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleThumbnailUpload(e.target.files?.[0])}
                className="hidden"
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingThumbnail}
                  className="px-3.5 py-2 bg-white hover:bg-[#f1f1f0] border border-[#e9e9e7] text-[#1b1c1a] rounded-xl font-label-caps text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer min-h-[38px]"
                >
                  <span className="material-symbols-outlined text-sm text-[#4f46e5]">
                    {isUploadingThumbnail ? 'progress_activity' : 'upload_file'}
                  </span>
                  <span>{isUploadingThumbnail ? 'Uploading...' : 'Upload Image (PNG/JPG/WebP)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                  className="text-xs font-label-caps text-[#57574f] hover:text-[#1b1c1a] underline cursor-pointer py-1"
                >
                  {showManualUrlInput ? 'Hide URL field' : 'or enter image URL'}
                </button>
              </div>

              {showManualUrlInput && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="url"
                    placeholder="https://... image link"
                    value={thumbnailUrl}
                    onChange={(e) => {
                      setThumbnailUrl(e.target.value);
                      setThumbnailStoragePath(undefined);
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-[#e9e9e7] rounded-lg text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                  />
                  {thumbnailUrl && (
                    <button
                      type="button"
                      onClick={handleClearThumbnail}
                      className="p-1.5 text-[#5f5f5b] hover:text-rose-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              )}

              <p className="font-body-md text-[11px] text-[#5f5f5b]">
                Recommended aspect ratio is 16:9 (1280x720). If not uploaded, the YouTube or Drive preview is automatically extracted.
              </p>
            </div>
          </div>
        </div>

        {/* Video / Course Links (Multi) */}
        <div className="p-4 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#4f46e5]">smart_display</span>
              <span>Course & Tutorial Videos (YouTube / Google Drive / MP4)</span>
            </span>
            <button
              type="button"
              onClick={() => setVideos([...videos, { title: '', url: '' }])}
              className="text-[11px] font-label-caps text-[#4f46e5] hover:text-[#4338ca] font-bold flex items-center gap-0.5 cursor-pointer"
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
                  placeholder="Lesson / Video Title"
                  value={vid.title}
                  onChange={(e) => {
                    const next = [...videos];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setVideos(next);
                  }}
                  className="w-1/3 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                />
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://youtube.com/..., drive.google.com/..., or .mp4 URL"
                    value={vid.url}
                    onChange={(e) => {
                      const next = [...videos];
                      next[idx] = { ...next[idx], url: e.target.value };
                      setVideos(next);
                    }}
                    className="w-full pl-3 pr-20 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                  />
                  {vid.url && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#f4f4f3] text-[#57574f] border border-[#efefed]">
                      {platform}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                  className="p-2 text-[#5f5f5b] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remove video"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Description & Syllabus */}
        <div>
          <label className="block font-label-caps text-xs text-[#1b1c1a] font-bold mb-1">
            Description & Notes (Markdown supported)
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Overview of the tutorial, key steps, timestamps, or syllabus..."
            className="w-full px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
          />
        </div>

        {/* Associated Prompts Repeater */}
        <div className="p-4 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#d97706]">psychology</span>
              <span>Associated Prompts</span>
            </span>
            <button
              type="button"
              onClick={() => setPrompts([...prompts, { title: '', promptText: '' }])}
              className="text-[11px] font-label-caps text-[#d97706] hover:text-[#b45309] font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Add Prompt</span>
            </button>
          </div>

          {prompts.map((p, idx) => (
            <div key={idx} className="p-3 bg-white border border-[#efefed] rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Prompt Label (e.g. Midjourney Thumbnail Prompt)"
                  value={p.title}
                  onChange={(e) => {
                    const next = [...prompts];
                    next[idx] = { ...next[idx], title: e.target.value };
                    setPrompts(next);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-[#f8f9fa] border border-[#e9e9e7] rounded-lg text-xs text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                />
                <button
                  type="button"
                  onClick={() => setPrompts(prompts.filter((_, i) => i !== idx))}
                  className="p-1 text-[#5f5f5b] hover:text-rose-600 transition-colors cursor-pointer"
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
                className="w-full px-2.5 py-2 bg-[#f8f9fa] border border-[#e9e9e7] rounded-lg text-xs font-mono text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
              />
            </div>
          ))}
        </div>

        {/* Important Links Repeater */}
        <div className="p-4 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#3b82f6]">link</span>
              <span>Important Links (Figma, Notion SOPs, Docs)</span>
            </span>
            <button
              type="button"
              onClick={() => setLinks([...links, { title: '', url: '' }])}
              className="text-[11px] font-label-caps text-[#3b82f6] hover:text-[#2563eb] font-bold flex items-center gap-0.5 cursor-pointer"
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
                className="w-1/3 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
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
                className="flex-1 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                className="p-2 text-[#5f5f5b] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Files Repeater */}
        <div className="p-4 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">attachment</span>
              <span>Files & Templates (Drive / Asset URLs)</span>
            </span>
            <button
              type="button"
              onClick={() => setFiles([...files, { name: '', url: '' }])}
              className="text-[11px] font-label-caps text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5 cursor-pointer"
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
                className="w-1/3 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
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
                className="flex-1 px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                className="p-2 text-[#5f5f5b] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div>
          <label className="block font-label-caps text-xs text-[#1b1c1a] font-bold mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="sop, editing, ai, video, guide"
            className="w-full px-3 py-2 bg-white border border-[#e9e9e7] rounded-xl text-xs text-[#1b1c1a] placeholder-[#5f5f5b] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
          />
        </div>
      </form>
    </Modal>
  );
};
