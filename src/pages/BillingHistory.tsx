import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, Download, ExternalLink, CreditCard, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface BillingRecord {
  id: string;
  user_id: string;
  razorpay_payment_id: string | null;
  razorpay_invoice_id: string | null;
  amount_usd: number;
  currency: string;
  status: string;
  description: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  plan: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

function useBillingHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['billing-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BillingRecord[];
    },
    enabled: !!user,
  });
}

const statusColors: Record<string, string> = {
  paid: 'bg-success/20 text-success border-success/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
  refunded: 'bg-muted text-muted-foreground border-muted',
};

export default function BillingHistory() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: billingRecords, isLoading } = useBillingHistory();

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Billing History</h1>
          <p className="text-muted-foreground mt-1">
            View your past invoices and payment receipts
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : billingRecords && billingRecords.length > 0 ? (
          <div className="space-y-4">
            {billingRecords.map((record) => (
              <Card key={record.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Receipt className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">
                            ${record.amount_usd.toFixed(2)} {record.currency}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={statusColors[record.status] || 'bg-muted'}
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.description || `${record.plan?.toUpperCase() || 'Plan'} subscription`}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(record.created_at), 'MMM d, yyyy')}
                          </span>
                          {record.period_start && record.period_end && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {format(new Date(record.period_start), 'MMM d')} - {format(new Date(record.period_end), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 sm:flex-col">
                      {record.invoice_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(record.invoice_url!, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Invoice
                        </Button>
                      )}
                      {record.receipt_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(record.receipt_url!, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">No billing history</h3>
              <p className="text-muted-foreground mb-6">
                You haven't made any payments yet. Upgrade your plan to see billing records here.
              </p>
              <Button onClick={() => navigate('/pricing')}>
                <CreditCard className="w-4 h-4 mr-2" />
                View Plans
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}