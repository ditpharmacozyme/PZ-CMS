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

  // Sync fullscreen state if user exits via browser ESC or native gesture
  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeActive = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!nativeActive && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleExitFullscreen();
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only toggle fullscreen if not currently typing in an input
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
      handleExitFullscreen();
      return;
    }

    try {
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        await (containerRef.current as any).webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        // Fallback to CSS viewport fullscreen for iOS Safari / restricted environments
        setIsFullscreen(true);
      }
    } catch {
      // If native requestFullscreen is rejected, fallback to full-viewport CSS mode
      setIsFullscreen(true);
    }
  }, [isFullscreen]);

  const handleExitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      }
    } catch {
      // Ignore exit errors
    } finally {
      setIsFullscreen(false);
    }
  }, []);

  if (!videos || videos.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 sm:p-12 bg-[#f8f9fa] rounded-2xl border border-[#efefed] text-[#5f5f5b] ${className}`}
      >
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

  const handlePrevLesson = () => {
    if (safeIdx > 0) setActiveIdx(safeIdx - 1);
  };

  const handleNextLesson = () => {
    if (safeIdx < videos.length - 1) setActiveIdx(safeIdx + 1);
  };

  const getPlatformLabel = () => {
    if (isDirect) return 'Direct Video';
    if (embedInfo.type === 'youtube') return 'YouTube';
    if (embedInfo.type === 'drive') return 'Google Drive';
    if (embedInfo.type === 'vimeo') return 'Vimeo';
    return 'External Course';
  };

  const getPlatformIcon = () => {
    if (isDirect) return 'video_file';
    if (embedInfo.type === 'youtube') return 'play_circle';
    if (embedInfo.type === 'drive') return 'folder_shared';
    if (embedInfo.type === 'vimeo') return 'videocam';
    return 'open_in_new';
  };

  const finalEmbedUrl = embedInfo.embedUrl;

  return (
    <div className={`flex flex-col gap-2.5 sm:gap-3 w-full ${className}`}>
      {/* ── Multi-Video Selector for Mobile & Desktop ── */}
      {videos.length > 1 && (
        <div className="flex flex-col gap-2 bg-[#f8f9fa] p-2.5 rounded-xl border border-[#efefed]">
          <div className="flex items-center justify-between text-xs font-label-caps">
            <span className="font-bold text-[#1b1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#4f46e5]">playlist_play</span>
              <span>Course Lessons ({videos.length})</span>
            </span>

            {/* Quick Touch Lesson Stepper */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#5f5f5b] mr-1 font-medium tabular-nums">
                {safeIdx + 1} / {videos.length}
              </span>
              <button
                type="button"
                onClick={handlePrevLesson}
                disabled={safeIdx === 0}
                aria-label="Previous lesson"
                className="p-1.5 rounded-lg border border-[#e9e9e7] bg-white text-[#1b1c1a] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f1f1f0] active:scale-95 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
              <button
                type="button"
                onClick={handleNextLesson}
                disabled={safeIdx === videos.length - 1}
                aria-label="Next lesson"
                className="p-1.5 rounded-lg border border-[#e9e9e7] bg-white text-[#1b1c1a] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f1f1f0] active:scale-95 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Touch-scrollable tabs */}
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
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      isCurrent ? 'bg-white/20 text-white' : 'bg-[#efefed] text-[#57574f]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="max-w-[160px] sm:max-w-[200px] truncate">
                    {vid.title || `Lesson ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Video Stage (Clean, YouTube-style, No floating cards inside) ── */}
      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-[9999] bg-black w-screen h-screen flex flex-col justify-center items-center overflow-hidden'
            : 'relative w-full aspect-video min-h-[200px] sm:min-h-[260px] rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-[#e2e8f0] shadow-sm group'
        }
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
          /* Non-embeddable Fallback Card */
          <div className="flex flex-col items-center justify-center w-full h-full p-4 sm:p-8 text-center bg-[#f8f9fa] text-[#1b1c1a]">
            <div className="w-14 h-14 rounded-2xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center mb-3 shadow-xs">
              <span className="material-symbols-outlined text-3xl">open_in_new</span>
            </div>
            <h4 className="font-headline-md text-sm sm:text-base font-bold text-[#1b1c1a] mb-1">
              {activeVideo.title || 'External Course Video'}
            </h4>
            <p className="font-body-md text-xs text-[#5f5f5b] max-w-md mb-4 truncate w-full px-2">
              {activeVideo.url}
            </p>
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

        {/* Prominent Exit Fullscreen control when in Fullscreen mode */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <button
              type="button"
              onClick={handleExitFullscreen}
              aria-label="Exit Fullscreen"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-black/80 hover:bg-black text-white text-xs font-label-caps font-bold rounded-xl border border-white/20 shadow-2xl backdrop-blur-md cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">fullscreen_exit</span>
              <span>Exit Fullscreen</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Info & Controls Bar (YouTube-style action bar) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1 pt-1 text-xs">
        {/* Left: Video Title & Lesson Part */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-headline-md font-bold text-[#1b1c1a] truncate text-xs sm:text-sm">
            {activeVideo.title || `Video ${safeIdx + 1}`}
          </span>
          {videos.length > 1 && (
            <span className="text-[10px] font-label-caps font-semibold px-2 py-0.5 rounded-full bg-[#f4f4f3] text-[#5f5f5b] border border-[#efefed] shrink-0 tabular-nums">
              Part {safeIdx + 1} of {videos.length}
            </span>
          )}
        </div>

        {/* Right: Fullscreen & Clean External Link controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Platform indicator badge */}
          <span className="inline-flex items-center gap-1 text-[11px] font-label-caps font-semibold text-[#57574f] bg-[#f4f4f3] px-2.5 py-1 rounded-lg border border-[#efefed]">
            <span className="material-symbols-outlined text-xs text-[#4f46e5]">
              {getPlatformIcon()}
            </span>
            <span className="capitalize">{getPlatformLabel()}</span>
          </span>

          {/* Clean External Link (outside video frame) */}
          {activeVideo.url && (
            <a
              href={activeVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open original source link`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#57574f] hover:text-[#1b1c1a] hover:bg-[#f4f4f3] border border-[#efefed] font-label-caps text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-xs">open_in_new</span>
              <span className="hidden sm:inline">Open in new tab</span>
            </a>
          )}

          {/* Prominent Full Screen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (f)' : 'Full screen (f)'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Full screen'}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-[#f4f4f3] active:bg-[#e9e9e7] text-[#1b1c1a] border border-[#e2e8f0] font-label-caps text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs min-h-[30px]"
          >
            <span className="material-symbols-outlined text-base text-[#4f46e5]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
