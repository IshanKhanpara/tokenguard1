import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'team';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanLimits {
  id: string;
  plan: 'free' | 'pro' | 'team';
  max_tokens_per_month: number;
  max_api_keys: number;
  max_team_members: number;
  has_api_access: boolean;
  has_advanced_analytics: boolean;
  has_audit_logs: boolean;
  has_sso: boolean;
  has_priority_support: boolean;
  price_usd: number;
}

export interface MonthlyUsage {
  id: string;
  user_id: string;
  month_year: string;
  total_tokens: number;
  total_cost_usd: number;
  request_count: number;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  provider: string;
  key_hint: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!user,
  });
}

export function usePlanLimits(plan?: 'free' | 'pro' | 'team') {
  return useQuery({
    queryKey: ['plan-limits', plan],
    queryFn: async () => {
      const query = supabase.from('plan_limits').select('*');
      if (plan) {
        query.eq('plan', plan);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PlanLimits[];
    },
  });
}

export function useCurrentPlanLimits() {
  const { data: subscription } = useSubscription();
  
  return useQuery({
    queryKey: ['current-plan-limits', subscription?.plan],
    queryFn: async () => {
      if (!subscription) return null;
      const { data, error } = await supabase
        .from('plan_limits')
        .select('*')
        .eq('plan', subscription.plan)
        .single();
      
      if (error) throw error;
      return data as PlanLimits;
    },
    enabled: !!subscription,
  });
}

export function useMonthlyUsage() {
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  return useQuery({
    queryKey: ['monthly-usage', user?.id, currentMonth],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('monthly_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as MonthlyUsage | null;
    },
    enabled: !!user,
  });
}

export function useApiKeys() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['api-keys', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, user_id, name, provider, key_hint, is_active, last_used_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!user,
  });
}
