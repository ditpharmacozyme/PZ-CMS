# Ads Library — Design

Date: 2026-11-19 · Status: draft for approval

## Intent and why

The team makes several ads every day for courses, workshops, webinars and
programs. Today each ad is made, downloaded, handed over, and then lost. There
is nowhere to find an old ad again, reuse it, or treat it as a template. Meta
ads managers (people outside the team, not logged in) also need to pick and
download creatives without asking someone to send files.

Build an **Ads Library** section in PZ-CMS: an organized, searchable store of
ad creatives whose files live in **Google Drive**, with public share links for
people who are not logged in. Users are non-technical, so every flow must be
obvious (drag-and-drop, plain labels, no jargon).

## Goals

- Store creatives (images, carousels, videos, zips) in Google Drive, uploaded
  from the app by drag-and-drop.
- Organize in three levels: **Course/Program → Ad Set → Creative**.
  Example: "PPC Batch 3" (course) → "Module 1" (ad set) → 45 images.
- Find things fast: one search box over names and tags, plus filters.
- Share a **revocable public link at any level** (course, ad set, or single
  creative). The public page needs no login and offers search, thumbnails,
  select, and download (one or many).
- One **standing public link** (a fixed address, e.g. `/ads`) where ads
  managers can always search every ad set and creative. It shows everything by
  default; any course, set or creative can be **hidden** from it.
- "Use as template": each creative can carry an optional editable-source link
  (e.g. a Canva design) with an "Open source file" button.
- Fallback: register an existing Drive file by pasting its link instead of
  uploading.

## Non-goals

- No ad performance data, no Meta Ads API integration, no publishing.
- No editing or design tooling inside the app.
- No per-person guest accounts; the public side is link-based only.
- No dark mode (project rule: light theme only).
- No import of the existing `ADs/` sample folder as part of the build (those
  are examples). A bulk-import helper is a possible later request.

## Anti-goals (would be a failure even if it "works")

- A public link exposing anything beyond what that link was created for, or
  letting a visitor write, or read other tables.
- Non-tech users needing to know about Drive folders, IDs or permissions.
- Files stored anywhere but Drive (no Supabase Storage for ad files).
- Searching returning stale or confusing duplicates; messy free-text tags.

## Constraints

- Stack: React + TypeScript + Vite, Tailwind, Supabase, Vitest. Existing
  design tokens and palette guard apply (`#f0fdf4` retired). All tests and the
  build must pass before pushing; push to `main` deploys on Vercel.
- Drive access goes through the existing Google Apps Script web app and
  `api/appscript/proxy.ts`. Vercel functions cap request bodies at about
  4.5MB, so **file bytes must not pass through Vercel**.
- All existing tables are authenticated-only under RLS. Public access needs a
  new narrow read-only path that exposes only what a link covers.
- Apps Script changes need the user to redeploy the web app (as in the
  delete-cascade work); the plan must include that manual step.
- Deleting in-app should also remove the Drive file, following the existing
  delete-cascade pattern (Apps Script moves files to Drive trash).

## Approaches considered

- **A. Upload through the existing proxy.** Simplest, but Vercel's body limit
  breaks videos and zips. Rejected.
- **B. Link-only (register Drive files by link).** No size limits and little
  to build, but staff must paste a link per ad; poor for non-tech users.
  Kept as the **fallback**.
- **C. Direct browser-to-Drive upload (chosen).** Apps Script starts a Drive
  resumable-upload session in a shared Ads Library folder and returns the
  session URL; the browser uploads the file straight to Google. Handles large
  videos and zips. Cost: a new Apps Script action and redeploy. The
  user chose C with B as fallback.

## Decisions (as the user made them)

- Three levels: Course/Program → Ad Set → Creative.
- Share links at all three levels, plus one standing link showing everything
  with a hide option (user chose "show everything, but hide available").
