import type { Handler, HandlerEvent } from "@netlify/functions";
import { GoogleGenerativeAI, SchemaType, type Tool, type Schema } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { retrieveChatKnowledge } from "./_lib/chat-knowledge";
import { buildPortfolioPrompt } from "../../src/lib/chat-prompt";
import { PORTFOLIO_SOURCES, PORTFOLIO_KNOWLEDGE_VERSION } from "../../src/lib/portfolio-knowledge";
import { normalizeHistory, buildRetrievalQuery, shouldSearchWeb, parseGroundedAnswer, InvalidChatAnswer, type ChatSource } from "../../src/lib/chat-grounding";

const RATE_LIMITS = [{ limit: 10, windowMs: 60_000, label: "min" }, { limit: 50, windowMs: 3600_000, label: "hour" }];
const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    text: { type: SchemaType.STRING },
    actions: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      type: { type: SchemaType.STRING }, label: { type: SchemaType.STRING }, url: { type: SchemaType.STRING },
      section: { type: SchemaType.STRING }, cv_type: { type: SchemaType.STRING },
    }, required: ["type", "label"] } },
    references: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      sourceId: { type: SchemaType.STRING }, quote: { type: SchemaType.STRING },
    }, required: ["sourceId", "quote"] } },
  }, required: ["text", "actions", "references"],
};

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  if (!isOriginAllowed(origin)) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };
  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json", "Cache-Control": "no-store", "X-Chat-Knowledge-Version": PORTFOLIO_KNOWLEDGE_VERSION };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  const rate = checkRateLimits("chat", getClientIp(event), RATE_LIMITS);
  if (!rate.ok) return { statusCode: 429, headers: { ...headers, "Retry-After": String(rate.retryAfter) }, body: JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }) };

  let message: string;
  let history;
  try {
    const body = JSON.parse(event.body || "{}");
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) throw new Error("input");
    message = body.message.trim();
    history = normalizeHistory(body.history, message);
  } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Mensagem ou histórico inválido" }) }; }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: "Chat temporariamente indisponível" }) };

  const started = Date.now();
  try {
    const knowledge = await retrieveChatKnowledge(buildRetrievalQuery(history, message));
    const search = shouldSearchWeb(message);
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      systemInstruction: buildPortfolioPrompt("text", knowledge),
      ...(search ? { tools: [{ googleSearch: {} } as unknown as Tool] } : {}),
      generationConfig: { temperature: .2, maxOutputTokens: 3500, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message, { timeout: 15_000 });
    const candidate = result.response.candidates?.[0];
    const webSources: ChatSource[] = search ? (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk, i) => {
      const web = chunk.web;
      if (!web?.uri) return [];
      try { if (new URL(web.uri).protocol !== "https:") return []; } catch { return []; }
      return [{ id: `web:${i}`, title: (web.title || new URL(web.uri).hostname).slice(0, 250), url: web.uri }];
    }).slice(0, 5) : [];
    if (search && !webSources.length) throw new InvalidChatAnswer();
    const response = parseGroundedAnswer(result.response.text(), candidate?.finishReason, [...PORTFOLIO_SOURCES, ...knowledge.sources], webSources.map(s => s.url));
    response.sources = [...response.sources, ...webSources].slice(0, 8);
    console.info("chat: response", { knowledge: knowledge.status, sources: knowledge.sources.length, search, elapsedMs: Date.now() - started });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        await createClient(supabaseUrl, supabaseKey).from("chat_logs").insert({ user_message: message, ai_response: response.text, actions: response.actions.length ? response.actions : null }).abortSignal(AbortSignal.timeout(1500));
      } catch { console.warn("chat: log_unavailable"); }
    }
    return { statusCode: 200, headers: { ...headers, "X-Chat-Retrieval-Status": knowledge.status }, body: JSON.stringify(response) };
  } catch (error) {
    const invalid = error instanceof InvalidChatAnswer;
    console.error("chat: unavailable", { code: invalid ? "invalid_answer" : "provider", elapsedMs: Date.now() - started });
    return { statusCode: invalid ? 502 : 503, headers, body: JSON.stringify({ error: "Não consegui responder com segurança agora. Tente novamente em instantes." }) };
  }
};
export { handler };
