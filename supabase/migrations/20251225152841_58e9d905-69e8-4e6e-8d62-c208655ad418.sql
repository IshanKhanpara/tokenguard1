-- Admin notifications table
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('new_ticket', 'payment_failed', 'new_user', 'subscription_cancelled', 'refund_processed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view notifications
CREATE POLICY "Admins can view notifications" ON public.admin_notifications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (mark as read)
CREATE POLICY "Admins can update notifications" ON public.admin_notifications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Service can insert
CREATE POLICY "Service can insert notifications" ON public.admin_notifications
  FOR INSERT WITH CHECK (true);

-- Enable realtime for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;

-- Function to create admin notification on new support ticket
CREATE OR REPLACE FUNCTION public.notify_admin_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (
    'new_ticket',
    'New Support Ticket',
    'New ' || NEW.priority || ' priority ticket: ' || substring(NEW.subject for 50),
    jsonb_build_object(
      'ticket_id', NEW.id,
      'email', NEW.email,
      'subject', NEW.subject,
      'priority', NEW.priority
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger for new support tickets
CREATE TRIGGER on_new_support_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_ticket();