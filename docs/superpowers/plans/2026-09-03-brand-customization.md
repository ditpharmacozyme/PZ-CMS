# Brand & Template Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five brand kits, per-brand template categories, and asset/logo file uploads editable in-app, backed by Supabase.

**Architecture:** Add a `brands` and a `template_categories` Supabase table plus a `brand-assets` Storage bucket, each following the existing `use*` hook → `getStored*` (localStorage) + `fetchRemote*` + `subscribeRemote*` pattern with `*ToRow`/`rowTo*` mappers in `src/utils/storage.ts`. `BRANDS` (static const, 23 importers) becomes a React context value via `BrandsProvider` + `useBrands()`. `PostTemplate['category']` widens from a union to `string`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (`globals: false`, jsdom), `@testing-library/react`, `@supabase/supabase-js` v2, Tailwind (utility classes, Calm Clarity palette).

**Spec:** `docs/superpowers/specs/2026-09-03-brand-customization-design.md`

## Global Constraints

- **Gate every task:** `npx tsc --noEmit` && `npx vitest run` && `npm run build` — all green before commit.
- **Vitest:** `globals: false` — every test file imports `{ describe, it, expect, vi }` from `vitest` explicitly.
- **Commit trailer** on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Palette (Calm Clarity):** accent `#4f46e5`, accent-dark `#4338ca`, accent-soft `#eef2ff`, ink `#1b1c1a`, canvas `#fbfbfa`, surface `#f4f4f3`, border `#e9e9e7`, muted text `#5f5f5b`, danger `#dc2626`, danger-soft `#fcebeb`, success `#15803d` (light backgrounds only). Follow existing class idiom in the file you touch.
- **Supabase remote fns fail soft:** every `fetchRemote*`/`upsertRemote*` returns early when `!supabase` and `console.error`s (never throws) on error — copy the existing `fetchRemoteTemplates` shape verbatim.
- **RLS on new tables:** `authenticated` role, read AND write (`using (true) with check (true)`).
- **`BrandId`** stays the fixed union `'pharmacozyme' | 'pz-academy' | 'med-q' | 'pillz' | 'prescriptionz'`. No task adds or removes a brand.
- **Migrations are not run locally** (no local Supabase stack). Tasks are unit-testable without the DB; the app degrades to `SEED_BRANDS` / seeded categories until the user applies the migrations. The final task lists the browser-pass checks that require them.

---

### Task 1: Database migrations

**Files:**
- Create: `supabase/migrations/0019_brands.sql`
- Create: `supabase/migrations/0020_template_categories.sql`
- Create: `supabase/migrations/0021_brand_assets.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `brands`, `template_categories`; column `assets.storage_path`; Storage bucket `brand-assets`. Column names are the source of truth for the `*ToRow` mappers in later tasks.

- [ ] **Step 1: Write `0019_brands.sql`**

```sql
-- Editable brand records. Seeded from src/data/brands.ts (SEED_BRANDS).
create table if not exists brands (
  id              text primary key,
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
  voice_rules     jsonb not null default '[]'::jsonb,
  fonts           jsonb not null default '{}'::jsonb,
  prompt_config   jsonb,
  sort_order      int  not null default 0,
  updated_at      timestamptz not null default now()
);

alter table brands enable row level security;
create policy "brands authenticated read"  on brands for select to authenticated using (true);
create policy "brands authenticated write" on brands for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brands'
  ) then
    alter publication supabase_realtime add table brands;
  end if;
end $$;

insert into brands (id, name, short_code, tagline, description, primary_color, secondary_color, accent_color, surface_color, icon, logo_url, voice_rules, fonts, sort_order) values
('pharmacozyme','Pharmacozyme','P_ZYME','Precision Enzymatic Therapeutics','Advanced enzyme-based therapeutics and pharmaceutical solutions for metabolic health.','#78D24B','#00694B','#96B44B','#F5FAF2','science','/logos/PZ_Logo.png',
  '["Clinical, precise, and authoritative with a humanist touch.","Use data-driven statements and verified clinical terminology.","Avoid generic marketing buzzwords or unsubstantiated claims."]'::jsonb,
  '{"display":"Nunito Sans 800","headline":"Nunito Sans 700","code":"Space Mono 400","body":"Poppins 400"}'::jsonb, 0),
('pz-academy','PZ Academy','PZ_ACAD','Molecular & Bio-Tech Education','Educational platform for molecular biology, bio-tech integration, and clinical research deep-dives.','#7ED957','#0F3D22','#C9960A','#F7FAF5','school','/logos/PZ-Academy-logo.png',
  '["Educational, engaging, and structured for research clarity.","Explain complex molecular mechanisms in scannable, modular sections.","Maintain academic rigor while staying accessible to clinicians."]'::jsonb,
  '{"display":"Montserrat 800","headline":"Montserrat 700","code":"Space Mono 400","body":"Poppins 400"}'::jsonb, 1),
('med-q','MED-Q','MED_Q','Diagnostic & Oncology Units','Weekly diagnostic challenges, oncology protocol alerts, and high-precision clinical deployment.','#5E17EB','#1E0754','#FF66C4','#F8F5FF','medication','/logos/MED-Q Logo.png',
  '["Diagnostic, direct, and action-oriented for unit teams.","Highlight urgent protocol updates with bold stamp badges.","Clear, unambiguous instructions for dosage & compliance."]'::jsonb,
  '{"display":"New Amsterdam","headline":"New Amsterdam","code":"Space Mono 400","body":"Poppins 400"}'::jsonb, 2),
('pillz','PillZ','PILLZ','High-Density Packaging & Flux','Modern patient medication tracking, batch release validation, and dosage layout solutions.','#07513B','#93D4B7','#2E6E56','#FAF9F5','package_2','/logos/PillZ.png',
  '["Patient-centric, vivid, and reassuringly clear.","Focus on compliance tracking and batch accuracy numbers.","Use clean tabular layouts and visual progress indicators."]'::jsonb,
  '{"display":"Space Grotesk 700","headline":"Space Grotesk 600","code":"Space Mono 400","body":"Nunito Sans 400"}'::jsonb, 3),
('prescriptionz','PrescriptionZ','RX_Z','V3.4 Engine & Operational Sync','Core engine synchronization, prescription logistics, and global node health tracking.','#30312E','#707A67','#1B1C1A','#FAF9F5','receipt_long','/logos/PrescriptionZ Logo.png',
  '["Technical, system-level, and operational.","Include node status, version codes (v3.4), and latency telemetry.","Emphasis on 99.98% operational integrity and security."]'::jsonb,
  '{"display":"Space Grotesk 700","headline":"Space Grotesk 600","code":"Space Mono 400","body":"Nunito Sans 400"}'::jsonb, 4)
on conflict (id) do nothing;
```

> **Note for the implementer:** these values were transcribed from `src/data/brands.ts` on this branch. Re-check them against the file before applying — if any field drifted, the file wins, and `rowToBrand`'s null-fallback (Task 3) covers a missing column but not a wrong value.

- [ ] **Step 2: Write `0020_template_categories.sql`**

```sql
create table if not exists template_categories (
  id         uuid primary key default gen_random_uuid(),
  brand_id   text not null,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, lower(name))
);

alter table template_categories enable row level security;
create policy "tcat authenticated read"  on template_categories for select to authenticated using (true);
create policy "tcat authenticated write" on template_categories for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'template_categories'
  ) then
    alter publication supabase_realtime add table template_categories;
  end if;
