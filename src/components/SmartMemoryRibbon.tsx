import React, { useState } from 'react';
import { Post, BrandId } from '../types';
import { BRANDS } from '../data/brands';
import { PostDraft } from '../hooks/useSmartMemory';

interface SmartMemoryRibbonProps {
  savedDraft: PostDraft | null;
  onRestoreDraft: (draft: PostDraft) => void;
  onDiscardDraft: () => void;
  recentPosts: Post[];
  onSelectPost: (post: Post) => void;
}

export const SmartMemoryRibbon: React.FC<SmartMemoryRibbonProps> = ({
  savedDraft,
  onRestoreDraft,
  onDiscardDraft,
  recentPosts,
  onSelectPost,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // If there's neither a draft nor recent posts, don't take up space
  if (!savedDraft && (!recentPosts || recentPosts.length === 0)) {
    return null;
  }

  return (
    <div className="bg-[#1b1c1a] text-white border-b border-[#296c00]/40 px-3 py-1.5 sm:px-6 sm:py-2 flex flex-wrap items-center justify-between gap-2 text-xs transition-all shadow-xs z-30">
      {/* Left: Draft Recovery Alert OR Recent Items Title */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {savedDraft ? (
          <div className="flex items-center gap-2 bg-[#296c00]/30 border border-[#78d24b]/40 px-2.5 py-1 rounded-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78d24b] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#78d24b]"></span>
            </span>
            <span className="font-label-caps text-[10px] sm:text-xs text-[#aceecf] font-bold">
              Unsaved Draft:
            </span>
            <span className="font-medium text-[11px] sm:text-xs text-white max-w-[140px] sm:max-w-[220px] truncate">
              "{savedDraft.title || 'Untitled post'}"
            </span>
            <button
              onClick={() => onRestoreDraft(savedDraft)}
              className="bg-[#296c00] hover:bg-[#78d24b] hover:text-[#1b1c1a] text-white font-label-caps text-[10px] font-bold px-2 py-0.5 rounded transition-colors ml-1 cursor-pointer flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-xs">restore_page</span>
              <span>Resume</span>
            </button>
            <button
              onClick={onDiscardDraft}
              className="text-[#bfcab4] hover:text-[#ffdad6] p-0.5 rounded cursor-pointer"
              title="Discard draft"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        ) : null}

        {/* Recent Items Quick Jump */}
        {recentPosts.length > 0 && !collapsed && (
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
            <span className="font-label-caps text-[9px] text-[#bfcab4] uppercase tracking-wider hidden md:inline">
              Recent:
            </span>
            {recentPosts.slice(0, 4).map((post) => {
              const brand = BRANDS[post.brandId];
              return (
                <button
                  key={post.id}
                  onClick={() => onSelectPost(post)}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white/90 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap border border-white/10 hover:border-[#78d24b]/40"
                  title={`Open: ${post.title}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: brand?.primaryColor || '#78d24b' }}
                  />
                  <span className="max-w-[110px] truncate">{post.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Quick Minimize/Expand */}
      {recentPosts.length > 0 && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#bfcab4] hover:text-white text-[10px] font-label-caps flex items-center gap-0.5 ml-auto"
        >
          <span className="material-symbols-outlined text-xs">
            {collapsed ? 'unfold_more' : 'unfold_less'}
          </span>
          <span className="hidden sm:inline">{collapsed ? 'Show Recent' : 'Hide'}</span>
        </button>
      )}
    </div>
  );
};
