// netlify/functions/deck-content.mjs
import { getStore } from "@netlify/blobs";
import {
  handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide, handleSaveOrder
} from "./_lib/deck-content-handlers.mjs";
import { handleCaptureSnapshot } from "./_lib/deck-backup-handlers.mjs";
import { handleGetEntry } from "./_lib/deck-registry-handlers.mjs";
import { verifyToken } from "./_lib/deck-auth-handlers.mjs";
import { isValidEditKey } from "./_lib/edit-key.mjs";

function store() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }
function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }

export default async (req, context) => {
  const slug = context.params.slug;
  const url = new URL(req.url);

  // GET /api/deck-content/:slug/image?key=... (público, key já namespaced por slug)
  if (url.pathname.endsWith("/image")) {
    if (req.method !== "GET") return Response.json({ error: "método não permitido" }, { status: 405 });
    const { status, contentType, data } = await handleGetImage(slug, url.searchParams.get("key"), store());
    if (status !== 200) return Response.json({ error: "imagem não encontrada" }, { status });
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }
    });
  }

  if (req.method === "GET") {
    const entry = await handleGetEntry(slug, registryStore());
    if (!entry) return Response.json({ error: "palestra não encontrada" }, { status: 404 });
    if (entry.senhaHash) {
      const hasEditAccess = isValidEditKey(req.headers.get("x-edit-key"), process.env.PALESTRA_EDIT_KEY);
      const hasValidToken = verifyToken(slug, req.headers.get("x-deck-token"), process.env.PALESTRA_EDIT_KEY);
      if (!hasEditAccess && !hasValidToken) {
        return Response.json({ error: "senha necessária", passwordRequired: true }, { status: 401 });
      }
    }
    const { status, body } = await handleGetContent(slug, store());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  // POST — toda escrita exige a chave de edição (body.key)
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "verify") return Response.json({ ok: true });

    let fn = handleSaveContent;
    let mutatesState = true;  // upload de imagem não muda os JSONs de conteúdo → não snapshota
    if (body.imageUpload) { fn = handleSaveImage; mutatesState = false; }
    else if (body.action === "addSlide") fn = handleAddSlide;
    else if (body.action === "hideSlide") fn = handleHideSlide;
    else if (body.action === "saveOrder") fn = handleSaveOrder;
    const cStore = store();
    if (mutatesState) {
      try { await handleCaptureSnapshot(slug, cStore, backupStore(), body.action || "saveContent"); }
      catch (e) { console.error("backup snapshot falhou (ignorado):", e); }
    }
    const { status, body: out } = await fn(slug, body, cStore);
    return Response.json(out, { status });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: ["/api/deck-content/:slug", "/api/deck-content/:slug/image"] };
