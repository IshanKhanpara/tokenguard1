import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { data: subscription } = useSubscription();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentPlan = subscription?.plan || 'free';

  const handleSubscribe = async (plan: 'pro' | 'team') => {
    if (!user || !session?.access_token) {
      navigate('/auth?redirect=/pricing');
      return;
    }

    setLoadingPlan(plan);

    try {
      const { data, error } = await supabase.functions.invoke('razorpay-create-subscription', {
        body: { plan },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise(resolve => (script.onload = resolve));
      }

      const options = {
        key: data.razorpay_key,
        subscription_id: data.subscription_id,
        name: data.name,
        description: data.description,
        prefill: data.prefill,
        theme: {
          color: '#6366f1',
        },
        handler: function (response: any) {
          toast({
            title: 'Subscription Activated!',
            description: `Welcome to the ${plan.toUpperCase()} plan!`,
          });
          navigate('/');
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Failed to start subscription';

      // Supabase FunctionsHttpError often contains the underlying Response here
      const resp = (err as any)?.context?.response as Response | undefined;
      if (resp) {
        try {
          const cloned = resp.clone();
          const contentType = cloned.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const body = await cloned.json();
            if (body?.error && typeof body.error === 'string') message = body.error;
          } else {
            const text = await cloned.text();
            if (text) message = text;
          }
        } catch {
          // ignore parsing errors
        }
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      plan: 'free' as const,
      description: 'For individuals getting started',
      features: [
        { name: '100,000 tokens/month', included: true },
        { name: '1 API Key', included: true },
        { name: 'Basic dashboard', included: true },
        { name: 'Email notifications', included: true },
        { name: 'Google Sheets integration', included: true },
        { name: 'API access', included: false },
        { name: 'Advanced analytics', included: false },
        { name: 'Team collaboration', included: false },
        { name: 'Audit logs', included: false },
        { name: 'Priority support', included: false },
      ],
    },
    {
      name: 'Pro',
      price: 1800,
      plan: 'pro' as const,
      description: 'For professionals and freelancers',
      popular: true,
      features: [
        { name: '1,000,000 tokens/month', included: true },
        { name: '5 API Keys', included: true },
        { name: 'Advanced dashboard', included: true },
        { name: 'Email notifications', included: true },
        { name: 'All integrations', included: true },
        { name: 'API access', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Team collaboration', included: false },
        { name: 'Audit logs', included: false },
        { name: 'Email support', included: true },
      ],
    },
    {
      name: 'Team',
      price: 4500,
      plan: 'team' as const,
      description: 'For teams and agencies',
      features: [
        { name: '5,000,000 tokens/month', included: true },
        { name: '20 API Keys', included: true },
        { name: 'Advanced dashboard', included: true },
        { name: 'All notifications', included: true },
        { name: 'All integrations + webhooks', included: true },
        { name: 'API access', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Up to 5 team members', included: true },
        { name: 'Audit logs', included: true },
        { name: 'SSO & SAML', included: true },
        { name: 'Priority support', included: true },
      ],
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include core monitoring features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative border-0 shadow-lg ${plan.popular ? 'ring-2 ring-primary shadow-glow' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-primary">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">₹{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={feature.included ? 'text-foreground' : 'text-muted-foreground'}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.plan === currentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.plan === 'free' ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: 'Downgrade',
                          description: 'To downgrade, please cancel your subscription in Settings.',
                        });
                        navigate('/settings');
                      }}
                    >
                      Downgrade
                    </Button>
                  ) : (
                    <Button 
                      className={`w-full ${plan.popular ? 'gradient-primary' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan.plan)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === plan.plan ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {currentPlan !== 'free' ? 'Upgrade' : 'Subscribe'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

        {/* FAQ or Info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            All prices in INR. Billed monthly via Razorpay. Cancel anytime.
          </p>
        </div>
      </div>
    </Layout>
  );
}
