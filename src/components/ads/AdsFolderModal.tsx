import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import type { AdAudience, AdKind } from '../../types';

export interface AdsProgramValues { name: string; brandId: string; kind: AdKind }
export interface AdsSetValues { name: string; audience: string; programId: string | null }

interface BaseProps {
  audiences: (string | AdAudience)[];
  brands?: { id: string; name: string }[];
  programs?: { id: string; name: string }[];
  canManageAudiences?: boolean;
  onAddAudience?: (name: string) => void | Promise<unknown>;
  onClose: () => void;
}
type AdsFolderModalProps =
  | (BaseProps & { mode: 'program'; initial?: Partial<AdsProgramValues>; onSave: (v: AdsProgramValues) => void | Promise<unknown> })
  | (BaseProps & { mode: 'set'; initial?: Partial<AdsSetValues>; onSave: (v: AdsSetValues) => void | Promise<unknown> });

const ADD = '__add__';
const KINDS: { value: AdKind; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'program', label: 'Program' },
];

export const AdsFolderModal: React.FC<AdsFolderModalProps> = (props) => {
  const { audiences, brands = [], programs = [], canManageAudiences, onAddAudience, onClose } = props;
  const init = (props.initial ?? {}) as Partial<AdsProgramValues & AdsSetValues>;
  const [addedAudiences, setAddedAudiences] = useState<string[]>([]);
  const baseNames = audiences.map((a) => (typeof a === 'string' ? a : a.name));
  const audienceNames = [...baseNames, ...addedAudiences.filter((a) => !baseNames.includes(a))];

  const [name, setName] = useState(init.name ?? '');
  const [brandId, setBrandId] = useState(init.brandId ?? 'shared');
  const [kind, setKind] = useState<AdKind>(init.kind ?? 'course');
  const [audience, setAudience] = useState(init.audience ?? audienceNames[0] ?? '');
  const [programId, setProgramId] = useState(init.programId ?? '');
  const [newAudience, setNewAudience] = useState('');
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [addingAudience, setAddingAudience] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addAudience = async () => {
    const n = newAudience.trim();
    if (!n || addingAudience) return;
    setAudienceError(null);
    setAddingAudience(true);
    try {
      await onAddAudience?.(n);
      setAddedAudiences((prev) => (prev.includes(n) ? prev : [...prev, n]));
      setAudience(n);
      setNewAudience('');
    } catch {
      setAudienceError("Couldn't add that audience. Please try again.");
    } finally {
      setAddingAudience(false);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    if (props.mode === 'set' && (audience === ADD || !audience)) {
      setAudienceError(audience === ADD ? 'Add the new audience first, or pick one from the list.' : 'Please choose an audience.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (props.mode === 'program') await props.onSave({ name: trimmed, brandId, kind });
      else await props.onSave({ name: trimmed, audience, programId: programId || null });
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
      title={props.mode === 'program' ? (init.name ? 'Edit course' : 'New course') : (init.name ? 'Edit ad set' : 'New ad set')}
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
        {props.mode === 'program' ? (
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
            <SelectField
              label="Audience"
              value={audience}
              onChange={(v) => { setAudience(v); setAudienceError(null); }}
              options={audienceOptions}
              error={audience !== ADD ? audienceError : null}
            />
            {audience === ADD && (
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <TextField
                    label="New audience name"
                    value={newAudience}
                    onChange={setNewAudience}
                    error={audienceError}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void addAudience();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="primary" loading={addingAudience} onClick={() => void addAudience()}>Add</Button>
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
