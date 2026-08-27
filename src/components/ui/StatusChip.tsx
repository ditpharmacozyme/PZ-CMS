import React from 'react';
import { Post } from '../../types';
import { getPostStatusConfig } from '../../utils/statusConfig';

/**
 * `getPostStatusConfig()` already centralizes the *data* (color/label/icon
 * per status -- see utils/statusConfig.ts), but four render sites
 * (PostCard's month/week and mobile-list variants, CalendarListView,
 * MobileDateStripView) each hand-rendered their own chip markup from it with
 * near-identical inline `style={{ backgroundColor, color }}` objects. This
 * is a pure refactor of that markup into one place -- each `variant` below
 * matches one of those sites' existing classes/sizing exactly, so swapping a
 * call site over changes no rendered output.
 */

export interface StatusChipProps {
  post: Post;
  /** dot: small colored dot + plain-color text, no pill background (PostCard month/week).
   *  pill: filled pill, text only (PostCard mobile-list).
   *  pill-dot: filled pill with a dot ahead of the text (CalendarListView).
   *  pill-icon: filled pill with the status's optional icon ahead of the text (MobileDateStripView). */
  variant: 'dot' | 'pill' | 'pill-dot' | 'pill-icon';
  title?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ post, variant, title, className = '' }) => {
  const statusCfg = getPostStatusConfig(post);

  if (variant === 'dot') {
    return (
      <div className={`flex items-center gap-1 min-w-0 px-1 py-0.2 ${className}`} title={title}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusCfg.color }} />
        <span className="truncate font-medium text-[8px] text-[#707a67]">{statusCfg.label}</span>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <span
        className={`font-label-caps text-[8px] font-bold uppercase px-1.5 py-0.2 rounded ${className}`}
        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
        title={title}
      >
        {statusCfg.label}
      </span>
    );
  }

  if (variant === 'pill-dot') {
    return (
      <span
        className={`font-label-caps text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center justify-center gap-1.5 w-fit ${className}`}
        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
        title={title}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusCfg.color }} />
        <span>{statusCfg.label}</span>
      </span>
    );
  }

  // pill-icon
  return (
    <span
      className={`font-label-caps text-[9px] font-bold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${className}`}
      style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
      title={title}
    >
      {statusCfg.icon && (
        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>
          {statusCfg.icon}
        </span>
      )}
      {statusCfg.label}
    </span>
  );
};
