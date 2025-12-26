import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Loader2, History, Filter, Download, ArrowLeft, 
  Calendar, Cpu, DollarSign, Zap, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  tokens_used: number;
  cost_usd: number;
  model: string | null;
  endpoint: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 20;

export default function UsageHistory() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: usageLogs, isLoading } = useQuery({
    queryKey: ['usage-history', user?.id, dateFrom, dateTo, page],
    queryFn: async () => {
      if (!user) return { logs: [], total: 0 };
      
      const from = startOfDay(new Date(dateFrom)).toISOString();
      const to = endOfDay(new Date(dateTo)).toISOString();
      
      // Get count first
      const { count } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', from)
        .lte('created_at', to);

      // Get paginated data
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      return { logs: data as UsageLog[], total: count || 0 };
    },
    enabled: !!user,
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys-list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, provider')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get unique models from logs for filtering
  const uniqueModels = [...new Set(usageLogs?.logs?.map(log => log.model).filter(Boolean) || [])];
  const uniqueProviders = [...new Set(apiKeys?.map(key => key.provider) || [])];

  // Filter logs
  const filteredLogs = usageLogs?.logs?.filter(log => {
    if (modelFilter !== 'all' && log.model !== modelFilter) return false;
    if (providerFilter !== 'all') {
      const apiKey = apiKeys?.find(k => k.id === log.api_key_id);
      if (!apiKey || apiKey.provider !== providerFilter) return false;
    }
    return true;
  }) || [];

  // Calculate totals
  const totalTokens = filteredLogs.reduce((sum, log) => sum + (log.tokens_used || 0), 0);
  const totalCost = filteredLogs.reduce((sum, log) => sum + (log.cost_usd || 0), 0);
  const totalRequests = filteredLogs.length;

  const totalPages = Math.ceil((usageLogs?.total || 0) / ITEMS_PER_PAGE);

  const handleExportCSV = () => {
    const csvContent = [
      ['Date', 'Model', 'Endpoint', 'Tokens', 'Cost (USD)'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.model || 'N/A',
        log.endpoint || 'N/A',
        log.tokens_used,
        log.cost_usd.toFixed(6),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-history-${dateFrom}-to-${dateTo}.csv`;
    a.click();
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              Usage History
            </h1>
            <p className="text-muted-foreground">Detailed breakdown of all your API calls</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {uniqueProviders.map(provider => (
                      <SelectItem key={provider} value={provider}>
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {uniqueModels.map(model => (
                      <SelectItem key={model} value={model!}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleExportCSV} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalRequests}</p>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              API Calls
            </CardTitle>
            <CardDescription>
              Showing {filteredLogs.length} of {usageLogs?.total || 0} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const apiKey = apiKeys?.find(k => k.id === log.api_key_id);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <div>
                                <p className="font-medium">
                                  {format(new Date(log.created_at), 'MMM d, yyyy')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(log.created_at), 'HH:mm:ss')}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {apiKey && (
                                  <Badge variant="secondary" className="text-xs">
                                    {apiKey.provider}
                                  </Badge>
                                )}
                                <span className="text-sm">{log.model || 'N/A'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {log.endpoint || 'N/A'}
                              </code>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {log.tokens_used.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${log.cost_usd.toFixed(6)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No usage data found</p>
                <p className="text-sm">Try adjusting your filters or date range</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
