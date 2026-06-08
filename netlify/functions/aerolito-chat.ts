import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
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

// Atribuições validadas pelo owner via painel admin (botão "Publicar na trajetória").
// Lê o blob `aerolito/published-bullets.json` (mesma key usada por aerolito-bullets.ts
// e aerolito-admin.ts) e injeta como bloco contextual no system prompt. Só ativo
// quando o blob existe (= após o owner clicar Publicar). Antes disso, retorna string
// vazia e a IA cai no contexto bruto via RAG (getAerolitoContextSafe).
async function getPublishedBulletsContext(): Promise<string> {
  try {
    let store;
    try {
      store = getStore("blog");
    } catch (e) {
      if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return "";
      throw e;
    }
    const raw = await store.get("aerolito/published-bullets.json", { type: "json" });
    if (!raw || typeof raw !== "object") return "";
    const candidate = raw as { bullets?: unknown };
    if (!Array.isArray(candidate.bullets) || candidate.bullets.length === 0) return "";
    const bullets = candidate.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0);
    if (bullets.length === 0) return "";
    const list = bullets.map((b) => `- ${b}`).join("\n");
    return `\n\n---\n\n## ATRIBUIÇÕES VALIDADAS DO MEU PAPEL\n(consolidadas a partir das expectativas do time da Aerolito, publicadas pelo Guilherme após curadoria no painel admin)\n\n${list}\n\nQuando perguntarem sobre meu papel, meus focos ou meus 90 primeiros dias na Aerolito, use esses bullets como referência principal. Eles representam o que o time validou que eu devo entregar.`;
  } catch (err) {
    console.error("aerolito-chat: getPublishedBulletsContext failed", err);
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
    const [{ token, expiresAt }, blogContext, aerolitoContext, bulletsContext] = await Promise.all([
      issueLiveToken(apiKey),
      getRagContextSafe(message),
      getAerolitoContextSafe(message),
      getPublishedBulletsContext(),
    ]);

    const fullSystemPrompt = SYSTEM_PROMPT_AEROLITO + blogContext + aerolitoContext + bulletsContext;

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
