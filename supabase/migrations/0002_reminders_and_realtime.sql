-- Adds reminder de-dupe tracking and turns on realtime for the tables that
-- only refreshed on page load until now (posts already had it from 0001).
--
-- Run this once in the Supabase SQL Editor after 0001_init.sql.

alter table posts add column if not exists reminder_sent_at timestamptz;

alter publication supabase_realtime add table templates;
alter publication supabase_realtime add table content_bank;
alter publication supabase_realtime add table assets;
alter publication supabase_realtime add table team_members;
