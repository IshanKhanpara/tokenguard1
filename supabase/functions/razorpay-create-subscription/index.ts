import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

// Razorpay Plan IDs from Dashboard
const PLAN_IDS: Record<string, string> = {
  pro: 'plan_Rw8zFgNcdSgVzV',
  team: 'plan_Rw90LLpnAFTWTQ',
};

// Input validation schema
const subscriptionRequestSchema = z.object({
  plan: z.enum(["pro", "team"]),
});

serve(async (req) => {
  console.log('Function invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if Razorpay credentials are configured
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials not configured');
      return new Response(JSON.stringify({ 
        error: 'Payment system not configured. Please contact support.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    console.log('Request body:', JSON.stringify(rawBody));
    
    const parseResult = subscriptionRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid plan specified. Must be 'pro' or 'team'." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { plan } = parseResult.data;
    console.log(`Creating subscription for user ${user.id}, email: ${user.email}, plan: ${plan}`);

    // Get or create Razorpay customer
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('razorpay_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.razorpay_customer_id;
    console.log('Existing customer ID:', customerId);

    if (!customerId) {
      // Create Razorpay customer
      console.log('Creating new Razorpay customer...');
      const customerResponse = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email,
          email: user.email,
          fail_existing: '0',
        }),
      });

      const customerText = await customerResponse.text();
      console.log('Customer API response status:', customerResponse.status);
      console.log('Customer API response:', customerText);

      if (!customerResponse.ok) {
        console.error('Failed to create Razorpay customer:', customerText);
        return new Response(JSON.stringify({ 
          error: 'Failed to create payment customer. Please try again.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const customerData = JSON.parse(customerText);
      customerId = customerData.id;
      console.log('Created customer ID:', customerId);

      // Update subscription record with customer ID
      const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({ razorpay_customer_id: customerId })
        .eq('user_id', user.id);
      
      if (updateError) {
        console.error('Failed to update subscription with customer ID:', updateError);
      }
    }

    // Create Razorpay subscription
    console.log('Creating Razorpay subscription with plan:', PLAN_IDS[plan]);
    const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: PLAN_IDS[plan],
        customer_id: customerId,
        total_count: 120, // Max billing cycles
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          plan: plan,
        },
      }),
    });

    const subscriptionText = await subscriptionResponse.text();
    console.log('Subscription API response status:', subscriptionResponse.status);
    console.log('Subscription API response:', subscriptionText);

    if (!subscriptionResponse.ok) {
      console.error('Failed to create Razorpay subscription:', subscriptionText);
      return new Response(JSON.stringify({ 
        error: 'Failed to create subscription. Please try again or contact support.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionData = JSON.parse(subscriptionText);
    console.log(`Subscription created successfully: ${subscriptionData.id}`);

    // Return subscription details for checkout
    return new Response(JSON.stringify({
      subscription_id: subscriptionData.id,
      razorpay_key: RAZORPAY_KEY_ID,
      amount: plan === 'pro' ? 180000 : 450000, // Amount in paise (INR)
      currency: 'INR',
      name: 'TokenGuard',
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly`,
      prefill: {
        email: user.email,
        name: user.user_metadata?.full_name || '',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
