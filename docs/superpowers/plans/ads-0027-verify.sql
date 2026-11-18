-- Verification queries for migration 0027_ads_library.sql.
-- Run AFTER applying the migration, in the Supabase SQL editor (one block at a time).
-- Test rows use ids/tokens prefixed 'verify-' and are removed in the cleanup block.

-- ============================================================
-- 0. Setup: test fixtures (run as postgres / service role)
-- ============================================================
insert into ad_programs (id, name) values ('verify-prog', 'VERIFY program');
insert into ad_sets (id, program_id, name, hidden) values ('verify-set', 'verify-prog', 'VERIFY hidden set', true);
insert into ad_creatives (id, set_id, name, created_at, uploaded_by) values ('verify-cr', 'verify-set', 'VERIFY creative', now(), 'secret@example.com');
update ad_creatives set uploaded_by = 'secret@example.com' where id = 'verify-cr';
update ad_programs set created_by = 'secret@example.com' where id = 'verify-prog';
insert into ad_share_links (token, level, target_id) values ('verify-token', 'creative', 'verify-cr');

-- ============================================================
-- 1. anon has no direct table access
-- ============================================================
set role anon;
select * from ad_creatives;
-- EXPECT: permission denied for table ad_creatives, OR zero rows. Never any data.
select * from ad_share_links;
-- EXPECT: permission denied OR zero rows.

-- 2. anon can call the public RPC
select ads_public_library();
-- EXPECT: one jsonb object with keys programs, sets, creatives (all arrays).
-- EXPECT: it does NOT contain 'verify-set' or 'verify-cr' (hidden set).
-- EXPECT: it contains the 'ads-unsorted' set. Verify:
select ads_public_library() -> 'sets' @> '[{"id":"ads-unsorted"}]'::jsonb as has_unsorted;
-- EXPECT: true
select ads_public_library()::text like '%verify-%' as leaks_hidden;
-- EXPECT: false

-- 3. share-link scope returns the hidden creative (ignores hidden)
select ads_shared_scope('verify-token');
-- EXPECT: creatives array contains id 'verify-cr'; sets array contains 'verify-set';
--         programs array is empty (creative-level link).

-- 4. stripped keys
select (ads_shared_scope('verify-token')::text like '%created_by%'
     or ads_shared_scope('verify-token')::text like '%uploaded_by%'
     or ads_shared_scope('verify-token')::text like '%secret@example.com%') as leaks_author;
-- EXPECT: false
select (ads_public_library()::text like '%created_by%'
     or ads_public_library()::text like '%uploaded_by%') as leaks_author_public;
-- EXPECT: false

reset role;

-- 5. program-level link returns program + sets + creatives (even hidden)
insert into ad_share_links (token, level, target_id) values ('verify-token-prog', 'program', 'verify-prog');
set role anon;
select jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'programs')  as programs,
       jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'sets')      as sets,
       jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'creatives') as creatives;
-- EXPECT: 1, 1, 1
reset role;

-- 6. revoke: revoked token behaves like an unknown token
update ad_share_links set revoked_at = now() where token = 'verify-token';
set role anon;
select ads_shared_scope('verify-token') = ads_shared_scope('nonexistent') as revoked_equals_unknown;
-- EXPECT: true
select ads_shared_scope('nonexistent');
-- EXPECT: {"sets": [], "programs": [], "creatives": []}
reset role;

-- 7. function attributes
select proname, prosecdef as security_definer, provolatile as volatility, proconfig
from pg_proc
where proname in ('ads_public_library', 'ads_shared_scope');
-- EXPECT: both rows: security_definer = true, volatility = 's' (stable), proconfig = {search_path=public}

-- 8. seeds
select name, sort_order from ad_audiences order by sort_order;
-- EXPECT: Doctors, Nurses, Pharmacists, Students, All healthcare professionals (0..4)
select id, name, is_system from ad_sets where id = 'ads-unsorted';
-- EXPECT: one row, is_system = true

-- ============================================================
-- 9. Cleanup (run as postgres / service role)
-- ============================================================
delete from ad_share_links where token like 'verify-%';
delete from ad_creatives   where id like 'verify-%';
delete from ad_sets        where id like 'verify-%';
delete from ad_programs    where id like 'verify-%';
