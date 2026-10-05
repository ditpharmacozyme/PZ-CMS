import React from 'react';
import { Tutorial, BrandConfig } from '../../types';
import { getEmbedInfo } from '../../utils/videoEmbed';

interface TutorialCardProps {
  tutorial: Tutorial;
  brand?: BrandConfig;
  onOpenDetail: (t: Tutorial) => void;
  onEdit: (t: Tutorial) => void;
  onDelete: (t: Tutorial) => void;
}

export const TutorialCard: React.FC<TutorialCardProps> = ({
  tutorial,
  brand,
  onOpenDetail,
  onEdit,
  onDelete
}) => {
  const primaryVideo = tutorial.videos?.[0];
  const embedInfo = primaryVideo ? getEmbedInfo(primaryVideo.url) : null;
  const thumbnailUrl = embedInfo?.thumbnailUrl;

  const isShared = tutorial.brandId === 'shared';
  const brandLabel = isShared ? 'Shared' : (brand?.name || tutorial.brandId);
  const brandColor = isShared ? '#6366f1' : (brand?.primaryColor || '#64748b');

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all duration-200 overflow-hidden group">
      {/* Thumbnail / Header Media */}
      <div
        onClick={() => onOpenDetail(tutorial)}
        className="relative w-full aspect-video bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center group/thumb"
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={tutorial.title}
            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            onError={(e) => {
              // Hide broken image and fall back to icon
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950/60 p-4 text-center">
            <span className="material-symbols-outlined text-4xl text-indigo-400/80 mb-1">
              school
            </span>
            <span className="text-[11px] font-medium text-slate-400">Course & SOP</span>
          </div>
        )}

        {/* Play Overlay Button */}
        {primaryVideo && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:bg-black/40 transition-all">
            <div className="w-12 h-12 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center shadow-lg transform group-hover/thumb:scale-110 transition-transform">
              <span className="material-symbols-outlined text-2xl ml-0.5">play_arrow</span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          {/* Brand Badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-sm backdrop-blur-md"
            style={{ backgroundColor: `${brandColor}dd` }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>{brandLabel}</span>
          </span>

          {/* Category Badge */}
          {tutorial.category && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/60 text-slate-200 backdrop-blur-md">
              {tutorial.category}
            </span>
          )}
        </div>

        {/* Video count pill if multiple */}
        {tutorial.videos && tutorial.videos.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur text-white text-[11px] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">playlist_play</span>
            <span>{tutorial.videos.length} videos</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title */}
        <h3
          onClick={() => onOpenDetail(tutorial)}
          className="text-base font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 cursor-pointer mb-1.5"
          title={tutorial.title}
        >
          {tutorial.title}
        </h3>

        {/* Description snippet */}
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 flex-1">
          {tutorial.description || 'No description provided.'}
        </p>

        {/* Attached resources counters */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80 mb-3">
          {tutorial.videos?.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-xs text-indigo-500">smart_display</span>
              <span>{tutorial.videos.length}</span>
            </span>
          )}
          {tutorial.links?.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-xs text-blue-500">link</span>
              <span>{tutorial.links.length} {tutorial.links.length === 1 ? 'link' : 'links'}</span>
            </span>
          )}
          {tutorial.prompts?.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-xs text-amber-500">auto_stories</span>
              <span>{tutorial.prompts.length} {tutorial.prompts.length === 1 ? 'prompt' : 'prompts'}</span>
            </span>
          )}
          {tutorial.files?.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-xs text-emerald-500">attachment</span>
              <span>{tutorial.files.length} {tutorial.files.length === 1 ? 'file' : 'files'}</span>
            </span>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={() => onOpenDetail(tutorial)}
            className="flex-1 py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            <span>View Tutorial</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(tutorial)}
              title="Edit tutorial"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(tutorial)}
              title="Delete tutorial"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
