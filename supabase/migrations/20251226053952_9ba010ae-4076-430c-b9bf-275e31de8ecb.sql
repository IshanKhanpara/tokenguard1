-- Fix 1: Remove public read access from system_settings
-- Drop the overly permissive policy that allows anyone to read settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.system_settings;

-- Create a new policy that only allows authenticated users to read non-sensitive settings
-- Admins can read all settings (already covered by existing admin policy)
CREATE POLICY "Authenticated users can read non-sensitive settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  -- Only allow reading non-sensitive keys
  key IN ('support_email', 'maintenance_mode', 'app_version')
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Remove the overly permissive team_invites policy
DROP POLICY IF EXISTS "Anyone can view invites by token" ON public.team_invites;

-- Create a restrictive policy that requires authentication and email match
-- Users can only view invites sent to their email address
CREATE POLICY "Users can view invites for their email"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  -- This policy doesn't apply to system_settings, fixing below
  true
);

-- Actually drop and recreate for team_invites
DROP POLICY IF EXISTS "Users can view invites for their email" ON public.system_settings;

-- For team_invites: authenticated users can only see invites to their own email
CREATE POLICY "Authenticated users can view their own invites"
ON public.team_invites
FOR SELECT
TO authenticated
USING (
  -- Users can see invites sent to their email (checked via their profile)
  email = (SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  -- Or if they're team owners/admins (covered by existing policy, but include for clarity)
  OR team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);