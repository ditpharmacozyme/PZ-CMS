create table if not exists template_categories (
  id         uuid primary key default gen_random_uuid(),
  brand_id   text not null,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- A unique constraint can't hold an expression (lower(name)) in Postgres —
-- only a unique *index* can. This index is what the seed INSERT's
-- `on conflict (brand_id, lower(name))` resolves against.
create unique index if not exists template_categories_brand_lower_name_idx
  on template_categories (brand_id, lower(name));

alter table template_categories enable row level security;
drop policy if exists "tcat authenticated read"  on template_categories;
create policy "tcat authenticated read"  on template_categories for select to authenticated using (true);
drop policy if exists "tcat authenticated write" on template_categories;
create policy "tcat authenticated write" on template_categories for all    to authenticated using (true) with check (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'template_categories'
  ) then
    alter publication supabase_realtime add table template_categories;
  end if;
end $$;

insert into template_categories (brand_id, name, sort_order)
select scope, cat.name, cat.ord
from (values ('shared'),('pharmacozyme'),('pz-academy'),('med-q'),('pillz'),('prescriptionz')) as s(scope)
cross join (values ('Clinical',0),('Interactive',1),('Editorial',2),('Patient-Facing',3),('Internal',4)) as cat(name, ord)
on conflict (brand_id, lower(name)) do nothing;
