import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecordUsageRequest {
  userId: string;
  tokensUsed: number;
  costUsd: number;
  model?: string;
  endpoint?: string;
  apiKeyId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Record usage function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, tokensUsed, costUsd, model, endpoint, apiKeyId }: RecordUsageRequest = await req.json();
    console.log(`Recording usage for user ${userId}: ${tokensUsed} tokens, $${costUsd}`);

    if (!userId || tokensUsed === undefined || costUsd === undefined) {
      throw new Error("Missing required fields: userId, tokensUsed, costUsd");
    }

    // First check if usage is allowed
    const checkResponse = await fetch(`${supabaseUrl}/functions/v1/check-usage-limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ userId, tokensToUse: tokensUsed }),
    });

    const checkResult = await checkResponse.json();

    if (!checkResult.allowed) {
      console.log("Usage not allowed:", checkResult.reason);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: checkResult.reason,
          blocked: true,
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Insert usage log
    const { error: logError } = await supabase
      .from("usage_logs")
      .insert({
        user_id: userId,
        tokens_used: tokensUsed,
        cost_usd: costUsd,
        model,
        endpoint,
        api_key_id: apiKeyId,
      });

    if (logError) {
      console.error("Error inserting usage log:", logError);
      throw new Error("Failed to record usage log");
    }

    // Update or insert monthly usage
    const monthYear = new Date().toISOString().slice(0, 7);
    
    const { data: existingUsage } = await supabase
      .from("monthly_usage")
      .select("id, total_tokens, total_cost_usd, request_count")
      .eq("user_id", userId)
      .eq("month_year", monthYear)
      .single();

    if (existingUsage) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("monthly_usage")
        .update({
          total_tokens: existingUsage.total_tokens + tokensUsed,
          total_cost_usd: existingUsage.total_cost_usd + costUsd,
          request_count: existingUsage.request_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id);

      if (updateError) {
        console.error("Error updating monthly usage:", updateError);
        throw new Error("Failed to update monthly usage");
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("monthly_usage")
        .insert({
          user_id: userId,
          month_year: monthYear,
          total_tokens: tokensUsed,
          total_cost_usd: costUsd,
          request_count: 1,
        });

      if (insertError) {
        console.error("Error inserting monthly usage:", insertError);
        throw new Error("Failed to insert monthly usage");
      }
    }

    // Update API key last_used_at if provided
    if (apiKeyId) {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKeyId);
    }

    // Check if we need to send usage alert emails
    const percentUsed = checkResult.percentUsed || 0;
    const newTotalTokens = (existingUsage?.total_tokens || 0) + tokensUsed;
    const previousPercent = existingUsage 
      ? (existingUsage.total_tokens / checkResult.maxTokens) * 100 
      : 0;

    // Send 80% warning if we just crossed it
    if (percentUsed >= 80 && previousPercent < 80) {
      console.log("User reached 80% usage, sending warning email");
      try {
        await fetch(`${supabaseUrl}/functions/v1/usage-alert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            current_tokens: newTotalTokens,
            max_tokens: checkResult.maxTokens,
            threshold: 80,
          }),
        });
      } catch (e) {
        console.error("Failed to send 80% usage alert:", e);
      }
    }

    // Send 100% alert if we just crossed it
    if (percentUsed >= 100 && previousPercent < 100) {
      console.log("User reached 100% usage, sending limit email");
      try {
        await fetch(`${supabaseUrl}/functions/v1/usage-alert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            current_tokens: newTotalTokens,
            max_tokens: checkResult.maxTokens,
            threshold: 100,
          }),
        });
      } catch (e) {
        console.error("Failed to send 100% usage alert:", e);
      }
    }

    console.log("Usage recorded successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        shouldWarn: checkResult.shouldWarn,
        percentUsed: checkResult.percentUsed,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error recording usage:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);