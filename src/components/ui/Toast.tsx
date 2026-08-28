import React from 'react';

/**
 * Presentational toast stack. Was previously a single `toast` slot inlined in
 * App.tsx -- a new toast silently replaced whatever was showing, which meant
 * a bulk action's "Undo" toast could be wiped out by the very next save
 * firing its own toast before the user had a chance to click it. This
 * renders a real stack instead: each toast keeps its own timer and its own
 * dismissal, so nothing gets clobbered by something else happening a moment
 * later. Queue state and the showToast/dismissToast functions still live in
 * App.tsx (this component owns rendering only) -- toast callers already
 * receive `showToast` as a plain callback (some through hook params, e.g.
 * usePosts/useTeamAndAuth), so a context provider here would add indirection
 * without removing any prop-drilling that actually exists.
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  action?: ToastAction;
  /** Visual tone. Toasts were previously visually identical whether they reported
   * success or failure -- `error` gives failures a distinct color instead of the
   * default success green, so a failed save doesn't read as a normal confirmation. */
  variant?: 'success' | 'error';
}

const VARIANT_ACCENT: Record<NonNullable<ToastItem['variant']>, string> = {
  success: 'border-[#4f46e5]',
  error: 'border-[#dc2626]',
};

const VARIANT_DOT: Record<NonNullable<ToastItem['variant']>, string> = {
  success: 'bg-[#4f46e5]',
  error: 'bg-[#dc2626]',
};

const VARIANT_PING: Record<NonNullable<ToastItem['variant']>, string> = {
  success: 'bg-[#15803d]',
  error: 'bg-[#ffb4ab]',
};

const VARIANT_ACTION_TEXT: Record<NonNullable<ToastItem['variant']>, string> = {
  success: 'text-[#15803d]',
  error: 'text-[#ffb4ab]',
};

export interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2" aria-live="polite" role="status">
      {toasts.map((toast) => {
        const variant = toast.variant || 'success';
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 bg-[#1b1c1a] text-white font-label-caps text-[11px] px-5 py-3.5 rounded-xl warm-shadow-lg border-l-4 toast-in ${VARIANT_ACCENT[variant]}`}
          >
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${VARIANT_PING[variant]}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${VARIANT_DOT[variant]}`} />
            </span>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}
                className={`font-bold hover:underline flex-shrink-0 cursor-pointer ${VARIANT_ACTION_TEXT[variant]}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss"
              className="text-white/50 hover:text-white flex-shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
