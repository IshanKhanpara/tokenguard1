import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle,
  Pause,
  Sparkles
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusConfig: Record<string, {
  label: string;
  icon: typeof CheckCircle;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  description: string;
}> = {
  active: {
    label: 'Active',
    icon: CheckCircle,
    variant: 'default',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    description: 'Your subscription is active and in good standing',
  },
  trialing: {
    label: 'Trial',
    icon: Sparkles,
    variant: 'secondary',
    className: 'bg-primary/10 text-primary border-primary/20',
    description: 'You are currently on a free trial period',
  },
  past_due: {
    label: 'Past Due',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-warning/10 text-warning border-warning/20',
    description: 'Payment failed. Please update your payment method',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    variant: 'outline',
    className: 'bg-muted text-muted-foreground border-border',
    description: 'Your subscription has been cancelled',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    variant: 'secondary',
    className: 'bg-secondary text-secondary-foreground border-border',
    description: 'Your subscription is currently paused',
  },
};

interface SubscriptionStatusBadgeProps {
  showPlan?: boolean;
  className?: string;
}

export function SubscriptionStatusBadge({ showPlan = true, className = '' }: SubscriptionStatusBadgeProps) {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) {
    return null;
  }

  const status = subscription.status || 'active';
  const plan = subscription.plan || 'free';
  const config = statusConfig[status] || statusConfig.active;
  const Icon = config.icon;

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground',
    team: 'bg-gradient-to-r from-accent to-accent/80 text-accent-foreground',
  };

  // Don't show status badge for active free plan (it's the default)
  if (plan === 'free' && status === 'active') {
    return showPlan ? (
      <Badge className={`${planColors[plan]} ${className}`}>
        FREE
      </Badge>
    ) : null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 ${className}`}>
            {showPlan && (
              <Badge className={planColors[plan]}>
                {plan.toUpperCase()}
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 ${config.className}`}
            >
              <Icon className="w-3 h-3" />
              <span className="text-xs">{config.label}</span>
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
          {subscription.cancel_at_period_end && status === 'active' && (
            <p className="text-xs text-muted-foreground mt-1">
              Cancels at end of billing period
            </p>
          )}
          {subscription.current_period_end && (
            <p className="text-xs text-muted-foreground mt-1">
              {status === 'cancelled' ? 'Ended' : 'Renews'}: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
