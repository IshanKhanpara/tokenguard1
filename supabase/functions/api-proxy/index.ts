import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key-id, x-target-url",
};

// Allowed API domains for SSRF prevention
const ALLOWED_DOMAINS = [
  // OpenAI
  "api.openai.com",
  // Anthropic
  "api.anthropic.com",
  // Cohere
  "api.cohere.ai",
  "api.cohere.com",
  // Google
  "generativelanguage.googleapis.com",
  "aiplatform.googleapis.com",
  // Together AI
  "api.together.xyz",
  // Replicate
  "api.replicate.com",
  // Mistral
  "api.mistral.ai",
  // Groq
  "api.groq.com",
  // Perplexity
  "api.perplexity.ai",
  // Fireworks
  "api.fireworks.ai",
  // DeepInfra
  "api.deepinfra.com",
  // Anyscale
  "api.anyscale.com",
  // Hugging Face
  "api-inference.huggingface.co",
  "huggingface.co",
  // Azure OpenAI
  "openai.azure.com",
  // AWS Bedrock
  "bedrock-runtime.us-east-1.amazonaws.com",
  "bedrock-runtime.us-west-2.amazonaws.com",
  "bedrock-runtime.eu-west-1.amazonaws.com",
  // Stability AI
  "api.stability.ai",
  // AI21
  "api.ai21.com",
  // Voyage AI
  "api.voyageai.com",
  // Cerebras
  "api.cerebras.ai",
  // Lovable AI Gateway
  "ai.gateway.lovable.dev",
];

// Blocked IP ranges for SSRF prevention
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
];

// Cloud metadata endpoints to block
const BLOCKED_HOSTNAMES = [
  "169.254.169.254",           // AWS/GCP/Azure metadata
  "metadata.google.internal",  // GCP metadata
  "metadata.goog",             // GCP metadata alternative
  "localhost",
  "0.0.0.0",
];

// Input validation schema
const proxyRequestSchema = z.object({
  targetUrl: z.string().url().max(2000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional().default("POST"),
  headers: z.record(z.string().max(1000)).optional().default({}),
  body: z.unknown().optional(),
  apiKeyId: z.string().uuid().optional(),
});

// Validate URL is allowed
function validateTargetUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    
    // Check protocol
    if (url.protocol !== "https:") {
      return { valid: false, error: "Only HTTPS URLs are allowed" };
    }
    
    // Check against blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(url.hostname.toLowerCase())) {
      return { valid: false, error: "Target URL is not permitted" };
    }
    
    // Check for IP-based URLs and block private ranges
    const ipMatch = url.hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch) {
      for (const pattern of BLOCKED_IP_PATTERNS) {
        if (pattern.test(url.hostname)) {
          return { valid: false, error: "Target URL is not permitted" };
        }
      }
    }
    
    // Check against allowed domains
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      return { valid: false, error: `Domain '${url.hostname}' is not in the allowed list` };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

// Simple token estimation - approximately 4 characters per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Estimate cost based on model (simplified pricing)
function estimateCost(tokens: number, model?: string): number {
  const costPer1kTokens: Record<string, number> = {
    'gpt-4': 0.06,
    'gpt-4-turbo': 0.03,
    'gpt-3.5-turbo': 0.002,
    'claude-3-opus': 0.075,
    'claude-3-sonnet': 0.015,
    'claude-3-haiku': 0.00125,
    'default': 0.01,
  };
  
  const rate = model ? (costPer1kTokens[model] || costPer1kTokens.default) : costPer1kTokens.default;
  return (tokens / 1000) * rate;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("API Proxy function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // Parse and validate request
    const rawBody = await req.json();
    const parseResult = proxyRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request parameters", details: parseResult.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { targetUrl, method, headers, body, apiKeyId } = parseResult.data;

    // Validate target URL against allowlist
    const urlValidation = validateTargetUrl(targetUrl);
    if (!urlValidation.valid) {
      console.error(`URL validation failed: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Estimate tokens for the request
    const requestText = JSON.stringify(body || {});
    const estimatedInputTokens = estimateTokens(requestText);

    // Check usage limits BEFORE making the request
    const checkResponse = await fetch(`${supabaseUrl}/functions/v1/check-usage-limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ 
        userId: user.id, 
        tokensToUse: estimatedInputTokens 
      }),
    });

    const checkResult = await checkResponse.json();
    console.log("Usage check result:", checkResult);

    if (!checkResult.allowed) {
      console.log("Request blocked due to usage limit");
      return new Response(
        JSON.stringify({ 
          error: "Usage limit exceeded",
          message: checkResult.reason,
          percentUsed: checkResult.percentUsed,
          limit: checkResult.limit,
          current: checkResult.current,
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the decrypted API key if apiKeyId is provided
    let apiKey: string | null = null;
    if (apiKeyId) {
      const { data: keyData, error: keyError } = await supabase
        .from("api_keys")
        .select("encrypted_key")
        .eq("id", apiKeyId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (keyError || !keyData) {
        console.error("API key error:", keyError);
        return new Response(
          JSON.stringify({ error: "Invalid or inactive API key" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Decrypt the API key
      const encryptionKey = Deno.env.get("ENCRYPTION_KEY")!;
      try {
        const [ivHex, encryptedHex] = keyData.encrypted_key.split(":");
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(encryptionKey.padEnd(32, "0").slice(0, 32)),
          { name: "AES-GCM" },
          false,
          ["decrypt"]
        );
        
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          keyMaterial,
          encrypted
        );
        
        apiKey = new TextDecoder().decode(decrypted);
      } catch (decryptError) {
        console.error("Decryption error:", decryptError);
        return new Response(
          JSON.stringify({ error: "Failed to decrypt API key" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Prepare headers for the target API
    const targetHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (apiKey) {
      targetHeaders["Authorization"] = `Bearer ${apiKey}`;
    }

    console.log(`Proxying request to: ${targetUrl}`);

    // Make the actual API request
    const startTime = Date.now();
    const targetResponse = await fetch(targetUrl, {
      method,
      headers: targetHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await targetResponse.text();
    const duration = Date.now() - startTime;
    console.log(`Target API responded in ${duration}ms with status ${targetResponse.status}`);

    // Estimate tokens for the response
    const estimatedOutputTokens = estimateTokens(responseText);
    const totalTokens = estimatedInputTokens + estimatedOutputTokens;

    // Try to extract model from request body for better cost estimation
    const model = (body as Record<string, unknown>)?.model as string | undefined;
    const estimatedCost = estimateCost(totalTokens, model);

    // Record usage
    const recordResponse = await fetch(`${supabaseUrl}/functions/v1/record-usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        userId: user.id,
        tokensUsed: totalTokens,
        costUsd: estimatedCost,
        model: model || "unknown",
        endpoint: targetUrl,
        apiKeyId,
      }),
    });

    const recordResult = await recordResponse.json();
    console.log("Usage recorded:", recordResult);

    // Parse response for client
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Return the response with usage metadata
    return new Response(
      JSON.stringify({
        data: responseData,
        usage: {
          tokensUsed: totalTokens,
          estimatedCost,
          percentUsed: recordResult.percentUsed,
          shouldWarn: recordResult.shouldWarn,
        },
      }),
      { 
        status: targetResponse.status, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Proxy error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "An error occurred while processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
