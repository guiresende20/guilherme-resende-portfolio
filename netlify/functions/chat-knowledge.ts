import type { Handler } from "@netlify/functions";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { retrieveChatKnowledge } from "./_lib/chat-knowledge";

export const handler: Handler = async event => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  if (!isOriginAllowed(origin)) return { statusCode: 403, body: "" };
  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "" };
  const rate = checkRateLimits("chat-knowledge", getClientIp(event), [{ limit: 15, windowMs: 60_000, label: "min" }, { limit: 100, windowMs: 3600_000, label: "hour" }]);
  if (!rate.ok) return { statusCode: 429, headers, body: JSON.stringify({ status: "error", sources: [] }) };
  let query;
  try {
    query = JSON.parse(event.body || "{}").query;
    if (typeof query !== "string" || !query.trim() || query.length > 2000) throw new Error("input");
  } catch { return { statusCode: 400, headers, body: JSON.stringify({ status: "error", sources: [] }) }; }
  const result = await retrieveChatKnowledge(query.trim());
  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
