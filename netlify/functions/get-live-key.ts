import type { Handler, HandlerEvent } from "@netlify/functions";

// Origens permitidas — seu domínio de produção + dev local
const ALLOWED_ORIGINS = [
  "https://guiresende20.netlify.app",
  "https://main--guiresende20.netlify.app",
  "https://guilhermeresende.netlify.app",
  "http://localhost:8888",
  "http://localhost:5173",
];

const handler: Handler = async (event: HandlerEvent) => {
  const origin = event.headers["origin"] || event.headers["Origin"] || "";
  const referer = event.headers["referer"] || event.headers["Referer"] || "";

  // Same-origin GET no browser não envia Origin — aceita Referer como fallback
  const isAllowed =
    (origin && ALLOWED_ORIGINS.includes(origin)) ||
    ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed + "/") || referer === allowed);

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!isAllowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Acesso não autorizado" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key não configurada no servidor" }) };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
    },
    body: JSON.stringify({ key: apiKey }),
  };
};

export { handler };
