# Design System "Calm Clarity" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's all-caps-monospace / olive-green visual system with a light, high-contrast "Calm Clarity" system (Inter type scale, neutral canvas, indigo accent, unified status colours, V3 calendar card) with zero feature or layout behaviour change.

**Architecture:** Redefine the ~20 central CSS tokens and utility/component classes in `src/index.css` so ~40% of the UI shifts in one edit; then a scripted literal hex→hex sweep across `src/**/*.{ts,tsx}` for the safe neutral/danger/warn colours; then a scripted green→indigo sweep plus a short manual pass to send genuinely "success/complete" greens to the success token; then component-level polish (calendar card, buttons, inputs, template image actions); then a full verification sweep.

**Tech Stack:** React 19 + TypeScript, Vite 6, Tailwind CSS v4 (`@theme` blocks, arbitrary `bg-[#hex]` values), Vitest 4 (`globals: false`), Node scripts (`.mjs`).

**Spec:** `docs/superpowers/specs/2026-08-27-design-system-calm-clarity-design.md`

## Global Constraints

- **Light mode only.** No dark theme, no `prefers-color-scheme`.
- **Never modify:** `src/data/brands.ts`, `src/utils/brandTypography.ts`, the `.font-specimen-*` class bodies (their `font-family` names), or any client brand `primaryColor`. These are customer brand identities, not tool chrome.
- **Keep `#1b1c1a` exactly as-is** everywhere — it already matches the target ink colour; do not sweep it.
- **No behaviour, layout, copy, or feature changes.** Colour, font, radius, shadow, and spacing-token values only. Event handlers, props, DOM structure, and text content stay identical unless a step says otherwise.
- **Gate every task before its commit:** `npx tsc --noEmit` (clean) · `npx vitest run` (must stay green; baseline **73 passed**, only rises when a task adds tests) · `npm run build` (clean). Tasks that change rendered output also get the task's **Visual check** steps.
- Vitest runs with `globals: false` — every test file must `import { describe, it, expect } from 'vitest'` explicitly.
- Branch: `feat/design-system` (already created from `main` @ `4ea1568`). Commit after every task.
- Commit message trailer (every commit):
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Dev server for visual checks: `npm run dev` (port 3001). Test login: `Hamzaansari4you@gmail.com` / `@PZ2001009HA`.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/index.css` | All design tokens (`@theme`), the 5 `.font-*` utilities, base `body`/scrollbar/focus, and the shared component classes (`.btn-*`, `.brand-chip`, `.status-pill`, `.tag-pill`, `.stamp-badge`, `.nav-item-active`, `.warm-shadow*`, `.glass-panel`, `.spec-grid`) | 1, 2 |
| `index.html` | Google Fonts `<link>` — trim unused families | 3 |
| `scripts/palette-sweep.mjs` | One-shot literal string replacement of retired hex values across `src/` | 4, 5, 7 |
| `src/utils/paletteGuard.test.ts` | Regression guard: retired hex values must not reappear in `src/` | 4 |
| `src/utils/statusConfig.ts` | The single status→`{color,bgColor,label,icon}` map | 6 |
| `src/utils/statusConfig.test.ts` | Locks the status palette values | 6 |
| `src/components/ui/StatusChip.tsx` | Status chip markup (4 variants) — drop `uppercase` | 6 |
| `src/components/calendar/PostCard.tsx` | Calendar post chip — month/week branch → V3 layout | 8 |
| `src/components/ui/Button.tsx` | Button variant/size tiers — weight + case | 9 |
| `src/components/ui/Field.tsx`, `src/components/TopNav.tsx`, `src/components/SideNav.tsx` | Input / nav polish left awkward by the sweep | 10 |
| `src/utils/clipboard.ts` | Tiny `copyText()` helper | 11 |
| `src/utils/clipboard.test.ts` | Test for `copyText()` | 11 |
| `src/components/TemplateLibrary.tsx` | Template card thumbnail — "Open image" / "Copy link" hover actions | 11 |
| Manual pass — see Task 7 | `NotificationDrawer.tsx`, `GoogleAppsScriptHub.tsx`, `MissionControlDashboard.tsx`, `PostDetailModal.tsx`, `PostCard.tsx`, `MyWork.tsx` | 7 |

---

## Task 1: Foundations — `@theme` tokens + base styles

**Files:**
- Modify: `src/index.css:8-24` (the `@theme` block), `:80-99` (`body`), `:105-119` (scrollbar), `:131-142` (`.spec-grid`, `.glass-panel`), `:180-199` (`.post-card`, `.calendar-cell`), `:201-212` (`.nav-item-active`, `input:focus`)

**Interfaces:**
- Consumes: nothing
- Produces: CSS custom properties on `@theme` consumed app-wide as `var(--color-*)` and by Tailwind `bg-[var(--color-accent)]` in `src/components/ui/*`. Names other tasks rely on:
  `--color-canvas #FBFBFA` · `--color-surface`/`--color-raised` `#FFFFFF` · `--color-sunken #F4F4F3` · `--color-muted #F1F1F0` · `--color-line #E9E9E7` · `--color-line-subtle #EFEFED` · `--color-ink #1b1c1a` · `--color-ink-muted #5F5F5B` · `--color-ink-soft #57574F` · `--color-accent #4F46E5` · `--color-accent-hover #4338CA` · `--color-accent-soft #EEF2FF` · `--color-accent-on-soft #4338CA` · `--color-success #15803D` · `--color-success-soft #E6F4EA` · `--color-warn #B45309` · `--color-warn-soft #FBF0E1` · `--color-danger #DC2626` · `--color-danger-soft #FCEBEB` · `--color-neutral #52525B` · `--color-neutral-soft #F1F1F0`

- [ ] **Step 1: Replace the `@theme` block** (`src/index.css:8-24`) with:

```css
@theme {
  /* ── Surfaces ── */
  --color-canvas: #FBFBFA;
  --color-surface: #FFFFFF;
  --color-raised: #FFFFFF;          /* legacy alias → surface */
  --color-sunken: #F4F4F3;
  --color-muted: #F1F1F0;
  --color-line: #E9E9E7;
  --color-line-subtle: #EFEFED;
  /* ── Ink ── */
  --color-ink: #1b1c1a;
  --color-ink-muted: #5F5F5B;
  --color-ink-soft: #57574F;
  /* ── Accent (indigo) ── */
  --color-accent: #4F46E5;
  --color-accent-hover: #4338CA;
  --color-accent-soft: #EEF2FF;
  --color-accent-on-soft: #4338CA;
  /* ── Status ── */
  --color-success: #15803D;
  --color-success-soft: #E6F4EA;
  --color-warn: #B45309;
  --color-warn-soft: #FBF0E1;
  --color-danger: #DC2626;
  --color-danger-soft: #FCEBEB;
  --color-neutral: #52525B;
  --color-neutral-soft: #F1F1F0;
}
```

- [ ] **Step 2: Update `body`** (`src/index.css:89-99`) — change `background: #F7F6F0;` to `background: var(--color-canvas);` and leave everything else (the `font-family` line is handled in Task 2).

