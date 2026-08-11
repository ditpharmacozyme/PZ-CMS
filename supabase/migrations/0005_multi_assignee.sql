-- Migration: 0005_multi_assignee
-- Posts can now be assigned to more than one person. Adds the new array
-- column and backfills it from the old single-value column; the old
-- `assignee` column is left in place (unused, not dropped) so this stays
-- reversible — no destructive step.

alter table posts add column if not exists assignees text[] default '{}';

update posts
set assignees = array[assignee]
where (assignees is null or assignees = '{}') and assignee is not null and assignee <> '';
