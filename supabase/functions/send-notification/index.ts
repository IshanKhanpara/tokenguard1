import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "welcome" | "payment_success" | "payment_failed" | "usage_warning" | "subscription_cancelled";
  to: string;
  data?: Record<string, unknown>;
}

const getEmailContent = (type: string, data: Record<string, unknown> = {}) => {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f7; }
      .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
      .card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
      .logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
      .logo-text { font-size: 24px; font-weight: 700; color: #1a1a2e; }
      h1 { color: #1a1a2e; font-size: 28px; margin: 0 0 16px; }
      p { color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 16px; }
      .highlight { background: #f0f9ff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 24px 0; }
      .highlight strong { color: #1a1a2e; }
      .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #a855f7); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 24px; }
      .footer { text-align: center; margin-top: 32px; color: #94a3b8; font-size: 14px; }
      .warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
      .success { background: #d1fae5; border-left: 4px solid #10b981; }
      .error { background: #fee2e2; border-left: 4px solid #ef4444; }
    </style>
  `;

  const emails: Record<string, { subject: string; html: string }> = {
    welcome: {
      subject: "Welcome to TokenGuard! 🛡️",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <div class="logo-icon">🛡️</div>
                <span class="logo-text">TokenGuard</span>
              </div>
              <h1>Welcome to TokenGuard!</h1>
              <p>Thanks for signing up! You're now ready to take control of your AI API costs.</p>
              <div class="highlight">
                <strong>What's next?</strong>
                <p style="margin-top: 8px; margin-bottom: 0;">Add your OpenAI API key to start tracking usage and preventing overspending.</p>
              </div>
              <p>With TokenGuard, you can:</p>
              <ul style="color: #64748b; line-height: 2;">
                <li>Monitor token usage in real-time</li>
                <li>Detect cost spikes automatically</li>
                <li>Set budget limits and alerts</li>
                <li>Optimize your AI spending</li>
              </ul>
              <a href="https://tokenguard.app/dashboard" class="btn">Go to Dashboard</a>
              <div class="footer">
                <p>© 2025 TokenGuard. AI API Cost Optimizer & Usage Guard.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    payment_success: {
      subject: "Payment Successful - TokenGuard",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <div class="logo-icon">🛡️</div>
                <span class="logo-text">TokenGuard</span>
              </div>
              <h1>Payment Successful! ✅</h1>
              <p>Your payment has been processed successfully.</p>
              <div class="highlight success">
                <strong>Plan: ${data.plan || "Pro"}</strong>
                <p style="margin-top: 8px; margin-bottom: 0;">Amount: $${data.amount || "19"} USD</p>
              </div>
              <p>Your subscription is now active. Enjoy all the premium features!</p>
              <a href="https://tokenguard.app/dashboard" class="btn">View Dashboard</a>
              <div class="footer">
                <p>© 2025 TokenGuard. AI API Cost Optimizer & Usage Guard.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    payment_failed: {
      subject: "Payment Failed - Action Required",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <div class="logo-icon">🛡️</div>
                <span class="logo-text">TokenGuard</span>
              </div>
              <h1>Payment Failed ❌</h1>
              <p>We were unable to process your payment.</p>
              <div class="highlight error">
                <strong>Action Required</strong>
                <p style="margin-top: 8px; margin-bottom: 0;">Please update your payment method to continue using TokenGuard Pro features.</p>
              </div>
              <p>If you believe this is an error, please contact us at <a href="mailto:tokenguardapp@gmail.com" style="color: #6366f1;">tokenguardapp@gmail.com</a>.</p>
              <a href="https://tokenguard.app/pricing" class="btn">Update Payment Method</a>
              <div class="footer">
                <p>© 2025 TokenGuard. AI API Cost Optimizer & Usage Guard.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    usage_warning: {
      subject: "⚠️ Usage Alert: 80% of Monthly Limit Reached",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <div class="logo-icon">🛡️</div>
                <span class="logo-text">TokenGuard</span>
              </div>
              <h1>Usage Warning ⚠️</h1>
              <p>You've used 80% of your monthly token limit.</p>
              <div class="highlight warning">
                <strong>Current Usage: ${data.tokensUsed?.toLocaleString() || "0"} / ${data.tokenLimit?.toLocaleString() || "100,000"} tokens</strong>
                <p style="margin-top: 8px; margin-bottom: 0;">Usage: ${data.percentUsed || "80"}%</p>
              </div>
              <p>To avoid service interruption, consider:</p>
              <ul style="color: #64748b; line-height: 2;">
                <li>Upgrading to a higher plan</li>
                <li>Optimizing your API usage</li>
                <li>Waiting until your limit resets next month</li>
              </ul>
              <a href="https://tokenguard.app/pricing" class="btn">Upgrade Plan</a>
              <div class="footer">
                <p>© 2025 TokenGuard. AI API Cost Optimizer & Usage Guard.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    subscription_cancelled: {
      subject: "Subscription Cancelled - TokenGuard",
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <div class="logo-icon">🛡️</div>
                <span class="logo-text">TokenGuard</span>
              </div>
              <h1>Subscription Cancelled</h1>
              <p>Your TokenGuard subscription has been cancelled.</p>
              <div class="highlight">
                <strong>What happens next?</strong>
                <p style="margin-top: 8px; margin-bottom: 0;">You'll continue to have access to your current plan until the end of your billing period.</p>
              </div>
              <p>We're sorry to see you go! If you change your mind, you can resubscribe at any time.</p>
              <a href="https://tokenguard.app/pricing" class="btn">Resubscribe</a>
              <div class="footer">
                <p>© 2025 TokenGuard. AI API Cost Optimizer & Usage Guard.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  };

  return emails[type] || { subject: "TokenGuard Notification", html: "<p>Notification from TokenGuard</p>" };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Send notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();
    console.log(`Sending ${type} email to ${to}`);

    if (!type || !to) {
      throw new Error("Missing required fields: type and to");
    }

    const emailContent = getEmailContent(type, data);

    const emailResponse = await resend.emails.send({
      from: "TokenGuard <onboarding@resend.dev>",
      to: [to],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);