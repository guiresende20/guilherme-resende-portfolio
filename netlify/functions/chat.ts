import type { Handler, HandlerEvent } from "@netlify/functions";
import { GoogleGenerativeAI, SchemaType, type Tool, type Schema } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { retrieveChatKnowledge } from "./_lib/chat-knowledge";
import { planCatalogQuery } from "./_lib/catalog-planner";
import { classifyCatalogIntent } from "../../src/lib/catalog-intent";
import { executeCatalogQuery, UnsupportedCatalogQuery, type CatalogQuery } from "../../src/lib/catalog-query";
import { buildCatalogAnswer } from "../../src/lib/catalog-answer";
import { buildPortfolioPrompt, buildWebSearchPrompt, buildChatRepairMessage, CHAT_RUNTIME_SOURCE } from "../../src/lib/chat-prompt";
import { PORTFOLIO_SOURCES, PORTFOLIO_KNOWLEDGE_VERSION } from "../../src/lib/portfolio-knowledge";
import { normalizeHistory, buildRetrievalQuery, shouldSearchWeb, isBlogCatalogQuery, isChatFailureQuery, parseGroundedAnswer, buildEvidenceQuotes, InvalidChatAnswer, type ChatSource, type EvidenceSource, type KnowledgeResult } from "../../src/lib/chat-grounding";
import type { ChatResponse } from "../../src/lib/gemini";

const RATE_LIMITS = [{ limit: 10, windowMs: 60_000, label: "min" }, { limit: 50, windowMs: 3600_000, label: "hour" }];
export const RESPONSE_SCHEMA = {
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
} satisfies Schema;

export function buildResponseSchema(sources: readonly EvidenceSource[]): Schema {
  // Compact IDs constrain decoding; literal quotes stay in server-owned data.
  return {
    ...RESPONSE_SCHEMA,
    properties: {
      ...RESPONSE_SCHEMA.properties,
      references: { type: SchemaType.ARRAY, maxItems: 6, items: {
        type: SchemaType.OBJECT, properties: {
          evidenceId: { type: SchemaType.STRING, format: "enum", enum: buildEvidenceQuotes(sources).map(entry => entry.id) },
        }, required: ["evidenceId"],
      } },
    },
  };
}

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
  const started = Date.now();
  const deadline = started + 22_000; // Leave room for logging within the client's 25s deadline.
  try {
    const failureQuestion = isChatFailureQuery(message);
    const search = shouldSearchWeb(message);
    const intent = !search && !failureQuestion ? classifyCatalogIntent(message, history) : null;
    let catalogQuery: CatalogQuery | undefined;
    let planningReply: ChatResponse | undefined;
    let retrievalMode: "auto" | "content" = "auto";
    if (intent) {
      if (!intent.needsPlanner) catalogQuery = intent.query;
      else {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: "Não consegui interpretar os filtros do pedido agora. Tente novamente em instantes." }) };
        const plan = await planCatalogQuery(message, history, apiKey, Math.min(6000, deadline - Date.now()));
        if (plan.kind === "query") catalogQuery = plan.query;
        else if (plan.kind === "clarify") planningReply = { text: plan.text, actions: [], sources: [] };
        else retrievalMode = "content";
      }
    }
    // Current catalog intent takes priority over older topics in a dependent query.
    const query = catalogQuery || isBlogCatalogQuery(message) ? message : buildRetrievalQuery(history, message);
    const knowledge: KnowledgeResult = failureQuestion || planningReply ? { status: "no_results", sources: [] } : await retrieveChatKnowledge(query, 5000, catalogQuery, retrievalMode);
    let response: ChatResponse;
    if (failureQuestion) {
      const previous = history.at(-1)?.parts.map(part => part.text).join(" ") ?? "";
      const failed = /não consegui (?:responder|consultar)|temporariamente (?:indisponível|indisponivel)|algo deu errado|muitas requisições|limite de uso|mensagem ou histórico inválido/i.test(previous);
      response = { text: failed
        ? "A resposta anterior falhou. Não tenho o diagnóstico daquela tentativa para confirmar a causa. Você pode repetir o pedido."
        : "Não tenho o contexto da tentativa a que você se refere. Qual pedido não consegui responder?", actions: [], sources: [] };
    } else if (planningReply) {
      response = planningReply;
    } else if (catalogQuery) {
      if (knowledge.status === "error" || knowledge.status === "timeout" || !knowledge.catalog) {
        console.warn("chat: catalog_unavailable", { status: knowledge.status, elapsedMs: Date.now() - started });
        return { statusCode: 503, headers: { ...headers, "X-Chat-Retrieval-Status": knowledge.status }, body: JSON.stringify({ error: "Não consegui consultar o catálogo solicitado agora. Tente novamente em instantes." }) };
      }
      try { response = buildCatalogAnswer(executeCatalogQuery(knowledge.catalog, catalogQuery)); }
      catch (error) {
        if (!(error instanceof UnsupportedCatalogQuery)) throw error;
        response = { text: catalogQuery.locale === "en" ? "I do not have publication dates for all these records to apply that period or sort by recency." : catalogQuery.locale === "es" ? "No tengo las fechas de publicación de todos estos registros para aplicar ese período u ordenarlos por fecha." : error.message, actions: [], sources: [] };
      }
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: "Chat temporariamente indisponível" }) };
      const sources = [...PORTFOLIO_SOURCES, CHAT_RUNTIME_SOURCE, ...knowledge.sources];
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: "gemini-3.5-flash-lite",
        systemInstruction: search ? buildWebSearchPrompt() : buildPortfolioPrompt("text", knowledge),
        ...(search ? { tools: [{ googleSearch: {} } as unknown as Tool] } : {}),
        generationConfig: { maxOutputTokens: 3500, ...(!search ? { responseMimeType: "application/json", responseSchema: buildResponseSchema(sources) } : {}) },
      });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(message, { timeout: Math.max(1, Math.min(12_000, deadline - Date.now())) });
      const candidate = result.response.candidates?.[0];
      const webSources: ChatSource[] = search ? (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk, i) => {
        const web = chunk.web;
        if (!web?.uri) return [];
        try { if (new URL(web.uri).protocol !== "https:") return []; } catch { return []; }
        return [{ id: `web:${i}`, title: (web.title || new URL(web.uri).hostname).slice(0, 250), url: web.uri }];
      }).slice(0, 5) : [];
      if (search && !webSources.length) throw new InvalidChatAnswer();
      const raw = search ? JSON.stringify({ text: result.response.text(), actions: [], references: [] }) : result.response.text();
      try {
        response = parseGroundedAnswer(raw, candidate?.finishReason, sources, webSources.map(s => s.url));
      } catch (error) {
        if (search || !(error instanceof InvalidChatAnswer) || error.code === "finish_reason" || deadline - Date.now() < 1500) throw error;
        console.warn("chat: repair", { code: error.code, elapsedMs: Date.now() - started });
        // Fresh session: rejected output never becomes history or factual evidence.
        const repair = await model.startChat({ history }).sendMessage(buildChatRepairMessage(message, raw, error.code), { timeout: Math.min(6000, deadline - Date.now()) });
        response = parseGroundedAnswer(repair.response.text(), repair.response.candidates?.[0]?.finishReason, sources);
      }
      response.sources = [...(response.sources ?? []), ...webSources].slice(0, 8);
    }
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
    console.error("chat: unavailable", { code: invalid ? error.code : "provider", elapsedMs: Date.now() - started });
    return { statusCode: invalid ? 502 : 503, headers, body: JSON.stringify({ error: "Não consegui responder com segurança agora. Tente novamente em instantes." }) };
  }
};
export { handler };
