import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { adSetOptions, thumbnailUrl } from '../../utils/adsModel';
import { fileLink } from './downloadFiles';
import type { AdCreative, AdSet } from '../../types';

export type AdsCreativeChanges = Partial<Pick<AdCreative, 'name' | 'sourceUrl' | 'setId' | 'hidden'>>;

interface AdsCreativeModalProps {
  creative: AdCreative;
  sets: AdSet[];
  /** Courses, for labelling ad sets "Course / Set". */
  programs?: { id: string; name: string }[];
  onSave: (changes: AdsCreativeChanges) => void | Promise<unknown>;
  onClose: () => void;
}

export const AdsCreativeModal: React.FC<AdsCreativeModalProps> = ({ creative, sets, programs = [], onSave, onClose }) => {
  const [name, setName] = useState(creative.name);
  const originalUrl = (creative.sourceUrl ?? '').trim();
  const [sourceUrl, setSourceUrl] = useState(creative.sourceUrl ?? '');
  const [setId, setSetId] = useState(creative.setId);
  const [hidden, setHidden] = useState(creative.hidden);
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedUrl = sourceUrl.trim();
  const urlInvalid = trimmedUrl !== '' && !/^https?:\/\//i.test(trimmedUrl);
  const showsImages = creative.format === 'image' || creative.format === 'carousel';

  const save = async () => {
    if (!trimmedName || urlInvalid) return;
    const changes: AdsCreativeChanges = {};
    if (trimmedName !== creative.name) changes.name = trimmedName;
    if (trimmedUrl !== originalUrl) changes.sourceUrl = trimmedUrl;
    if (setId !== creative.setId) changes.setId = setId;
    if (hidden !== creative.hidden) changes.hidden = hidden;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
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
          <Button variant="primary" loading={saving} disabled={!trimmedName || urlInvalid} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 min-w-0">
        <div className="flex flex-col gap-3 min-w-0">
          {showsImages ? (
            <div className={creative.files.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
              {creative.files.filter((f) => f.mimeType.startsWith('image/')).slice(0, 4).map((f) => (
                <img
                  key={f.driveFileId}
                  src={thumbnailUrl(f, 640)}
                  alt={f.name}
                  className="w-full max-h-64 object-contain rounded-lg bg-[#f4f4f3] border border-[#efefed]"
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 p-4 rounded-lg bg-[#f4f4f3] border border-[#efefed]" data-testid="file-tile">
              <span className="material-symbols-outlined text-2xl text-[#5f5f5b]">
                {creative.format === 'video' ? 'movie' : creative.format === 'zip' ? 'folder_zip' : 'description'}
              </span>
              <span className="min-w-0 truncate text-sm text-[#1b1c1a]">{creative.files[0]?.name ?? creative.name}</span>
            </div>
          )}
          <ul className="flex flex-col gap-1.5 min-w-0">
            {creative.files.map((f) => {
              const link = fileLink(f);
              return (
              <li key={f.driveFileId} className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0 truncate text-xs text-[#1b1c1a]">{f.name}</span>
                <a
                  href={link.href}
                  download={link.large ? undefined : f.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.large ? 'Large file: opens in Google Drive in a new tab.' : undefined}
                  aria-label={`Download ${f.name}`}
                  className="inline-flex items-center justify-center gap-1 min-h-[38px] px-3 text-xs font-semibold text-[#4f46e5] border border-[#e9e9e7] rounded-lg hover:bg-[#f4f4f3]"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download
                </a>
              </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Source link" hint="Optional. Where the original design lives." value={sourceUrl} onChange={setSourceUrl} placeholder="https://" error={urlInvalid ? 'The link must start with http:// or https://' : null} />
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
          <SelectField label="Ad set" value={setId} onChange={setSetId} options={adSetOptions(sets, programs)} />
          <label className="flex items-center gap-2 min-h-[38px] text-sm text-[#1b1c1a] cursor-pointer">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="w-4 h-4 accent-[#4f46e5]" />
            Hide from the public ads page
          </label>
        </div>
      </div>
    </Modal>
  );
};
