-- Migration: 0016_reminder_rpcs
-- Root cause: migration 0007 locked `posts` to `for all to authenticated`,
-- but the Apps Script time-driven trigger (sendDueReminders, in
-- src/data/googleAppsScript.ts) queries Supabase directly with the anon key
-- -- it has no Supabase Auth session, so RLS silently returns zero rows on
-- every run and no reminder email has gone out since 0007 landed.
--
-- Fix: two narrow SECURITY DEFINER RPCs, granted to anon, instead of
-- broadening posts RLS back open (which would also hand read/write access
-- to the *browser-embedded* anon key, reopening exactly what 0007 closed).
-- Each function does one fixed, minimal-column operation -- even a leaked
-- anon key can't do anything with these beyond what they explicitly allow.
-- Matches the existing link_my_team_member pattern from 0009.

create or replace function public.get_due_reminders(p_as_of_date date)
returns table (
  id             text,
  title          text,
  brand_id       text,
  scheduled_date date,
  scheduled_time text,
  platform       text,
  caption        text,
  assignees      text[],
  visual_url     text,
  reminder_email text
)
language sql
security definer
set search_path = ''
stable
as $$
  select id, title, brand_id, scheduled_date, scheduled_time, platform, caption, assignees, visual_url, reminder_email
  from public.posts
  where scheduled_date <= p_as_of_date
    and email_reminder_enabled = true
    and reminder_sent_at is null
    and reminder_email is not null;
$$;

grant execute on function public.get_due_reminders(date) to anon;

create or replace function public.mark_reminder_sent(p_post_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set reminder_sent_at = now() where id = p_post_id;
$$;

grant execute on function public.mark_reminder_sent(text) to anon;
