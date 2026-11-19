import React from 'react';

/** Quiet inline status line with the same spinner markup the Button uses. */
export const AdsStatus: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p role="status" aria-live="polite" className={`flex items-center gap-2 text-xs text-[#5f5f5b] ${className}`}>
    <span className="w-3.5 h-3.5 flex-shrink-0 border-2 border-current/30 border-t-current rounded-full animate-spin" aria-hidden="true" />
    <span className="min-w-0">{children}</span>
  </p>
);
