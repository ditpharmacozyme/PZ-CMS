-- Migration: 0004_team_roles
-- Adds the RBAC permission level to team_members. Deliberately does NOT add a
-- passcode column: this table uses the same open anon-read policy as every
-- other table (see 0001_init.sql's "Do not put anything confidential here"),
-- so anything stored here is effectively public. Login PINs stay local-only
-- (localStorage) — see mergeLocalPasscodes in src/App.tsx.

alter table team_members add column if not exists user_role text not null default 'Editor';
