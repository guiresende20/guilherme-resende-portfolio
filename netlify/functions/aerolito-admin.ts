import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStore } from "@netlify/blobs";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { dumpAllAerolitoChunks, resetAerolitoIndex } from "./_lib/aerolito-vector";

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

const CONSOLIDATION_PROMPT = `Você é um assistente que consolida feedback anônimo de um time sobre o que esperam de um novo Head de Pesquisa.

Recebeu N respostas para 5 perguntas distintas. Sua tarefa: extrair as expectativas mais frequentes e relevantes e expressá-las como 4-6 bullets concisos.

REGRAS:
- Cada bullet: máximo 120 caracteres
- Tom: ação concreta na primeira pessoa do Guilherme (ex.: "Liderar pesquisa qualitativa com clientes em todas as fases do produto")
- NÃO usar buzzwords ou linguagem de influencer
- NÃO inventar — só consolide o que aparece nas respostas
- Priorize temas que aparecem em múltiplas sessões

Retorne JSON exatamente neste formato: { "bullets": ["...", "...", ...] }
Sem markdown, sem texto adicional, só o JSON.

Respostas dos colegas:
`;

async function actionConsolidate(supabaseUrl: string, supabaseKey: string): Promise<{ bullets: string[] }> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .select("session_id, question_idx, question_text, answer_text")
    .order("session_id", { ascending: true })
    .order("question_idx", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return { bullets: [] };

  const grouped: Record<string, Array<{ q: string; a: string }>> = {};
  for (const row of data) {
    grouped[row.session_id] ??= [];
    grouped[row.session_id].push({ q: row.question_text, a: row.answer_text });
  }
  const dump = Object.entries(grouped)
    .map(([_sid, items], i) => {
      const lines = items.map((it) => `- (Q${it.q.slice(0, 60)}…) R: ${it.a}`).join("\n");
      return `Sessão ${i + 1} (anônima):\n${lines}`;
    })
    .join("\n\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(CONSOLIDATION_PROMPT + dump);
  const raw = result.response.text().trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const clean = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(clean) as { bullets?: unknown };
  if (!Array.isArray(parsed.bullets)) throw new Error("invalid bullets in IA response");
  const bullets = parsed.bullets
    .filter((b): b is string => typeof b === "string")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  return { bullets };
}

const BLOG_STORE = "blog";
const BULLETS_KEY = "aerolito/published-bullets.json";

function adminStore() {
  try { return getStore(BLOG_STORE); }
  catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

async function actionPublish(
  payload: unknown,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{ ok: true; bullets: string[] }> {
  const bullets = validateBulletsPayload(payload);
  if (!bullets) throw new Error("invalid bullets payload");

  const s = adminStore();
  if (!s) throw new Error("blob store unavailable");

  await s.setJSON(BULLETS_KEY, {
    bullets,
    published_at: new Date().toISOString(),
  });

  const supabase = createClient(supabaseUrl, supabaseKey);
  // Mark all rows as published. (Not strictly required, but keeps audit trail accurate.)
  await supabase.from("aerolito_responses").update({ published: true }).gte("question_idx", 1);

  return { ok: true, bullets };
}

async function actionReset(supabaseUrl: string, supabaseKey: string) {
  // 1. Fetch everything for backup
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: rows } = await supabase.from("aerolito_responses").select("*");
  const chunks = await dumpAllAerolitoChunks();
  let publishedBullets: unknown = null;
  const s = adminStore();
  if (s) {
    try { publishedBullets = await s.get(BULLETS_KEY, { type: "json" }); }
    catch { /* tolerate missing */ }
  }
  const backup = {
    exported_at: new Date().toISOString(),
    aerolito_responses: rows ?? [],
    vector_chunks: chunks,
    published_bullets: publishedBullets,
  };

  // 2. Write backup file
  if (s) {
    const ts = backup.exported_at.replace(/[:.]/g, "-");
    await s.setJSON(`aerolito/backups/${ts}.json`, backup);
  }

  // 3. Delete everything
  // Supabase: hard delete all rows using a filter that matches all
  await supabase.from("aerolito_responses").delete().gte("question_idx", 1);
  // Vector index: delete the file
  await resetAerolitoIndex();
  // Published bullets: delete the blob
  if (s) {
    try { await s.delete(BULLETS_KEY); }
    catch (err) { console.error("aerolito-admin: bullets delete failed", err); }
  }

  return { ok: true, backup };
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

    if (action === "consolidate" && event.httpMethod === "POST") {
      const result = await actionConsolidate(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (action === "publish" && event.httpMethod === "POST") {
      let body: unknown;
      try { body = JSON.parse(event.body || "{}"); }
      catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid json" }) }; }
      const result = await actionPublish(body, supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (action === "reset" && event.httpMethod === "POST") {
      const result = await actionReset(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid action or method" }) };
  } catch (err) {
    console.error("aerolito-admin: error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "internal" }) };
  }
};

export { handler };
