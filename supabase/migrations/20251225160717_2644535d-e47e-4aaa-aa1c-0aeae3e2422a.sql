-- Add spending limits to team_members
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS monthly_spending_limit numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spending_alert_threshold integer DEFAULT 80;

-- Create table to track spending alerts sent
CREATE TABLE IF NOT EXISTS public.spending_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  threshold_reached integer NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('warning', 'limit_reached')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id, month_year, threshold_reached)
);

ALTER TABLE public.spending_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners can view alerts" ON public.spending_alerts
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "System can manage alerts" ON public.spending_alerts
  FOR ALL WITH CHECK (true);

-- Add stripe_customer_id and stripe_subscription_id to teams
ALTER TABLE public.teams 
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Function to check member spending limits
CREATE OR REPLACE FUNCTION public.check_member_spending_limit(p_user_id uuid, p_team_id uuid, p_month_year text)
RETURNS TABLE (
  has_limit boolean,
  spending_limit numeric,
  current_spending numeric,
  percentage_used numeric,
  is_over_limit boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    tm.monthly_spending_limit IS NOT NULL as has_limit,
    COALESCE(tm.monthly_spending_limit, 0) as spending_limit,
    COALESCE(mu.total_cost_usd, 0) as current_spending,
    CASE 
      WHEN tm.monthly_spending_limit IS NOT NULL AND tm.monthly_spending_limit > 0 
      THEN ROUND((COALESCE(mu.total_cost_usd, 0) / tm.monthly_spending_limit) * 100, 1)
      ELSE 0
    END as percentage_used,
    CASE 
      WHEN tm.monthly_spending_limit IS NOT NULL 
      THEN COALESCE(mu.total_cost_usd, 0) >= tm.monthly_spending_limit
      ELSE false
    END as is_over_limit
  FROM team_members tm
  LEFT JOIN monthly_usage mu ON mu.user_id = tm.user_id AND mu.month_year = p_month_year
  WHERE tm.team_id = p_team_id AND tm.user_id = p_user_id;
$$;