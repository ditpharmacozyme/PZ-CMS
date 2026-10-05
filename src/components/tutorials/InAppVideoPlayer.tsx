import React, { useState } from 'react';
import { TutorialVideo } from '../../types';
import { getEmbedInfo } from '../../utils/videoEmbed';

interface InAppVideoPlayerProps {
  videos: TutorialVideo[];
  className?: string;
}

export const InAppVideoPlayer: React.FC<InAppVideoPlayerProps> = ({
  videos,
  className = ''
}) => {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!videos || videos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 ${className}`}>
        <span className="material-symbols-outlined text-4xl mb-2 text-slate-500">smart_display</span>
        <p className="text-sm">No video attached to this tutorial.</p>
      </div>
    );
  }

  const safeIdx = Math.min(Math.max(0, activeIdx), videos.length - 1);
  const activeVideo = videos[safeIdx] || videos[0];
  const embedInfo = getEmbedInfo(activeVideo.url);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Video tabs if multiple videos */}
      {videos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {videos.map((vid, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                idx === safeIdx
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {embedInfo.type === 'drive' ? 'folder' : 'play_circle'}
              </span>
              <span>{vid.title || `Video ${idx + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Player Display */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 shadow-xl group">
        {embedInfo.embedUrl ? (
          <iframe
            src={embedInfo.embedUrl}
            title={activeVideo.title || `Tutorial Video ${safeIdx + 1}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center bg-slate-900">
            <span className="material-symbols-outlined text-5xl text-indigo-400 mb-3">open_in_new</span>
            <h4 className="text-base font-semibold text-white mb-1">
              {activeVideo.title || 'External Course Video'}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mb-4 truncate w-full">
              {activeVideo.url}
            </p>
            <a
              href={activeVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
            >
              <span>Watch on External Site</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>
        )}

        {/* Quick Launch External Link Bar */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={activeVideo.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open video in new tab"
            className="flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur hover:bg-black/90 text-white text-xs rounded-md shadow border border-white/10"
          >
            <span className="material-symbols-outlined text-xs">open_in_new</span>
            <span>Open Link</span>
          </a>
        </div>
      </div>

      {/* Video caption bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-medium text-slate-300">
          {activeVideo.title || `Video ${safeIdx + 1}`}
        </span>
        <span className="capitalize text-slate-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
          {embedInfo.type}
        </span>
      </div>
    </div>
  );
};
