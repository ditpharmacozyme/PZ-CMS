import React, { useState } from 'react';
import { Modal, type ModalDirtyPrompt } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AdsStatus } from './AdsStatus';
import { SelectField } from '../ui/Field';
import { useConfirm } from '../ui/ConfirmDialog';
import { AdsUploadZone, type AdsUploadedItem } from './AdsUploadZone';
import { adSetOptions } from '../../utils/adsModel';
import type { AdSet } from '../../types';

interface AdsUploadPickerProps {
  sets: AdSet[];
  /** Courses, for labelling ad sets "Course / Set". */
  programs?: { id: string; name: string }[];
  defaultSetId: string;
  ensureSetFolder: (setId: string) => Promise<string>;
  onUploaded: (setId: string, items: AdsUploadedItem[]) => void;
  onClose: () => void;
}

const CLOSE_PROMPT: ModalDirtyPrompt = {
  title: 'Close while uploading?',
  body: 'Files already uploading will finish and be added. Files still waiting will not be uploaded.',
  confirmLabel: 'Close',
  cancelLabel: 'Keep uploading',
};

/** Step 1: choose the destination ad set. Step 2: the upload zone for that set's Drive folder. */
export const AdsUploadPicker: React.FC<AdsUploadPickerProps> = ({
  sets, programs = [], defaultSetId, ensureSetFolder, onUploaded, onClose,
}) => {
  const confirm = useConfirm();
  const [setId, setSetId] = useState(defaultSetId);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const closeFromFooter = async () => {
    if (busy && !(await confirm({ ...CLOSE_PROMPT }))) return;
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Upload ads"
      size="sm"
      isDirty={busy}
      dirtyPrompt={CLOSE_PROMPT}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={() => void closeFromFooter()}>{folderId ? 'Close' : 'Cancel'}</Button>
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
          options={adSetOptions(sets, programs)}
        />
        {preparing && <AdsStatus>Getting the Drive folder ready…</AdsStatus>}
        {error && <p role="alert" className="text-xs text-[#b3261e]">{error}</p>}
        {folderId && (
          <AdsUploadZone
            folderId={folderId}
            onUploaded={(items) => onUploaded(setId, items)}
            onBusyChange={setBusy}
          />
        )}
      </div>
    </Modal>
  );
};
