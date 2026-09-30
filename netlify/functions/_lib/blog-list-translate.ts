import type { PostMeta } from "../../../src/lib/blog/frontmatter";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TranslatableItem {
  slug: string;
  title: string;
  excerpt?: string;
}

export interface TranslatedTitle {
  title: string;
  excerpt?: string;
}

const PROMPT_PREFIX = (targetLang: "en" | "es") => `You are a translator. Translate the following blog post titles and excerpts from Portuguese to ${targetLang === "en" ? "English" : "Spanish"}.

Rules:
- Keep proper nouns (people, brands, project names) untouched.
- Match the author's tone — first-person, conversational when the original is.
- Return ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
  [{"slug": "...", "title": "...", "excerpt": "..."}]
- Include every slug from the input, in the same order.
- Omit "excerpt" from an item's output if that item had no "excerpt" in the input.

Input:
`;

export async function translateTitles(
  items: TranslatableItem[],
  lang: "en" | "es"
): Promise<Map<string, TranslatedTitle>> {
  if (items.length === 0) return new Map();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("blog-list-translate: GEMINI_API_KEY not configured");
    return new Map();
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
    const result = await model.generateContent(PROMPT_PREFIX(lang) + JSON.stringify(items));
    const raw = result.response.text().trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const clean = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected a JSON array");

    const map = new Map<string, TranslatedTitle>();
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as Record<string, unknown>).slug !== "string" ||
        typeof (entry as Record<string, unknown>).title !== "string"
      ) {
        continue;
      }
      const e = entry as { slug: string; title: string; excerpt?: unknown };
      map.set(e.slug, {
        title: e.title,
        excerpt: typeof e.excerpt === "string" ? e.excerpt : undefined,
      });
    }
    return map;
  } catch (err) {
    console.error("blog-list-translate: translation failed", err);
    return new Map();
  }
}

export function mergeTranslatedTitles(
  metas: PostMeta[],
  translations: Map<string, TranslatedTitle>
): PostMeta[] {
  return metas.map((meta) => {
    const translated = translations.get(meta.slug);
    if (!translated) return meta;
    return {
      ...meta,
      title: translated.title,
      excerpt: translated.excerpt ?? meta.excerpt,
    };
  });
}
