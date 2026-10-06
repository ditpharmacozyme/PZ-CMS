-- Tutorials & Courses Library: video courses, Drive tutorials, SOPs,
-- important links, prompts, and reference files.
-- Supports brand-specific and shared tutorials.

create table if not exists tutorial_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists tutorial_categories_lower_name_idx
  on tutorial_categories (lower(name));

create table if not exists tutorials (
  id          text primary key,
  brand_id    text not null default 'shared',
  title       text not null,
  description text not null default '',
  category    text not null default 'Uncategorized',
  tags        jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  thumbnail_storage_path text,
  videos      jsonb not null default '[]'::jsonb,
  links       jsonb not null default '[]'::jsonb,
  prompts     jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table tutorials add column if not exists thumbnail_url text;
alter table tutorials add column if not exists thumbnail_storage_path text;

create index if not exists tutorials_brand_id_idx on tutorials (brand_id);
create index if not exists tutorials_category_idx on tutorials (category);

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

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tutorial_categories') then
    alter publication supabase_realtime add table tutorial_categories;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tutorials') then
    alter publication supabase_realtime add table tutorials;
  end if;
end $$;

insert into tutorial_categories (name, sort_order) values
  ('Onboarding & SOPs', 0),
  ('Video Production', 1),
  ('Design & Creative', 2),
  ('AI Tools & Workflows', 3),
  ('Copywriting & Content', 4)
on conflict (lower(name)) do nothing;
