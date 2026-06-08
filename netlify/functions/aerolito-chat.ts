import type { Handler, HandlerEvent } from "@netlify/functions";
import { SYSTEM_PROMPT_AEROLITO } from "../../src/lib/system-prompt-aerolito";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { retrieveRelevantChunks } from "./_lib/rag";
import { searchAerolito } from "./_lib/aerolito-vector";
import { embedText } from "./_lib/embeddings";
import { ensureBlobsContext } from "./_lib/blobs-context";

const CHAT_RATE_LIMITS = [
  { limit: 10, windowMs: 60_000, label: "min" },
  { limit: 30, windowMs: 60 * 60_000, label: "hour" },
];

const TOKEN_LIFETIME_MS = 30 * 60_000;
const SESSION_START_WINDOW_MS = 2 * 60_000;
const RAG_TIMEOUT_MS = 1500;

async function getRagContextSafe(message: string): Promise<string> {
  try {
    return await Promise.race([
      retrieveRelevantChunks(message),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), RAG_TIMEOUT_MS)),
    ]);
  } catch {
    return "";
  }
}

async function getAerolitoContextSafe(message: string): Promise<string> {
  try {
    const trimmed = (message ?? "").trim();
    if (!trimmed) return "";
    const queryVec = await Promise.race([
      embedText(trimmed),
      new Promise<number[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), RAG_TIMEOUT_MS)),
    ]);
    const hits = await searchAerolito(queryVec, { k: 4, threshold: 0.45 });
    if (hits.length === 0) return "";
    const body = hits.map((h) => `[Expectativa do time — Q${h.questionIdx}]\n${h.text}`).join("\n---\n");
    return `\n\n---\n\nEXPECTATIVAS DO TIME AEROLITO (use quando relevante para falar do seu novo papel):\n${body}\n`;
  } catch {
    return "";
  }
}

async function issueLiveToken(apiKey: string): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const expireTime = new Date(now + TOKEN_LIFETIME_MS).toISOString();
  const newSessionExpireTime = new Date(now + SESSION_START_WINDOW_MS).toISOString();
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`auth_tokens failed: ${resp.status} ${body}`);
  }
  const data = (await resp.json()) as { name?: string };
  if (!data.name) throw new Error("missing name field");
  return { token: data.name, expiresAt: expireTime };
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("aerolito-chat", ip, CHAT_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  let message = "";
  try {
    const body = JSON.parse(event.body || "{}");
    if (typeof body.message === "string") message = body.message.slice(0, 2000);
  } catch {
    // tolera body vazio — chat pode pedir token sem mensagem
  }

  try {
    const [{ token, expiresAt }, blogContext, aerolitoContext] = await Promise.all([
      issueLiveToken(apiKey),
      getRagContextSafe(message),
      getAerolitoContextSafe(message),
    ]);

    const fullSystemPrompt = SYSTEM_PROMPT_AEROLITO + blogContext + aerolitoContext;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, expiresAt, fullSystemPrompt }),
    };
  } catch (err) {
    console.error("aerolito-chat: error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro ao iniciar conversa" }) };
  }
};

export { handler };
