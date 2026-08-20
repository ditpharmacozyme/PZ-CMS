import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Replaces the 13 native `window.confirm(...)` sites scattered across the
 * app (no styling, no way to mark an action as destructive, blocks the whole
 * tab). One provider mounted once in App.tsx; call sites become a single
 * `if (await confirm({ title, tone: 'danger' })) { ... }` -- close to the
 * shape of the window.confirm call it replaces.
 */

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const settle = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={Boolean(state)}
        onClose={() => settle(false)}
        title={state?.title || ''}
        size="sm"
        footer={
          state ? (
            <div className="flex justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => settle(false)}>
                {state.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={state.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {state.confirmLabel || 'Confirm'}
              </Button>
            </div>
          ) : null
        }
      >
        {state?.body && <p className="font-body-md text-sm text-[var(--color-ink-muted)]">{state.body}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
};

/** Call within a component tree wrapped in <ConfirmProvider> (mounted once in App.tsx). */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm() must be called within a ConfirmProvider.');
  }
  return ctx;
}
