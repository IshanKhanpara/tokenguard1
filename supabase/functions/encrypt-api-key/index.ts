import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

// AES-256-GCM encryption for API keys
async function encryptKey(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Import key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encoder.encode(text)
  );
  
  // Convert to hex and combine IV:encrypted
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${ivHex}:${encryptedHex}`;
}

async function decryptKey(encryptedData: string, key: string): Promise<string> {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate encryption key is configured
    if (!ENCRYPTION_KEY) {
      console.error('ENCRYPTION_KEY not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, apiKey, name, provider = 'openai', keyId } = await req.json();

    if (action === 'encrypt') {
      if (!apiKey || !name) {
        return new Response(JSON.stringify({ error: 'API key and name are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check plan limits for API keys
      const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('plan')
        .eq('user_id', user.id)
        .single();

      const { data: planLimits } = await supabaseClient
        .from('plan_limits')
        .select('max_api_keys')
        .eq('plan', subscription?.plan || 'free')
        .single();

      const { count } = await supabaseClient
        .from('api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count !== null && planLimits && count >= planLimits.max_api_keys) {
        return new Response(JSON.stringify({ error: 'API key limit reached for your plan' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const encryptedKey = await encryptKey(apiKey, ENCRYPTION_KEY);
      const keyHint = apiKey.slice(-4);

      const { data, error } = await supabaseClient
        .from('api_keys')
        .insert({
          user_id: user.id,
          name,
          provider,
          encrypted_key: encryptedKey,
          key_hint: keyHint,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting API key:', error);
        return new Response(JSON.stringify({ error: 'Failed to save API key' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`API key saved for user ${user.id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        key: { id: data.id, name: data.name, provider: data.provider, key_hint: data.key_hint }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'decrypt') {
      if (!keyId) {
        return new Response(JSON.stringify({ error: 'Key ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: keyData, error } = await supabaseClient
        .from('api_keys')
        .select('encrypted_key')
        .eq('id', keyId)
        .eq('user_id', user.id)
        .single();

      if (error || !keyData) {
        console.error('Key not found:', error?.message);
        return new Response(JSON.stringify({ error: 'API key not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const decryptedKey = await decryptKey(keyData.encrypted_key, ENCRYPTION_KEY);

        // Update last used
        await supabaseClient
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyId);

        return new Response(JSON.stringify({ apiKey: decryptedKey }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (decryptError) {
        console.error('Decryption failed:', decryptError);
        return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
