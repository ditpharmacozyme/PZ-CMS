import React, { useRef, useState } from 'react';
import { uploadToDrive } from '../../utils/adsUpload';
import { Button } from '../ui/Button';
import type { AdFile } from '../../types';

export interface AdsUploadedItem { name: string; files: AdFile[] }

interface AdsUploadZoneProps {
  setId: string;
  folderId: string;
  onUploaded: (items: AdsUploadedItem[]) => void;
}

type Status = 'queued' | 'uploading' | 'done' | 'error';
interface Entry {
  id: number;
  file: File;
  status: Status;
  progress: number;
  result?: AdFile;
  carousel: boolean;
}

const MAX_CONCURRENT = 3;
const UNSUPPORTED = "That file type isn't supported here.";

const isImage = (f: File) => f.type.startsWith('image/');
const isSupported = (f: File) =>
  isImage(f) ||
  f.type.startsWith('video/') ||
  f.type === 'application/pdf' ||
  f.type === 'application/zip' ||
  f.type === 'application/x-zip-compressed' ||
  /\.(zip|pdf)$/i.test(f.name);
const baseName = (n: string) => n.replace(/\.[^./\\]+$/, '') || n;

export const AdsUploadZone: React.FC<AdsUploadZoneProps> = ({ folderId, onUploaded }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<File[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const entriesRef = useRef<Entry[]>([]);
  const nextId = useRef(1);
  const reported = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (next: Entry[]) => {
    entriesRef.current = next;
    setEntries(next);
  };
  const patch = (id: number, p: Partial<Entry>) =>
    commit(entriesRef.current.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const buildItems = (): AdsUploadedItem[] => {
    const items: AdsUploadedItem[] = [];
    const slides: Entry[] = entriesRef.current.filter((e) => e.carousel && e.status === 'done');
    let slidesPlaced = false;
    for (const e of entriesRef.current) {
      if (e.status !== 'done' || !e.result) continue;
      if (e.carousel) {
        if (slidesPlaced) continue;
        slidesPlaced = true;
        items.push({ name: baseName(slides[0].file.name), files: slides.map((s) => s.result!) });
      } else {
        items.push({ name: baseName(e.file.name), files: [e.result] });
      }
    }
    return items;
  };

  const report = () => {
    if (reported.current) return;
    const items = buildItems();
    if (items.length === 0) return;
    reported.current = true;
    onUploaded(items);
  };

  const pump = () => {
    const cur = entriesRef.current;
    let active = cur.filter((e) => e.status === 'uploading').length;
    const starting: Entry[] = [];
    for (const e of cur) {
      if (active >= MAX_CONCURRENT) break;
      if (e.status === 'queued') {
        starting.push(e);
        active++;
      }
    }
    if (starting.length === 0) {
      const busy = cur.some((e) => e.status === 'queued' || e.status === 'uploading');
      if (!busy && cur.length > 0 && cur.every((e) => e.status === 'done')) report();
      return;
    }
    const ids = new Set(starting.map((s) => s.id));
    commit(cur.map((e) => (ids.has(e.id) ? { ...e, status: 'uploading' as Status, progress: 0 } : e)));
    for (const e of starting) {
      uploadToDrive(e.file, folderId, (fraction) => patch(e.id, { progress: fraction }))
        .then((result) => patch(e.id, { status: 'done', progress: 1, result }))
        .catch(() => patch(e.id, { status: 'error' }))
        .finally(pump);
    }
  };

  const enqueue = (files: File[], carousel: boolean) => {
    reported.current = false;
    const added: Entry[] = files.map((file) => ({
      id: nextId.current++,
      file,
      status: 'queued',
      progress: 0,
      carousel: carousel && isImage(file),
    }));
    commit([...entriesRef.current, ...added]);
    pump();
  };

  const receive = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const ok = files.filter(isSupported);
    setMessage(ok.length < files.length ? UNSUPPORTED : null);
    if (ok.length === 0) return;
    if (ok.filter(isImage).length >= 2) setPending(ok);
    else enqueue(ok, false);
  };

  const choose = (carousel: boolean) => {
    const files = pending;
    setPending(null);
    if (files) enqueue(files, carousel);
  };

  const retry = (id: number) => {
    reported.current = false;
    patch(id, { status: 'queued', progress: 0 });
    pump();
  };

  const idle = entries.length > 0 && !entries.some((e) => e.status === 'queued' || e.status === 'uploading');
  const hasError = entries.some((e) => e.status === 'error');
  const hasDone = entries.some((e) => e.status === 'done');

  const finish = () => {
    report();
    commit([]);
  };

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div
        data-testid="ads-drop-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); receive(e.dataTransfer?.files); }}
        className={`flex flex-col items-center gap-2 text-center p-6 rounded-xl border-2 border-dashed transition-colors min-w-0 ${
          dragging ? 'border-[#4f46e5] bg-[#f4f4f3]' : 'border-[#e9e9e7] bg-[#fafafa]'
        }`}
      >
        <span className="material-symbols-outlined text-3xl text-[#5f5f5b]">cloud_upload</span>
        <p className="text-sm text-[#1b1c1a]">Drag and drop images, videos, PDFs or zip files here</p>
        <Button variant="primary" onClick={() => inputRef.current?.click()}>Choose files</Button>
        <input
          ref={inputRef}
          data-testid="ads-file-input"
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,application/pdf,.pdf,.zip,application/zip"
          onChange={(e) => { receive(e.target.files); e.target.value = ''; }}
        />
      </div>

      {message && <p role="alert" className="text-xs text-[var(--color-danger)]">{message}</p>}

      {pending && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-[#e9e9e7] bg-white">
          <p className="text-sm font-semibold text-[#1b1c1a]">Save as:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" fullWidth onClick={() => choose(false)}>Separate ads</Button>
            <Button variant="primary" fullWidth onClick={() => choose(true)}>One carousel</Button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2 min-w-0">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 p-2.5 rounded-lg border border-[#efefed] bg-white min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0 truncate text-xs text-[#1b1c1a]">{e.file.name}</span>
                {e.status === 'done' && <span className="text-[11px] font-semibold text-emerald-700">Uploaded</span>}
                {e.status === 'queued' && <span className="text-[11px] text-[#5f5f5b]">Waiting</span>}
                {e.status === 'error' && (
                  <>
                    <span className="text-[11px] font-semibold text-[var(--color-danger)]">Upload failed</span>
                    <Button size="sm" onClick={() => retry(e.id)}>Retry</Button>
                  </>
                )}
              </div>
              {(e.status === 'uploading' || e.status === 'queued') && (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${e.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(e.progress * 100)}
                  className="h-1.5 rounded-full bg-[#efefed] overflow-hidden"
                >
                  <div className="h-full bg-[#4f46e5] transition-all" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {idle && hasError && hasDone && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={finish}>Done</Button>
        </div>
      )}
    </div>
  );
};