- [ ] **Step 3: Update scrollbar + focus + panels:**
  - `:117-119` `::-webkit-scrollbar-thumb:hover { background: #296c00; }` → `background: var(--color-accent);`
  - `:131-134` `.spec-grid` — `rgba(191, 202, 180, 0.5)` → `rgba(0, 0, 0, 0.06)`
  - `:137-142` `.glass-panel` — `border: 1px solid rgba(191, 202, 180, 0.6);` → `border: 1px solid rgba(0, 0, 0, 0.08);`
  - `:196-199` `.post-card:hover` — `box-shadow: 0 4px 12px rgba(41, 108, 0, 0.10);` → `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);`
  - `:202-205` `.nav-item-active` — replace body with:
    ```css
    .nav-item-active {
      background: var(--color-accent-soft);
      border-left: 3px solid var(--color-accent);
      color: var(--color-accent-on-soft);
    }
    ```
  - `:208-212` `input:focus, textarea:focus, select:focus` — `border-color: #296c00 !important;` → `border-color: var(--color-accent) !important;` and `box-shadow: 0 0 0 3px rgba(41, 108, 0, 0.12);` → `box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.22);`

- [ ] **Step 4: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `73 passed` · build clean

- [ ] **Step 5: Visual check**

Run `npm run dev`, open `http://localhost:3001`, log in.
Expected: page background is near-white `#FBFBFA` (not warm cream); calendar cells and cards still readable; focused inputs show an **indigo** ring, not green. Buttons still look green (Task 2 fixes those). No layout shift.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "$(printf 'feat(design): Calm Clarity color tokens + base styles\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 2: Foundations — typography utilities + shared component classes

**Files:**
- Modify: `src/index.css:26-48` (`.font-*` utilities), `:152-178` (`.brand-chip`, `.status-pill`), `:225-273` (`.btn-primary`, `.btn-danger`, `.stamp-badge`), `:342-363` (`.tag-pill`), `:144-150` (`.warm-shadow*`), `:105-119` (scrollbar), plus any other retired hex still in the file (Step 7)

**Interfaces:**
- Consumes: tokens from Task 1
- Produces: `.font-display-xl` / `.font-headline-md` — **Bricolage Grotesque** (display face); `.font-label-caps` / `.font-body-md` — Inter; `.font-code-sm` — Space Mono. No `text-transform`, no letter-spacing on labels. Consumed by every component and by `ui/Button.tsx`.

> **Font ruling (supersedes spec §2.2 "Inter only"):** the user chose "distinctive headings + Inter body". Display + headline utilities use **`'Bricolage Grotesque'`** with an `'Inter', ...sans-serif` fallback stack. Everything else (body, labels, buttons, chips) stays Inter. `font-code-sm` stays Space Mono.

- [ ] **Step 1: Replace the five font utilities** (`src/index.css:27-48`, inside `@layer utilities`) with:

```css
  .font-display-xl {
    font-family: 'Bricolage Grotesque', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .font-headline-md {
    font-family: 'Bricolage Grotesque', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .font-label-caps {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  .font-code-sm {
    font-family: 'Space Mono', ui-monospace, monospace;
    font-size: 0.72rem;
  }
  .font-body-md {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
```

Leave the `.font-specimen-*`, `.font-poppins`, `.font-montserrat`, `.font-amsterdam`, `.font-fredoka`, `.font-rajdhani` blocks (`:50-77`) **untouched**.

- [ ] **Step 2: Update `body` font-family** (`src/index.css:90`) → `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`

