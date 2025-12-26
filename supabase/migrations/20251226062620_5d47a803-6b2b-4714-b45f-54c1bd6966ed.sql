-- Remove Stripe columns from teams table since we're using Razorpay only
ALTER TABLE public.teams 
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;