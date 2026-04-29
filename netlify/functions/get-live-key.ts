import type { Handler, HandlerEvent } from "@netlify/functions";

// Origens permitidas — seu domínio de produção + dev local
const ALLOWED_ORIGINS = [
  "https://guilhermeresende.netlify.app",
  "http://localhost:8888",
  "http://localhost:5173",
];

const handler: Handler = async (event: HandlerEvent) => {
  const origin = event.headers["origin"] || event.headers["Origin"] || "";

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Bloqueia requests sem origin ou de origem não autorizada
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
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