- Storage is Google Drive only.
- Approach C with B as fallback.
- Files are set to "anyone with the link can view" in Drive. Revoking a share
  link or hiding an item controls only what the app lists; it does not revoke
  Drive access for someone who already has a file's Drive URL. The user
  accepted this trade-off (ads are meant to be public; Drive IDs are
  unguessable). The alternative (private files behind a gate) was rejected as
  too large and in conflict with "no bytes through Vercel".
- Deleting a course or ad set that still has creatives asks the user to
  choose: delete everything inside (Drive files go to Drive trash, auto-purged
  after 30 days, as in the delete-cascade work) or move the creatives to
  "Unsorted". The confirmation shows how many creatives are affected.

## My calls (not yet confirmed by the user)

- A creative lives in exactly one ad set and can be moved between sets; loose
  uploads go to an "Unsorted" set. An ad set belongs to one course, or to none.
- Tags are picked from lists, not free text: brand (reuses existing brands),
  kind (fixed list: course, workshop, webinar, program), audience
  (admin-editable list). The Course/Program level is the "program" — there is
  no separate program tag. Format (image, carousel, video, zip), upload date
  and uploader are filled automatically.
- A carousel is one creative with several slide files; a zip is one file with
  no preview. No duplicate detection.
- Hiding an item affects only the standing `/ads` page; a direct share link
  to a hidden item still works. The standing link has no token and no kill
  switch beyond hiding.
- Drive layout (user instruction, replaces my earlier flat-folder call):
  Drive mirrors the app. Everything sits under one root "Ads Library" folder
  (ID held as an Apps Script property), with a subfolder per course and, inside
  it, a subfolder per ad set: `Ads Library / <Course> / <Ad Set> / files`.
  Ad sets with no course sit directly under the root; "Unsorted" is a root
  folder. The app creates, renames and moves these folders automatically via
  Apps Script, and stores each folder's Drive ID in the database. Moving a
  creative between sets moves the Drive file; deleting with "move to Unsorted"
  moves the files; deleting with "delete everything" trashes the folder and its
  files.
- Any logged-in teammate can upload, organize, and create or revoke share
  links; deleting creatives follows the tutorials rule (uploader or admin).
- Direct browser-to-Drive upload is unproven against the user's Apps Script.
  The plan must start with a small spike to prove it (including reading the
  file ID after upload despite CORS); if it fails, fall back to paste-a-link
  (B) or chunked upload.
- Share links use random unguessable tokens, can be revoked, and need no
  login. Optional expiry is left to the builder.
- Newly uploaded items are visible on the standing link by default (user's
  choice); the hide toggle is per course, set or creative, and hiding a
  parent hides everything under it.
- Anyone logged in can upload and organize; delete follows existing role
  rules (builder to match how tutorials/assets work).
- Public page lives at the same site (a route such as `/ads` and `/s/<token>`),
  using the anon Supabase key and read-only security-definer functions, not
  open table policies.

## Left to the builder

- Table design and migration (`0027`+): programs, ad sets, creatives, share
  links, tags, plus search indexing. Public read functions keyed by token.
- Apps Script actions: find-or-create course/ad set folders under the root,
  rename and move folders and files, create a resumable-upload session in the
  target ad set folder, set files to "anyone with the link can view", and
  trash files/folders on delete. Keep the database and Drive in step if a
  folder is renamed or deleted directly in Drive (builder decides how to
  detect or tolerate drift).
- How multi-select download works (client-side zip for images; large videos
  as individual downloads) and Drive's large-file download confirmation page.
- Thumbnails (Drive thumbnail URLs vs generated preview), carousel slides
  display, and how a zip is represented.
- Routing for public pages in the existing SPA/Vercel setup, and the anon
  client without touching the logged-in auth gate.
- UI layout inside the app (new tab alongside Tutorials/Prompts) and mobile
  behavior, following existing patterns.
- Testing approach, including a test that public functions leak nothing
  hidden or revoked.
