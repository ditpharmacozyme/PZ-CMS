-- Ads Library: programs (courses/workshops/webinars) -> ad sets -> creatives,
-- with Drive-backed files, audiences, and revocable share links.
-- Authenticated users have full access; anonymous visitors can ONLY reach data
-- through the two security-definer RPCs at the bottom (no anon table policies).

create table if not exists ad_programs (
  id              text primary key,
  name            text not null,
  brand_id        text not null default 'shared',
  kind            text not null default 'course' check (kind in ('course','workshop','webinar','program')),
  drive_folder_id text not null default '',
  hidden          boolean not null default false,
  created_by      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists ad_sets (
  id              text primary key,
  program_id      text null,
  name            text not null,
  audience        text not null default '',
  drive_folder_id text not null default '',
  hidden          boolean not null default false,
  is_system       boolean not null default false,
  created_by      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ad_sets_program_id_idx on ad_sets (program_id);

create table if not exists ad_creatives (
  id          text primary key,
  set_id      text not null,
  name        text not null,
  format      text not null default 'image' check (format in ('image','carousel','video','zip','other')),
  files       jsonb not null default '[]'::jsonb,
  source_url  text not null default '',
  hidden      boolean not null default false,
  uploaded_by text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ad_creatives_set_id_idx on ad_creatives (set_id);

create table if not exists ad_audiences (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int  not null default 0
);

create unique index if not exists ad_audiences_lower_name_idx
  on ad_audiences (lower(name));

create table if not exists ad_share_links (
  token      text primary key,
  level      text not null check (level in ('program','set','creative')),
  target_id  text not null,
  label      text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

-- RLS: authenticated only; deliberately no policy for anon.
alter table ad_programs enable row level security;
drop policy if exists "ad_programs authenticated read"  on ad_programs;
create policy "ad_programs authenticated read"  on ad_programs for select to authenticated using (true);
drop policy if exists "ad_programs authenticated write" on ad_programs;
create policy "ad_programs authenticated write" on ad_programs for all    to authenticated using (true) with check (true);

alter table ad_sets enable row level security;
drop policy if exists "ad_sets authenticated read"  on ad_sets;
create policy "ad_sets authenticated read"  on ad_sets for select to authenticated using (true);
drop policy if exists "ad_sets authenticated write" on ad_sets;
create policy "ad_sets authenticated write" on ad_sets for all    to authenticated using (true) with check (true);

alter table ad_creatives enable row level security;
drop policy if exists "ad_creatives authenticated read"  on ad_creatives;
create policy "ad_creatives authenticated read"  on ad_creatives for select to authenticated using (true);
drop policy if exists "ad_creatives authenticated write" on ad_creatives;
create policy "ad_creatives authenticated write" on ad_creatives for all    to authenticated using (true) with check (true);

alter table ad_audiences enable row level security;
drop policy if exists "ad_audiences authenticated read"  on ad_audiences;
create policy "ad_audiences authenticated read"  on ad_audiences for select to authenticated using (true);
drop policy if exists "ad_audiences authenticated write" on ad_audiences;
create policy "ad_audiences authenticated write" on ad_audiences for all    to authenticated using (true) with check (true);

alter table ad_share_links enable row level security;
drop policy if exists "ad_share_links authenticated read"  on ad_share_links;
create policy "ad_share_links authenticated read"  on ad_share_links for select to authenticated using (true);
drop policy if exists "ad_share_links authenticated write" on ad_share_links;
create policy "ad_share_links authenticated write" on ad_share_links for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_programs') then
    alter publication supabase_realtime add table ad_programs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_sets') then
    alter publication supabase_realtime add table ad_sets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_creatives') then
    alter publication supabase_realtime add table ad_creatives;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_audiences') then
    alter publication supabase_realtime add table ad_audiences;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_share_links') then
    alter publication supabase_realtime add table ad_share_links;
  end if;
end $$;

insert into ad_audiences (name, sort_order) values
  ('Doctors', 0),
  ('Nurses', 1),
  ('Pharmacists', 2),
  ('Students', 3),
  ('All healthcare professionals', 4)
on conflict (lower(name)) do nothing;

-- System set that holds creatives not yet assigned to a real ad set.
insert into ad_sets (id, name, is_system) values ('ads-unsorted', 'Unsorted', true)
on conflict (id) do nothing;

-- Public (anon) read of everything not hidden. created_by / uploaded_by and
-- drive_folder_id (programs, sets) are stripped. Creatives keep files[].driveFileId.
create or replace function public.ads_public_library()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with vp as (
    select * from public.ad_programs where not hidden
  ),
  vs as (
    select s.* from public.ad_sets s
    where not s.hidden
      and (s.program_id is null or s.program_id in (select id from vp))
  ),
  vc as (
    select c.* from public.ad_creatives c
    where not c.hidden
      and c.set_id in (select id from vs)
  )
  select jsonb_build_object(
    'programs',  coalesce((select jsonb_agg(to_jsonb(vp) - 'created_by' - 'drive_folder_id' order by vp.created_at, vp.id) from vp), '[]'::jsonb),
    'sets',      coalesce((select jsonb_agg(to_jsonb(vs) - 'created_by' - 'drive_folder_id' order by vs.created_at, vs.id) from vs), '[]'::jsonb),
    'creatives', coalesce((select jsonb_agg(to_jsonb(vc) - 'uploaded_by' order by vc.created_at, vc.id) from vc), '[]'::jsonb)
  );
$$;

-- Share-link scoped read. Ignores `hidden` (a link is an explicit grant).
-- Unknown or revoked token returns three empty arrays.
create or replace function public.ads_shared_scope(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select level, target_id from public.ad_share_links
    where token = p_token and revoked_at is null
  ),
  sp as (
    select p.* from public.ad_programs p
    join l on l.level = 'program' and p.id = l.target_id
  ),
  ss as (
    select s.* from public.ad_sets s
    where exists (select 1 from l where l.level = 'program' and s.program_id = l.target_id)
       or exists (select 1 from l where l.level = 'set' and s.id = l.target_id)
       or exists (
            select 1 from l
            join public.ad_creatives c on c.id = l.target_id
            where l.level = 'creative' and s.id = c.set_id
          )
  ),
  sc as (
    select c.* from public.ad_creatives c
    where exists (
            select 1 from l
            where l.level = 'program'
              and c.set_id in (select s2.id from public.ad_sets s2 where s2.program_id = l.target_id)
          )
       or exists (select 1 from l where l.level = 'set' and c.set_id = l.target_id)
       or exists (select 1 from l where l.level = 'creative' and c.id = l.target_id)
  )
  select jsonb_build_object(
    'programs',  coalesce((select jsonb_agg(to_jsonb(sp) - 'created_by' - 'drive_folder_id' order by sp.created_at, sp.id) from sp), '[]'::jsonb),
    'sets',      coalesce((select jsonb_agg(to_jsonb(ss) - 'created_by' - 'drive_folder_id' order by ss.created_at, ss.id) from ss), '[]'::jsonb),
    'creatives', coalesce((select jsonb_agg(to_jsonb(sc) - 'uploaded_by' order by sc.created_at, sc.id) from sc), '[]'::jsonb)
  );
$$;

revoke all on function public.ads_public_library() from public;
grant execute on function public.ads_public_library() to anon, authenticated;

revoke all on function public.ads_shared_scope(text) from public;
grant execute on function public.ads_shared_scope(text) to anon, authenticated;
