# Delete-Cascade for Stored Files — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every record-delete in the app also remove the record's uploaded file from Google Drive or Supabase Storage, without orphaning shared files or fighting the post Undo toast, plus an admin tool to clean up files orphaned before this shipped.

**Architecture:** One client-side module (`src/utils/fileCleanup.ts`) owns file identification, reference-counting against live React state, backend routing (Apps Script proxy for Drive, `supabase.storage` for the bucket), and a localStorage retry queue. `App.tsx`'s delete handlers call it. The post handler defers its file-delete 6s and re-checks reference-counting at fire time, so hitting Undo naturally cancels it. Two new Apps Script actions (`deleteFile`, `listManagedFiles`) require the user to redeploy the Web App once.

**Tech Stack:** React 19, TypeScript, Vite, Vitest 4 (`globals: false`, jsdom), `@supabase/supabase-js` v2, Google Apps Script (Web App via `/api/appscript/proxy`).

**Spec:** `docs/superpowers/specs/2026-09-09-delete-cascade-design.md`

## Global Constraints

- Gate every task: `npx tsc --noEmit && npx vitest run && npm run build` — all green, output pristine (stray warnings are findings). The pre-existing `>500 kB` chunk-size advisory is acceptable; nothing else.
- Vitest config is `globals: false` — every test file imports `{ describe, it, expect, vi }` from `vitest`.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- `identifyFile` returns `null` for anything not provably ours: hand-pasted external URLs, `/logos/*.png` repo assets, empty strings, `data:` URLs. A `null` ref means "never touch this file".
- Drive deletes use `setTrashed(true)` (30-day auto-purge), never hard delete. No Advanced Drive Service.
- Supabase Storage bucket is `brand-assets`; folders in use are `assets/` and `logos/`. The `"brand-assets authenticated delete"` RLS policy already exists (migration `0021`).
- `cascadeFileDelete` and `scheduleFileDelete` are fire-and-forget: they never throw to the caller. Failures go to the retry queue.
- Retry queue localStorage key: `pharmacozyme_brandops_pending_file_deletes_v1`. Cap 200 entries, drop oldest on overflow. All localStorage access wrapped in try/catch.
- `UserRole` values are `'Admin' | 'Manager' | 'Editor' | 'Viewer'`. The sweep tool is `activeTeammate?.userRole === 'Admin'` only.

---

### Task 1: `FileRef` type + `identifyFile`

**Files:**
- Create: `src/utils/fileCleanup.ts`
- Create: `src/utils/fileCleanup.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  ```ts
  export type FileRef =
    | { backend: 'drive'; fileId: string }
    | { backend: 'supabase'; path: string };

  export function identifyFile(input: {
    url?: string | null;
    storagePath?: string | null;
    driveFileId?: string | null;
  }): FileRef | null;

  export function fileRefsEqual(a: FileRef, b: FileRef): boolean;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/fileCleanup.test.ts
import { describe, it, expect } from 'vitest';
import { identifyFile, fileRefsEqual } from './fileCleanup';

