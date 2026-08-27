import { useEffect } from 'react';

interface ShortcutHandlers {
  /** Cmd/Ctrl+K — open the command palette. */
  onOpenPalette: () => void;
  /** N — start a new post. */
  onNewPost: () => void;
  /** A — open the global quick-add bar. */
  onQuickAdd?: () => void;
  /** / — focus the search box. */
  onFocusSearch: () => void;
  /** Esc — close whatever's open (palette, modal). Consumers decide what "open" means. */
  onEscape?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Global keyboard shortcuts for the app shell. Single-key shortcuts (N, A, /)
 * are suppressed while the user is typing in a field, so they never hijack
 * normal text entry — only Cmd/Ctrl+K and Escape work everywhere.
 */
export function useKeyboardShortcuts({ onOpenPalette, onNewPost, onQuickAdd, onFocusSearch, onEscape }: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (typing) return;

      // Don't let a single-key shortcut open a second overlay (or, via the
      // image-paste zones, attach a duplicate handler) while a modal is up.
      // Cmd/Ctrl+K and Escape above are intentionally exempt.
      if (document.querySelector('[role="dialog"]')) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onNewPost();
      } else if ((e.key === 'a' || e.key === 'A') && onQuickAdd) {
        e.preventDefault();
        onQuickAdd();
      } else if (e.key === '/') {
        e.preventDefault();
        onFocusSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenPalette, onNewPost, onFocusSearch, onEscape]);
}
