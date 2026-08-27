-- Migration: 0018_reminder_rpc_secret_and_blank_guard
--
-- Two fixes to the reminder RPCs from 0016:
--
-- 1. Silent-failure loop: get_due_reminders filtered `reminder_email is not
--    null`. An empty string is NOT null, so a post saved with reminder_email
--    = '' (the old display-only fallback wrote exactly that) came back as due
--    on every run and the Apps Script skipped it without marking it sent --
--    re-fetched and re-skipped every 5 minutes forever. Now also requires
--    btrim(reminder_email) <> ''.
--
-- 2. Anon exposure: 0016 granted these SECURITY DEFINER functions to `anon`
--    with no check. The anon key ships in the browser bundle, so anyone
--    holding it could enumerate every due post's reminder_email / title /
--    caption / assignees. Both functions now take a shared secret and reject
--    the call unless it matches a value only a SECURITY DEFINER function can
--    read. The Apps Script passes it from a REMINDER_RPC_SECRET script
--    property (see src/data/googleAppsScript.ts).
--
-- AFTER APPLYING: read the generated secret with
--   select value from private.app_secrets where name = 'reminder_rpc_secret';
-- and set it as the REMINDER_RPC_SECRET script property in the deployed Apps
-- Script project (Project Settings -> Script Properties), then re-deploy the
-- script. Until both are done the 5-minute trigger will log "bad or missing
-- secret" and send nothing.

create schema if not exists private;

create table if not exists private.app_secrets (
  name  text primary key,
  value text not null
);

-- No role gets direct access -- only SECURITY DEFINER functions with
-- search_path = '' that reference private.app_secrets explicitly.
revoke all on private.app_secrets from anon, authenticated;
revoke all on schema private from anon, authenticated;

insert into private.app_secrets (name, value)
values ('reminder_rpc_secret', md5(gen_random_uuid()::text || gen_random_uuid()::text))
on conflict (name) do nothing;

-- Keep the old 1-arg signatures, but as shims that fail loudly. Dropping
-- them outright made a still-deployed old Apps Script get PostgREST 404
-- (PGRST202), which its "nothing due" logging swallows -- reminders would
-- just stop with no attributable error. Raising here gives a clear message
-- once the script's HTTP-status check (added alongside this migration) logs
-- the body.
create or replace function public.get_due_reminders(p_as_of_date date)
returns table (
  id text, title text, brand_id text, scheduled_date date, scheduled_time text,
  platform text, caption text, assignees text[], visual_url text, reminder_email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'get_due_reminders now requires a secret argument (migration 0018). Re-copy this script from the app''s Integrations tab and set the REMINDER_RPC_SECRET script property.';
end;
$$;
grant execute on function public.get_due_reminders(date) to anon;

create or replace function public.mark_reminder_sent(p_post_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'mark_reminder_sent now requires a secret argument (migration 0018). Re-copy this script from the app''s Integrations tab and set the REMINDER_RPC_SECRET script property.';
end;
$$;
grant execute on function public.mark_reminder_sent(text) to anon;

create or replace function public.get_due_reminders(p_as_of_date date, p_secret text)
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
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where name = 'reminder_rpc_secret') then
    raise exception 'get_due_reminders: bad or missing secret';
  end if;
  return query
    select p.id, p.title, p.brand_id, p.scheduled_date, p.scheduled_time,
           p.platform, p.caption, p.assignees, p.visual_url, p.reminder_email
    from public.posts p
    where p.scheduled_date <= p_as_of_date
      and p.email_reminder_enabled = true
      and p.reminder_sent_at is null
      and p.reminder_email is not null
      and btrim(p.reminder_email) <> '';
end;
$$;

grant execute on function public.get_due_reminders(date, text) to anon;

create or replace function public.mark_reminder_sent(p_post_id text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret <> (select value from private.app_secrets where name = 'reminder_rpc_secret') then
    raise exception 'mark_reminder_sent: bad or missing secret';
  end if;
  update public.posts set reminder_sent_at = now() where id = p_post_id;
end;
$$;

grant execute on function public.mark_reminder_sent(text, text) to anon;
