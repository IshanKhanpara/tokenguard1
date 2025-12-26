import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ApiKey } from '@/hooks/useSubscription';

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onDelete: () => void;
}

export function ApiKeyCard({ apiKey, onDelete }: ApiKeyCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', apiKey.id);

      if (error) throw error;

      toast({
        title: 'API Key Deleted',
        description: `${apiKey.name} has been removed.`,
      });
      onDelete();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete API key.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const providerColors: Record<string, string> = {
    openai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    anthropic: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    google: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    azure: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  };

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Key className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{apiKey.name}</p>
              <p className="text-sm text-muted-foreground">
                ••••{apiKey.key_hint}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
        
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className={providerColors[apiKey.provider] || ''}>
            {apiKey.provider}
          </Badge>
          <Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
            {apiKey.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground mt-3">
          {apiKey.last_used_at 
            ? `Last used ${formatDistanceToNow(new Date(apiKey.last_used_at))} ago`
            : 'Never used'}
        </p>
      </CardContent>
    </Card>
  );
}
