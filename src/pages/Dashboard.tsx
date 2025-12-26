import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, useCurrentPlanLimits, useMonthlyUsage, useApiKeys, ApiKey } from '@/hooks/useSubscription';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, Key, Plus, BarChart3, 
  AlertTriangle, Zap, Users, CreditCard, Receipt, History
} from 'lucide-react';
import { AddApiKeyDialog } from '@/components/AddApiKeyDialog';
import { ApiKeyCard } from '@/components/ApiKeyCard';
import { UsageAnalyticsChart } from '@/components/UsageAnalyticsChart';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: planLimits, isLoading: limitsLoading } = useCurrentPlanLimits();
  const { data: monthlyUsage, isLoading: usageLoading } = useMonthlyUsage();
  const { data: apiKeys, isLoading: keysLoading, refetch: refetchKeys } = useApiKeys();
  
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const isLoading = subLoading || limitsLoading || usageLoading || keysLoading;
  
  const tokensUsed = monthlyUsage?.total_tokens || 0;
  const tokenLimit = planLimits?.max_tokens_per_month || 100000;
  const usagePercent = Math.min((tokensUsed / tokenLimit) * 100, 100);
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  const planLabel = subscription?.plan?.toUpperCase() || 'FREE';
  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'gradient-primary text-primary-foreground',
    team: 'gradient-accent text-accent-foreground',
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Usage Overview */}
            <Card className="lg:col-span-2 border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Monthly Usage
                    </CardTitle>
                    <CardDescription>
                      Token consumption for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/usage-history')}>
                      <History className="w-4 h-4 mr-1" />
                      View History
                    </Button>
                    {isNearLimit && !isAtLimit && (
                      <Badge variant="outline" className="border-warning text-warning">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        80% Used
                      </Badge>
                    )}
                    {isAtLimit && (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Limit Reached
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Tokens Used</span>
                      <span className="font-medium">
                        {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}
                      </span>
                    </div>
                    <Progress 
                      value={usagePercent} 
                      className={`h-3 ${isNearLimit ? '[&>div]:bg-warning' : ''} ${isAtLimit ? '[&>div]:bg-destructive' : ''}`}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">
                        {monthlyUsage?.request_count || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Requests</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">
                        ${(monthlyUsage?.total_cost_usd || 0).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">API Cost</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">
                        {apiKeys?.length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">API Keys</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">
                        {Math.round(100 - usagePercent)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Card */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Your Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 rounded-xl gradient-primary text-primary-foreground">
                  <p className="text-3xl font-bold">{planLabel}</p>
                  <p className="text-sm opacity-90">
                    ${planLimits?.price_usd || 0}/month
                  </p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span>{planLimits?.max_api_keys || 1} API Keys</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{planLimits?.max_team_members || 1} Team Members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span>{planLimits?.has_advanced_analytics ? 'Advanced' : 'Basic'} Analytics</span>
                  </div>
                </div>
                
                {subscription?.plan === 'free' && (
                  <Button 
                    className="w-full gradient-primary"
                    onClick={() => navigate('/pricing')}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}
                
                {subscription?.plan !== 'free' && (
                  <div className="space-y-2">
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/billing')}
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      Billing History
                    </Button>
                    {subscription?.plan === 'team' && (
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/team')}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Manage Team
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Analytics Chart */}
            <div className="lg:col-span-3">
              <UsageAnalyticsChart />
            </div>

            {/* API Keys Section */}
            <Card className="lg:col-span-3 border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary" />
                      API Keys
                    </CardTitle>
                    <CardDescription>
                      Connect your AI API keys to start tracking usage
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddKeyDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {apiKeys && apiKeys.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {apiKeys.map((key: ApiKey) => (
                      <ApiKeyCard key={key.id} apiKey={key} onDelete={refetchKeys} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No API keys connected</p>
                    <p className="text-sm">Add your first API key to start tracking usage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AddApiKeyDialog 
        open={showAddKeyDialog} 
        onOpenChange={setShowAddKeyDialog}
        onSuccess={refetchKeys}
      />
    </Layout>
  );
}
