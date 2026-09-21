# Multi-Image Carousel Support (Posts + Templates)

**Date:** 2026-09-22
**Branch:** TBD (forked from `main` — includes `fix/delete-cascade-cleanup` if merged first)
**Status:** Approved design, pending implementation plan

---

## 1. Goal

Templates and Posts currently support exactly one image (`PostTemplate.imagePreview`,
`Post.visualUrl`). A "Carousels" template category already exists, but nothing lets
a user actually attach more than one image — there's no way to build or reuse a
real Instagram-style multi-slide carousel in the app.

Add ordered multi-image support to both Templates and Posts: upload up to 10
images, reorder them by drag, delete individual slides, and have a carousel
template hand its full slide set to any post created from it.

## 2. Current state

| Type | Field | Shape |
|---|---|---|
| `Post` | `visualUrl: string` | single Drive/Storage URL or external link |
| `PostTemplate` | `imagePreview: string` | same |

Both fields are read in ~27 files (`grep` count for `visualUrl\|imagePreview`
across `src/`), but the *meaningful* consumers are:

- **Upload:** `NewPostModal.tsx` (`handleImageFileUpload`, ~line 159-174),
  `TemplateLibrary.tsx` (`handleImageFileUpload`, ~line 109) — both call the same
  `uploadImage()` (one file per call, unchanged by this spec).
- **Template → Post:** `NewPostModal.tsx:127` — `if (tpl.imagePreview) setVisualUrl(tpl.imagePreview)`
  when a template is picked. `quickPost.ts:35` sets `visualUrl: ''` for a fresh post.
- **Display:** template cards (`TemplateLibrary.tsx`), `PostDetailModal.tsx`,
  calendar thumbnails (`CalendarView.tsx`, `MobileDateStripView.tsx`,
  `calendar/IdeaBacklog.tsx`).
- **External sync (must NOT need changes):** Google Sheets sync
  (`googleAppsScript.ts`), reminder email HTML (`api/appscript/proxy.ts`'s Brevo
  block embeds `post.visualUrl` in an `<img>` tag), `export.ts`.
- **Delete-cascade** (shipped [[pzcms_delete_cascade]]): `fileCleanup.ts`'s
  `isFileStillReferenced` scans `p.visualUrl` / `t.imagePreview` only (lines 87-88);
  `App.tsx:187` and `:408` call `cascadeFor` once per record with that single URL.

## 3. Approach

**Additive `images: string[]` column + field, old single field becomes a derived,
always-in-sync cover.** No new upload infrastructure, no Apps Script change, no
new server endpoint — this is a data-shape and UI change layered on the existing
per-file upload/delete plumbing.

Rejected alternatives:

- **Replace `visualUrl`/`imagePreview` outright with `images[]`.** Forces every
  one of the ~27 touch points (Sheets sync, reminder email, calendar thumbnails,
  delete-cascade) to change to `images[0]` or a loop, for consumers that only ever
  needed *a* cover image and don't care about the carousel. More churn, more
  regression surface, for a set of callers that has no reason to know carousels
  exist.
- **Separate `carousel_images` join table (one row per image, per post/template).**
  Proper normalized shape, but this project's Supabase usage elsewhere (assets,
  brand kits) already uses `jsonb` array columns for ordered small lists — a join
  table adds migration/query complexity (ordering column, cascade-delete FK) this
  project has never needed before. `jsonb` array matches existing conventions and
  Postgres handles ordered small arrays fine at this scale.

## 4. Data model

New migration `supabase/migrations/0022_carousel_images.sql` (idempotent, matching
the style of `0018`-`0021`). The actual Supabase table for templates is `templates`
(verified in `src/utils/storage.ts`), not `post_templates`:

```sql
alter table posts add column if not exists images jsonb not null default '[]'::jsonb;
alter table templates add column if not exists images jsonb not null default '[]'::jsonb;

update posts set images = jsonb_build_array(visual_url)
  where images = '[]'::jsonb and coalesce(visual_url, '') <> '';

update templates set images = jsonb_build_array(image_preview)
  where images = '[]'::jsonb and coalesce(image_preview, '') <> '';
```

`visual_url` / `image_preview` columns are **not dropped**. Every write path
(create/edit post or template) keeps them in sync as `images[0] ?? ''` alongside
writing `images`, so every existing reader — Sheets sync, reminder email, exports,
delete-cascade's current scan — keeps working unchanged on rows written after this
ships. (Delete-cascade's scan is still extended per §8, because a slide *other
than* the cover also needs to be reference-counted.)

## 5. Types

```ts
export interface Post {
  // ...
  visualUrl: string;   // derived: images[0] ?? '' — kept in sync on every write
  images: string[];    // ordered, max 10 enforced in UI only
  // ...
}

export interface PostTemplate {
  // ...
  imagePreview: string; // derived, same rule
  images: string[];
  // ...
}
```

No computed-property/getter machinery — `visualUrl`/`imagePreview` are plain
fields set explicitly wherever `images` is set (post/template create, edit, and
the template→post inheritance in §7). One helper,
`coverOf(images: string[]): string => images[0] ?? ''`, used at every one of those
write sites so the sync rule lives in one place.

## 6. Upload flow

No Apps Script or proxy change. New wrapper in `uploadImage.ts`:

```ts
export async function uploadImages(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ succeeded: UploadResult[]; failed: { file: File; error: string }[] }>
```

Uploads sequentially (`for` loop with `await`, not `Promise.all`) — the cold-start
timeout risk already observed against the Apps Script Web App makes concurrent
calls to the same Google account's Drive worse, not better. Calls
`onProgress(i + 1, files.length)` before each upload starts, so the UI can show
"Uploading slide 3 of 7…". A failed slide is reported in `failed[]` without
aborting the remaining uploads or discarding already-`succeeded` ones — the caller
appends `succeeded` results to the `images` array and surfaces `failed` entries as
per-slide retry prompts.

## 7. UI: slide manager component

New `src/components/ui/ImageCarouselField.tsx`:

- Props: `images: string[]`, `onChange: (images: string[]) => void`, `maxImages = 10`.
- Grid of thumbnails, each with a ✕ delete button and a drag handle.
- Drag-and-drop reorder via `@dnd-kit/core` + `@dnd-kit/sortable` (new
  dependencies — not currently in `package.json`).
- "Add image(s)" button (multi-select `<input type="file" multiple accept="image/*">`)
  wired to `uploadImages()`, disabled once `images.length >= maxImages` with a
  "10/10 — remove a slide to add another" hint.
- Per-slide progress state while `uploadImages` is running (§6).

Replaces the current single `<input type="file">` + preview `<img>` block in:

- `TemplateLibrary.tsx` create/edit modal (~line 821-842).
- `NewPostModal.tsx` image step (~line 536-564).
- `PostDetailModal.tsx`'s own image editor (same pattern as `NewPostModal`).

## 8. Template → Post inheritance

`NewPostModal.tsx:127` — when a template is selected, currently:

```ts
if (tpl.imagePreview) setVisualUrl(tpl.imagePreview);
```

becomes:

```ts
if (tpl.images.length) { setImages(tpl.images); setVisualUrl(coverOf(tpl.images)); }
```

Copies the full ordered slide set into the new post's local `images` state
(editable afterward — user can delete/add/reorder before saving). `quickPost.ts`
(backlog quick-add) keeps `images: []` for a fresh, template-less post, same as
today's `visualUrl: ''`.

## 9. Display

- **Template cards / post cards / calendar thumbnails:** unchanged — render
  `imagePreview`/`visualUrl` (the cover), no consumer needs to know about
  carousels. Add a small "1/7" slide-count badge on the thumbnail when
  `images.length > 1`, in `TemplateLibrary.tsx` card render, `PostDetailModal.tsx`,
  and calendar thumbnail components.
