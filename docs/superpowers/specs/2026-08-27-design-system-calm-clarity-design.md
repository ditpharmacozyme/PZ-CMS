# Design System Upgrade — "Calm Clarity"

**Date:** 2026-08-27
**Branch:** `feat/design-system` (forked from `main` @ `4ea1568`)
**Status:** Approved design, pending implementation plan

---

## 1. Goal

Replace the current "editorial/zine" look (all-caps Space Mono labels, olive/sage/forest-green
palette, hard-coded arbitrary hex everywhere) with a calm, high-contrast, productivity-tool
aesthetic — Linear / Height / Notion territory — **without changing any feature behaviour**.

The user's stated pain points, all confirmed:
1. All-caps monospace labels everywhere — shouty, slow to scan.
2. Green/olive palette — muddy, weak hierarchy between "primary action" and everything else.
3. Density & rhythm feel off for all-day work.
4. Looks dated, not "premium".

Constraints:
- **Light mode only** this round. No dark theme.
- Accent colour **may move off green** entirely (user confirmed).
- The five **client brand identities** in `src/data/brands.ts` and the per-brand specimen
  fonts (`src/utils/brandTypography.ts`, `.font-specimen-*`) are **out of scope** — those are
  the customers' brands, not the tool chrome. Brand `primaryColor` values still drive brand
  chips and stay as-is.
- No new features. (Workflow features shipped in Phases 3–8, already merged.)

---

## 2. The Target System

Validated visually with the brainstorm companion (`.superpowers/brainstorm/…`, gitignored).
Direction **A — Calm Clarity** with the **V3 "full card"** calendar post chip.

### 2.1 Colour tokens (light only)

| Token | Hex | Role |
|---|---|---|
| `--color-canvas` | `#FBFBFA` | app background (replaces `#F7F6F0` / `#faf9f5` page bg) |
| `--color-surface` | `#FFFFFF` | cards, panels, modals |
| `--color-sunken` | `#F4F4F3` | inset fills, input backgrounds, muted panels |
| `--color-muted` | `#F1F1F0` | chip backgrounds, hover fills (replaces `#efeeea`) |
| `--color-line` | `#E9E9E7` | default borders (replaces sage `#bfcab4`) |
| `--color-line-subtle` | `#EFEFED` | hairlines (replaces `#e5e4de`) |
| `--color-ink` | `#1B1B1A` | primary text — **`#1b1c1a` is kept, it already matches** |
| `--color-ink-muted` | `#5F5F5B` | secondary text (replaces olive `#707a67`) |
| `--color-ink-soft` | `#57574F` | tertiary / dark-olive replacement (`#404a39`) |
| `--color-accent` | `#4F46E5` | primary actions, links, focus, selection (replaces green `#296c00`) |
| `--color-accent-hover` | `#4338CA` | hover / pressed |
| `--color-accent-soft` | `#EEF2FF` | selected rows, accent chips, "in design" status |
| `--color-accent-on-soft` | `#4338CA` | text/icon on `accent-soft` |
| `--color-success` | `#15803D` | done / posted / scheduled / positive trend |
| `--color-success-soft` | `#E6F4EA` | success chip bg |
| `--color-warn` | `#B45309` | needs-review / in-progress / caution |
| `--color-warn-soft` | `#FBF0E1` | warn chip bg |
| `--color-danger` | `#DC2626` | destructive, overdue, errors |
| `--color-danger-soft` | `#FCEBEB` | danger chip bg |
| `--color-neutral` | `#52525B` | not-started / inert status |
| `--color-neutral-soft` | `#F1F1F0` | neutral chip bg |

Legacy `@theme` names still referenced by `ui/` primitives (`--color-raised`, `--color-line`,
`--color-danger-soft`, etc.) are kept as aliases so `ui/Button.tsx` etc. need no edits.

### 2.2 Typography — Inter only

Hierarchy comes from **size + weight**, never letter-casing or monospace.

| Utility (kept name, redefined) | Spec |
|---|---|
| `.font-display-xl` | Inter 700, 24px equiv, `-0.02em` |
| `.font-headline-md` | Inter 600, `-0.01em` |
| `.font-label-caps` | **Inter 500, normal case, `letter-spacing: 0`, `text-transform: none`** |
| `.font-body-md` | Inter 400 |
| `.font-code-sm` | Space Mono 400, 0.72rem — **data only** (IDs, versions, %, timestamps) |

