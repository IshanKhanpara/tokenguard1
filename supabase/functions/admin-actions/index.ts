import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const uuidSchema = z.string().uuid();

const blockUserSchema = z.object({
  action: z.literal("block_user"),
  userId: uuidSchema,
});

const unblockUserSchema = z.object({
  action: z.literal("unblock_user"),
  userId: uuidSchema,
});

const changePlanSchema = z.object({
  action: z.literal("change_plan"),
  userId: uuidSchema,
  plan: z.enum(["free", "pro", "team"]),
});

const processRefundSchema = z.object({
  action: z.literal("process_refund"),
  paymentId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, "Invalid payment ID format"),
  amount: z.number().positive().max(100000),
  userId: uuidSchema.optional(),
  reason: z.string().max(500).optional(),
});

const cancelSubscriptionSchema = z.object({
  action: z.literal("cancel_subscription"),
  userId: uuidSchema,
});

const updateTicketSchema = z.object({
  action: z.literal("update_ticket"),
  ticketId: uuidSchema,
  ticketStatus: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  ticketNotes: z.string().max(5000).optional(),
});

const updateSettingSchema = z.object({
  action: z.literal("update_setting"),
  settingKey: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, "Invalid setting key format"),
  settingValue: z.union([
    z.string().max(10000),
    z.number(),
    z.boolean(),
    z.array(z.unknown()),
    z.record(z.unknown()),
  ]),
});

const updatePlanLimitsSchema = z.object({
  action: z.literal("update_plan_limits"),
  plan: z.enum(["free", "pro", "team"]),
  limits: z.object({
    max_tokens_per_month: z.number().int().min(0).max(1000000000).optional(),
    max_api_keys: z.number().int().min(0).max(1000).optional(),
    max_team_members: z.number().int().min(1).max(100).optional(),
    price_usd: z.number().min(0).max(10000).optional(),
    has_advanced_analytics: z.boolean().optional(),
    has_api_access: z.boolean().optional(),
    has_audit_logs: z.boolean().optional(),
    has_priority_support: z.boolean().optional(),
    has_sso: z.boolean().optional(),
  }),
});

const adminActionSchema = z.discriminatedUnion("action", [
  blockUserSchema,
  unblockUserSchema,
  changePlanSchema,
  processRefundSchema,
  cancelSubscriptionSchema,
  updateTicketSchema,
  updateSettingSchema,
  updatePlanLimitsSchema,
]);