end $$;

insert into template_categories (brand_id, name, sort_order)
select scope, cat.name, cat.ord
from (values ('shared'),('pharmacozyme'),('pz-academy'),('med-q'),('pillz'),('prescriptionz')) as s(scope)
cross join (values ('Clinical',0),('Interactive',1),('Editorial',2),('Patient-Facing',3),('Internal',4)) as cat(name, ord)
on conflict (brand_id, lower(name)) do nothing;
```

- [ ] **Step 3: Write `0021_brand_assets.sql`**

```sql
alter table assets add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-assets', 'brand-assets', true, 52428800)
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

- [ ] **Step 4: Verify the gate is unaffected**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green (no application code changed).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_brands.sql supabase/migrations/0020_template_categories.sql supabase/migrations/0021_brand_assets.sql
git commit -m "feat(db): brands, template_categories tables + brand-assets bucket

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `uploadAsset` — Supabase Storage upload helper

**Files:**
- Create: `src/utils/uploadAsset.ts`
- Create: `src/utils/uploadAsset.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts` (may be `null`).
- Produces:
  ```ts
  export const ASSET_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
  export class AssetUploadError extends Error {}
  export function humanFileSize(bytes: number): string;   // e.g. 2621440 -> "2.5 MB"
  export function uploadAsset(file: File, folder: 'assets' | 'logos'): Promise<{
    url: string;          // public URL
    storagePath: string;  // '<folder>/<uuid>-<safe-name>'
    size: string;         // humanFileSize(file.size)
    contentType: string;  // file.type
  }>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/uploadAsset.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'x' }, error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/x' } });
  return { supabase: { storage: { from: () => ({ upload, getPublicUrl }) } } };
});

import { uploadAsset, humanFileSize, AssetUploadError, ASSET_UPLOAD_MAX_BYTES } from './uploadAsset';

function fakeFile(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('humanFileSize', () => {
  it('formats bytes as MB with one decimal', () => {
    expect(humanFileSize(2_621_440)).toBe('2.5 MB');
  });
  it('uses KB below a megabyte', () => {
    expect(humanFileSize(4096)).toBe('4.0 KB');
  });
});

describe('uploadAsset', () => {
  it('rejects an unsupported type', async () => {
    await expect(uploadAsset(fakeFile('a.exe', 'application/x-msdownload', 10), 'assets'))
      .rejects.toBeInstanceOf(AssetUploadError);
  });

  it('rejects a file over the size cap', async () => {
    await expect(uploadAsset(fakeFile('big.pdf', 'application/pdf', ASSET_UPLOAD_MAX_BYTES + 1), 'assets'))
      .rejects.toBeInstanceOf(AssetUploadError);
  });

  it('returns url, storagePath, size and contentType on success', async () => {
    const res = await uploadAsset(fakeFile('Logo Final.png', 'image/png', 1024), 'logos');
    expect(res.url).toBe('https://cdn/x');
    expect(res.storagePath).toMatch(/^logos\/[0-9a-f-]+-logo-final\.png$/);
    expect(res.size).toBe('1.0 KB');
    expect(res.contentType).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/uploadAsset.test.ts`
Expected: FAIL — `uploadAsset` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/uploadAsset.ts
import { supabase } from '../lib/supabase';

export const ASSET_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_TYPES = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^application\/vnd\.ms-/,
  /^text\/plain$/,
];

export class AssetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetUploadError';
  }
}

export function humanFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function safeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  return `${stem || 'file'}${ext}`;
}

