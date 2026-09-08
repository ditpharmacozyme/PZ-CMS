# Brand & Template Customization — Batch 2

**Date:** 2026-09-03
**Branch:** `feat/customization-batch` (forked from `main` @ `dbb3478`)
**Status:** Approved design, pending implementation plan

---

## 1. Goal

Three user-reported gaps, all confirmed, bundled because they share a theme (make
hardcoded config user-editable) and two data-layer additions:

1. **Item 5 — Brand Kit is not editable.** `src/data/brands.ts` is a static
   `Record<BrandId, BrandConfig>` imported directly by 23 files. Colours, logos,
   voice rules, fonts, and text are all frozen in code. The team wants to edit
   every brand field in-app, shared across all users.
2. **Item 4 — Template categories are uncontrolled.** `PostTemplate['category']`
   is a fixed 5-value union (`Clinical | Interactive | Editorial | Patient-Facing
   | Internal`). The team wants per-brand category lists they can add / rename /
   reorder / delete. Also: the create/edit-template modal hides the image upload
   inside a collapsed "More options" accordion — it should be visible up front.
3. **Item 6 — Asset upload is manual.** The "Add Brand Asset" modal only takes a
   pasted URL plus hand-typed file type and size. The team wants to upload an
   actual file (image / PDF / doc). The existing Drive upload path caps at 3 MB
   (Vercel serverless body limit — see the spike below); brand assets (fonts,
   vector packs) can exceed that.

### Spike result (item 6 upload ceiling)

The 3 MB cap is **only** the Vercel proxy hop (`/api/appscript/proxy`, 4.5 MB
platform body limit, ~33% base64 inflation). Apps Script (~50 MB) and Drive are
not the bottleneck. Chosen fix: **Supabase Storage** — the browser uploads
directly to a bucket (no Vercel hop, 50 MB default per-file cap, existing session
for auth). Storage is currently unused in the project; this establishes the
pattern. The manual "paste a Drive link" field stays as a fallback for files
already in Drive or over the cap.

### Constraints

- Multi-user app on Supabase; every persisted thing follows the existing
  `use*` hook → `getStored*` (localStorage cache) + `fetchRemote*` (Supabase on
  mount) + `subscribeRemote*` (realtime) + `saveStored*` pattern, with
  `*ToRow`/`rowTo*` mappers in `src/utils/storage.ts`.
- RLS is "authenticated only" since migration `0007`. New tables: authenticated
  read **and** write (user chose "anyone can edit").
- `BrandId` stays a fixed 5-value union. This batch edits brands; it does not add
  or remove them.
- Migration `0018_reminder_rpc_secret_and_blank_guard.sql` is still unapplied on
  the Supabase project. The new migrations (`0019`–`0021`) stack on top of it.
- No behaviour change to posting, calendar, reminders, or auth.

---

## 2. Item 5 — Editable brand records

### 2.1 Approach: context migration (Approach B)

`BRANDS` becomes a React-context value. Rejected alternatives: a mutable hydrated
module singleton (dual source of truth, mutable module state) and a thin
overrides layer (same brand renders differently across un-migrated views).

- `src/data/brands.ts` keeps the 5 objects, renamed **`SEED_BRANDS`**. They are
  the synchronous initial state and the per-field fallback when a DB column is
  null. `SPECS` in that file is unaffected.
- New `src/context/BrandsContext.tsx` + `src/hooks/useBrands.ts`:

  ```ts
  const { brands, getBrand, updateBrand } = useBrands();
  // brands: Record<BrandId, BrandConfig>   (always all 5, merged over SEED_BRANDS)
  // getBrand(id: BrandId | 'all' | 'shared'): BrandConfig   ('all'/'shared' -> pharmacozyme, matching today's fallbacks)
  // updateBrand(id: BrandId, patch: Partial<BrandConfig>): Promise<void>
  ```

- Provider seeded from `getStoredBrands()` (falls back to `SEED_BRANDS`),
  hydrates via `fetchRemoteBrands()` on mount, subscribes via
  `subscribeRemoteBrands()`, writes to localStorage on change. Same shape as
  `usePosts`.
