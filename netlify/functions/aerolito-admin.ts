import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { ensureBlobsContext } from "./_lib/blobs-context";

export function isAuthorized(authHeader: string | undefined | null): boolean {
  if (!authHeader) return false;
  const expected = process.env.AEROLITO_ADMIN_TOKEN;
  if (!expected) return false;
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return false;
  return authHeader.slice(prefix.length) === expected;
}

export function validateBulletsPayload(input: unknown): string[] | null {
  if (!input || typeof input !== "object") return null;
  const bullets = (input as { bullets?: unknown }).bullets;
  if (!Array.isArray(bullets)) return null;
  if (bullets.length < 4 || bullets.length > 6) return null;
  const out: string[] = [];
  for (const b of bullets) {
    if (typeof b !== "string") return null;
    const t = b.trim();
    if (t.length === 0 || t.length > 200) return null;
    out.push(t);
  }
  return out;
}

interface SessionGroup {
  session_id: string;
  created_at: string;
  responses: Array<{
    question_idx: number;
    question_text: string;
    answer_text: string;
    indexed: boolean;
    published: boolean;
  }>;
}

async function actionList(supabaseUrl: string, supabaseKey: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .select("session_id, created_at, question_idx, question_text, answer_text, indexed, published")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const sessions = new Map<string, SessionGroup>();
  for (const row of data ?? []) {
    const sid = row.session_id;
    if (!sessions.has(sid)) sessions.set(sid, { session_id: sid, created_at: row.created_at, responses: [] });
    sessions.get(sid)!.responses.push({
      question_idx: row.question_idx,
      question_text: row.question_text,
      answer_text: row.answer_text,
      indexed: row.indexed,
      published: row.published,
    });
  }
  const sessionArr = Array.from(sessions.values()).map(s => ({
    ...s,
    responses: s.responses.sort((a, b) => a.question_idx - b.question_idx),
  }));
  return {
    sessions: sessionArr,
    totalSessions: sessionArr.length,
    totalResponses: data?.length ?? 0,
  };
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET, POST"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = { ...corsHeaders(origin, "GET, POST"), "Content-Type": "application/json" };

  const auth = event.headers["authorization"] || event.headers["Authorization"];
  if (!isAuthorized(auth)) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: "not found" }) };
  }

  const url = new URL(event.rawUrl);
  const action = url.searchParams.get("action");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  try {
    if (action === "list" && event.httpMethod === "GET") {
      const result = await actionList(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // Other actions are added in Tasks 11-13.

    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid action or method" }) };
  } catch (err) {
    console.error("aerolito-admin: error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "internal" }) };
  }
};

export { handler };
