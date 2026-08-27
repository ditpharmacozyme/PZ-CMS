-- Migration: 0018_reminder_email_not_blank
-- Root cause: get_due_reminders (0016) filters `reminder_email is not null`.
-- An empty string is NOT null, so a post saved with reminder_email = '' (the
-- old display-only fallback in PostDetailModal wrote exactly that) is returned
-- as due on every run. The Apps Script then did `if (!recipient) return;`
-- WITHOUT marking it sent, so the same row was re-fetched and re-skipped
-- every 5 minutes forever while the user believed a reminder was armed.
--
-- Client fix (this round) stops writing '' and the script now marks such rows
-- sent. This migration is the third layer: the RPC should never have called a
-- blank string "due" in the first place.

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
    and reminder_email is not null
    and btrim(reminder_email) <> '';
$$;

grant execute on function public.get_due_reminders(date) to anon;
