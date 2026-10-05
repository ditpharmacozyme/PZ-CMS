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
  const brandColor = isShared ? '#4f46e5' : (brand?.primaryColor || '#64748b');

  const resourceCount =
    (tutorial.videos?.length || 0) +
    (tutorial.links?.length || 0) +
    (tutorial.prompts?.length || 0) +
    (tutorial.files?.length || 0);

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-[#efefed] shadow-xs hover:shadow-md hover:border-[#c7c5f8] transition-all duration-200 overflow-hidden group cursor-pointer">
      {/* Thumbnail */}
      <div
        onClick={() => onOpenDetail(tutorial)}
        className="relative w-full aspect-video bg-[#f4f4f3] overflow-hidden flex items-center justify-center"
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={tutorial.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#eef2ff] p-4 text-center">
            <span className="material-symbols-outlined text-4xl text-[#4f46e5]/60 mb-1">
              school
            </span>
            <span className="font-label-caps text-[10px] font-bold text-[#5f5f5b] tracking-widest">
              Course & SOP
            </span>
          </div>
        )}

        {/* Play Overlay */}
        {primaryVideo && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div className="w-12 h-12 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <span className="material-symbols-outlined text-2xl ml-0.5">play_arrow</span>
            </div>
          </div>
        )}

        {/* Brand Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-caps text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: `${brandColor}ee` }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            {brandLabel}
          </span>
        </div>

        {/* Multiple videos pill */}
        {tutorial.videos && tutorial.videos.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-white font-label-caps text-[10px] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">playlist_play</span>
            {tutorial.videos.length} videos
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Category tag */}
        {tutorial.category && tutorial.category !== 'Uncategorized' && (
          <span className="self-start px-2 py-0.5 rounded font-label-caps text-[10px] font-bold bg-[#f4f4f3] text-[#5f5f5b] border border-[#efefed]">
            {tutorial.category}
          </span>
        )}

        {/* Title */}
        <div>
          <h3
            onClick={() => onOpenDetail(tutorial)}
            className="font-headline-md text-[15px] font-bold text-[#1b1c1a] hover:text-[#4f46e5] transition-colors line-clamp-1 cursor-pointer"
            title={tutorial.title}
          >
            {tutorial.title}
          </h3>
          <p className="font-body-md text-xs text-[#5f5f5b] line-clamp-2 mt-1">
            {tutorial.description || 'No description provided.'}
          </p>
        </div>

        {/* Resource counters */}
        {resourceCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#efefed]">
            {tutorial.videos?.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#eef2ff] text-[#4f46e5] font-label-caps text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">smart_display</span>
                {tutorial.videos.length} video{tutorial.videos.length !== 1 ? 's' : ''}
              </span>
            )}
            {tutorial.links?.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#eff6ff] text-[#3b82f6] font-label-caps text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">link</span>
                {tutorial.links.length} link{tutorial.links.length !== 1 ? 's' : ''}
              </span>
            )}
            {tutorial.prompts?.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#fffbeb] text-[#d97706] font-label-caps text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">auto_stories</span>
                {tutorial.prompts.length} prompt{tutorial.prompts.length !== 1 ? 's' : ''}
              </span>
            )}
            {tutorial.files?.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-label-caps text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">attachment</span>
                {tutorial.files.length} file{tutorial.files.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onOpenDetail(tutorial)}
            className="flex-1 py-2 px-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl font-label-caps text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Tutorial
          </button>

          <button
            type="button"
            onClick={() => onEdit(tutorial)}
            title="Edit tutorial"
            className="p-2 text-[#5f5f5b] hover:text-[#1b1c1a] hover:bg-[#f4f4f3] rounded-xl transition-colors cursor-pointer border border-[#efefed]"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(tutorial)}
            title="Delete tutorial"
            className="p-2 text-[#5f5f5b] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-[#efefed]"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
