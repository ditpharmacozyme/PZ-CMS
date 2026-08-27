import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

/**
 * Anchored floating panel, positioned relative to a trigger element.
 *
 * There was no shared dropdown/popover primitive anywhere in the app before
 * this -- four different ad-hoc implementations existed (TopNav's brand
 * picker with its own inline click-catcher div, TopNav's profile popover
 * with no outside-click dismissal at all, SideNav's "More" accordion, and
 * IdeaBacklog's mobile sheet standing in for a menu on small screens) and
 * none of them shared positioning, dismissal, or focus logic.
 *
 * Portal-rendered to document.body and positioned with `fixed` + a measured
 * bounding rect (not `absolute` inside a `relative` trigger wrapper, which
 * is how TopNav's brand picker does it today) specifically so this works
 * when the trigger sits inside an `overflow-hidden` ancestor -- e.g. a
 * calendar month-cell or a card in a scrollable list, which is exactly
 * where Phase 2's assignee popover needs to open from.
 */

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** The element the popover is anchored to. Excluded from the outside-click check. */
  anchorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  ariaLabel?: string;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

export const Popover: React.FC<PopoverProps> = ({ isOpen, onClose, anchorRef, children, align = 'start', className = '', ariaLabel }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; visibility: 'visible' | 'hidden' }>({
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  const reposition = () => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    let top = anchorRect.bottom + GAP;
    if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchorRect.top - GAP - panelRect.height;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    let left = align === 'end' ? anchorRect.right - panelRect.width : anchorRect.left;
    left = Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_MARGIN);
    left = Math.max(VIEWPORT_MARGIN, left);

    setStyle({ top, left, visibility: 'visible' });
  };

  // Two-pass: render below-anchor first (default style state), then measure
  // the panel's actual size in a layout effect (before paint) and flip
  // above / clamp horizontally if it wouldn't fit. Avoids needing to guess
  // panel dimensions up front, with no visible flash since this resolves
  // before paint. Also reruns on scroll/resize while open -- `fixed`
  // positioning is viewport-relative, so scrolling any ancestor (not just
  // the window) would otherwise leave the panel stranded away from its
  // anchor. Capture phase catches scroll events from nested scroll
  // containers, which don't bubble.
  useLayoutEffect(() => {
    if (!isOpen) {
      setStyle((prev) => ({ ...prev, visibility: 'hidden' }));
      return;
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, align, anchorRef]);

  useOnClickOutside([anchorRef, panelRef], onClose, isOpen);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      style={{ position: 'fixed', top: style.top, left: style.left, visibility: style.visibility, zIndex: 60 }}
      className={`bg-[var(--color-raised)] border border-[var(--color-line)] shadow-2xl rounded-lg ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};
