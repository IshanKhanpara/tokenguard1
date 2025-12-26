import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UsageCheckRequest {
  userId: string;
  tokensToUse?: number;
}

interface UsageCheckResponse {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  shouldWarn: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Check usage limit function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, tokensToUse = 0 }: UsageCheckRequest = await req.json();
    console.log(`Checking usage for user ${userId}, tokens to use: ${tokensToUse}`);

    if (!userId) {
      throw new Error("Missing required field: userId");
    }

    // Get user's subscription and plan
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .single();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      throw new Error("Failed to fetch subscription");
    }

    // Get plan limits
    const { data: planLimits, error: limitsError } = await supabase
      .from("plan_limits")
      .select("max_tokens_per_month")
      .eq("plan", subscription?.plan || "free")
      .single();

    if (limitsError) {
      console.error("Error fetching plan limits:", limitsError);
      throw new Error("Failed to fetch plan limits");
    }

    // Get current month's usage
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const { data: usage, error: usageError } = await supabase
      .from("monthly_usage")
      .select("total_tokens")
      .eq("user_id", userId)
      .eq("month_year", monthYear)
      .single();

    const currentTokens = usage?.total_tokens || 0;
    const tokenLimit = planLimits?.max_tokens_per_month || 100000;
    const projectedTokens = currentTokens + tokensToUse;
    const percentUsed = Math.round((currentTokens / tokenLimit) * 100);
    const projectedPercent = Math.round((projectedTokens / tokenLimit) * 100);

    // Check if subscription is active
    if (subscription?.status !== "active") {
      console.log("Subscription not active");
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "Subscription is not active",
          currentUsage: currentTokens,
          limit: tokenLimit,
          percentUsed,
          shouldWarn: false,
        } as UsageCheckResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if would exceed limit
    if (projectedTokens > tokenLimit) {
      console.log(`Usage would exceed limit: ${projectedTokens} > ${tokenLimit}`);
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: "Monthly token limit exceeded",
          currentUsage: currentTokens,
          limit: tokenLimit,
          percentUsed,
          shouldWarn: false,
        } as UsageCheckResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if should warn (at 80% threshold)
    const shouldWarn = percentUsed >= 80 && percentUsed < 100;

    // If crossing 80% threshold, send warning email
    if (projectedPercent >= 80 && percentUsed < 80) {
      console.log("User crossed 80% threshold, triggering warning email");
      
      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .single();

      if (profile?.email) {
        // Trigger warning email (fire and forget)
        fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            type: "usage_warning",
            to: profile.email,
            data: {
              tokensUsed: projectedTokens,
              tokenLimit,
              percentUsed: projectedPercent,
            },
          }),
        }).catch((err) => console.error("Failed to send warning email:", err));
      }
    }

    console.log(`Usage check passed: ${currentTokens}/${tokenLimit} (${percentUsed}%)`);

    return new Response(
      JSON.stringify({
        allowed: true,
        currentUsage: currentTokens,
        limit: tokenLimit,
        percentUsed,
        shouldWarn,
      } as UsageCheckResponse),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking usage limit:", errorMessage);
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        reason: errorMessage,
        currentUsage: 0,
        limit: 0,
        percentUsed: 0,
        shouldWarn: false,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);