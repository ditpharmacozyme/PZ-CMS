# Prompts Library

**Date:** 2026-10-01
**Branch:** TBD (forked from `main`)
**Status:** Approved design, pending implementation plan

---

## 1. Goal

Give the team a shared place to save, categorize, and reuse AI prompts (caption
writers, image-gen prompts, video-script prompts, etc.) — each with optional
example images and video links. Takes over Content Bank's primary sidebar slot;
Content Bank itself is unchanged except for moving into the "More" overflow menu.

Scope, from the approved brainstorm:

- **AI prompts specifically** — not a general content/reference library.
- **Shared across all 5 brands** — no brand filter, one library for everyone.
- **Managed category list** — a small set of named categories (add/rename/delete),
  not free-form tags.
- **Multiple images + multiple video links per prompt** — a small gallery and a
  link list, not a single cover image.

## 2. Current state

Two existing features this closely follows:

- **Template categories** (`template_categories` table, `useTemplateCategories.ts`,
  `src/utils/templateCategories.ts`): the managed-category-list pattern — add/
  rename/delete, with rename/delete cascading onto the owning records via
  `applyCategoryRename`/`applyCategoryDelete`, and an auto-created `Uncategorized`
  fallback. Scoped per-brand today; Prompts' version drops that scoping.
- **Multi-image carousel** ([[pzcms_carousel_and_reminder_fix]], `images: string[]`
  on `Post`/`PostTemplate`): `ImageCarouselField.tsx` already does ordered
  upload/reorder/delete against Google Drive via `uploadImages()` — reused as-is
  here, not rebuilt.

`SideNav.tsx` currently has `content-bank` as a primary nav item
(`NAV_ITEMS`, icon `article`); `MORE_ITEMS` holds Brand Kit, Assets, Activity Log,
Integrations behind the "More" disclosure.

## 3. Approach

**New `prompts` + `prompt_categories` tables, modeled on templates/template
categories minus brand-scoping; images reuse the existing `ImageCarouselField`
component unchanged.**

Rejected alternatives:

- **Repurpose the existing `content_bank` table/component.** The user was
  explicit: Prompts Library is a new, separate section; Content Bank keeps
  working exactly as it does today, it just moves in the nav. Reusing its table
  would conflate two different entities (free-text copy snippets vs. categorized
  AI prompts with structured media).
- **Free-form tags instead of managed categories.** Rejected by the brainstorm
  answer — the user wants a browsable, organized library, which a fixed add/
  rename/delete category list serves better than open-ended tags.
- **New Supabase-Storage upload path for images** (`uploadAsset.ts`, the
  Brand-Kit asset uploader). Rejected because this app already has a
  general-purpose, carousel-capable image field (`ImageCarouselField.tsx`) wired
  to Drive via `uploadImages()` — the same pipeline every post/template image
  already uses. Reusing it means zero new upload code and visually consistent
  upload/reorder/delete UX.

## 4. Data model

New migration `supabase/migrations/0024_prompts_library.sql`:

```sql
create table if not exists prompt_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists prompt_categories_lower_name_idx
  on prompt_categories (lower(name));

create table if not exists prompts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  prompt_text text not null,
  category    text not null default 'Uncategorized',
  images      jsonb not null default '[]'::jsonb,
  video_links jsonb not null default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table prompt_categories enable row level security;
drop policy if exists "prompt_categories authenticated read"  on prompt_categories;
create policy "prompt_categories authenticated read"  on prompt_categories for select to authenticated using (true);
drop policy if exists "prompt_categories authenticated write" on prompt_categories;
create policy "prompt_categories authenticated write" on prompt_categories for all    to authenticated using (true) with check (true);

alter table prompts enable row level security;
drop policy if exists "prompts authenticated read"  on prompts;
create policy "prompts authenticated read"  on prompts for select to authenticated using (true);
drop policy if exists "prompts authenticated write" on prompts;
create policy "prompts authenticated write" on prompts for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prompt_categories') then
    alter publication supabase_realtime add table prompt_categories;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prompts') then
    alter publication supabase_realtime add table prompts;
  end if;
end $$;

insert into prompt_categories (name, sort_order) values
  ('Caption Writing', 0), ('Hook Ideas', 1), ('Video Script', 2),
  ('Hashtags', 3), ('Calendar Planning', 4)
on conflict (lower(name)) do nothing;
```

