-- Generic shared key/value settings, e.g. the team's custom "master_prompt"
-- for the Content Calendar's AI Prompt card. Absence of a row for a given
-- key means "use the app's compiled-in default" for that key.
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
drop policy if exists "app_settings authenticated read"  on app_settings;
create policy "app_settings authenticated read"  on app_settings for select to authenticated using (true);
drop policy if exists "app_settings authenticated write" on app_settings;
create policy "app_settings authenticated write" on app_settings for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table app_settings;
  end if;
end $$;
