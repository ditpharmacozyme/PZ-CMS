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