`category` is a **name string**, not a foreign key — matching
`PostTemplate.category`'s existing convention exactly, including the
auto-created `Uncategorized` fallback row and string-based rename/delete
cascade. No FK/`category_id` indirection, consistent with how templates already
do this.

## 5. Types (`src/types.ts`)

```ts
export interface PromptCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Prompt {
  id: string;
  title: string;
  promptText: string;
  category: string;       // name; 'Uncategorized' fallback, same convention as PostTemplate.category
  images: string[];        // ImageCarouselField + uploadImages(), same as Post/PostTemplate
  videoLinks: string[];    // plain URLs, no validation beyond trim/non-empty
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## 6. Category management (`src/utils/promptCategories.ts`, `usePromptCategories.ts`)

Near-identical copy of `templateCategories.ts` / `useTemplateCategories.ts`
with the per-brand scope parameter removed:

```ts
// utils/promptCategories.ts
export const UNCATEGORIZED = 'Uncategorized';
export function applyCategoryRename(prompts: Prompt[], oldName: string, newName: string): Prompt[];
export function applyCategoryDelete(prompts: Prompt[], name: string): Prompt[];
```

```ts
// hooks/usePromptCategories.ts
export function usePromptCategories(): {
  categories: PromptCategory[];           // sorted by sortOrder
  addCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<boolean>;
  deleteCategory: (name: string) => Promise<void>;
  reorderCategories: (ids: string[]) => Promise<void>;
};
```

Same contract as `useTemplateCategories`: localStorage-first with Supabase as
best-effort sync (`getStoredPromptCategories`/`saveStoredPromptCategories` +
`fetchRemotePromptCategories`/`upsertRemotePromptCategory`/
`deleteRemotePromptCategory`/`subscribeRemotePromptCategories` in
`storage.ts`), reassigning prompts on rename/delete is the **component's**
job (not the hook's), exactly mirroring `useTemplateCategories`'s existing
doc comment.

## 7. Prompts CRUD (`storage.ts`, `App.tsx`)

Mirrors `content_bank`'s existing pattern exactly (inline `useState` in
`App.tsx`, not a dedicated hook — `content_bank` sets this precedent for a
single flat collection with no extra derived state):

```ts
// storage.ts
export async function fetchRemotePrompts(): Promise<Prompt[] | null>;
export async function upsertRemotePrompt(p: Prompt): Promise<void>;
export async function deleteRemotePrompt(id: string): Promise<void>;
export function subscribeRemotePrompts(onChange: (prompts: Prompt[]) => void): () => void;
export function getStoredPrompts(): Prompt[];
export function saveStoredPrompts(prompts: Prompt[]): void;
```

```ts
// App.tsx — same shape as handleAddBankItem/handleUpdateBankItem/handleDeleteBankItem
const [prompts, setPrompts] = useState<Prompt[]>(() => getStoredPrompts());
const handleAddPrompt = (p: Prompt) => { setPrompts((prev) => [p, ...prev]); upsertRemotePrompt(p); showToast('Saved prompt.'); };
const handleUpdatePrompt = (p: Prompt) => { setPrompts((prev) => prev.map((x) => (x.id === p.id ? p : x))); upsertRemotePrompt(p); showToast('Updated prompt.'); };
const handleDeletePrompt = (id: string) => { setPrompts((prev) => prev.filter((x) => x.id !== id)); deleteRemotePrompt(id); showToast('Deleted prompt.'); };
```

Plus the matching `fetchRemotePrompts().then(...)` / `subscribeRemotePrompts(...)`
mount effect and `saveStoredPrompts(prompts)` persist effect, same two-effect
shape every other remote-backed collection in `App.tsx` already uses.

## 8. Navigation (`SideNav.tsx`, `App.tsx`)

```ts
export type NavTab = ... | 'content-bank' | 'prompts' | ...;

const NAV_ITEMS: NavItem[] = [
  { tab: 'my-work', ... },
  { tab: 'dashboard', ... },
  { tab: 'calendar', ... },
  { tab: 'templates', ... },
  { tab: 'prompts', label: 'Prompts Library', icon: 'auto_stories' },  // replaces content-bank's old slot
  { tab: 'research', ... },
];