- Mounted in `App.tsx` (or `main.tsx`) wrapping the tree, inside `ConfirmProvider`.

### 2.2 Consumer migration

23 files import `BRANDS`. Migration rules:

- **React components (21 files):** replace `import { BRANDS } from '…/data/brands'`
  with `const { brands } = useBrands();` and rename `BRANDS` → `brands` in the
  body. Where the file also imports `SPECS`, keep that import.
  - Files: `App.tsx`, `AssetLibrary.tsx`, `BrandControlCenter.tsx`,
    `CalendarHeader.tsx`, `CalendarListView.tsx`, `CalendarMonthView.tsx`,
    `CalendarWeekView.tsx`, `IdeaBacklog.tsx`, `MobileDateStripView.tsx`,
    `PostCard.tsx`, `CalendarView.tsx`, `CommandPalette.tsx`, `ContentBank.tsx`,
    `MyWork.tsx`, `NewPostModal.tsx`, `PostDetailModal.tsx`, `QuickAddBar.tsx`,
    `ResearchPlans.tsx`, `SmartMemoryRibbon.tsx`, `TemplateLibrary.tsx`,
    `TopNav.tsx`.
  - The calendar leaf components (`PostCard`, `MobileDateStripView`, list/month/
    week views, `IdeaBacklog`) are rendered in `.map()` loops; each calls
    `useBrands()` itself (context reads are cheap) rather than prop-drilling.
- **Non-component utils (2 files):** `brandConflicts.ts` (`getDayBrandSummary`)
  and `researchParse.ts` take a `brands: Record<BrandId, BrandConfig>` parameter,
  passed by their callers (which are components with the hook). Their existing
  unit tests pass `SEED_BRANDS`.

### 2.3 Schema — `brands` table (migration `0019`)

```sql
create table if not exists brands (
  id              text primary key,           -- 'pharmacozyme' | 'pz-academy' | 'med-q' | 'pillz' | 'prescriptionz'
  name            text not null,
  short_code      text not null,
  tagline         text not null default '',
  description     text not null default '',
  primary_color   text not null,
  secondary_color text not null,
  accent_color    text not null,
  surface_color   text not null,
  icon            text not null default 'science',
  logo_url        text,
  voice_rules     jsonb not null default '[]'::jsonb,   -- string[]
  fonts           jsonb not null default '{}'::jsonb,   -- {display,headline,code,body}
  prompt_config   jsonb,                                -- nullable; forward-looking, no UI this batch (see 2.5)
  sort_order      int not null default 0,
  updated_at      timestamptz not null default now()
);

alter table brands enable row level security;
create policy "authenticated read"  on brands for select to authenticated using (true);
create policy "authenticated write" on brands for all    to authenticated using (true) with check (true);

alter publication supabase_realtime add table brands;
```

