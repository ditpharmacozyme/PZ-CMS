-- Migration: Add task_roles and stage_completion JSONB columns to posts
-- These power the multi-person workflow tracking feature (Designer / Publisher / Engagement Lead)

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS task_roles       jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stage_completion jsonb DEFAULT NULL;

COMMENT ON COLUMN public.posts.task_roles IS
  'Specialized handoff roles: { designer, publisher, engagementLead }';

COMMENT ON COLUMN public.posts.stage_completion IS
  'Stage completion flags with timestamps: { designDone, designDoneAt, designDoneBy, publishDone, publishDoneAt, publishDoneBy, engagementDone, engagementDoneAt, engagementDoneBy }';
