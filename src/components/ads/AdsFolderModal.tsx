import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import type { AdAudience, AdKind } from '../../types';

export interface AdsProgramValues { name: string; brandId: string; kind: AdKind }
export interface AdsSetValues { name: string; audience: string; programId: string | null }

interface AdsFolderModalProps {
  mode: 'program' | 'set';
  initial?: Partial<AdsProgramValues & AdsSetValues>;
  audiences: (string | AdAudience)[];
  brands?: { id: string; name: string }[];
  programs?: { id: string; name: string }[];
  canManageAudiences?: boolean;
  onAddAudience?: (name: string) => void | Promise<unknown>;
  onSave: (values: any) => void | Promise<unknown>;
  onClose: () => void;
}

const ADD = '__add__';
const KINDS: { value: AdKind; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'program', label: 'Program' },
];

export const AdsFolderModal: React.FC<AdsFolderModalProps> = ({
  mode, initial, audiences, brands = [], programs = [], canManageAudiences, onAddAudience, onSave, onClose,
}) => {
  const audienceNames = audiences.map((a) => (typeof a === 'string' ? a : a.name));
  const [name, setName] = useState(initial?.name ?? '');
  const [brandId, setBrandId] = useState(initial?.brandId ?? 'shared');
  const [kind, setKind] = useState<AdKind>(initial?.kind ?? 'course');
  const [audience, setAudience] = useState(initial?.audience ?? audienceNames[0] ?? '');
  const [programId, setProgramId] = useState(initial?.programId ?? '');
  const [newAudience, setNewAudience] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addAudience = async () => {
    const n = newAudience.trim();
    if (!n) return;
    await onAddAudience?.(n);
    setAudience(n);
    setNewAudience('');
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === 'program') await onSave({ name: trimmed, brandId, kind });
      else await onSave({ name: trimmed, audience, programId: programId || null });
    } finally {
      setSaving(false);
    }
  };

  const audienceOptions = audienceNames.map((a) => ({ value: a, label: a }));
  if (canManageAudiences) audienceOptions.push({ value: ADD, label: 'Add audience…' });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'program' ? (initial?.name ? 'Edit course' : 'New course') : (initial?.name ? 'Edit ad set' : 'New ad set')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4 min-w-0" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField label="Name" required value={name} onChange={(v) => { setName(v); if (error) setError(null); }} error={error} autoFocus />
        {mode === 'program' ? (
          <>
            <SelectField
              label="Brand"
              value={brandId}
              onChange={setBrandId}
              options={[{ value: 'shared', label: 'Shared' }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
            />
            <SelectField label="Type" value={kind} onChange={(v) => setKind(v as AdKind)} options={KINDS} />
          </>
        ) : (
          <>
            <SelectField label="Audience" value={audience} onChange={setAudience} options={audienceOptions} />
            {audience === ADD && (
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <TextField label="New audience name" value={newAudience} onChange={setNewAudience} />
                </div>
                <Button variant="primary" onClick={() => void addAudience()}>Add</Button>
              </div>
            )}
            <SelectField
              label="Course"
              value={programId}
              onChange={setProgramId}
              options={[{ value: '', label: 'No course' }, ...programs.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </>
        )}
      </form>
    </Modal>
  );
};
