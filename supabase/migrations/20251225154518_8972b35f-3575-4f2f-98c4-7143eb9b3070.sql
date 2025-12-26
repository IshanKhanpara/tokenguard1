-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Team',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- Create team_members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create team_invites table
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, email, status)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view their own team" ON public.teams
  FOR SELECT USING (owner_id = auth.uid() OR id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owners can update their team" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "System can create teams" ON public.teams
  FOR INSERT WITH CHECK (true);

-- Team members policies
CREATE POLICY "Team members can view their team" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "Team owners/admins can manage members" ON public.team_members
  FOR ALL USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Team invites policies
CREATE POLICY "Team owners/admins can view invites" ON public.team_invites
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Team owners/admins can create invites" ON public.team_invites
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Team owners/admins can update invites" ON public.team_invites
  FOR UPDATE USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
    OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Anyone can view invites by token" ON public.team_invites
  FOR SELECT USING (true);

-- Function to auto-create team when user upgrades to team plan
CREATE OR REPLACE FUNCTION public.handle_team_plan_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- When user upgrades to team plan, create a team for them
  IF NEW.plan = 'team' AND (OLD.plan IS NULL OR OLD.plan != 'team') THEN
    INSERT INTO public.teams (owner_id, name)
    VALUES (NEW.user_id, 'My Team')
    ON CONFLICT (owner_id) DO NOTHING;
    
    -- Add owner as team member
    INSERT INTO public.team_members (team_id, user_id, role)
    SELECT id, NEW.user_id, 'owner'
    FROM public.teams WHERE owner_id = NEW.user_id
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for team plan upgrade
CREATE TRIGGER on_team_plan_upgrade
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_plan_upgrade();

-- Add updated_at trigger for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get team's combined usage
CREATE OR REPLACE FUNCTION public.get_team_usage(p_team_id uuid, p_month_year text)
RETURNS TABLE (
  total_tokens bigint,
  total_cost numeric,
  total_requests bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
    COALESCE(SUM(total_cost_usd), 0) as total_cost,
    COALESCE(SUM(request_count), 0)::bigint as total_requests
  FROM public.monthly_usage mu
  WHERE mu.user_id IN (
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id
  )
  AND mu.month_year = p_month_year;
$$;