describe('identifyFile', () => {
  it('prefers explicit storagePath', () => {
    expect(identifyFile({ storagePath: 'assets/abc-x.pdf', url: 'https://lh3.googleusercontent.com/d/ZZZ' }))
      .toEqual({ backend: 'supabase', path: 'assets/abc-x.pdf' });
  });

  it('prefers explicit driveFileId over url', () => {
    expect(identifyFile({ driveFileId: 'FILE123', url: 'https://example.com/x.png' }))
      .toEqual({ backend: 'drive', fileId: 'FILE123' });
  });

  it('parses a supabase public storage url', () => {
    expect(identifyFile({ url: 'https://sgevopyvcsclkasvekah.supabase.co/storage/v1/object/public/brand-assets/assets/9a2f-doc.pdf' }))
      .toEqual({ backend: 'supabase', path: 'assets/9a2f-doc.pdf' });
  });

  it('parses lh3.googleusercontent.com/d/<id>', () => {
    expect(identifyFile({ url: 'https://lh3.googleusercontent.com/d/1A2B3C' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('parses drive.google.com/file/d/<id>/view', () => {
    expect(identifyFile({ url: 'https://drive.google.com/file/d/1A2B3C/view?usp=sharing' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('parses drive.google.com/uc?...id=<id>', () => {
    expect(identifyFile({ url: 'https://drive.google.com/uc?export=download&id=1A2B3C' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('returns null for a repo logo path', () => {
    expect(identifyFile({ url: '/logos/PZ_Logo.png' })).toBeNull();
  });

  it('returns null for a hand-pasted external url', () => {
    expect(identifyFile({ url: 'https://images.unsplash.com/photo-123' })).toBeNull();
  });

  it('returns null for empty / data / nullish input', () => {
    expect(identifyFile({ url: '' })).toBeNull();
    expect(identifyFile({ url: 'data:image/png;base64,iVBOR' })).toBeNull();
    expect(identifyFile({})).toBeNull();
    expect(identifyFile({ url: null, storagePath: null, driveFileId: null })).toBeNull();
  });
});

describe('fileRefsEqual', () => {
  it('matches same backend + id', () => {
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'drive', fileId: 'X' })).toBe(true);
  });
  it('rejects different id or backend', () => {
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'drive', fileId: 'Y' })).toBe(false);
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'supabase', path: 'X' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/fileCleanup.test.ts`
Expected: FAIL — `identifyFile` / `fileRefsEqual` not exported.

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/fileCleanup.ts

export type FileRef =
  | { backend: 'drive'; fileId: string }
  | { backend: 'supabase'; path: string };

const SUPABASE_PUBLIC_RE = /\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?#]+)/;
const DRIVE_RES = [
  /lh3\.googleusercontent\.com\/d\/([-\w]+)/,
  /drive\.google\.com\/file\/d\/([-\w]+)/,
  /drive\.google\.com\/[^?#]*[?&]id=([-\w]+)/,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/fileCleanup.test.ts`
Expected: PASS (13 assertions).

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/fileCleanup.ts src/utils/fileCleanup.test.ts
git commit -m "feat(cleanup): FileRef model + identifyFile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `isFileStillReferenced`

**Files:**
- Modify: `src/utils/fileCleanup.ts`
- Modify: `src/utils/fileCleanup.test.ts`

**Interfaces:**
- Consumes: `identifyFile`, `fileRefsEqual`, `FileRef` (Task 1); `Post`, `PostTemplate`, `BrandAsset`, `ResearchItem` from `src/types.ts`.
- Produces:
  ```ts
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
  ): boolean;
  ```
  Scans every record whose `id !== excludeId` across all four collections, runs `identifyFile` on its file field(s), and returns `true` if any resulting ref `fileRefsEqual`s `ref`. Post → `identifyFile({ url: p.visualUrl })`; template → `identifyFile({ url: t.imagePreview })`; asset → `identifyFile({ url: a.url, storagePath: a.storagePath })`; research → `identifyFile({ driveFileId: r.driveFileId })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/utils/fileCleanup.test.ts
import { isFileStillReferenced } from './fileCleanup';
import type { Post, PostTemplate, BrandAsset, ResearchItem } from '../types';

const emptyRecords = { posts: [], templates: [], assets: [], research: [] };
const post = (id: string, visualUrl: string): Post => ({ id, visualUrl } as Post);
const tpl = (id: string, imagePreview: string): PostTemplate => ({ id, imagePreview } as PostTemplate);
const asset = (id: string, url: string, storagePath?: string): BrandAsset => ({ id, url, storagePath } as BrandAsset);
const research = (id: string, driveFileId: string): ResearchItem => ({ id, driveFileId } as ResearchItem);

describe('isFileStillReferenced', () => {
  const driveRef = { backend: 'drive' as const, fileId: 'SHARED' };
  const driveUrl = 'https://lh3.googleusercontent.com/d/SHARED';

  it('true when another post still uses the same drive file', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl), post('p2', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(true);
  });

  it('false when only the excluded record used it', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(false);
  });

  it('true across collections — a template reuses a post image', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl)], templates: [tpl('t1', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(true);
  });

  it('matches a supabase asset by storagePath', () => {
    const sbRef = { backend: 'supabase' as const, path: 'assets/x.pdf' };
    const records = { ...emptyRecords, assets: [asset('a1', 'https://cdn/x', 'assets/x.pdf'), asset('a2', 'https://cdn/x', 'assets/x.pdf')] };
    expect(isFileStillReferenced(sbRef, records, 'a1')).toBe(true);
  });

  it('ignores records whose file is an external / null ref', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl), post('p2', 'https://images.unsplash.com/y')] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`isFileStillReferenced` not exported)

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 3: Implement**

```ts
// append to src/utils/fileCleanup.ts
import type { Post, PostTemplate, BrandAsset, ResearchItem } from '../types';

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
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/fileCleanup.ts src/utils/fileCleanup.test.ts
git commit -m "feat(cleanup): reference-counting across live records

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Retry queue

**Files:**
- Modify: `src/utils/fileCleanup.ts`
- Modify: `src/utils/fileCleanup.test.ts`

**Interfaces:**
- Consumes: `FileRef`, `fileRefsEqual` (Task 1).
- Produces (exported for tests; used internally by Task 4):
  ```ts
  export const PENDING_DELETES_KEY = 'pharmacozyme_brandops_pending_file_deletes_v1';
  export function readDeleteQueue(): FileRef[];
  export function enqueueFailedDelete(ref: FileRef): void;   // dedupes; caps at 200 (drops oldest)
  export function removeFromDeleteQueue(ref: FileRef): void;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// append to src/utils/fileCleanup.test.ts
import { beforeEach } from 'vitest';
import {
  PENDING_DELETES_KEY, readDeleteQueue, enqueueFailedDelete, removeFromDeleteQueue,
} from './fileCleanup';

describe('retry queue', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(readDeleteQueue()).toEqual([]);
  });

  it('enqueues and reads back', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'A' }]);
  });

  it('dedupes by ref-equality', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toHaveLength(1);
  });

  it('removes a specific ref', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    enqueueFailedDelete({ backend: 'supabase', path: 'p/b' });
    removeFromDeleteQueue({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'supabase', path: 'p/b' }]);
  });

  it('caps at 200, dropping oldest', () => {
    for (let i = 0; i < 205; i++) enqueueFailedDelete({ backend: 'drive', fileId: `F${i}` });
    const q = readDeleteQueue();
    expect(q).toHaveLength(200);
    expect(q[0]).toEqual({ backend: 'drive', fileId: 'F5' });
    expect(q[199]).toEqual({ backend: 'drive', fileId: 'F204' });
  });

  it('survives a corrupt payload', () => {
    localStorage.setItem(PENDING_DELETES_KEY, '{not json');
    expect(readDeleteQueue()).toEqual([]);
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'A' }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 3: Implement**

```ts
// append to src/utils/fileCleanup.ts
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
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/fileCleanup.ts src/utils/fileCleanup.test.ts
git commit -m "feat(cleanup): localStorage retry queue for failed deletes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `cascadeFileDelete`, `scheduleFileDelete`, `flushFailedDeletes`

**Files:**
- Modify: `src/utils/fileCleanup.ts`
- Modify: `src/utils/fileCleanup.test.ts`

**Interfaces:**
- Consumes: `FileRef`, queue helpers (Task 3); `supabase` from `src/lib/supabase.ts`.
- Produces:
  ```ts
  export function cascadeFileDelete(ref: FileRef): Promise<void>;          // never throws
  export function scheduleFileDelete(ref: FileRef, delayMs: number, shouldProceed: () => boolean): void;
  export function flushFailedDeletes(): Promise<void>;
  ```

**Context:**
- Drive delete: `POST /api/appscript/proxy` with body `{ payload: { action: 'deleteFile', fileId } }` and header `Authorization: Bearer <token>` where the token is `(await supabase.auth.getSession()).data.session?.access_token`. The proxy wraps the Apps Script JSON under `body.data`. Treat these as **success** (no enqueue): `response.ok` AND (`body.data?.status === 'success'` OR `body.data?.alreadyGone` OR a `body.data?.error` string matching `/not found|no item|does not exist/i`).
- Supabase delete: `await supabase.storage.from('brand-assets').remove([path])`. Success when `error` is null OR `error.message` matches `/not found|does not exist/i`.
- `scheduleFileDelete` uses `setTimeout`; on fire, if `shouldProceed()` is truthy call `cascadeFileDelete(ref)`, else do nothing. Do not return a handle.
- `flushFailedDeletes`: read the queue, `await cascadeFileDelete` each entry sequentially; `cascadeFileDelete` already re-enqueues on failure and this task adds a `removeFromDeleteQueue(ref)` call at the top of a successful path. Simplest correct approach: snapshot the queue, `removeFromDeleteQueue(ref)` for each, then `await cascadeFileDelete(ref)` (which re-adds only on failure).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/utils/fileCleanup.test.ts
import { afterEach } from 'vitest';
import { cascadeFileDelete, scheduleFileDelete, flushFailedDeletes } from './fileCleanup';

const mockRemove = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    storage: { from: () => ({ remove: (...a: unknown[]) => mockRemove(...a) }) },
  },
}));

describe('cascadeFileDelete', () => {
  beforeEach(() => { localStorage.clear(); mockRemove.mockReset(); vi.restoreAllMocks(); });
  afterEach(() => vi.unstubAllGlobals());

  it('supabase: calls storage.remove with the path, no enqueue on success', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    await cascadeFileDelete({ backend: 'supabase', path: 'assets/x.pdf' });
    expect(mockRemove).toHaveBeenCalledWith(['assets/x.pdf']);
    expect(readDeleteQueue()).toEqual([]);
  });

  it('supabase: enqueues on a real error', async () => {
    mockRemove.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await cascadeFileDelete({ backend: 'supabase', path: 'assets/x.pdf' });
    expect(readDeleteQueue()).toEqual([{ backend: 'supabase', path: 'assets/x.pdf' }]);
  });

  it('supabase: "not found" counts as success', async () => {
    mockRemove.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    await cascadeFileDelete({ backend: 'supabase', path: 'assets/x.pdf' });
    expect(readDeleteQueue()).toEqual([]);
  });

  it('drive: posts the deleteFile action, no enqueue on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { status: 'success' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await cascadeFileDelete({ backend: 'drive', fileId: 'D1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payload).toEqual({ action: 'deleteFile', fileId: 'D1' });
    expect(readDeleteQueue()).toEqual([]);
  });

  it('drive: enqueues on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    await cascadeFileDelete({ backend: 'drive', fileId: 'D1' });
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'D1' }]);
  });

  it('never throws even if fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(cascadeFileDelete({ backend: 'drive', fileId: 'D1' })).resolves.toBeUndefined();
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'D1' }]);
  });
});