- **Full carousel view:** `PostDetailModal.tsx` and the template preview gain a
  lightweight prev/next paginated viewer (no new dependency) shown whenever
  `images.length > 1`; single-image records render exactly as today (no viewer
  chrome added for the common case).

## 10. Delete-cascade extension

Two required changes to keep the shipped delete-cascade feature ([[pzcms_delete_cascade]])
correct once records can hold more than one image:

**`fileCleanup.ts:isFileStillReferenced`** (currently lines 87-88) — extend the
scan to also check each record's `images[]`, not just the derived cover field:

```ts
records.posts.some((p) => p.id !== excludeId &&
  (hit(identifyFile({ url: p.visualUrl })) || p.images.some((u) => hit(identifyFile({ url: u }))))) ||
records.templates.some((t) => t.id !== excludeId &&
  (hit(identifyFile({ url: t.imagePreview })) || t.images.some((u) => hit(identifyFile({ url: u }))))) ||
```

Without this, deleting a carousel post/template would only reference-count its
cover slide — every other slide would be treated as unreferenced even if another
record (e.g. a duplicated post) still uses it, and get wrongly cascade-deleted.

**`App.tsx:187` (post delete) and `App.tsx:408` (template delete)** — loop
`cascadeFor` once per URL in `images`, instead of once for the single derived
field:

```ts
// App.tsx:187, inside handleDeletePost's onAfterDelete
removed.images.forEach((url) => cascadeFor({ url }, removed.id, { deferMs: 6000 }));

// App.tsx:408, handleDeleteTemplate
removed.images.forEach((url) => cascadeFor({ url }, id));
```

`cascadeFor`/`fileCleanup.ts`'s per-file logic itself (`identifyFile`,
`isFileStillReferenced`'s exclude-id handling, the retry queue, `scheduleFileDelete`'s
6s deferral) needs **no other change** — it already resolves and deletes one
`FileRef` at a time correctly; this is purely a call-site fan-out plus the scan fix
above.

## 11. Testing

Unit (Vitest, `globals: false`):

- `uploadImages` — sequential order, `onProgress` called per slide, one failing
  upload doesn't abort the rest, `succeeded`/`failed` partition is correct.
- `isFileStillReferenced` — a slide (not the cover) shared between two posts is
  correctly treated as referenced; a slide unique to one deleted record is not.
- `App.tsx` cascade wiring (or `cascadeFor`-level test if extracted similarly to
  the existing `cascadeFor.test.ts`) — deleting a 3-image post schedules 3
  `cascadeFor` calls, each with the right URL and `deferMs`.
- `ImageCarouselField` — add up to cap (11th add rejected/disabled), delete a
  slide, reorder via `@dnd-kit`'s test utilities, `onChange` emits the right order.
- `coverOf` — empty array → `''`, non-empty → first element.
- Template→post inheritance — selecting a carousel template populates `images`
  and `visualUrl` (cover) on the new post's draft state.

Not unit-testable, needs the manual browser sweep before merge (per
[[pzcms_sdd_workflow]]): actual drag-reorder feel, actual sequential Drive uploads
of several real images (timing/cold-start behavior), verifying Sheets sync and the
reminder email still show only the cover image unchanged.

## 12. Out of scope

- Per-platform validation (e.g. warning if a carousel is attached to a
  single-image-only platform selection) — YAGNI, `platform` is informational today.
- Video slides / mixed image+video carousels — image-only, matching the existing
  single-image upload's `image/*` accept restriction.
- Bulk carousel reordering across templates/posts (e.g. "apply this slide order to
  all posts using this template") — out of scope, no such bulk-edit concept exists
  elsewhere in the app.
- Retroactive carousel-ification of existing single-image posts/templates beyond
  the automatic `images = [visualUrl]` backfill in the migration.
