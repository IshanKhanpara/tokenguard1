import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UsageAlertRequest {
  user_id: string;
  current_tokens: number;
  max_tokens: number;
  threshold: 80 | 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, current_tokens, max_tokens, threshold }: UsageAlertRequest = await req.json();
    console.log(`Processing usage alert for user ${user_id}: ${current_tokens}/${max_tokens} tokens (${threshold}% threshold)`);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error("Could not find user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const usagePercent = Math.round((current_tokens / max_tokens) * 100);
    const remainingTokens = max_tokens - current_tokens;
    const userName = profile.full_name || "User";

    const { data: settingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "support_email")
      .single();
    
    const supportEmail = settingData?.value || "support@example.com";

    let subject: string;
    let htmlContent: string;

    if (threshold === 100) {
      subject = "⚠️ Usage Limit Reached - Action Required";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Usage Limit Reached</h1>
          </div>
          <p>Hi ${userName},</p>
          <p>You've reached <strong>100%</strong> of your monthly token limit.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Usage:</strong> ${current_tokens.toLocaleString()} / ${max_tokens.toLocaleString()} tokens</p>
          </div>
          <p>To continue using our services, please upgrade your plan.</p>
          <p style="color: #6b7280; font-size: 14px;">Contact us at ${supportEmail} for help.</p>
        </body>
        </html>
      `;
    } else {
      subject = "📊 Usage Alert - 80% of Limit Reached";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📊 Usage Alert</h1>
          </div>
          <p>Hi ${userName},</p>
          <p>You've used <strong>${usagePercent}%</strong> of your monthly token limit.</p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Usage:</strong> ${current_tokens.toLocaleString()} / ${max_tokens.toLocaleString()} tokens</p>
            <p style="margin: 5px 0 0;"><strong>Remaining:</strong> ${remainingTokens.toLocaleString()} tokens</p>
          </div>
          <p>Consider upgrading your plan if you need more tokens.</p>
          <p style="color: #6b7280; font-size: 14px;">Contact us at ${supportEmail} for help.</p>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Usage Alerts <onboarding@resend.dev>",
      to: [profile.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Usage alert email sent:", emailResponse);

    await supabase.from("admin_notifications").insert({
      type: threshold === 100 ? "usage_limit_reached" : "usage_warning",
      title: threshold === 100 ? "User Hit Usage Limit" : "User Approaching Usage Limit",
      message: `${profile.email} has reached ${usagePercent}% of their monthly token limit`,
      data: { user_id, email: profile.email, current_tokens, max_tokens, threshold },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in usage-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