describe('scheduleFileDelete', () => {
  beforeEach(() => { localStorage.clear(); mockRemove.mockReset(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('skips the delete when shouldProceed() is false', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    scheduleFileDelete({ backend: 'supabase', path: 'assets/x.pdf' }, 6000, () => false);
    await vi.advanceTimersByTimeAsync(6000);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('runs the delete when shouldProceed() is true', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    scheduleFileDelete({ backend: 'supabase', path: 'assets/x.pdf' }, 6000, () => true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(mockRemove).toHaveBeenCalledWith(['assets/x.pdf']);
  });
});

describe('flushFailedDeletes', () => {
  beforeEach(() => { localStorage.clear(); mockRemove.mockReset(); });

  it('retries queued entries and clears the ones that succeed', async () => {
    enqueueFailedDelete({ backend: 'supabase', path: 'assets/ok.pdf' });
    enqueueFailedDelete({ backend: 'supabase', path: 'assets/still-broken.pdf' });
    mockRemove.mockImplementation((paths: string[]) =>
      Promise.resolve(paths[0] === 'assets/ok.pdf' ? { error: null } : { error: { message: 'network down' } }));
    await flushFailedDeletes();
    expect(readDeleteQueue()).toEqual([{ backend: 'supabase', path: 'assets/still-broken.pdf' }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 3: Implement**

```ts
// append to src/utils/fileCleanup.ts
import { supabase } from '../lib/supabase';

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
```

- [ ] **Step 4: Run — expect PASS** (full file)

Run: `npx vitest run src/utils/fileCleanup.test.ts`

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/fileCleanup.ts src/utils/fileCleanup.test.ts
git commit -m "feat(cleanup): backend routing, scheduled delete, queue flush

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Apps Script `deleteFile` + `listManagedFiles` actions

**Files:**
- Modify: `src/data/googleAppsScript.ts`

**Interfaces:**
- Consumes: nothing in code (the string is a template pasted into Apps Script by the user).
- Produces: two new `doPost` actions the proxy can forward:
  - `{ action: 'deleteFile', fileId }` → `{ status: 'success' }` or `{ status: 'success', alreadyGone: true }` or `{ status: 'error', error }`
  - `{ action: 'listManagedFiles' }` → `{ status: 'success', files: [{ id, name, folder, createdMs, sizeBytes }] }`

**Context:** `GOOGLE_APPS_SCRIPT_CODE` is a single backtick-template string. The `doPost` dispatcher is an `if/else if` chain ending in `throw new Error("Unknown action requested: " + action);`. Add the two branches before that `else`, and add the two handler functions near `handleUploadResearchFile`. The two managed folders are `DRIVE_FOLDER_NAME` (`"Pharmacozyme CMS Uploads"`, flat) and `"Research & Plans"` (nested `{brand}/{type}`).

- [ ] **Step 1: Add the dispatcher branches**

In `doPost`, immediately before `} else {\n      throw new Error("Unknown action requested: " + action);`:

```js
    } else if (action === "deleteFile") {
      return handleDeleteFile(data);
    } else if (action === "listManagedFiles") {
      return handleListManagedFiles();
```

- [ ] **Step 2: Add `handleDeleteFile`**

Insert after the `handleUploadResearchFile` function:

```js
/**
 * Move a Drive file to Trash (auto-purged after ~30 days). Missing or
 * already-trashed files are reported as alreadyGone rather than throwing,
 * so the CMS retry queue treats them as done.
 */
function handleDeleteFile(data) {
  if (!data.fileId) {
    throw new Error("Missing fileId in payload.");
  }
  try {
    var file = DriveApp.getFileById(data.fileId);
    if (file.isTrashed()) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", alreadyGone: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    file.setTrashed(true);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // getFileById throws for a nonexistent / permanently-removed id.
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", alreadyGone: true, note: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 3: Add `handleListManagedFiles`**

Insert after `handleDeleteFile`:

```js
/**
 * List every non-trashed file the CMS created: the flat "Pharmacozyme CMS
 * Uploads" folder plus every file under "Research & Plans/**". Used by the
 * app's Storage Cleanup sweep to find orphans.
 */
function handleListManagedFiles() {
  var out = [];

  function pushFile(file, folderLabel) {
    if (file.isTrashed()) return;
    out.push({
      id: file.getId(),
      name: file.getName(),
      folder: folderLabel,
      createdMs: file.getDateCreated().getTime(),
      sizeBytes: file.getSize()
    });
  }

  function walk(folder, label) {
    var files = folder.getFiles();
    while (files.hasNext()) pushFile(files.next(), label);
    var subs = folder.getFolders();
    while (subs.hasNext()) {
      var sub = subs.next();
      walk(sub, label + "/" + sub.getName());
    }
  }

  var uploads = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (uploads.hasNext()) walk(uploads.next(), DRIVE_FOLDER_NAME);

  var research = DriveApp.getFoldersByName("Research & Plans");
  if (research.hasNext()) walk(research.next(), "Research & Plans");

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", files: out }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 4: Update the script's INSTRUCTIONS header**

In the leading comment block of `GOOGLE_APPS_SCRIPT_CODE`, add a line after the step about `REMINDER_RPC_SECRET`:

```
 * 15. AFTER updating this script (delete-cascade release): click Deploy ->
 *     "Manage deployments" -> edit the active deployment -> "New version" ->
 *     Deploy. This activates the deleteFile / listManagedFiles actions the
 *     app's delete buttons and Storage Cleanup panel need.
```

- [ ] **Step 5: Gate + commit**

The script string is not executed by tests; `tsc`/`build` just confirm the template literal still parses.

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/data/googleAppsScript.ts
git commit -m "feat(appscript): deleteFile + listManagedFiles actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire cascade into `App.tsx` delete handlers + post Undo timing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/usePosts.ts`
- Modify: `src/components/ResearchPlans.tsx` (delete-confirm copy only)
- Create: `src/App.fileCleanup.test.tsx`

**Interfaces:**
- Consumes: `identifyFile`, `isFileStillReferenced`, `cascadeFileDelete`, `scheduleFileDelete`, `flushFailedDeletes`, `CleanupRecords`, `FileRef` (Tasks 1–4).
- Produces: no new exports. `usePosts` return shape unchanged; its `usePosts(...)` call gains a 3rd arg.

**Context:**
- `usePosts` is called at `src/App.tsx:163` as `usePosts(showToast, activeTeammate)`. `handleDeletePost` lives at `src/hooks/usePosts.ts:144`.
- App already holds `templates`, `assets`, `researchItems` state and `brands` from `useBrands()`.
- App's delete one-liners: `handleDeleteTemplate` (`:360`), `handleDeleteAsset` (`:365`), `handleDeleteResearchItem` (`:381`).

- [ ] **Step 1: Add the `onAfterDelete` hook to `usePosts`**

`src/hooks/usePosts.ts` — change the signature and thread the callback:

```ts
export function usePosts(
  showToast: (msg: string, action?: ToastAction, duration?: number, variant?: 'success' | 'error') => void,
  activeTeammate: TeamMember | null,
  onAfterDelete?: (removed: Post) => void,
) {
```

In `handleDeletePost`, right after `if (removed) {`:

```ts
    if (removed) {
      onAfterDelete?.(removed);
```

(leave everything else in that block unchanged.)

- [ ] **Step 2: Build the cleanup wiring in `App.tsx`**

After the `researchItems` state declaration and before the persist effects, add:

```tsx
import {
  identifyFile, isFileStillReferenced, cascadeFileDelete, scheduleFileDelete, flushFailedDeletes,
} from './utils/fileCleanup';
import type { CleanupRecords } from './utils/fileCleanup';

// ...inside the component, after templates/assets/researchItems state:
const recordsRef = useRef<CleanupRecords>({ posts: [], templates: [], assets: [], research: [] });
useEffect(() => {
  recordsRef.current = { posts, templates, assets, research: researchItems };
});

useEffect(() => { void flushFailedDeletes(); }, []);

// Delete the record's backing file unless another record still points at it.
const cascadeFor = (
  file: Parameters<typeof identifyFile>[0],
  recordId: string,
  opts?: { deferMs?: number },
) => {
  const ref = identifyFile(file);
  if (!ref) return;
  const stillUsed = () => isFileStillReferenced(ref, recordsRef.current, recordId);
  if (opts?.deferMs) {
    scheduleFileDelete(ref, opts.deferMs, () => !stillUsed());
  } else if (!stillUsed()) {
    void cascadeFileDelete(ref);
  }
};
```

- [ ] **Step 3: Call `cascadeFor` from each delete handler**

```tsx
// handleDeleteTemplate (:360) — after deleteRemoteTemplate(id):
const removed = templates.find((t) => t.id === id);
if (removed) cascadeFor({ url: removed.imagePreview }, id);

// handleDeleteAsset (:365) — after deleteRemoteAsset(id):
const removed = assets.find((a) => a.id === id);
if (removed) cascadeFor({ url: removed.url, storagePath: removed.storagePath }, id);

// handleDeleteResearchItem (:381) — it already computes `removed`; after deleteRemoteResearchItem(id):
if (removed) cascadeFor({ driveFileId: removed.driveFileId }, id);
```

- [ ] **Step 4: Wire the post `onAfterDelete`**

Change the `usePosts` call at `src/App.tsx:163`:

```tsx
} = usePosts(showToast, activeTeammate, (removed) => {
  cascadeFor({ url: removed.visualUrl }, removed.id, { deferMs: 6000 });
});
```

- [ ] **Step 5: Update the research delete-confirm copy**

`src/components/ResearchPlans.tsx` — the `confirm({ ... body: 'This does not delete the file from Drive.' ...})` call: change the body to `'The file is also moved to Drive Trash (recoverable for 30 days).'`

- [ ] **Step 6: Write the integration test**

```tsx
// src/App.fileCleanup.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cleanup from './utils/fileCleanup';

// This test targets the cascadeFor decision logic by exercising the exported
// primitives the way App wires them — a focused unit test of the contract,
// not a full App render (App pulls in Supabase, routing, etc).
describe('App delete-cascade wiring contract', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('defers a post file-delete and cancels it when the post is restored', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(cleanup, 'cascadeFileDelete').mockResolvedValue();
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    const ref = cleanup.identifyFile({ url: 'https://lh3.googleusercontent.com/d/POSTIMG' })!;

    // schedule as App does, reading a mutable records ref
    cleanup.scheduleFileDelete(ref, 6000, () => !cleanup.isFileStillReferenced(ref, records, 'p1'));

    // user hits Undo before 6s: the post (with its image) is back
    records.posts = [{ id: 'p1', visualUrl: 'https://lh3.googleusercontent.com/d/POSTIMG' } as never];
    await vi.advanceTimersByTimeAsync(6000);

    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('deletes a template image when nothing else references it', () => {
    const spy = vi.spyOn(cleanup, 'cascadeFileDelete').mockResolvedValue();
    const ref = cleanup.identifyFile({ url: 'https://lh3.googleusercontent.com/d/TPLIMG' })!;
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    if (!cleanup.isFileStillReferenced(ref, records, 't1')) void cleanup.cascadeFileDelete(ref);
    expect(spy).toHaveBeenCalledWith(ref);
  });
});
```

- [ ] **Step 7: Run + gate + commit**

```bash
npx vitest run src/App.fileCleanup.test.tsx
npx tsc --noEmit && npx vitest run && npm run build
git add src/App.tsx src/hooks/usePosts.ts src/components/ResearchPlans.tsx src/App.fileCleanup.test.tsx
git commit -m "feat(cleanup): cascade file-delete from every record delete handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Storage Cleanup sweep panel

**Files:**
- Create: `src/utils/orphanScan.ts`
- Create: `src/utils/orphanScan.test.ts`
- Create: `src/components/StorageCleanupPanel.tsx`
- Modify: `src/components/GoogleAppsScriptHub.tsx`
- Modify: `src/App.tsx` (pass records + activeTeammate to `GoogleAppsScriptHub`)

**Interfaces:**
- Consumes: `FileRef`, `identifyFile`, `fileRefsEqual`, `cascadeFileDelete`, `CleanupRecords` (Tasks 1–4); `supabase`; `useBrands`.
- Produces:
  ```ts
  // src/utils/orphanScan.ts
  export interface ManagedFile {
    ref: FileRef;
    name: string;
    location: string;     // "Pharmacozyme CMS Uploads" | "brand-assets/assets" | ...
    createdMs?: number;
    sizeBytes?: number;
  }
  export function findOrphans(
    files: ManagedFile[],
    records: CleanupRecords,
    logoUrls: string[],
  ): ManagedFile[];
  ```

- [ ] **Step 1: Write the failing test for `findOrphans`**

```ts
// src/utils/orphanScan.test.ts
import { describe, it, expect } from 'vitest';
import { findOrphans, type ManagedFile } from './orphanScan';
import type { CleanupRecords } from './fileCleanup';

const empty: CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
const drive = (id: string, name: string): ManagedFile => ({ ref: { backend: 'drive', fileId: id }, name, location: 'Pharmacozyme CMS Uploads' });
const sb = (path: string): ManagedFile => ({ ref: { backend: 'supabase', path }, name: path.split('/').pop()!, location: 'brand-assets' });

describe('findOrphans', () => {
  it('flags a drive file no record points at', () => {
    expect(findOrphans([drive('A', 'a.png')], empty, [])).toHaveLength(1);
  });

  it('keeps a drive file a post still uses', () => {
    const records = { ...empty, posts: [{ id: 'p1', visualUrl: 'https://lh3.googleusercontent.com/d/A' } as never] };
    expect(findOrphans([drive('A', 'a.png')], records, [])).toEqual([]);
  });

  it('keeps a supabase file referenced by a brand logo url', () => {
    const logoUrl = 'https://x.supabase.co/storage/v1/object/public/brand-assets/logos/med-q.png';
    expect(findOrphans([sb('logos/med-q.png')], empty, [logoUrl])).toEqual([]);
  });

  it('flags a supabase file with no referrer', () => {
    expect(findOrphans([sb('assets/junk.pdf')], empty, [])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/utils/orphanScan.test.ts`

- [ ] **Step 3: Implement `findOrphans`**

```ts
// src/utils/orphanScan.ts
import { identifyFile, isFileStillReferenced, fileRefsEqual, type FileRef, type CleanupRecords } from './fileCleanup';

export interface ManagedFile {
  ref: FileRef;
  name: string;
  location: string;
  createdMs?: number;
  sizeBytes?: number;
}

export function findOrphans(
  files: ManagedFile[],
  records: CleanupRecords,
  logoUrls: string[],
): ManagedFile[] {
  const logoRefs = logoUrls
    .map((u) => identifyFile({ url: u }))
    .filter((r): r is FileRef => r !== null);

  return files.filter((f) => {
    if (isFileStillReferenced(f.ref, records, ' none ')) return false;
    if (logoRefs.some((r) => fileRefsEqual(r, f.ref))) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/utils/orphanScan.test.ts`

- [ ] **Step 5: Build `StorageCleanupPanel.tsx`**

```tsx
// src/components/StorageCleanupPanel.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrands } from '../context/BrandsContext';
import { cascadeFileDelete, type FileRef, type CleanupRecords } from '../utils/fileCleanup';
import { findOrphans, type ManagedFile } from '../utils/orphanScan';

interface Props {
  records: CleanupRecords;
}

async function proxyAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function listDriveFiles(): Promise<ManagedFile[]> {
  const res = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: await proxyAuthHeaders(),
    body: JSON.stringify({ payload: { action: 'listManagedFiles' } }),
  });
  const body = await res.json().catch(() => ({}));
  const files: Array<{ id: string; name: string; folder: string; createdMs: number; sizeBytes: number }> = body?.data?.files ?? [];
  return files.map((f) => ({
    ref: { backend: 'drive', fileId: f.id } as FileRef,
    name: f.name, location: f.folder, createdMs: f.createdMs, sizeBytes: f.sizeBytes,
  }));
}

async function listBucketFiles(): Promise<ManagedFile[]> {
  if (!supabase) return [];
  const out: ManagedFile[] = [];
  for (const folder of ['assets', 'logos']) {
    let offset = 0;
    // paginate 100 at a time
    for (;;) {
      const { data, error } = await supabase.storage.from('brand-assets').list(folder, { limit: 100, offset });
      if (error || !data || data.length === 0) break;
      for (const item of data) {
        if (item.id === null) continue; // sub-folder placeholder
        out.push({
          ref: { backend: 'supabase', path: `${folder}/${item.name}` },
          name: item.name,
          location: `brand-assets/${folder}`,
          createdMs: item.created_at ? Date.parse(item.created_at) : undefined,
          sizeBytes: (item.metadata as { size?: number } | null)?.size,
        });
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return out;
}

export const StorageCleanupPanel: React.FC<Props> = ({ records }) => {
  const { brands } = useBrands();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<number | null>(null);
  const [orphans, setOrphans] = useState<ManagedFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyOf = (f: ManagedFile) => (f.ref.backend === 'drive' ? `d:${f.ref.fileId}` : `s:${f.ref.path}`);

  const scan = async () => {
    setScanning(true); setError(null); setSelected(new Set());
    try {
      const [drive, bucket] = await Promise.all([listDriveFiles(), listBucketFiles()]);
      const all = [...drive, ...bucket];
      const logoUrls = Object.values(brands).map((b) => b.logoUrl).filter((u): u is string => Boolean(u));
      const found = findOrphans(all, records, logoUrls);
      setScanned(all.length);
      setOrphans(found);
      setSelected(new Set(found.map(keyOf)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const removeSelected = async () => {
    setDeleting(true);
    const targets = orphans.filter((f) => selected.has(keyOf(f)));
    for (const f of targets) await cascadeFileDelete(f.ref);
    setOrphans((prev) => prev.filter((f) => !selected.has(keyOf(f))));
    setSelected(new Set());
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display-xl text-base font-bold text-[#1b1c1a]">Storage cleanup</h3>
        <p className="font-body-md text-sm text-[#5f5f5b]">
          Find files in Google Drive and Supabase Storage that no post, template, asset, research item, or brand logo points at any more.
        </p>
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        className="bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
      >
        {scanning ? 'Scanning…' : 'Scan for orphaned files'}
      </button>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {scanned !== null && !scanning && (
        <p className="font-body-md text-sm text-[#5f5f5b]">
          {scanned} file{scanned === 1 ? '' : 's'} scanned · {orphans.length} orphaned
        </p>
      )}

      {orphans.length > 0 && (
        <>
          <div className="border border-[#e9e9e7] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f4f4f3] text-[#5f5f5b]">
                <tr>
                  <th className="w-8 p-2"></th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Name</th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Location</th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Backend</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((f) => {
                  const k = keyOf(f);
                  return (
                    <tr key={k} className="border-t border-[#e9e9e7]">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(k)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(k); else next.delete(k);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 text-[#1b1c1a]">{f.name}</td>
                      <td className="p-2 text-[#5f5f5b]">{f.location}</td>
                      <td className="p-2 text-[#5f5f5b]">{f.ref.backend === 'drive' ? 'Drive' : 'Supabase'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={removeSelected}
            disabled={deleting || selected.size === 0}
            className="bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
          >
            {deleting ? 'Removing…' : `Move ${selected.size} to Trash / remove`}
          </button>
          <p className="font-body-md text-xs text-[#5f5f5b]">
            Drive files go to Trash (recoverable ~30 days); Supabase files are removed immediately.
          </p>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 6: Mount it in `GoogleAppsScriptHub.tsx`**

- Widen the props:
  ```tsx
  interface GoogleAppsScriptHubProps {
    posts: Post[];
    onUploadComplete?: (newUrl: string) => void;
    cleanupRecords: import('../utils/fileCleanup').CleanupRecords;
    isAdmin: boolean;
  }
  ```
- Add `'cleanup'` to the `activeTab` union: `useState<'script' | 'tester' | 'guide' | 'backend' | 'cleanup'>('script')`.
- Add a tab button next to the others: `{isAdmin && <button onClick={() => setActiveTab('cleanup')} className={/* match sibling tab classes */}>Storage Cleanup</button>}`
- Render the panel: `{activeTab === 'cleanup' && isAdmin && <StorageCleanupPanel records={cleanupRecords} />}` — import `StorageCleanupPanel` at the top.

- [ ] **Step 7: Pass the props from `App.tsx`**

At `src/App.tsx:624`:

```tsx
<GoogleAppsScriptHub
  posts={posts}
  onUploadComplete={(newUrl) => showToast(`Asset uploaded! Direct URL: ${newUrl}`)}
  cleanupRecords={{ posts, templates, assets, research: researchItems }}
  isAdmin={activeTeammate?.userRole === 'Admin'}
/>
```

- [ ] **Step 8: Run + gate + commit**

```bash
npx vitest run src/utils/orphanScan.test.ts
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/orphanScan.ts src/utils/orphanScan.test.ts src/components/StorageCleanupPanel.tsx src/components/GoogleAppsScriptHub.tsx src/App.tsx
git commit -m "feat(cleanup): admin Storage Cleanup sweep panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Full gate at branch tip**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; all tests pass; build OK (only the pre-existing chunk-size advisory).

- [ ] **Step 2: Grep for missed delete paths**

Run: `git grep -n "deleteRemote\|onDelete" src/`
Confirm every entity delete that has a file field (`posts`, `templates`, `assets`, `research`) routes through a `cascadeFor` call added in Task 6. Content-bank has no file field — confirm it's untouched. Note any delete call site not covered as a finding for the controller.

- [ ] **Step 3: Controller browser check (after the user redeploys the Apps Script)**

Against production with migrations live:
- Upload an image to a new **template**, then delete the template → the Drive file is trashed (check Drive Trash).
- Upload a PDF **asset** (Supabase), delete it → the object is gone from the `brand-assets/assets` folder (Supabase dashboard).
- Add a **post** with an uploaded image, delete it, **hit Undo within 5s** → post returns, image still loads; delete again, let the toast expire → file trashed ~6s later.
- **Duplicate** a post (shares the image), delete one copy → image still loads on the twin (reference-count held).
- **Research** item delete → Drive file trashed; confirm dialog now says "recoverable for 30 days".
- Integrations → **Storage Cleanup** (as an Admin) → "Scan for orphaned files" lists the two known QA test files; select + remove → gone.
- As a non-Admin, confirm the Storage Cleanup tab is not shown.

- [ ] **Step 4: Record results in the SDD ledger**

Write pass/fail per check. Any failure → one bundled fix wave, then re-verify.

---

## Self-Review

**Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §4 File reference model (`identifyFile`, ref equality) | Task 1 |
| §5 cleanup module API (`cascadeFileDelete`, `scheduleFileDelete`, `flushFailedDeletes`) | Task 4 |
| §6 Reference counting (`isFileStillReferenced`) | Task 2 |
| §7 Retry queue | Task 3 |
| §8 Wiring into delete handlers + post/Undo timing | Task 6 |
| §9 Apps Script `deleteFile` + `listManagedFiles` + redeploy note | Task 5 |
| §10 Sweep tool (`findOrphans`, `StorageCleanupPanel`, admin gate) | Task 7 |
| §11 Testing | Tasks 1–4, 6, 7 (unit); Task 8 (manual) |
| §12 Out of scope | Not implemented, by design |

**Placeholder scan:** every code step carries real code; no "TBD"/"handle errors"/"similar to Task N". Test steps show the assertions.

**Type consistency:** `FileRef`, `CleanupRecords`, `ManagedFile` names are stable across Tasks 1–7. `identifyFile` input shape (`{ url?, storagePath?, driveFileId? }`, all nullable) matches every call site in Tasks 2, 6, 7. `cascadeFileDelete(ref)` / `scheduleFileDelete(ref, delayMs, shouldProceed)` signatures match the spec §5 revision and the Task 6 call sites. `usePosts` third arg `onAfterDelete?: (removed: Post) => void` matches the Task 6 wiring.
