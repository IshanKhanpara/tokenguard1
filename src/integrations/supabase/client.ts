import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://wsfiibentgbnhiuztbgh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZmlpYmVudGdibmhpdXp0YmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NjczMTIsImV4cCI6MjA4MjI0MzMxMn0.21zYozq3DyEMYy7-ozXDxf7uinSVSVROVXPego6_kj0';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
