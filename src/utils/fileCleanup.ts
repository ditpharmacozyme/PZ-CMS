import type { Post, PostTemplate, BrandAsset, ResearchItem } from '../types';
import { supabase } from '../lib/supabase';

export type FileRef =
  | { backend: 'drive'; fileId: string }
  | { backend: 'supabase'; path: string };

const SUPABASE_PUBLIC_RE = /\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?#]+)/;
const DRIVE_RES = [
  /lh3\.googleusercontent\.com\/d\/([-\w]+)/,
  /drive\.google\.com\/file\/d\/([-\w]+)/,
  /drive\.google\.com\/[^?#]*[?&].*?id=([-\w]+)/,
];

export function identifyFile(input: {
  url?: string | null;
  storagePath?: string | null;
  driveFileId?: string | null;
}): FileRef | null {
  if (input.storagePath) return { backend: 'supabase', path: input.storagePath };
  if (input.driveFileId) return { backend: 'drive', fileId: input.driveFileId };

  const url = input.url?.trim();
  if (!url || url.startsWith('data:') || url.startsWith('/')) return null;

  const sb = url.match(SUPABASE_PUBLIC_RE);
  if (sb) return { backend: 'supabase', path: decodeURIComponent(sb[1]) };

  for (const re of DRIVE_RES) {
    const m = url.match(re);
    if (m) return { backend: 'drive', fileId: m[1] };
  }
  return null;
}

export function fileRefsEqual(a: FileRef, b: FileRef): boolean {
  if (a.backend !== b.backend) return false;
  return a.backend === 'drive'
    ? a.fileId === (b as { fileId: string }).fileId
    : a.path === (b as { path: string }).path;
}

export interface CleanupRecords {
  posts: Post[];
  templates: PostTemplate[];
  assets: BrandAsset[];
  research: ResearchItem[];
}

export function isFileStillReferenced(
  ref: FileRef,
  records: CleanupRecords,
  excludeId: string,
): boolean {
  const hit = (r: FileRef | null) => r !== null && fileRefsEqual(r, ref);
  return (
    records.posts.some((p) => p.id !== excludeId && hit(identifyFile({ url: p.visualUrl }))) ||
    records.templates.some((t) => t.id !== excludeId && hit(identifyFile({ url: t.imagePreview }))) ||
    records.assets.some((a) => a.id !== excludeId && hit(identifyFile({ url: a.url, storagePath: a.storagePath }))) ||
    records.research.some((r) => r.id !== excludeId && hit(identifyFile({ driveFileId: r.driveFileId })))
  );
}

export const PENDING_DELETES_KEY = 'pharmacozyme_brandops_pending_file_deletes_v1';
const QUEUE_CAP = 200;

export function readDeleteQueue(): FileRef[] {
  try {
    const raw = localStorage.getItem(PENDING_DELETES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDeleteQueue(list: FileRef[]): void {
  try {
    localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(list.slice(-QUEUE_CAP)));
  } catch {
    /* private mode / quota — nothing we can do */
  }
}

export function enqueueFailedDelete(ref: FileRef): void {
  const q = readDeleteQueue();
  if (q.some((r) => fileRefsEqual(r, ref))) return;
  writeDeleteQueue([...q, ref]);
}

export function removeFromDeleteQueue(ref: FileRef): void {
  writeDeleteQueue(readDeleteQueue().filter((r) => !fileRefsEqual(r, ref)));
}

const GONE_RE = /not found|no item|does not exist/i;

async function deleteDrive(fileId: string): Promise<boolean> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ payload: { action: 'deleteFile', fileId } }),
  });
  if (!res.ok) return false;
  const body = await res.json().catch(() => ({}));
  const d = body?.data ?? {};
  return d.status === 'success' || d.alreadyGone === true || (typeof d.error === 'string' && GONE_RE.test(d.error));
}

async function deleteSupabase(path: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.storage.from('brand-assets').remove([path]);
  return !error || GONE_RE.test(error.message);
}

export async function cascadeFileDelete(ref: FileRef): Promise<void> {
  try {
    const ok = ref.backend === 'drive' ? await deleteDrive(ref.fileId) : await deleteSupabase(ref.path);
    if (ok) removeFromDeleteQueue(ref);
    else enqueueFailedDelete(ref);
  } catch {
    enqueueFailedDelete(ref);
  }
}

export function scheduleFileDelete(ref: FileRef, delayMs: number, shouldProceed: () => boolean): void {
  setTimeout(() => {
    if (shouldProceed()) void cascadeFileDelete(ref);
  }, delayMs);
}

export async function flushFailedDeletes(): Promise<void> {
  const queued = readDeleteQueue();
  for (const ref of queued) {
    removeFromDeleteQueue(ref);
    await cascadeFileDelete(ref);
  }
}
