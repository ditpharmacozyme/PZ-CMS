-- Migration: Rename Owner role to Admin
-- Updates any existing team_members that have the 'Owner' user_role to 'Admin'

UPDATE public.team_members
SET user_role = 'Admin'
WHERE user_role = 'Owner';

-- Also update the enforce_team_role_change trigger function to check for Admin instead of Owner
CREATE OR REPLACE FUNCTION public.enforce_team_role_change()
RETURNS trigger AS $$
DECLARE
  current_user_email text;
  current_user_role text;
  admin_count int;
BEGIN
  -- Get the current authenticated user's email
  current_user_email := auth.email();

  -- Look up their role in the team_members table
  SELECT user_role INTO current_user_role
  FROM public.team_members
  WHERE email = current_user_email
  LIMIT 1;

  -- 1. Must be Admin or Manager to modify roles at all
  IF current_user_role NOT IN ('Admin', 'Manager') THEN
    RAISE EXCEPTION 'Permission denied: Only Admin or Manager can modify team members';
  END IF;

  -- 2. If trying to grant Admin, caller must be Admin
  IF NEW.user_role = 'Admin' AND current_user_role != 'Admin' THEN
    RAISE EXCEPTION 'Permission denied: Only Admin can grant Admin role';
  END IF;

  -- 3. If demoting or modifying an existing Admin
  IF TG_OP = 'UPDATE' AND OLD.user_role = 'Admin' THEN
    -- Only Admin can modify another Admin
    IF current_user_role != 'Admin' THEN
      RAISE EXCEPTION 'Permission denied: Only Admin can modify an Admin';
    END IF;

    -- If they are demoting an Admin, ensure it's not the LAST Admin
    IF NEW.user_role != 'Admin' THEN
      SELECT count(*) INTO admin_count FROM public.team_members WHERE user_role = 'Admin';
      IF admin_count <= 1 THEN
        RAISE EXCEPTION 'Permission denied: Cannot demote the last Admin';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- And update the prevent_last_owner_deletion trigger function
CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS trigger AS $$
DECLARE
  admin_count int;
BEGIN
  IF OLD.user_role = 'Admin' THEN
    SELECT count(*) INTO admin_count FROM public.team_members WHERE user_role = 'Admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Permission denied: Cannot delete the last Admin';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger, create new one
DROP TRIGGER IF EXISTS ensure_one_owner_remains ON public.team_members;
DROP TRIGGER IF EXISTS ensure_one_admin_remains ON public.team_members;

CREATE TRIGGER ensure_one_admin_remains
  BEFORE DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_deletion();
