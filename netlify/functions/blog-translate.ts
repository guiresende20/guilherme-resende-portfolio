import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import {
  corsHeaders,
  getClientIp,
  getRequestOrigin,
  isOriginAllowed,
} from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";

const ALLOWED_LANGS = new Set(["en", "es"]);
const TRANSLATE_RATE_LIMITS = [
  { limit: 5, windowMs: 60_000, label: "min" },
  { limit: 10, windowMs: 60 * 60_000, label: "hour" },
];

interface TranslateRequest {
  slug: string;
  lang: string;
}

const SYSTEM_PROMPT = (targetLang: string) => `You are a translator. Translate the following Markdown post from Portuguese to ${targetLang === "en" ? "English" : "Spanish"}.

Rules:
- Preserve every Markdown construct exactly: headings, lists, blockquotes, links, image syntax, tables.
- Do NOT translate text inside fenced code blocks (\`\`\`...\`\`\`) — keep them byte-for-byte identical.
- Do NOT translate text inside inline code (\`...\`).
- Do NOT translate URLs or file paths.
- Keep proper nouns (people, brands, project names) untouched.
- Match the author's tone — first-person, conversational, technical when needed.
- Output ONLY the translated Markdown. No commentary, no "Here is the translation:" prefix.
- Do NOT include or repeat the YAML frontmatter — you receive only the body.`;

export const handler: Handler = async (event) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }

  if (!allowed) {
    return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const baseHeaders: Record<string, string> = {
    ...corsHeaders(origin, "POST"),
    "content-type": "application/json",
  };

  let body: TranslateRequest;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { slug, lang } = body;
  if (!slug || typeof slug !== "string") {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "slug required" }) };
  }
  if (!lang || !ALLOWED_LANGS.has(lang)) {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "lang must be one of: en, es" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("translate", ip, TRANSLATE_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...baseHeaders, "retry-after": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Rate limit exceeded", retryAfter: rate.retryAfter }),
    };
  }

  const cacheKey = `posts/${slug}/translation/${lang}`;
  const cached = await getCached<string>(cacheKey);
  if (cached !== null) {
    return {
      statusCode: 200,
      headers: { ...baseHeaders, "x-blog-cache": "hit" },
      body: JSON.stringify({ slug, lang, body: cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);

  let originalBody: string | null = null;
  for (const f of files.filter(isBlogPostSource)) {
    try {
      const parsed = await fetchAndParse(f);
      if (parsed.meta.slug === slug && !parsed.meta.draft && parsed.meta.lang === "pt") {
        originalBody = parsed.body;
        break;
      }
    } catch (err) {
      console.error("blog-translate: skipping", { name: f.name, id: f.id, err });
    }
  }

  if (originalBody === null) {
    return { statusCode: 404, headers: baseHeaders, body: JSON.stringify({ error: "Post not found or not translatable (must be lang: pt)" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: "GEMINI_API_KEY not configured" }) };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT(lang),
  });

  const result = await model.generateContent(originalBody);
  const translated = result.response.text();

  await setCached(cacheKey, translated, null);

  return {
    statusCode: 200,
    headers: { ...baseHeaders, "x-blog-cache": "miss" },
    body: JSON.stringify({ slug, lang, body: translated, cached: false }),
  };
};