- Base `body` font → Inter stack.
- `index.html`: keep Inter, Space Grotesk, Space Mono, Material Symbols. **Drop** unused
  families from the Google Fonts URL: Fredoka One, Rajdhani, New Amsterdam, Nunito Sans,
  Montserrat, Poppins, Plus Jakarta Sans — **unless** still referenced by
  `brandTypography.ts` specimen previews (verify per-family before removing; keep any that are).
- `.font-label-caps` redefinition alone reskins ~398 call sites. A follow-up sweep removes
  the ~169 standalone `uppercase` classes that sit next to labels/buttons (keep `uppercase`
  only where it's a deliberate 2–3 letter code, e.g. brand shortCodes).

### 2.3 Shape, depth, focus

- Radius scale: `sm 6px`, `md 8px`, `lg 12px`, `xl 16px`. Normalise the current
  3px/4px/`rounded-lg`/`rounded-xl`/`rounded-2xl` mix.
- Shadows → neutral (drop the green tint in `.warm-shadow*`):
  `xs 0 1px 2px rgba(0,0,0,.04)` · `sm 0 1px 3px rgba(0,0,0,.06)` · `md 0 4px 12px rgba(0,0,0,.08)` · `lg 0 12px 32px rgba(0,0,0,.12)`.
- Global input focus ring → `border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(79,70,229,.22)`.
- `.nav-item-active`, `.btn-primary`, `.btn-danger`, `.brand-chip`, `.status-pill`,
  `.tag-pill`, `.stamp-badge` → restyle in place (solid accent, Inter, no gradients/caps).

### 2.4 Calendar post chip — V3 "full card"

The most-scanned element. New `src/components/calendar/PostCard.tsx` layout:

```
┌─────────────────────────────┐
│ [BRAND]        [status pill] │   brand chip (brand.primaryColor bg) + status pill
│ Post title, up to two lines  │   Inter 600, 12px
│ 📷 09:00              (HA)    │   platform icon · time · assignee avatar
└─────────────────────────────┘
```

- White surface, `--color-line` border, `shadow-xs`, radius `md`.
- Month view: 2 cards then "+N more" in `--color-accent-on-soft`.
- Status pill colours come from §2.1 status tokens via `statusConfig.ts`.
- Keep existing drag/drop, click-to-open, selection, and `min-h` touch targets.

### 2.5 Status language (one system everywhere)

Rewrite `STATUS_CONFIG` in `src/utils/statusConfig.ts`:

| status | color | bgColor |
|---|---|---|
| `not-started` | `#52525B` | `#F1F1F0` |
| `in-progress` | `#B45309` | `#FBF0E1` |
| `ready-to-post` | `#4F46E5` | `#EEF2FF` |
| `posted` | `#15803D` | `#E6F4EA` (icon `check_circle`) |
| `overdue` | `#DC2626` | `#FCEBEB` (icon `error`) |

"In design" / stage-pending states that currently render green move to accent-soft or
success per meaning (design-in-progress = accent; stage-complete = success).

---

## 3. Rollout Strategy

**Chosen:** central-class redefinition + scripted mechanical hex sweep + targeted semantic pass.
**Rejected:** (a) full tokenisation `bg-[#296c00]`→`bg-accent` across ~2000 sites — 2× diff,
real regression risk, no urgent payoff; (b) per-screen incremental — leaves the app
half-migrated for weeks.

Scale: ~2,000 arbitrary-hex occurrences across 39 component files. Distribution:
`#296c00` ×350, `#bfcab4` ×337, `#707a67` ×283, `#1b1c1a` ×225 (kept), `#faf9f5` ×138,
`#efeeea` ×98, `#404a39` ×66, `#e5e4de` ×54, `#ba1a1a` ×48, `#1f5700` ×38, others <30.

### Phase A — Foundations (no component files)
`src/index.css` + `index.html` only. Rewrite `@theme` block, the 5 `.font-*` utilities,
`body`, `.btn-*`, `.brand-chip`, `.status-pill`, `.tag-pill`, `.stamp-badge`,
`.nav-item-active`, `.warm-shadow*`, scrollbar, input focus. Trim font URL.
`ui/Button.tsx` and the other `ui/` primitives inherit via tokens — no edits.
Expected: ~40% of the app shifts immediately.

### Phase B — Mechanical palette sweep
Script a literal find-replace across `src/**/*.{ts,tsx}` for the safe mappings:
`#bfcab4→#E9E9E7`, `#707a67→#5F5F5B`, `#404a39→#57574F`, `#faf9f5→#F4F4F3`,
`#efeeea→#F1F1F0`, `#e5e4de→#EFEFED`, `#f7f6f2→#F4F4F3`, `#ba1a1a→#DC2626`,
`#ffdad6→#FCEBEB`, `#935c00→#B45309`, `#ffddb0→#FBF0E1`, `#F7F6F0→#FBFBFA`.
Case-insensitive match, preserve surrounding text.
**Exclude** `src/utils/statusConfig.ts`, `src/data/brands.ts`, `src/utils/brandTypography.ts`.
Keep `#1b1c1a` untouched.

### Phase C — Green split (judgment pass)
`#296c00` / `#205400` / `#1f5700` / `#296951` / `#aceecf` / `#78d24b` each resolve to
**either** accent (`#4F46E5` / `#4338CA` / `#EEF2FF`) **or** success (`#15803D` / `#E6F4EA`)
by role:
- button bg, link, active nav, focus, selected, spinner, generic icon → **accent**
- "posted"/"done"/stage-complete chip, checkmark, upward trend, positive metric → **success**
Files with concentrated decisions: `statusConfig.ts`, `utils/stages.ts` consumers,
`MissionControlDashboard.tsx`, `StatusChip.tsx`, `calendar/PostCard.tsx`, `MyWork.tsx`.

### Phase D — Component polish + template image download
- `calendar/PostCard.tsx` → V3 layout (§2.4).
- `ui/Button.tsx` size tiers: confirm `sm`/`md` padding & the `active:scale` feel; ensure
  `min-h-[44px]` stays on `md`.
- Remove stray `uppercase` next to labels (~169, keep 2–3 letter codes).
- Inputs / `ui/Field.tsx`, modal headers, nav rail, `TopNav.tsx` — bring to spec where the
  sweep left them awkward.
- **Template image download/copy** (folded in from the earlier Q2): on the
  `TemplateLibrary.tsx` card thumbnail add a hover action bar — "Open image"
  (`window.open`) + "Copy link" (`navigator.clipboard.writeText` + toast). Mirrors
  `AssetLibrary.tsx`'s existing "Open / Download" pattern. A true one-click file download
  isn't reliable (Drive URLs are cross-origin).

### Phase E — Verify
- `grep` for every retired hex across `src/` → expect zero (outside the excluded files).
- Full screenshot pass, desktop + 390px mobile, against real Supabase, test login
  `Hamzaansari4you@gmail.com`.
- Opus whole-branch review → **one** bundled fix wave (not an open loop).
- Manual browser check before merge. (Matches the established PZ-CMS SDD workflow.)

**Gate per phase:** `npx tsc --noEmit` clean · `npx vitest run` (73/73 baseline, `globals: false`)
· `npm run build` clean · live browser check. Commit per phase.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Green-split misjudged (accent where success belonged, or vice-versa) | Phase C is a deliberate manual pass on a short file list; Phase E screenshot review catches survivors |
| A dropped font family still used by a brand specimen | Verify each family against `brandTypography.ts` before trimming the URL; keep if referenced |
| Mechanical sweep hits a hex inside a string that isn't a colour | The retired values are all 6-digit brand palette hexes, vanishingly unlikely as non-colour literals; `tsc` + tests + build + visual check bracket it |
| Contrast regressions (e.g. `#5F5F5B` on `#F4F4F3`) | All body/secondary pairs checked ≥ 4.5:1; captions ≥ 3:1 |
| Scope creep into layout/features | Spec explicitly forbids behaviour changes; PRs limited to colour/type/shape |

---

## 5. Out of Scope

Dark mode · client brand identities & specimen fonts · any feature/layout/workflow change ·
full semantic tokenisation of arbitrary Tailwind values · `motion` / `@google/genai` dep cleanup.
