# Tutorials Library Implementation Plan

**Goal:** Build a high-fidelity Tutorials & Courses hub in PZ-CMS with in-app video playback (YouTube & Google Drive), curated important links, copyable prompts, attached files, rich markdown notes, and category management.

**Architecture:** Two new Supabase tables (`tutorials`, `tutorial_categories`) matching this codebase's established managed category pattern and remote-synced collection pattern. Both brand-scoped and shared tutorials. Placed in `SideNav.tsx` as a primary navigation item.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + Realtime), Tailwind CSS, Vitest (globals:false, explicit imports).

**Spec:** `docs/superpowers/specs/2026-10-04-tutorials-library-design.md`

---

## Task 1: Types & Supabase Migration

**Files:**
- Modify: `src/types.ts`
- Create: `supabase/migrations/0025_tutorials_library.sql`

- [ ] **Step 1.1:** Add types to `src/types.ts`:
  - `TutorialVideo`: `{ title: string; url: string; platform?: 'youtube' | 'drive' | 'vimeo' | 'other' }`
  - `TutorialLink`: `{ title: string; url: string }`
  - `TutorialPrompt`: `{ title: string; promptText: string }`
  - `TutorialFile`: `{ name: string; url: string; fileType?: string; driveFileId?: string }`
  - `TutorialCategory`: `{ id: string; name: string; sortOrder: number; createdAt: string }`
  - `Tutorial`: `{ id: string; brandId: BrandId | 'shared'; title: string; description: string; category: string; tags: string[]; videos: TutorialVideo[]; links: TutorialLink[]; prompts: TutorialPrompt[]; files: TutorialFile[]; createdBy?: string; createdAt: string; updatedAt: string }`
- [ ] **Step 1.2:** Create migration `supabase/migrations/0025_tutorials_library.sql` with tables, indexes, RLS policies, realtime publication, and starter categories.

---

## Task 2: Video Embed & URL Parsing Utilities

**Files:**
- Create: `src/utils/videoEmbed.ts`
- Create: `src/utils/videoEmbed.test.ts`

- [ ] **Step 2.1:** Implement `src/utils/videoEmbed.ts`:
  - `extractYouTubeId(url: string): string | null`
  - `extractDriveId(url: string): string | null`
  - `getEmbedInfo(url: string): { type: 'youtube' | 'drive' | 'other'; embedUrl?: string; thumbnailUrl?: string }`
- [ ] **Step 2.2:** Write Vitest tests in `src/utils/videoEmbed.test.ts` covering standard YouTube URLs, short URLs (`youtu.be`), YouTube Shorts, Drive `/file/d/.../view` URLs, and fallback cases.

---

## Task 3: Category Cascade Utilities

**Files:**
- Create: `src/utils/tutorialCategories.ts`
- Create: `src/utils/tutorialCategories.test.ts`

- [ ] **Step 3.1:** Implement `applyCategoryRename` and `applyCategoryDelete` for tutorials, matching the patterns in `templateCategories.ts`.
- [ ] **Step 3.2:** Write Vitest tests in `src/utils/tutorialCategories.test.ts`.

---

## Task 4: Hooks for Tutorials & Categories

**Files:**
- Create: `src/hooks/useTutorialCategories.ts`
- Create: `src/hooks/useTutorials.ts`

- [ ] **Step 4.1:** Implement `useTutorialCategories` with fetch, realtime subscription, addCategory, renameCategory, deleteCategory.
- [ ] **Step 4.2:** Implement `useTutorials` with fetch, realtime subscription, createTutorial, updateTutorial, deleteTutorial, optimistic updates, and brand filtering.

---

## Task 5: Player & Tutorial Components

**Files:**
- Create: `src/components/tutorials/InAppVideoPlayer.tsx`
- Create: `src/components/tutorials/InAppVideoPlayer.test.tsx`
- Create: `src/components/tutorials/TutorialCard.tsx`
- Create: `src/components/tutorials/TutorialDetailModal.tsx`
- Create: `src/components/tutorials/TutorialEditorModal.tsx`
- Create: `src/components/tutorials/TutorialCategoryModal.tsx`

- [ ] **Step 5.1:** Build `InAppVideoPlayer.tsx` with responsive 16:9 aspect ratio, multi-video switcher, iframe sandbox, and fallback button.
- [ ] **Step 5.2:** Build `TutorialCard.tsx` with video thumbnail, brand badge, resource counters, and quick actions.
- [ ] **Step 5.3:** Build `TutorialDetailModal.tsx` with embedded player, tabs for Notes (Markdown), Links, Prompts (with 1-click copy), and Files.
- [ ] **Step 5.4:** Build `TutorialEditorModal.tsx` with multi-repeater fields for videos, links, prompts, and files.
- [ ] **Step 5.5:** Build `TutorialCategoryModal.tsx` for adding, renaming, and deleting categories.

---

## Task 6: Main View & Navigation Integration

**Files:**
- Create: `src/components/TutorialsLibrary.tsx`
- Create: `src/components/TutorialsLibrary.test.tsx`
- Modify: `src/components/SideNav.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 6.1:** Build `TutorialsLibrary.tsx` with search, category filter pills, brand filter, card grid, and modals.
- [ ] **Step 6.2:** Add `'tutorials'` to `SideNav.tsx` `NAV_ITEMS` with icon `school`.
- [ ] **Step 6.3:** Integrate `TutorialsLibrary` into `App.tsx` with active brand and audit event logging.
- [ ] **Step 6.4:** Write comprehensive integration test in `TutorialsLibrary.test.tsx`.

---

## Task 7: Verification & Quality Gate

- [ ] **Step 7.1:** Run TypeScript verification: `npx tsc --noEmit`.
- [ ] **Step 7.2:** Run Vitest suite: `npx vitest run`.
- [ ] **Step 7.3:** Run production build: `npm run build`.
