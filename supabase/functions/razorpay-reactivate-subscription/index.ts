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
      .select('razorpay_subscription_id, plan, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.razorpay_subscription_id) {
      throw new Error('No Razorpay subscription found');
    }

    if (!subscription.cancel_at_period_end) {
      throw new Error('Subscription is not scheduled for cancellation');
    }

    console.log(`Reactivating subscription ${subscription.razorpay_subscription_id} for user ${user.id}`);

    // Resume the Razorpay subscription by updating it
    const resumeResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancel_at_cycle_end: 0, // Resume the subscription
        }),
      }
    );

    if (!resumeResponse.ok) {
      const error = await resumeResponse.text();
      console.error('Failed to reactivate Razorpay subscription:', error);
      throw new Error('Failed to reactivate subscription with payment provider');
    }

    const resumeData = await resumeResponse.json();
    console.log('Razorpay resume response:', resumeData);

    // Update the subscription in database
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update subscription in database:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription reactivated successfully',
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