Migration then `insert … on conflict do nothing` the 5 rows from the current
`SEED_BRANDS` values (colours, fonts, voice rules verbatim; `sort_order`
0–4 in today's declaration order).

### 2.4 storage.ts additions

`brandToRow(b: BrandConfig): BrandRow`, `rowToBrand(r: BrandRow): BrandConfig`
(merging nulls over `SEED_BRANDS[r.id]`), `fetchRemoteBrands()`,
`upsertRemoteBrand(b)`, `subscribeRemoteBrands(cb)`, `getStoredBrands()`,
`saveStoredBrands(list)`. Cache key `pharmacozyme_brandops_brands_v1`.

### 2.5 Editing UI — `BrandControlCenter`

A new **"Edit brand kit"** section (toggle or dedicated panel) for the currently
selected brand:

| Group | Fields | Control |
|---|---|---|
| Identity | name, short_code, tagline, description | text / textarea |
| Colours | primary, secondary, accent, surface | native colour input + hex text, live swatch |
| Logo | logo_url | `uploadAsset(file, 'logos')` **or** paste URL; preview |
| Voice rules | voice_rules[] | editable list — add row, edit inline, delete, drag-reorder |
| Fonts | display, headline, code, body | text (reference labels — a note says these do not re-skin the app) |

Save → `updateBrand(id, patch)`, optimistic, `showToast` on success/failure,
`logAuditEvent` with before/after (existing `buildAuditEvent` helper).

**Prompt presets (`prompt_config`):** column ships now, **no editing UI this
batch**. Editing brand voice rules already covers the main prompt input. A
follow-up can add preset management. *(Ruling — flagged for user review: the
"everything about the brand" ask is otherwise met; a full prompt-preset editor is
its own feature and out of YAGNI scope here. Cost if wrong: one more panel in a
follow-up PR.)*

### 2.6 Voice-rules list editor

Pure reducer `voiceRulesReducer(state, action)` with actions
`add | edit(i, text) | remove(i) | move(from, to)`, unit-tested. The component is
a thin wrapper.

---

## 3. Item 4 — Per-brand template categories

### 3.1 Schema — `template_categories` (migration `0020`)

```sql
create table if not exists template_categories (
  id         uuid primary key default gen_random_uuid(),
  brand_id   text not null,                 -- BrandId | 'shared'
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, lower(name))
);

alter table template_categories enable row level security;
create policy "authenticated read"  on template_categories for select to authenticated using (true);
create policy "authenticated write" on template_categories for all    to authenticated using (true) with check (true);

alter publication supabase_realtime add table template_categories;
```

Migration seeds, for each of the 6 scopes (`shared` + 5 brand ids), the current 5
category names (`Clinical, Interactive, Editorial, Patient-Facing, Internal`),
`sort_order` 0–4.

`templates.category` is already `text` in the DB — **no column change**. In
TypeScript, `PostTemplate['category']` widens from the union to `string`.

### 3.2 storage.ts + hook

`categoryToRow` / `rowToCategory`, `fetchRemoteCategories`,
`upsertRemoteCategory`, `deleteRemoteCategory`, `subscribeRemoteCategories`,
`getStoredCategories` / `saveStoredCategories` (key
`pharmacozyme_brandops_template_categories_v1`). New
`src/hooks/useTemplateCategories.ts` returning
`{ categories, categoriesFor(brandScope), addCategory, renameCategory,
deleteCategory, reorderCategories }`.

### 3.3 Category management UI (`TemplateLibrary`)

A **"Manage categories"** button (near the filter chips), scoped to the currently
selected brand filter (or `shared` when "All Brands"):

- **Add** — name input → `addCategory(brandScope, name)`.
- **Rename** — inline edit. On save: `renameCategory` + a client-side batch
  `upsertRemoteTemplate` over that scope's templates whose `category` matched the
  old name.
- **Reorder** — drag; persists `sort_order`.
- **Delete** — confirm. Reassign that scope's matching templates to
  `Uncategorized` (auto-created for the scope if absent), then delete the row.

### 3.4 Category cascade logic

Pure `applyCategoryRename(templates, brandScope, oldName, newName)` and
`applyCategoryDelete(templates, brandScope, name)` → return the changed template
list; unit-tested. The hook calls them and persists the diff.

### 3.5 Filter chips + modal dropdown

- `categoryChips` in `TemplateLibrary` is built from `categoriesFor(activeBrandFilter)`
  ∪ any distinct `category` value still present in live templates for that scope
  (so an orphaned value is still findable), plus the always-present `all`.
- The create/edit modal's **Category** `<select>` lists `categoriesFor(newBrandId)`
  — changing the modal's Brand field re-scopes the options.
- `CATEGORY_CHIP_META` becomes `categoryMeta(name)` → known names keep their icon;
  unknown names get a default (`sell` / `label`).

---

## 4. Item 4 (cont.) — Template modal: upload first

In the create/edit-template modal (`TemplateLibrary.tsx` ~L550–697):

- Move the **Image** block (URL text field + Upload button + a thumbnail preview
  when set) out of the `showMoreOptions` accordion to sit directly under the
  Name / Brand / Category rows — always visible.
- "More options" now covers only: description, platform, caption, tags.
- Update the accordion label text accordingly ("More options (description,
  platform, caption, tags)").
- **Backend unchanged** — template images keep using `uploadImage` (Drive). This
  item is field order only.

---

## 5. Item 6 — `brand-assets` Storage bucket + upload

### 5.1 Bucket (migration `0021`, dashboard steps also provided)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 52428800, null)
on conflict (id) do nothing;

create policy "brand-assets authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets');
create policy "brand-assets authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets');
create policy "brand-assets authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets');
create policy "brand-assets public read"
  on storage.objects for select to public
  using (bucket_id = 'brand-assets');
```

### 5.2 `src/utils/uploadAsset.ts`

```ts
uploadAsset(file: File, folder: 'assets' | 'logos'): Promise<{
  url: string;          // public URL
  storagePath: string;  // 'assets/<uuid>-<name>' — for later cleanup
  size: string;         // human ('2.4 MB'), from file.size
  contentType: string;  // file.type
}>
```

- Path: `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`.
- Validate: type in an allowed set (`image/*`, `application/pdf`,
  `application/msword`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  `application/vnd.ms-*`, plain text), size ≤ 50 MB — clear thrown errors.
- `supabase.storage.from('brand-assets').upload(path, file, { upsert: false })`
  then `.getPublicUrl(path)`.

### 5.3 `BrandAsset` type

Add `storagePath?: string` (optional — assets added by URL won't have one).
`assetToRow` / `rowToAsset` in `storage.ts` map the new column; migration `0021`
adds `alter table assets add column if not exists storage_path text;`.

### 5.4 AssetLibrary "Add asset" modal

- A drag/drop + file-picker zone at the **top** of the modal (reuse
  `useImageUploadZone` where it fits, or a small local handler).
- On successful upload: set `url` = public URL, `storagePath`, auto-fill
  `fileType` from MIME and `size` from bytes — all still editable.
- Keep the existing manual URL / format / size fields below, relabelled as the
  "already hosted? paste a link" path.
- Errors surface inline (existing `uploadError` pattern).

### 5.5 Logo upload in BrandControlCenter

Uses `uploadAsset(file, 'logos')`; writes the returned `url` to
`updateBrand(id, { logoUrl })`.

---

## 6. Migrations & deploy (user steps)

Applied in order on the Supabase project, on top of the already-pending `0018`:

| File | Adds |
|---|---|
| `0018_reminder_rpc_secret_and_blank_guard.sql` | *(already pending — unrelated)* |
| `0019_brands.sql` | `brands` table + RLS + realtime + seed 5 rows |
| `0020_template_categories.sql` | `template_categories` table + RLS + realtime + seed 30 rows |
| `0021_brand_assets.sql` | `assets.storage_path` column; `brand-assets` storage bucket + 4 storage policies |

The `brand-assets` bucket can alternatively be created in the Supabase dashboard
(Storage → New bucket → public, 50 MB limit) with the 4 policies added in the
Policies tab — steps included in the plan.

---

## 7. Testing

**Unit (vitest, `globals: false`):**
- `brandToRow` / `rowToBrand` round-trip, null-column fallback to `SEED_BRANDS`.
- `voiceRulesReducer` — add / edit / remove / move.
- `rowToCategory` / `categoryToRow`.
- `applyCategoryRename`, `applyCategoryDelete` — cascade over a template fixture.
- `uploadAsset` — type + size validation (Supabase client mocked).

**Browser pass (dev :3001, Chrome/Playwright, 390 px + 1440 px):**
- Edit MED-Q `primaryColor` → confirm it changes the calendar chip, nav switcher
  logo tile border, and brand pills without reload (realtime / same session).
- Add a per-brand category → appears in the filter chips and the modal dropdown;
  rename it → templates follow; delete it → templates land in `Uncategorized`.
- Create-template modal shows the image field without expanding "More options".
- Upload a PDF and a PNG in the asset modal → public URL fills, opens.
- Upload a new logo for a brand → reflects in the nav switcher.

**Gate every task:** `npx tsc --noEmit` && `npx vitest run` && `npm run build`.

---

## 8. Out of scope (this batch)

- Adding / removing brands (the `BrandId` union stays fixed at 5).
- Brand prompt-preset editing UI (`prompt_config` column ships unused).
- Moving template-image upload off Drive onto Storage.
- Item 7 (delete-cascade to Drive / Storage) — its own spec. `storage_path` is
  added now so item 7 can clean up Storage objects later.
- Re-skinning the app from brand `fonts` values (they stay reference labels).
