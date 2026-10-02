# Prompts Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Prompts Library (save/categorize/copy AI prompts with example images and video links), replacing Content Bank's primary sidebar slot — Content Bank moves into the "More" menu, unchanged otherwise.

**Architecture:** Two new Supabase tables (`prompts`, `prompt_categories`) following this codebase's existing "managed category list" pattern (`template_categories`/`useTemplateCategories`) and "flat remote-synced collection" pattern (`content_bank`). Images reuse the existing `ImageCarouselField` + Drive-upload pipeline unmodified. No brand scoping — one shared library.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + Realtime), Vitest + Testing Library, existing `Modal`/`useConfirm` primitives.

**Spec:** `docs/superpowers/specs/2026-10-01-prompts-library-design.md`

## Global Constraints

- No brand scoping on prompts or categories — shared across all 5 brands (spec §1).
- `category` is a plain name string with `'Uncategorized'` fallback, matching `PostTemplate.category`'s existing convention exactly — not a foreign key (spec §4-5).
- Images reuse `ImageCarouselField`/`uploadImages()` unmodified — no new upload path (spec §3, §9).
- RLS: any authenticated team member can read/write both tables, no admin gate — matches `brands`/`templates`/`template_categories`/`content_bank` (spec §4, §11).
- `prompts.id` is `text primary key` (client-generated `prompt-${Date.now()}`), matching `posts`/`templates`/`content_bank` convention — NOT `uuid` (this plan corrects the spec's SQL, which mistakenly used `uuid` for `prompts`; `prompt_categories.id` correctly stays `uuid default gen_random_uuid()`, matching `template_categories`).
- Nav icon `auto_stories` for Prompts Library, not `auto_awesome` (already used by the Calendar's "AI Prompt" button) — avoids confusing the two features (spec §8).

## Review Focus

- **Deleting a category that has prompts in it.** A reasonable person expects those prompts to land in "Uncategorized", not disappear or keep a dangling reference — covered in Task 2's `applyCategoryDelete` test and Task 6's `handleDeleteCategory` integration.
- **Renaming a category to a name that collides (case-insensitively) with an existing one.** Expected: the rename is refused and the input reverts, exactly like Template categories — covered in Task 4's hook test.
- **A prompt with zero images and zero video links.** Expected: the card just omits those badges, no broken "0 images" chip or layout gap — covered in Task 6's card test.
- **Copying a prompt whose text contains special characters (quotes, newlines).** Expected: clipboard gets the exact `promptText`, not a mangled/escaped version — covered in Task 6's copy test with a multi-line prompt fixture.
- **Two people editing the prompts list at once (realtime).** Expected: a prompt added/edited/deleted by someone else appears/updates live without a page reload, matching `subscribeRemotePrompts`'s wiring — not unit-testable, added to Task 7's manual browser sweep explicitly.

---

## Task 1: Types + migration

**Files:**
- Modify: `src/types.ts` (add `PromptCategory`, `Prompt` interfaces near `TemplateCategory`/`BrandAsset`, ~line 196)
- Create: `supabase/migrations/0024_prompts_library.sql`

**Interfaces:**
- Produces: `PromptCategory { id, name, sortOrder, createdAt }`, `Prompt { id, title, promptText, category, images, videoLinks, createdBy, createdAt, updatedAt }` — every later task imports these from `../types`.

- [ ] **Step 1: Add the types**

In `src/types.ts`, immediately after the existing `TemplateCategory` interface (around line 195, right before `export interface BrandAsset`):

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
  category: string; // name, not FK; 'Uncategorized' fallback — same convention as PostTemplate.category
  images: string[]; // ImageCarouselField + uploadImages(), same as Post/PostTemplate
  videoLinks: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0024_prompts_library.sql`:

```sql
-- Shared Prompts Library: saved/categorized AI prompts with example images
-- and video links. No brand scoping -- one library for the whole team.
create table if not exists prompt_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists prompt_categories_lower_name_idx
  on prompt_categories (lower(name));

create table if not exists prompts (
  id          text primary key,
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

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (the new types aren't imported anywhere yet, so this just confirms valid TypeScript syntax).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts supabase/migrations/0024_prompts_library.sql
git commit -m "feat(prompts): add Prompt/PromptCategory types and migration 0024"
```

---

## Task 2: Category cascade helpers

**Files:**
- Create: `src/utils/promptCategories.ts`
- Test: `src/utils/promptCategories.test.ts`

**Interfaces:**
- Consumes: `Prompt` from Task 1.
- Produces: `UNCATEGORIZED: string`, `applyCategoryRename(prompts, oldName, newName): Prompt[]`, `applyCategoryDelete(prompts, name): Prompt[]` — consumed by Task 6's `PromptsLibrary.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/promptCategories.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from './promptCategories';
import { Prompt } from '../types';

const p = (id: string, category: string): Prompt => ({
  id, title: id, promptText: 'text', category, images: [], videoLinks: [],
  createdBy: 'Tester', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
});

describe('applyCategoryRename', () => {
  it('renames matching prompts', () => {
    const out = applyCategoryRename([p('a', 'Hook Ideas'), p('b', 'Hashtags')], 'Hook Ideas', 'Hooks');
    expect(out.map((x) => x.category)).toEqual(['Hooks', 'Hashtags']);
  });
  it('is case-insensitive on the old name', () => {
    const out = applyCategoryRename([p('a', 'hook ideas')], 'Hook Ideas', 'Hooks');
    expect(out[0].category).toBe('Hooks');
  });
});

describe('applyCategoryDelete', () => {
  it('reassigns matching prompts to Uncategorized', () => {
    const out = applyCategoryDelete([p('a', 'Hook Ideas'), p('b', 'Hashtags')], 'Hook Ideas');
    expect(out.map((x) => x.category)).toEqual([UNCATEGORIZED, 'Hashtags']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/promptCategories.test.ts`
Expected: FAIL — `Cannot find module './promptCategories'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/promptCategories.ts`:

```ts
import { Prompt } from '../types';

export const UNCATEGORIZED = 'Uncategorized';

const matches = (p: Prompt, name: string) => (p.category || '').toLowerCase() === name.toLowerCase();

export function applyCategoryRename(prompts: Prompt[], oldName: string, newName: string): Prompt[] {
  return prompts.map((p) => (matches(p, oldName) ? { ...p, category: newName } : p));
}

export function applyCategoryDelete(prompts: Prompt[], name: string): Prompt[] {
  return prompts.map((p) => (matches(p, name) ? { ...p, category: UNCATEGORIZED } : p));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/promptCategories.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/promptCategories.ts src/utils/promptCategories.test.ts
git commit -m "feat(prompts): add category rename/delete cascade helpers"
```

---

## Task 3: Supabase storage functions

**Files:**
- Modify: `src/utils/storage.ts` (add a new section after the Content Bank section, ~line 644)

**Interfaces:**
- Consumes: `Prompt`, `PromptCategory` from Task 1.
- Produces: `fetchRemotePromptCategories`, `upsertRemotePromptCategory`, `deleteRemotePromptCategory`, `subscribeRemotePromptCategories`, `getStoredPromptCategories`, `saveStoredPromptCategories`, `fetchRemotePrompts`, `upsertRemotePrompt`, `deleteRemotePrompt`, `subscribeRemotePrompts`, `getStoredPrompts`, `saveStoredPrompts` — consumed by Task 4 (categories) and Task 7 (prompts, wired into `App.tsx`).

No dedicated test file for this task — these are thin Supabase wrappers with no branching logic of their own, matching every other storage.ts CRUD block in this codebase (`fetchRemoteCategories`, `fetchRemoteContentBank`, etc. have none either). Task 4 exercises the category functions through a mock; Task 7's manual browser sweep exercises the real Supabase round-trip for prompts.

- [ ] **Step 1: Add the localStorage keys**

In `src/utils/storage.ts`, find the existing key constants block (~line 14-15, right after `TEMPLATE_CATEGORIES_KEY`):

```ts
const TEMPLATE_CATEGORIES_KEY = 'pharmacozyme_brandops_template_categories_v1';
```

Add immediately after it:

```ts
const PROMPT_CATEGORIES_KEY = 'pharmacozyme_brandops_prompt_categories_v1';
const PROMPTS_KEY = 'pharmacozyme_brandops_prompts_v1';
```

- [ ] **Step 2: Add the import**

At the top of `storage.ts`, the first import line currently reads:

```ts
import { Post, PostTemplate, TemplateCategory, BrandAsset, AppNotification, ContentBankItem, TeamMember, ResearchItem, BrandConfig, BrandId } from '../types';
```

Change it to also import the two new types:

```ts
import { Post, PostTemplate, TemplateCategory, BrandAsset, AppNotification, ContentBankItem, TeamMember, ResearchItem, BrandConfig, BrandId, Prompt, PromptCategory } from '../types';
```

- [ ] **Step 3: Add the CRUD functions**

Find the end of the Content Bank section in `storage.ts` (the `// ─── Content Bank ───` block ends with `subscribeRemoteContentBank`, around line 644, right before the next `// ─── ...` section header or end of relevant block). Insert this new section immediately after it:

```ts
// ─── Prompt Categories ──────────────────────────────────────────────────
function rowToPromptCategory(row: any): PromptCategory {
  return { id: row.id, name: row.name, sortOrder: row.sort_order ?? 0, createdAt: row.created_at };
}

function promptCategoryToRow(c: Omit<PromptCategory, 'createdAt'>): Record<string, unknown> {
  return { id: c.id, name: c.name, sort_order: c.sortOrder };
}

export async function fetchRemotePromptCategories(): Promise<PromptCategory[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('prompt_categories').select('*').order('sort_order', { ascending: true });
  if (error) { console.error('[Supabase] fetchRemotePromptCategories failed:', error.message); return null; }
  return data.map(rowToPromptCategory);
}

export async function upsertRemotePromptCategory(c: Omit<PromptCategory, 'createdAt'>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('prompt_categories').upsert(promptCategoryToRow(c));
  if (error) console.error('[Supabase] upsertRemotePromptCategory failed:', error.message);
}

export async function deleteRemotePromptCategory(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('prompt_categories').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemotePromptCategory failed:', error.message);
}

export function subscribeRemotePromptCategories(onChange: (c: PromptCategory[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('prompt-categories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prompt_categories' }, async () => {
      const c = await fetchRemotePromptCategories();
      if (c) onChange(c);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function getStoredPromptCategories(): PromptCategory[] {
  try {
    const raw = localStorage.getItem(PROMPT_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredPromptCategories(list: PromptCategory[]): void {
  try {
    localStorage.setItem(PROMPT_CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    /* quota — ignore */
  }
}

// ─── Prompts ─────────────────────────────────────────────────────────────
function rowToPrompt(row: any): Prompt {
  return {
    id: row.id,
    title: row.title,
    promptText: row.prompt_text,
    category: row.category || 'Uncategorized',
    images: Array.isArray(row.images) ? row.images : [],
    videoLinks: Array.isArray(row.video_links) ? row.video_links : [],
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function promptToRow(p: Prompt): Record<string, unknown> {
  return {
    id: p.id,
    title: p.title,
    prompt_text: p.promptText,
    category: p.category || 'Uncategorized',
    images: p.images || [],
    video_links: p.videoLinks || [],
    created_by: p.createdBy || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchRemotePrompts(): Promise<Prompt[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('prompts').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[Supabase] fetchRemotePrompts failed:', error.message); return null; }
  return data.map(rowToPrompt);
}

export async function upsertRemotePrompt(p: Prompt): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('prompts').upsert(promptToRow(p));
  if (error) console.error('[Supabase] upsertRemotePrompt failed:', error.message);
}

export async function deleteRemotePrompt(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('prompts').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemotePrompt failed:', error.message);
}

export function subscribeRemotePrompts(onChange: (prompts: Prompt[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('prompts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prompts' }, async () => {
      const p = await fetchRemotePrompts();
      if (p) onChange(p);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function getStoredPrompts(): Prompt[] {
  try {
    const raw = localStorage.getItem(PROMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredPrompts(prompts: Prompt[]): void {
  try {
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
  } catch {
    /* quota — ignore */
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/storage.ts
git commit -m "feat(prompts): add Supabase CRUD + localStorage cache for prompts/categories"
```

---

## Task 4: `usePromptCategories` hook

**Files:**
- Create: `src/hooks/usePromptCategories.ts`
- Test: `src/hooks/usePromptCategories.test.ts`

**Interfaces:**
- Consumes: `PromptCategory` from Task 1; `fetchRemotePromptCategories`, `upsertRemotePromptCategory`, `deleteRemotePromptCategory`, `subscribeRemotePromptCategories`, `getStoredPromptCategories`, `saveStoredPromptCategories` from Task 3 (mocked in the test).
- Produces: `usePromptCategories(): { categories: PromptCategory[], addCategory(name): Promise<void>, renameCategory(oldName, newName): Promise<boolean>, deleteCategory(name): Promise<void>, reorderCategories(orderedIds): Promise<void> }` — consumed by Task 6's `PromptsLibrary.tsx` and Task 5's `PromptEditorModal.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/usePromptCategories.test.ts`:

```ts
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const fetchRemotePromptCategories = vi.fn();
const upsertRemotePromptCategory = vi.fn().mockResolvedValue(undefined);
const deleteRemotePromptCategory = vi.fn().mockResolvedValue(undefined);
const subscribeRemotePromptCategories = vi.fn().mockReturnValue(() => {});
const getStoredPromptCategories = vi.fn().mockReturnValue([]);
const saveStoredPromptCategories = vi.fn();

vi.mock('../utils/storage', () => ({
  fetchRemotePromptCategories: (...a: unknown[]) => fetchRemotePromptCategories(...a),
  upsertRemotePromptCategory: (...a: unknown[]) => upsertRemotePromptCategory(...a),
  deleteRemotePromptCategory: (...a: unknown[]) => deleteRemotePromptCategory(...a),
  subscribeRemotePromptCategories: (...a: unknown[]) => subscribeRemotePromptCategories(...a),
  getStoredPromptCategories: (...a: unknown[]) => getStoredPromptCategories(...a),
  saveStoredPromptCategories: (...a: unknown[]) => saveStoredPromptCategories(...a),
}));

import { usePromptCategories } from './usePromptCategories';

beforeEach(() => {
  vi.clearAllMocks();
  getStoredPromptCategories.mockReturnValue([]);
  fetchRemotePromptCategories.mockResolvedValue([]);
  subscribeRemotePromptCategories.mockReturnValue(() => {});
});

describe('usePromptCategories', () => {
  it('adds a category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hook Ideas'); });
    expect(result.current.categories.map((c) => c.name)).toEqual(['Hook Ideas']);
    expect(upsertRemotePromptCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hook Ideas', sortOrder: 0 }));
  });

  it('refuses a case-insensitive duplicate name', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.addCategory('hooks'); });
    expect(result.current.categories).toHaveLength(1);
  });

  it('renames a category and returns true on success', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    let ok = false;
    await act(async () => { ok = await result.current.renameCategory('Hooks', 'Hook Ideas'); });
    expect(ok).toBe(true);
    expect(result.current.categories[0].name).toBe('Hook Ideas');
  });

  it('refuses a rename that collides with another existing category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.addCategory('Captions'); });
    let ok = true;
    await act(async () => { ok = await result.current.renameCategory('Hooks', 'captions'); });
    expect(ok).toBe(false);
    expect(result.current.categories.map((c) => c.name).sort()).toEqual(['Captions', 'Hooks']);
  });

  it('deletes a category', async () => {
    const { result } = renderHook(() => usePromptCategories());
    await act(async () => { await result.current.addCategory('Hooks'); });
    await act(async () => { await result.current.deleteCategory('Hooks'); });
    expect(result.current.categories).toHaveLength(0);
    expect(deleteRemotePromptCategory).toHaveBeenCalled();
  });

  it('loads categories fetched from Supabase on mount', async () => {
    fetchRemotePromptCategories.mockResolvedValue([
      { id: 'c1', name: 'Hashtags', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
    ]);
    const { result } = renderHook(() => usePromptCategories());
    await waitFor(() => expect(result.current.categories.map((c) => c.name)).toEqual(['Hashtags']));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/usePromptCategories.test.ts`
Expected: FAIL — `Cannot find module './usePromptCategories'`

- [ ] **Step 3: Write the implementation**

Create `src/hooks/usePromptCategories.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { PromptCategory } from '../types';
import {
  getStoredPromptCategories,
  saveStoredPromptCategories,
  fetchRemotePromptCategories,
  upsertRemotePromptCategory,
  deleteRemotePromptCategory,
  subscribeRemotePromptCategories,
} from '../utils/storage';

/**
 * Manages the editable list of prompt categories. No brand scoping -- one
 * shared list for the whole team (see [[pzcms_ai_prompt_and_dedup]] /
 * Prompts Library spec). Categories only -- reassigning Prompts when a
 * category is renamed or deleted is the component's job, not this hook's,
 * mirroring useTemplateCategories's existing split.
 */
export function usePromptCategories() {
  const [categories, setCategories] = useState<PromptCategory[]>(() => getStoredPromptCategories());

  useEffect(() => {
    fetchRemotePromptCategories().then((r) => { if (r && r.length) setCategories(r); });
    const unsub = subscribeRemotePromptCategories((r) => { if (r && r.length) setCategories(r); });
    return () => unsub();
  }, []);

  useEffect(() => { saveStoredPromptCategories(categories); }, [categories]);

  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const cat: Omit<PromptCategory, 'createdAt'> = {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: categories.length,
    };
    setCategories((prev) => [...prev, { ...cat, createdAt: new Date().toISOString() }]);
    await upsertRemotePromptCategory(cat);
  };

  const renameCategory = async (oldName: string, newName: string): Promise<boolean> => {
    const target = categories.find((c) => c.name.toLowerCase() === oldName.toLowerCase());
    if (!target || !newName.trim()) return false;
    if (categories.some((c) => c.id !== target.id && c.name.toLowerCase() === newName.trim().toLowerCase())) return false;
    const updated = { ...target, name: newName.trim() };
    setCategories((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    await upsertRemotePromptCategory({ id: updated.id, name: updated.name, sortOrder: updated.sortOrder });
    return true;
  };

  const deleteCategory = async (name: string) => {
    const target = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    await deleteRemotePromptCategory(target.id);
  };

  const reorderCategories = async (orderedIds: string[]) => {
    const next = categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx >= 0 ? { ...c, sortOrder: idx } : c;
    });
    setCategories(next);
    await Promise.all(next.map((c) => upsertRemotePromptCategory({ id: c.id, name: c.name, sortOrder: c.sortOrder })));
  };

  return useMemo(
    () => ({ categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder), addCategory, renameCategory, deleteCategory, reorderCategories }),
    [categories],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/usePromptCategories.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePromptCategories.ts src/hooks/usePromptCategories.test.ts
git commit -m "feat(prompts): add usePromptCategories hook"
```

---

## Task 5: `PromptEditorModal`

**Files:**
- Create: `src/components/PromptEditorModal.tsx`
- Test: `src/components/PromptEditorModal.test.tsx`

**Interfaces:**
- Consumes: `Prompt` from Task 1; `Modal` (`./ui/Modal`), `ImageCarouselField` (`./ui/ImageCarouselField`), `useConfirm` (`./ui/ConfirmDialog`) — all existing.
- Produces: `PromptEditorModalProps { isOpen, onClose, prompt?: Prompt (edit mode when set), categories: PromptCategory[], activeTeammateName: string, onSave: (prompt: Prompt) => void, onDelete?: (id: string) => void }` — consumed by Task 6's `PromptsLibrary.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/PromptEditorModal.test.tsx`:

```ts
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptEditorModal } from './PromptEditorModal';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { PromptCategory, Prompt } from '../types';

const categories: PromptCategory[] = [
  { id: 'c1', name: 'Hook Ideas', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'c2', name: 'Hashtags', sortOrder: 1, createdAt: '2026-10-01T00:00:00Z' },
];

function renderModal(props: Partial<React.ComponentProps<typeof PromptEditorModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmProvider>
      <PromptEditorModal
        isOpen
        onClose={onClose}
        categories={categories}
        activeTeammateName="Hamza Ansari"
        onSave={onSave}
        {...props}
      />
    </ConfirmProvider>
  );
  return { onSave, onClose };
}

describe('PromptEditorModal — create', () => {
  it('saves a new prompt with title, text, and category', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Caption writer' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'Write a caption about X' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Hook Ideas' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Prompt;
    expect(saved.title).toBe('Caption writer');
    expect(saved.promptText).toBe('Write a caption about X');
    expect(saved.category).toBe('Hook Ideas');
    expect(saved.images).toEqual([]);
    expect(saved.videoLinks).toEqual([]);
    expect(saved.createdBy).toBe('Hamza Ansari');
  });

  it('defaults category to Uncategorized when none is picked and none exist', () => {
    const { onSave } = renderModal({ categories: [] });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave.mock.calls[0][0].category).toBe('Uncategorized');
  });

  it('adds and removes video link rows', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    const linkInputs = screen.getAllByPlaceholderText(/video link/i);
    expect(linkInputs).toHaveLength(1);
    fireEvent.change(linkInputs[0], { target: { value: 'https://youtube.com/watch?v=x' } });
    fireEvent.click(screen.getByRole('button', { name: /remove link/i }));
    expect(screen.queryAllByPlaceholderText(/video link/i)).toHaveLength(0);
  });

  it('includes entered video links in the saved prompt', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    fireEvent.change(screen.getByPlaceholderText(/video link/i), { target: { value: 'https://example.com/v' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave.mock.calls[0][0].videoLinks).toEqual(['https://example.com/v']);
  });
});

describe('PromptEditorModal — edit', () => {
  const existing: Prompt = {
    id: 'p1', title: 'Existing', promptText: 'Old text', category: 'Hashtags',
    images: [], videoLinks: ['https://example.com/a'],
    createdBy: 'Hamza Ansari', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  };

  it('pre-fills fields from the existing prompt', () => {
    renderModal({ prompt: existing });
    expect(screen.getByLabelText(/title/i)).toHaveValue('Existing');
    expect(screen.getByLabelText(/prompt text/i)).toHaveValue('Old text');
    expect(screen.getByPlaceholderText(/video link/i)).toHaveValue('https://example.com/a');
  });

  it('calls onDelete with the prompt id after confirming', async () => {
    const onDelete = vi.fn();
    renderModal({ prompt: existing, onDelete });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(await screen.findByRole('button', { name: /delete/i, exact: false }));
    // Second "Delete" is the confirm dialog's own button (ConfirmDialog mounted via ConfirmProvider).
    expect(onDelete).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PromptEditorModal.test.tsx`
Expected: FAIL — `Cannot find module './PromptEditorModal'`

- [ ] **Step 3: Write the implementation**

Create `src/components/PromptEditorModal.tsx`:

```tsx
import React, { useState } from 'react';
import { Prompt, PromptCategory } from '../types';
import { Modal } from './ui/Modal';
import { ImageCarouselField } from './ui/ImageCarouselField';
import { useConfirm } from './ui/ConfirmDialog';

export interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: Prompt;
  categories: PromptCategory[];
  activeTeammateName: string;
  onSave: (prompt: Prompt) => void;
  onDelete?: (id: string) => void;
}

export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen,
  onClose,
  prompt,
  categories,
  activeTeammateName,
  onSave,
  onDelete,
}) => {
  const confirm = useConfirm();
  const isEditing = Boolean(prompt);
  const [title, setTitle] = useState(prompt?.title || '');
  const [promptText, setPromptText] = useState(prompt?.promptText || '');
  const [category, setCategory] = useState(prompt?.category || categories[0]?.name || '');
  const [images, setImages] = useState<string[]>(prompt?.images || []);
  const [videoLinks, setVideoLinks] = useState<string[]>(prompt?.videoLinks || []);

  const handleSave = () => {
    if (!title.trim() || !promptText.trim()) return;
    const now = new Date().toISOString();
    const saved: Prompt = {
      id: prompt?.id || `prompt-${Date.now()}`,
      title: title.trim(),
      promptText: promptText.trim(),
      category: category.trim() || 'Uncategorized',
      images,
      videoLinks: videoLinks.map((v) => v.trim()).filter(Boolean),
      createdBy: prompt?.createdBy || activeTeammateName,
      createdAt: prompt?.createdAt || now,
      updatedAt: now,
    };
    onSave(saved);
    onClose();
  };

  const handleDelete = async () => {
    if (!prompt || !onDelete) return;
    const ok = await confirm({
      title: `Delete "${prompt.title}"?`,
      body: 'This removes the prompt from the library for everyone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) { onDelete(prompt.id); onClose(); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Prompt' : 'New Prompt'}
      size="md"
      footer={
        <div className="flex justify-between items-center w-full">
          {isEditing && onDelete ? (
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-xs font-bold font-label-caps text-[#dc2626] hover:bg-[#fcebeb] rounded-lg transition-colors"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-label-caps font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)] rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !promptText.trim()}
              className="px-3.5 py-2 text-xs font-label-caps font-bold bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt-title" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Title</label>
          <input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="prompt-category" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Category</label>
          <select
            id="prompt-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-label-caps font-bold"
          >
            {categories.length === 0 && <option value="">Uncategorized</option>}
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="prompt-text" className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest block mb-1.5">Prompt Text</label>
          <textarea
            id="prompt-text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={8}
            className="w-full font-mono text-[11px] leading-relaxed bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5"
          />
        </div>

        <div>
          <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest mb-1.5">Example Images</p>
          <ImageCarouselField images={images} onChange={setImages} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-label-caps text-[10px] font-bold text-[#57574f] tracking-widest">Video Links</p>
            <button
              type="button"
              onClick={() => setVideoLinks((prev) => [...prev, ''])}
              className="text-[10px] font-label-caps font-bold text-[#4f46e5] hover:underline"
            >
              + Add link
            </button>
          </div>
          <div className="space-y-2">
            {videoLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={link}
                  onChange={(e) => setVideoLinks((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  placeholder="Video link (YouTube, Reel, TikTok…)"
                  className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs"
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => setVideoLinks((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-[#5f5f5b] hover:text-[#dc2626]"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PromptEditorModal.test.tsx`
Expected: PASS (7 tests). If the delete-confirmation test is flaky on button-name ambiguity (both the modal's own "Delete" button and the confirm dialog's "Delete" button match `/delete/i`), scope the second click to the confirm dialog: `fireEvent.click((await screen.findAllByRole('button', { name: /delete/i }))[1])`.

- [ ] **Step 5: Commit**

```bash
git add src/components/PromptEditorModal.tsx src/components/PromptEditorModal.test.tsx
git commit -m "feat(prompts): add PromptEditorModal (create/edit/delete)"
```

---

## Task 6: `PromptsLibrary` section

**Files:**
- Create: `src/components/PromptsLibrary.tsx`
- Test: `src/components/PromptsLibrary.test.tsx`

**Interfaces:**
- Consumes: `Prompt` from Task 1; `usePromptCategories` from Task 4; `PromptEditorModal` from Task 5; `applyCategoryRename`/`applyCategoryDelete`/`UNCATEGORIZED` from Task 2.
- Produces: `PromptsLibraryProps { prompts: Prompt[], onAddPrompt, onUpdatePrompt, onDeletePrompt, activeTeammateName: string, showToast?: (message: string) => void }` — consumed by Task 7's `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/PromptsLibrary.test.tsx`:

```ts
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PromptsLibrary } from './PromptsLibrary';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { Prompt } from '../types';

vi.mock('../utils/storage', () => ({
  fetchRemotePromptCategories: vi.fn().mockResolvedValue([
    { id: 'c1', name: 'Hook Ideas', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
    { id: 'c2', name: 'Hashtags', sortOrder: 1, createdAt: '2026-10-01T00:00:00Z' },
  ]),
  upsertRemotePromptCategory: vi.fn().mockResolvedValue(undefined),
  deleteRemotePromptCategory: vi.fn().mockResolvedValue(undefined),
  subscribeRemotePromptCategories: vi.fn().mockReturnValue(() => {}),
  getStoredPromptCategories: vi.fn().mockReturnValue([]),
  saveStoredPromptCategories: vi.fn(),
}));

const prompts: Prompt[] = [
  { id: 'p1', title: 'Caption writer', promptText: 'Write a caption about {topic}', category: 'Hook Ideas', images: ['img1.png'], videoLinks: ['https://v.example/1'], createdBy: 'Hamza', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'p2', title: 'Hashtag generator', promptText: 'List 10 hashtags for {topic}', category: 'Hashtags', images: [], videoLinks: [], createdBy: 'Hamza', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];

function renderLibrary(props: Partial<React.ComponentProps<typeof PromptsLibrary>> = {}) {
  const onAddPrompt = vi.fn();
  const onUpdatePrompt = vi.fn();
  const onDeletePrompt = vi.fn();
  render(
    <ConfirmProvider>
      <PromptsLibrary
        prompts={prompts}
        onAddPrompt={onAddPrompt}
        onUpdatePrompt={onUpdatePrompt}
        onDeletePrompt={onDeletePrompt}
        activeTeammateName="Hamza Ansari"
        {...props}
      />
    </ConfirmProvider>
  );
  return { onAddPrompt, onUpdatePrompt, onDeletePrompt };
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('PromptsLibrary', () => {
  it('renders every prompt by default', () => {
    renderLibrary();
    expect(screen.getByText('Caption writer')).toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('filters by category chip', async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole('button', { name: 'Hashtags' }));
    expect(screen.queryByText('Caption writer')).not.toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('filters by search text', () => {
    renderLibrary();
    fireEvent.change(screen.getByPlaceholderText(/search prompts/i), { target: { value: 'hashtag' } });
    expect(screen.queryByText('Caption writer')).not.toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('shows no badges for a prompt with no images and no video links', () => {
    renderLibrary();
    const card = screen.getByText('Hashtag generator').closest('[data-testid="prompt-card"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).queryByText(/image/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/video/i)).not.toBeInTheDocument();
  });

  it('copies the exact prompt text, special characters included', async () => {
    const special: Prompt = { ...prompts[0], id: 'p3', title: 'Special', promptText: 'Line one\nLine "two" with \'quotes\'' };
    renderLibrary({ prompts: [special] });
    const card = screen.getByText('Special').closest('[data-testid="prompt-card"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Line one\nLine "two" with \'quotes\'');
  });

  it('opens the editor and calls onAddPrompt on save', async () => {
    const { onAddPrompt } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New one' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'Do X' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onAddPrompt).toHaveBeenCalledTimes(1);
  });

  it('deleting a category reassigns its prompts to Uncategorized', async () => {
    const { onUpdatePrompt } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /manage categories/i }));
    fireEvent.click(await screen.findByRole('button', { name: /delete category "hook ideas"/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(onUpdatePrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', category: 'Uncategorized' })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PromptsLibrary.test.tsx`
Expected: FAIL — `Cannot find module './PromptsLibrary'`

- [ ] **Step 3: Write the implementation**

Create `src/components/PromptsLibrary.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { Prompt } from '../types';
import { usePromptCategories } from '../hooks/usePromptCategories';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from '../utils/promptCategories';
import { PromptEditorModal } from './PromptEditorModal';
import { useConfirm } from './ui/ConfirmDialog';

export interface PromptsLibraryProps {
  prompts: Prompt[];
  onAddPrompt: (p: Prompt) => void;
  onUpdatePrompt: (p: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  activeTeammateName: string;
  showToast?: (message: string) => void;
}

export const PromptsLibrary: React.FC<PromptsLibraryProps> = ({
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  activeTeammateName,
  showToast,
}) => {
  const confirm = useConfirm();
  const { categories, addCategory, renameCategory, deleteCategory } = usePromptCategories();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (q && !p.title.toLowerCase().includes(q) && !p.promptText.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prompts, categoryFilter, searchQuery]);

  const handleCopy = async (p: Prompt) => {
    await navigator.clipboard.writeText(p.promptText);
    setCopiedId(p.id);
    showToast?.('Prompt copied to clipboard');
    setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 2000);
  };

  const handleSave = (p: Prompt) => {
    if (editingPrompt) onUpdatePrompt(p); else onAddPrompt(p);
  };

  const handleDeleteCategory = async (name: string) => {
    const ok = await confirm({
      title: `Delete category "${name}"?`,
      body: `Prompts in it move to "${UNCATEGORIZED}".`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await addCategory(UNCATEGORIZED);
    applyCategoryDelete(prompts, name)
      .filter((p, i) => p !== prompts[i])
      .forEach(onUpdatePrompt);
    await deleteCategory(name);
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    const ok = await renameCategory(oldName, trimmed);
    if (!ok) return false;
    applyCategoryRename(prompts, oldName, trimmed)
      .filter((p, i) => p !== prompts[i])
      .forEach(onUpdatePrompt);
    return true;
  };

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-headline-md text-lg font-bold text-[#1b1c1a]">Prompts Library</h1>
        <button
          onClick={() => { setEditingPrompt(undefined); setEditorOpen(true); }}
          className="px-3.5 py-2 text-xs font-bold font-label-caps rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Prompt
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-[#5f5f5b]">search</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#e9e9e7] rounded-lg"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-1 min-w-0">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-2 font-label-caps text-xs rounded-xl whitespace-nowrap ${categoryFilter === 'all' ? 'bg-[#1b1c1a] text-white font-bold' : 'bg-white border border-[#efefed] text-[#57574f]'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.name)}
              className={`px-3.5 py-2 font-label-caps text-xs rounded-xl whitespace-nowrap ${categoryFilter === c.name ? 'bg-[#1b1c1a] text-white font-bold' : 'bg-white border border-[#efefed] text-[#57574f]'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowManageCategories((v) => !v)}
          className={`px-3 py-2 font-label-caps text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${showManageCategories ? 'bg-[#4f46e5] text-white' : 'bg-white border border-[#e9e9e7] text-[#57574f]'}`}
        >
          Manage categories
        </button>
      </div>

      {showManageCategories && (
        <div className="bg-white border border-[#efefed] rounded-2xl p-4 space-y-3">
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    const el = e.currentTarget;
                    if (!el.value.trim()) { el.value = c.name; return; }
                    void handleRenameCategory(c.name, el.value).then((ok) => { if (!ok) el.value = c.name; });
                  }}
                  className="flex-1 min-w-0 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-bold"
                />
                <button
                  type="button"
                  aria-label={`Delete category "${c.name}"`}
                  onClick={() => { void handleDeleteCategory(c.name); }}
                  className="p-1.5 bg-[#fcebeb] hover:bg-[#dc2626] text-[#dc2626] hover:text-white rounded-lg"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-3 border-t border-[#efefed]">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs"
            />
            <button
              onClick={() => { void addCategory(newCategoryName); setNewCategoryName(''); }}
              disabled={!newCategoryName.trim()}
              className="bg-[#4f46e5] text-white font-label-caps text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Add category
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.id} data-testid="prompt-card" className="bg-white border border-[#e9e9e7] rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-headline-md text-sm font-bold text-[#1b1c1a] cursor-pointer" onClick={() => { setEditingPrompt(p); setEditorOpen(true); }}>
                {p.title}
              </h3>
              <span className="font-label-caps text-[9px] font-bold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 rounded-full whitespace-nowrap">{p.category}</span>
            </div>
            <p className="font-body-md text-xs text-[#5f5f5b] line-clamp-3 cursor-pointer" onClick={() => { setEditingPrompt(p); setEditorOpen(true); }}>
              {p.promptText}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-label-caps text-[#5f5f5b]">
              {p.images.length > 0 && <span>{p.images.length} image{p.images.length > 1 ? 's' : ''}</span>}
              {p.videoLinks.length > 0 && <span>{p.videoLinks.length} video link{p.videoLinks.length > 1 ? 's' : ''}</span>}
            </div>
            <button
              onClick={() => handleCopy(p)}
              className={`w-full py-1.5 text-xs font-bold font-label-caps rounded-lg flex items-center justify-center gap-1.5 ${copiedId === p.id ? 'bg-[#16a34a] text-white' : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'}`}
            >
              <span className="material-symbols-outlined text-sm">{copiedId === p.id ? 'check' : 'content_copy'}</span>
              {copiedId === p.id ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        ))}
      </div>

      <PromptEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        prompt={editingPrompt}
        categories={categories}
        activeTeammateName={activeTeammateName}
        onSave={handleSave}
        onDelete={editingPrompt ? onDeletePrompt : undefined}
      />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PromptsLibrary.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/PromptsLibrary.tsx src/components/PromptsLibrary.test.tsx
git commit -m "feat(prompts): add PromptsLibrary section (grid, filter, search, copy, categories)"
```

---

## Task 7: Navigation + `App.tsx` wiring

**Files:**
- Modify: `src/components/SideNav.tsx` (move `content-bank` to `MORE_ITEMS`, add `prompts` to `NAV_ITEMS`)
- Modify: `src/App.tsx` (prompts state, handlers, bootstrap effect, render branch)

**Interfaces:**
- Consumes: `PromptsLibrary` from Task 6; `getStoredPrompts`, `saveStoredPrompts`, `fetchRemotePrompts`, `upsertRemotePrompt`, `deleteRemotePrompt`, `subscribeRemotePrompts` from Task 3.

No new test file — this is pure wiring (nav item list, state plumbing identical in shape to `contentBank`'s existing wiring). Verified by `tsc` plus the manual browser sweep below.

- [ ] **Step 1: Update `SideNav.tsx`**

In `src/components/SideNav.tsx`, change the `NavTab` union (line 3):

```ts
export type NavTab = 'my-work' | 'calendar' | 'templates' | 'brand-kit' | 'assets' | 'dashboard' | 'integrations' | 'content-bank' | 'prompts' | 'research' | 'audit';
```

Replace `NAV_ITEMS` (lines 18-25):

```ts
const NAV_ITEMS: NavItem[] = [
  { tab: 'my-work', label: 'My Work', icon: 'checklist' },
  { tab: 'dashboard', label: 'Dashboard', icon: 'monitoring' },
  { tab: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { tab: 'templates', label: 'Templates', icon: 'quiz' },
  { tab: 'prompts', label: 'Prompts Library', icon: 'auto_stories' },
  { tab: 'research', label: 'Research & Plans', icon: 'lightbulb' }
];
```

Replace `MORE_ITEMS` (lines 30-35):

```ts
const MORE_ITEMS: NavItem[] = [
  { tab: 'brand-kit', label: 'Brand Kit', icon: 'palette' },
  { tab: 'assets', label: 'Assets', icon: 'layers' },
  { tab: 'content-bank', label: 'Content Bank', icon: 'article' },
  { tab: 'audit', label: 'Activity Log', icon: 'shield_person' },
  { tab: 'integrations', label: 'Integrations', icon: 'terminal' }
];
```

- [ ] **Step 2: Wire `App.tsx` imports**

The first import line in `src/App.tsx` currently reads:

```ts
import { Post, PostTemplate, BrandAsset, AppNotification, BrandId, ContentBankItem, TeamMember, ResearchItem } from './types';
```

Change to:

```ts
import { Post, PostTemplate, BrandAsset, AppNotification, BrandId, ContentBankItem, TeamMember, ResearchItem, Prompt } from './types';
```

In the `storage` import block, add after the Content Bank lines (after `subscribeRemoteContentBank,`):

```ts
  fetchRemotePrompts,
  upsertRemotePrompt,
  deleteRemotePrompt,
  subscribeRemotePrompts,
  getStoredPrompts,
  saveStoredPrompts,
```

Secondary tabs in this app are code-split via a `lazyNamed` helper (~line 58-69 in `App.tsx`), not statically imported — `ContentBank` itself is loaded this way:

```ts
const ContentBank = lazyNamed(() => import('./components/ContentBank'), 'ContentBank');
```

Add `PromptsLibrary` the same way, immediately after that line:

```ts
const PromptsLibrary = lazyNamed(() => import('./components/PromptsLibrary'), 'PromptsLibrary');
```

- [ ] **Step 3: Add `prompts` state**

Immediately after the existing `contentBank` state line (`const [contentBank, setContentBank] = useState<ContentBankItem[]>(() => getStoredContentBank());`, ~line 229):

```ts
const [prompts, setPrompts] = useState<Prompt[]>(() => getStoredPrompts());
```

Immediately after the existing content-bank persist effect (`useEffect(() => { saveStoredContentBank(contentBank); }, [contentBank]);`, ~line 289):

```ts
useEffect(() => { saveStoredPrompts(prompts); }, [prompts]);
```

- [ ] **Step 4: Add prompts to the bootstrap effect**

In the `// ── Remote Bootstrap + Realtime Subscriptions ──` effect (~lines 299-325), change the `Promise.all` call:

```ts
const [remoteTemplates, remoteAssets, remoteBank, remoteResearch] = await Promise.all([
  fetchRemoteTemplates(),
  fetchRemoteAssets(),
  fetchRemoteContentBank(),
  fetchRemoteResearchItems(),
]);
```

to:

```ts
const [remoteTemplates, remoteAssets, remoteBank, remoteResearch, remotePrompts] = await Promise.all([
  fetchRemoteTemplates(),
  fetchRemoteAssets(),
  fetchRemoteContentBank(),
  fetchRemoteResearchItems(),
  fetchRemotePrompts(),
]);
```

and add the matching set-call right after `if (remoteResearch && remoteResearch.length > 0) setResearchItems(remoteResearch);`:

```ts
if (remotePrompts && remotePrompts.length > 0) setPrompts(remotePrompts);
```

and add the subscription to the `unsubs` array, right after `subscribeRemoteResearchItems((data) => setResearchItems(data)),`:

```ts
subscribeRemotePrompts((data) => setPrompts(data)),
```

- [ ] **Step 5: Add prompts CRUD handlers**

Immediately after the existing `handleDeleteBankItem` line (~line 418, the one ending `// no file field`), add:

```ts
// ── Prompts Handlers ──────────────────────────────────────────────────────────
const handleAddPrompt = (p: Prompt) => { setPrompts((prev) => [p, ...prev]); upsertRemotePrompt(p); showToast('Saved prompt.'); };
const handleUpdatePrompt = (p: Prompt) => { setPrompts((prev) => prev.map((x) => (x.id === p.id ? p : x))); upsertRemotePrompt(p); showToast('Updated prompt.'); };
const handleDeletePrompt = (id: string) => { setPrompts((prev) => prev.filter((x) => x.id !== id)); deleteRemotePrompt(id); showToast('Deleted prompt.'); };
```

- [ ] **Step 6: Add the render branch**

Find the existing Content Bank render branch:

```tsx
{currentTab === 'content-bank' && (
  <ContentBank contentBank={contentBank} selectedBrandFilter={selectedBrandFilter} onAddBankItem={handleAddBankItem} onUpdateBankItem={handleUpdateBankItem} onDeleteBankItem={handleDeleteBankItem} onCreatePostFromCopy={handleCreatePostFromCopy} />
)}
```

Leave it exactly as-is (Content Bank itself doesn't change — only its nav position, handled in Task 7 Step 1). Add a new branch immediately after it:

```tsx
{currentTab === 'prompts' && (
  <PromptsLibrary
    prompts={prompts}
    onAddPrompt={handleAddPrompt}
    onUpdatePrompt={handleUpdatePrompt}
    onDeletePrompt={handleDeletePrompt}
    activeTeammateName={activeTeammate?.name || 'Someone'}
    showToast={showToast}
  />
)}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including every test from Tasks 2, 4, 5, 6.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: builds clean (the pre-existing >500kB chunk-size warning is acceptable; nothing else should warn).

- [ ] **Step 10: Apply the migration**

Migration `0024_prompts_library.sql` needs manual application via Supabase Studio SQL Editor (no service-role key in this environment — same pattern as every prior migration this project has shipped). Print the migration contents and ask the user to run it, then verify with a REST call that returns `[]` (not a column-not-found error) against both new tables before continuing.

- [ ] **Step 11: Manual browser sweep**

Per [[pzcms_sdd_workflow]], before merging:

- Navigate to the new "Prompts Library" primary nav item; confirm "Content Bank" now lives under "More" and still works unchanged from there.
- Create a prompt with a category, 2+ images (drag-reorder one), and 2+ video links. Save, reload the page, confirm everything persisted.
- Copy a prompt's text; paste it somewhere to confirm the clipboard has the exact text.
- Rename a category; confirm every prompt in it updates. Delete a category; confirm its prompts land in "Uncategorized".
- Open the same Prompts Library in two browser tabs, add a prompt in one, confirm it appears in the other without a reload (Realtime Focus item from this plan's Review Focus section).

- [ ] **Step 12: Commit**

```bash
git add src/components/SideNav.tsx src/App.tsx
git commit -m "feat(prompts): wire Prompts Library into nav and App.tsx, move Content Bank to More"
```

---

## Self-Review Notes

**Spec coverage:** §1 (goal/scope) → Tasks 1-7 collectively. §4 (data model) → Task 1 (corrected `prompts.id` to `text`, matching codebase convention over the spec's literal SQL — noted in Global Constraints). §5 (types) → Task 1. §6 (categories) → Tasks 2 & 4. §7 (prompts CRUD) → Tasks 3 & 7. §8 (nav) → Task 7. §9 (components) → Tasks 5 & 6. §10 (testing) → every task's own test file plus Task 7's manual sweep. §11 (out of scope) → not built; nothing in this plan exceeds it.

**Placeholder scan:** none found — every step has real code, no TBD/TODO.

**Type consistency:** `Prompt`/`PromptCategory` field names (`promptText`, `videoLinks`, `sortOrder`, etc.) are identical across Tasks 1, 3, 4, 5, 6. `usePromptCategories`'s returned shape (`categories`, `addCategory`, `renameCategory`, `deleteCategory`, `reorderCategories`) matches exactly between Task 4's implementation and Tasks 5/6's consumption.

**Review Focus:** all five items (category-delete reassignment, duplicate-rename refusal, empty-media card, special-character copy, realtime cross-tab update) have an owning task and test, listed above.