export async function uploadAsset(
  file: File,
  folder: 'assets' | 'logos'
): Promise<{ url: string; storagePath: string; size: string; contentType: string }> {
  if (!ALLOWED_TYPES.some((re) => re.test(file.type))) {
    throw new AssetUploadError(`"${file.name}" is a ${file.type || 'unknown'} file — upload an image, PDF, or document.`);
  }
  if (file.size > ASSET_UPLOAD_MAX_BYTES) {
    throw new AssetUploadError(`"${file.name}" is ${humanFileSize(file.size)} — the limit is 50 MB.`);
  }
  if (!supabase) throw new AssetUploadError('Supabase is not configured.');

  const storagePath = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: false });
  if (error) throw new AssetUploadError(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from('brand-assets').getPublicUrl(storagePath);
  return { url: data.publicUrl, storagePath, size: humanFileSize(file.size), contentType: file.type };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/uploadAsset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Full gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/uploadAsset.ts src/utils/uploadAsset.test.ts
git commit -m "feat(assets): uploadAsset helper for the brand-assets Storage bucket

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Brand storage layer — `SEED_BRANDS` alias + `storage.ts` mappers

**Files:**
- Modify: `src/data/brands.ts` (add `SEED_BRANDS` export alias; keep `BRANDS` for now)
- Modify: `src/types.ts` (add `BrandRow`? no — keep row typing as `any` like the existing mappers)
- Modify: `src/utils/storage.ts` (add brand block near the templates block)
- Create: `src/utils/storage.brands.test.ts`

**Interfaces:**
- Consumes: `BrandConfig`, `BrandId` from `src/types.ts`; `SEED_BRANDS` from `src/data/brands.ts`; `supabase` from `src/lib/supabase.ts`.
- Produces:
  ```ts
  // src/data/brands.ts
  export const SEED_BRANDS: Record<BrandId, BrandConfig>;   // === BRANDS for now

  // src/utils/storage.ts
  export function rowToBrand(row: any): BrandConfig;   // merges nulls over SEED_BRANDS[row.id]
  export function brandToRow(b: BrandConfig): Record<string, unknown>;
  export function fetchRemoteBrands(): Promise<BrandConfig[] | null>;
  export function upsertRemoteBrand(b: BrandConfig): Promise<void>;
  export function subscribeRemoteBrands(onChange: (brands: BrandConfig[]) => void): () => void;
  export function getStoredBrands(): Record<BrandId, BrandConfig>;   // localStorage merged over SEED_BRANDS
  export function saveStoredBrands(map: Record<BrandId, BrandConfig>): void;
  ```

- [ ] **Step 1: Add the `SEED_BRANDS` alias**

In `src/data/brands.ts`, directly after the `export const BRANDS ...` object literal:

```ts
/**
 * The compiled-in defaults. `BRANDS` is being migrated to the runtime
 * `useBrands()` context (see src/context/BrandsContext.tsx); this alias is the
 * synchronous seed + per-field fallback and is the name that survives once the
 * migration is done.
 */
export const SEED_BRANDS = BRANDS;
```

- [ ] **Step 2: Write the failing test**

```ts
// src/utils/storage.brands.test.ts
import { describe, it, expect } from 'vitest';
import { rowToBrand, brandToRow } from './storage';
import { SEED_BRANDS } from '../data/brands';

describe('rowToBrand', () => {
  it('maps a full row', () => {
    const b = rowToBrand({
      id: 'med-q', name: 'MED-Q X', short_code: 'MQ', tagline: 't', description: 'd',
      primary_color: '#111', secondary_color: '#222', accent_color: '#333', surface_color: '#444',
      icon: 'biotech', logo_url: '/x.png', voice_rules: ['a', 'b'],
      fonts: { display: 'D', headline: 'H', code: 'C', body: 'B' }, sort_order: 2,
    });
    expect(b.name).toBe('MED-Q X');
    expect(b.primaryColor).toBe('#111');
    expect(b.voiceRules).toEqual(['a', 'b']);
    expect(b.fonts.display).toBe('D');
  });

  it('falls back to SEED_BRANDS for null columns', () => {
    const b = rowToBrand({ id: 'med-q', name: 'MED-Q', short_code: 'MED_Q',
      primary_color: '#111', secondary_color: '#222', accent_color: '#333', surface_color: '#444',
      icon: null, logo_url: null, voice_rules: null, fonts: null, tagline: null, description: null, sort_order: 0 });
    expect(b.icon).toBe(SEED_BRANDS['med-q'].icon);
    expect(b.logoUrl).toBe(SEED_BRANDS['med-q'].logoUrl);
    expect(b.voiceRules).toEqual(SEED_BRANDS['med-q'].voiceRules);
    expect(b.fonts).toEqual(SEED_BRANDS['med-q'].fonts);
  });
});

describe('brandToRow', () => {
  it('round-trips through rowToBrand', () => {
    const original = SEED_BRANDS.pharmacozyme;
    expect(rowToBrand(brandToRow(original))).toEqual(original);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/storage.brands.test.ts`
Expected: FAIL — `rowToBrand` not exported.

- [ ] **Step 4: Implement the brand block in `storage.ts`**

Add near the top with the other keys:

```ts
const BRANDS_KEY = 'pharmacozyme_brandops_brands_v1';
```

Add `BrandConfig`, `BrandId` to the existing `import ... from '../types'` line, and `SEED_BRANDS` to the `import ... from '../data/brands'` line (create that import if absent).

Add this block (mirror the `rowToTemplate`/`fetchRemoteTemplates` section):

```ts
// ─── Brands ────────────────────────────────────────────────────────────
export function rowToBrand(row: any): BrandConfig {
  const seed = SEED_BRANDS[row.id as BrandId];
  return {
    id: row.id,
    name: row.name ?? seed.name,
    shortCode: row.short_code ?? seed.shortCode,
    tagline: row.tagline ?? seed.tagline,
    description: row.description ?? seed.description,
    primaryColor: row.primary_color ?? seed.primaryColor,
    secondaryColor: row.secondary_color ?? seed.secondaryColor,
    accentColor: row.accent_color ?? seed.accentColor,
    surfaceColor: row.surface_color ?? seed.surfaceColor,
    icon: row.icon ?? seed.icon,
    logoUrl: row.logo_url ?? seed.logoUrl,
    voiceRules: Array.isArray(row.voice_rules) && row.voice_rules.length ? row.voice_rules : seed.voiceRules,
    fonts: row.fonts && Object.keys(row.fonts).length ? row.fonts : seed.fonts,
  };
}

export function brandToRow(b: BrandConfig): Record<string, unknown> {
  return {
    id: b.id,
    name: b.name,
    short_code: b.shortCode,
    tagline: b.tagline,
    description: b.description,
    primary_color: b.primaryColor,
    secondary_color: b.secondaryColor,
    accent_color: b.accentColor,
    surface_color: b.surfaceColor,
    icon: b.icon,
    logo_url: b.logoUrl ?? null,
    voice_rules: b.voiceRules,
    fonts: b.fonts,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchRemoteBrands(): Promise<BrandConfig[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('brands').select('*').order('sort_order', { ascending: true });
  if (error) { console.error('[Supabase] fetchRemoteBrands failed:', error.message); return null; }
  return data.map(rowToBrand);
}

export async function upsertRemoteBrand(b: BrandConfig): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('brands').upsert(brandToRow(b));
  if (error) console.error('[Supabase] upsertRemoteBrand failed:', error.message);
}

export function subscribeRemoteBrands(onChange: (brands: BrandConfig[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('brands-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, async () => {
      const brands = await fetchRemoteBrands();
      if (brands) onChange(brands);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function getStoredBrands(): Record<BrandId, BrandConfig> {
  const merged = { ...SEED_BRANDS };
  try {
    const raw = localStorage.getItem(BRANDS_KEY);
    if (raw) {
      const list: BrandConfig[] = JSON.parse(raw);
      for (const b of list) if (b?.id && merged[b.id as BrandId]) merged[b.id as BrandId] = b;
    }
  } catch { /* fall through to seeds */ }
  return merged;
}

export function saveStoredBrands(map: Record<BrandId, BrandConfig>): void {
  try { localStorage.setItem(BRANDS_KEY, JSON.stringify(Object.values(map))); } catch { /* quota — ignore */ }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/storage.brands.test.ts`
Expected: PASS (4 tests). Fix `SEED_BRANDS` transcription if the round-trip fails.

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/data/brands.ts src/utils/storage.ts src/utils/storage.brands.test.ts
git commit -m "feat(brands): SEED_BRANDS alias + brands storage mappers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `BrandsProvider` + `useBrands()` context

**Files:**
- Create: `src/context/BrandsContext.tsx`
- Create: `src/context/BrandsContext.test.tsx`
- Modify: `src/App.tsx` (wrap the tree)

**Interfaces:**
- Consumes: `getStoredBrands`, `saveStoredBrands`, `fetchRemoteBrands`, `upsertRemoteBrand`, `subscribeRemoteBrands` from `src/utils/storage.ts`; `SEED_BRANDS` from `src/data/brands.ts`.
- Produces:
  ```ts
  export const BrandsProvider: React.FC<{ children: React.ReactNode }>;
  export function useBrands(): {
    brands: Record<BrandId, BrandConfig>;
    getBrand(id: BrandId | 'all' | 'shared'): BrandConfig;
    updateBrand(id: BrandId, patch: Partial<BrandConfig>): Promise<void>;
  };
  ```
  `getBrand('all')` and `getBrand('shared')` both return `brands.pharmacozyme` (matches every current fallback).

- [ ] **Step 1: Write the failing test**

```tsx
// src/context/BrandsContext.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrandsProvider, useBrands } from './BrandsContext';

vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteBrands: vi.fn().mockResolvedValue(null),
    subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
    upsertRemoteBrand: vi.fn().mockResolvedValue(undefined),
  };
});

function Probe() {
  const { brands, getBrand } = useBrands();
  return (
    <div>
      <span data-testid="pz">{brands.pharmacozyme.name}</span>
      <span data-testid="all">{getBrand('all').id}</span>
    </div>
  );
}

describe('useBrands', () => {
  it('provides SEED_BRANDS before any remote load', () => {
    render(<BrandsProvider><Probe /></BrandsProvider>);
    expect(screen.getByTestId('pz').textContent).toBe('Pharmacozyme');
    expect(screen.getByTestId('all').textContent).toBe('pharmacozyme');
  });

  it('updateBrand patches the in-context value', async () => {
    function Editor() {
      const { brands, updateBrand } = useBrands();
      return <button onClick={() => updateBrand('med-q', { primaryColor: '#000000' })}>
        {brands['med-q'].primaryColor}
      </button>;
    }
    render(<BrandsProvider><Editor /></BrandsProvider>);
    const btn = screen.getByRole('button');
    await act(async () => { btn.click(); });
    expect(btn.textContent).toBe('#000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/BrandsContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the context**

```tsx
// src/context/BrandsContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { BrandConfig, BrandId } from '../types';
import { SEED_BRANDS } from '../data/brands';
import {
  getStoredBrands, saveStoredBrands, fetchRemoteBrands, upsertRemoteBrand, subscribeRemoteBrands,
} from '../utils/storage';

interface BrandsContextValue {
  brands: Record<BrandId, BrandConfig>;
  getBrand: (id: BrandId | 'all' | 'shared') => BrandConfig;
  updateBrand: (id: BrandId, patch: Partial<BrandConfig>) => Promise<void>;
}

const BrandsContext = createContext<BrandsContextValue | null>(null);

export const BrandsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brands, setBrands] = useState<Record<BrandId, BrandConfig>>(() => getStoredBrands());

  useEffect(() => {
    fetchRemoteBrands().then((remote) => {
      if (remote && remote.length) {
        setBrands((prev) => {
          const next = { ...prev };
          for (const b of remote) next[b.id] = b;
          return next;
        });
      }
    });
    const unsub = subscribeRemoteBrands((remote) => {
      setBrands((prev) => {
        const next = { ...prev };
        for (const b of remote) next[b.id] = b;
        return next;
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => { saveStoredBrands(brands); }, [brands]);

  const getBrand = useCallback(
    (id: BrandId | 'all' | 'shared') => (id === 'all' || id === 'shared' ? brands.pharmacozyme : brands[id] ?? brands.pharmacozyme),
    [brands],
  );

  const updateBrand = useCallback(async (id: BrandId, patch: Partial<BrandConfig>) => {
    let updated: BrandConfig | undefined;
    setBrands((prev) => {
      updated = { ...prev[id], ...patch };
      return { ...prev, [id]: updated };
    });
    if (updated) await upsertRemoteBrand(updated);
  }, []);

  const value = useMemo(() => ({ brands, getBrand, updateBrand }), [brands, getBrand, updateBrand]);
  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>;
};

export function useBrands(): BrandsContextValue {
  const ctx = useContext(BrandsContext);
  if (!ctx) throw new Error('useBrands must be used within a BrandsProvider');
  return ctx;
}
```

- [ ] **Step 4: Wrap the app**

In `src/App.tsx`, import `BrandsProvider` and wrap the existing root JSX (inside `ConfirmProvider`, outside everything else):

```tsx
// import at top:
import { BrandsProvider } from './context/BrandsContext';

// in the returned tree, wrap the outermost app div:
<ConfirmProvider>
  <BrandsProvider>
    {/* ...existing children... */}
  </BrandsProvider>
</ConfirmProvider>
```

If `App.tsx` itself uses `BRANDS` (it does, line ~36/243), that stays working via the unchanged `BRANDS` export — it is migrated in Task 5.

- [ ] **Step 5: Run tests + gate**

Run: `npx vitest run src/context/BrandsContext.test.tsx && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/context/BrandsContext.tsx src/context/BrandsContext.test.tsx src/App.tsx
git commit -m "feat(brands): BrandsProvider + useBrands() context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Migrate all `BRANDS` consumers to `useBrands()` / a `brands` param

**Files (Modify):**
- Components (21) — replace `import { BRANDS } from '.../data/brands'` with a `useBrands()` call, rename local refs `BRANDS` → `brands`:
  `src/App.tsx`, `src/components/AssetLibrary.tsx`, `src/components/BrandControlCenter.tsx`,
  `src/components/CalendarView.tsx`, `src/components/CommandPalette.tsx`, `src/components/ContentBank.tsx`,
  `src/components/MyWork.tsx`, `src/components/NewPostModal.tsx`, `src/components/PostDetailModal.tsx`,
  `src/components/QuickAddBar.tsx`, `src/components/ResearchPlans.tsx`, `src/components/SmartMemoryRibbon.tsx`,
  `src/components/TemplateLibrary.tsx`, `src/components/TopNav.tsx`,
  `src/components/calendar/CalendarHeader.tsx`, `src/components/calendar/CalendarListView.tsx`,
  `src/components/calendar/CalendarMonthView.tsx`, `src/components/calendar/CalendarWeekView.tsx`,
  `src/components/calendar/IdeaBacklog.tsx`, `src/components/calendar/MobileDateStripView.tsx`,
  `src/components/calendar/PostCard.tsx`
- Utils (2) — take a `brands` parameter:
  `src/utils/brandConflicts.ts`, `src/utils/researchParse.ts`
- Tests — update callers: `src/utils/brandConflicts.test.ts`, and any test that calls `researchParse` / `getDayBrandSummary`
- Finally: `src/data/brands.ts` — remove `export const BRANDS` (keep the object as a local `const` feeding `SEED_BRANDS`, or rename the literal to `SEED_BRANDS` directly and drop the alias). `SPECS` export stays.

**Interfaces:**
- Consumes: `useBrands` from `src/context/BrandsContext.tsx`; `SEED_BRANDS` from `src/data/brands.ts`.
- Produces:
  ```ts
  // src/utils/brandConflicts.ts — getDayBrandSummary gains a trailing param
  export function getDayBrandSummary(posts: Post[], brands: Record<BrandId, BrandConfig>): DayBrandSummary;
  // (check the real export name/signature in the file; add `brands` as the last param to
  //  every exported fn there that reads BRANDS, and thread it through internal callers)

  // src/utils/researchParse.ts — same: add `brands` as the last param of each exported fn that reads BRANDS
  ```

- [ ] **Step 1: Migrate the two utils (with tests first)**

For `src/utils/brandConflicts.ts`: read the file. For every exported function that references `BRANDS`, add `brands: Record<BrandId, BrandConfig>` as the final parameter and replace `BRANDS` with `brands` in the body. Update its test to pass `SEED_BRANDS`:

```ts
// in src/utils/brandConflicts.test.ts — add the import and thread it through:
import { SEED_BRANDS } from '../data/brands';
// ...every getDayBrandSummary(posts) call becomes getDayBrandSummary(posts, SEED_BRANDS)
```

Run: `npx vitest run src/utils/brandConflicts.test.ts` — Expected: PASS.

Repeat for `src/utils/researchParse.ts` and its test (if it has one; if not, add a one-line smoke test that calls the changed function with `SEED_BRANDS`).

- [ ] **Step 2: Migrate the 21 components**

For each file: delete the `import { BRANDS ... } from '.../data/brands'` line (keep `SPECS` if co-imported: `import { SPECS } from '.../data/brands'`). Add inside the component body, near the other hooks:

```ts
const { brands } = useBrands();
```

Then rename every `BRANDS` reference in that file to `brands`. Add the import:

```ts
import { useBrands } from '<relative>/context/BrandsContext';
```

Callers of the two migrated utils (e.g. `getDayBrandSummary(posts)` inside `MobileDateStripView`, calendar views, `IdeaBacklog`) now pass `brands`: `getDayBrandSummary(posts, brands)`.

`src/App.tsx`: it renders `<BrandsProvider>`, so it cannot call `useBrands()` at its own top level if the provider is a child. Two options — pick the one that fits the file:
  - If `BrandsProvider` wraps `App`'s children, `App` reads brands from a small inner component, **or**
  - Move `<BrandsProvider>` to `src/main.tsx` wrapping `<App />`, then `App` can call `useBrands()` directly. **Prefer this** — check `src/main.tsx` and move the provider there.

- [ ] **Step 3: Drop the `BRANDS` export**

In `src/data/brands.ts`: rename the object literal from `BRANDS` to `SEED_BRANDS`, delete the `export const SEED_BRANDS = BRANDS;` alias line. Keep `export const SPECS`. `grep -rn "\bBRANDS\b" src/` must return **zero** hits outside `SEED_BRANDS`.

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green. tsc will name any missed `BRANDS` reference.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(brands): migrate all BRANDS consumers to useBrands()

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Voice-rules reducer

**Files:**
- Create: `src/utils/voiceRules.ts`
- Create: `src/utils/voiceRules.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type VoiceRuleAction =
    | { type: 'add' }
    | { type: 'edit'; index: number; text: string }
    | { type: 'remove'; index: number }
    | { type: 'move'; from: number; to: number };
  export function voiceRulesReducer(state: string[], action: VoiceRuleAction): string[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/voiceRules.test.ts
import { describe, it, expect } from 'vitest';
import { voiceRulesReducer } from './voiceRules';

describe('voiceRulesReducer', () => {
  it('add appends an empty string', () => {
    expect(voiceRulesReducer(['a'], { type: 'add' })).toEqual(['a', '']);
  });
  it('edit replaces one entry', () => {
    expect(voiceRulesReducer(['a', 'b'], { type: 'edit', index: 1, text: 'B' })).toEqual(['a', 'B']);
  });
  it('remove drops one entry', () => {
    expect(voiceRulesReducer(['a', 'b', 'c'], { type: 'remove', index: 1 })).toEqual(['a', 'c']);
  });
  it('move reorders', () => {
    expect(voiceRulesReducer(['a', 'b', 'c'], { type: 'move', from: 0, to: 2 })).toEqual(['b', 'c', 'a']);
  });
  it('ignores out-of-range indices', () => {
    expect(voiceRulesReducer(['a'], { type: 'remove', index: 5 })).toEqual(['a']);
    expect(voiceRulesReducer(['a'], { type: 'move', from: 0, to: 9 })).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/utils/voiceRules.test.ts`)

- [ ] **Step 3: Implement**

```ts
// src/utils/voiceRules.ts
export type VoiceRuleAction =
  | { type: 'add' }
  | { type: 'edit'; index: number; text: string }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number };

const inRange = (i: number, len: number) => i >= 0 && i < len;

export function voiceRulesReducer(state: string[], action: VoiceRuleAction): string[] {
  switch (action.type) {
    case 'add':
      return [...state, ''];
    case 'edit':
      if (!inRange(action.index, state.length)) return state;
      return state.map((r, i) => (i === action.index ? action.text : r));
    case 'remove':
      if (!inRange(action.index, state.length)) return state;
      return state.filter((_, i) => i !== action.index);
    case 'move': {
      if (!inRange(action.from, state.length) || !inRange(action.to, state.length)) return state;
      const next = [...state];
      const [moved] = next.splice(action.from, 1);
      next.splice(action.to, 0, moved);
      return next;
    }
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/voiceRules.ts src/utils/voiceRules.test.ts
git commit -m "feat(brands): voice-rules list reducer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: BrandControlCenter — "Edit brand kit" panel

**Files:**
- Modify: `src/components/BrandControlCenter.tsx`
- Modify: `src/components/BrandControlCenter.test.tsx` (if present) or Create it

**Interfaces:**
- Consumes: `useBrands()` (`brands`, `updateBrand`) from Task 4; `voiceRulesReducer` from Task 6; `uploadAsset` from Task 2; existing `useConfirm`, `showToast` prop, `logAuditEvent`/`buildAuditEvent` from `src/utils/audit.ts`.
- Produces: no new exports.

- [ ] **Step 1: Add local edit state**

In `BrandControlCenter`, for the currently-viewed brand (`brand = brands[activeBrandId]`), add:

```tsx
const { brands, updateBrand } = useBrands();          // (added in Task 5; confirm present)
const [isEditing, setIsEditing] = useState(false);
const [draft, setDraft] = useState<BrandConfig | null>(null);

const startEdit = () => { setDraft({ ...brand }); setIsEditing(true); };
const cancelEdit = () => { setDraft(null); setIsEditing(false); };
const patch = (p: Partial<BrandConfig>) => setDraft((d) => (d ? { ...d, ...p } : d));

const saveEdit = async () => {
  if (!draft) return;
  await updateBrand(draft.id, draft);
  setIsEditing(false); setDraft(null);
};
```

- [ ] **Step 2: Add the "Edit brand kit" button + panel**

Near the brand header, an `Edit brand kit` button (`startEdit`). When `isEditing && draft`, render a panel with:

- **Identity:** text inputs bound to `draft.name`, `draft.shortCode`, `draft.tagline`, textarea `draft.description` → `patch({...})`.
- **Colours:** for each of `primaryColor/secondaryColor/accentColor/surfaceColor`, an `<input type="color">` + a hex `<input type="text">` (both call `patch`), with a live swatch.
- **Logo:** current logo `<img>` + an `<input type="file" accept="image/*">`; on change:
  ```tsx
  const f = e.target.files?.[0]; if (!f) return;
  try { const { url } = await uploadAsset(f, 'logos'); patch({ logoUrl: url }); }
  catch (err) { showToast(err instanceof Error ? err.message : 'Upload failed', undefined, 4000, 'error'); }
  ```
  plus a text input bound to `draft.logoUrl` for pasting a URL.
- **Voice rules:** map `draft.voiceRules`; each row = text input + a remove button (`patch({ voiceRules: voiceRulesReducer(draft.voiceRules, { type: 'remove', index: i }) })`), an "Add rule" button (`{ type: 'add' }`), and up/down buttons (`{ type: 'move', ... }`). Editing a row uses `{ type: 'edit', index: i, text }`.
- **Fonts:** four text inputs bound to `draft.fonts.display/headline/code/body` (`patch({ fonts: { ...draft.fonts, display: v } })`), with a caption: *"Reference labels for the team — these do not re-skin the app."*
- Footer: **Cancel** (`cancelEdit`) / **Save** (`saveEdit`). Use the Calm Clarity button classes already in the file.

- [ ] **Step 3: Audit-log the save**

In `saveEdit`, before/after the `updateBrand`, call the existing audit helper (match the signature used elsewhere in the codebase — check `src/utils/audit.ts`):

```tsx
logAuditEvent(buildAuditEvent('brand.update', { entityId: draft.id, before: brand, after: draft }));
```

- [ ] **Step 4: Test — edit a colour**

```tsx
// src/components/BrandControlCenter.test.tsx  (add case; mock storage + uploadAsset as in Task 4)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { BrandControlCenter } from './BrandControlCenter';

vi.mock('../utils/storage', async (o) => ({ ...(await o<any>()),
  fetchRemoteBrands: vi.fn().mockResolvedValue(null),
  subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
  upsertRemoteBrand: vi.fn().mockResolvedValue(undefined),
}));

it('edits a brand colour through the panel', async () => {
  render(<BrandsProvider><BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} /></BrandsProvider>);
  fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));
  const hex = screen.getByLabelText(/primary colour hex/i);
  fireEvent.change(hex, { target: { value: '#123456' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^save$/i })); });
  expect(screen.getByLabelText(/primary colour hex/i)).toHaveValue('#123456');
});
```

Give the hex inputs `aria-label` (e.g. `"Primary colour hex"`) so the test can target them.

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/components/BrandControlCenter.tsx src/components/BrandControlCenter.test.tsx
git commit -m "feat(brands): edit brand kit panel in BrandControlCenter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Template-category cascade helpers

**Files:**
- Create: `src/utils/templateCategories.ts`
- Create: `src/utils/templateCategories.test.ts`

**Interfaces:**
- Consumes: `PostTemplate` from `src/types.ts`, `BrandId` from `src/types.ts`.
- Produces:
  ```ts
  export const UNCATEGORIZED = 'Uncategorized';
  export function applyCategoryRename(
    templates: PostTemplate[], scope: BrandId | 'shared', oldName: string, newName: string
  ): PostTemplate[];
  export function applyCategoryDelete(
    templates: PostTemplate[], scope: BrandId | 'shared', name: string
  ): PostTemplate[];   // reassigns matches to UNCATEGORIZED
  ```
  "scope match" = `t.brandId === scope` (a `'shared'` template matches `scope === 'shared'`). Name match is case-insensitive.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/templateCategories.test.ts
import { describe, it, expect } from 'vitest';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from './templateCategories';
import { PostTemplate } from '../types';

const t = (id: string, brandId: PostTemplate['brandId'], category: string): PostTemplate => ({
  id, title: id, description: '', brandId, category, platform: 'instagram', specType: 'feed-post',
  defaultCaption: '', tags: [], imagePreview: '', usesCount: 0,
});

describe('applyCategoryRename', () => {
  it('renames matching templates in scope only', () => {
    const out = applyCategoryRename(
      [t('a', 'med-q', 'Clinical'), t('b', 'pillz', 'Clinical'), t('c', 'med-q', 'Editorial')],
      'med-q', 'Clinical', 'Case Studies',
    );
    expect(out.map((x) => x.category)).toEqual(['Case Studies', 'Clinical', 'Editorial']);
  });
  it('is case-insensitive on the old name', () => {
    const out = applyCategoryRename([t('a', 'shared', 'clinical')], 'shared', 'Clinical', 'X');
    expect(out[0].category).toBe('X');
  });
});

describe('applyCategoryDelete', () => {
  it('reassigns matching templates to Uncategorized', () => {
    const out = applyCategoryDelete([t('a', 'med-q', 'Clinical'), t('b', 'med-q', 'Editorial')], 'med-q', 'Clinical');
    expect(out.map((x) => x.category)).toEqual([UNCATEGORIZED, 'Editorial']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/utils/templateCategories.ts
import { PostTemplate, BrandId } from '../types';

export const UNCATEGORIZED = 'Uncategorized';

const matches = (t: PostTemplate, scope: BrandId | 'shared', name: string) =>
  t.brandId === scope && (t.category || '').toLowerCase() === name.toLowerCase();

export function applyCategoryRename(
  templates: PostTemplate[], scope: BrandId | 'shared', oldName: string, newName: string,
): PostTemplate[] {
  return templates.map((t) => (matches(t, scope, oldName) ? { ...t, category: newName } : t));
}

export function applyCategoryDelete(
  templates: PostTemplate[], scope: BrandId | 'shared', name: string,
): PostTemplate[] {
  return templates.map((t) => (matches(t, scope, name) ? { ...t, category: UNCATEGORIZED } : t));
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add src/utils/templateCategories.ts src/utils/templateCategories.test.ts
git commit -m "feat(templates): category rename/delete cascade helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: `template_categories` storage + `useTemplateCategories` hook + `PostTemplate.category` widening

**Files:**
- Modify: `src/types.ts` (`PostTemplate.category` → `string`; add `TemplateCategory`; add `BrandAsset.storagePath?`)
- Modify: `src/utils/storage.ts` (category block; `assetToRow`/`rowToAsset` gain `storage_path`)
- Create: `src/hooks/useTemplateCategories.ts`
- Create: `src/utils/storage.categories.test.ts`
- Modify: `src/components/TemplateLibrary.tsx` (the `CATEGORY_CHIP_META` / `TEMPLATE_FORM_CATEGORIES` consts must accept the widened type — replace with `categoryMeta(name)`)

**Interfaces:**
- Consumes: `supabase`; `PostTemplate` from types.
- Produces:
  ```ts
  // src/types.ts
  export interface TemplateCategory { id: string; brandId: BrandId | 'shared'; name: string; sortOrder: number; createdAt: string; }
  // PostTemplate.category: string
  // BrandAsset.storagePath?: string

  // src/utils/storage.ts
  export function rowToCategory(row: any): TemplateCategory;
  export function categoryToRow(c: Omit<TemplateCategory, 'createdAt'>): Record<string, unknown>;
  export function fetchRemoteCategories(): Promise<TemplateCategory[] | null>;
  export function upsertRemoteCategory(c: Omit<TemplateCategory, 'createdAt'>): Promise<void>;
  export function deleteRemoteCategory(id: string): Promise<void>;
  export function subscribeRemoteCategories(onChange: (c: TemplateCategory[]) => void): () => void;
  export function getStoredCategories(): TemplateCategory[];
  export function saveStoredCategories(list: TemplateCategory[]): void;

  // src/hooks/useTemplateCategories.ts
  export function useTemplateCategories(): {
    categories: TemplateCategory[];
    categoriesFor: (scope: BrandId | 'shared') => TemplateCategory[];   // sorted by sortOrder
    addCategory: (scope: BrandId | 'shared', name: string) => Promise<void>;
    renameCategory: (scope: BrandId | 'shared', oldName: string, newName: string) => Promise<void>;
    deleteCategory: (scope: BrandId | 'shared', name: string) => Promise<void>;
    reorderCategories: (scope: BrandId | 'shared', orderedIds: string[]) => Promise<void>;
  };
  ```
  The hook manages *categories only*. Template cascade (Task 8 helpers) is wired in the component (Task 10).

- [ ] **Step 1: Widen the type + add interfaces**

`src/types.ts`: change `category: 'Clinical' | 'Interactive' | 'Editorial' | 'Patient-Facing' | 'Internal';` to `category: string;`. Add `TemplateCategory` (above) near `PostTemplate`. Add `storagePath?: string;` to `BrandAsset`.

Run `npx tsc --noEmit` and fix every resulting error in `TemplateLibrary.tsx`:
- `CATEGORY_CHIP_META: Record<PostTemplate['category'], …>` → a plain object `const CATEGORY_META: Record<string, { label: string; icon: string }>` with the 5 known keys, plus:
  ```ts
  const DEFAULT_CATEGORY_ICON = 'sell';
  const categoryMeta = (name: string) => CATEGORY_META[name] ?? { label: name, icon: DEFAULT_CATEGORY_ICON };
  ```
- `TEMPLATE_FORM_CATEGORIES` / `newCategory` state typed `PostTemplate['category']` → `string`.
- Casts like `as PostTemplate['category']` → drop the cast (it's `string` now).

- [ ] **Step 2: Write the failing storage test**

```ts
// src/utils/storage.categories.test.ts
import { describe, it, expect } from 'vitest';
import { rowToCategory, categoryToRow } from './storage';

