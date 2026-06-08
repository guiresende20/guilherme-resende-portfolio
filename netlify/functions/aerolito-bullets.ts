import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { ensureBlobsContext } from "./_lib/blobs-context";

const STORE_NAME = "blog";
const BULLETS_KEY = "aerolito/published-bullets.json";

interface PublishedBullets {
  bullets: string[];
  published_at: string;
}

function safeStore() {
  try { return getStore(STORE_NAME); }
  catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = {
    ...corsHeaders(origin, "GET"),
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const s = safeStore();
  if (!s) {
    return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
  }

  try {
    const raw = await s.get(BULLETS_KEY, { type: "json" });
    if (!raw || typeof raw !== "object") {
      return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
    }
    const candidate = raw as Partial<PublishedBullets>;
    if (!Array.isArray(candidate.bullets) || candidate.bullets.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ bullets: candidate.bullets, published_at: candidate.published_at }),
    };
  } catch (err) {
    console.error("aerolito-bullets: blob read failed", err);
    return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
  }
};

export { handler };
