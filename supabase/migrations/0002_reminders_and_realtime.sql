-- Adds reminder de-dupe tracking and turns on realtime for the tables that
-- only refreshed on page load until now (posts already had it from 0001).
--
-- Run this once in the Supabase SQL Editor after 0001_init.sql.

alter table posts add column if not exists reminder_sent_at timestamptz;

-- Some of these may already be in the publication (Supabase auto-adds new
-- tables to it on newer projects), so guard each one individually instead
-- of a bare ALTER PUBLICATION, which errors on a table that's already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'templates'
  ) then
    alter publication supabase_realtime add table templates;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_bank'
  ) then
    alter publication supabase_realtime add table content_bank;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assets'
  ) then
    alter publication supabase_realtime add table assets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members'
  ) then
    alter publication supabase_realtime add table team_members;
  end if;
end $$;
