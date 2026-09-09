import type { Post, PostTemplate, BrandAsset, ResearchItem } from '../types';
import { supabase } from '../lib/supabase';

export type FileRef =
  | { backend: 'drive'; fileId: string }
  | { backend: 'supabase'; path: string };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Anchor the Supabase storage-URL match to our own project host when we can
// resolve it from VITE_SUPABASE_URL, so a foreign *.supabase.co URL pasted
// into a record can't resolve against OUR bucket path. When the env var is
// absent (some test runs) fall back to matching any *.supabase.co host.
const SUPABASE_HOST = (() => {
  try {
    const u = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
    return u ? new URL(u).host : null;
  } catch {
    return null;
  }
})();

const SUPABASE_PUBLIC_RE = new RegExp(
  `^https?://${SUPABASE_HOST ? escapeRegExp(SUPABASE_HOST) : '[a-z0-9-]+\\.supabase\\.co'}` +
    '/storage/v1/object/(?:public|sign)/brand-assets/([^?#]+)',
  'i',
);

const DRIVE_RES = [
  /lh3\.googleusercontent\.com\/d\/([-\w]+)/,
  /drive\.google\.com\/file\/d\/([-\w]+)/,
  /drive\.google\.com\/[^#]*[?&]id=([-\w]+)/,
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
  if (sb) {
    let path = sb[1];
    try {
      path = decodeURIComponent(sb[1]);
    } catch {
      /* malformed %-escape — use the raw path */
    }
    return { backend: 'supabase', path };
  }

  for (const re of DRIVE_RES) {
    const m = url.match(re);
    if (m) return { backend: 'drive', fileId: m[1] };
  }
  return null;
}

export function fileRefsEqual(a: FileRef, b: FileRef): boolean {
  if (a.backend === 'drive' && b.backend === 'drive') return a.fileId === b.fileId;
  if (a.backend === 'supabase' && b.backend === 'supabase') return a.path === b.path;
  return false;
}

export interface CleanupRecords {
  posts: Post[];
  templates: PostTemplate[];
  assets: BrandAsset[];
  research: ResearchItem[];
  logoUrls: string[];
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
    records.research.some((r) => r.id !== excludeId && hit(identifyFile({ driveFileId: r.driveFileId }))) ||
    // Brand logos are never keyed by a record id, so they can't be excluded —
    // a logo reference always protects the file.
    records.logoUrls.some((u) => hit(identifyFile({ url: u })))
  );
}

export const PENDING_DELETES_KEY = 'pharmacozyme_brandops_pending_file_deletes_v1';
const QUEUE_CAP = 200;

/** Process at most this many queued refs per flushFailedDeletes() call. */
export const FLUSH_BATCH_CAP = 25;

export function readDeleteQueue(): FileRef[] {
  try {
    const raw = localStorage.getItem(PENDING_DELETES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Drop anything that isn't a well-formed FileRef — a hand-edited or
    // schema-changed localStorage value must not throw on mount.
    return parsed.filter((r): r is FileRef =>
      r && typeof r === 'object' &&
      ((r.backend === 'drive' && typeof r.fileId === 'string') ||
        (r.backend === 'supabase' && typeof r.path === 'string')));
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

/**
 * Delete a file's backing storage. Resolves `true` when the file was deleted
 * or was already gone; `false` when the delete failed and the ref was
 * enqueued for a later retry. Never throws — callers are fire-and-forget.
 */
export async function cascadeFileDelete(ref: FileRef): Promise<boolean> {
  try {
    const ok = ref.backend === 'drive' ? await deleteDrive(ref.fileId) : await deleteSupabase(ref.path);
    if (ok) {
      removeFromDeleteQueue(ref);
      return true;
    }
    enqueueFailedDelete(ref);
    return false;
  } catch {
    enqueueFailedDelete(ref);
    return false;
  }
}

/**
 * Fire a delete after `delayMs` unless `shouldProceed()` says otherwise at
 * fire time. Note: a tab closed within `delayMs` orphans the file — the
 * Storage Cleanup sweep is the recovery path for that case.
 */
export function scheduleFileDelete(ref: FileRef, delayMs: number, shouldProceed: () => boolean): void {
  setTimeout(() => {
    if (shouldProceed()) void cascadeFileDelete(ref);
  }, delayMs);
}

/**
 * Retry queued failed deletes, oldest first, at most FLUSH_BATCH_CAP per call
 * (the rest wait for the next mount) so a large backlog can't fire hundreds
 * of sequential Apps Script calls. If `getRecords` is supplied, a ref that is
 * once again referenced by a live record (a record was re-created since the
 * failure) is dropped from the queue and skipped.
 */
export async function flushFailedDeletes(getRecords?: () => CleanupRecords): Promise<void> {
  const batch = readDeleteQueue().slice(0, FLUSH_BATCH_CAP);
  for (const ref of batch) {
    if (getRecords && isFileStillReferenced(ref, getRecords(), '')) {
      removeFromDeleteQueue(ref);
      continue;
    }
    removeFromDeleteQueue(ref);
    await cascadeFileDelete(ref);
  }
}
