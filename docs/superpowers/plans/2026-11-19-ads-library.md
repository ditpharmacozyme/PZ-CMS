# Ads Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Ads Library tab where the team stores ad creatives in Google Drive, organized Course → Ad Set → Creative, and shares revocable public links (any level, plus one standing `/ads` page) that non-logged-in people can search and download from.

**Architecture:** Three Supabase tables plus an audience list and a share-link table hold structure and metadata; file bytes live only in Drive, in a folder tree that mirrors the app (`Ads Library / <Course> / <Ad Set>`). The browser uploads straight to Drive through a resumable-upload session that Apps Script creates (bytes never pass through Vercel). Public pages read through two `security definer` RPCs granted to `anon`; no table is readable by `anon`.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres, RPC, Realtime), Google Apps Script (embedded template in `src/data/googleAppsScript.ts`), Vitest + Testing Library, Tailwind, existing `Modal`/`useConfirm` primitives.

**Spec:** `docs/superpowers/specs/2026-11-19-ads-library-design.md`

## Global Constraints

- File bytes must never pass through Vercel (4.5MB body cap); Drive only, no Supabase Storage for ad files (spec Constraints, Anti-goals).
- Light theme only; palette guard applies; `#f0fdf4` is retired (project rule).
- Public side is read-only, anon-key, RPC-only. `anon` gets **no** table access. Public payloads must not include `created_by` / `uploaded_by` (my call; spec silent).
- Drive layout: `Ads Library / <Course> / <Ad Set> / files`; course-less ad sets sit directly under the root; "Unsorted" is a root-level ad set (spec Decisions/My calls).
- Files are set to "anyone with the link can view"; revoke/hide control only what the app lists (spec Decisions).
- Hiding affects only the standing `/ads` page; hiding a parent hides everything under it; direct share links ignore `hidden` (spec My calls).
- Revoked or unknown tokens return an empty result identical to each other (no information leak).
- Deleting a course or ad set offers exactly two choices — delete everything inside (Drive trash) or move creatives to "Unsorted" — and shows how many creatives are affected (spec Decisions).
- Tags are picked from lists: brand (existing `brands`), kind (`course|workshop|webinar|program`), audience (admin-editable list); format/date/uploader are automatic (spec My calls).
- All tests (`npm test`) and `npm run build` must pass before pushing; migrations are applied to Supabase manually and the Apps Script is redeployed manually (project history).
- Use `cmd.exe /c "..."` for multi-command shell chains on Windows.

## Review Focus

- **Hidden parent vs direct link.** A creative inside a hidden ad set is absent from `/ads` but present on that creative's own share link — Task 1 SQL check, Task 2 `isVisibleOnStandingLink` tests.
- **Revoked / unknown token.** Both return the same empty result, never an error that reveals the token existed — Task 1 SQL check, Task 3 mapper test.
- **Same file name uploaded twice into one ad set.** Both are kept as separate creatives, nothing is overwritten — Task 5 test.
- **Deleting a course with creatives when Drive is unreachable.** App rows are removed, the user is told the Drive folder couldn't be trashed, nothing crashes — Task 6 test.
- **Search edge input:** empty/whitespace query shows everything; "Nurses", "nurses", and "núrses" match the same; no-match shows a clear "No ads match" state — Task 2 and Task 8 tests.

---

## File Structure

- `supabase/migrations/0027_ads_library.sql` — tables, RLS, realtime, seed, two public RPCs.
- `src/types.ts` — new ad types (modify).
- `src/utils/adsModel.ts` — pure helpers: format detection, Drive URL builders, visibility/scope filtering, search.
- `src/utils/adsStorage.ts` — row mappers, remote CRUD + realtime, public RPC wrappers.
- `src/utils/adsDrive.ts` — client wrapper over `/api/appscript/proxy` for the new Drive actions.
- `src/utils/adsUpload.ts` — direct resumable upload to Drive.
- `src/data/googleAppsScript.ts` — new Apps Script actions (modify).
- `src/hooks/useAdsLibrary.ts` — state + all mutations, keeping Drive and DB in step.
- `src/components/ads/` — `AdsGallery.tsx` (shared grid/select/download), `AdsSearchBar.tsx`, `AdsUploadZone.tsx`, `AdsFolderModal.tsx`, `AdsCreativeModal.tsx`, `AdsShareModal.tsx`, `AdsDeleteDialog.tsx`, `PublicAdsPage.tsx`.
- `src/components/AdsLibrary.tsx` — the logged-in tab.
- `src/utils/publicRoute.ts` — URL → public route parsing.
- `src/main.tsx`, `src/App.tsx`, `src/components/SideNav.tsx`, `src/components/CommandPalette.tsx`, `vercel.json` — wiring (modify/create).

---

## Task 1: Types and migration

