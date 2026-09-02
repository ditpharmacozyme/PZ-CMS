import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared modal primitive. Before this, every modal in the app was hand-rolled
 * per file (`fixed inset-0 z-50 bg-black/60 ...` copy-pasted N times) with no
 * role="dialog", no focus trap, no focus restore, and inconsistent Escape /
 * backdrop-click behavior. This is the one place that owns all of that.
 */

// Stack of currently-open Modal ids, in open order. Only the topmost modal
// reacts to Escape -- needed because the dirty-confirm sub-dialog below (and
// ConfirmDialog, which renders a Modal too) stacks a Modal on top of a Modal.
let openModalIds: string[] = [];

let scrollLockCount = 0;
function lockBodyScroll() {
  scrollLockCount += 1;
  if (scrollLockCount === 1) document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = '';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalDirtyPrompt {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** When true, Escape and backdrop click show `dirtyPrompt` instead of closing immediately. */
  isDirty?: boolean;
  dirtyPrompt?: ModalDirtyPrompt;
  closeOnBackdrop?: boolean;
  /** Extra buttons next to the close X, e.g. Duplicate / Delete. */
  headerActions?: React.ReactNode;
  /** Sticky footer action bar. */
  footer?: React.ReactNode;
  /** Full-panel blocking overlay, e.g. { label: 'Duplicating post...' }. */
  busy?: { label: string } | null;
  initialFocusRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  eyebrow,
  icon,
  size = 'md',
  isDirty = false,
  dirtyPrompt,
  closeOnBackdrop = true,
  headerActions,
  footer,
  busy = null,
  initialFocusRef,
  children,
}) => {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmingClose(false);
    openModalIds.push(id);
    return () => {
      openModalIds = openModalIds.filter((m) => m !== id);
    };
  }, [isOpen, id]);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const toFocus = initialFocusRef?.current || panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    toFocus?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const requestClose = () => {
    if (isDirty && dirtyPrompt) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openModalIds[openModalIds.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id, isDirty, dirtyPrompt]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center overflow-y-auto">
      <div
        onClick={() => { if (closeOnBackdrop) requestClose(); }}
        className="absolute inset-0"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative bg-white border border-[#e9e9e7] w-full ${SIZE_CLASS[size]} rounded-t-2xl sm:rounded-xl warm-shadow-lg sheet-modal max-h-[92vh] sm:max-h-[88vh] flex flex-col sm:my-8`}
      >
        <div className="sm:hidden pt-2.5 flex-shrink-0"><div className="sheet-handle" /></div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-5 pb-4 border-b border-[var(--color-line-subtle)] flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              {eyebrow && (
                <p className="font-label-caps text-[10px] font-bold text-[var(--color-accent)] tracking-widest mb-0.5">{eyebrow}</p>
              )}
              <h2 id={titleId} className="font-headline-md text-[15px] font-bold text-[var(--color-ink)]">{title}</h2>
              {description && <p id={descId} className="font-body-md text-xs text-[var(--color-ink-muted)] mt-0.5">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {headerActions}
            <button
              onClick={requestClose}
              aria-label="Close"
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-muted)] rounded-full transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {children}
        </div>

        {footer && (
          <div className="sheet-action-bar sm:static sm:bg-transparent sm:border-t sm:border-[var(--color-line)] sm:px-6 sm:py-4 flex-shrink-0">
            {footer}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 bg-[var(--color-surface)]/95 flex flex-col items-center justify-center gap-3 rounded-t-2xl sm:rounded-xl z-10">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
            <p className="font-label-caps text-xs font-bold text-[var(--color-ink-muted)]">{busy.label}</p>
          </div>
        )}

        {confirmingClose && dirtyPrompt && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 rounded-t-2xl sm:rounded-xl z-20">
            <div className="bg-[var(--color-raised)] border border-[var(--color-line)] rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
              <h3 className="font-headline-md text-sm font-bold text-[var(--color-ink)]">{dirtyPrompt.title}</h3>
              <p className="font-body-md text-xs text-[var(--color-ink-muted)]">{dirtyPrompt.body}</p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setConfirmingClose(false)}
                  className="px-3.5 py-2 text-xs font-label-caps font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)] rounded-lg cursor-pointer"
                >
                  {dirtyPrompt.cancelLabel}
                </button>
                <button
                  onClick={() => { setConfirmingClose(false); onClose(); }}
                  className="px-3.5 py-2 text-xs font-label-caps font-bold bg-[var(--color-danger)] text-white hover:opacity-90 rounded-lg cursor-pointer"
                >
                  {dirtyPrompt.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
