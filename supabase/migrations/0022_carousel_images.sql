alter table posts add column if not exists images jsonb not null default '[]'::jsonb;
alter table templates add column if not exists images jsonb not null default '[]'::jsonb;

-- Backfill existing single-image rows so images[0] already equals the old cover.
update posts set images = jsonb_build_array(visual_url)
  where images = '[]'::jsonb and coalesce(visual_url, '') <> '';

update templates set images = jsonb_build_array(image_preview)
  where images = '[]'::jsonb and coalesce(image_preview, '') <> '';
