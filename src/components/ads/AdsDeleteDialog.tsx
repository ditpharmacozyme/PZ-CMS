import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AdsStatus } from './AdsStatus';

export type AdsDeleteMode = 'delete-all' | 'move-to-unsorted';

interface AdsDeleteDialogProps {
  kind: 'program' | 'set';
  name: string;
  count: number;
  onChoose: (mode: AdsDeleteMode) => void | Promise<unknown>;
  onClose: () => void;
}

export const AdsDeleteDialog: React.FC<AdsDeleteDialogProps> = ({ kind, name, count, onChoose, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<AdsDeleteMode | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const choose = (mode: AdsDeleteMode) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setChosen(mode);
    const release = () => {
      busyRef.current = false;
      if (mounted.current) { setBusy(false); setChosen(null); }
    };
    try {
      Promise.resolve(onChoose(mode)).then(release, release);
    } catch {
      release();
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => { if (!busyRef.current) onClose(); }}
      title={`Delete ${kind === 'program' ? 'course' : 'ad set'} "${name}"?`}
      size="sm"
      initialFocusRef={cancelRef as React.RefObject<HTMLElement>}
    >
      <div className="flex flex-col gap-4 min-w-0">
        <p className="text-sm text-[#1b1c1a]">This will affect {count} {count === 1 ? 'ad' : 'ads'}.</p>
        <p className="text-xs text-[#5f5f5b]">Choose what should happen to the ads inside.</p>
        {busy && (
          <AdsStatus>
            {chosen === 'move-to-unsorted'
              ? `Moving ${count} ${count === 1 ? 'ad' : 'ads'} to Unsorted… this can take a minute.`
              : 'Deleting the ads and their files from Google Drive… this can take a minute.'}
          </AdsStatus>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="danger" fullWidth loading={busy && chosen === 'delete-all'} disabled={busy} onClick={() => choose('delete-all')}>Delete everything inside</Button>
          <Button variant="secondary" fullWidth loading={busy && chosen === 'move-to-unsorted'} disabled={busy} onClick={() => choose('move-to-unsorted')}>Move ads to Unsorted</Button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] px-4 py-2.5 text-xs font-label-caps font-semibold text-[#5f5f5b] hover:bg-[#f4f4f3] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
