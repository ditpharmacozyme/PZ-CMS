-- Migration: 0010_audit_log_readonly
-- Phase 2 of the Auth rollout, part 3: nothing in the app ever updates or
-- deletes an audit_log row (src/utils/audit.ts only ever inserts and
-- selects), so this closes a "cover your tracks" hole for free -- nobody,
-- not even Owner, can alter or erase history via the API. Lowest-risk step
-- of the three; no realistic regression to test for beyond insert/select
-- still working.
--
-- ROLLBACK if needed:
--   drop policy if exists "audit_log select" on audit_log;
--   drop policy if exists "audit_log insert" on audit_log;
--   create policy "authenticated full access" on audit_log for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on audit_log;

create policy "audit_log select" on audit_log for select to authenticated using (true);
create policy "audit_log insert" on audit_log for insert to authenticated with check (true);
-- Deliberately no update/delete policy.
