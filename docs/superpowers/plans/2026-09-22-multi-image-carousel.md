# Multi-Image Carousel Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Templates and Posts hold an ordered list of up to 10 images (a real Instagram-style carousel) instead of exactly one, with drag-to-reorder, and have a carousel template hand its full slide set to any post created from it.

**Architecture:** Additive `images: string[]` field on `Post`/`PostTemplate`, backed by a new `images jsonb` column on both Supabase tables. The existing single-image fields (`visualUrl`/`imagePreview`) become a derived "cover" (`images[0] ?? ''`) kept in sync on every write, so every consumer that only ever needed one image (Sheets sync, reminder email HTML, calendar thumbnails, delete-cascade's pre-existing scan) keeps working unchanged. A new reusable `ImageCarouselField` component (multi-upload, delete, drag-reorder) replaces the single-image upload block in the Template modal, `NewPostModal`, and `PostDetailModal`.

**Tech Stack:** React 19 + TypeScript, Vitest 4 (`globals: false` — every test file explicitly imports from `vitest`), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (new dependencies, added in Task 3), Supabase Postgres (`jsonb` column), existing Apps Script Drive upload (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-22-multi-image-carousel-design.md`

## Global Constraints

- Every test file must explicitly `import { describe, it, expect, vi } from 'vitest'` — `globals: false` in `vitest.config`.
- Gate before any commit that finishes a task: `npx tsc --noEmit && npx vitest run && npm run build` (the >500kB chunk-size build warning is pre-existing and acceptable; nothing else should warn).
- Cap carousel size at 10 images (`MAX_CAROUSEL_IMAGES`), enforced in the UI layer only — not a DB constraint.
- Uploads are sequential, never `Promise.all` — the Apps Script Drive endpoint is prone to slow/cold-start responses; concurrent calls make that worse.
- `visualUrl` (`Post`) / `imagePreview` (`PostTemplate`) must equal `images[0] ?? ''` after every write path that touches `images` — this is the invariant every non-carousel-aware consumer (Sheets sync, reminder email, calendar day-cell thumbnails, delete-cascade) silently depends on.
- Migration file: `supabase/migrations/0022_carousel_images.sql` — the actual Supabase table names are `posts` and `templates` (**not** `post_templates` — verified in `src/utils/storage.ts`).
- No Apps Script (`src/data/googleAppsScript.ts`) or `/api/appscript/proxy.ts` changes — uploads still go one file per call through the existing `action: 'upload'` path.

---

### Task 1: Data model — types, storage mappers, migration, and every existing construction site

**Files:**
- Create: `supabase/migrations/0022_carousel_images.sql`
- Create: `src/utils/images.ts`
- Create: `src/utils/images.test.ts`
- Create: `src/utils/storage.images.test.ts`
- Modify: `src/types.ts` (`Post` ~line 161, `PostTemplate` ~line 183)
- Modify: `src/utils/storage.ts` (`PostRow` type ~line 222-248, `rowToPost`/`postToRow` ~line 250-308, `rowToTemplate`/`templateToRow` ~line 363-393, `getStoredPosts` ~line 30-48, `getStoredTemplates` ~line 58-69)
- Modify: `src/utils/quickPost.ts` (`buildQuickPost`, ~line 24-45)
- Modify: `src/App.tsx` (content-bank-swipe → post, ~line 457-473)
- Modify: `src/utils/researchParse.ts` (CSV import → post, ~line 216-235)
- Modify: `src/components/CalendarView.tsx` (recurrence placeholder push ~line 296-306, `handlePlaceholderClick`'s `materialized` post ~line 379-396, `handleImageFileUpload`'s two branches ~line 421 and ~line 427)
- Modify: `src/components/NewPostModal.tsx` (`handleSubmit`'s `newPost` literal only, ~line 317 — minimal compile fix, superseded by Task 5)
- Modify: `src/components/TemplateLibrary.tsx` (`handleCreateTemplate`'s `tpl` literal only, ~line 266 — minimal compile fix, superseded by Task 4)
- Modify: `src/utils/brandConflicts.test.ts` (`basePost` fixture, ~line 6-21)
- Modify: `src/utils/autoBackup.test.ts` (`mockPayload.posts[0]`, ~line 13-27)
- Modify: `src/utils/templateCategories.test.ts` (`t` fixture, ~line 5-8)
- Modify: `src/components/TemplateLibrary.test.tsx` (`tpl` fixture, ~line 21-24)

**Interfaces:**
- Produces: `Post.images: string[]`, `PostTemplate.images: string[]` (both required, ordered, no cap enforced at the type level). `coverOf(images: string[]): string` from `src/utils/images.ts`. `MAX_CAROUSEL_IMAGES = 10` from the same file. `rowToTemplate`/`templateToRow` become exported from `src/utils/storage.ts` (were previously unexported).
- Consumes: nothing from other tasks — this is the foundation task everything else builds on.

This task's own object-literal fixes are 1:1 with every remaining `Post`/`PostTemplate` literal in the repo found by grepping for `visualUrl:`/`imagePreview:` across `src/` — the ones inside `NewPostModal.tsx`, `TemplateLibrary.tsx`, and `PostDetailModal.tsx` are deliberately left for Tasks 4-6, which replace that code with `ImageCarouselField` wiring rather than patching it twice.

- [ ] **Step 1: Write the failing tests for `coverOf`**

```ts
// src/utils/images.test.ts
import { describe, it, expect } from 'vitest';
import { coverOf, MAX_CAROUSEL_IMAGES } from './images';

describe('coverOf', () => {
  it('returns an empty string for an empty array', () => {
    expect(coverOf([])).toBe('');
  });

  it('returns the first element for a non-empty array', () => {
    expect(coverOf(['https://a.png', 'https://b.png'])).toBe('https://a.png');
  });
});

describe('MAX_CAROUSEL_IMAGES', () => {
  it('is 10, matching the Instagram carousel limit the spec targets', () => {
    expect(MAX_CAROUSEL_IMAGES).toBe(10);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/images.test.ts`
Expected: FAIL — `Failed to resolve import "./images"` (the module doesn't exist yet).

- [ ] **Step 3: Create `src/utils/images.ts`**

```ts
/**
 * Shared helpers for the multi-image carousel feature (Posts + Templates).
 * See docs/superpowers/specs/2026-09-22-multi-image-carousel-design.md.
 */

/** UI-enforced cap on carousel slides -- matches Instagram's own limit. Not a DB constraint. */
export const MAX_CAROUSEL_IMAGES = 10;

/**
 * The single "cover" image derived from an ordered image list. Every write
 * path that sets `images` must also set `visualUrl`/`imagePreview` to this,
 * so consumers that only ever need one image (Sheets sync, reminder email,
 * calendar thumbnails, exports, delete-cascade's reference scan) keep
 * working unchanged on records that now carry a full carousel.
 */
export function coverOf(images: string[]): string {
  return images[0] ?? '';
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npx vitest run src/utils/images.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `images` to the `Post` and `PostTemplate` types**

In `src/types.ts`, change:

```ts
  visualUrl: string; // image preview or drive URL
```

to:

```ts
  visualUrl: string; // derived: images[0] ?? '' (see utils/images.ts:coverOf) -- kept in sync on every write
  images: string[]; // ordered carousel slides (max MAX_CAROUSEL_IMAGES, enforced in the UI)
```

inside `Post`, and change:

```ts
  imagePreview: string;
```

to:

```ts
  imagePreview: string; // derived: images[0] ?? '' -- see Post.visualUrl above
  images: string[];
```

inside `PostTemplate`.

- [ ] **Step 6: Run the type-check to see every now-broken call site**

Run: `npx tsc --noEmit`
Expected: FAIL, with one "Property 'images' is missing" error per file listed under **Files** above (storage.ts's `PostRow`/mappers, `quickPost.ts`, `App.tsx`, `researchParse.ts`, `CalendarView.tsx`'s recurrence-placeholder and `materialized` object literals, `NewPostModal.tsx`'s `newPost` literal, `TemplateLibrary.tsx`'s `tpl` literal, and the four test fixtures). `PostDetailModal.tsx` does **not** show up here — its only `Post`-shaped object construction is `{ ...post }`/`{ ...prev }` spreads of an already-valid `Post`, so it stays type-safe without any change until Task 6 rewires it.

- [ ] **Step 7: Fix `src/utils/storage.ts` — add `images`, export the template mappers**

Add `images: string[];` to the `PostRow` type (after `visual_url: string;`, ~line 238):

```ts
  visual_url: string;
  images: string[];
```

In `rowToPost` (~line 267), add:

```ts
    visualUrl: row.visual_url,
    images: Array.isArray(row.images) ? row.images : [],
```

In `postToRow` (~line 297), add:

```ts
    visual_url: post.visualUrl,
    images: post.images || [],
```

Change `function rowToTemplate(row: any): PostTemplate {` to `export function rowToTemplate(row: any): PostTemplate {`, and inside it (~line 374) add:

```ts
    imagePreview: row.image_preview || '',
    images: Array.isArray(row.images) ? row.images : [],
```

Change `function templateToRow(t: PostTemplate) {` to `export function templateToRow(t: PostTemplate) {`, and inside it (~line 390) add:

```ts
    image_preview: t.imagePreview || '',
    images: t.images || [],
```

Then fix the two local-cache readers so a post/template cached before this feature shipped (no `images` key in its stored JSON at all) doesn't crash the first time something calls `.length`/`.map` on `post.images`. In `getStoredPosts` (~line 40), change:

```ts
    return parsed.map((p) => ({
      ...p,
      assignees: p.assignees || (p.assignee ? [p.assignee] : []),
    }));
```

to:

```ts
    return parsed.map((p) => ({
      ...p,
      assignees: p.assignees || (p.assignee ? [p.assignee] : []),
      images: p.images || (p.visualUrl ? [p.visualUrl] : []),
    }));
```

In `getStoredTemplates` (~line 65), change:

```ts
    return JSON.parse(raw);
```

to:

```ts
    const parsed: PostTemplate[] = JSON.parse(raw);
    return parsed.map((t) => ({
      ...t,
      images: t.images || (t.imagePreview ? [t.imagePreview] : []),
    }));
```

- [ ] **Step 8: Write the migration**

```sql
-- supabase/migrations/0022_carousel_images.sql
alter table posts add column if not exists images jsonb not null default '[]'::jsonb;
alter table templates add column if not exists images jsonb not null default '[]'::jsonb;

-- Backfill existing single-image rows so images[0] already equals the old cover.
update posts set images = jsonb_build_array(visual_url)
  where images = '[]'::jsonb and coalesce(visual_url, '') <> '';

update templates set images = jsonb_build_array(image_preview)
  where images = '[]'::jsonb and coalesce(image_preview, '') <> '';
```

- [ ] **Step 9: Write the storage mapper tests**

```ts
// src/utils/storage.images.test.ts
import { describe, it, expect } from 'vitest';
import { rowToTemplate, templateToRow } from './storage';

const baseRow = {
  id: '1', title: 'X', description: '', brand_id: 'shared', category: 'Clinical',
  platform: 'instagram', spec_type: 'feed-post', default_caption: '', tags: [],
  image_preview: '', uses_count: 0,
};

describe('template images mapping', () => {
  it('rowToTemplate reads the images array', () => {
    const t = rowToTemplate({ ...baseRow, image_preview: 'https://a', images: ['https://a', 'https://b'] });
    expect(t.images).toEqual(['https://a', 'https://b']);
  });

  it('rowToTemplate defaults images to [] for a pre-migration row with no images value', () => {
    const t = rowToTemplate({ ...baseRow });
    expect(t.images).toEqual([]);
  });

  it('rowToTemplate defaults images to [] when the column comes back non-array (defensive)', () => {
    const t = rowToTemplate({ ...baseRow, images: null });
    expect(t.images).toEqual([]);
  });

  it('templateToRow writes the images array', () => {
    const row = templateToRow({
      id: '1', title: 'X', description: '', brandId: 'shared', category: 'Clinical',
      platform: 'instagram', specType: 'feed-post', defaultCaption: '', tags: [],
      imagePreview: 'https://a', images: ['https://a'], usesCount: 0,
    });
    expect(row.images).toEqual(['https://a']);
  });

  it('templateToRow defaults images to [] when the template has none', () => {
    const row = templateToRow({
      id: '1', title: 'X', description: '', brandId: 'shared', category: 'Clinical',
      platform: 'instagram', specType: 'feed-post', defaultCaption: '', tags: [],
      imagePreview: '', images: [], usesCount: 0,
    });
    expect(row.images).toEqual([]);
  });
});
```

Run: `npx vitest run src/utils/storage.images.test.ts`
Expected: PASS (5 tests). (`rowToPost`/`postToRow` stay unexported — they're a one-line mirror of the now-tested template mappers, and testing them directly would mean hand-building every one of `PostRow`'s ~20 required fields for no additional coverage.)

- [ ] **Step 10: Fix `src/utils/quickPost.ts`**

In `buildQuickPost` (~line 33), change:

```ts
    visualUrl: '',
```

to:

```ts
    visualUrl: '',
    images: [],
```

- [ ] **Step 11: Fix `src/App.tsx`'s content-bank-swipe post**

At ~line 468, change:

```ts
      visualUrl: '',
      approved: false,
```

to:

```ts
      visualUrl: '',
      images: [],
      approved: false,
```

- [ ] **Step 12: Fix `src/utils/researchParse.ts`'s CSV-import post**

At ~line 220, change:

```ts
      assignees,
      visualUrl: '',
      approved: false,
```

to:

```ts
      assignees,
      visualUrl: '',
      images: [],
      approved: false,
```

- [ ] **Step 13: Fix `src/components/CalendarView.tsx`'s four construction sites**

Recurrence placeholder push (~line 304), so a recurring series' images ride along onto its generated placeholder slots exactly like its cover already does — change:

```ts
              visualUrl: series.visualUrl,
              approved: false,
```

to:

```ts
              visualUrl: series.visualUrl,
              images: series.images,
              approved: false,
```

`handlePlaceholderClick`'s `materialized` post (~line 400), so clicking a recurring-slot placeholder creates a real post carrying the series' full image set, not just its cover — change:

```ts
      visualUrl: placeholder.visualUrl,
      approved: false,
```

to:

```ts
      visualUrl: placeholder.visualUrl,
      images: placeholder.images || [],
      approved: false,
```

`handleImageFileUpload`'s existing-post branch (~line 421) — a quick single-image drop/replace on the calendar must keep `images` and `visualUrl` in sync (this action always fully replaces the post's visual, matching its existing single-image behavior) — change:

```ts
        onSavePost({ ...targetPost, visualUrl: url, activityLog: [{ id: `act-${Date.now()}`, actor: targetPost.assignees[0] || defaultAssignee || 'Someone', action: `Added image "${file.name}"`, timestamp: logTimestamp() }, ...targetPost.activityLog] });
```

to:

```ts
        onSavePost({ ...targetPost, visualUrl: url, images: [url], activityLog: [{ id: `act-${Date.now()}`, actor: targetPost.assignees[0] || defaultAssignee || 'Someone', action: `Added image "${file.name}"`, timestamp: logTimestamp() }, ...targetPost.activityLog] });
```

`handleImageFileUpload`'s new-post branch (~line 427), same reasoning — change:

```ts
visualUrl: url, approved: false,
```

(inside that long object-literal line) to:

```ts
visualUrl: url, images: [url], approved: false,
```

- [ ] **Step 14: Fix the four test fixtures**

`src/utils/brandConflicts.test.ts` (~line 17): change

```ts
  visualUrl: '',
  approved: false,
```

to

```ts
  visualUrl: '',
  images: [],
  approved: false,
```

`src/utils/autoBackup.test.ts` (~line 25): change

```ts
      visualUrl: '',
      approved: false,
```

to

```ts
      visualUrl: '',
      images: [],
      approved: false,
```

`src/utils/templateCategories.test.ts` (~line 7): change

```ts
  defaultCaption: '', tags: [], imagePreview: '', usesCount: 0,
```

to

```ts
  defaultCaption: '', tags: [], imagePreview: '', images: [], usesCount: 0,
```

`src/components/TemplateLibrary.test.tsx` (~line 23): change

```ts
  specType: 'feed-post', defaultCaption: '', tags: [], imagePreview: '', usesCount: 0,
```

to

```ts
  specType: 'feed-post', defaultCaption: '', tags: [], imagePreview: '', images: [], usesCount: 0,
```

- [ ] **Step 15: Minimal compile-fix in `NewPostModal.tsx` and `TemplateLibrary.tsx`**

These two files each construct one fresh `Post`/`PostTemplate` literal that Tasks 4-5 will rewrite properly once `ImageCarouselField` replaces their single-image state. For now, just wrap the existing single value so the repo compiles and behaves exactly as before (a post/template made today still gets exactly its one image, now also mirrored into `images`).

In `src/components/NewPostModal.tsx`'s `handleSubmit` (~line 317), change:

```ts
      visualUrl,
      approved: false,
```

to:

```ts
      visualUrl,
      images: visualUrl ? [visualUrl] : [],
      approved: false,
```

In `src/components/TemplateLibrary.tsx`'s `handleCreateTemplate` (~line 266), change:

```ts
      tags: tagArray.length > 0 ? tagArray : [newCategory],
      imagePreview: newImagePreview.trim(),
      usesCount: 0
```

to:

```ts
      tags: tagArray.length > 0 ? tagArray : [newCategory],
      imagePreview: newImagePreview.trim(),
      images: newImagePreview.trim() ? [newImagePreview.trim()] : [],
      usesCount: 0
```

(`handleDuplicateTemplate` and `handleSaveEditedTemplate` both build their result via `...tpl`/`...editingTemplate` spreads of an already-valid `PostTemplate`, so neither needs a change here.)

- [ ] **Step 16: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS — zero TypeScript errors, every existing test still green plus the new `images.test.ts` and `storage.images.test.ts`.

- [ ] **Step 17: Commit**

```bash
git add supabase/migrations/0022_carousel_images.sql src/utils/images.ts src/utils/images.test.ts src/utils/storage.images.test.ts src/types.ts src/utils/storage.ts src/utils/quickPost.ts src/App.tsx src/utils/researchParse.ts src/components/CalendarView.tsx src/components/NewPostModal.tsx src/components/TemplateLibrary.tsx src/utils/brandConflicts.test.ts src/utils/autoBackup.test.ts src/utils/templateCategories.test.ts src/components/TemplateLibrary.test.tsx
git commit -m "feat(carousel): add images[] to Post/PostTemplate, migration 0022

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Sequential multi-image upload wrapper

**Files:**
- Modify: `src/utils/uploadImage.ts`
- Create: `src/utils/uploadImage.test.ts`

**Interfaces:**
- Consumes: `uploadImage(file: File): Promise<UploadResult>` (unchanged, existing export).
- Produces: `uploadImages(files: File[], onProgress?: (done: number, total: number) => void): Promise<{ succeeded: UploadResult[]; failed: { file: File; error: string }[] }>` — used by `ImageCarouselField` in Task 3.

- [ ] **Step 1: Write the failing tests**

```ts
// src/utils/uploadImage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => mockGetSession(...a) } },
}));

// FileReader/canvas aren't implemented in jsdom the way the real browser
// compress() step needs -- readAsDataUrl and compress are exercised already
// by nothing (uploadImage.ts had no test file before this task), so this
// suite stubs them the same way uploadImage()'s own network call is stubbed:
// only uploadImages()'s sequencing/aggregation is under test here.
import * as uploadImageModule from './uploadImage';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('uploadImages', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uploads sequentially, in order, reporting progress before each call', async () => {
    const calls: string[] = [];
    const progress: Array<[number, number]> = [];
    vi.spyOn(uploadImageModule, 'uploadImage').mockImplementation(async (file: File) => {
      calls.push(file.name);
      return { url: `https://drive/${file.name}`, fileName: file.name };
    });

    const files = [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')];
    const result = await uploadImageModule.uploadImages(files, (done, total) => progress.push([done, total]));

    expect(calls).toEqual(['a.png', 'b.png', 'c.png']);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(result.succeeded.map((r) => r.url)).toEqual(['https://drive/a.png', 'https://drive/b.png', 'https://drive/c.png']);
    expect(result.failed).toEqual([]);
  });

  it('keeps already-succeeded uploads and reports a failure without aborting the rest', async () => {
    vi.spyOn(uploadImageModule, 'uploadImage').mockImplementation(async (file: File) => {
      if (file.name === 'bad.png') throw new Error('Upload failed: Google Drive did not return a file URL.');
      return { url: `https://drive/${file.name}`, fileName: file.name };
    });

    const files = [makeFile('a.png'), makeFile('bad.png'), makeFile('c.png')];
    const result = await uploadImageModule.uploadImages(files);

    expect(result.succeeded.map((r) => r.fileName)).toEqual(['a.png', 'c.png']);
    expect(result.failed).toEqual([{ file: files[1], error: 'Upload failed: Google Drive did not return a file URL.' }]);
  });

  it('resolves with two empty arrays for an empty file list, calling onProgress zero times', async () => {
    const onProgress = vi.fn();
    const result = await uploadImageModule.uploadImages([], onProgress);
    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(onProgress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/uploadImage.test.ts`
Expected: FAIL — `uploadImageModule.uploadImages is not a function`.

- [ ] **Step 3: Implement `uploadImages`**

Add to `src/utils/uploadImage.ts`, after the existing `uploadImage` function:

```ts
/**
 * Upload several files one at a time (never Promise.all -- the Apps Script
 * Drive endpoint is prone to slow/cold-start responses, and firing several
 * requests at once against the same Google account's Drive makes that
 * worse, not better). A failed file doesn't abort the rest; the caller gets
 * back both the ones that succeeded (in original order) and the ones that
 * didn't, each with its error message, so a partial failure is visible and
 * the user can retry just the failed slide.
 */
export async function uploadImages(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ succeeded: UploadResult[]; failed: { file: File; error: string }[] }> {
  const succeeded: UploadResult[] = [];
  const failed: { file: File; error: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    try {
      succeeded.push(await uploadImage(files[i]));
    } catch (err: any) {
      failed.push({ file: files[i], error: err?.message || 'Upload failed.' });
    }
  }

  return { succeeded, failed };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/uploadImage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/uploadImage.ts src/utils/uploadImage.test.ts
git commit -m "feat(carousel): add sequential uploadImages() wrapper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ImageCarouselField` component (multi-upload, delete, drag-reorder)

**Files:**
- Modify: `package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Create: `src/components/ui/ImageCarouselField.tsx`
- Create: `src/components/ui/ImageCarouselField.test.tsx`

**Interfaces:**
- Consumes: `uploadImages` from Task 2 (`src/utils/uploadImage.ts`), `coverOf`/`MAX_CAROUSEL_IMAGES` from Task 1 (`src/utils/images.ts`).
- Produces:

```ts
export interface ImageCarouselFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  /** Fires true when an upload starts and false when it ends (success or
   * failure) -- lets a parent that has its own full-panel "uploading" overlay
   * (PostDetailModal, Task 6) stay in sync without owning the upload itself. */
  onUploadingChange?: (uploading: boolean) => void;
}
export const ImageCarouselField: React.FC<ImageCarouselFieldProps>;
export function moveImage(images: string[], fromIndex: number, toIndex: number): string[];
```

Used by Tasks 4-6 (`TemplateLibrary.tsx`, `NewPostModal.tsx`, `PostDetailModal.tsx`) to replace their single-image upload blocks.

- [ ] **Step 1: Add the new dependencies**

In `package.json`'s `"dependencies"` block, add (alphabetically, matching the existing sort):

```json
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
```

Run: `npm install`
Expected: `package-lock.json` updates, install succeeds with no peer-dependency errors (both packages support React 19).

- [ ] **Step 2: Write the failing test for the pure reorder helper**

```ts
// src/components/ui/ImageCarouselField.test.tsx (top of file, alongside the component tests added in later steps)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { moveImage, ImageCarouselField } from './ImageCarouselField';

describe('moveImage', () => {
  it('moves an element from one index to another, shifting the rest', () => {
    expect(moveImage(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveImage(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    expect(moveImage(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/components/ui/ImageCarouselField.test.tsx`
Expected: FAIL — `Failed to resolve import "./ImageCarouselField"`.

- [ ] **Step 4: Implement the component**

```tsx
// src/components/ui/ImageCarouselField.tsx
import React, { useRef, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadImages } from '../../utils/uploadImage';
import { MAX_CAROUSEL_IMAGES } from '../../utils/images';

/** Pure reorder helper -- thin wrapper over dnd-kit's own arrayMove so the
 * drag-end handler and its test both go through one function. */
export function moveImage(images: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return images;
  return arrayMove(images, fromIndex, toIndex);
}

export interface ImageCarouselFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

function SortableThumb({ url, index, onRemove, disabled }: { url: string; index: number; onRemove: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-line)] bg-[var(--color-muted)] group">
      <img src={url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" draggable={false} />
      <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold rounded px-1">{index + 1}</span>
      {!disabled && (
        <>
          <button
            type="button"
            aria-label={`Remove slide ${index + 1}`}
            onClick={onRemove}
            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] leading-4 text-center cursor-pointer"
          >
            ✕
          </button>
          <button
            type="button"
            aria-label={`Drag to reorder slide ${index + 1}`}
            {...attributes}
            {...listeners}
            className="absolute bottom-1 right-1 w-5 h-5 rounded bg-black/70 text-white flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
          </button>
        </>
      )}
    </div>
  );
}

export const ImageCarouselField: React.FC<ImageCarouselFieldProps> = ({ images, onChange, disabled, onUploadingChange }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedNames, setFailedNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const remaining = MAX_CAROUSEL_IMAGES - images.length;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (files.length === 0) return;

    setFailedNames([]);
    setIsUploading(true);
    onUploadingChange?.(true);
    try {
      const { succeeded, failed } = await uploadImages(files, (done, total) => setProgress({ done, total }));
      if (succeeded.length > 0) onChange([...images, ...succeeded.map((r) => r.url)]);
      setFailedNames(failed.map((f) => f.file.name));
    } finally {
      setIsUploading(false);
      setProgress(null);
      onUploadingChange?.(false);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = images.indexOf(String(active.id));
    const to = images.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(moveImage(images, from, to));
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => (
                <SortableThumb
                  key={url}
                  url={url}
                  index={i}
                  disabled={disabled}
                  onRemove={() => onChange(images.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading || remaining <= 0}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-line)] text-xs font-bold text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isUploading
            ? progress
              ? `Uploading slide ${progress.done} of ${progress.total}…`
              : 'Uploading…'
            : remaining <= 0
              ? `${MAX_CAROUSEL_IMAGES}/${MAX_CAROUSEL_IMAGES} — remove a slide to add another`
              : `Add image${remaining > 1 ? 's' : ''} (${images.length}/${MAX_CAROUSEL_IMAGES})`}
        </button>
      </div>

      {failedNames.length > 0 && (
        <p className="text-[10px] text-[var(--color-danger)]">
          Failed to upload: {failedNames.join(', ')}. Try again.
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Run the reorder test to verify it passes**

Run: `npx vitest run src/components/ui/ImageCarouselField.test.tsx`
Expected: PASS (2 tests so far).

- [ ] **Step 6: Add component-level tests (add / remove / cap / partial-failure)**

Append to `src/components/ui/ImageCarouselField.test.tsx`:

```ts
vi.mock('../../utils/uploadImage', () => ({
  uploadImages: vi.fn(),
}));
import { uploadImages } from '../../utils/uploadImage';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('ImageCarouselField', () => {
  it('renders a thumbnail per image with its 1-based slide number', () => {
    render(<ImageCarouselField images={['https://a', 'https://b']} onChange={() => {}} />);
    expect(screen.getByAltText('Slide 1')).toBeTruthy();
    expect(screen.getByAltText('Slide 2')).toBeTruthy();
  });

  it('removing a slide calls onChange with that slide filtered out', () => {
    const onChange = vi.fn();
    render(<ImageCarouselField images={['https://a', 'https://b']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove slide 1'));
    expect(onChange).toHaveBeenCalledWith(['https://b']);
  });

  it('uploads selected files and appends the results to images', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://new', fileName: 'new.png' }],
      failed: [],
    });
    const onChange = vi.fn();
    render(<ImageCarouselField images={['https://a']} onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('new.png')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://a', 'https://new']));
  });

  it('shows failed filenames without discarding successful uploads', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://ok', fileName: 'ok.png' }],
      failed: [{ file: makeFile('bad.png'), error: 'boom' }],
    });
    const onChange = vi.fn();
    render(<ImageCarouselField images={[]} onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('ok.png'), makeFile('bad.png')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://ok']));
    expect(await screen.findByText(/Failed to upload: bad.png/)).toBeTruthy();
  });

  it('disables the add button and shows the cap message at 10 images', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `https://img${i}`);
    render(<ImageCarouselField images={ten} onChange={() => {}} />);
    expect(screen.getByText(/10\/10 — remove a slide/)).toBeTruthy();
    expect(screen.getByText(/10\/10 — remove a slide/).closest('button')).toBeDisabled();
  });

  it('calls onUploadingChange(true) then onUploadingChange(false) around an upload', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({ succeeded: [{ url: 'https://ok', fileName: 'ok.png' }], failed: [] });
    const onUploadingChange = vi.fn();
    render(<ImageCarouselField images={[]} onChange={() => {}} onUploadingChange={onUploadingChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('ok.png')] } });

    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
    expect(onUploadingChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('caps a multi-file selection to the remaining slots', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://new1', fileName: 'n1.png' }],
      failed: [],
    });
    const nine = Array.from({ length: 9 }, (_, i) => `https://img${i}`);
    render(<ImageCarouselField images={nine} onChange={() => {}} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('n1.png'), makeFile('n2.png')] } });

    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith([expect.objectContaining({ name: 'n1.png' })], expect.any(Function)));
  });
});
```

- [ ] **Step 7: Run the full test file**

Run: `npx vitest run src/components/ui/ImageCarouselField.test.tsx`
Expected: PASS (9 tests total).

- [ ] **Step 8: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/components/ui/ImageCarouselField.tsx src/components/ui/ImageCarouselField.test.tsx
git commit -m "feat(carousel): add ImageCarouselField component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire `ImageCarouselField` into `TemplateLibrary`

**Files:**
- Modify: `src/components/TemplateLibrary.tsx`

**Interfaces:**
- Consumes: `ImageCarouselField` (Task 3), `coverOf` (Task 1).
- Produces: nothing new — `PostTemplate.images` (Task 1) is now actually populated through the UI.

- [ ] **Step 1: Replace `newImagePreview` state with `newImages`**

Change (~line 87):

```ts
  const [newImagePreview, setNewImagePreview] = useState('');
```

to:

```ts
  const [newImages, setNewImages] = useState<string[]>([]);
```

Remove the now-unused `handleImageFileUpload` function (~line 109-124) and its `uploadImage`/`isUploading`/`uploadError` state (~line 89-90) — `ImageCarouselField` owns its own upload state internally. Add the import:

```ts
import { ImageCarouselField } from './ui/ImageCarouselField';
import { coverOf } from '../utils/images';
```

(remove the now-unused `import { uploadImage } from '../utils/uploadImage';` at the top).

- [ ] **Step 2: Replace the image field JSX**

Change (~line 821-844):

```tsx
              {/* Image (upload-first: visible without expanding "More options") */}
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                  Image
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newImagePreview}
                    onChange={(e) => setNewImagePreview(e.target.value)}
                    placeholder="https://... or upload below"
                    className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs text-[#1b1c1a] focus:outline-none"
                  />
                  <label className="bg-[#f1f1f0] border border-[#e9e9e7] text-[#4f46e5] px-3 py-2 rounded-lg font-label-caps text-xs font-bold hover:bg-[#4f46e5] hover:text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                  </label>
                </div>
                {uploadError && <p className="text-[10px] text-[#dc2626] mt-1">{uploadError}</p>}
                {newImagePreview && (
                  <img src={newImagePreview} alt="" className="h-24 w-full object-cover rounded-lg border border-[#e9e9e7] mt-2" />
                )}
              </div>
```

to:

```tsx
              {/* Image(s) -- up to 10, reorderable; images[0] is the card cover */}
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                  Image{newImages.length > 1 ? 's' : ''}
                </label>
                <ImageCarouselField images={newImages} onChange={setNewImages} />
              </div>
```

- [ ] **Step 3: Fix the create/edit/reset handlers**

In `handleCreateTemplate` (~line 256-268), change:

```ts
      tags: tagArray.length > 0 ? tagArray : [newCategory],
      imagePreview: newImagePreview.trim(),
      images: newImagePreview.trim() ? [newImagePreview.trim()] : [],
      usesCount: 0
```

(this is Task 1's minimal compile-fix version — confirm it matches what's actually in the file before editing) to:

```ts
      tags: tagArray.length > 0 ? tagArray : [newCategory],
      imagePreview: coverOf(newImages),
      images: newImages,
      usesCount: 0
```

In `handleOpenEditModal` (~line 274-288), change:

```ts
    setNewImagePreview(tpl.imagePreview || '');
    setNewTags((tpl.tags || []).join(', '));
    // Open with "More options" already expanded when there's existing
    // caption/tags/image content to see, so editing doesn't hide data.
    setShowMoreOptions(Boolean(tpl.defaultCaption?.trim() || (tpl.tags && tpl.tags.length > 0) || tpl.imagePreview?.trim()));
```

to:

```ts
    setNewImages(tpl.images || []);
    setNewTags((tpl.tags || []).join(', '));
    // Open with "More options" already expanded when there's existing
    // caption/tags/image content to see, so editing doesn't hide data.
    setShowMoreOptions(Boolean(tpl.defaultCaption?.trim() || (tpl.tags && tpl.tags.length > 0) || (tpl.images && tpl.images.length > 0)));
```

In `handleSaveEditedTemplate` (~line 313-323), change:

```ts
      tags: tagArray.length > 0 ? tagArray : editingTemplate.tags,
      imagePreview: newImagePreview.trim() || editingTemplate.imagePreview
    };
```

to:

```ts
      tags: tagArray.length > 0 ? tagArray : editingTemplate.tags,
      images: newImages.length > 0 ? newImages : editingTemplate.images,
      imagePreview: newImages.length > 0 ? coverOf(newImages) : editingTemplate.imagePreview,
    };
```

In `resetForm` (~line 329-341), change:

```ts
    setNewImagePreview('');
```

to:

```ts
    setNewImages([]);
```

and remove the now-unused `setUploadError(null);` line inside it.

- [ ] **Step 4: Add the slide-count badge to the template card**

At ~line 619, change:

```tsx
                  {template.imagePreview && (
                    <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-100 pointer-events-auto transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:focus-within:opacity-100 md:focus-within:pointer-events-auto">
```

to:

```tsx
                  {template.images && template.images.length > 1 && (
                    <span className="absolute top-3 right-3 mt-6 bg-black/70 text-white font-label-caps text-[9px] px-2 py-0.5 rounded-full backdrop-blur-xs">
                      1/{template.images.length}
                    </span>
                  )}

                  {template.imagePreview && (
                    <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-100 pointer-events-auto transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:focus-within:opacity-100 md:focus-within:pointer-events-auto">
```

(The `mt-6` offsets it below the existing brand-name pill at `top-3 right-3` on the same corner.)

- [ ] **Step 5: Fix `handleDuplicateTemplate` — no change needed, verify**

`handleDuplicateTemplate` (~line 290-298) spreads `...tpl`, so `images` carries over automatically. Confirm by reading the function — no edit required here, just note it in the commit message context.

- [ ] **Step 6: Write the template-carousel test**

Add to `src/components/TemplateLibrary.test.tsx`:

```ts
describe('TemplateLibrary — carousel images', () => {
  it('shows a slide-count badge on a multi-image template card', () => {
    render(
      <BrandsProvider>
        <ConfirmProvider>
          <TemplateLibrary
            templates={[{ ...tpl('t1', 'Clinical'), images: ['https://a', 'https://b', 'https://c'], imagePreview: 'https://a' }]}
            onUseTemplate={() => {}}
            onSaveNewTemplate={() => {}}
            onUpdateTemplate={() => {}}
            onDeleteTemplate={() => {}}
            selectedBrandFilter="all"
          />
        </ConfirmProvider>
      </BrandsProvider>,
    );
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('does not show a badge on a single-image template card', () => {
    render(
      <BrandsProvider>
        <ConfirmProvider>
          <TemplateLibrary
            templates={[{ ...tpl('t1', 'Clinical'), images: ['https://a'], imagePreview: 'https://a' }]}
            onUseTemplate={() => {}}
            onSaveNewTemplate={() => {}}
            onUpdateTemplate={() => {}}
            onDeleteTemplate={() => {}}
            selectedBrandFilter="all"
          />
        </ConfirmProvider>
      </BrandsProvider>,
    );
    expect(screen.queryByText(/^1\//)).toBeNull();
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/components/TemplateLibrary.test.tsx`
Expected: PASS (3 tests: the pre-existing category-rename test plus the 2 new ones).

- [ ] **Step 8: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/TemplateLibrary.tsx src/components/TemplateLibrary.test.tsx
git commit -m "feat(carousel): wire ImageCarouselField into TemplateLibrary

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire `ImageCarouselField` into `NewPostModal` + template→post inheritance

**Files:**
- Modify: `src/components/NewPostModal.tsx`
- Modify: `src/hooks/useSmartMemory.ts` (`PostDraft`, ~line 43-54)

**Interfaces:**
- Consumes: `ImageCarouselField` (Task 3), `coverOf` (Task 1).
- Produces: nothing new — `Post.images` (Task 1) is now populated at creation time, and inherited from a carousel template.

- [ ] **Step 1: Add `images` to `PostDraft`**

In `src/hooks/useSmartMemory.ts` (~line 51), change:

```ts
  visualUrl?: string;
```

to:

```ts
  visualUrl?: string;
  images?: string[];
```

- [ ] **Step 2: Add `images` state and wire the template-pickup effect**

In `src/components/NewPostModal.tsx`, change (~line 99):

```ts
  const [visualUrl, setVisualUrl] = useState(initialDraft?.visualUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

to:

```ts
  const [images, setImages] = useState<string[]>(initialDraft?.images || (initialDraft?.visualUrl ? [initialDraft.visualUrl] : []));
  const visualUrl = coverOf(images);
```

(remove `isUploading`, `uploadError`, `fileInputRef` — `ImageCarouselField` owns that state; `visualUrl` becomes a derived `const`, no longer its own `useState`.)

Also remove the three blocks that state fed: the `uploadFile` function (~line 161-172), `handleImageFileUpload` (~line 174-178), and the drop-zone hook call right after it:

```ts
  const { isDragging, dropHandlers } = useImageUploadZone(uploadFile, isUploading);
```

All three become dead code once `ImageCarouselField` owns uploading — `uploadFile`/`handleImageFileUpload` are superseded by the component's own internal `uploadImages()` call, and the paste/drag-drop zone's sole caller (the JSX block replaced in Step 4 below) is gone too.

Add the import:

```ts
import { ImageCarouselField } from './ui/ImageCarouselField';
import { coverOf } from '../utils/images';
```

(remove the now-unused `import { uploadImage } from '../utils/uploadImage';` and `import { useImageUploadZone } from '../hooks/useImageUploadZone';` — the drop-zone/paste convenience is superseded by `ImageCarouselField`'s multi-file picker, matching the spec's decision not to keep two separate upload UIs on the same field.)

Change the template-pickup effect (~line 118-130):

```ts
  useEffect(() => {
    if (initialTemplateId) {
      const tpl = templates.find((t) => t.id === initialTemplateId);
      if (tpl) {
        setTitle(tpl.title);
        if (tpl.brandId !== 'shared') setBrandId(tpl.brandId);
        setCaption(tpl.defaultCaption);
        setPlatform(tpl.platform);
        setSpecType(tpl.specType);
        if (tpl.imagePreview) setVisualUrl(tpl.imagePreview);
      }
    }
  }, [initialTemplateId, templates]);
```

to:

```ts
  useEffect(() => {
    if (initialTemplateId) {
      const tpl = templates.find((t) => t.id === initialTemplateId);
      if (tpl) {
        setTitle(tpl.title);
        if (tpl.brandId !== 'shared') setBrandId(tpl.brandId);
        setCaption(tpl.defaultCaption);
        setPlatform(tpl.platform);
        setSpecType(tpl.specType);
        if (tpl.images.length) setImages(tpl.images);
      }
    }
  }, [initialTemplateId, templates]);
```

- [ ] **Step 3: Fix the autosave effect and dependency array**

Change (~line 138-153):

```ts
  useEffect(() => {
    if (isDirty) {
      saveDraft({
        title,
        caption,
        brandId,
        platform,
        scheduledDate: isBacklog ? '' : scheduledDate,
        scheduledTime: isBacklog ? '' : scheduledTime,
        assignees,
        visualUrl,
        reminderEmail
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, caption, brandId, platform, isBacklog, scheduledDate, scheduledTime, assignees, visualUrl, reminderEmail, saveDraft]);
```

to:

```ts
  useEffect(() => {
    if (isDirty) {
      saveDraft({
        title,
        caption,
        brandId,
        platform,
        scheduledDate: isBacklog ? '' : scheduledDate,
        scheduledTime: isBacklog ? '' : scheduledTime,
        assignees,
        visualUrl,
        images,
        reminderEmail
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, caption, brandId, platform, isBacklog, scheduledDate, scheduledTime, assignees, images, reminderEmail, saveDraft]);
```

- [ ] **Step 4: Replace the image field JSX**

Change (~line 528-577):

```tsx
              <div className="flex items-center gap-4">
                <div
                  {...dropHandlers}
                  className={`w-24 h-24 rounded-lg bg-[var(--color-muted)] border-2 border-dashed overflow-hidden flex items-center justify-center relative flex-shrink-0 transition-colors ${
                    isDragging ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[var(--color-line)]'
                  }`}
                  title="Drop an image or paste a screenshot"
                >
                  {visualUrl ? (
                    <img src={visualUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-[var(--color-ink-muted)]">
                      {isDragging ? 'download' : 'image'}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon="upload"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : visualUrl ? 'Replace image' : 'Upload image'}
                    </Button>
                    {visualUrl && (
                      <button
                        type="button"
                        onClick={() => setVisualUrl('')}
                        className="px-2 py-1 text-xs text-[var(--color-danger)] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--color-ink-muted)]">Max 5MB (JPG, PNG, WebP)</p>
                  {uploadError && <p className="text-[10px] text-[var(--color-danger)]">{uploadError}</p>}
                </div>
              </div>
```

to:

```tsx
              <ImageCarouselField images={images} onChange={setImages} />
```

- [ ] **Step 5: Fix `handleSubmit`**

Change (~line 306-318):

```ts
      visualUrl,
      images: visualUrl ? [visualUrl] : [],
      approved: false,
```

(this is Task 1's minimal compile-fix version, using the old `visualUrl` state var — confirm it matches what's actually in the file before editing; by this step `visualUrl` is already the derived `const` from Step 2 above) to:

```ts
      visualUrl,
      images,
      approved: false,
```

- [ ] **Step 6: Fix `handleSendTestEmail`'s payload — no change needed, verify**

`handleSendTestEmail` (~line 199-218) sends `visualUrl` (the cover) to the reminder email, unchanged per the spec's "external sync stays cover-only" rule. No edit — just confirm `visualUrl` (now the derived `const`) still resolves correctly there.

- [ ] **Step 7: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS. (`NewPostModal.tsx` has no dedicated test file today — its behavior here is covered by `ImageCarouselField`'s own tests plus the manual browser sweep in Task 7's follow-up.)

- [ ] **Step 8: Commit**

```bash
git add src/components/NewPostModal.tsx src/hooks/useSmartMemory.ts
git commit -m "feat(carousel): wire ImageCarouselField into NewPostModal, inherit template images

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire `ImageCarouselField` into `PostDetailModal` + slide-count badges on calendar surfaces

**Files:**
- Modify: `src/components/PostDetailModal.tsx`
- Modify: `src/components/calendar/MobileDateStripView.tsx` (~line 273-277)
- Modify: `src/components/calendar/IdeaBacklog.tsx` (~line 245-249)
- Modify: `src/components/CalendarView.tsx` (inspector panel image box, ~line 879-893)

**Interfaces:**
- Consumes: `ImageCarouselField` (Task 3), `coverOf` (Task 1).
- Produces: nothing new — this is the last of the three upload-UI call sites.

- [ ] **Step 1: Replace the upload logic in `PostDetailModal.tsx`**

Keep the existing `isUploading`/`setIsUploading` state (~line 48) as-is — it also drives an unrelated full-modal "Uploading Image..." spinner overlay at ~line 246, outside the image field block. `ImageCarouselField`'s new `onUploadingChange` prop (Task 3) will keep it in sync from outside instead of `PostDetailModal` running the upload itself. Only remove `uploadError`'s state (~line 49) — its display is superseded by `ImageCarouselField`'s own inline failed-upload message.

Change `uploadFile` (~line 132-156):

```ts
  // Upload to Drive and store only the returned URL — never base64.
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);
      const actorName = activeTeammate ? activeTeammate.name : (editedPost.assignees[0] || 'Someone');
      setEditedPost((prev) => ({
        ...prev,
        visualUrl: url,
        activityLog: [
          {
            id: `act-${Date.now()}`,
            actor: actorName,
            action: `Added image "${file.name}"`,
            timestamp: logTimestamp()
          },
          ...prev.activityLog
        ]
      }));
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadFile(file);
  };

  const { isDragging, dropHandlers } = useImageUploadZone(uploadFile, isUploading);
```

to:

```ts
  const handleImagesChange = (images: string[]) => {
    const actorName = activeTeammate ? activeTeammate.name : (editedPost.assignees[0] || 'Someone');
    const added = images.length > editedPost.images.length;
    setEditedPost((prev) => ({
      ...prev,
      images,
      visualUrl: coverOf(images),
      activityLog: added
        ? [
            { id: `act-${Date.now()}`, actor: actorName, action: 'Updated post image(s)', timestamp: logTimestamp() },
            ...prev.activityLog,
          ]
        : prev.activityLog,
    }));
  };
```

Remove the now-unused `import { uploadImage } from '../utils/uploadImage';` and `import { useImageUploadZone } from '../hooks/useImageUploadZone';` lines, and add:

```ts
import { ImageCarouselField } from './ui/ImageCarouselField';
import { coverOf } from '../utils/images';
```

- [ ] **Step 2: Replace the image field JSX**

Change (~line 812-879):

```tsx
            {/* Image */}
            <div className="space-y-3">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Image
              </label>

              {/* Preview Box -- also a drop target; a screenshot can be pasted
                  anywhere in the modal. */}
              <div
                {...dropHandlers}
                className={`h-44 bg-white border rounded overflow-hidden flex items-center justify-center relative shadow-inner transition-colors ${
                  isDragging ? 'border-[#4f46e5] border-2 bg-[#eef2ff]' : 'border-[#e9e9e7]'
                }`}
              >
                {editedPost.visualUrl ? (
                  <img
                    src={editedPost.visualUrl}
                    alt="Post image"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-[#5f5f5b]">
                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                    <p className="font-label-caps text-xs mt-1">
                      {isDragging ? 'Drop to upload' : 'Drop an image, paste a screenshot, or use the picker below'}
                    </p>
                  </div>
                )}
              </div>

              {/* Attachment Inputs */}
              <div className="space-y-2">
                <div>
                  <label className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                    Upload from your device
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="w-full text-xs font-label-caps text-[#57574f] file:mr-2 file:py-1 file:px-3 file:border-0 file:text-xs file:font-label-caps file:bg-[#4f46e5] file:text-white hover:file:bg-[#4338ca] disabled:opacity-60"
                  />
                  {isUploading && (
                    <p className="mt-1 text-[10px] font-label-caps text-[#4f46e5]">Uploading…</p>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-[11px] font-body-md text-[#dc2626] bg-[#fcebeb] border border-[#ffb4ab] rounded p-2">
                      {uploadError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                    Or paste a link (Drive, Canva, Figma)
                  </label>
                  <input
                    type="text"
                    value={editedPost.visualUrl}
                    onChange={(e) => setEditedPost({ ...editedPost, visualUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-white border border-[#e9e9e7] p-1.5 font-code-sm text-xs text-[#1b1c1a]"
                  />
                </div>
              </div>
            </div>
```

to:

```tsx
            {/* Image(s) -- up to 10, reorderable; images[0] is the cover shown
                on the calendar, Sheets sync, and the reminder email. */}
            <div className="space-y-3">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Image{editedPost.images.length > 1 ? 's' : ''}
              </label>
              <ImageCarouselField images={editedPost.images} onChange={handleImagesChange} onUploadingChange={setIsUploading} />
            </div>
```

- [ ] **Step 3: Add the slide-count badge to `MobileDateStripView.tsx`**

Change (~line 273-277):

```tsx
                    {post.visualUrl && (
                      <div className="w-14 h-14 mt-0.5 rounded overflow-hidden border border-[#e9e9e7] bg-[#f4f4f3] flex-shrink-0">
                        <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}
```

to:

```tsx
                    {post.visualUrl && (
                      <div className="relative w-14 h-14 mt-0.5 rounded overflow-hidden border border-[#e9e9e7] bg-[#f4f4f3] flex-shrink-0">
                        <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                        {post.images && post.images.length > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] font-bold rounded px-1">
                            1/{post.images.length}
                          </span>
                        )}
                      </div>
                    )}
```

- [ ] **Step 4: Add the slide-count badge to `IdeaBacklog.tsx`**

Change (~line 245-249):

```tsx
                {post.visualUrl && (
                  <div className="my-1.5 h-16 w-full rounded overflow-hidden border border-[#efefed] bg-[#f4f4f3]">
                    <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
```

to:

```tsx
                {post.visualUrl && (
                  <div className="relative my-1.5 h-16 w-full rounded overflow-hidden border border-[#efefed] bg-[#f4f4f3]">
                    <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                    {post.images && post.images.length > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold rounded px-1.5 py-0.5">
                        1/{post.images.length}
                      </span>
                    )}
                  </div>
                )}
```

- [ ] **Step 5: Add the slide-count badge to `CalendarView.tsx`'s inspector panel**

Change (~line 881-893):

```tsx
                <div className="h-36 sm:h-40 w-full bg-white border border-[#e9e9e7] rounded overflow-hidden flex items-center justify-center relative">
                  {inspectorPost.visualUrl ? (
                    <img src={inspectorPost.visualUrl} alt={inspectorPost.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 text-[#5f5f5b]">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <p className="font-label-caps text-[10px] mt-1">No image yet</p>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-[#1b1c1a]/80 text-white font-label-caps text-[9px] px-2 py-0.5 rounded">
                    {SPECS[inspectorPost.specType]?.dimensions || inspectorPost.specType}
                  </span>
                </div>
```

to:

```tsx
                <div className="h-36 sm:h-40 w-full bg-white border border-[#e9e9e7] rounded overflow-hidden flex items-center justify-center relative">
                  {inspectorPost.visualUrl ? (
                    <img src={inspectorPost.visualUrl} alt={inspectorPost.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 text-[#5f5f5b]">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <p className="font-label-caps text-[10px] mt-1">No image yet</p>
                    </div>
                  )}
                  {inspectorPost.images && inspectorPost.images.length > 1 && (
                    <span className="absolute top-2 right-2 bg-[#1b1c1a]/80 text-white font-label-caps text-[9px] px-2 py-0.5 rounded">
                      1/{inspectorPost.images.length}
                    </span>
                  )}
                  <span className="absolute bottom-2 left-2 bg-[#1b1c1a]/80 text-white font-label-caps text-[9px] px-2 py-0.5 rounded">
                    {SPECS[inspectorPost.specType]?.dimensions || inspectorPost.specType}
                  </span>
                </div>
```

- [ ] **Step 6: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS. (None of these four files has a dedicated test file today — covered by `ImageCarouselField`'s own tests plus the manual browser sweep after Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/components/PostDetailModal.tsx src/components/calendar/MobileDateStripView.tsx src/components/calendar/IdeaBacklog.tsx src/components/CalendarView.tsx
git commit -m "feat(carousel): wire ImageCarouselField into PostDetailModal, add slide-count badges

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Delete-cascade extension for multi-image records

**Files:**
- Modify: `src/utils/fileCleanup.ts` (`isFileStillReferenced`, ~line 80-95)
- Modify: `src/App.tsx` (`handleDeletePost`'s `onAfterDelete` ~line 186-188, `handleDeleteTemplate` ~line 408)
- Modify: `src/utils/fileCleanup.test.ts`

**Interfaces:**
- Consumes: `Post.images`/`PostTemplate.images` (Task 1).
- Produces: nothing new — closes the gap this plan opens in the already-shipped delete-cascade feature ([[pzcms_delete_cascade]]).

This is the one correctness gap every other task in this plan silently introduces: without it, deleting a carousel post/template only reference-counts its **cover** slide (`visualUrl`/`imagePreview`) — every other slide in `images` would be treated as unreferenced and wrongly cascade-deleted even if another record still uses it.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/fileCleanup.test.ts` (after the existing `isFileStillReferenced` describe block — check the file for its exact location and existing helpers `post`/`tpl` at ~line 71-72 before adding):

```ts
describe('isFileStillReferenced — multi-image records', () => {
  const DRIVE_URL = 'https://lh3.googleusercontent.com/d/SLIDE2';

  it('treats a slide referenced by another post (not its cover) as still referenced', () => {
    const records = {
      ...emptyRecords,
      posts: [
        { id: 'other', visualUrl: 'https://lh3.googleusercontent.com/d/COVER', images: ['https://lh3.googleusercontent.com/d/COVER', DRIVE_URL] } as never,
      ],
    };
    expect(isFileStillReferenced({ backend: 'drive', fileId: 'SLIDE2' }, records, 'this-post')).toBe(true);
  });

  it('treats a slide referenced by another template (not its cover) as still referenced', () => {
    const records = {
      ...emptyRecords,
      templates: [
        { id: 'other', imagePreview: 'https://lh3.googleusercontent.com/d/COVER', images: ['https://lh3.googleusercontent.com/d/COVER', DRIVE_URL] } as never,
      ],
    };
    expect(isFileStillReferenced({ backend: 'drive', fileId: 'SLIDE2' }, records, 'this-template')).toBe(true);
  });

  it('excludeId still excludes a record\'s own non-cover slides', () => {
    const records = {
      ...emptyRecords,
      posts: [
        { id: 'this-post', visualUrl: 'https://lh3.googleusercontent.com/d/COVER', images: ['https://lh3.googleusercontent.com/d/COVER', DRIVE_URL] } as never,
      ],
    };
    expect(isFileStillReferenced({ backend: 'drive', fileId: 'SLIDE2' }, records, 'this-post')).toBe(false);
  });

  it('a slide unique to one record is not referenced once that record is excluded', () => {
    const records = { ...emptyRecords, posts: [{ id: 'this-post', visualUrl: '', images: [DRIVE_URL] } as never] };
    expect(isFileStillReferenced({ backend: 'drive', fileId: 'SLIDE2' }, records, 'this-post')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/fileCleanup.test.ts`
Expected: FAIL on the first two new tests — the current scan only checks `visualUrl`/`imagePreview`, so `SLIDE2` (a non-cover slide) isn't found on `other`'s record.

- [ ] **Step 3: Extend `isFileStillReferenced`**

In `src/utils/fileCleanup.ts` (~line 86-88), change:

```ts
    records.posts.some((p) => p.id !== excludeId && hit(identifyFile({ url: p.visualUrl }))) ||
    records.templates.some((t) => t.id !== excludeId && hit(identifyFile({ url: t.imagePreview }))) ||
```

to:

```ts
    records.posts.some((p) => p.id !== excludeId &&
      (hit(identifyFile({ url: p.visualUrl })) || (p.images || []).some((u) => hit(identifyFile({ url: u }))))) ||
    records.templates.some((t) => t.id !== excludeId &&
      (hit(identifyFile({ url: t.imagePreview })) || (t.images || []).some((u) => hit(identifyFile({ url: u }))))) ||
```

(`p.images || []`/`t.images || []` guard the same `as never` test fixtures elsewhere in this file that only set `visualUrl`/`imagePreview` and omit `images` entirely.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/fileCleanup.test.ts`
Expected: PASS (all tests in the file, including the 4 new ones).

- [ ] **Step 5: Fan out the cascade calls in `App.tsx`**

Change `handleDeletePost`'s `onAfterDelete` (~line 186-188):

```ts
  } = usePosts(showToast, activeTeammate, (removed) => {
    cascadeFor({ url: removed.visualUrl }, removed.id, { deferMs: 6000 });
  });
```

to:

```ts
  } = usePosts(showToast, activeTeammate, (removed) => {
    (removed.images.length ? removed.images : [removed.visualUrl]).forEach((url) =>
      cascadeFor({ url }, removed.id, { deferMs: 6000 }),
    );
  });
```

(the `removed.images.length ? removed.images : [removed.visualUrl]` fallback covers a post cached in localStorage before this feature shipped and never re-saved, so `images` could still be `[]` while `visualUrl` is set — `getStoredPosts`'s Task 1 normalization only runs at load time, not retroactively on every post already sitting in React state before that reload.)

Change `handleDeleteTemplate` (~line 408):

```ts
  const handleDeleteTemplate = (id: string) => { const removed = templates.find((t) => t.id === id); setTemplates((prev) => prev.filter((t) => t.id !== id)); deleteRemoteTemplate(id); if (removed) cascadeFor({ url: removed.imagePreview }, id); showToast('Template deleted.'); };
```

to:

```ts
  const handleDeleteTemplate = (id: string) => {
    const removed = templates.find((t) => t.id === id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteRemoteTemplate(id);
    if (removed) {
      (removed.images.length ? removed.images : [removed.imagePreview]).forEach((url) => cascadeFor({ url }, id));
    }
    showToast('Template deleted.');
  };
```

- [ ] **Step 6: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/fileCleanup.ts src/utils/fileCleanup.test.ts src/App.tsx
git commit -m "fix(carousel): reference-count and cascade-delete every carousel slide, not just the cover

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Manual browser sweep (before merge, per [[pzcms_sdd_workflow]])**

Against a local dev server (or preview deploy), logged in as Admin:

1. Create a template, add 3 images via the new carousel field, confirm drag-reorder actually swaps slide order and the card badge reads "1/3".
2. Create a post from that template — confirm all 3 images arrive on the post, in the same order.
3. Open the post, remove 1 slide, add a 4th — confirm the calendar thumbnail badge updates to "1/3" (or whatever the new count is) and the cover (`images[0]`) matches what's shown everywhere else (calendar day cell, backlog card, reminder email test-send).
4. Delete that post — confirm all its Drive files end up trashed except any slide still shared with another post/template (create a quick duplicate first to verify the shared-slide case is skipped).
5. Confirm selecting 11+ files at once in `ImageCarouselField` silently caps at 10 with the "10/10" message, no crash.
6. Confirm a pre-existing single-image post/template (created before this feature shipped) still opens, edits, and displays correctly — this exercises the `getStoredPosts`/`getStoredTemplates` and `rowToPost`/`rowToTemplate` backfill/normalization paths from Task 1.

---

## Post-merge note

Migration `0022_carousel_images.sql` must be applied by the user in the Supabase SQL editor (project `sgevopyvcsclkasvekah`) before any of this is usable in production — same pattern as `0018`-`0021`. No Apps Script redeploy is needed for this feature.
