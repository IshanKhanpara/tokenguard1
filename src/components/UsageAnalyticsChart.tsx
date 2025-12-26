import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LineChart as LineChartIcon } from 'lucide-react';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from 'date-fns';

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

const chartConfig = {
  tokens: {
    label: 'Tokens',
    color: 'hsl(var(--primary))',
  },
  cost: {
    label: 'Cost ($)',
    color: 'hsl(var(--accent))',
  },
  requests: {
    label: 'Requests',
    color: 'hsl(var(--warning))',
  },
} satisfies ChartConfig;

export function UsageAnalyticsChart() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const days = period === '7d' ? 7 : 30;

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['usage-analytics', user?.id, period],
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = startOfDay(subDays(new Date(), days - 1));
      
      const { data, error } = await supabase
        .from('usage_logs')
        .select('tokens_used, cost_usd, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Create a map for all days in the range
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      const dailyMap = new Map<string, DailyUsage>();
      
      // Initialize all days with zero values
      dateRange.forEach((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dailyMap.set(dateKey, {
          date: dateKey,
          tokens: 0,
          cost: 0,
          requests: 0,
        });
      });

      // Aggregate data by day
      data?.forEach((log) => {
        const dateKey = format(parseISO(log.created_at), 'yyyy-MM-dd');
        const existing = dailyMap.get(dateKey);
        if (existing) {
          existing.tokens += log.tokens_used || 0;
          existing.cost += log.cost_usd || 0;
          existing.requests += 1;
        }
      });

      return Array.from(dailyMap.values()).map((item) => ({
        ...item,
        displayDate: format(parseISO(item.date), period === '7d' ? 'EEE' : 'MMM d'),
        cost: Number(item.cost.toFixed(2)),
      }));
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const totalTokens = usageData?.reduce((sum, d) => sum + d.tokens, 0) || 0;
  const totalCost = usageData?.reduce((sum, d) => sum + d.cost, 0) || 0;
  const totalRequests = usageData?.reduce((sum, d) => sum + d.requests, 0) || 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-primary" />
              Usage Analytics
            </CardTitle>
            <CardDescription>
              Token consumption trends
            </CardDescription>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-primary/10">
            <p className="text-2xl font-bold text-foreground">{totalTokens.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/10">
            <p className="text-2xl font-bold text-foreground">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-warning/10">
            <p className="text-2xl font-bold text-foreground">{totalRequests}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </div>
        </div>

        {/* Chart */}
        {usageData && usageData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={usageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#tokenGradient)"
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <LineChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No usage data yet</p>
              <p className="text-sm">Connect an API key to start tracking</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}