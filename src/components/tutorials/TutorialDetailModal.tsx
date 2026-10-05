import React, { useState, Suspense } from 'react';
import { Tutorial, BrandConfig } from '../../types';
import { Modal } from '../ui/Modal';
import { InAppVideoPlayer } from './InAppVideoPlayer';

// Lazy-loaded to match ResearchPlans.tsx convention and keep bundle size lean
const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface TutorialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorial: Tutorial | null;
  brand?: BrandConfig;
  onEdit: (t: Tutorial) => void;
}

type DetailTab = 'notes' | 'prompts' | 'links' | 'files';

export const TutorialDetailModal: React.FC<TutorialDetailModalProps> = ({
  isOpen,
  onClose,
  tutorial,
  brand,
  onEdit
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('notes');
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);

  if (!tutorial) return null;

  const handleCopyPrompt = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptIdx(idx);
      setTimeout(() => {
        setCopiedPromptIdx((curr) => (curr === idx ? null : curr));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy prompt to clipboard:', err);
    }
  };

  const isShared = tutorial.brandId === 'shared';
  const brandLabel = isShared ? 'Shared' : (brand?.name || tutorial.brandId);
  const brandColor = isShared ? '#6366f1' : (brand?.primaryColor || '#64748b');

  const videos = tutorial.videos || [];
  const prompts = tutorial.prompts || [];
  const links = tutorial.links || [];
  const files = tutorial.files || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tutorial.title}
      size="lg"
      headerActions={
        <button
          type="button"
          onClick={() => {
            onClose();
            onEdit(tutorial);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          <span>Edit</span>
        </button>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Category: <strong className="text-slate-200">{tutorial.category}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 -mt-2">
        {/* Top Video Player (if has videos) */}
        {videos.length > 0 && (
          <div className="w-full">
            <InAppVideoPlayer videos={videos} />
          </div>
        )}

        {/* Header Tags & Metadata */}
        <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-200 dark:border-slate-800">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: brandColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>{brandLabel}</span>
          </span>

          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {tutorial.category}
          </span>

          {tutorial.tags?.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Content Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'notes'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">description</span>
            <span>Notes & Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'prompts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">auto_stories</span>
            <span>Prompts ({prompts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'links'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">link</span>
            <span>Links ({links.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'files'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">attachment</span>
            <span>Files ({files.length})</span>
          </button>
        </div>

        {/* Tab 1: Notes & Description */}
        {activeTab === 'notes' && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-slate-300 min-h-[120px]">
            {tutorial.description ? (
              <Suspense fallback={<div className="text-xs text-slate-500">Loading notes...</div>}>
                <ReactMarkdown>{tutorial.description}</ReactMarkdown>
              </Suspense>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No description or notes provided for this tutorial.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Prompts */}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-3 min-h-[120px]">
            {prompts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No prompts attached to this course.
              </div>
            ) : (
              prompts.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col gap-2 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-400">psychology</span>
                      <span>{p.title || `Prompt ${idx + 1}`}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(p.promptText, idx)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedPromptIdx === idx ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedPromptIdx === idx ? 'Copied!' : 'Copy Prompt'}</span>
                    </button>
                  </div>

                  <pre className="p-3 bg-slate-950/80 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap break-words border border-slate-800/60 max-h-48 overflow-y-auto">
                    {p.promptText}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Important Links */}
        {activeTab === 'links' && (
          <div className="flex flex-col gap-2 min-h-[120px]">
            {links.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No external links attached.
              </div>
            ) : (
              links.map((lnk, idx) => (
                <a
                  key={idx}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/60 text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-base">link</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                        {lnk.title || lnk.url}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {lnk.url}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                    open_in_new
                  </span>
                </a>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Files */}
        {activeTab === 'files' && (
          <div className="flex flex-col gap-2 min-h-[120px]">
            {files.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No files or templates attached.
              </div>
            ) : (
              files.map((f, idx) => (
                <a
                  key={idx}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/60 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-base">
                        {f.fileType === 'pdf' ? 'picture_as_pdf' : 'attachment'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors truncate">
                        {f.name}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {f.url}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
                    download
                  </span>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
