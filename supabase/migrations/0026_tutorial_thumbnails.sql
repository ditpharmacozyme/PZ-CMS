-- Add custom thumbnail support to tutorials library
alter table if exists tutorials add column if not exists thumbnail_url text;
alter table if exists tutorials add column if not exists thumbnail_storage_path text;
