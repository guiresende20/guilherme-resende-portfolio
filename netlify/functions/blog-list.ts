import type { Handler } from "@netlify/functions";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import { translateTitles, mergeTranslatedTitles, type TranslatedTitle } from "./_lib/blog-list-translate";
import type { PostMeta } from "../../src/lib/blog/frontmatter";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

const TTL_MS = 24 * 60 * 60_000; // 24h — conteúdo é invalidado explicitamente via /api/blog/revalidate

function parseLang(value: string | null): "en" | "es" | null {
  return value === "en" || value === "es" ? value : null;
}

export const handler: Handler = async (event) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET"), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const headers: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };

  const lang = parseLang(new URL(event.rawUrl).searchParams.get("lang"));

  const cacheKey = "posts/list";
  const cachedList = await getCached<PostMeta[]>(cacheKey);

  let metas: PostMeta[];
  let listWasCached: boolean;

  if (cachedList) {
    metas = cachedList;
    listWasCached = true;
  } else {
    const folders = await resolveBlogFolders();
    const files = await listFolder(folders.rootId);
    const sources = files.filter(isBlogPostSource);

    // Busca e parseia todos os arquivos em paralelo (não em série) e sem buscar
    // imagens em alta resolução — esta rota só usa meta, nunca body/imagens.
    const results = await Promise.allSettled(
      sources.map((file) => fetchAndParse(file, { withImages: false }))
    );

    const built: PostMeta[] = [];
    const seen = new Set<string>();
    results.forEach((result, i) => {
      const file = sources[i];
      if (result.status === "rejected") {
        console.error("blog: skipping", { name: file.name, id: file.id, err: result.reason });
        return;
      }
      const { meta } = result.value;
      if (meta.draft) return;
      if (seen.has(meta.slug)) {
        console.error("blog: duplicate slug, skipping", { slug: meta.slug, name: file.name });
        return;
      }
      seen.add(meta.slug);
      built.push(meta);
    });

    built.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.date.localeCompare(a.date);
    });

    await setCached(cacheKey, built, TTL_MS);
    metas = built;
    listWasCached = false;
  }

  if (!lang) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: metas, cached: listWasCached }),
    };
  }

  const translationCacheKey = `posts/list/translation/${lang}`;
  const cachedTranslations = await getCached<Array<[string, TranslatedTitle]>>(translationCacheKey);

  let translations: Map<string, TranslatedTitle>;
  let translationWasCached: boolean;
  if (cachedTranslations) {
    translations = new Map(cachedTranslations);
    translationWasCached = true;
  } else {
    const eligible = metas
      .filter((m) => m.lang === "pt")
      .map((m) => ({ slug: m.slug, title: m.title, excerpt: m.excerpt }));
    translations = await translateTitles(eligible, lang);
    await setCached(translationCacheKey, Array.from(translations.entries()), TTL_MS);
    translationWasCached = false;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      posts: mergeTranslatedTitles(metas, translations),
      cached: listWasCached && translationWasCached,
    }),
  };
};
