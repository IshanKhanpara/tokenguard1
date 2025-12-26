import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  User, Bell, Moon, Sun, Monitor, Loader2, 
  Save, Shield, Mail, CreditCard, AlertTriangle
} from 'lucide-react';

interface Profile {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface NotificationSettings {
  usageAlerts: boolean;
  paymentNotifications: boolean;
  weeklyReports: boolean;
  productUpdates: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: subscription } = useSubscription();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    email: '',
    avatar_url: '',
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    usageAlerts: true,
    paymentNotifications: true,
    weeklyReports: false,
    productUpdates: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadNotificationSettings();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfile({
        full_name: data.full_name || '',
        email: data.email || user.email || '',
        avatar_url: data.avatar_url || '',
      });
    } else {
      setProfile({
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        avatar_url: '',
      });
    }
    setIsLoading(false);
  };

  const loadNotificationSettings = () => {
    // Load from localStorage for now (could be moved to database)
    const saved = localStorage.getItem('notification_settings');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        full_name: profile.full_name,
        email: profile.email,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    setIsSaving(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
      });
    } else {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved successfully.',
      });
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('notification_settings', JSON.stringify(notifications));
    toast({
      title: 'Preferences Saved',
      description: 'Your notification preferences have been updated.',
    });
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

  if (!user) return null;

  const planLabel = subscription?.plan?.toUpperCase() || 'FREE';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Moon className="w-4 h-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          value={profile.email || ''}
                          className="pl-10"
                          disabled
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed. Contact <a href="mailto:tokenguardapp@gmail.com" className="text-primary hover:underline">tokenguardapp@gmail.com</a> if you need to update it.
                      </p>
                    </div>
                    <Button onClick={handleSaveProfile} disabled={isSaving} className="gradient-primary">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Changes
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Subscription Card */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Subscription
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-foreground">Current Plan</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription?.status === 'active' ? 'Active subscription' : 'No active subscription'}
                    </p>
                  </div>
                  <Badge className={subscription?.plan === 'pro' ? 'gradient-primary text-primary-foreground' : 
                                   subscription?.plan === 'team' ? 'gradient-accent text-accent-foreground' : ''}>
                    {planLabel}
                  </Badge>
                </div>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/pricing')}>
                  {subscription?.plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions for your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Contact <a href="mailto:tokenguardapp@gmail.com" className="text-primary hover:underline">tokenguardapp@gmail.com</a> to delete your account.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="usageAlerts">Usage Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you reach 80% of your monthly limit
                    </p>
                  </div>
                  <Switch
                    id="usageAlerts"
                    checked={notifications.usageAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, usageAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="paymentNotifications">Payment Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive receipts and payment confirmations
                    </p>
                  </div>
                  <Switch
                    id="paymentNotifications"
                    checked={notifications.paymentNotifications}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, paymentNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weeklyReports">Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Get a weekly summary of your API usage
                    </p>
                  </div>
                  <Switch
                    id="weeklyReports"
                    checked={notifications.weeklyReports}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, weeklyReports: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="productUpdates">Product Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      News about features and improvements
                    </p>
                  </div>
                  <Switch
                    id="productUpdates"
                    checked={notifications.productUpdates}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, productUpdates: checked })
                    }
                  />
                </div>

                <Button onClick={handleSaveNotifications} className="gradient-primary">
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="w-5 h-5 text-primary" />
                  Theme
                </CardTitle>
                <CardDescription>
                  Customize the appearance of the application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'light' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Sun className="w-6 h-6 mx-auto mb-2 text-warning" />
                    <p className="text-sm font-medium text-foreground">Light</p>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'dark' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Moon className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium text-foreground">Dark</p>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'system' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Monitor className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">System</p>
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {theme === 'system' 
                    ? 'Theme will automatically match your system preferences.' 
                    : `Currently using ${theme} theme.`}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}