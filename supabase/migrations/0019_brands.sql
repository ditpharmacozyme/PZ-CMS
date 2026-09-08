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
drop policy if exists "brands authenticated read"  on brands;
create policy "brands authenticated read"  on brands for select to authenticated using (true);
drop policy if exists "brands authenticated write" on brands;
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
