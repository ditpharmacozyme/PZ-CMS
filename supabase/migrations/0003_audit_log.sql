-- Migration: 0003_audit_log
-- Creates a global audit log table that records all significant actions in the studio.

create table if not exists audit_log (
  id            text primary key,
  actor_id      text,                            -- team_members.id (nullable: pre-login system events)
  actor_name    text not null,                   -- denormalized so history survives member deletion
  action_type   text not null,                   -- e.g. 'post_created', 'login', 'post_deleted'
  entity_type   text,                            -- 'post' | 'member' | 'template' | 'asset' | 'content_bank' | 'session'
  entity_id     text,                            -- ID of the affected record
  entity_title  text,                            -- denormalized title/name for readable display
  before_value  jsonb,                           -- snapshot of fields BEFORE the change
  after_value   jsonb,                           -- snapshot of fields AFTER the change
  session_id    text,                            -- groups events per login session
  created_at    timestamptz default now() not null
);

-- Indexes for common filter queries
create index if not exists idx_audit_log_actor_id    on audit_log(actor_id);
create index if not exists idx_audit_log_action_type on audit_log(action_type);
create index if not exists idx_audit_log_entity_id   on audit_log(entity_id);
create index if not exists idx_audit_log_created_at  on audit_log(created_at desc);

-- Enable RLS with open anon policy (same pattern as all other tables)
alter table audit_log enable row level security;

create policy "anon full access" on audit_log
  for all
  using (true)
  with check (true);
