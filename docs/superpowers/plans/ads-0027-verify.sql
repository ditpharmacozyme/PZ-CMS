-- Verification queries for migration 0027_ads_library.sql.
-- Run AFTER applying the migration, in the Supabase SQL editor (one block at a time).
-- Test rows use ids/tokens prefixed 'verify-' and are removed in the cleanup block.

-- ============================================================
-- 0. Setup: test fixtures (run as postgres / service role)
-- ============================================================
-- A) visible program, with a HIDDEN set (holding a creative) and a VISIBLE set
--    (holding one hidden creative and one visible creative).
insert into ad_programs (id, name, created_by, drive_folder_id) values ('verify-prog', 'VERIFY program', 'secret@example.com', 'secret-folder');
insert into ad_sets (id, program_id, name, hidden, created_by, drive_folder_id) values
  ('verify-set',  'verify-prog', 'VERIFY hidden set',  true,  'secret@example.com', 'secret-folder'),
  ('verify-vset', 'verify-prog', 'VERIFY visible set', false, 'secret@example.com', 'secret-folder');
insert into ad_creatives (id, set_id, name, hidden, uploaded_by, source_url) values
  ('verify-cr',   'verify-set',  'VERIFY creative in hidden set', false, 'secret@example.com', 'https://www.canva.com/design/secret-source'),
  ('verify-hcr',  'verify-vset', 'VERIFY hidden creative',        true,  'secret@example.com', 'https://www.canva.com/design/secret-source'),
  ('verify-vcr',  'verify-vset', 'VERIFY visible creative',       false, 'secret@example.com', 'https://www.canva.com/design/secret-source');
-- B) HIDDEN program whose set (and its creative) are themselves not hidden.
insert into ad_programs (id, name, hidden) values ('verify-hprog', 'VERIFY hidden program', true);
insert into ad_sets (id, program_id, name, hidden) values ('verify-hset', 'verify-hprog', 'VERIFY set under hidden program', false);
insert into ad_creatives (id, set_id, name, hidden) values ('verify-hpcr', 'verify-hset', 'VERIFY creative under hidden program', false);
-- Share links.
insert into ad_share_links (token, level, target_id) values
  ('verify-token',        'creative', 'verify-cr'),
  ('verify-token-prog',   'program',  'verify-prog'),
  ('verify-token-hprog',  'program',  'verify-hprog'),
  ('verify-token-hset',   'set',      'verify-hset'),
  ('verify-token-hcr',    'creative', 'verify-hcr');

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
select ads_public_library() -> 'sets' @> '[{"id":"ads-unsorted"}]'::jsonb as has_unsorted;
-- EXPECT: true
select ads_public_library() -> 'programs' @> '[{"id":"verify-prog"}]'::jsonb as has_visible_program;
-- EXPECT: true
select ads_public_library() -> 'sets' @> '[{"id":"verify-vset"}]'::jsonb as has_visible_set;
-- EXPECT: true
select ads_public_library() -> 'creatives' @> '[{"id":"verify-vcr"}]'::jsonb as has_visible_creative;
-- EXPECT: true

-- 2b. hiding rules (each EXPECT: false)
select ads_public_library() -> 'sets' @> '[{"id":"verify-set"}]'::jsonb as leaks_hidden_set;
-- EXPECT: false
select ads_public_library() -> 'creatives' @> '[{"id":"verify-cr"}]'::jsonb as leaks_creative_of_hidden_set;
-- EXPECT: false
select ads_public_library() -> 'creatives' @> '[{"id":"verify-hcr"}]'::jsonb as leaks_hidden_creative;
-- EXPECT: false
select ads_public_library() -> 'programs' @> '[{"id":"verify-hprog"}]'::jsonb as leaks_hidden_program;
-- EXPECT: false
select ads_public_library() -> 'sets' @> '[{"id":"verify-hset"}]'::jsonb as leaks_set_of_hidden_program;
-- EXPECT: false
select ads_public_library() -> 'creatives' @> '[{"id":"verify-hpcr"}]'::jsonb as leaks_creative_of_hidden_program;
-- EXPECT: false

-- 3. share-link scope returns the hidden creative (ignores hidden)
select ads_shared_scope('verify-token');
-- EXPECT: creatives array contains id 'verify-cr'; sets array contains 'verify-set';
--         programs array is empty (creative-level link).

-- 3b. hidden program: set and creative reachable through their own links
select ads_shared_scope('verify-token-hprog');
-- EXPECT: programs = [verify-hprog], sets = [verify-hset], creatives = [verify-hpcr]
select ads_shared_scope('verify-token-hset');
-- EXPECT: programs = [], sets = [verify-hset], creatives = [verify-hpcr]

-- 3c. hidden creative in a visible set, reachable by its own link
select ads_shared_scope('verify-token-hcr');
-- EXPECT: programs = [], sets = [verify-vset], creatives = [verify-hcr]

-- 4. stripped keys and values
select (ads_shared_scope('verify-token')::text like '%created_by%'
     or ads_shared_scope('verify-token')::text like '%uploaded_by%'
     or ads_shared_scope('verify-token')::text like '%drive_folder_id%'
     or ads_shared_scope('verify-token')::text like '%secret@example.com%'
     or ads_shared_scope('verify-token')::text like '%secret-folder%'
     or ads_shared_scope('verify-token')::text like '%source_url%'
     or ads_shared_scope('verify-token')::text like '%secret-source%') as leaks_author_shared;
-- EXPECT: false
select (ads_public_library()::text like '%created_by%'
     or ads_public_library()::text like '%uploaded_by%'
     or ads_public_library()::text like '%drive_folder_id%'
     or ads_public_library()::text like '%secret@example.com%'
     or ads_public_library()::text like '%secret-folder%'
     or ads_public_library()::text like '%source_url%'
     or ads_public_library()::text like '%secret-source%') as leaks_author_public;
-- EXPECT: false

-- 5. program-level link returns program + sets + creatives (even hidden)
select jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'programs')  as programs,
       jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'sets')      as sets,
       jsonb_array_length(ads_shared_scope('verify-token-prog') -> 'creatives') as creatives;
-- EXPECT: 1, 2, 3  (verify-prog; verify-set + verify-vset; verify-cr + verify-hcr + verify-vcr)
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
-- EXPECT: both rows: security_definer = true, volatility = 's' (stable), proconfig = {search_path=""}

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
