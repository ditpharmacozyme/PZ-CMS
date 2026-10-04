# Tutorials Library Design Spec

**Date:** 2026-10-04
**Branch:** `feat/tutorials-library` (to be created in isolated worktree)
**Status:** Design Proposal (Pending Approval)

---

## 1. Goal

Provide a dedicated, high-fidelity **Tutorials & Courses** hub inside PZ-CMS where the team can organize and consume internal training, SOPs, courses, video tutorials, prompts, reference files, and important operational links.

### Key Requirements (from user brainstorm):
1. **Brand Scope:** Supports both brand-specific tutorials (e.g. `pharmacozyme`, `pz-academy`, `med-q`, etc.) AND `shared` tutorials available to all brands.
2. **Navigation:** Placed as a **Primary item** in the sidebar navigation (`SideNav.tsx`), one click away.
3. **In-App Video Playback:** Seamless embedded video player for YouTube (responsive 16:9 iframe) and Google Drive video previews, plus direct links.
4. **Structured Rich Content:**
   - **Video/Course Links:** YouTube and Google Drive URLs with optional descriptive titles.
   - **Important Links:** Curated list of `{ title, url }` pairs (Figma, Notion SOPs, web tools, docs).
   - **Associated Prompts:** Dedicated copyable prompt blocks with instant 1-click clipboard copy.
   - **Files & Assets:** Downloadable files, Google Drive links, attachments with file type indicators.
   - **Description / Syllabus:** Rich Markdown notes and timestamps (lazy-loaded `react-markdown`).
5. **Managed Categories:** Dynamic add/rename/delete category system with an `Uncategorized` fallback and safe cascading renames/deletions.

---

## 2. Navigation & Placement

### `SideNav.tsx`
- **Primary Nav Item:** Add `tutorials` to `NAV_ITEMS`:
  - `tab: 'tutorials'`
  - `label: 'Tutorials'`
  - `icon: 'school'` (Material Symbol)
- Placed directly in the primary list (alongside My Work, Dashboard, Calendar, Templates, Prompts Library, Research & Plans).

### `TopNav.tsx` / `App.tsx`
- When viewing the Tutorials tab, the active brand filter in `TopNav` filters the list:
  - If a brand is selected: displays tutorials tagged with that brand + tutorials marked `'shared'`.
  - An optional toggle or filter allows viewing only shared or only brand-specific tutorials.
  - Search bar in the Tutorials header searches across titles, descriptions, and tags.

---

## 3. Data Model

Migration: `supabase/migrations/0025_tutorials_library.sql`

```sql
create table if not exists tutorial_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists tutorial_categories_lower_name_idx
  on tutorial_categories (lower(name));

create table if not exists tutorials (
  id          uuid primary key default gen_random_uuid(),
  brand_id    text not null default 'shared',
  title       text not null,
  description text not null default '',
  category    text not null default 'Uncategorized',
  tags        jsonb not null default '[]'::jsonb,
  videos      jsonb not null default '[]'::jsonb,
  links       jsonb not null default '[]'::jsonb,
  prompts     jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tutorials_brand_id_idx on tutorials (brand_id);
create index if not exists tutorials_category_idx on tutorials (category);

-- RLS policies (authenticated only)
alter table tutorial_categories enable row level security;
drop policy if exists "tutorial_categories authenticated read"  on tutorial_categories;
create policy "tutorial_categories authenticated read"  on tutorial_categories for select to authenticated using (true);
drop policy if exists "tutorial_categories authenticated write" on tutorial_categories;
create policy "tutorial_categories authenticated write" on tutorial_categories for all    to authenticated using (true) with check (true);

alter table tutorials enable row level security;
drop policy if exists "tutorials authenticated read"  on tutorials;
create policy "tutorials authenticated read"  on tutorials for select to authenticated using (true);
drop policy if exists "tutorials authenticated write" on tutorials;
create policy "tutorials authenticated write" on tutorials for all    to authenticated using (true) with check (true);

-- Realtime publication
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tutorial_categories') then
    alter publication supabase_realtime add table tutorial_categories;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tutorials') then
    alter publication supabase_realtime add table tutorials;
  end if;
end $$;

-- Default Starter Categories
insert into tutorial_categories (name, sort_order) values
  ('Onboarding & SOPs', 0),
  ('Video Production', 1),
  ('Design & Creative', 2),
  ('AI Tools & Workflows', 3),
  ('Copywriting & Content', 4)
on conflict (lower(name)) do nothing;
```

---

## 4. TypeScript Types (`src/types.ts`)

