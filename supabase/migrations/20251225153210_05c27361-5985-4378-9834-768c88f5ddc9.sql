-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Add policy for admins to update profiles (for blocking users)
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Fix webhook_logs update policy for service role
CREATE POLICY "Service can update webhook logs" ON public.webhook_logs
  FOR UPDATE WITH CHECK (true);