import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { AdminNotifications } from '@/components/AdminNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Users, DollarSign, TrendingUp, ShieldAlert,
  Search, RefreshCw, MoreHorizontal, Ban, CheckCircle,
  CreditCard, Receipt, Settings, MessageSquare, Activity,
  Webhook, ChevronDown, AlertTriangle, TrendingDown,
  Eye, Edit, XCircle
} from 'lucide-react';

// Types
interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  auth_provider: string | null;
  created_at: string;
  plan: string;
  status: string;
  is_blocked: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  resource_type: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
  actor_id: string | null;
}

interface BillingRecord {
  id: string;
  user_id: string;
  amount_usd: number;
  currency: string;
  status: string;
  description: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  plan: string | null;
}

interface SupportTicket {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookLog {
  id: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
}

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
}

interface PlanLimit {
  id: string;
  plan: string;
  max_api_keys: number;
  max_tokens_per_month: number;
  price_usd: number;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_advanced_analytics: boolean;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [users, setUsers] = useState<UserData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([]);
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<BillingRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketStatus, setTicketStatus] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    paidUsers: 0,
    mrr: 0,
    openTickets: 0,
    totalRevenue: 0,
    churnRate: 0,
    newUsersThisMonth: 0,
  });

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) throw error;
        setIsAdmin(data === true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

  // Fetch admin data
  const fetchData = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      // Parallel fetch all data
      const [
        profilesRes,
        subscriptionsRes,
        billingRes,
        ticketsRes,
        logsRes,
        webhookRes,
        settingsRes,
        planLimitsRes
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*'),
        supabase.from('billing_history').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('system_settings').select('*'),
        supabase.from('plan_limits').select('*'),
      ]);

      // Process users
      const usersData: UserData[] = (profilesRes.data || []).map((profile) => {
        const sub = subscriptionsRes.data?.find(s => s.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email || 'N/A',
          full_name: profile.full_name,
          auth_provider: profile.auth_provider,
          created_at: profile.created_at,
          plan: sub?.plan || 'free',
          status: sub?.status || 'active',
          is_blocked: profile.is_blocked || false,
        };
      });
      setUsers(usersData);

      // Process billing
      setBillingRecords(billingRes.data || []);

      // Process tickets
      setTickets(ticketsRes.data || []);

      // Process audit logs
      const typedLogs: AuditLog[] = (logsRes.data || []).map(log => ({
        id: log.id,
        action: log.action,
        resource_type: log.resource_type,
        details: log.details as Record<string, unknown> | null,
        created_at: log.created_at,
        user_id: log.user_id,
        actor_id: log.actor_id,
      }));
      setAuditLogs(typedLogs);

      // Process webhook logs
      const typedWebhooks: WebhookLog[] = (webhookRes.data || []).map(log => ({
        id: log.id,
        source: log.source,
        event_type: log.event_type,
        payload: log.payload as Record<string, unknown> | null,
        response_status: log.response_status,
        error_message: log.error_message,
        created_at: log.created_at,
      }));
      setWebhookLogs(typedWebhooks);

      // Process settings
      setSettings(settingsRes.data || []);

      // Process plan limits
      setPlanLimits(planLimitsRes.data || []);

      // Calculate stats
      const planPrices: Record<string, number> = {};
      planLimitsRes.data?.forEach(p => {
        planPrices[p.plan] = p.price_usd;
      });

      const paidSubs = subscriptionsRes.data?.filter(s => s.plan !== 'free' && s.status === 'active') || [];
      const mrr = paidSubs.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);
      const totalRevenue = (billingRes.data || [])
        .filter(b => b.status === 'paid' && b.amount_usd > 0)
        .reduce((sum, b) => sum + b.amount_usd, 0);
      
      const cancelledSubs = subscriptionsRes.data?.filter(s => s.status === 'cancelled').length || 0;
      const churnRate = subscriptionsRes.data?.length 
        ? (cancelledSubs / subscriptionsRes.data.length * 100).toFixed(1)
        : 0;

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const newUsersThisMonth = usersData.filter(u => 
        new Date(u.created_at) >= thisMonth
      ).length;

      setStats({
        totalUsers: usersData.length,
        activeUsers: usersData.filter(u => u.status === 'active' && !u.is_blocked).length,
        paidUsers: paidSubs.length,
        mrr,
        openTickets: (ticketsRes.data || []).filter(t => t.status === 'open').length,
        totalRevenue,
        churnRate: Number(churnRate),
        newUsersThisMonth,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load admin data',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Admin action helper
  const executeAdminAction = async (action: string, payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-actions', {
        body: { action, ...payload },
      });

      if (response.error) throw response.error;

      toast({
        title: 'Success',
        description: response.data.message || 'Action completed',
      });

      fetchData();
      return response.data;
    } catch (error) {
      console.error('Admin action error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Action failed',
      });
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  // User actions
  const handleBlockUser = async (userId: string) => {
    await executeAdminAction('block_user', { userId });
    setUserDialogOpen(false);
  };

  const handleUnblockUser = async (userId: string) => {
    await executeAdminAction('unblock_user', { userId });
    setUserDialogOpen(false);
  };

  const handleChangePlan = async (userId: string, plan: string) => {
    await executeAdminAction('change_plan', { userId, plan });
    setUserDialogOpen(false);
  };

  const handleCancelSubscription = async (userId: string) => {
    await executeAdminAction('cancel_subscription', { userId });
    setUserDialogOpen(false);
  };

  // Ticket actions
  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;
    await executeAdminAction('update_ticket', {
      ticketId: selectedTicket.id,
      ticketStatus,
      ticketNotes,
    });
    setTicketDialogOpen(false);
  };

  // Refund action
  const handleProcessRefund = async () => {
    if (!selectedPayment) return;
    await executeAdminAction('process_refund', {
      paymentId: selectedPayment.razorpay_payment_id,
      amount: parseFloat(refundAmount),
      reason: refundReason,
      userId: selectedPayment.user_id,
    });
    setRefundDialogOpen(false);
    setRefundAmount('');
    setRefundReason('');
  };

  // Setting update
  const handleUpdateSetting = async (key: string, value: unknown) => {
    await executeAdminAction('update_setting', { settingKey: key, settingValue: value });
  };

  if (authLoading || checkingAdmin) {
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

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You do not have permission to access the admin panel.
          </p>
          <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'gradient-primary text-primary-foreground',
    team: 'gradient-accent text-accent-foreground',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-success/10 text-success border-success/20',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
    past_due: 'bg-warning/10 text-warning border-warning/20',
    paused: 'bg-muted text-muted-foreground',
    open: 'bg-warning/10 text-warning border-warning/20',
    in_progress: 'bg-primary/10 text-primary border-primary/20',
    resolved: 'bg-success/10 text-success border-success/20',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Manage users, payments, and system settings</p>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotifications />
            <Button onClick={fetchData} disabled={loading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8 mb-8">
              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats.newUsersThisMonth} this month
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.activeUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {((stats.activeUsers / stats.totalUsers) * 100 || 0).toFixed(0)}% of total
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Paid Users
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.paidUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {((stats.paidUsers / stats.totalUsers) * 100 || 0).toFixed(1)}% conversion
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Monthly Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">${stats.mrr}</div>
                  <p className="text-xs text-muted-foreground">MRR</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </CardTitle>
                  <Receipt className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Churn Rate
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.churnRate}%</div>
                  <p className="text-xs text-muted-foreground">Cancelled subscriptions</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Open Tickets
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.openTickets}</div>
                  <p className="text-xs text-muted-foreground">Needs attention</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Webhooks Today
                  </CardTitle>
                  <Webhook className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {webhookLogs.filter(w => 
                      new Date(w.created_at).toDateString() === new Date().toDateString()
                    ).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Events received</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="users" className="space-y-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
                <TabsTrigger value="payments"><CreditCard className="mr-2 h-4 w-4" />Payments</TabsTrigger>
                <TabsTrigger value="plans"><DollarSign className="mr-2 h-4 w-4" />Plans</TabsTrigger>
                <TabsTrigger value="tickets"><MessageSquare className="mr-2 h-4 w-4" />Support</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings</TabsTrigger>
                <TabsTrigger value="audit"><Activity className="mr-2 h-4 w-4" />Audit</TabsTrigger>
                <TabsTrigger value="webhooks"><Webhook className="mr-2 h-4 w-4" />Webhooks</TabsTrigger>
              </TabsList>

              {/* Users Tab */}
              <TabsContent value="users">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>View, block/unblock, and manage user plans</CardDescription>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          className="pl-9"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((u) => (
                            <TableRow key={u.id} className={u.is_blocked ? 'opacity-60' : ''}>
                              <TableCell className="font-medium">
                                {u.email}
                                {u.is_blocked && (
                                  <Badge variant="destructive" className="ml-2">Blocked</Badge>
                                )}
                              </TableCell>
                              <TableCell>{u.full_name || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {u.auth_provider || 'email'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={planColors[u.plan]}>
                                  {u.plan.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[u.status]}>
                                  {u.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedUser(u);
                                      setUserDialogOpen(true);
                                    }}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    {u.is_blocked ? (
                                      <DropdownMenuItem onClick={() => handleUnblockUser(u.id)}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Unblock User
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem 
                                        onClick={() => handleBlockUser(u.id)}
                                        className="text-destructive"
                                      >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Block User
                                      </DropdownMenuItem>
                                    )}
                                    {u.plan !== 'free' && (
                                      <DropdownMenuItem 
                                        onClick={() => handleCancelSubscription(u.id)}
                                        className="text-destructive"
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancel Subscription
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredUsers.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No users found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Payment & Billing History</CardTitle>
                    <CardDescription>View all transactions and process refunds</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Payment ID</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="text-muted-foreground">
                                {new Date(record.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {users.find(u => u.id === record.user_id)?.email || record.user_id.slice(0, 8)}
                              </TableCell>
                              <TableCell className={record.amount_usd < 0 ? 'text-destructive' : ''}>
                                {record.currency} {Math.abs(record.amount_usd).toFixed(2)}
                                {record.amount_usd < 0 && ' (Refund)'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{record.plan || '-'}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[record.status] || ''}>
                                  {record.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {record.razorpay_payment_id?.slice(0, 12) || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {record.status === 'paid' && record.amount_usd > 0 && record.razorpay_payment_id && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPayment(record);
                                      setRefundAmount(record.amount_usd.toString());
                                      setRefundDialogOpen(true);
                                    }}
                                  >
                                    Refund
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {billingRecords.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No billing records found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Plans Tab */}
              <TabsContent value="plans">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Plan & Pricing Management</CardTitle>
                    <CardDescription>Configure plan limits and pricing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-3">
                      {planLimits.map((plan) => (
                        <Card key={plan.id} className="border">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span className="capitalize">{plan.plan}</span>
                              <Badge className={planColors[plan.plan]}>${plan.price_usd}/mo</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>Max API Keys</Label>
                              <div className="text-2xl font-bold">{plan.max_api_keys}</div>
                            </div>
                            <div className="space-y-2">
                              <Label>Max Tokens/Month</Label>
                              <div className="text-2xl font-bold">
                                {(plan.max_tokens_per_month / 1000000).toFixed(1)}M
                              </div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span>API Access</span>
                                <Badge variant={plan.has_api_access ? 'default' : 'outline'}>
                                  {plan.has_api_access ? 'Yes' : 'No'}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Priority Support</span>
                                <Badge variant={plan.has_priority_support ? 'default' : 'outline'}>
                                  {plan.has_priority_support ? 'Yes' : 'No'}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Advanced Analytics</span>
                                <Badge variant={plan.has_advanced_analytics ? 'default' : 'outline'}>
                                  {plan.has_advanced_analytics ? 'Yes' : 'No'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Support Tickets Tab */}
              <TabsContent value="tickets">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Support Tickets</CardTitle>
                    <CardDescription>Manage customer support requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.map((ticket) => (
                            <TableRow key={ticket.id}>
                              <TableCell className="text-muted-foreground">
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{ticket.email}</TableCell>
                              <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  ticket.priority === 'urgent' ? 'border-destructive text-destructive' :
                                  ticket.priority === 'high' ? 'border-warning text-warning' : ''
                                }>
                                  {ticket.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[ticket.status]}>
                                  {ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTicket(ticket);
                                    setTicketStatus(ticket.status);
                                    setTicketNotes(ticket.admin_notes || '');
                                    setTicketDialogOpen(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Manage
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {tickets.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No support tickets found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                    <CardDescription>Configure application settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {settings.map((setting) => (
                        <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <Label className="font-medium">{setting.key.replace(/_/g, ' ').toUpperCase()}</Label>
                            <p className="text-sm text-muted-foreground">{setting.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof setting.value === 'boolean' ? (
                              <Button
                                variant={setting.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleUpdateSetting(setting.key, !setting.value)}
                                disabled={actionLoading}
                              >
                                {setting.value ? 'Enabled' : 'Disabled'}
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  defaultValue={String(setting.value).replace(/"/g, '')}
                                  className="w-48"
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    const newValue = isNaN(Number(val)) ? `"${val}"` : Number(val);
                                    if (JSON.stringify(newValue) !== JSON.stringify(setting.value)) {
                                      handleUpdateSetting(setting.key, newValue);
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Audit Logs Tab */}
              <TabsContent value="audit">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Activity & Audit Logs</CardTitle>
                    <CardDescription>Track all admin and system actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Resource</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.action}</Badge>
                              </TableCell>
                              <TableCell>{log.resource_type || '-'}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {log.actor_id?.slice(0, 8) || '-'}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {log.details ? JSON.stringify(log.details) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {auditLogs.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Webhook Logs Tab */}
              <TabsContent value="webhooks">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Webhook Logs</CardTitle>
                    <CardDescription>Monitor incoming webhook events from payment gateways</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {webhookLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.source}</Badge>
                              </TableCell>
                              <TableCell>{log.event_type}</TableCell>
                              <TableCell>
                                {log.response_status ? (
                                  <Badge variant={log.response_status < 400 ? 'default' : 'destructive'}>
                                    {log.response_status}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-destructive">
                                {log.error_message || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {webhookLogs.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No webhook logs found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* User Detail Dialog */}
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                Manage user account and subscription
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <div className="text-sm">{selectedUser.email}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <div className="text-sm">{selectedUser.full_name || '-'}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Current Plan</Label>
                  <Select
                    defaultValue={selectedUser.plan}
                    onValueChange={(value) => handleChangePlan(selectedUser.id, value)}
                    disabled={actionLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Badge variant="outline" className={statusColors[selectedUser.status]}>
                    {selectedUser.status}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <Label>Joined</Label>
                  <div className="text-sm">{new Date(selectedUser.created_at).toLocaleString()}</div>
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              {selectedUser?.is_blocked ? (
                <Button onClick={() => handleUnblockUser(selectedUser.id)} disabled={actionLoading}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Unblock User
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={() => selectedUser && handleBlockUser(selectedUser.id)}
                  disabled={actionLoading}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Block User
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ticket Dialog */}
        <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Ticket</DialogTitle>
              <DialogDescription>
                Update ticket status and add notes
              </DialogDescription>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <div className="text-sm font-medium">{selectedTicket.subject}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Message</Label>
                  <div className="text-sm p-3 bg-muted rounded-lg">{selectedTicket.message}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={ticketStatus} onValueChange={setTicketStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={ticketNotes}
                    onChange={(e) => setTicketNotes(e.target.value)}
                    placeholder="Add internal notes..."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTicket} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Refund</DialogTitle>
              <DialogDescription>
                This will refund the payment via Razorpay
              </DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">This action cannot be undone</p>
                    <p className="text-muted-foreground">
                      The refund will be processed immediately via Razorpay.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Payment ID</Label>
                  <div className="text-sm font-mono">{selectedPayment.razorpay_payment_id}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Refund Amount ({selectedPayment.currency})</Label>
                  <Input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    max={selectedPayment.amount_usd}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for refund..."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleProcessRefund}
                disabled={actionLoading || !refundAmount}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Process Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