describe('template category mappers', () => {
  it('rowToCategory maps snake_case', () => {
    const c = rowToCategory({ id: '1', brand_id: 'med-q', name: 'Clinical', sort_order: 2, created_at: '2026-01-01' });
    expect(c).toEqual({ id: '1', brandId: 'med-q', name: 'Clinical', sortOrder: 2, createdAt: '2026-01-01' });
  });
  it('categoryToRow round-trips', () => {
    const row = categoryToRow({ id: '1', brandId: 'shared', name: 'X', sortOrder: 0 });
    expect(row).toMatchObject({ id: '1', brand_id: 'shared', name: 'X', sort_order: 0 });
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement the storage block** (mirror the templates block)

```ts
const TEMPLATE_CATEGORIES_KEY = 'pharmacozyme_brandops_template_categories_v1';

export function rowToCategory(row: any): TemplateCategory {
  return { id: row.id, brandId: row.brand_id, name: row.name, sortOrder: row.sort_order ?? 0, createdAt: row.created_at };
}
export function categoryToRow(c: Omit<TemplateCategory, 'createdAt'>): Record<string, unknown> {
  return { id: c.id, brand_id: c.brandId, name: c.name, sort_order: c.sortOrder };
}
export async function fetchRemoteCategories(): Promise<TemplateCategory[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('template_categories').select('*').order('sort_order', { ascending: true });
  if (error) { console.error('[Supabase] fetchRemoteCategories failed:', error.message); return null; }
  return data.map(rowToCategory);
}
export async function upsertRemoteCategory(c: Omit<TemplateCategory, 'createdAt'>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('template_categories').upsert(categoryToRow(c));
  if (error) console.error('[Supabase] upsertRemoteCategory failed:', error.message);
}
export async function deleteRemoteCategory(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('template_categories').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteCategory failed:', error.message);
}
export function subscribeRemoteCategories(onChange: (c: TemplateCategory[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase.channel('template-categories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'template_categories' }, async () => {
      const c = await fetchRemoteCategories(); if (c) onChange(c);
    }).subscribe();
  return () => { supabase.removeChannel(channel); };
}
export function getStoredCategories(): TemplateCategory[] {
  try { const raw = localStorage.getItem(TEMPLATE_CATEGORIES_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export function saveStoredCategories(list: TemplateCategory[]): void {
  try { localStorage.setItem(TEMPLATE_CATEGORIES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
```

Also extend `assetToRow` (add `storage_path: a.storagePath ?? null`) and `rowToAsset` (add `storagePath: row.storage_path ?? undefined`).

- [ ] **Step 5: Implement `useTemplateCategories`**

```ts
// src/hooks/useTemplateCategories.ts
import { useEffect, useMemo, useState } from 'react';
import { BrandId } from '../types';
import { TemplateCategory } from '../types';
import {
  getStoredCategories, saveStoredCategories, fetchRemoteCategories,
  upsertRemoteCategory, deleteRemoteCategory, subscribeRemoteCategories,
} from '../utils/storage';

export function useTemplateCategories() {
  const [categories, setCategories] = useState<TemplateCategory[]>(() => getStoredCategories());

  useEffect(() => {
    fetchRemoteCategories().then((r) => { if (r) setCategories(r); });
    const unsub = subscribeRemoteCategories((r) => setCategories(r));
    return () => unsub();
  }, []);
  useEffect(() => { saveStoredCategories(categories); }, [categories]);

  const categoriesFor = (scope: BrandId | 'shared') =>
    categories.filter((c) => c.brandId === scope).sort((a, b) => a.sortOrder - b.sortOrder);

  const addCategory = async (scope: BrandId | 'shared', name: string) => {
    const trimmed = name.trim();
    if (!trimmed || categoriesFor(scope).some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const cat: Omit<TemplateCategory, 'createdAt'> = {
      id: crypto.randomUUID(), brandId: scope, name: trimmed,
      sortOrder: categoriesFor(scope).length,
    };
    setCategories((prev) => [...prev, { ...cat, createdAt: new Date().toISOString() }]);
    await upsertRemoteCategory(cat);
  };

  const renameCategory = async (scope: BrandId | 'shared', oldName: string, newName: string) => {
    const target = categoriesFor(scope).find((c) => c.name.toLowerCase() === oldName.toLowerCase());
    if (!target || !newName.trim()) return;
    const updated = { ...target, name: newName.trim() };
    setCategories((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    await upsertRemoteCategory({ id: updated.id, brandId: updated.brandId, name: updated.name, sortOrder: updated.sortOrder });
  };

  const deleteCategory = async (scope: BrandId | 'shared', name: string) => {
    const target = categoriesFor(scope).find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!target) return;
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    await deleteRemoteCategory(target.id);
  };

  const reorderCategories = async (scope: BrandId | 'shared', orderedIds: string[]) => {
    const next = categories.map((c) => {
      const idx = orderedIds.indexOf(c.id);
      return idx >= 0 && c.brandId === scope ? { ...c, sortOrder: idx } : c;
    });
    setCategories(next);
    await Promise.all(
      next.filter((c) => c.brandId === scope)
        .map((c) => upsertRemoteCategory({ id: c.id, brandId: c.brandId, name: c.name, sortOrder: c.sortOrder })),
    );
  };

  return useMemo(
    () => ({ categories, categoriesFor, addCategory, renameCategory, deleteCategory, reorderCategories }),
    [categories],
  );
}
```

- [ ] **Step 6: Run tests + gate**

Run: `npx vitest run src/utils/storage.categories.test.ts && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/utils/storage.ts src/hooks/useTemplateCategories.ts src/utils/storage.categories.test.ts src/components/TemplateLibrary.tsx
git commit -m "feat(templates): template_categories storage + hook; widen category to string

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: TemplateLibrary — category management UI, scoped dropdowns, upload-first modal

**Files:**
- Modify: `src/components/TemplateLibrary.tsx`

**Interfaces:**
- Consumes: `useTemplateCategories()` (Task 9); `applyCategoryRename`, `applyCategoryDelete`, `UNCATEGORIZED` (Task 8); existing props `templates`, `onUpdateTemplate`, `selectedBrandFilter`; `categoryMeta` (Task 9 Step 1).
- Produces: no new exports.

- [ ] **Step 1: Wire the hook + scope**

```tsx
const { categoriesFor, addCategory, renameCategory, deleteCategory } = useTemplateCategories();
// scope for the browse filter: the selected brand, or 'shared' for "all"
const catScope: BrandId | 'shared' = selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter;
```

- [ ] **Step 2: Filter chips from the hook**

Replace the `categoryChips` `useMemo` so its source is:
`['all', ...categoriesFor(catScope).map(c => c.name), ...orphanNamesInLiveTemplatesForScope]`
where an orphan name is a distinct `template.category` present for that scope but not in `categoriesFor(catScope)`. Each chip's icon comes from `categoryMeta(name).icon`.

- [ ] **Step 3: "Manage categories" panel**

Add a `Manage categories` button by the chips that opens a small inline panel (or a `Modal`) listing `categoriesFor(catScope)`:
- Each row: inline-editable name (on blur/Enter → `handleRename(old, new)`), a delete button (`handleDelete(name)`), up/down reorder buttons calling `reorderCategories(catScope, newIdOrder)`.
- An "Add category" input + button → `addCategory(catScope, name)`.

```tsx
const handleRename = async (oldName: string, newName: string) => {
  if (!newName.trim() || newName === oldName) return;
  await renameCategory(catScope, oldName, newName);
  applyCategoryRename(templates, catScope, oldName, newName)
    .filter((t, i) => t !== templates[i])
    .forEach(onUpdateTemplate);
};

const handleDelete = async (name: string) => {
  if (!(await confirm({ title: `Delete category "${name}"?`, body: `Templates in it move to "${UNCATEGORIZED}".`, confirmLabel: 'Delete', tone: 'danger' }))) return;
  applyCategoryDelete(templates, catScope, name)
    .filter((t, i) => t !== templates[i])
    .forEach(onUpdateTemplate);
  await deleteCategory(catScope, name);
};
```

- [ ] **Step 4: Scope the modal's Category `<select>`**

In the create/edit-template modal, the Category `<select>` options come from `categoriesFor(newBrandId === 'shared' ? 'shared' : newBrandId)`. When the modal's **Brand** field changes and the current `newCategory` is not in the new scope's list, reset `newCategory` to that list's first entry (or `''`).

- [ ] **Step 5: Move the Image field up**

Move the entire **Image** `<div>` (label + URL input + Upload `<label>` + `uploadError`) out of the `{showMoreOptions && ( ... )}` block to sit directly after the Brand/Category grid `<div>` and before the "More options" toggle button. Add a thumbnail preview when `newImagePreview` is set:

```tsx
{newImagePreview && (
  <img src={newImagePreview} alt="" className="h-24 w-full object-cover rounded-lg border border-[#e9e9e7]" />
)}
```

Update the toggle label text to `"More options (description, platform, caption, tags)"`.

- [ ] **Step 6: Manual gate + browser check**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Then dev server (`npm run dev`, :3001), Templates tab, 1440 + 390:
- Category chips reflect the seeded per-brand list; switching the brand filter re-scopes them.
- "Manage categories" → add / rename / delete works; a deleted category's templates show `Uncategorized`.
- Create-template modal shows the Image field + Upload button without expanding "More options".

- [ ] **Step 7: Commit**

```bash
git add src/components/TemplateLibrary.tsx
git commit -m "feat(templates): per-brand category management + upload-first modal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: AssetLibrary — upload zone + `storagePath`

**Files:**
- Modify: `src/components/AssetLibrary.tsx`

**Interfaces:**
- Consumes: `uploadAsset` (Task 2); existing `BrandAsset` (now with `storagePath?`), props `onAddAsset`/`onUpdateAsset`.
- Produces: no new exports.

- [ ] **Step 1: Add upload state + handler**

```tsx
const [isUploading, setIsUploading] = useState(false);
const [uploadError, setUploadError] = useState<string | null>(null);
const [storagePath, setStoragePath] = useState<string | undefined>(undefined);

const handleFile = async (file: File | undefined) => {
  if (!file) return;
  setUploadError(null); setIsUploading(true);
  try {
    const res = await uploadAsset(file, 'assets');
    setUrl(res.url); setStoragePath(res.storagePath);
    setFileType(res.contentType || fileType); setSize(res.size);
  } catch (err) {
    setUploadError(err instanceof Error ? err.message : 'Upload failed.');
  } finally {
    setIsUploading(false);
  }
};
```

Reset `storagePath` in `resetForm` and set it from `asset.storagePath` in `handleOpenEditModal`.

- [ ] **Step 2: Add the drop zone at the top of the modal body**

Above the "Asset name" `TextField`:

```tsx
<label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#e9e9e7] rounded-lg p-6 text-center cursor-pointer hover:border-[#4f46e5] hover:bg-[#eef2ff] transition-colors">
  <span className="material-symbols-outlined text-[#4f46e5]">upload_file</span>
  <span className="font-label-caps text-xs font-bold text-[#1b1c1a]">
    {isUploading ? 'Uploading…' : 'Upload image, PDF or document'}
  </span>
  <span className="font-body-md text-[11px] text-[#5f5f5b]">Up to 50 MB · or paste a link below</span>
  <input type="file" className="hidden"
    accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
    onChange={(e) => handleFile(e.target.files?.[0])} />
</label>
{uploadError && <p className="text-[11px] text-[#dc2626]">{uploadError}</p>}
```

- [ ] **Step 3: Persist `storagePath`**

In `handleSaveAsset`, include `storagePath` on both the `updated` and `newAsset` objects.

- [ ] **Step 4: Gate + browser check**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Dev server, Assets tab: upload a PNG and a PDF → the URL field fills, `Open / Download` opens the file; size/format auto-fill and stay editable; the paste-a-link path still works.

- [ ] **Step 5: Commit**

```bash
git add src/components/AssetLibrary.tsx
git commit -m "feat(assets): file upload zone in the asset modal (Supabase Storage)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Verification sweep

**Files:** none (verification only) — plus a `docs/` note if anything is deferred.

- [ ] **Step 1: Confirm the user has applied migrations**

Before the browser pass, `0018`–`0021` must be applied on Supabase project `sgevopyvcsclkasvekah`, and the `brand-assets` bucket + 4 storage policies must exist (migration `0021` or the dashboard equivalent). If not applied, note it and run the checks that don't need the DB (they degrade to `SEED_BRANDS` + empty categories + no upload).

- [ ] **Step 2: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green. Record the test count.

- [ ] **Step 3: `BRANDS` fully retired**

Run: `grep -rn "\bBRANDS\b" src/` — expected: only `SEED_BRANDS` occurrences.

- [ ] **Step 4: Browser pass** (dev :3001, login as configured, Chrome/Playwright, 1440 + 390):
  - **Brands:** edit MED-Q `primaryColor` in BrandControlCenter → save → the calendar brand chip, the TopNav switcher logo-tile, and brand pills pick up the new colour without reload. Reload → still applied (persisted). Edit voice rules (add/reorder/remove) → persist across reload. Upload a new logo → shows in the nav switcher.
  - **Template categories:** on the Templates tab, per-brand chips match the seed; add "Case Studies" to MED-Q → appears in chips and in the create-modal dropdown when Brand = MED-Q; rename it → existing templates follow; delete it → those templates read `Uncategorized`.
  - **Template modal:** image upload field is visible without expanding "More options"; a thumbnail shows after upload.
  - **Assets:** upload a PDF and a PNG → public URL fills, opens; delete still works (Storage object cleanup is item 7, not this batch).

- [ ] **Step 5: Update the spec status + commit**

Set the spec's `**Status:**` line to `Implemented (feat/customization-batch)`. If the prompt-preset UI or anything else was deferred, add a one-line "Deferred" note.

```bash
git add docs/superpowers/specs/2026-09-03-brand-customization-design.md
git commit -m "docs: mark brand-customization spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2.1 approach B → Tasks 3–5. §2.2 consumer migration → Task 5. §2.3 schema → Task 1. §2.4 storage.ts → Task 3. §2.5 edit UI → Task 7 (prompt presets explicitly deferred, per spec). §2.6 voice-rules reducer → Task 6.
- §3.1 categories schema → Task 1. §3.2 storage + hook → Task 9. §3.3 management UI → Task 10. §3.4 cascade helpers → Task 8. §3.5 chips + dropdown → Task 10.
- §4 modal upload-first → Task 10 Step 5.
- §5.1 bucket → Task 1. §5.2 `uploadAsset` → Task 2. §5.3 `BrandAsset.storagePath` + `assets.storage_path` → Task 9 (col in Task 1). §5.4 asset modal zone → Task 11. §5.5 logo upload → Task 7 Step 2.
- §6 migrations → Task 1; apply reminder → Task 12 Step 1.
- §7 testing → per-task tests + Task 12 browser pass.
- §8 out of scope → respected (no brand add/remove; item 7 untouched; template images stay on Drive — Task 10 only reorders the field).

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". The one soft spot — the `med-q`/`pillz`/`prescriptionz` seed values in Task 1 — carries an explicit instruction to transcribe from `src/data/brands.ts`, because the plan author could not read those lines. All test code and implementation code is shown in full.

**Type consistency:** `useBrands()` shape identical in Tasks 4, 5, 7. `TemplateCategory` fields (`brandId`, `sortOrder`, `createdAt`) consistent across Tasks 9 (types, storage, hook) and 10. `applyCategoryRename`/`applyCategoryDelete` signatures identical in Tasks 8 and 10. `uploadAsset(file, folder)` return shape identical in Tasks 2, 7, 11. `PostTemplate.category: string` set in Task 9 Step 1 before any consumer relies on it.
