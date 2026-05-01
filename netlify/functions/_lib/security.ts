// Helpers compartilhados pelas Netlify Functions: checagem de origem e CORS.
// Pasta com prefixo "_" não é roteada pelo Netlify, então não vira endpoint.

import type { HandlerEvent } from "@netlify/functions";

export function getClientIp(event: HandlerEvent): string {
  const headers = event.headers;
  const nfIp = headers["x-nf-client-connection-ip"] || headers["X-Nf-Client-Connection-Ip"];
  if (typeof nfIp === "string" && nfIp.length > 0) return nfIp;
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

const ALLOWED_ORIGINS = [
  "https://guiresende20.netlify.app",
  "https://main--guiresende20.netlify.app",
  "https://guilhermeresende.netlify.app",
  "http://localhost:8888",
  "http://localhost:5173",
];

export function getRequestOrigin(event: HandlerEvent): string {
  return event.headers["origin"] || event.headers["Origin"] || "";
}

export function isOriginAllowed(origin: string): boolean {
  return Boolean(origin) && ALLOWED_ORIGINS.includes(origin);
}

// Só chame com uma origem já validada por isOriginAllowed().
export function corsHeaders(origin: string, methods: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
