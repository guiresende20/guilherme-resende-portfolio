import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { embedText } from "./_lib/embeddings";
import { appendAerolitoChunk } from "./_lib/aerolito-vector";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SubmitPayload {
  session_id: string;
  question_idx: number;
  question_text: string;
  answer_text: string;
}

export function validateSubmitPayload(input: unknown): SubmitPayload | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;

  const session_id = obj.session_id;
  if (typeof session_id !== "string" || !UUID_REGEX.test(session_id)) return null;

  const question_idx = obj.question_idx;
  if (typeof question_idx !== "number" || !Number.isInteger(question_idx)) return null;
  if (question_idx < 1 || question_idx > 5) return null;

  const question_text_raw = obj.question_text;
  if (typeof question_text_raw !== "string") return null;
  const question_text = question_text_raw.trim();
  if (question_text.length === 0 || question_text.length > 300) return null;

  const answer_text_raw = obj.answer_text;
  if (typeof answer_text_raw !== "string") return null;
  const answer_text = answer_text_raw.trim();
  if (answer_text.length === 0 || answer_text.length > 2000) return null;

  return { session_id, question_idx, question_text, answer_text };
}

const SUBMIT_RATE_LIMITS = [
  { limit: 10, windowMs: 60_000, label: "min" },
  { limit: 30, windowMs: 60 * 60_000, label: "hour" },
];

function hashIp(ip: string): string {
  const salt = process.env.AEROLITO_IP_HASH_SALT ?? "default-salt-change-me";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

async function indexResponseAsync(id: string, payload: SubmitPayload, supabaseUrl: string, supabaseKey: string): Promise<void> {
  try {
    const text = `P: ${payload.question_text}\nR: ${payload.answer_text}`;
    const vector = await embedText(text);
    await appendAerolitoChunk({
      id,
      text,
      vector,
      questionIdx: payload.question_idx,
      createdAt: new Date().toISOString(),
    });
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("aerolito_responses").update({ indexed: true }).eq("id", id);
  } catch (err) {
    console.error("aerolito-submit: async indexing failed", err);
    // intentional: do not throw — user already got 200
  }
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
  const rate = checkRateLimits("aerolito-submit", ip, SUBMIT_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid json" }) }; }

  const payload = validateSubmitPayload(parsed);
  if (!payload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid" }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("aerolito-submit: missing supabase env vars");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .insert({
      session_id: payload.session_id,
      question_idx: payload.question_idx,
      question_text: payload.question_text,
      answer_text: payload.answer_text,
      ip_hash: hashIp(ip),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("aerolito-submit: insert failed", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "save failed" }) };
  }

  // Fire-and-forget: respondemos OK ao colega imediatamente; indexação roda em background.
  // Erros são logados mas não afetam UX (admin pode reindexar depois).
  indexResponseAsync(data.id, payload, supabaseUrl, supabaseKey).catch(() => {});

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id: data.id }) };
};

export { handler };
