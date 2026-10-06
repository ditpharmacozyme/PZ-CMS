import React, { useState, useEffect, Suspense } from 'react';
import { Tutorial, BrandConfig } from '../../types';
import { Modal } from '../ui/Modal';
import { InAppVideoPlayer } from './InAppVideoPlayer';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface TutorialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorial: Tutorial | null;
  brand?: BrandConfig;
  onEdit: (t: Tutorial) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

type DetailTab = 'notes' | 'prompts' | 'links' | 'files';

export const TutorialDetailModal: React.FC<TutorialDetailModalProps> = ({
  isOpen,
  onClose,
  tutorial,
  brand,
  onEdit,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  currentIndex,
  totalCount
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('notes');
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);

  // Keyboard navigation: Left/Right arrows navigate between tutorials
  useEffect(() => {
    if (!isOpen || !tutorial) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft' && hasPrev && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tutorial, hasPrev, hasNext, onNavigatePrev, onNavigateNext]);

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
  const brandColor = isShared ? '#4f46e5' : (brand?.primaryColor || '#64748b');

  const videos = tutorial.videos || [];
  const prompts = tutorial.prompts || [];
  const links = tutorial.links || [];
  const files = tutorial.files || [];

  const TABS: { id: DetailTab; label: string; icon: string; count?: number }[] = [
    { id: 'notes', label: 'Notes & Overview', icon: 'description' },
    { id: 'prompts', label: `Prompts`, icon: 'auto_stories', count: prompts.length },
    { id: 'links', label: `Links`, icon: 'link', count: links.length },
    { id: 'files', label: `Files`, icon: 'attachment', count: files.length },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tutorial.title}
      size="lg"
      headerActions={
        <div className="flex items-center gap-2">
          {/* Previous / Next Tutorial Stepper */}
          {totalCount && totalCount > 1 ? (
            <div className="flex items-center gap-1 bg-[#f4f4f3] p-0.5 rounded-xl border border-[#efefed]">
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={!hasPrev}
                title="Previous tutorial (←)"
                aria-label="Previous tutorial"
                className="p-1 rounded-lg text-[#57574f] hover:text-[#1b1c1a] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
              <span className="text-[11px] font-label-caps font-bold text-[#57574f] px-1 tabular-nums whitespace-nowrap">
                {(currentIndex ?? 0) + 1} / {totalCount}
              </span>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={!hasNext}
                title="Next tutorial (→)"
                aria-label="Next tutorial"
                className="p-1 rounded-lg text-[#57574f] hover:text-[#1b1c1a] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(tutorial);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-caps text-xs font-bold text-[#57574f] bg-white border border-[#e9e9e7] hover:bg-[#f4f4f3] transition-colors cursor-pointer min-h-[32px]"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 text-xs text-[#5f5f5b] truncate">
            <span className="font-body-md truncate">
              Category: <strong className="text-[#1b1c1a]">{tutorial.category}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile / touch prev & next helpers in footer */}
            {hasPrev && onNavigatePrev && (
              <button
                type="button"
                onClick={onNavigatePrev}
                className="sm:hidden px-3 py-2 bg-[#f4f4f3] text-[#1b1c1a] rounded-lg font-label-caps text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">arrow_back</span>
                <span>Prev</span>
              </button>
            )}
            {hasNext && onNavigateNext && (
              <button
                type="button"
                onClick={onNavigateNext}
                className="sm:hidden px-3 py-2 bg-[#f4f4f3] text-[#1b1c1a] rounded-lg font-label-caps text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#2d2e2b] text-white rounded-lg font-label-caps text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 sm:gap-5 -mt-2">
        {/* Video Player or Thumbnail Cover */}
        {videos.length > 0 ? (
          <div className="w-full rounded-xl sm:rounded-2xl overflow-hidden border border-[#efefed] bg-black">
            <InAppVideoPlayer videos={videos} posterUrl={tutorial.thumbnailUrl} />
          </div>
        ) : tutorial.thumbnailUrl ? (
          <div className="relative w-full aspect-video max-h-72 rounded-xl sm:rounded-2xl overflow-hidden border border-[#efefed] bg-[#f8f9fa]">
            <img
              src={tutorial.thumbnailUrl}
              alt={tutorial.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        {/* Brand + Category + Tags */}
        <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-[#efefed]">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-label-caps text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: brandColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            {brandLabel}
          </span>

          <span className="px-2.5 py-1 rounded-md font-label-caps text-xs font-bold bg-[#f4f4f3] text-[#57574f] border border-[#efefed]">
            {tutorial.category}
          </span>

          {tutorial.tags?.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded font-body-md text-[11px] bg-[#f4f4f3] text-[#5f5f5b] border border-[#efefed]"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Content Tabs */}
        <div className="flex items-center gap-0.5 border-b border-[#efefed] pb-px overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 font-label-caps text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#4f46e5] text-[#4f46e5]'
                  : 'border-transparent text-[#5f5f5b] hover:text-[#1b1c1a] hover:border-[#d1d1cf]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab.id ? 'bg-[#eef2ff] text-[#4f46e5]' : 'bg-[#f4f4f3] text-[#5f5f5b]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Notes */}
        {activeTab === 'notes' && (
          <div className="flex flex-col gap-3 min-h-[140px]">
            {tutorial.description ? (
              <div className="prose prose-sm max-w-none text-[#1b1c1a] font-body-md text-xs leading-relaxed space-y-2">
                <Suspense fallback={<p className="whitespace-pre-wrap">{tutorial.description}</p>}>
                  <ReactMarkdown>{tutorial.description}</ReactMarkdown>
                </Suspense>
              </div>
            ) : (
              <p className="font-body-md text-xs text-[#5f5f5b] italic py-4">
                No description or notes provided for this tutorial.
              </p>
            )}

            {tutorial.createdBy && (
              <div className="pt-3 border-t border-[#efefed] flex items-center gap-2 text-[11px] text-[#5f5f5b]">
                <span className="material-symbols-outlined text-xs">person</span>
                <span>Added by: <strong className="text-[#1b1c1a]">{tutorial.createdBy}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Tab: Prompts */}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-3 min-h-[140px]">
            {prompts.length === 0 ? (
              <div className="py-10 text-center font-body-md text-xs text-[#5f5f5b]">
                No prompts attached to this tutorial.
              </div>
            ) : (
              prompts.map((p, idx) => (
                <div key={idx} className="p-3 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-headline-md text-xs font-bold text-[#1b1c1a]">
                      {p.title || `Prompt ${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(p.promptText, idx)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-label-caps font-bold transition-all cursor-pointer bg-white border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#1b1c1a]"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedPromptIdx === idx ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedPromptIdx === idx ? 'Copied!' : 'Copy Prompt'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-white border border-[#efefed] rounded-lg font-body-md text-xs text-[#1b1c1a] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {p.promptText}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Links */}
        {activeTab === 'links' && (
          <div className="flex flex-col gap-2 min-h-[120px]">
            {links.length === 0 ? (
              <div className="py-10 text-center font-body-md text-xs text-[#5f5f5b]">
                No external links attached.
              </div>
            ) : (
              links.map((lnk, idx) => (
                <a
                  key={idx}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white hover:bg-[#f4f4f3] border border-[#efefed] hover:border-[#c7c5f8] rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-base">link</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-md text-xs font-bold text-[#1b1c1a] group-hover:text-[#4f46e5] transition-colors truncate">
                        {lnk.title || lnk.url}
                      </span>
                      <span className="font-body-md text-[11px] text-[#5f5f5b] truncate">
                        {lnk.url}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-[#5f5f5b] group-hover:text-[#4f46e5] group-hover:translate-x-0.5 transition-all flex-shrink-0">
                    open_in_new
                  </span>
                </a>
              ))
            )}
          </div>
        )}

        {/* Tab: Files */}
        {activeTab === 'files' && (
          <div className="flex flex-col gap-2 min-h-[120px]">
            {files.length === 0 ? (
              <div className="py-10 text-center font-body-md text-xs text-[#5f5f5b]">
                No files or templates attached.
              </div>
            ) : (
              files.map((f, idx) => (
                <a
                  key={idx}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white hover:bg-[#f4f4f3] border border-[#efefed] hover:border-[#bbf7d0] rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-base">
                        {f.fileType === 'pdf' ? 'picture_as_pdf' : 'attachment'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-md text-xs font-bold text-[#1b1c1a] group-hover:text-[#16a34a] transition-colors truncate">
                        {f.name}
                      </span>
                      <span className="font-body-md text-[11px] text-[#5f5f5b] truncate">
                        {f.url}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-[#5f5f5b] group-hover:text-[#16a34a] group-hover:translate-x-0.5 transition-all flex-shrink-0">
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
