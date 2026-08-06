-- Pharmacozyme Brand-Ops Studio — initial schema
--
-- Access model (PRD §6): no login, no per-user permissions. Anyone with the
-- app URL can read and write everything via the anon key — a trust-based
-- team tool, not a gated system. RLS is enabled (required for the anon key
-- to work at all) with a single permissive policy per table.
--
-- Run this once in the Supabase SQL Editor for a fresh project
-- (Dashboard → SQL Editor → New query → paste → Run).

-- ─── Posts ───────────────────────────────────────────────────────────────
create table if not exists posts (
  id                     text primary key,
  brand_id               text not null,
  title                  text not null default '',
  caption                text not null default '',
  platform               text not null default 'instagram',
  spec_type              text not null default 'feed-post',
  scheduled_date         date,                       -- null = sits in the Idea Backlog (PRD §6)
  scheduled_time         text not null default '',
  reminder_email         text,
  email_reminder_enabled boolean not null default false,
  status                 text not null default 'not-started',
  assignee               text not null default '',
  visual_url             text not null default '',   -- Drive URL — never base64
  template_id            text,
  approved               boolean not null default false,
  approved_by            text,
  approved_at            text,                       -- app-formatted "YYYY-MM-DD HH:MM", not a real timestamptz
  recurrence_rule        text,
  notes                  text,
  tags                   text[] not null default '{}',
  comments               jsonb not null default '[]'::jsonb,
  activity_log           jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists posts_scheduled_date_idx on posts (scheduled_date);
create index if not exists posts_brand_id_idx on posts (brand_id);
create index if not exists posts_status_idx on posts (status);

-- ─── Templates ───────────────────────────────────────────────────────────
create table if not exists templates (
  id              text primary key,
  title           text not null default '',
  description     text not null default '',
  brand_id        text not null default 'shared',    -- BrandId | 'shared'
  category        text not null default 'Internal',
  platform        text not null default 'instagram',
  spec_type       text not null default 'feed-post',
  default_caption text not null default '',
  tags            text[] not null default '{}',
  image_preview   text not null default '',
  uses_count      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ─── Content Bank ────────────────────────────────────────────────────────
create table if not exists content_bank (
  id         text primary key,
  text       text not null default '',
  tags       text[] not null default '{}',
  source     text not null default '',
  saved_date date not null default current_date,
  brand_id   text not null default 'shared'           -- BrandId | 'shared'
);

-- ─── Brand Assets ────────────────────────────────────────────────────────
create table if not exists assets (
  id        text primary key,
  brand_id  text not null,
  title     text not null default '',
  type      text not null default 'vector_pack',
  file_type text not null default '',
  size      text not null default '',
  url       text not null default ''
);

-- ─── Team Members ────────────────────────────────────────────────────────
create table if not exists team_members (
  id               text primary key,
  name             text not null,
  role             text not null default '',
  email            text not null default '',
  avatar_initials  text not null default '',
  color            text not null default '#296c00',
  created_at       timestamptz not null default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────
-- One permissive policy per table for the anon role — matches the app's
-- link-based, no-login access model. Do not put anything confidential here.
alter table posts        enable row level security;
alter table templates    enable row level security;
alter table content_bank enable row level security;
alter table assets       enable row level security;
alter table team_members enable row level security;

create policy "anon full access" on posts        for all using (true) with check (true);
create policy "anon full access" on templates    for all using (true) with check (true);
create policy "anon full access" on content_bank for all using (true) with check (true);
create policy "anon full access" on assets       for all using (true) with check (true);
create policy "anon full access" on team_members for all using (true) with check (true);

-- ─── Realtime ────────────────────────────────────────────────────────────
-- Posts change most often and are what teammates need to see live; the rest
-- change rarely enough that a normal page load is sufficient.
alter publication supabase_realtime add table posts;