- [ ] **Step 3: Rewrite `.btn-primary`** (`src/index.css:226-244`) body:

```css
.btn-primary {
  background: var(--color-accent);
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: 0;
  font-size: 12px;
  text-transform: none;
  padding: 8px 16px;
  border-radius: 8px;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.22);
}
```

- [ ] **Step 4: Rewrite `.btn-danger`** (`src/index.css:247-264`) the same shape, using `background: var(--color-danger); color:#fff;` and `:hover { background:#B91C1C; box-shadow:0 4px 12px rgba(220,38,38,.22); }`. Keep `font-family:'Inter'`, `font-weight:600`, `text-transform:none`, `padding:8px 16px`, `border-radius:8px`.

- [ ] **Step 5: Update `.brand-chip` / `.status-pill` / `.tag-pill` / `.stamp-badge`:**
  - `.brand-chip` (`:153-164`) — `font-family: 'Inter', sans-serif; font-weight: 700;` keep `text-transform: uppercase` (brand short-codes are codes), `border-radius: 4px`.
  - `.status-pill` (`:167-178`) — `font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: 0; text-transform: none;` `border-radius: 999px`.
  - `.tag-pill` (`:343-358`) — `font-family: 'Inter', sans-serif; font-weight: 500; letter-spacing: 0; text-transform: none;` background `var(--color-muted)`, border `var(--color-line)`, color `var(--color-ink-muted)`; `:hover` background `var(--color-accent-soft)`, color `var(--color-accent-on-soft)`, border-color `var(--color-accent-soft)`.
  - `.stamp-badge` (`:267-273`) — `font-family: 'Inter', sans-serif;` keep the border box.

- [ ] **Step 6: Neutralise `.warm-shadow*`** (`src/index.css:145-150`):

```css
.warm-shadow {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}
.warm-shadow-lg {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 7: Sweep residual retired hex in `src/index.css`.** The Phase B script (Task 4/5) only touches `.ts`/`.tsx`, so `index.css` needs a manual pass. Run `grep -niE "#(bfcab4|707a67|404a39|faf9f5|efeeea|e5e4de|f7f6f2|f0eee6|f3f2ee|ba1a1a|935c00|ffddb0|ffdad6|296c00|205400|1f5700|aceecf|78d24b|296951|f7f6f0|f0fae8)" src/index.css`. For each hit replace with the token equivalent: sage/olive greys → `#E9E9E7` (borders) or `#5F5F5B` (text) or `#F4F4F3` (fills) by role; the scrollbar `track #f3f2ee` → `#F1F1F0`, `thumb #bfcab4` → `#D8D8D5`; greens → `var(--color-accent)` / `#15803D` by role (all scrollbar/hover greens are accent). Leave `#1b1c1a`, `rgba(0,0,0,…)`, and `.font-specimen-*` alone. Re-run the grep — expect zero.

- [ ] **Step 8: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `73 passed` · build clean

- [ ] **Step 9: Visual check**

`npm run dev` → body text and labels are **Inter, sentence case** (no monospace all-caps); page headings / section titles are **Bricolage Grotesque**; primary buttons are **indigo**, not green; timestamps / IDs that use `.font-code-sm` are still monospace; scrollbars are neutral grey. Tabs, chips, nav labels readable in mixed case.

- [ ] **Step 10: Commit**

```bash
git add src/index.css
git commit -m "$(printf 'feat(design): Inter type scale + reskin shared component classes\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 3: Adjust Google Font families (add Bricolage Grotesque, drop unused)

**Files:**
- Modify: `index.html` (the `fonts.googleapis.com/css2?family=...` `<link>`)
- Read only: `src/utils/brandTypography.ts`, `src/data/brands.ts`, `src/index.css`

**Interfaces:**
- Consumes: nothing
- Produces: nothing importable

- [ ] **Step 1: Determine which families are still referenced.**

Run:
```bash
grep -oE "font-(poppins|montserrat|amsterdam|fredoka|rajdhani)" -r src | sort -u
grep -E "fonts:" -A5 src/data/brands.ts
```
Brand specimen fonts in `brands.ts` currently in use: **Nunito Sans, Montserrat, New Amsterdam, Space Grotesk, Space Mono, Poppins**. These MUST stay in the URL. **Inter** (UI) and **Material Symbols Outlined** stay.

- [ ] **Step 2: For each of `Fredoka+One`, `Rajdhani`, `Plus+Jakarta+Sans`** — if `grep` in Step 1 shows zero `.font-fredoka` / `.font-rajdhani` usages in `src/`, and `Plus Jakarta Sans` appears only as a `.font-specimen-*` *fallback* in `src/index.css:50-61`, they can be dropped. If `Plus Jakarta Sans` is still a fallback there, either keep it in the URL **or** change those fallbacks to `'Inter'` first (preferred — do it in this step, `src/index.css:52,56,60`).

- [ ] **Step 3: Rewrite the first `<link href="https://fonts.googleapis.com/css2?...">`** in `index.html` to request only these families (plus `&display=swap`), leaving the second `<link>` (Material Symbols) unchanged:
  - `Inter:wght@400;500;600;700` — UI body / labels
  - `Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700` — **new**, UI display + headings
  - `Space+Mono:ital,wght@0,400;0,700;1,400` — data
  - `Space+Grotesk:wght@400;500;600;700` — brand specimen (PillZ, PrescriptionZ)
  - `Montserrat:ital,wght@0,300..900;1,300..900` — brand specimen (PZ Academy)
  - `New+Amsterdam` — brand specimen (MED-Q)
  - `Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000` — brand specimen (Pharmacozyme, PillZ/RxZ body)
  - `Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400` — brand specimen (Pharmacozyme/PZ Academy/MED-Q body)

- [ ] **Step 4: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `73 passed` · build clean

- [ ] **Step 5: Visual check**

`npm run dev` → UI headings render in **Bricolage Grotesque** (a slightly condensed, characterful grotesque — not Inter); body/labels in Inter; nothing falls back to serif. Open **Brand Kit / Brand Control Center**, cycle all 5 brands, confirm each specimen preview still renders its brand font (Montserrat, New Amsterdam, etc.).

- [ ] **Step 6: Commit**

```bash
git add index.html src/index.css
git commit -m "$(printf 'chore(design): add Bricolage Grotesque, drop unused webfont families\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 4: Palette-sweep script + regression guard test

