-- Function to get individual member usage for a team
CREATE OR REPLACE FUNCTION public.get_team_member_usage(p_team_id uuid, p_month_year text)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  total_tokens bigint,
  total_cost numeric,
  total_requests bigint,
  percentage numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  WITH team_total AS (
    SELECT COALESCE(SUM(mu.total_tokens), 0) as total
    FROM monthly_usage mu
    WHERE mu.user_id IN (SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id)
    AND mu.month_year = p_month_year
  )
  SELECT 
    tm.user_id,
    COALESCE(p.full_name, 'Unknown') as full_name,
    p.email,
    COALESCE(mu.total_tokens, 0)::bigint as total_tokens,
    COALESCE(mu.total_cost_usd, 0) as total_cost,
    COALESCE(mu.request_count, 0)::bigint as total_requests,
    CASE 
      WHEN tt.total > 0 THEN ROUND((COALESCE(mu.total_tokens, 0)::numeric / tt.total::numeric) * 100, 1)
      ELSE 0
    END as percentage
  FROM team_members tm
  LEFT JOIN profiles p ON p.user_id = tm.user_id
  LEFT JOIN monthly_usage mu ON mu.user_id = tm.user_id AND mu.month_year = p_month_year
  CROSS JOIN team_total tt
  WHERE tm.team_id = p_team_id
  ORDER BY COALESCE(mu.total_tokens, 0) DESC;
$$;

-- Add billing_email to teams for invoicing
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_email text;

-- Create team_billing_history table for team-level billing
CREATE TABLE IF NOT EXISTS public.team_billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_tokens bigint NOT NULL DEFAULT 0,
  total_cost_usd numeric NOT NULL DEFAULT 0,
  member_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  payment_id text,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners can view billing history" ON public.team_billing_history
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

CREATE POLICY "System can insert billing" ON public.team_billing_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update billing" ON public.team_billing_history
  FOR UPDATE WITH CHECK (true);

-- Admins can view all team billing
CREATE POLICY "Admins can view all team billing" ON public.team_billing_history
  FOR SELECT USING (has_role(auth.uid(), 'admin'));