// Map internal errors to safe user-facing messages
function getSafeErrorMessage(action: string, errorType: string): string {
  const errorMap: Record<string, Record<string, string>> = {
    block_user: {
      default: "Failed to block user. Please try again.",
    },
    unblock_user: {
      default: "Failed to unblock user. Please try again.",
    },
    change_plan: {
      default: "Failed to change plan. Please try again.",
    },
    process_refund: {
      payment_not_found: "Payment not found.",
      refund_failed: "Refund could not be processed. Please try again.",
      default: "Failed to process refund. Please try again.",
    },
    cancel_subscription: {
      not_found: "Subscription not found.",
      default: "Failed to cancel subscription. Please try again.",
    },
    update_ticket: {
      default: "Failed to update ticket. Please try again.",
    },
    update_setting: {
      default: "Failed to update setting. Please try again.",
    },
    update_plan_limits: {
      default: "Failed to update plan limits. Please try again.",
    },
    default: {
      auth: "Authentication required.",
      unauthorized: "Admin access required.",
      invalid_request: "Invalid request parameters.",
      validation: "Request validation failed.",
      default: "Operation failed. Please try again.",
    },
  };

  const actionErrors = errorMap[action] || errorMap.default;
  return actionErrors[errorType] || actionErrors.default || errorMap.default.default;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let action = "unknown";
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin status
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage("default", "auth") }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage("default", "auth") }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role using RPC
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin"
    });

    if (roleError || !isAdmin) {
      console.error("Role check failed:", roleError?.message);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage("default", "unauthorized") }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = adminActionSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage("default", "validation") }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = parseResult.data;
    action = body.action;

    console.log(`Admin action: ${action} by user ${user.id}`);

    let result: unknown;

    switch (body.action) {
      case "block_user": {
        const { userId } = body;
        
        const { error } = await supabase
          .from("profiles")
          .update({ is_blocked: true })
          .eq("user_id", userId);
        
        if (error) {
          console.error("Block user error:", error);
          throw new Error("db_error");
        }

        // Log audit
        await supabase.from("audit_logs").insert({
          action: "user_blocked",
          actor_id: user.id,
          user_id: userId,
          resource_type: "user",
          resource_id: userId,
          details: { blocked_by: user.id }
        });

        result = { success: true, message: "User blocked" };
        break;
      }

      case "unblock_user": {
        const { userId } = body;
        
        const { error } = await supabase
          .from("profiles")
          .update({ is_blocked: false })
          .eq("user_id", userId);
        
        if (error) {
          console.error("Unblock user error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "user_unblocked",
          actor_id: user.id,
          user_id: userId,
          resource_type: "user",
          resource_id: userId,
          details: { unblocked_by: user.id }
        });

        result = { success: true, message: "User unblocked" };
        break;
      }

      case "change_plan": {
        const { userId, plan } = body;

        const { error } = await supabase
          .from("subscriptions")
          .update({ plan, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        
        if (error) {
          console.error("Change plan error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "plan_changed",
          actor_id: user.id,
          user_id: userId,
          resource_type: "subscription",
          details: { new_plan: plan, changed_by: user.id }
        });

        result = { success: true, message: `Plan changed to ${plan}` };
        break;
      }

      case "process_refund": {
        const { paymentId, amount, reason, userId } = body;

        const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
        const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

        if (!razorpayKeyId || !razorpayKeySecret) {
          console.error("Razorpay credentials not configured");
          return new Response(
            JSON.stringify({ error: getSafeErrorMessage("process_refund", "default") }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get payment details
        const paymentResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
            },
          }
        );

        if (!paymentResponse.ok) {
          console.error("Failed to fetch payment details");
          return new Response(
            JSON.stringify({ error: getSafeErrorMessage("process_refund", "payment_not_found") }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Process refund
        const refundResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
            },
            body: JSON.stringify({
              amount: amount * 100, // Convert to paise
              notes: { reason: reason || "Admin initiated refund" }
            }),
          }
        );

        const refundData = await refundResponse.json();

        if (!refundResponse.ok) {
          console.error("Refund failed:", refundData);
          return new Response(
            JSON.stringify({ error: getSafeErrorMessage("process_refund", "refund_failed") }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Update billing history
        if (userId) {
          await supabase.from("billing_history").insert({
            user_id: userId,
            razorpay_payment_id: paymentId,
            amount_usd: -amount,
            status: "refunded",
            description: "Refund processed",
          });
        }

        await supabase.from("audit_logs").insert({
          action: "refund_processed",
          actor_id: user.id,
          user_id: userId,
          resource_type: "payment",
          resource_id: paymentId,
          details: { amount, refund_id: refundData.id }
        });

        result = { success: true, message: "Refund processed successfully" };
        break;
      }

      case "cancel_subscription": {
        const { userId } = body;

        // Get subscription
        const { data: sub, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (subError || !sub) {
          console.error("Subscription not found:", subError?.message);
          return new Response(
            JSON.stringify({ error: getSafeErrorMessage("cancel_subscription", "not_found") }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (sub.razorpay_subscription_id) {
          const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
          const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

          // Cancel on Razorpay
          const cancelResponse = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
              },
              body: JSON.stringify({ cancel_at_cycle_end: false }),
            }
          );

          if (!cancelResponse.ok) {
            console.error("Razorpay cancel failed");
          }
        }

        // Update subscription
        const { error } = await supabase
          .from("subscriptions")
          .update({ 
            status: "cancelled", 
            plan: "free",
            razorpay_subscription_id: null,
            updated_at: new Date().toISOString() 
          })
          .eq("user_id", userId);

        if (error) {
          console.error("Cancel subscription error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "subscription_cancelled",
          actor_id: user.id,
          user_id: userId,
          resource_type: "subscription",
          details: { cancelled_by: user.id }
        });

        result = { success: true, message: "Subscription cancelled" };
        break;
      }

      case "update_ticket": {
        const { ticketId, ticketStatus, ticketNotes } = body;

        const updates: Record<string, unknown> = {};
        if (ticketStatus) updates.status = ticketStatus;
        if (ticketNotes !== undefined) updates.admin_notes = ticketNotes;
        updates.assigned_to = user.id;

        const { error } = await supabase
          .from("support_tickets")
          .update(updates)
          .eq("id", ticketId);

        if (error) {
          console.error("Update ticket error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "ticket_updated",
          actor_id: user.id,
          resource_type: "support_ticket",
          resource_id: ticketId,
          details: { status: ticketStatus }
        });

        result = { success: true, message: "Ticket updated" };
        break;
      }

      case "update_setting": {
        const { settingKey, settingValue } = body;

        const { error } = await supabase
          .from("system_settings")
          .update({ 
            value: settingValue,
            updated_by: user.id 
          })
          .eq("key", settingKey);

        if (error) {
          console.error("Update setting error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "setting_updated",
          actor_id: user.id,
          resource_type: "system_setting",
          resource_id: settingKey,
          details: { key: settingKey }
        });

        result = { success: true, message: "Setting updated" };
        break;
      }

      case "update_plan_limits": {
        const { plan, limits } = body;

        const { error } = await supabase
          .from("plan_limits")
          .update(limits)
          .eq("plan", plan);

        if (error) {
          console.error("Update plan limits error:", error);
          throw new Error("db_error");
        }

        await supabase.from("audit_logs").insert({
          action: "plan_limits_updated",
          actor_id: user.id,
          resource_type: "plan_limits",
          resource_id: plan,
          details: { plan }
        });

        result = { success: true, message: "Plan limits updated" };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: getSafeErrorMessage("default", "invalid_request") }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Admin action error:", error);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(action, "default") }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