**Files:**
- Create: `scripts/palette-sweep.mjs`
- Create: `src/utils/paletteGuard.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `scripts/palette-sweep.mjs` — a Node script run as `node scripts/palette-sweep.mjs`; it reads `MAPPINGS` (an array of `[from, to]` lowercase hex pairs) and rewrites every `.ts`/`.tsx` file under `src/` except the excluded set. Tasks 5 and 7 run it after extending `MAPPINGS`.

- [ ] **Step 1: Write `scripts/palette-sweep.mjs`**

```js
// One-shot literal hex replacement across src/. Case-insensitive match,
// lowercase output. Excludes files whose colours are semantic (status map),
// customer-owned (brands), or tooling.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

const EXCLUDE = [
  'utils/statusConfig.ts',
  'data/brands.ts',
  'utils/brandTypography.ts',
];
const isExcluded = (rel) =>
  EXCLUDE.some((e) => rel.endsWith(e)) || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');

// Phase B — neutral / warn / danger. (Phase C appends greens in Task 7.)
export const MAPPINGS = [
  ['#bfcab4', '#e9e9e7'],
  ['#707a67', '#5f5f5b'],
  ['#404a39', '#57574f'],
  ['#faf9f5', '#f4f4f3'],
  ['#efeeea', '#f1f1f0'],
  ['#e5e4de', '#efefed'],
  ['#f7f6f2', '#f4f4f3'],
  ['#f0eee6', '#efefed'],
  ['#ba1a1a', '#dc2626'],
  ['#ffdad6', '#fcebeb'],
  ['#935c00', '#b45309'],
  ['#ffddb0', '#fbf0e1'],
  ['#f7f6f0', '#fbfbfa'],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(SRC)) {
  const rel = file.slice(SRC.length).replace(/\\/g, '/');
  if (isExcluded(rel)) continue;
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of MAPPINGS) {
    text = text.replace(new RegExp(from, 'gi'), to); // hex has no regex metachars
  }
  if (text !== before) { writeFileSync(file, text); changed++; }
}
console.log(`palette-sweep: rewrote ${changed} files`);
```

- [ ] **Step 2: Write the failing guard test** `src/utils/paletteGuard.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url)); // src/

// Retired colours that must not appear in application source after the sweep.
// statusConfig.ts (semantic), brands.ts + brandTypography.ts (customer), and
// *.test.* (this file) are exempt.
const RETIRED = [
  '#bfcab4', '#707a67', '#404a39', '#faf9f5', '#efeeea', '#e5e4de',
  '#f7f6f2', '#f0eee6', '#ba1a1a', '#ffdad6', '#935c00', '#ffddb0', '#f7f6f0',
];
const EXEMPT = ['utils/statusConfig.ts', 'data/brands.ts', 'utils/brandTypography.ts'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  });
}