**Files:**
- Modify: `src/types.ts`
- Create: `supabase/migrations/0027_ads_library.sql`

**Interfaces:**
- Produces (all exported from `src/types.ts`, used by every later task):
  - `type AdKind = 'course' | 'workshop' | 'webinar' | 'program'`
  - `type AdFormat = 'image' | 'carousel' | 'video' | 'zip' | 'other'`
  - `interface AdFile { driveFileId: string; name: string; mimeType: string; sizeBytes: number }`
  - `interface AdProgram { id: string; name: string; brandId: string; kind: AdKind; driveFolderId: string; hidden: boolean; createdBy: string; createdAt: string; updatedAt: string }`
  - `interface AdSet { id: string; programId: string | null; name: string; audience: string; driveFolderId: string; hidden: boolean; isSystem: boolean; createdBy: string; createdAt: string; updatedAt: string }`
  - `interface AdCreative { id: string; setId: string; name: string; format: AdFormat; files: AdFile[]; sourceUrl: string; hidden: boolean; uploadedBy: string; createdAt: string; updatedAt: string }`
  - `interface AdAudience { id: string; name: string; sortOrder: number }`
  - `interface AdShareLink { token: string; level: 'program' | 'set' | 'creative'; targetId: string; label: string; createdBy: string; createdAt: string; revokedAt: string | null }`
  - `interface AdsSnapshot { programs: AdProgram[]; sets: AdSet[]; creatives: AdCreative[] }`

- [ ] **Step 1: Add the types** above to `src/types.ts` (after the `Prompt` interfaces), and extend `ActivityType`/`entityType` is NOT needed (no audit entries in v1).

- [ ] **Step 2: Write the migration** `0027_ads_library.sql`, idempotent (`if not exists`, `drop policy if exists`), following `0025_tutorials_library.sql`:
  - `ad_programs(id text pk, name text not null, brand_id text not null default 'shared', kind text not null default 'course' check (kind in ('course','workshop','webinar','program')), drive_folder_id text not null default '', hidden boolean not null default false, created_by text not null default '', created_at/updated_at timestamptz)`.
  - `ad_sets(id text pk, program_id text null, name text not null, audience text not null default '', drive_folder_id text not null default '', hidden boolean not null default false, is_system boolean not null default false, created_by …)`; index on `program_id`.
  - `ad_creatives(id text pk, set_id text not null, name text not null, format text not null default 'image' check (format in ('image','carousel','video','zip','other')), files jsonb not null default '[]', source_url text not null default '', hidden boolean not null default false, uploaded_by text not null default '', created_at/updated_at)`; index on `set_id`.
  - `ad_audiences(id uuid pk default gen_random_uuid(), name text not null, sort_order int not null default 0)` + unique index on `lower(name)`; seed `Doctors, Nurses, Pharmacists, Students, All healthcare professionals`.
  - `ad_share_links(token text pk, level text not null check (level in ('program','set','creative')), target_id text not null, label text not null default '', created_by text not null default '', created_at timestamptz default now(), revoked_at timestamptz null)`.
  - Seed the system set: `insert into ad_sets (id, name, is_system) values ('ads-unsorted','Unsorted',true) on conflict (id) do nothing;`
  - RLS enabled on all five tables with authenticated read + authenticated write policies (same shape as 0025). **No policy for `anon`.**
  - Realtime publication `do $$` block for all five tables (same shape as 0025).
  - `ads_public_library() returns jsonb` — `language sql stable security definer set search_path = public`. Visible set = non-hidden programs; non-hidden sets whose `program_id` is null or in a visible program; non-hidden creatives whose `set_id` is in a visible set. Returns `{programs, sets, creatives}` arrays of `to_jsonb(row) - 'created_by'` (creatives: `- 'uploaded_by'`), each `coalesce(..., '[]'::jsonb)`.
  - `ads_shared_scope(p_token text) returns jsonb` — same attributes. Looks up `ad_share_links` where `token = p_token and revoked_at is null`; level `program` → that program, its sets, those sets' creatives; `set` → that set and its creatives; `creative` → that creative and its set. **Ignores `hidden`.** Same stripped shape; unknown/revoked token returns `{"programs":[],"sets":[],"creatives":[]}`.
  - For both: `revoke all on function … from public; grant execute on function … to anon, authenticated;`

- [ ] **Step 3: Apply and verify against Supabase** (SQL editor or Supabase MCP `apply_migration`). Then run these checks and confirm each result:
  - As `anon` (`set role anon;`): `select * from ad_creatives;` → permission denied / zero rows; `select ads_public_library();` → returns object with three arrays.
  - Insert a hidden set with a creative and a share link for the creative: `ads_public_library()` must not contain them; `ads_shared_scope('<token>')` must contain the creative.
  - Set `revoked_at = now()` on that link: `ads_shared_scope('<token>')` equals `ads_shared_scope('nonexistent')` (both the empty object).
  - Output contains no `created_by` or `uploaded_by` keys.
  - Delete the test rows afterwards.

