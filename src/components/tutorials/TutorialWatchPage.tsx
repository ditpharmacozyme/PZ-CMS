import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { Tutorial, BrandConfig, TeamMember } from '../../types';
import { InAppVideoPlayer } from './InAppVideoPlayer';
import { canManageTutorial } from '../../utils/tutorialOwnership';
import { getEmbedInfo } from '../../utils/videoEmbed';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface TutorialWatchPageProps {
  tutorial: Tutorial;
  allTutorials: Tutorial[];
  brand?: BrandConfig;
  brands: Record<string, BrandConfig>;
  activeTeammate?: TeamMember | null;
  onBack: () => void;
  onSelectTutorial: (t: Tutorial) => void;
  onEdit: (t: Tutorial) => void;
  onDelete: (t: Tutorial) => void;
}

type ResourceTab = 'prompts' | 'links' | 'files';

export const TutorialWatchPage: React.FC<TutorialWatchPageProps> = ({
  tutorial,
  allTutorials,
  brand,
  brands,
  activeTeammate,
  onBack,
  onSelectTutorial,
  onEdit,
  onDelete
}) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);
  const [activeResourceTab, setActiveResourceTab] = useState<ResourceTab>('prompts');

  const canManage = canManageTutorial(tutorial, activeTeammate);

  // Keyboard navigation: Escape key returns to the tutorials grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Scroll to top when tutorial changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Ignored in environments where scrollTo is not implemented
    }
    setIsDescExpanded(false);
  }, [tutorial.id]);

  const handleCopyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tutorial', tutorial.id);
      // Remove any other tab-like params so the link is self-contained
      const shareUrl = url.toString();
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Fallback — still show feedback
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handleCopyPrompt = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptIdx(idx);
      setTimeout(() => setCopiedPromptIdx(null), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const isShared = tutorial.brandId === 'shared';
  const brandLabel = isShared ? 'Shared' : (brand?.name || tutorial.brandId);
  const brandColor = isShared ? '#4f46e5' : (brand?.primaryColor || '#64748b');

  const videos = tutorial.videos || [];
  const prompts = tutorial.prompts || [];
  const links = tutorial.links || [];
  const files = tutorial.files || [];

  // Up Next / Related Tutorials: prioritize same category, then others
  const upNextTutorials = useMemo(() => {
    return allTutorials.filter((t) => t.id !== tutorial.id);
  }, [allTutorials, tutorial.id]);

  const creatorInitial = (tutorial.createdBy || 'T').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0f0f0f] pb-16 overflow-x-hidden">
      {/* ── Top YouTube-style Navigation & Breadcrumb Bar ── */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-[#efefed] px-3 sm:px-4 md:px-8 py-2.5 sm:py-3">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#f4f4f3] hover:bg-[#e9e9e7] active:scale-95 text-[#1b1c1a] font-label-caps text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 min-h-[34px]"
              title="Back to Tutorials (Esc)"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span className="hidden sm:inline">Back to Tutorials</span>
              <span className="sm:hidden">Back</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#5f5f5b] min-w-0 truncate font-body-md">
              <span className="text-[#8f8f8b]">/</span>
              <span className="px-2 py-0.5 rounded bg-[#f4f4f3] text-[#57574f] font-label-caps text-[11px] font-bold shrink-0">
                {tutorial.category}
              </span>
              <span className="text-[#8f8f8b]">/</span>
              <span className="truncate font-medium text-[#1b1c1a]">{tutorial.title}</span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-full text-xs font-label-caps font-bold transition-all cursor-pointer border min-h-[34px] ${
                copiedLink
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-[#f4f4f3] text-[#1b1c1a] border-[#e9e9e7]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copiedLink ? 'check' : 'share'}
              </span>
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            {canManage && (
              <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(tutorial)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#f4f4f3] border border-[#e9e9e7] text-[#1b1c1a] text-xs font-label-caps font-bold transition-all cursor-pointer shadow-xs min-h-[34px]"
                  title="Edit tutorial (Uploader only)"
                >
                  <span className="material-symbols-outlined text-sm text-[#4f46e5]">edit</span>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(tutorial)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-label-caps font-bold transition-all cursor-pointer shadow-xs min-h-[34px]"
                  title="Delete tutorial (Uploader only)"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main YouTube Layout (2 Columns: Watch Stage + Up Next Sidebar) ── */}
      <div className="max-w-[1720px] mx-auto px-0 sm:px-4 md:px-8 pt-0 sm:pt-4 md:pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 xl:gap-8">
          {/* ════ PRIMARY COLUMN: Video + Info + Description + Resources ════ */}
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 flex flex-col min-w-0">
            {/* 1. Theatre Video Player (Edge-to-edge on mobile, rounded on tablet/desktop) */}
            <div className="w-full sm:rounded-2xl overflow-hidden bg-black sm:shadow-lg sm:border border-[#e2e8f0]">
              {videos.length > 0 ? (
                <InAppVideoPlayer videos={videos} posterUrl={tutorial.thumbnailUrl} />
              ) : tutorial.thumbnailUrl ? (
                <div className="relative w-full aspect-video max-h-[520px] bg-[#f4f4f3] overflow-hidden flex items-center justify-center">
                  <img
                    src={tutorial.thumbnailUrl}
                    alt={tutorial.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4 sm:p-6">
                    <span className="text-white font-label-caps text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-black/60 backdrop-blur-xs">
                      Document & SOP Tutorial
                    </span>
                  </div>
                </div>
              ) : (
                /* ── Title-as-cover when no image uploaded ── */
                <div
                  className="relative w-full aspect-video max-h-[420px] overflow-hidden flex flex-col items-center justify-center text-center px-6 sm:px-10"
                  style={{
                    background: `linear-gradient(135deg, ${brandColor}22 0%, #eef2ff 50%, ${brandColor}11 100%)`,
                  }}
                >
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, #4f46e5 1px, transparent 0)',
                    backgroundSize: '28px 28px'
                  }} />
                  {/* Brand pill */}
                  <div className="absolute top-4 left-4">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-label-caps text-[10px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: `${brandColor}dd` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                      {brandLabel}
                    </span>
                  </div>
                  {/* Category chip */}
                  {tutorial.category && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/70 backdrop-blur-xs font-label-caps text-[10px] font-bold text-[#4f46e5] border border-[#4f46e5]/20">
                        <span className="material-symbols-outlined text-xs">sell</span>
                        {tutorial.category}
                      </span>
                    </div>
                  )}
                  {/* Title */}
                  <h2 className="font-display-xl text-xl sm:text-3xl md:text-4xl font-bold text-[#1b1c1a] leading-tight line-clamp-3 max-w-2xl">
                    {tutorial.title}
                  </h2>
                  {/* Tags */}
                  {tutorial.tags && tutorial.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap justify-center mt-3">
                      {tutorial.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="font-label-caps text-xs text-[#4f46e5] font-semibold">#{tag}</span>
                      ))}
                    </div>
                  )}
                  {/* Creator */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm"
                      style={{ backgroundColor: brandColor }}
                    >
                      {creatorInitial}
                    </div>
                    <span className="font-body-md text-xs text-[#5f5f5b]">{tutorial.createdBy || 'Team'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Content Body with comfortable margins on mobile */}
            <div className="px-3.5 sm:px-0 pt-4 flex flex-col gap-4 min-w-0 overflow-hidden">
              {/* 2. Video Title */}
              <div>
                <h1 className="font-display-xl text-lg sm:text-2xl md:text-3xl font-bold text-[#0f0f0f] leading-snug">
                  {tutorial.title}
                </h1>
              </div>

            {/* 3. YouTube-style Channel Bar (Uploader profile + Action pill buttons) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#efefed]">
              {/* Creator / Channel Avatar & Info */}
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {creatorInitial}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-md text-sm font-bold text-[#0f0f0f] truncate">
                      {tutorial.createdBy || 'Pharmacozyme Team'}
                    </span>
                    <span className="material-symbols-outlined text-base text-[#4f46e5]" title="Verified Team Member">
                      verified
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5f5f5b] font-body-md">
                    <span>
                      {tutorial.createdAt ? new Date(tutorial.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Recent'}
                    </span>
                    <span>•</span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-label-caps text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: brandColor }}
                    >
                      {brandLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons (YouTube style pill container) */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f4f4f3] hover:bg-[#e9e9e7] active:scale-95 text-[#0f0f0f] font-label-caps text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">
                    {copiedLink ? 'check' : 'share'}
                  </span>
                  <span>{copiedLink ? 'Copied' : 'Share'}</span>
                </button>

                {/* Only the person who uploaded can edit or delete */}
                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(tutorial)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#4f46e5] font-label-caps text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Edit this tutorial"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      <span>Edit Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tutorial)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-label-caps text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Delete this tutorial"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] font-label-caps text-[#8f8f8b] italic hidden md:inline">
                    (Uploader: {tutorial.createdBy || 'Team'})
                  </span>
                )}
              </div>
            </div>

            {/* 4. YouTube-style Expandable Description Box */}
            <div className="bg-[#f2f2f2] hover:bg-[#eaeaea] rounded-2xl p-4 transition-colors border border-[#e5e5e5] flex flex-col gap-2.5">
              {/* Category, views & tags line */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-[#1b1c1a]">
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#e0e0e0] font-label-caps text-xs font-bold text-[#4f46e5]">
                  {tutorial.category}
                </span>

                {tutorial.tags?.map((tag, idx) => (
                  <span key={idx} className="text-[#4f46e5] font-semibold text-xs hover:underline cursor-pointer">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Description Body */}
              <div
                className={`text-xs md:text-sm font-body-md text-[#282828] leading-relaxed transition-all ${
                  isDescExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {tutorial.description ? (
                  <Suspense fallback={<p className="whitespace-pre-wrap">{tutorial.description}</p>}>
                    <ReactMarkdown>{tutorial.description}</ReactMarkdown>
                  </Suspense>
                ) : (
                  <p className="text-[#717171] italic">No description provided for this tutorial.</p>
                )}
              </div>

              {/* Show more / Show less toggle */}
              {tutorial.description && tutorial.description.length > 120 && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="self-start text-xs font-bold text-[#0f0f0f] hover:text-[#4f46e5] font-label-caps mt-1 cursor-pointer flex items-center gap-0.5"
                >
                  <span>{isDescExpanded ? 'Show less' : '...more'}</span>
                  <span className="material-symbols-outlined text-sm">
                    {isDescExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              )}
            </div>

            {/* 5. Attached Resources Tabs (Prompts, Links, Files) */}
            <div className="bg-white rounded-2xl border border-[#efefed] p-3.5 sm:p-5 flex flex-col gap-4 shadow-xs mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#efefed] pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[#4f46e5] text-lg shrink-0">folder_open</span>
                  <h3 className="font-headline-md text-sm sm:text-base font-bold text-[#1b1c1a] truncate">
                    Lesson Resources & Blueprint
                  </h3>
                </div>

                {/* Tab Switcher - touch scrollable on mobile */}
                <div className="flex items-center gap-1 bg-[#f4f4f3] p-1 rounded-xl overflow-x-auto scrollbar-none max-w-full shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('prompts')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                      activeResourceTab === 'prompts'
                        ? 'bg-white text-[#4f46e5] shadow-xs'
                        : 'text-[#57574f] hover:text-[#1b1c1a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    <span>Prompts</span>
                    {prompts.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#eef2ff] text-[#4f46e5]">
                        {prompts.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('links')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                      activeResourceTab === 'links'
                        ? 'bg-white text-[#4f46e5] shadow-xs'
                        : 'text-[#57574f] hover:text-[#1b1c1a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    <span>Links</span>
                    {links.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#eff6ff] text-[#3b82f6]">
                        {links.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResourceTab('files')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap min-h-[34px] ${
                      activeResourceTab === 'files'
                        ? 'bg-white text-[#4f46e5] shadow-xs'
                        : 'text-[#57574f] hover:text-[#1b1c1a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">attachment</span>
                    <span>Files</span>
                    {files.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700">
                        {files.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab: Prompts */}
              {activeResourceTab === 'prompts' && (
                <div className="flex flex-col gap-3">
                  {prompts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#5f5f5b] font-body-md">
                      No prompts attached to this tutorial lesson.
                    </div>
                  ) : (
                    prompts.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#f8f9fa] border border-[#efefed] rounded-xl flex flex-col gap-2 hover:border-[#c7c5f8] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-headline-md text-xs font-bold text-[#1b1c1a] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#d97706]">auto_stories</span>
                            <span>{p.title || `Prompt ${idx + 1}`}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(p.promptText, idx)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer bg-white border border-[#e9e9e7] hover:bg-[#4f46e5] hover:text-white hover:border-[#4f46e5] text-[#1b1c1a] shadow-2xs min-h-[30px]"
                          >
                            <span className="material-symbols-outlined text-xs">
                              {copiedPromptIdx === idx ? 'check' : 'content_copy'}
                            </span>
                            <span>{copiedPromptIdx === idx ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-white border border-[#efefed] rounded-lg font-mono text-xs text-[#1b1c1a] whitespace-pre-wrap break-words break-all max-h-48 overflow-y-auto">
                          {p.promptText}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Links */}
              {activeResourceTab === 'links' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {links.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-xs text-[#5f5f5b] font-body-md">
                      No external links attached.
                    </div>
                  ) : (
                    links.map((lnk, idx) => (
                      <a
                        key={idx}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white hover:bg-[#f4f4f3] border border-[#efefed] hover:border-[#4f46e5] rounded-xl group transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#3b82f6] flex items-center justify-center shrink-0">
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
                        <span className="material-symbols-outlined text-sm text-[#5f5f5b] group-hover:text-[#4f46e5] group-hover:translate-x-0.5 transition-all shrink-0">
                          open_in_new
                        </span>
                      </a>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Files */}
              {activeResourceTab === 'files' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-xs text-[#5f5f5b] font-body-md">
                      No downloadable files or templates attached.
                    </div>
                  ) : (
                    files.map((f, idx) => (
                      <a
                        key={idx}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white hover:bg-[#f4f4f3] border border-[#efefed] hover:border-[#16a34a] rounded-xl group transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
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
                        <span className="material-symbols-outlined text-sm text-[#5f5f5b] group-hover:text-[#16a34a] group-hover:translate-x-0.5 transition-all shrink-0">
                          download
                        </span>
                      </a>
                    ))
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* ════ SECONDARY COLUMN: YouTube "Up Next" / Playlist Sidebar ════ */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex flex-col gap-4 px-3.5 sm:px-0 pb-8 sm:pb-0 min-w-0">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between">
              <span className="font-headline-md text-sm font-bold text-[#0f0f0f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#4f46e5]">smart_display</span>
                <span>Up next</span>
              </span>
              <span className="font-body-md text-xs text-[#5f5f5b]">
                {upNextTutorials.length} more tutorial{upNextTutorials.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* List of Recommended Tutorials (YouTube compact card layout) */}
            <div className="flex flex-col gap-3">
              {upNextTutorials.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-[#efefed] text-center text-xs text-[#5f5f5b]">
                  No other tutorials in the library yet.
                </div>
              ) : (
                upNextTutorials.map((tut) => {
                  const pVid = tut.videos?.[0];
                  const embed = pVid ? getEmbedInfo(pVid.url) : null;
                  const thumb = tut.thumbnailUrl || embed?.thumbnailUrl;
                  const tutBrand = tut.brandId !== 'shared' ? brands[tut.brandId] : undefined;

                  return (
                    <div
                      key={tut.id}
                      onClick={() => onSelectTutorial(tut)}
                      className="flex gap-2.5 sm:gap-3 p-2 rounded-xl bg-white hover:bg-[#f4f4f3] border border-[#efefed] hover:border-[#c7c5f8] transition-all cursor-pointer group"
                    >
                      {/* Compact 16:9 Thumbnail (Left side) */}
                      <div className="relative w-28 xs:w-32 sm:w-40 aspect-video rounded-lg overflow-hidden bg-[#f4f4f3] shrink-0 flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={tut.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#eef2ff] text-[#4f46e5]">
                            <span className="material-symbols-outlined text-2xl">school</span>
                          </div>
                        )}

                        {/* Multiple videos count overlay */}
                        {tut.videos && tut.videos.length > 1 && (
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/75 text-white font-label-caps text-[9px] font-bold">
                            {tut.videos.length} videos
                          </div>
                        )}
                      </div>

                      {/* Info (Right side) */}
                      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                        <div>
                          <h4
                            className="font-headline-md text-xs font-bold text-[#0f0f0f] group-hover:text-[#4f46e5] transition-colors line-clamp-2 leading-tight"
                            title={tut.title}
                          >
                            {tut.title}
                          </h4>
                          <p className="font-body-md text-[11px] text-[#5f5f5b] truncate mt-1">
                            {tut.createdBy ? `By ${tut.createdBy}` : (tutBrand?.name || 'Shared')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-label-caps text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#f4f4f3] text-[#57574f] border border-[#efefed] truncate max-w-[120px]">
                            {tut.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
