import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/Field';
import { AdsUploadZone, type AdsUploadedItem } from './AdsUploadZone';
import type { AdSet } from '../../types';

interface AdsUploadPickerProps {
  sets: AdSet[];
  defaultSetId: string;
  ensureSetFolder: (setId: string) => Promise<string>;
  onUploaded: (setId: string, items: AdsUploadedItem[]) => void;
  onClose: () => void;
}

/** Step 1: choose the destination ad set. Step 2: the upload zone for that set's Drive folder. */
export const AdsUploadPicker: React.FC<AdsUploadPickerProps> = ({
  sets, defaultSetId, ensureSetFolder, onUploaded, onClose,
}) => {
  const [setId, setSetId] = useState(defaultSetId);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    setPreparing(true);
    setError(null);
    try {
      setFolderId(await ensureSetFolder(setId));
    } catch {
      setError("Couldn't prepare the Drive folder for that ad set. Please try again.");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Upload ads"
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>{folderId ? 'Done' : 'Cancel'}</Button>
          {!folderId && <Button variant="primary" loading={preparing} onClick={() => void next()}>Continue</Button>}
        </div>
      }
    >
      <div className="flex flex-col gap-4 min-w-0">
        <SelectField
          label="Ad set"
          value={setId}
          onChange={setSetId}
          disabled={!!folderId}
          options={sets.map((s) => ({ value: s.id, label: s.name }))}
        />
        {error && <p role="alert" className="text-xs text-[#b3261e]">{error}</p>}
        {folderId && (
          <AdsUploadZone setId={setId} folderId={folderId} onUploaded={(items) => onUploaded(setId, items)} />
        )}
      </div>
    </Modal>
  );
};
