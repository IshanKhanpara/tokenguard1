import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

// Plan IDs from Razorpay Dashboard
const PLAN_IDS: Record<string, string> = {
  'pro': 'plan_Rw8zFgNcdSgVzV',
  'team': 'plan_Rw90LLpnAFTWTQ',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { newPlan } = await req.json();
    
    if (!newPlan || !['pro', 'team'].includes(newPlan)) {
      throw new Error('Invalid plan. Must be "pro" or "team"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get the user's current subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('razorpay_subscription_id, plan, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.razorpay_subscription_id) {
      throw new Error('No active Razorpay subscription found. Please subscribe first.');
    }

    if (subscription.plan === newPlan) {
      throw new Error(`Already on the ${newPlan} plan`);
    }

    if (subscription.plan === 'free') {
      throw new Error('Cannot change plan from free. Please subscribe first.');
    }

    if (subscription.cancel_at_period_end) {
      throw new Error('Cannot change plan while subscription is scheduled for cancellation. Please reactivate first.');
    }

    const newPlanId = PLAN_IDS[newPlan];
    if (!newPlanId) {
      throw new Error(`Plan ID not configured for ${newPlan}`);
    }

    console.log(`Changing subscription ${subscription.razorpay_subscription_id} from ${subscription.plan} to ${newPlan} for user ${user.id}`);

    // Update the Razorpay subscription to the new plan
    // Razorpay handles proration automatically when changing plans
    const updateResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: newPlanId,
          schedule_change_at: 'now', // Apply change immediately with proration
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Failed to update Razorpay subscription:', errorText);
      throw new Error('Failed to update subscription with payment provider');
    }

    const updateData = await updateResponse.json();
    console.log('Razorpay update response:', updateData);

    // Update the subscription in database immediately
    // The webhook will also update it, but we do it here for immediate UI feedback
    const { error: dbError } = await supabaseClient
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Failed to update subscription in database:', dbError);
      // Don't throw - the webhook will handle it
    }

    // Log the plan change
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await serviceClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'subscription.plan_changed',
      resource_type: 'subscription',
      details: {
        from_plan: subscription.plan,
        to_plan: newPlan,
        razorpay_subscription_id: subscription.razorpay_subscription_id,
      },
    });

    const isUpgrade = (subscription.plan === 'pro' && newPlan === 'team');
    const actionType = isUpgrade ? 'upgraded' : 'downgraded';

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully ${actionType} to ${newPlan} plan`,
      newPlan,
      isUpgrade,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