- [ ] **Step 4: Commit** — `git add src/types.ts supabase/migrations/0027_ads_library.sql` / `git commit -m "feat(ads): types and migration 0027"`.

---

## Task 2: Pure model helpers

**Files:**
- Create: `src/utils/adsModel.ts`, `src/utils/adsModel.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces (exported from `src/utils/adsModel.ts`):
  - `detectFormat(files: Pick<AdFile, 'mimeType' | 'name'>[]): AdFormat` — one image → `image`; two or more images → `carousel`; any `video/*` → `video`; `.zip`/`application/zip`/`application/x-zip-compressed` → `zip`; else `other`.
  - `thumbnailUrl(file: Pick<AdFile, 'driveFileId'>, width = 480): string` → `https://drive.google.com/thumbnail?id=<id>&sz=w<width>`
  - `downloadUrl(file: Pick<AdFile, 'driveFileId'>): string` → `https://drive.google.com/uc?export=download&id=<id>`
  - `viewUrl(file: Pick<AdFile, 'driveFileId'>): string` → `https://drive.google.com/file/d/<id>/view`
  - `isVisibleOnStandingLink(snap: AdsSnapshot): AdsSnapshot` — drops hidden programs; sets that are hidden or belong to a dropped program; creatives that are hidden, whose set was dropped, or whose set is missing.
  - `scopeFor(snap: AdsSnapshot, level: AdShareLink['level'], targetId: string): AdsSnapshot` — program → program + its sets + their creatives; set → that set + its creatives; creative → that creative + its set. Ignores `hidden`.
  - `interface AdsFilters { brandId?: string; kind?: AdKind; format?: AdFormat; audience?: string }`
  - `searchAds(snap: AdsSnapshot, query: string, filters: AdsFilters, brandName: (id: string) => string): AdsSnapshot` — every whitespace-separated query word must appear (case- and diacritic-insensitive) in the haystack of the item's own name plus its set name, course name, kind, audience and brand name. Filters narrow by the owning course's brand/kind, the set's audience, and the creative's format. Courses and sets are returned when they match or when any child matches; empty query + no filters returns the input unchanged.

- [ ] **Step 1: Write failing tests** in `adsModel.test.ts`: `detectFormat` for 1 png → `image`, 3 pngs → `carousel`, mp4 → `video`, `a.zip` → `zip`, `x.psd` → `other`; `thumbnailUrl({driveFileId:'abc'})` equals `https://drive.google.com/thumbnail?id=abc&sz=w480`; `downloadUrl` equals `https://drive.google.com/uc?export=download&id=abc`; `isVisibleOnStandingLink`: hidden program removes its sets and creatives, hidden set removes its creatives but not siblings, a creative with a missing set is removed; `scopeFor('creative', id)` returns the creative even when `hidden: true`; `searchAds`: `'nurses'`, `'Nurses'`, `'núrses'` return the same ids, `'   '` returns the input unchanged, a two-word query requires both words, the audience filter excludes other audiences, a no-match query returns empty arrays.
- [ ] **Step 2: Run** `npx vitest run src/utils/adsModel.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the functions above in `src/utils/adsModel.ts`. Normalize with `String.prototype.normalize('NFD')` and strip `̀-ͯ`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** — `feat(ads): model helpers (format, urls, visibility, search)`.

---

## Task 3: Storage layer (mappers, CRUD, realtime, public RPCs)

**Files:**
- Create: `src/utils/adsStorage.ts`, `src/utils/adsStorage.test.ts`

**Interfaces:**
- Consumes: types (Task 1); `supabase` from `src/lib/supabase.ts`.
- Produces (exported):
  - Row mappers `rowToProgram(row: Record<string, unknown>): AdProgram`, `rowToSet`, `rowToCreative`, `rowToAudience`, `rowToShareLink`, and inverses `programToRow(p: AdProgram)`, `setToRow`, `creativeToRow`, `shareLinkToRow`. Defaults: missing strings → `''`, missing `files` → `[]`, missing booleans → `false`, missing `created_by`/`uploaded_by` → `''` (public payloads omit them).
  - `fetchAdsSnapshot(): Promise<AdsSnapshot | null>` and `fetchAdAudiences(): Promise<AdAudience[] | null>` and `fetchShareLinks(): Promise<AdShareLink[] | null>` (null when Supabase is unconfigured or the query errors).
  - `upsertRemoteProgram(p)`, `upsertRemoteSet(s)`, `upsertRemoteCreative(c)`, `upsertRemoteShareLink(l)`, `upsertRemoteAudience(a)` — each `Promise<void>`.
  - `deleteRemoteProgram(id)`, `deleteRemoteSet(id)`, `deleteRemoteCreative(id)`, `deleteRemoteAudience(id)` — each `Promise<void>`.
  - `subscribeAdsChanges(onChange: () => void): () => void` — one realtime channel over all five tables; returns the unsubscribe function.
  - `fetchPublicLibrary(): Promise<AdsSnapshot>` (calls RPC `ads_public_library`) and `fetchSharedScope(token: string): Promise<AdsSnapshot>` (RPC `ads_shared_scope`, `{ p_token: token }`). Both return empty arrays on any error or null data — never throw.

- [ ] **Step 1: Write failing tests**: `rowToCreative({id:'c1', set_id:'s1', name:'A', format:'image', files:[{driveFileId:'f'}]})` round-trips through `creativeToRow` with `uploaded_by: ''`; `rowToCreative` with no `files` gives `[]`; `fetchPublicLibrary()` with a mocked `supabase.rpc` resolving `{data:null,error:{message:'x'}}` returns `{programs:[],sets:[],creatives:[]}`; `fetchSharedScope('t')` calls `rpc('ads_shared_scope', { p_token: 't' })`. Mock `../lib/supabase` with `vi.mock`.
- [ ] **Step 2: Run** `npx vitest run src/utils/adsStorage.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** following `src/utils/tutorialStorage.ts` for mapper and upsert style (snake_case columns, `supabase.from(...).upsert`). No localStorage cache (YAGNI: the library needs Supabase + Drive to function).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — `feat(ads): storage layer and public RPC wrappers`.

---

## Task 4: Apps Script actions and Drive client

**Files:**
- Modify: `src/data/googleAppsScript.ts` (the embedded script string)
- Create: `src/utils/adsDrive.ts`, `src/utils/adsDrive.test.ts`, `src/data/googleAppsScript.ads.test.ts`

**Interfaces:**
- Consumes: proxy contract in `api/appscript/proxy.ts` (POST `{ payload: { action, ...params } }` with `Authorization: Bearer <session token>`; response `{ data: <script JSON> }`); the call pattern in `src/utils/fileCleanup.ts` (`cascadeFileDelete`, ~lines 140–165).
- Produces — Apps Script actions (all return `{status:'success', …}` or `{status:'error', error}`):
  - `adsEnsureFolder {name, parentId?}` → `{folderId}` — **always creates** a new folder (so two ad sets with the same name never merge); `parentId` omitted → the root. The root "Ads Library" is found-or-created by name once and its id saved in Script Property `ADS_ROOT_FOLDER_ID`.
  - `adsRenameFolder {folderId, name}`, `adsMoveFolder {folderId, parentId}`, `adsMoveFile {fileId, folderId}` — each refuses anything not inside the root (`isUnderAdsRoot`).
  - `adsCreateUploadSession {folderId, fileName, mimeType, origin}` → `{sessionUrl}` — POSTs to `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=false` with `Authorization: Bearer ScriptApp.getOAuthToken()`, metadata `{name, parents:[folderId]}`, and the `Origin` request header set to `origin` if the platform allows it (verified by the Task 5 spike); returns the `Location` header.
  - `adsFinalizeFile {folderId, fileName, fileId?}` → `{fileId, name, mimeType, sizeBytes}` — resolves the file by `fileId`, or by the newest file named `fileName` in `folderId` when absent; sets sharing `ANYONE_WITH_LINK`/`VIEW`; refuses files outside the root.
  - `adsTrashFile {fileId}` and `adsTrashFolder {folderId}` — move to Drive Trash; refuse outside the root; missing/already-trashed → `{status:'success', alreadyGone:true}` (mirror `handleDeleteFile`). **Not Admin-gated in the proxy** (my call: any teammate organizes; UI limits who can click delete).
  - Add `"Ads Library"` to the names `isUnderManagedFolder` accepts so existing `deleteFile` and the Storage Cleanup panel treat ad files as managed.
- Produces — client (`src/utils/adsDrive.ts`), each throws `Error(message)` on `status:'error'`:
  - `ensureFolder(name: string, parentId?: string): Promise<string>`
  - `renameFolder(folderId: string, name: string): Promise<void>`
  - `moveFolder(folderId: string, parentId: string): Promise<void>`
  - `moveFile(fileId: string, folderId: string): Promise<void>`
  - `createUploadSession(args: { folderId: string; fileName: string; mimeType: string }): Promise<string>` (adds `origin: window.location.origin`)
  - `finalizeFile(args: { folderId: string; fileName: string; fileId?: string }): Promise<AdFile>`
  - `trashFile(fileId: string): Promise<void>`, `trashFolder(folderId: string): Promise<void>`

- [ ] **Step 1: Write failing tests**: `adsDrive.test.ts` mocks `fetch` and the Supabase session; asserts `ensureFolder('PPC Batch 3','p1')` posts `{ payload: { action: 'adsEnsureFolder', name: 'PPC Batch 3', parentId: 'p1' } }` to `/api/appscript/proxy` with a Bearer header and returns the `folderId`; a `{data:{status:'error',error:'boom'}}` response rejects with `boom`. `googleAppsScript.ads.test.ts` asserts `GOOGLE_APPS_SCRIPT_CODE` contains each of the eight action names, `ADS_ROOT_FOLDER_ID`, `isUnderAdsRoot`, and `"Ads Library"` inside `isUnderManagedFolder`.
- [ ] **Step 2: Run** `npx vitest run src/utils/adsDrive.test.ts src/data/googleAppsScript.ads.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the Apps Script actions in the template string (remember to escape backticks and `${` inside it — the file is a JS template literal) and wire them in `doPost`'s action dispatch (`src/data/googleAppsScript.ts:96-120`). Update the header instructions with step 16: *redeploy the Web App ("New version") to activate the Ads Library actions*. Implement `adsDrive.ts` on the `fileCleanup.ts` fetch pattern.
- [ ] **Step 4: Run** the same command — expect PASS; then `npx vitest run` — expect all green.
- [ ] **Step 5: Commit** — `feat(ads): Apps Script folder/upload actions and Drive client`.

---

## Task 5: Direct upload + feasibility spike (GATE)

**Files:**
- Create: `src/utils/adsUpload.ts`, `src/utils/adsUpload.test.ts`

**Interfaces:**
- Consumes: `createUploadSession`, `finalizeFile` (Task 4); `AdFile` (Task 1).
- Produces: `uploadToDrive(file: File, folderId: string, onProgress?: (fraction: number) => void): Promise<AdFile>` — creates a session, `PUT`s the file to `sessionUrl` with `XMLHttpRequest` (for upload progress), tries to read `{id}` from the JSON response, and calls `finalizeFile` (passing `fileId` when it was readable, else just name + folder so the script finds it). Rejects with a plain-language `Error` ("Upload failed — check your connection and try again") on network/HTTP failure; never leaves a half-created creative (no DB writes here).

- [ ] **Step 1: Write failing tests** with a fake `XMLHttpRequest`: success with readable `{id:'f1'}` calls `finalizeFile` with `fileId:'f1'`; success with unreadable body calls it without `fileId`; HTTP 500 rejects with the plain-language message and does not call `finalizeFile`; `onProgress` receives `0.5` for a half-sent event; uploading the same `File` name twice returns two results (no dedupe).
- [ ] **Step 2: Run** `npx vitest run src/utils/adsUpload.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `uploadToDrive` in `src/utils/adsUpload.ts`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Spike against the real script (manual gate).** After the user redeploys the Apps Script (Task 4 step 16), from the browser console on the dev server (`npm run dev`, `http://localhost:3001`, logged in) call `uploadToDrive` with a ~30MB MP4 and a PNG into a folder from `ensureFolder`. Pass criteria: file appears in `Ads Library/…` in Drive, `anyone with link` view works in a private window, progress events fire, and the `PUT` is not blocked by CORS. Record in the PR notes whether the response `id` was readable. **If the browser PUT is blocked and cannot be fixed, stop and tell the user** — the fallbacks are paste-a-Drive-link (approach B) or chunked upload via the proxy; do not continue to Task 8's upload zone without their choice.
- [ ] **Step 6: Commit** — `feat(ads): direct resumable upload to Drive`.

---

## Task 6: `useAdsLibrary` hook (state + mutations)

**Files:**
- Create: `src/hooks/useAdsLibrary.ts`, `src/hooks/useAdsLibrary.test.ts`

**Interfaces:**
- Consumes: Task 3 storage, Task 4 Drive client, Task 2 `detectFormat`; the active teammate's name is passed in.
- Produces: `useAdsLibrary(activeUserName: string)` returning

```ts
{
  programs: AdProgram[]; sets: AdSet[]; creatives: AdCreative[];
  audiences: AdAudience[]; shareLinks: AdShareLink[]; loading: boolean;
  createProgram(input: { name: string; brandId: string; kind: AdKind }): Promise<AdProgram>;
  updateProgram(id: string, patch: Partial<Pick<AdProgram, 'name' | 'brandId' | 'kind' | 'hidden'>>): Promise<void>;
  deleteProgram(id: string, mode: 'delete-all' | 'move-to-unsorted'): Promise<DeleteResult>;
  createSet(input: { name: string; programId: string | null; audience: string }): Promise<AdSet>;
  updateSet(id: string, patch: Partial<Pick<AdSet, 'name' | 'audience' | 'hidden'>>): Promise<void>;
  moveSet(id: string, programId: string | null): Promise<void>;
  deleteSet(id: string, mode: 'delete-all' | 'move-to-unsorted'): Promise<DeleteResult>;
  addCreative(input: { setId: string; name: string; files: AdFile[]; sourceUrl?: string }): Promise<AdCreative>;
  updateCreative(id: string, patch: Partial<Pick<AdCreative, 'name' | 'sourceUrl' | 'hidden'>>): Promise<void>;
  moveCreative(id: string, setId: string): Promise<void>;
  deleteCreative(id: string): Promise<DeleteResult>;
  createShareLink(level: AdShareLink['level'], targetId: string, label: string): Promise<AdShareLink>;
  revokeShareLink(token: string): Promise<void>;
  addAudience(name: string): Promise<void>; removeAudience(id: string): Promise<void>;
  ensureSetFolder(setId: string): Promise<string>;   // Drive folder id, creating Unsorted/folders lazily
  countCreativesUnder(kind: 'program' | 'set', id: string): number;
}
interface DeleteResult { driveOk: boolean }   // false → rows removed but Drive trash failed
```

Behavior pinned by the spec: new ids `ad-program-<Date.now()>-<rand5>` etc.; `format` set by `detectFormat(files)`; creating a program/set creates its Drive folder **first** (`ensureFolder`) and persists the row only if that succeeds; renaming calls `renameFolder`; `moveSet`/`moveCreative` move the Drive folder/file; `deleteX(…,'move-to-unsorted')` moves every affected creative's files to the Unsorted folder, re-parents the creatives to `ads-unsorted`, then removes the emptied rows and trashes the emptied folder; `'delete-all'` removes rows then trashes the folder (or files, for `deleteCreative`); a Drive failure after the DB change returns `{driveOk:false}` instead of throwing; the system set `ads-unsorted` can never be deleted or renamed (the mutation throws `Error('Unsorted can't be changed')`); `createShareLink` generates a token from `crypto.randomUUID()` with dashes removed (32 hex chars); data refreshes via `fetchAdsSnapshot` on mount and on `subscribeAdsChanges`.

- [ ] **Step 1: Write failing tests** (mock Tasks 3 and 4): `createSet` does not persist when `ensureFolder` rejects; `deleteProgram(id,'move-to-unsorted')` calls `moveFile` for each file and ends with no creatives left under that program and the creatives now having `setId: 'ads-unsorted'`; `deleteProgram(id,'delete-all')` with `trashFolder` rejecting resolves `{driveOk:false}` and the program row is still removed; deleting `ads-unsorted` throws; `countCreativesUnder('program', id)` counts creatives across all its sets; `createShareLink` returns a 32-char lowercase hex token; two `addCreative` calls with the same `name` produce two rows.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useAdsLibrary.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the hook, following `useTutorials.ts` for the fetch/subscribe wiring.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — `feat(ads): useAdsLibrary hook`.

---

## Task 7: Shared gallery, search bar, and downloads

**Files:**
- Create: `src/components/ads/AdsGallery.tsx`, `src/components/ads/AdsSearchBar.tsx`, `src/components/ads/AdsGallery.test.tsx`

**Interfaces:**
- Consumes: `AdsSnapshot`, `AdsFilters`, `searchAds`, `thumbnailUrl`, `downloadUrl` (Tasks 1–2).
- Produces:
  - `AdsSearchBar({ query, onQueryChange, filters, onFiltersChange, brands: { id: string; name: string }[], audiences: string[] })` — one text box plus filter chips for Brand, Kind, Format, Audience; a visible "Clear" when anything is set.
  - `AdsGallery({ snapshot, brandName, selectable, onOpenProgram?, onOpenSet?, onOpenCreative?, renderActions? })` — breadcrumb drill-down **Courses → Ad sets → Creatives** (loose sets appear alongside courses at the top level), thumbnail grid, format badge, multi-select checkboxes on creatives when `selectable`, and a sticky "Download N selected" button. Props are presentational only (no Supabase access) so Task 9 and Task 10 both reuse it.
  - `downloadFiles(files: AdFile[]): Promise<void>` exported from the same folder (`src/components/ads/downloadFiles.ts`) — triggers one browser download per file by clicking a temporary `<a href=downloadUrl(file) download>` with 400ms spacing. (Zipping in the browser is not possible: Drive does not allow cross-origin reads. Documented in the button's tooltip: "Your browser may ask to allow multiple downloads.")

- [ ] **Step 1: Write failing tests** (Testing Library): top level shows course and loose-set cards; clicking a course shows only its sets; selecting 2 creatives enables "Download 2 selected"; a carousel creative's download includes all its slide files (spy on `downloadFiles`); an empty result shows the text `No ads match your search.`; a creative with zero files renders a placeholder tile, not a broken image.
- [ ] **Step 2: Run** `npx vitest run src/components/ads/AdsGallery.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** the three files using existing Tailwind tokens (primary `#4f46e5`, borders `#e9e9e7`, text `#0f0f0f`/`#5f5f5b`), mobile-first (single column under `sm`, `min-w-0` on flex children, tap targets ≥ 38px).
- [ ] **Step 4: Run** — expect PASS; `npx vitest run src/utils/paletteGuard.test.ts` — expect PASS.
- [ ] **Step 5: Commit** — `feat(ads): gallery, search bar, downloads`.

---

## Task 8: Team-facing modals and upload zone

**Files:**
- Create: `src/components/ads/AdsUploadZone.tsx`, `AdsFolderModal.tsx`, `AdsCreativeModal.tsx`, `AdsShareModal.tsx`, `AdsDeleteDialog.tsx` and a test file per component (`*.test.tsx`)

**Interfaces:**
- Consumes: `useAdsLibrary` return type (Task 6), `uploadToDrive` (Task 5), `Modal` and `useConfirm` primitives from `src/components/ui/`.
- Produces:
  - `AdsUploadZone({ setId, onUploaded })` — drag-and-drop plus "Choose files"; up to 3 uploads at a time with a per-file progress bar and a retry button on failure. When ≥2 images are dropped, asks "Save as: separate ads / one carousel". `onUploaded(creativeInputs: { name: string; files: AdFile[] }[])`. Default creative name is the file name without extension.
  - `AdsFolderModal({ mode: 'program' | 'set', initial?, audiences, brands, onSave, onClose })` — program: name, brand, kind; set: name, audience (from list, with "Add audience" for Admins only), course (select or "No course").
  - `AdsCreativeModal({ creative, sets, onSave, onClose })` — rename, editable source link ("Open source file" opens it in a new tab), move to another ad set, Hide-from-standing-link toggle, preview/download.
  - `AdsShareModal({ level, targetId, targetName, links, onCreate, onRevoke, onClose })` — lists this target's links with Copy and Revoke; "Create new link"; the copied URL is `${window.location.origin}/s/<token>`; the standing link `${origin}/ads` is shown at the top with its own Copy.
  - `AdsDeleteDialog({ kind: 'program' | 'set', name, count, onChoose(mode), onClose })` — text states the count ("This will affect 12 ads."), two buttons "Delete everything inside" and "Move ads to Unsorted", and Cancel; no default action.

- [ ] **Step 1: Write failing tests**: dropping 2 PNGs shows the carousel/separate question and choosing carousel calls `onUploaded` once with one item having 2 files; a rejected upload shows "Upload failed" and a Retry button and does not call `onUploaded`; `AdsShareModal` Copy puts `http://localhost:3000/s/<token>` on the clipboard (stub `navigator.clipboard`); `AdsDeleteDialog` with `count: 12` contains "12 ads" and calling the two buttons passes `'delete-all'` / `'move-to-unsorted'`; `AdsFolderModal` blocks saving an empty name.
- [ ] **Step 2: Run** `npx vitest run src/components/ads` — expect FAIL.
- [ ] **Step 3: Implement** the components. Non-tech copy: plain labels, no "Drive ID"/"token" jargon (links are called "Share links").
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — `feat(ads): upload zone and management modals`.

---

## Task 9: Ads Library tab and navigation

**Files:**
- Create: `src/components/AdsLibrary.tsx`, `src/components/AdsLibrary.test.tsx`
- Modify: `src/components/SideNav.tsx` (add `'ads'` to `NavTab` and a nav item `{ tab: 'ads', label: 'Ads Library', icon: 'photo_library' }` beside Tutorials), `src/components/CommandPalette.tsx` (entry "Go to Ads Library"), `src/App.tsx` (render `<AdsLibrary … />` when `currentTab === 'ads'`, near line 697)

**Interfaces:**
- Consumes: Tasks 6–8; `useBrands` from `src/context/BrandsContext` for the brand list; `activeTeammate`.
- Produces: `AdsLibrary({ activeTeammate, selectedBrandFilter, showToast })` — header with search, "New course", "New ad set", "Upload" (opens an ad-set picker then the upload zone), a "Share" button on every course/set/creative (opens `AdsShareModal`), a Hide/Unhide action, move, and delete (delete shown only to the uploader or an Admin; courses/sets only to Admins or their creator). After a delete the toast reads "Removed. Some Drive files couldn't be trashed — an admin can clean them up in Settings." when `driveOk` is false. When `supabase` is null, shows "The Ads Library needs the shared database connection."

- [ ] **Step 1: Write failing tests**: renders the empty state "No ads yet — create a course or upload your first ads."; creating a course through the modal calls `createProgram` with the entered values; the delete button is absent for a non-admin viewing someone else's creative; a failed delete (`driveOk:false`) shows the toast text above.
- [ ] **Step 2: Run** `npx vitest run src/components/AdsLibrary.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** `AdsLibrary.tsx` and the wiring edits. Reuse `canManage`-style logic from `src/utils/tutorialOwnership.ts` for the uploader check (do not duplicate; pass a creator-name field through the same helper shape or add a thin `canManageAd(createdBy, activeTeammate)` in `src/utils/adsModel.ts` with a test).
- [ ] **Step 4: Run** `npx vitest run` — expect all green; `npm run build` — expect success.
- [ ] **Step 5: Commit** — `feat(ads): Ads Library tab`.

---

## Task 10: Public pages and routing

**Files:**
- Create: `src/utils/publicRoute.ts`, `src/utils/publicRoute.test.ts`, `src/components/ads/PublicAdsPage.tsx`, `src/components/ads/PublicAdsPage.test.tsx`, `vercel.json`
- Modify: `src/main.tsx`; check `server.ts` serves the SPA for `/ads` and `/s/*` in production (`npm start`) and add the fallback if missing

**Interfaces:**
- Produces:
  - `parsePublicRoute(pathname: string): { kind: 'standing' } | { kind: 'share'; token: string } | null` — `/ads` and `/ads/` → standing; `/s/<token>` (token 8–64 chars of `[A-Za-z0-9_-]`) → share; anything else → null.
  - `PublicAdsPage({ route })` — loads `fetchPublicLibrary()` (standing) or `fetchSharedScope(token)` (share), shows loading, then `AdsGallery` with `selectable` and search; for a share with an empty result shows "This link isn't available anymore. Ask the team for a new one." (identical text for revoked and unknown tokens). No app chrome, no login, a small "Pharmacozyme Ads" header.
  - `vercel.json`: a rewrite so non-`/api/` paths fall through to `/index.html` (the repo has none today; confirm `?tutorial=` deep links still work).
- `main.tsx`: `const route = parsePublicRoute(window.location.pathname)`; if non-null render `<PublicAdsPage route={route} />` **without** `<App />` (so the login gate in `App.tsx:404` is never reached) and without `BrandsProvider` (brand names come from the static `src/data/brands.ts`).

- [ ] **Step 1: Write failing tests**: `parsePublicRoute('/ads')` and `'/ads/'` → `{kind:'standing'}`; `'/s/abc12345'` → `{kind:'share', token:'abc12345'}`; `'/s/x'` → null; `'/'` and `'/api/health'` → null. `PublicAdsPage` with `fetchSharedScope` resolving empty renders the "isn't available anymore" text; with a creative present renders its name and a "Download" control; for `standing`, a mocked `fetchPublicLibrary` result is displayed without any "Share", "Hide" or "Delete" controls.
- [ ] **Step 2: Run** `npx vitest run src/utils/publicRoute.test.ts src/components/ads/PublicAdsPage.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** the files and the `main.tsx` branch.
- [ ] **Step 4: Run** `npx vitest run` and `npm run build` — expect all green and a clean build.
- [ ] **Step 5: Commit** — `feat(ads): public share pages and routing`.

---

## Task 11: Manual end-to-end sweep and release

**Files:** none (verification, then merge).

- [ ] **Step 1: Release prerequisites** (user actions, in this order): apply `0027_ads_library.sql` in Supabase; redeploy the Apps Script Web App ("New version"); confirm `APPS_SCRIPT_URL` is set in Vercel.
- [ ] **Step 2: Browser sweep** on `npm run dev` (`http://localhost:3001`), logged in, then in a private window for public links. Pass criteria:
  - Create course "PPC Batch 3" → ad set "Module 1" → drag-drop 5 PNGs: they appear as thumbnails; Drive shows `Ads Library/PPC Batch 3/Module 1/` with 5 files.
  - Upload a ~30MB MP4 and a zip: both appear (zip as a file tile with no preview).
  - Search "ppc", "doctors", "carousel" finds the expected items; filter chips narrow results.
  - Share a course link, an ad set link, and a creative link: each opens logged-out showing only its scope; Download works; "Download selected" starts multiple downloads.
  - Hide the ad set: it disappears from `/ads` but its own link still works. Revoke the link: it shows "This link isn't available anymore…".
  - Move a creative to another set: Drive file moves. Delete a course with both choices (use test data): counts are shown; "Move ads to Unsorted" leaves the ads in Unsorted.
  - Phone width (devtools 375px): gallery, selection and download usable; no horizontal scroll.
  - A second logged-in browser sees new items live (realtime).
- [ ] **Step 3: Full verification** — `npm test` all pass, `npm run build` clean.
- [ ] **Step 4: Merge** to `main` only after the user confirms the sweep (project workflow: worktree isolation, one fix wave, manual check before merge).
