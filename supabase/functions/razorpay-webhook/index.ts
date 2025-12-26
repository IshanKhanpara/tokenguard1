import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/* ===================== CONFIG ===================== */

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

/* ===================== UTIL ===================== */

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  const digest = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return digest === signature;
}

const log = (msg: string, data?: unknown) => console.log(`[RAZORPAY-WEBHOOK] ${msg}`, data ?? "");

/* ===================== SERVER ===================== */

serve(async (req) => {
  /* ✅ Allow health checks / browser */
  if (req.method !== "POST") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    const payload = await req.text();

    if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
      log("Missing signature or secret");
      return new Response("ok", { status: 200 });
    }

    const valid = await verifySignature(payload, signature, RAZORPAY_WEBHOOK_SECRET);

    if (!valid) {
      log("Invalid signature");
      return new Response("ok", { status: 200 });
    }

    const event = JSON.parse(payload);
    log("Event received", event.event);

    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    const userId = subscription?.notes?.user_id || payment?.notes?.user_id;

    /* ===================== EVENTS ===================== */

    switch (event.event) {
      case "subscription.activated": {
        if (!userId) break;

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          razorpay_subscription_id: subscription.id,
          plan: subscription.notes?.plan ?? "pro",
          status: "active",
          current_period_start: new Date(subscription.current_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });

        log("Subscription activated", userId);
        break;
      }

      case "subscription.charged": {
        if (!userId) break;

        await supabase.from("billing_history").insert({
          user_id: userId,
          razorpay_payment_id: payment?.id,
          amount_inr: payment?.amount ? payment.amount / 100 : 0,
          currency: payment?.currency ?? "INR",
          status: "paid",
          created_at: new Date().toISOString(),
        });

        log("Subscription charged", userId);
        break;
      }

      case "subscription.cancelled": {
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({
            plan: "free",
            status: "cancelled",
            razorpay_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        log("Subscription cancelled", userId);
        break;
      }

      case "payment.failed": {
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        log("Payment failed", userId);
        break;
      }

      default:
        log("Unhandled event", event.event);
    }

    /* ✅ ALWAYS RETURN 200 TO RAZORPAY */
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error", err);
    return new Response("ok", { status: 200 });
  }
});
