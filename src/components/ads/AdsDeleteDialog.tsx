import React, { useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export type AdsDeleteMode = 'delete-all' | 'move-to-unsorted';

interface AdsDeleteDialogProps {
  kind: 'program' | 'set';
  name: string;
  count: number;
  onChoose: (mode: AdsDeleteMode) => void;
  onClose: () => void;
}

export const AdsDeleteDialog: React.FC<AdsDeleteDialogProps> = ({ kind, name, count, onChoose, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Delete ${kind === 'program' ? 'course' : 'ad set'} "${name}"?`}
      size="sm"
      initialFocusRef={cancelRef as React.RefObject<HTMLElement>}
    >
      <div className="flex flex-col gap-4 min-w-0">
        <p className="text-sm text-[#1b1c1a]">This will affect {count} {count === 1 ? 'ad' : 'ads'}.</p>
        <p className="text-xs text-[#5f5f5b]">Choose what should happen to the ads inside.</p>
        <div className="flex flex-col gap-2">
          <Button variant="danger" fullWidth onClick={() => onChoose('delete-all')}>Delete everything inside</Button>
          <Button variant="secondary" fullWidth onClick={() => onChoose('move-to-unsorted')}>Move ads to Unsorted</Button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 text-xs font-label-caps font-semibold text-[#5f5f5b] hover:bg-[#f4f4f3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
