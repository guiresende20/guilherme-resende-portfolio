import type { Handler, HandlerEvent } from "@netlify/functions";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";

// Endpoint que emite token efêmero da Gemini Live API.
// O token é single-use, vive 30min, e funciona APENAS com Live API v1alpha.
// A master key (GEMINI_API_KEY) nunca deixa o servidor.

const LIVE_TOKEN_RATE_LIMITS = [
  { limit: 5, windowMs: 60_000, label: "min" },
  { limit: 30, windowMs: 60 * 60_000, label: "hour" },
];

const TOKEN_LIFETIME_MS = 30 * 60_000;       // 30min para conversa
const SESSION_START_WINDOW_MS = 2 * 60_000;  // cliente tem 2min para iniciar a sessão

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
  const rate = checkRateLimits("live-token", ip, LIVE_TOKEN_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("live-token: GEMINI_API_KEY ausente");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
  }

  const now = Date.now();
  const expireTime = new Date(now + TOKEN_LIFETIME_MS).toISOString();
  const newSessionExpireTime = new Date(now + SESSION_START_WINDOW_MS).toISOString();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uses: 1,
          expireTime,
          newSessionExpireTime,
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("live-token: Gemini auth_tokens failed", response.status, errBody);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Não foi possível iniciar o modo voz" }) };
    }

    const data = (await response.json()) as { name?: string };
    if (!data.name) {
      console.error("live-token: response sem campo name", data);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: data.name, expiresAt: expireTime }),
    };
  } catch (error: unknown) {
    console.error("live-token error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
  }
};

export { handler };
