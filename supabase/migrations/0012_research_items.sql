-- Migration: 0012_research_items
-- Research & Plans module: team members plan/research with external AI
-- (ChatGPT, Claude), export in a fixed CSV/Markdown format, and upload here.
-- The file itself lives on Google Drive (via the Apps Script web app); this
-- table stores the metadata + Drive pointer + parsed content for fast
-- in-app rendering. See research-plans-feature-spec.md for the full spec.
--
-- `id` is `text` (client-generated `res-${Date.now()}`), not `uuid`,
-- matching every other table in this app (posts, templates, content_bank,
-- team_members) -- inserts are optimistic (local state first, then pushed),
-- which a DB-side uuid default would fight against.
--
-- `date` is written as `item_date` -- a bare `date` column name collides
-- with the SQL keyword and every other table's date columns already avoid
-- it (posts.scheduled_date, content_bank.saved_date).

create table if not exists research_items (
  id              text primary key,
  brand           text not null,          -- BrandId | 'shared'
  type            text not null,          -- calendar | research | plan | brief | notes
  title           text not null,
  owner           text not null,          -- team_members.name, matching posts.assignees convention
  item_date       date,
  tags            text[] not null default '{}',
  drive_file_id   text not null,
  drive_view_url  text not null,
  file_type       text not null,          -- csv | xlsx | md | docx | pdf
  parsed_metadata jsonb,
  uploaded_by     text,                   -- team_members.id, for display only
  created_at      timestamptz not null default now()
);

create index if not exists research_items_brand_idx on research_items (brand);
create index if not exists research_items_type_idx  on research_items (type);
create index if not exists research_items_date_idx  on research_items (item_date desc);

-- Same access model as templates/assets/content_bank (migration 0007): any
-- authenticated user can read and write. Uploads are meant to be instantly
-- visible to the whole team with no approval gate, per the spec.
alter table research_items enable row level security;

create policy "authenticated full access" on research_items
  for all to authenticated using (true) with check (true);

-- So uploads appear for the whole team live, matching the spec's "instantly
-- visible to whole team" requirement (same reasoning as posts in 0001_init.sql).
alter publication supabase_realtime add table research_items;