const MORE_ITEMS: NavItem[] = [
  { tab: 'brand-kit', ... },
  { tab: 'assets', ... },
  { tab: 'content-bank', label: 'Content Bank', icon: 'article' },     // moved here
  { tab: 'audit', ... },
  { tab: 'integrations', ... },
];
```

`auto_stories` (not `auto_awesome`, already used by the Calendar's "AI Prompt"
button) avoids icon collision between "the one master CSV prompt" and "the
general saved-prompts library" — two different features that could otherwise
read as the same thing.

`App.tsx` gets one new render branch:

```tsx
{currentTab === 'prompts' && (
  <PromptsLibrary
    prompts={prompts}
    onAddPrompt={handleAddPrompt}
    onUpdatePrompt={handleUpdatePrompt}
    onDeletePrompt={handleDeletePrompt}
    activeTeammate={activeTeammate}
    showToast={showToast}
  />
)}
```

## 9. Components

**`src/components/PromptsLibrary.tsx`** (top-level section, modeled on
`TemplateLibrary.tsx`'s layout):

- Category filter chips along the top (`All`, each category, `Uncategorized`),
  with the same inline add/rename/delete affordance `TemplateLibrary` already
  has for its categories (reusing `usePromptCategories` in place of
  `useTemplateCategories`).
- Search box filtering by title/prompt text.
- Grid of prompt cards. Each card: title, category chip, truncated prompt-text
  preview, an image-count badge and video-link-count badge when non-empty, and
  a **Copy Prompt** button — same clipboard + "Copied!" feedback pattern as
  `MasterPromptModal.tsx`. Clicking the card body (not Copy) opens the editor.
- "+ New Prompt" button opens `PromptEditorModal` in create mode.

**`src/components/PromptEditorModal.tsx`** (reuses the shared `Modal`
primitive, same shape as `TemplateLibrary`'s create/edit modal):

- Title input, category `<select>` (options from `usePromptCategories`).
- Prompt text `<textarea>`.
- `ImageCarouselField` bound to `images: string[]` — **reused unmodified**,
  same component instance posts/templates already use.
- Video links: a repeatable list of URL `<input>` rows with an "Add link"
  button and a ✕ per row — the simplest possible multi-value editor, no new
  shared component needed for a single text field.
- Footer: Save / Cancel, and Delete (edit mode only, behind `useConfirm()`
  same as every other delete action in this app).

## 10. Testing

Unit (Vitest, `globals: false`):

- `promptCategories.ts` — `applyCategoryRename`/`applyCategoryDelete`, mirrors
  `templateCategories.test.ts`'s existing coverage shape.
- `usePromptCategories` — add/rename (including duplicate-name refusal)/delete/
  reorder, mirrors `useTemplateCategories`'s own test coverage.
- `PromptEditorModal` — save calls `onAddPrompt`/`onUpdatePrompt` with the
  right shape; video-link rows add/remove; category select lists current
  categories.
- `PromptsLibrary` — category filter narrows the grid; search filters by
  title/text; Copy Prompt calls `navigator.clipboard.writeText` with that
  card's `promptText` and shows "Copied!" (same assertion style as
  `MasterPromptModal.test.tsx`).

Manual browser sweep before merge, per [[pzcms_sdd_workflow]]: create a
prompt with 2+ images and 2+ video links, reorder/remove an image, rename then
delete a category and confirm prompts in it land in "Uncategorized", confirm
Content Bank still works unchanged from its new "More" location.

## 11. Out of scope

- Actual video upload/hosting — links only, same as the brainstorm's "any
  video link" phrasing, not a video file carousel.
- Per-prompt sharing/export, prompt versioning/history.
- Wiring prompt images into the existing delete-cascade/`fileCleanup.ts`
  system ([[pzcms_delete_cascade]]) — posts/templates already do this for
  their `images[]`; extending it to prompts is straightforward follow-up work
  but wasn't asked for here and isn't required for the feature to work.
- AI-assisted prompt suggestions, prompt-quality linting, or any smarts beyond
  plain save/categorize/copy.
- Admin-only write gating — matches every other shared-library table in this
  app (`brands`, `templates`, `template_categories`, `content_bank`): any
  authenticated team member can add/edit/delete.
