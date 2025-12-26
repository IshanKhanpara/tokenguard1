import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
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

    // Get the user's subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('razorpay_subscription_id, plan, status')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.razorpay_subscription_id) {
      throw new Error('No active Razorpay subscription found');
    }

    if (subscription.plan === 'free') {
      throw new Error('Already on free plan');
    }

    console.log(`Cancelling subscription ${subscription.razorpay_subscription_id} for user ${user.id}`);

    // Cancel the Razorpay subscription
    const cancelResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_at_cycle_end: true, // Cancel at end of billing period
        }),
      }
    );

    if (!cancelResponse.ok) {
      const error = await cancelResponse.text();
      console.error('Failed to cancel Razorpay subscription:', error);
      throw new Error('Failed to cancel subscription with payment provider');
    }

    const cancelData = await cancelResponse.json();
    console.log('Razorpay cancel response:', cancelData);

    // Update the subscription in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update subscription in database:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancel_at: cancelData.current_end,
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