```ts
export interface TutorialVideo {
  title: string;
  url: string;
  platform?: 'youtube' | 'drive' | 'vimeo' | 'other';
}

export interface TutorialLink {
  title: string;
  url: string;
}

export interface TutorialPrompt {
  title: string;
  promptText: string;
}

export interface TutorialFile {
  name: string;
  url: string;
  fileType?: string;
  driveFileId?: string;
}

export interface TutorialCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Tutorial {
  id: string;
  brandId: BrandId | 'shared';
  title: string;
  description: string;
  category: string;
  tags: string[];
  videos: TutorialVideo[];
  links: TutorialLink[];
  prompts: TutorialPrompt[];
  files: TutorialFile[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Video Embedding & Helper Utilities (`src/utils/videoEmbed.ts`)

- **YouTube Parser:** Extracts 11-character video ID from:
  - `https://www.youtube.com/watch?v=VIDEO_ID`
  - `https://youtu.be/VIDEO_ID`
  - `https://www.youtube.com/shorts/VIDEO_ID`
  - `https://www.youtube.com/embed/VIDEO_ID`
  Produces secure embed URL: `https://www.youtube-nocookie.com/embed/VIDEO_ID`.
- **Google Drive Parser:** Detects Google Drive file links (`/file/d/FILE_ID/view`) and converts to preview URL `https://drive.google.com/file/d/FILE_ID/preview`.
- **In-App Player Component:**
  - Renders a clean 16:9 responsive container with `iframe` (sandbox/allow attributes properly configured).
  - Fallback button to "Open in new tab" if embed fails or for third-party platforms.
  - Video selector tab strip if a tutorial has multiple videos.

---

## 6. User Interface Architecture

```
src/components/
├── TutorialsLibrary.tsx              // Main container: search, category chips, brand filter, card grid
├── tutorials/
│   ├── TutorialCard.tsx              // Grid card with video thumbnail, brand tag, counts for links/prompts/files
│   ├── TutorialDetailModal.tsx       // Full player modal: embedded video, markdown notes, copyable prompts, links, files
│   ├── TutorialEditorModal.tsx       // Form modal: title, brand selector, category, dynamic video/link/prompt/file lists
│   ├── InAppVideoPlayer.tsx          // 16:9 iframe embedder with multi-video selector
│   └── TutorialCategoryModal.tsx     // Add/rename/delete category modal with cascade handling
```

### UX Highlights:
1. **Card Grid View:**
   - Shows video thumbnail (auto-generated for YouTube via `img.youtube.com/vi/<id>/hqdefault.jpg`, or placeholder for Drive).
   - Brand indicator badge (e.g. "Shared" or brand icon/tag).
   - Counters for attached resources: `[2 Videos] [3 Links] [4 Prompts] [1 File]`.
   - 1-click play button opening the Detail Modal directly to the video player.
2. **Tutorial Detail Modal:**
   - **Top section:** Large embedded responsive player. If multiple videos, interactive tab pills to switch between Part 1, Part 2, etc.
   - **Description Tab:** Markdown-rendered notes, syllabus, key takeaways.
   - **Prompts Tab:** Card for each prompt with 1-click "Copy Prompt" button with visual feedback ("Copied!").
   - **Important Links Tab:** Clickable resource cards with clean link previews and domain tags.
   - **Files Tab:** Downloadable assets and Drive file links.
3. **Tutorial Editor Modal:**
   - Dynamic repeatable rows for:
     - Videos (`title`, `url`) with instant embed preview.
     - Important links (`title`, `url`).
     - Prompts (`title`, `promptText`).
     - Files (`name`, `url`).
   - Category selector with shortcut to manage categories.
   - Brand selector (`shared` or specific brand).

---

## 7. Category Management & Safety

- Uses the same robust pattern established in `useTemplateCategories` and `usePromptCategories`:
  - `applyCategoryRename(tutorials, oldName, newName)`: automatically updates all affected tutorials in local state and DB.
  - `applyCategoryDelete(tutorials, categoryToDelete, fallbackCategory)`: moves tutorials to `Uncategorized` when a category is deleted.
  - Case-insensitive uniqueness check prevents duplicates.

---

## 8. Testing Plan

Vitest tests (`globals:false`) with comprehensive coverage:
1. `src/utils/videoEmbed.test.ts`:
   - Validates YouTube regex for standard URLs, short links, shorts, timestamps, invalid links.
   - Validates Google Drive URL parsing to `/preview`.
2. `src/utils/tutorialCategories.test.ts`:
   - Renaming updates matching items and leaves others intact.
   - Deleting cascades to `Uncategorized`.
3. `src/components/TutorialsLibrary.test.tsx`:
   - Filtering by brand (`all`, `shared`, specific brand).
   - Filtering by category and search term.
   - Opening Detail Modal and Editor Modal.
4. `src/components/tutorials/InAppVideoPlayer.test.tsx`:
   - Renders iframe for YouTube and Drive.
   - Graceful fallback for non-embeddable links.

---

## 9. Verification Gate

Before any merge:
```bash
npx tsc --noEmit && npx vitest run && npm run build
```
Manual check:
- Add a tutorial with YouTube link, verify in-app playback.
- Add a tutorial with Google Drive link and multiple prompt snippets.
- Copy prompt to clipboard and verify toast/button feedback.
- Filter by brand and category.
