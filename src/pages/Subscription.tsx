import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useSubscription,
  useCurrentPlanLimits,
  useMonthlyUsage,
} from "@/hooks/useSubscription";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function Subscription() {
  const navigate = useNavigate();
  const { user, loading: authLoading, session } = useAuth();
  const { data: subscription, isLoading: subLoading, refetch } =
    useSubscription();
  const { data: planLimits } = useCurrentPlanLimits();
  const { data: monthlyUsage } = useMonthlyUsage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=/subscription");
    }
  }, [authLoading, user, navigate]);

  if (authLoading || subLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  const currentPlan = subscription?.plan ?? "free";
  const status = subscription?.status ?? "active";

  const usagePercentage = planLimits?.max_tokens_per_month
    ? Math.min(
      ((monthlyUsage?.total_tokens ?? 0) /
        planLimits.max_tokens_per_month) *
      100,
      100
    )
    : 0;

  /* ===================== CREATE SUBSCRIPTION ===================== */
  const handleSubscribe = async (plan: "pro" | "team") => {
    if (!session?.access_token) {
      toast({
        variant: "destructive",
        title: "Login required",
        description: "Please login to continue",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-subscription",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { plan },
        }
      );

      if (error) throw error;
      if (!data?.short_url) throw new Error("Payment link not generated");

      window.location.href = data.short_url;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: err.message ?? "Unable to start payment",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ===================== CANCEL SUBSCRIPTION (FIXED) ===================== */
  const handleCancelSubscription = async () => {
    if (
      !session?.access_token ||
      !subscription?.provider_subscription_id
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Subscription ID not found",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke(
        "razorpay-cancel-subscription",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            subscription_id: subscription.provider_subscription_id,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Subscription cancelled",
        description:
          "Your plan will remain active until the end of the billing period",
      });

      refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Cancel failed",
        description: err.message ?? "Unable to cancel subscription",
      });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<
    string,
    { label: string; icon: JSX.Element; variant: any }
  > = {
    active: {
      label: "Active",
      icon: <CheckCircle2 className="w-3 h-3" />,
      variant: "default",
    },
    past_due: {
      label: "Past Due",
      icon: <AlertTriangle className="w-3 h-3" />,
      variant: "destructive",
    },
    cancelled: {
      label: "Cancelled",
      icon: <AlertTriangle className="w-3 h-3" />,
      variant: "outline",
    },
    trialing: {
      label: "Trial",
      icon: <Clock className="w-3 h-3" />,
      variant: "secondary",
    },
  };

  const currentStatus = statusConfig[status] ?? statusConfig.active;

  return (
    <Layout>
      <div className="container max-w-4xl py-8 space-y-6">
        <h1 className="text-3xl font-bold">Subscription</h1>

        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your active subscription</CardDescription>
              </div>
              <Badge variant={currentStatus.variant}>
                {currentStatus.icon}
                {currentStatus.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold capitalize">
                  {currentPlan}
                </h2>
                <p className="text-muted-foreground">
                  $
                  {currentPlan === "pro"
                    ? 19
                    : currentPlan === "team"
                      ? 49
                      : 0}
                  /month
                </p>
              </div>

              {currentPlan === "free" && (
                <Button
                  onClick={() => handleSubscribe("pro")}
                  disabled={loading}
                >
                  Upgrade to Pro
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {currentPlan !== "free" && (
              <>
                <Separator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loading}>
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Cancel subscription?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan will stay active until the end of the
                        billing period.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                      >
                        Confirm Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={usagePercentage} />
            <p className="text-sm mt-2 text-muted-foreground">
              {usagePercentage.toFixed(1)}% used
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
