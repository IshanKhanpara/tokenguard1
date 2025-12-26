-- Add admin role to your accounts
INSERT INTO public.user_roles (user_id, role) 
VALUES 
  ('3e68a4d1-e9c2-4a0c-ab1a-1d370afe87ff', 'admin'),
  ('f8dcfa53-be70-460b-b914-158dc33460c1', 'admin'),
  ('681ea9c4-5d1f-4cdd-9f86-da004d7e9ad6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;