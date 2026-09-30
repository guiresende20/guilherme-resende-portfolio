import type { Handler } from "@netlify/functions";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import type { PostMeta } from "../../src/lib/blog/frontmatter";
import { rewriteImagePaths } from "../../src/lib/blog/image-paths";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

const TTL_MS = 24 * 60 * 60_000; // 24h — conteúdo é invalidado explicitamente via /api/blog/revalidate

interface PostPayload {
  meta: PostMeta;
  body: string;
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

  const baseHeaders: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };

  // event.path may be the original /api/blog/post/:slug or the rewritten
  // /.netlify/functions/blog-post/:slug depending on environment.
  const remainder = event.path
    .replace(/^\/api\/blog\/post\//, "")
    .replace(/^\/\.netlify\/functions\/blog-post\//, "");
  const slug = remainder.split("/")[0].split("?")[0] || null;
  if (!slug) {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "slug required" }) };
  }

  const cacheKey = `posts/${slug}`;
  const cached = await getCached<PostPayload>(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ ...cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const sources = files.filter(isBlogPostSource);

  // Fase 1: busca/parseia todos os candidatos em paralelo e sem imagens em
  // alta resolução, só para achar qual arquivo bate com o slug pedido — os
  // outros N-1 arquivos nunca precisam de imagem, então evita esse custo.
  const quickResults = await Promise.allSettled(
    sources.map((file) => fetchAndParse(file, { withImages: false }))
  );

  let matchFile: (typeof sources)[number] | null = null;
  for (let i = 0; i < quickResults.length; i++) {
    const result = quickResults[i];
    const file = sources[i];
    if (result.status === "rejected") {
      console.error("blog: skipping", { name: file.name, id: file.id, err: result.reason });
      continue;
    }
    if (result.value.meta.slug === slug && !result.value.meta.draft) {
      matchFile = file;
      break;
    }
  }

  // Fase 2: só o arquivo vencedor é buscado de novo, agora com imagens.
  let found: PostPayload | null = null;
  if (matchFile) {
    try {
      const parsed = await fetchAndParse(matchFile, { withImages: true });
      found = {
        meta: parsed.meta,
        body: rewriteImagePaths(parsed.body),
      };
    } catch (err) {
      console.error("blog: skipping", { name: matchFile.name, id: matchFile.id, err });
    }
  }

  if (!found) {
    return {
      statusCode: 404,
      headers: baseHeaders,
      body: JSON.stringify({ error: "not_found", slug }),
    };
  }

  await setCached(cacheKey, found, TTL_MS);
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({ ...found, cached: false }),
  };
};
