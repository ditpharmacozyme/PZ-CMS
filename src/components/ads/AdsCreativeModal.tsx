import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { downloadUrl, thumbnailUrl } from '../../utils/adsModel';
import type { AdCreative, AdSet } from '../../types';

export type AdsCreativeChanges = Partial<Pick<AdCreative, 'name' | 'sourceUrl' | 'setId' | 'hidden'>>;

interface AdsCreativeModalProps {
  creative: AdCreative;
  sets: AdSet[];
  onSave: (changes: AdsCreativeChanges) => void | Promise<unknown>;
  onClose: () => void;
}

export const AdsCreativeModal: React.FC<AdsCreativeModalProps> = ({ creative, sets, onSave, onClose }) => {
  const [name, setName] = useState(creative.name);
  const [sourceUrl, setSourceUrl] = useState(creative.sourceUrl);
  const [setId, setSetId] = useState(creative.setId);
  const [hidden, setHidden] = useState(creative.hidden);
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedUrl = sourceUrl.trim();

  const save = async () => {
    if (!trimmedName) return;
    const changes: AdsCreativeChanges = {};
    if (trimmedName !== creative.name) changes.name = trimmedName;
    if (trimmedUrl !== creative.sourceUrl) changes.sourceUrl = trimmedUrl;
    if (setId !== creative.setId) changes.setId = setId;
    if (hidden !== creative.hidden) changes.hidden = hidden;
    setSaving(true);
    try { await onSave(changes); } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit ad"
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!trimmedName} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 min-w-0">
        <div className="flex flex-col gap-3 min-w-0">
          {creative.files.slice(0, 1).map((f) => (
            <img
              key={f.driveFileId}
              src={thumbnailUrl(f, 640)}
              alt={creative.name}
              className="w-full max-h-64 object-contain rounded-lg bg-[#f4f4f3] border border-[#efefed]"
            />
          ))}
          <ul className="flex flex-col gap-1.5 min-w-0">
            {creative.files.map((f) => (
              <li key={f.driveFileId} className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0 truncate text-xs text-[#1b1c1a]">{f.name}</span>
                <a
                  href={downloadUrl(f)}
                  download
                  aria-label={`Download ${f.name}`}
                  className="inline-flex items-center justify-center gap-1 min-h-[38px] px-3 text-xs font-semibold text-[#4f46e5] border border-[#e9e9e7] rounded-lg hover:bg-[#f4f4f3]"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Source link" hint="Optional. Where the original design lives." value={sourceUrl} onChange={setSourceUrl} placeholder="https://" />
          {/^https?:\/\//i.test(trimmedUrl) && (
            <a
              href={trimmedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f46e5] min-h-[38px]"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Open source file
            </a>
          )}
          <SelectField label="Ad set" value={setId} onChange={setSetId} options={sets.map((s) => ({ value: s.id, label: s.name }))} />
          <label className="flex items-center gap-2 min-h-[38px] text-sm text-[#1b1c1a] cursor-pointer">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="w-4 h-4 accent-[#4f46e5]" />
            Hide from the public ads page
          </label>
        </div>
      </div>
    </Modal>
  );
};
