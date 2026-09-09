# Delete-Cascade for Stored Files — Item 7

**Date:** 2026-09-09
**Branch:** `feat/delete-cascade`, forked from `main` @ `ecd8b01`
**Status:** Approved design, pending implementation plan

---

## 1. Goal

User-reported gap (item 7 from the deployed-CMS review): **deleting a record in
the app does not delete its uploaded file from Google Drive or Supabase Storage.**
Every deleted post, template, asset, and research document leaves its image / PDF
/ doc / CSV behind as an orphan.

Make every delete path in the app also remove the record's backing file, safely
(don't remove a file another record still uses; don't fight the post Undo toast;
don't lose track of a file when the delete call fails), and add an admin tool to
clean up the orphans that already exist.

## 2. Current state

### Where files live

| Entity | Field(s) | Backend | Stored value shape |
|---|---|---|---|
| `ResearchItem` | `driveFileId`, `driveViewUrl` | Google Drive (any type: CSV/XLSX/MD/DOCX/PDF) | explicit `driveFileId` |
| `Post` | `visualUrl` | Google Drive image, **or** a hand-pasted external URL | `https://lh3.googleusercontent.com/d/<id>` |
| `PostTemplate` | `imagePreview` | Google Drive image, or external URL | same as post |
| `BrandAsset` | `url`, `storagePath?` | Supabase Storage (`brand-assets` bucket) when `storagePath` is set; older rows on Drive or a pasted link | `storagePath` = `assets/<uuid>-<name>`; `url` = public URL |
| `BrandConfig` | `logoUrl?` | Supabase Storage (`brand-assets/logos/`) or a `/logos/*.png` repo asset | — (out of scope, §9) |
| `ContentBankItem` | — | no file | — |

### Where deletes happen

All delete handlers are in `src/App.tsx`, except the post handler which is in
`src/hooks/usePosts.ts`:

- `usePosts.handleDeletePost(postId, onDeletedModalCallback?)` — shows a **5s Undo
  toast** that restores the row. Bulk delete (`CalendarView` multi-select) calls
  this once per id.
- `App.handleDeleteTemplate` / `handleDeleteAsset` / `handleDeleteResearchItem` /
  `handleDeleteBankItem` — one-liners: drop from state, call `deleteRemote*`,
  toast. No Undo.

### Constraints discovered

- **The Apps Script has no delete action.** `src/data/googleAppsScript.ts`'s
  `doPost` handles upload / research-upload / sheet-sync / email / trigger only.
  Drive deletes require adding an action **and the user redeploying the Web App**
  (as was just done for `REMINDER_RPC_SECRET`).
- `DriveApp` can move a file to Trash (`setTrashed(true)`, auto-purged after 30
  days) but cannot hard-delete without the Advanced Drive Service. **Decision:
  use `setTrashed(true)`** — simplest, no extra redeploy step, and the 30-day
  window is a useful recovery net.
- Supabase Storage deletes need **no new infrastructure**: the client calls
  `supabase.storage.from('brand-assets').remove([path])` with the existing
  authenticated session; the `"brand-assets authenticated delete"` policy shipped
  in migration `0021`.
- The `/api/appscript/proxy` serverless relay already authenticates the caller's
  Supabase session and forwards an arbitrary `{ action, ... }` payload to the
  Apps Script. A new `deleteFile` action rides through it unchanged.

## 3. Approach

**Client-side cleanup module + centralized cascade in `App.tsx`.** One new module
owns file identification, reference-counting, backend routing, and a localStorage
retry queue. `App.tsx`'s delete handlers call it. The post handler schedules the
file-delete after the Undo window and cancels it if the user hits Undo.

Rejected alternatives:

- **Server-side cascade endpoint** (`api/files/cascade-delete.ts`, service-role,
  refcount as a real DB query). Cannot coordinate with the client-side Undo
  toast; the refcount data is already in client memory; the Apps Script call just
  moves server-side without getting simpler. More infra for no real gain here.
- **Minimal inline helper** (no refcount, no queue). Under-delivers — a
  duplicated-then-deleted post would break its twin's image, and a failed delete
  would silently orphan.

## 4. File reference model

```ts
// src/utils/fileCleanup.ts

export type FileRef =
  | { backend: 'drive'; fileId: string }
  | { backend: 'supabase'; path: string };

export function identifyFile(input: {
  url?: string;
  storagePath?: string;
  driveFileId?: string;
}): FileRef | null;
```

Resolution order:

1. `storagePath` present → `{ backend: 'supabase', path: storagePath }`
2. `driveFileId` present → `{ backend: 'drive', fileId: driveFileId }`
3. else parse `url`:
   - matches `…supabase.co/storage/v1/object/public/brand-assets/<path>` →
     `{ backend: 'supabase', path }`
   - matches any of `lh3.googleusercontent.com/d/<id>`,
     `drive.google.com/…[?&]id=<id>`, `drive.google.com/file/d/<id>/` →
     `{ backend: 'drive', fileId: id }`
   - anything else (hand-pasted external URL, `/logos/PZ_Logo.png` repo asset,
     empty string, `data:` URL) → **`null`** (not ours — never touch)

Two `FileRef`s are equal iff same `backend` and same `fileId` / `path`.

## 5. The cleanup module

```ts
// Delete now. Never throws — a failure enqueues the ref for retry.
export function cascadeFileDelete(ref: FileRef): Promise<void>;

// After delayMs, run cascadeFileDelete(ref) IFF shouldProceed() is still true.
// Used for the post Undo window: shouldProceed re-checks reference-counting at
// fire time, so an undone delete (post back in state) naturally cancels it.
export function scheduleFileDelete(
  ref: FileRef,
  delayMs: number,
  shouldProceed: () => boolean,
): void;

// Drain the retry queue. Called once from App on mount.
export function flushFailedDeletes(): Promise<void>;

// Reference check — see §6.
export function isFileStillReferenced(
  ref: FileRef,
  records: {
    posts: Post[];
    templates: PostTemplate[];
    assets: BrandAsset[];
    research: ResearchItem[];
  },
  excludeId: string,
): boolean;
```

Backend routing inside `cascadeFileDelete`:

- `drive` → `POST /api/appscript/proxy` with
  `{ payload: { action: 'deleteFile', fileId } }` and the current session bearer
  token (same pattern as `uploadImage.ts`).
- `supabase` → `supabase.storage.from('brand-assets').remove([path])`.

A "file already gone" result (Drive returns a not-found error string; Storage
`remove` on a missing key resolves without error) counts as **success**.

Any real failure (network, auth, 5xx, Apps Script error) → push `ref` onto the
retry queue (§7), resolve without throwing. Callers are always fire-and-forget.

## 6. Reference counting

`isFileStillReferenced` re-runs `identifyFile` over every record in `records`
whose `id !== excludeId`, across all four collections, and returns `true` if any
produced a `FileRef` equal to `ref`.

Callers pass the **live React state arrays** from `App.tsx`, so the check always
reflects the current data (including a still-present duplicate post, or a post
that reuses a template's `imagePreview` URL).

If `isFileStillReferenced` is `true`, the caller skips the file delete entirely —
the record is removed, the file stays.

## 7. Retry queue

- localStorage key: `pharmacozyme_brandops_pending_file_deletes_v1`
- value: `FileRef[]`, deduped by ref-equality
- `cascadeFileDelete` and the fired `scheduleFileDelete` timer push on failure.
- `flushFailedDeletes()` runs once from a `useEffect` in `App.tsx` on mount:
  reads the queue, retries each ref via the same routing as `cascadeFileDelete`,
  removes the ones that now succeed (or are already-gone), leaves the rest.
- Cap: 200 entries. On overflow, drop oldest first.
- All reads/writes wrapped in try/catch (private-mode / quota) — a broken queue
  must never break app startup.

## 8. Wiring into delete handlers

All cascade calls live in `App.tsx`.

| Handler | Change |
|---|---|
| `handleDeleteTemplate` | after `deleteRemoteTemplate(id)`: `ref = identifyFile({ url: tpl.imagePreview })`; if `ref && !isFileStillReferenced(ref, records, id)` → `cascadeFileDelete(ref)` |
| `handleDeleteAsset` | same, `identifyFile({ url: asset.url, storagePath: asset.storagePath })` |
| `handleDeleteResearchItem` | same, `identifyFile({ driveFileId: item.driveFileId })` |
| `handleDeleteBankItem` | no change; add a `// no file field` comment |
| `handleDeletePost` (via `usePosts`) | see below |

**Post + Undo coordination.** `usePosts.handleDeletePost` gains one optional
param: `onAfterDelete?: (removed: Post) => void`, passed from `App.tsx`. No Undo
hook is needed — the timing works itself out:

- On delete: `usePosts` calls `onAfterDelete(removed)` after removing the row.
  `App`'s implementation computes the ref (returns early if `null`), then calls
  `scheduleFileDelete(ref, 6000, shouldProceed)` where
  `shouldProceed = () => !isFileStillReferenced(ref, recordsRef.current, removed.id)`.
- `recordsRef` is a `useRef` in `App` updated every render with the current
  `{ posts, templates, assets, research }`. When the timer fires 6s later,
  `shouldProceed` reads the *latest* lists.
- On **Undo** (existing `usePosts` toast `onClick`): the post goes back into
  `posts` state → `recordsRef.current.posts` includes it again → at fire time
  `isFileStillReferenced` is `true` → `shouldProceed()` is `false` → the delete
  is skipped. Same mechanism also covers "user re-uses that image on a new post
  within 6s".
- The 6s delay is longer than the 5s toast so the timer never races the toast.

Bulk delete routes through the same `handleDeletePost`, so each selected post
gets its own scheduled delete with its own `shouldProceed`.

## 9. Apps Script additions

`src/data/googleAppsScript.ts` — two new `doPost` actions. **The user redeploys
the Web App once** after this ships (no Advanced Service, no new scopes beyond
the Drive access the script already has).

```js
} else if (action === "deleteFile") {
  return handleDeleteFile(data);        // { fileId }
} else if (action === "listManagedFiles") {
  return handleListManagedFiles();      // no args
}
```

- `handleDeleteFile({ fileId })`: `DriveApp.getFileById(fileId).setTrashed(true)`,
  wrapped so a missing/already-trashed file returns
  `{ status: "success", alreadyGone: true }` rather than throwing.
- `handleListManagedFiles()`: walks `"Pharmacozyme CMS Uploads"` (flat) and
  `"Research & Plans"` (recurse brand/type subfolders), returns
  `{ status: "success", files: [{ id, name, folder, createdMs, sizeBytes }] }`.
  Skips trashed files.

## 10. Sweep tool — Settings → "Storage cleanup"

New admin-only panel (gated like Team management — non-admins don't see it).

- **"Scan for orphaned files"** runs two lists in parallel:
  - Drive: proxy `{ action: 'listManagedFiles' }`
  - Supabase: `supabase.storage.from('brand-assets').list()` for `assets/` and
    `logos/` (paginate if needed)
- Cross-reference: for each returned file build its `FileRef`, then check against
  `identifyFile` over **all** live records — `posts`, `templates`, `assets`,
  `research`, plus every `brand.logoUrl` from `useBrands()`. A file whose ref
  matches nothing is an orphan.
- Render orphans in a table: name, backend, folder, age, size; per-row checkbox +
  "select all".
- **"Move selected to Trash / remove"** → each selected ref through
  `cascadeFileDelete` (no refcount — the scan already proved they're unreferenced).
- Show counts ("14 files scanned, 3 orphaned"). Empty state: "No orphaned files."

Estimated ~200-line component + the two list helpers.

## 11. Testing

Unit (Vitest, `globals: false`):

- `identifyFile` — table across every URL shape: `lh3.googleusercontent.com/d/`,
  `drive.google.com/file/d/<id>/`, `drive.google.com/uc?…id=<id>`, supabase public
  URL, `/logos/x.png`, `''`, `data:…`, random external → correct ref or `null`.
- `isFileStillReferenced` — same file on two posts; file on a template + a post;
  unique file; supabase path shared by two assets; `excludeId` respected.
- retry queue — push on failure; dedupe; drain on flush; already-gone treated as
  success; 200-cap evicts oldest.
- `scheduleFileDelete` — `shouldProceed` returning `false` prevents the delete;
  returning `true` fires `cascadeFileDelete` after `delayMs` (fake timers);
  `cascadeFileDelete` mocked.
- delete handlers — mock the cleanup module; assert `cascadeFileDelete` /
  `scheduleFileDelete` called with the right ref, and **not** called when
  `isFileStillReferenced` returns `true`.
- sweep reconciliation — given a file list + a record set, the expected rows come
  back as orphans.

Not unit-testable (verified by the user's redeploy + a live delete, same as every
prior Apps Script change): `handleDeleteFile`, `handleListManagedFiles`.

### Accepted risks

**Cross-client reference-count race (accepted).** Reference counting reads the
*local* client's React state. If teammate B creates a record reusing file X and
teammate A deletes their record referencing X within A's 6-second window — before
Supabase realtime delivers B's row to A — A's client will delete X. Drive's
30-day Trash absorbs this; **Supabase Storage `remove()` is permanent**, so a
Supabase-hosted file lost this way is unrecoverable except by re-upload. The
Storage Cleanup sweep is the only backstop. A server-side cascade (spec §3,
rejected) would close this but cannot coordinate with the client Undo toast.
Revisit if Supabase-hosted asset churn grows.

## 12. Out of scope

- **Brand logo replacement cleanup** — old logo orphaned when a new one is
  uploaded in the Brand Kit editor. Brands are never deleted, so this is only the
  replace path; small separate follow-up.
- Google **Sheets** rows from the post-sync spreadsheet — a mirror, not storage.
- Retroactive migration of old Drive-hosted assets into Supabase Storage.
- Hard delete / Advanced Drive Service — using Trash instead.
- Content-bank file support — no file field exists today.
