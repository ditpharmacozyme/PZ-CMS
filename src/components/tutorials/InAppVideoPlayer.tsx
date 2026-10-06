import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TutorialVideo } from '../../types';
import { getEmbedInfo } from '../../utils/videoEmbed';

interface InAppVideoPlayerProps {
  videos: TutorialVideo[];
  className?: string;
  posterUrl?: string;
}

function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.ogv') ||
    clean.startsWith('blob:')
  );
}

export const InAppVideoPlayer: React.FC<InAppVideoPlayerProps> = ({
  videos,
  className = '',
  posterUrl
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track native fullscreen state only (no CSS-overlay fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeActive = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(nativeActive);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          handleToggleFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (isFullscreen) {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        }
      } catch { /* ignore */ }
      setIsFullscreen(false);
      return;
    }

    try {
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        await (containerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(true);
    }
  }, [isFullscreen]);

  if (!videos || videos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 sm:p-12 bg-[#f8f9fa] rounded-2xl border border-[#efefed] text-[#5f5f5b] ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center mb-3 shadow-xs">
          <span className="material-symbols-outlined text-3xl">smart_display</span>
        </div>
        <p className="font-headline-md text-sm font-semibold text-[#1b1c1a]">No video attached</p>
        <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">No video attached to this tutorial.</p>
      </div>
    );
  }

  const safeIdx = Math.min(Math.max(0, activeIdx), videos.length - 1);
  const activeVideo = videos[safeIdx] || videos[0];
  const embedInfo = getEmbedInfo(activeVideo.url);
  const isDirect = isDirectVideoUrl(activeVideo.url);
  const finalEmbedUrl = embedInfo.embedUrl;

  const getPlatformLabel = () => {
    if (isDirect) return 'Direct';
    if (embedInfo.type === 'youtube') return 'YouTube';
    if (embedInfo.type === 'drive') return 'Drive';
    if (embedInfo.type === 'vimeo') return 'Vimeo';
    return 'External';
  };

  const getPlatformIcon = () => {
    if (isDirect) return 'video_file';
    if (embedInfo.type === 'youtube') return 'play_circle';
    if (embedInfo.type === 'drive') return 'folder_shared';
    if (embedInfo.type === 'vimeo') return 'videocam';
    return 'open_in_new';
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>

      {/* ── Multi-lesson selector (only when > 1 video) ── */}
      {videos.length > 1 && (
        <div className="flex flex-col gap-2 bg-[#f8f9fa] p-2.5 rounded-xl border border-[#efefed]">
          <div className="flex items-center justify-between text-xs font-label-caps">
            <span className="font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#4f46e5]">playlist_play</span>
              <span>Lessons ({videos.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#5f5f5b] mr-1 font-medium tabular-nums">
                {safeIdx + 1}/{videos.length}
              </span>
              <button
                type="button"
                onClick={() => safeIdx > 0 && setActiveIdx(safeIdx - 1)}
                disabled={safeIdx === 0}
                aria-label="Previous lesson"
                className="p-1.5 rounded-lg border border-[#e9e9e7] bg-white text-[#1b1c1a] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f1f1f0] active:scale-95 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
              <button
                type="button"
                onClick={() => safeIdx < videos.length - 1 && setActiveIdx(safeIdx + 1)}
                disabled={safeIdx === videos.length - 1}
                aria-label="Next lesson"
                className="p-1.5 rounded-lg border border-[#e9e9e7] bg-white text-[#1b1c1a] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f1f1f0] active:scale-95 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
          {/* Horizontally-scrollable lesson tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scroll-smooth -mx-0.5 px-0.5">
            {videos.map((vid, idx) => {
              const isCurrent = idx === safeIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`px-3 py-2 rounded-lg text-xs font-label-caps font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer min-h-[38px] shrink-0 ${
                    isCurrent
                      ? 'bg-[#4f46e5] text-white shadow-xs'
                      : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0] hover:text-[#1b1c1a]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${isCurrent ? 'bg-white/20 text-white' : 'bg-[#efefed] text-[#57574f]'}`}>
                    {idx + 1}
                  </span>
                  <span className="max-w-[140px] sm:max-w-[200px] truncate">
                    {vid.title || `Lesson ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Video stage — edge-to-edge on mobile, rounded on desktop ── */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video min-h-[180px] sm:min-h-[260px] rounded-none sm:rounded-xl overflow-hidden bg-black border-0 sm:border border-[#e2e8f0] sm:shadow-sm"
      >
        {isDirect ? (
          <video
            src={activeVideo.url}
            controls
            playsInline
            preload="metadata"
            poster={posterUrl || embedInfo.thumbnailUrl}
            className="w-full h-full object-contain bg-black"
          >
            Your browser does not support the video tag.
          </video>
        ) : finalEmbedUrl ? (
          <iframe
            src={finalEmbedUrl}
            title={activeVideo.title || `Tutorial Video ${safeIdx + 1}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full p-4 sm:p-8 text-center bg-[#f8f9fa] text-[#1b1c1a]">
            <div className="w-14 h-14 rounded-2xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center mb-3 shadow-xs">
              <span className="material-symbols-outlined text-3xl">open_in_new</span>
            </div>
            <h4 className="font-headline-md text-sm sm:text-base font-bold text-[#1b1c1a] mb-3">
              {activeVideo.title || 'External Course Video'}
            </h4>
            <a
              href={activeVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-label-caps font-bold transition-all shadow-xs min-h-[44px]"
            >
              <span>Watch on External Site</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>
        )}
      </div>

      {/* ── Clean, compact controls bar ── */}
      <div className="flex items-center justify-between gap-2 px-1 pt-0.5 min-w-0">

        {/* Left: Platform badge + truncated title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <span className="inline-flex items-center gap-0.5 text-[10px] font-label-caps font-bold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 rounded shrink-0">
            <span className="material-symbols-outlined text-xs">{getPlatformIcon()}</span>
            <span>{getPlatformLabel()}</span>
          </span>
          <span className="font-headline-md font-bold text-[#1b1c1a] truncate text-xs leading-tight">
            {activeVideo.title || `Video ${safeIdx + 1}`}
          </span>
          {videos.length > 1 && (
            <span className="text-[10px] font-label-caps font-semibold px-1.5 py-0.5 rounded-full bg-[#f4f4f3] text-[#5f5f5b] border border-[#efefed] shrink-0 tabular-nums">
              {safeIdx + 1}/{videos.length}
            </span>
          )}
        </div>

        {/* Right: External link icon + Full Screen button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeVideo.url && (
            <a
              href={activeVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open source in new tab"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#57574f] hover:text-[#1b1c1a] hover:bg-[#f4f4f3] border border-[#efefed] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Full screen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Full screen'}
            className="inline-flex items-center gap-1 px-2 py-1.5 sm:px-2.5 rounded-lg bg-white hover:bg-[#f4f4f3] active:bg-[#e9e9e7] text-[#1b1c1a] border border-[#e2e8f0] font-label-caps text-xs font-bold transition-all cursor-pointer min-h-[32px]"
          >
            <span className="material-symbols-outlined text-sm text-[#4f46e5]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span className="hidden sm:inline text-xs">{isFullscreen ? 'Exit' : 'Full Screen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
