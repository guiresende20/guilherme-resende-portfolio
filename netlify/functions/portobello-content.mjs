import { getStore } from "@netlify/blobs";
import {
  handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide, handleSaveOrder
} from "./_lib/portobello-content-handlers.mjs";
import { handleCaptureSnapshot } from "./_lib/portobello-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/portobello-edit-key.mjs";

function store() { return getStore({ name: "portobello-deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "portobello-deck-backups", consistency: "strong" }); }

export default async (req) => {
  const url = new URL(req.url);

  // GET /api/portobello-content/image?key=images/... (público)
  if (url.pathname.endsWith("/image")) {
    if (req.method !== "GET") return Response.json({ error: "método não permitido" }, { status: 405 });
    const { status, contentType, data } = await handleGetImage(url.searchParams.get("key"), store());
    if (status !== 200) return Response.json({ error: "imagem não encontrada" }, { status });
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }
    });
  }

  // GET /api/portobello-content — overrides/added/hidden (leitura pública)
  if (req.method === "GET") {
    const { status, body } = await handleGetContent(store());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  // POST — toda escrita exige a chave de edição (body.key)
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PORTOBELLO_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "verify") return Response.json({ ok: true });

    let fn = handleSaveContent;
    let mutatesState = true;  // upload de imagem não muda os 3 JSONs → não snapshota
    if (body.imageUpload) { fn = handleSaveImage; mutatesState = false; }
    else if (body.action === "addSlide") fn = handleAddSlide;
    else if (body.action === "hideSlide") fn = handleHideSlide;
    else if (body.action === "saveOrder") fn = handleSaveOrder;
    const cStore = store();
    if (mutatesState) {
      // captura o estado PRE-save como ponto de rollback, antes de aplicar a mutação.
      // best-effort: nunca bloqueia a edição se o backup falhar.
      try { await handleCaptureSnapshot(cStore, backupStore(), body.action || "saveContent"); }
      catch (e) { console.error("backup snapshot falhou (ignorado):", e); }
    }
    const { status, body: out } = await fn(body, cStore);
    return Response.json(out, { status });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: ["/api/portobello-content", "/api/portobello-content/image"] };
