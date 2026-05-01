import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";

const LOG_VOICE_RATE_LIMITS = [{ limit: 30, windowMs: 60_000, label: "min" }];

const MAX_FIELD_LEN = 5000;

function sanitizeField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.slice(0, MAX_FIELD_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

const handler: Handler = async (event: HandlerEvent) => {
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }

  if (!allowed) {
    return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };
  }

  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("log-voice", ip, LOG_VOICE_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const ai_response = sanitizeField(body.ai_response);
    const user_message = sanitizeField(body.user_message);

    if (!ai_response) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Payload inválido" }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("log-voice: Supabase env vars ausentes");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("chat_logs").insert({
      voice: user_message,
      ai_response,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (error: unknown) {
    console.error("log-voice error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
  }
};

export { handler };
