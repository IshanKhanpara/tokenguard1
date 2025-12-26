import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SpendingAlertRequest {
  user_id: string;
  team_id: string;
  member_email: string;
  member_name: string;
  current_spending: number;
  spending_limit: number;
  threshold: number;
  alert_type: 'warning' | 'limit_reached';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      user_id, team_id, member_email, member_name,
      current_spending, spending_limit, threshold, alert_type 
    }: SpendingAlertRequest = await req.json();

    const monthYear = new Date().toISOString().slice(0, 7);
    console.log(`Processing spending alert: ${alert_type} for ${member_email}`);

    // Check if alert already sent
    const { data: existingAlert } = await supabase
      .from('spending_alerts')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user_id)
      .eq('month_year', monthYear)
      .eq('threshold_reached', threshold)
      .single();

    if (existingAlert) {
      console.log('Alert already sent for this threshold');
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get team owner
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id, name')
      .eq('id', team_id)
      .single();

    if (!team) {
      throw new Error('Team not found');
    }

    // Get owner's profile
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', team.owner_id)
      .single();

    if (!ownerProfile?.email) {
      throw new Error('Owner email not found');
    }

    const percentUsed = Math.round((current_spending / spending_limit) * 100);
    const remaining = Math.max(0, spending_limit - current_spending);

    let subject: string;
    let htmlContent: string;

    if (alert_type === 'limit_reached') {
      subject = `🚫 ${member_name} has reached their spending limit`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚫 Spending Limit Reached</h1>
          </div>
          <p>Hi ${ownerProfile.full_name || 'Team Owner'},</p>
          <p><strong>${member_name}</strong> (${member_email}) has reached their monthly spending limit on your team <strong>${team.name}</strong>.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Current Spending:</strong> $${current_spending.toFixed(2)}</p>
            <p style="margin: 5px 0 0;"><strong>Limit:</strong> $${spending_limit.toFixed(2)}</p>
          </div>
          <p>This member's API access has been paused until you increase their limit or the next billing period begins.</p>
          <p style="color: #6b7280; font-size: 14px;">You can adjust spending limits in your Team Management settings.</p>
        </body>
        </html>
      `;
    } else {
      subject = `⚠️ ${member_name} is approaching their spending limit`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Spending Alert</h1>
          </div>
          <p>Hi ${ownerProfile.full_name || 'Team Owner'},</p>
          <p><strong>${member_name}</strong> (${member_email}) has used <strong>${percentUsed}%</strong> of their monthly spending limit on your team <strong>${team.name}</strong>.</p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Current Spending:</strong> $${current_spending.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Limit:</strong> $${spending_limit.toFixed(2)}</p>
            <p style="margin: 5px 0 0;"><strong>Remaining:</strong> $${remaining.toFixed(2)}</p>
          </div>
          <p>Consider increasing their limit if they need more API usage this month.</p>
          <p style="color: #6b7280; font-size: 14px;">You can adjust spending limits in your Team Management settings.</p>
        </body>
        </html>
      `;
    }

    // Send email to team owner
    await resend.emails.send({
      from: "Spending Alerts <onboarding@resend.dev>",
      to: [ownerProfile.email],
      subject: subject,
      html: htmlContent,
    });

    // Record alert sent
    await supabase.from('spending_alerts').insert({
      team_id,
      user_id,
      month_year: monthYear,
      threshold_reached: threshold,
      alert_type,
    });

    // Create admin notification
    await supabase.from('admin_notifications').insert({
      type: alert_type === 'limit_reached' ? 'spending_limit_reached' : 'spending_warning',
      title: alert_type === 'limit_reached' ? 'Member Spending Limit Reached' : 'Member Approaching Limit',
      message: `${member_email} has used ${percentUsed}% of their $${spending_limit.toFixed(2)} limit`,
      data: { team_id, user_id, current_spending, spending_limit, threshold },
    });

    console.log('Spending alert sent successfully');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in spending-alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