describe('palette guard', () => {
  it('no retired hex values remain in src/', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length).replace(/\\/g, '/');
      if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
      if (EXEMPT.some((e) => rel.endsWith(e))) continue;
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const hex of RETIRED) if (text.includes(hex)) offenders.push(`${rel} :: ${hex}`);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the guard test to verify it fails**

Run: `npx vitest run src/utils/paletteGuard.test.ts`
Expected: FAIL — `offenders` lists many `component :: #bfcab4` etc. entries.

- [ ] **Step 4: Commit the script + failing test**

```bash
git add scripts/palette-sweep.mjs src/utils/paletteGuard.test.ts
git commit -m "$(printf 'test(design): palette sweep script + retired-hex guard (red)\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 5: Run the Phase B mechanical sweep

**Files:**
- Modify: most of `src/**/*.{ts,tsx}` (mechanical, via script)

**Interfaces:**
- Consumes: `scripts/palette-sweep.mjs` `MAPPINGS` (Phase B set) from Task 4
- Produces: nothing importable

- [ ] **Step 1: Run the sweep**

Run: `node scripts/palette-sweep.mjs`
Expected: `palette-sweep: rewrote NN files` (NN ≈ 35).

- [ ] **Step 2: Run the guard test**

Run: `npx vitest run src/utils/paletteGuard.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `74 passed` (73 baseline + guard) · build clean

- [ ] **Step 4: Eyeball the diff**

Run: `git diff --stat`
Expected: only `bg-[#...]` / `text-[#...]` / `border-[#...]` / `ring-[#...]` string literals changed; no logic, no JSX structure. Spot-check 3 files with `git diff src/components/MyWork.tsx` etc.

- [ ] **Step 5: Visual check**

`npm run dev` → borders are now neutral grey (not sage-green); secondary text is neutral grey (not olive); danger/delete UI is a cleaner red; warn/in-progress is amber. Greens (buttons that weren't caught, "posted" chip) still present — Tasks 6–7 handle them.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "$(printf 'refactor(design): mechanical palette sweep — neutral/danger/warn\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 6: Status colour system — `statusConfig.ts` + `StatusChip`

**Files:**
- Create: `src/utils/statusConfig.test.ts`
- Modify: `src/utils/statusConfig.ts:5-11` (the `STATUS_CONFIG` map)
- Modify: `src/components/ui/StatusChip.tsx` (remove `uppercase` from the three `pill*` variants)

**Interfaces:**
- Consumes: tokens (Task 1)
- Produces: `STATUS_CONFIG` with new hex values (below); shape unchanged — `Record<PostStatus | 'overdue', { color: string; bgColor: string; label: string; icon?: string }>`.

- [ ] **Step 1: Write the failing test** `src/utils/statusConfig.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { STATUS_CONFIG } from './statusConfig';

describe('STATUS_CONFIG palette', () => {
  it('uses the Calm Clarity status tokens', () => {
    expect(STATUS_CONFIG['not-started']).toMatchObject({ color: '#52525B', bgColor: '#F1F1F0' });
    expect(STATUS_CONFIG['in-progress']).toMatchObject({ color: '#B45309', bgColor: '#FBF0E1' });
    expect(STATUS_CONFIG['ready-to-post']).toMatchObject({ color: '#4F46E5', bgColor: '#EEF2FF' });
    expect(STATUS_CONFIG['posted']).toMatchObject({ color: '#15803D', bgColor: '#E6F4EA', icon: 'check_circle' });
    expect(STATUS_CONFIG['overdue']).toMatchObject({ color: '#DC2626', bgColor: '#FCEBEB', icon: 'error' });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/utils/statusConfig.test.ts`
Expected: FAIL (old hex values like `#707a67`, `#296c00`).

- [ ] **Step 3: Replace `STATUS_CONFIG`** (`src/utils/statusConfig.ts:5-11`):

```ts
export const STATUS_CONFIG: Record<PostStatus | 'overdue', { color: string, bgColor: string, label: string, icon?: string }> = {
  'not-started': { color: '#52525B', bgColor: '#F1F1F0', label: 'Not Started' },
  'in-progress': { color: '#B45309', bgColor: '#FBF0E1', label: 'In Progress' },
  'ready-to-post': { color: '#4F46E5', bgColor: '#EEF2FF', label: 'Ready to Post' },
  'posted': { color: '#15803D', bgColor: '#E6F4EA', label: 'Posted', icon: 'check_circle' },
  'overdue': { color: '#DC2626', bgColor: '#FCEBEB', label: 'Overdue', icon: 'error' },
};
```

- [ ] **Step 4: Remove `uppercase` from `StatusChip`** — in `src/components/ui/StatusChip.tsx`, in the `pill`, `pill-dot`, and `pill-icon` `className` strings, delete the ` uppercase` token (keep `font-label-caps font-bold`). The `dot` variant's `text-[#5f5f5b]` (already swept) stays.

- [ ] **Step 5: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` · build clean

- [ ] **Step 6: Visual check**

`npm run dev` → calendar + list + My Work status chips: "Posted" is green, "Overdue" red, "In Progress" amber, "Not Started" grey, "Ready to Post" indigo — same palette in every view, mixed-case text.

- [ ] **Step 7: Commit**

```bash
git add src/utils/statusConfig.ts src/utils/statusConfig.test.ts src/components/ui/StatusChip.tsx
git commit -m "$(printf 'feat(design): unified Calm Clarity status colour system\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 7: Green split — scripted accent sweep + manual success pass

**Files:**
- Modify: `scripts/palette-sweep.mjs` (`MAPPINGS`)
- Modify (script): most `src/**/*.{ts,tsx}` with green literals
- Modify (manual): `src/components/NotificationDrawer.tsx`, `src/components/GoogleAppsScriptHub.tsx`, `src/components/MissionControlDashboard.tsx`, `src/components/PostDetailModal.tsx`, `src/components/calendar/PostCard.tsx`, `src/components/MyWork.tsx`
- Modify: `src/utils/paletteGuard.test.ts` (`RETIRED` — append greens)

**Interfaces:**
- Consumes: `palette-sweep.mjs` from Task 4
- Produces: nothing importable

- [ ] **Step 1: Append the green mappings** to `MAPPINGS` in `scripts/palette-sweep.mjs`:

```js
  ['#296c00', '#4f46e5'],
  ['#205400', '#4338ca'],
  ['#1f5700', '#4338ca'],
  ['#296951', '#4338ca'],
  ['#aceecf', '#eef2ff'],
  ['#f0fae8', '#eef2ff'],
  ['#78d24b', '#15803d'],
```

- [ ] **Step 2: Run the sweep**

Run: `node scripts/palette-sweep.mjs`
Expected: `palette-sweep: rewrote NN files` (greens → indigo everywhere except the excluded set).

- [ ] **Step 3: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` · build clean

- [ ] **Step 4: Manual success pass.** Everything green is now indigo. Send back to success-green (`#15803D`, soft `#E6F4EA`) only where the colour means **"complete / posted / succeeded / trending up"** — NOT controls, links, selection, or focus. Apply these specific edits:

  - **`src/components/NotificationDrawer.tsx`** — the `stage_complete` line: `<span className="material-symbols-outlined text-[#4f46e5] text-[14px]">check_circle</span>` → `text-[#15803d]`.
  - **`src/components/calendar/PostCard.tsx`** — the `mobile-list` stage-toggle buttons: the `post.stageCompletion?.*Done` active class `'bg-[#4f46e5] text-white font-bold'` (3 occurrences, design/publish/engagement) → `'bg-[#15803d] text-white font-bold'`. These mark a stage *done*.
  - **`src/components/GoogleAppsScriptHub.tsx`** — around the success-confirmation block near `check_circle` (line ~433): if the icon/badge colour is now `#4f46e5` and it confirms a successful connection/test, → `#15803d`. Leave the `copied ? 'check_circle' : 'content_copy'` copy-feedback icons as accent.
  - **`src/components/MissionControlDashboard.tsx`** — grep `deriveStatus(p) === 'posted'`; wherever a stat card, progress bar fill, or number that represents *posted count* or *completion %* is coloured `#4f46e5`, → `#15803d`. Leave neutral KPI cards and headings accent/ink.
  - **`src/components/PostDetailModal.tsx`** — grep `Done` / `stageCompletion` / `check`; stage-complete check icons or "done" pills coloured `#4f46e5` → `#15803d`. Leave the Save button and section headers accent.
  - **`src/components/MyWork.tsx`** — any "done"/completed row treatment coloured `#4f46e5` that denotes a finished item → `#15803d`.

  For each file: `npm run dev` and confirm the changed element reads as "success", and that you did **not** recolour a button/link.

- [ ] **Step 5: Append greens to the guard** — in `src/utils/paletteGuard.test.ts` add to `RETIRED`: `'#296c00', '#205400', '#1f5700', '#296951', '#aceecf', '#f0fae8', '#78d24b'`. (`#15803d`, `#4f46e5` are allowed.)

- [ ] **Step 6: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` (guard still green — the manual edits used allowed hexes) · build clean

- [ ] **Step 7: Full visual sweep**

`npm run dev` → walk every tab: no forest-green anywhere; primary actions/links/selection/focus are indigo; "done / posted / trending up" indicators are green; nothing that was a green button is now green.

- [ ] **Step 8: Commit**

```bash
git add -A src/ scripts/palette-sweep.mjs
git commit -m "$(printf 'refactor(design): split green into indigo accent + success green\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 8: Calendar post chip → V3 layout

**Files:**
- Modify: `src/components/calendar/PostCard.tsx` — the **month / week default branch only** (`return (` at line ~253 through line ~365). Do NOT touch the `isPlaceholder` branch or the `mobile-list` branch.

**Interfaces:**
- Consumes: `getPostStatusConfig` (already imported), `StatusChip`, `BRANDS`, tokens
- Produces: unchanged component API (same props)

- [ ] **Step 1: Restyle the month/week card.** Target structure (V3): a full-border card (no left accent bar), `bg-white border border-[#e9e9e7] rounded-lg shadow-2xs`, selected state `ring-2 ring-[#4f46e5] border-[#4f46e5] bg-[#eef2ff]`. Three rows:

  1. **Header row** — brand short-code chip (`style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}`, white text, `text-[8px] font-bold rounded px-1`) on the left; `<StatusChip post={post} variant="pill" />` pushed right with `ml-auto`. Keep the select-mode checkbox before the brand chip when `isSelectMode || isSelected`.
  2. **Title** — `<p className="font-medium text-[11px] text-[#1b1c1a] line-clamp-2 leading-snug mt-0.5">{post.title}</p>` (allow 2 lines, per the mock).
  3. **Footer row** — `mt-1 pt-0.5 border-t border-[#efefed] flex items-center gap-1 text-[8px] text-[#5f5f5b]`: platform icon + `{post.scheduledTime || '10:00'}` on the left; the 🎨/🚀/💬 quick-stage toggle buttons + assignee-initials badge (`ml-auto`) on the right — **carry these over verbatim** from the current footer (lines ~320-363), including `handleQuickStageToggle`, `assigneeTriggerRef`, and the `<AssigneePopover>` after the card.

  Keep `draggable`, `onDragStart`, `onTouchStart/Move/End`, `onClick` (select vs open) exactly as they are. Keep the outer `<> ... </>` wrapper and the trailing `<AssigneePopover>`.

- [ ] **Step 2: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` · build clean

- [ ] **Step 3: Visual check — desktop**

`npm run dev` → Month view: cards show brand chip + status pill on top, up to 2 title lines, platform/time + stage toggles + assignee below. "+N more" still appears when a day overflows. Drag a card to another day — still works. Ctrl/Cmd-click still multi-selects. Click opens the post.

- [ ] **Step 4: Visual check — mobile 390px**

DevTools device toolbar → 390px. Week view + mobile date strip: cards legible, tap targets ≥ the existing sizes, long-press still opens quick actions.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/PostCard.tsx
git commit -m "$(printf 'feat(design): V3 calendar post card layout\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 9: Button tiers + stray `uppercase` cleanup

**Files:**
- Modify: `src/components/ui/Button.tsx:36` (className string)
- Modify: assorted `src/components/**/*.tsx` — remove ` uppercase` where it sits on label/button text

**Interfaces:**
- Consumes: `.font-label-caps` (Task 2)
- Produces: unchanged `Button` API

- [ ] **Step 1: Button weight** — in `src/components/ui/Button.tsx:36`, change `font-label-caps font-bold` → `font-label-caps font-semibold`. Leave `VARIANT_CLASS` (already token-based) and `SIZE_CLASS` (keep `min-h-[36px]` / `min-h-[44px]`).

- [ ] **Step 2: Inventory stray `uppercase`**

Run: `grep -rn "uppercase" src --include=*.tsx | grep -v "text-transform"`
Expected: ~160 hits.

- [ ] **Step 3: Remove ` uppercase`** from `className` strings **except** where the text is a 2–4 letter code or acronym (brand short-codes like `{brand.shortCode}`, `P_ZYME`; single-letter day headers). Work file-by-file; for each file after editing, `npx tsc --noEmit` and glance at `git diff`. This is the bulk of the task — expect ~25 files. Keep `font-label-caps` / `font-bold` / sizing tokens; only the word `uppercase` is deleted (and a now-doubled space collapsed).

- [ ] **Step 4: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` · build clean

- [ ] **Step 5: Visual check**

`npm run dev` → section labels, tab labels, table headers, chip text, button text are all **sentence / title case**. Brand short-codes (`P_ZYME`) and weekday initials stay uppercase. Nothing SHOUTS.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "$(printf 'feat(design): button weight tier + remove all-caps label styling\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 10: Input / nav / modal polish

**Files:**
- Modify: `src/components/ui/Field.tsx`, `src/components/ui/Modal.tsx`, `src/components/TopNav.tsx`, `src/components/SideNav.tsx` (and any modal header the sweep left mismatched)

**Interfaces:**
- Consumes: tokens (Task 1), `.font-*` (Task 2)
- Produces: unchanged component APIs

- [ ] **Step 1: `ui/Field.tsx`** — inputs/selects/textarea: background `bg-white`, border `border-[#e9e9e7]` (hover `border-[#d8d8d5]`), radius `rounded-lg` (8px), label `font-label-caps text-[12px] text-[#5f5f5b]` (not uppercase). The global `input:focus` ring (Task 1) already gives the indigo focus — don't re-add per-field focus colours.

- [ ] **Step 2: `ui/Modal.tsx`** — panel `bg-white border border-[#e9e9e7] rounded-xl` + `.warm-shadow-lg`; header title `font-headline-md text-[15px]`; backdrop `bg-black/40 backdrop-blur-sm`. Keep all dirty-prompt / close / focus-trap behaviour.

- [ ] **Step 3: `TopNav.tsx` / `SideNav.tsx`** — nav item text `font-label-caps text-[13px]` mixed case; active item uses `.nav-item-active` (Task 1); icon + label colour `text-[#5f5f5b]`, active `text-[#4338ca]`. Brand switcher chips keep `brand.primaryColor`.

- [ ] **Step 4: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `75 passed` · build clean

- [ ] **Step 5: Visual check (desktop + 390px)**

`npm run dev` → open New Post modal + Post Detail modal: clean white panel, neutral borders, indigo focus rings, mixed-case labels. Side nav (desktop) + bottom tab bar (mobile): active tab indigo-tinted, labels mixed case, 44px targets intact.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "$(printf 'feat(design): input, modal, and nav polish\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 11: Template image — "Open image" / "Copy link"

**Files:**
- Create: `src/utils/clipboard.ts`, `src/utils/clipboard.test.ts`
- Modify: `src/components/TemplateLibrary.tsx` (the thumbnail block, lines ~364-402)

**Interfaces:**
- Consumes: nothing
- Produces: `copyText(text: string): Promise<boolean>` — resolves `true` on success, `false` if the clipboard API is unavailable or throws.

- [ ] **Step 1: Write the failing test** `src/utils/clipboard.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  it('writes to navigator.clipboard and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('https://example.com/x.png')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/x.png');
    vi.unstubAllGlobals();
  });

  it('returns false when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './clipboard'`)

Run: `npx vitest run src/utils/clipboard.test.ts`

- [ ] **Step 3: Write `src/utils/clipboard.ts`**

```ts
/** Copy text to the clipboard. Resolves true on success, false otherwise. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/utils/clipboard.test.ts`

- [ ] **Step 5: Add the hover action bar** in `src/components/TemplateLibrary.tsx`. In the thumbnail `<div className="h-44 ...">`, when `template.imagePreview` is truthy, render an absolutely-positioned bar (`absolute bottom-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity`) with two buttons:
  - **Open image** — `onClick={(e) => { e.stopPropagation(); window.open(template.imagePreview, '_blank', 'noopener'); }}`, icon `open_in_new`.
  - **Copy link** — `onClick={async (e) => { e.stopPropagation(); await copyText(template.imagePreview!); }}`, icon `link`.

  Style both `bg-white/95 border border-[#e9e9e7] text-[#1b1c1a] text-[10px] font-label-caps rounded px-2 py-1 flex items-center gap-1 shadow-xs hover:bg-white`. Import `copyText` from `../utils/clipboard`. (No toast dependency here — `TemplateLibrary` doesn't receive `showToast`; the copy is fire-and-forget, matching `AssetLibrary`'s pattern.)

- [ ] **Step 6: Run the gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `77 passed` · build clean

- [ ] **Step 7: Visual check**

`npm run dev` → Template Library: hover a template card that has an image → the two buttons fade in over the thumbnail. "Open image" opens the Drive URL in a new tab. "Copy link" puts the URL on the clipboard (paste into the address bar to confirm). Cards without an image show no bar. Hover state doesn't trigger the card's "Use Blueprint" click.

- [ ] **Step 8: Commit**

```bash
git add src/utils/clipboard.ts src/utils/clipboard.test.ts src/components/TemplateLibrary.tsx
git commit -m "$(printf 'feat: open / copy-link actions for template images\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 12: Verification sweep

**Files:** none modified unless a defect is found (then a follow-up fix commit).

- [ ] **Step 1: Retired-hex grep**

Run: `npx vitest run src/utils/paletteGuard.test.ts` and
`grep -rniE "#(296c00|205400|1f5700|bfcab4|707a67|404a39|faf9f5|efeeea|e5e4de|ba1a1a|935c00|aceecf|78d24b|296951|f0fae8|f7f6f0|f3f2ee|f0eee6)" src --include=*.tsx --include=*.ts --include=*.css | grep -v ".test."`
Expected: guard PASS; grep returns **zero** lines (statusConfig.ts already uses new values; index.css swept in Task 2 Step 7). Any hit outside `brands.ts` / `brandTypography.ts` is a defect — fix it and re-commit.

- [ ] **Step 2: Full gate on the branch tip**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean · `77 passed` · build clean · main bundle still ~694 kB + lazy chunks.

- [ ] **Step 3: Screenshot pass — desktop (1440px)**

`npm run dev`, log in, visit every tab: My Work, Calendar (month/week/list), Templates, Brand Kit, Assets, Dashboard, Integrations, Content Bank, Research, Activity Log. Open New Post + Post Detail modals, the command palette (`/`), quick-add (`a`), notification drawer. Confirm: no green chrome, indigo accent, Inter mixed-case throughout, neutral borders, success-green only on done/posted, no contrast failures (grey-on-grey text still legible).

- [ ] **Step 4: Screenshot pass — mobile 390px**

Device toolbar at 390px: bottom tab bar, mobile calendar date strip, mobile post cards, bottom-sheet modals, filter sheet. Tap targets ≥ 44px, no horizontal scroll, sheets slide correctly.

- [ ] **Step 5: Update the visual-companion note + stop the server**

```bash
bash "C:/Users/hamza/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/brainstorming/scripts/stop-server.sh" "d:/Claude Code Workspace/PZ-CMS/pharmacozyme-brand-ops-studio/.superpowers/brainstorm/14998-1787840935"
```

- [ ] **Step 6: Hand off for review**

Report branch state and request the **opus whole-branch review** → apply findings as **one** bundled fix-wave commit (not an open loop), then the finishing-a-development-branch flow. Do not merge autonomously.

---

## Self-Review

**Spec coverage:**
- §2.1 colour tokens → Tasks 1, 6 ✓
- §2.2 typography (Inter, no caps/mono, font URL trim) → Tasks 2, 3, 9 ✓
- §2.3 shape/depth/focus (radius, shadows, focus ring, component classes) → Tasks 1, 2, 10 ✓
- §2.4 V3 calendar card → Task 8 ✓
- §2.5 status language → Task 6 ✓
- §3 Phase A → Tasks 1–3; Phase B → Tasks 4–5; Phase C → Tasks 6–7; Phase D → Tasks 8–11; Phase E → Task 12 ✓
- §3 template image download (folded into D) → Task 11 ✓
- §4 risks (font-family verification, mechanical-sweep containment, contrast, scope) → Task 3 Step 1–2, Task 5 Step 4, Task 12 Step 3, Global Constraints ✓
- §5 out-of-scope (dark mode, brand identities, full tokenisation, dep cleanup) → Global Constraints + not present in any task ✓

**Placeholder scan:** No "TBD/TODO". Task 7 Step 4 and Task 9 Step 3 are judgment passes but each gives explicit criteria, grep commands, and the exact hex edits / exception list — not "handle appropriately".

**Type consistency:** `copyText(text: string): Promise<boolean>` defined in Task 11 Step 3, used in Task 11 Step 5. `STATUS_CONFIG` shape unchanged (Task 6). `palette-sweep.mjs` `MAPPINGS` export defined Task 4, extended Task 7. `PostCard` props untouched (Task 8). Guard test `RETIRED` array extended in Task 7 Step 5 consistently with the Task 7 Step 1 mappings.

**Known soft spots for the executor:** Task 5/7 file counts ("≈35", "NN") are estimates — the guard test is the real pass/fail. Task 9 Step 3 is the largest manual surface; if it balloons, it can be split per-directory across commits without breaking the gate.
