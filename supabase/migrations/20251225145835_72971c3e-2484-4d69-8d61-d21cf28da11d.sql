-- Create billing_history table for storing invoices and payment receipts
CREATE TABLE public.billing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_invoice_id TEXT,
  amount_usd NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  invoice_url TEXT,
  receipt_url TEXT,
  plan TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own billing history
CREATE POLICY "Users can view own billing history"
ON public.billing_history
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all billing history
CREATE POLICY "Admins can view all billing history"
ON public.billing_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert billing records (via service role)
CREATE POLICY "Service can insert billing history"
ON public.billing_history
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_billing_history_user_id ON public.billing_history(user_id);
CREATE INDEX idx_billing_history_created_at ON public.billing_history(created_at DESC);