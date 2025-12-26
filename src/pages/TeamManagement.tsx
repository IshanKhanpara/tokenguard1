import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Users, UserPlus, Crown, Shield, User, 
  Trash2, Mail, Clock, ArrowLeft, BarChart3, Zap,
  CreditCard, Receipt, TrendingUp, PieChart, DollarSign
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  monthly_spending_limit: number | null;
  spending_alert_threshold: number;
  profiles: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface TeamInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Team {
  id: string;
  name: string;
  owner_id: string;
  billing_email: string | null;
  created_at: string;
}

interface MemberUsage {
  user_id: string;
  full_name: string;
  email: string;
  total_tokens: number;
  total_cost: number;
  total_requests: number;
  percentage: number;
}

interface TeamBilling {
  id: string;
  period_start: string;
  period_end: string;
  total_tokens: number;
  total_cost_usd: number;
  member_count: number;
  status: string;
  invoice_url: string | null;
  created_at: string;
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: subscription } = useSubscription();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [spendingLimit, setSpendingLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [activeTab, setActiveTab] = useState('overview');

  const isTeamPlan = subscription?.plan === 'team';
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Fetch team data
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as Team | null;
    },
    enabled: !!user && isTeamPlan,
  });

  // Fetch team members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', team?.id],
    queryFn: async () => {
      if (!team) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          monthly_spending_limit,
          spending_alert_threshold,
          profiles:user_id (full_name, email, avatar_url)
        `)
        .eq('team_id', team.id)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data as unknown as TeamMember[];
    },
    enabled: !!team,
  });

  // Fetch pending invites
  const { data: invites } = useQuery({
    queryKey: ['team-invites', team?.id],
    queryFn: async () => {
      if (!team) return [];
      const { data, error } = await supabase
        .from('team_invites')
        .select('*')
        .eq('team_id', team.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TeamInvite[];
    },
    enabled: !!team,
  });

  // Fetch team usage
  const { data: teamUsage } = useQuery({
    queryKey: ['team-usage', team?.id, currentMonth],
    queryFn: async () => {
      if (!team) return null;
      const { data, error } = await supabase.rpc('get_team_usage', {
        p_team_id: team.id,
        p_month_year: currentMonth,
      });
      if (error) throw error;
      return data?.[0] || { total_tokens: 0, total_cost: 0, total_requests: 0 };
    },
    enabled: !!team,
  });

  // Fetch per-member usage
  const { data: memberUsage } = useQuery({
    queryKey: ['team-member-usage', team?.id, currentMonth],
    queryFn: async () => {
      if (!team) return [];
      const { data, error } = await supabase.rpc('get_team_member_usage', {
        p_team_id: team.id,
        p_month_year: currentMonth,
      });
      if (error) throw error;
      return data as MemberUsage[];
    },
    enabled: !!team,
  });

  // Fetch team billing history
  const { data: billingHistory } = useQuery({
    queryKey: ['team-billing', team?.id],
    queryFn: async () => {
      if (!team) return [];
      const { data, error } = await supabase
        .from('team_billing_history')
        .select('*')
        .eq('team_id', team.id)
        .order('period_start', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as TeamBilling[];
    },
    enabled: !!team,
  });

  // Send invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'send', email, role },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Invitation Sent', description: `Invitation sent to ${inviteEmail}` });
      setInviteEmail('');
      setShowInviteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'remove_member', memberId, teamId: team?.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Member Removed' });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-member-usage'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'update_role', memberId, role, teamId: team?.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Role Updated' });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  // Update spending limit mutation
  const updateSpendingLimitMutation = useMutation({
    mutationFn: async ({ memberId, limit, threshold }: { memberId: string; limit: number | null; threshold: number }) => {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { 
          action: 'update_spending_limit', 
          memberId, 
          teamId: team?.id,
          spendingLimit: limit,
          alertThreshold: threshold,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Spending Limit Updated' });
      setShowLimitDialog(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const openSpendingLimitDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setSpendingLimit(member.monthly_spending_limit?.toString() || '');
    setAlertThreshold((member.spending_alert_threshold || 80).toString());
    setShowLimitDialog(true);
  };

  const handleSaveSpendingLimit = () => {
    if (!selectedMember) return;
    const limit = spendingLimit ? parseFloat(spendingLimit) : null;
    const threshold = parseInt(alertThreshold) || 80;
    updateSpendingLimitMutation.mutate({ 
      memberId: selectedMember.id, 
      limit,
      threshold,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 50) return 'bg-primary';
    if (percentage >= 25) return 'bg-blue-500';
    if (percentage >= 10) return 'bg-green-500';
    return 'bg-muted-foreground';
  };

  const maxTokens = 5000000; // Team plan limit
  const usagePercent = teamUsage ? Math.min((teamUsage.total_tokens / maxTokens) * 100, 100) : 0;
  const planCost = 49; // Team plan monthly cost
  const estimatedBill = planCost + (teamUsage?.total_cost || 0);

  if (authLoading || teamLoading) {
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

  if (!isTeamPlan) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto border-0 shadow-lg">
            <CardContent className="pt-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-bold mb-2">Team Plan Required</h2>
              <p className="text-muted-foreground mb-6">
                Upgrade to the Team plan to invite members and collaborate with your team.
              </p>
              <Button onClick={() => navigate('/pricing')} className="gradient-primary">
                View Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Team Management
            </h1>
            <p className="text-muted-foreground">{team?.name || 'My Team'}</p>
          </div>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your team. They'll receive an email with a link to accept.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member - Can use API keys</SelectItem>
                      <SelectItem value="admin">Admin - Can manage team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => sendInviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                    disabled={!inviteEmail || sendInviteMutation.isPending}
                  >
                    {sendInviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Invitation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Team Usage Overview */}
              <Card className="lg:col-span-2 border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Team Usage This Month
                  </CardTitle>
                  <CardDescription>Combined usage across all team members</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Tokens Used</span>
                        <span className="font-medium">
                          {(teamUsage?.total_tokens || 0).toLocaleString()} / {maxTokens.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={usagePercent} className="h-3" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center p-4 rounded-lg bg-secondary/50">
                        <Zap className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <p className="text-xl font-bold">{(teamUsage?.total_tokens || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Tokens</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-secondary/50">
                        <DollarSign className="w-5 h-5 mx-auto mb-2 text-green-500" />
                        <p className="text-xl font-bold">${(teamUsage?.total_cost || 0).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">API Cost</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-secondary/50">
                        <TrendingUp className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                        <p className="text-xl font-bold">{teamUsage?.total_requests || 0}</p>
                        <p className="text-sm text-muted-foreground">Requests</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Stats */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Team Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-bold">{members?.length || 0} / 5</span>
                  </div>
                  <Progress value={((members?.length || 0) / 5) * 100} className="h-2" />
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground">Pending Invites</span>
                    <Badge variant="secondary">{invites?.length || 0}</Badge>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Est. Monthly Bill</span>
                      <span className="font-bold text-lg">${estimatedBill.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      $49 plan + ${(teamUsage?.total_cost || 0).toFixed(2)} API usage
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Member Usage Preview */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Member Contribution
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('usage')}>
                    View Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {memberUsage?.slice(0, 5).map((member) => (
                    <div key={member.user_id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                        {member.full_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{member.full_name}</span>
                          <span className="text-sm text-muted-foreground">{member.percentage}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getUsageColor(member.percentage)} transition-all`}
                            style={{ width: `${Math.max(member.percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Spending Limit</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members?.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                {getRoleIcon(member.role)}
                              </div>
                              <div>
                                <p className="font-medium">{member.profiles?.full_name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {member.role === 'owner' ? (
                              <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                                Owner
                              </Badge>
                            ) : member.user_id !== user.id ? (
                              <Select
                                value={member.role}
                                onValueChange={(role) => updateRoleMutation.mutate({ memberId: member.id, role })}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">{member.role}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.role !== 'owner' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => openSpendingLimitDialog(member)}
                              >
                                {member.monthly_spending_limit 
                                  ? `$${member.monthly_spending_limit}/mo`
                                  : 'No limit'
                                }
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {member.role !== 'owner' && member.user_id !== user.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm('Remove this member from the team?')) {
                                    removeMemberMutation.mutate(member.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites */}
            {invites && invites.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Pending Invitations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">{invite.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{invite.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {format(new Date(invite.expires_at), 'MMM d')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Usage Tab - Per-Member Breakdown */}
          <TabsContent value="usage" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Per-Member Usage Breakdown
                </CardTitle>
                <CardDescription>
                  Individual contribution to team usage for {format(new Date(), 'MMMM yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Contribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberUsage?.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                              {member.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-medium">{member.full_name}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {member.total_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${member.total_cost.toFixed(4)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {member.total_requests}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${getUsageColor(member.percentage)} transition-all`}
                                style={{ width: `${Math.max(member.percentage, 2)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">
                              {member.percentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!memberUsage || memberUsage.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No usage data yet this month
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Usage Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(teamUsage?.total_tokens || 0).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total Tokens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${(teamUsage?.total_cost || 0).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">API Cost</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{teamUsage?.total_requests || 0}</p>
                      <p className="text-sm text-muted-foreground">Requests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{members?.length || 0}</p>
                      <p className="text-sm text-muted-foreground">Active Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            {/* Current Bill Summary */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Current Billing Period
                </CardTitle>
                <CardDescription>
                  {format(new Date(), 'MMMM yyyy')} - Team owner pays for all member usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="p-6 rounded-xl bg-secondary/50">
                    <p className="text-sm text-muted-foreground mb-1">Base Plan</p>
                    <p className="text-3xl font-bold">${planCost.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Team Plan / month</p>
                  </div>
                  <div className="p-6 rounded-xl bg-secondary/50">
                    <p className="text-sm text-muted-foreground mb-1">API Usage</p>
                    <p className="text-3xl font-bold">${(teamUsage?.total_cost || 0).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{members?.length || 0} members combined</p>
                  </div>
                  <div className="p-6 rounded-xl gradient-primary text-primary-foreground">
                    <p className="text-sm opacity-90 mb-1">Estimated Total</p>
                    <p className="text-3xl font-bold">${estimatedBill.toFixed(2)}</p>
                    <p className="text-sm opacity-90">Due end of period</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Billing History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billingHistory && billingHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingHistory.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell>
                            {format(new Date(bill.period_start), 'MMM d')} - {format(new Date(bill.period_end), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{bill.member_count}</TableCell>
                          <TableCell className="font-mono">
                            {bill.total_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            ${bill.total_cost_usd.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'pending' ? 'secondary' : 'destructive'}>
                              {bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {bill.invoice_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={bill.invoice_url} target="_blank" rel="noopener noreferrer">
                                  Invoice
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No billing history yet</p>
                    <p className="text-sm">Your first invoice will appear at the end of the billing period</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Info */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>How Team Billing Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Base Plan</p>
                      <p className="text-sm text-muted-foreground">$49/month covers the Team plan with 5M tokens shared</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Shared Usage</p>
                      <p className="text-sm text-muted-foreground">All member API usage is tracked and combined</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Owner Pays</p>
                      <p className="text-sm text-muted-foreground">Team owner receives one consolidated bill</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Spending Limit Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Spending Limit</DialogTitle>
            <DialogDescription>
              Set a monthly spending limit for {selectedMember?.profiles?.full_name || 'this member'}. 
              They'll be notified when approaching the limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Monthly Spending Limit ($)</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 50.00 (leave empty for no limit)"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove the spending limit
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Alert Threshold (%)</Label>
              <Select value={alertThreshold} onValueChange={setAlertThreshold}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50% - Early warning</SelectItem>
                  <SelectItem value="70">70% - Moderate</SelectItem>
                  <SelectItem value="80">80% - Standard</SelectItem>
                  <SelectItem value="90">90% - Late warning</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You'll be notified when the member reaches this percentage of their limit
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveSpendingLimit}
                disabled={updateSpendingLimitMutation.isPending}
              >
                {updateSpendingLimitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Limit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
