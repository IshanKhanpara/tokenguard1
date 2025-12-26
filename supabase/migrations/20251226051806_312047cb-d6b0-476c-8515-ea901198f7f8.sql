-- Fix get_team_usage to include authorization check
CREATE OR REPLACE FUNCTION public.get_team_usage(p_team_id uuid, p_month_year text)
 RETURNS TABLE(total_tokens bigint, total_cost numeric, total_requests bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
    COALESCE(SUM(total_cost_usd), 0) as total_cost,
    COALESCE(SUM(request_count), 0)::bigint as total_requests
  FROM public.monthly_usage mu
  WHERE mu.user_id IN (
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id
  )
  AND mu.month_year = p_month_year
  -- Authorization: Only return data if caller is a member of the team or team owner
  AND EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
    UNION
    SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid()
  );
$$;

-- Fix get_team_member_usage to include authorization check
CREATE OR REPLACE FUNCTION public.get_team_member_usage(p_team_id uuid, p_month_year text)
 RETURNS TABLE(user_id uuid, full_name text, email text, total_tokens bigint, total_cost numeric, total_requests bigint, percentage numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH auth_check AS (
    -- Verify caller is authorized to view this team's data
    SELECT 1 WHERE EXISTS (
      SELECT 1 FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
      UNION
      SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid()
    )
  ),
  team_total AS (
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
  CROSS JOIN auth_check  -- This will return no rows if auth check fails
  WHERE tm.team_id = p_team_id
  ORDER BY COALESCE(mu.total_tokens, 0) DESC;
$$;

-- Fix check_member_spending_limit to include authorization check
CREATE OR REPLACE FUNCTION public.check_member_spending_limit(p_user_id uuid, p_team_id uuid, p_month_year text)
 RETURNS TABLE(has_limit boolean, spending_limit numeric, current_spending numeric, percentage_used numeric, is_over_limit boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
  WHERE tm.team_id = p_team_id AND tm.user_id = p_user_id
  -- Authorization: Only return data if caller is a member of the team, team owner, or checking their own limit
  AND (
    auth.uid() = p_user_id
    OR EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = p_team_id AND tm2.user_id = auth.uid() AND tm2.role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid())
  );
$$;