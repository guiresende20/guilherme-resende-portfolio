/* Núcleo da edição de slides do sistema /palestra/:slug — recebe o store (Blobs ou
   fake) injetado. Todas as chaves são namespaced por slug ("<slug>:overrides" etc)
   dentro de um único store compartilhado "deck-content", pra evitar duplicar store
   por cliente. Funções puras retornando { status, body }. Adaptado dos handlers do
   deck /portobello (única instância anterior). */
import { createHash } from "node:crypto";

const EDITABLE = ["title", "subtitle", "body", "image", "items", "gallery", "video", "media", "layout", "kicker", "quote", "byline"];
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"
]);

function keys(slug) {
  return {
    base: `${slug}:base`,
    overrides: `${slug}:overrides`,
    added: `${slug}:added`,
    hidden: `${slug}:hidden`,
    order: `${slug}:order`,
    imagesPrefix: `${slug}:images/`
  };
}

export async function handleSeedBase(slug, base, store) {
  await store.setJSON(keys(slug).base, base);
}

export async function handleGetContent(slug, store) {
  const k = keys(slug);
  const base = await store.get(k.base, { type: "json" });
  if (!base) return { status: 404, body: { error: "palestra não encontrada" } };
  const overrides = (await store.get(k.overrides, { type: "json" })) || {};
  const added = (await store.get(k.added, { type: "json" })) || [];
  const hidden = (await store.get(k.hidden, { type: "json" })) || [];
  const order = (await store.get(k.order, { type: "json" })) || [];
  return { status: 200, body: { base, overrides, added, hidden, order } };
}

// publica a ordem dos slides (lista de ids) — vale para todos os visitantes.
export async function handleSaveOrder(slug, body, store) {
  const order = body && body.order;
  if (!Array.isArray(order)) return { status: 400, body: { error: "order inválido" } };
  const ids = order.filter((x) => typeof x === "string");
  await store.setJSON(keys(slug).order, ids);
  return { status: 200, body: { ok: true } };
}

export async function handleAddSlide(slug, body, store) {
  const slide = body && body.slide;
  if (!slide || !slide.id || typeof slide.id !== "string") {
    return { status: 400, body: { error: "slide sem id" } };
  }
  const k = keys(slug);
  const added = (await store.get(k.added, { type: "json" })) || [];
  added.push(slide);
  await store.setJSON(k.added, added);
  return { status: 200, body: { ok: true, slide } };
}

export async function handleHideSlide(slug, body, store) {
  const id = body && body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  const k = keys(slug);
  // se for um slide adicionado pelo editor, deletar = removê-lo da lista added
  const added = (await store.get(k.added, { type: "json" })) || [];
  const idx = added.findIndex((s) => s && s.id === id);
  if (idx !== -1) {
    added.splice(idx, 1);
    await store.setJSON(k.added, added);
    const overrides = (await store.get(k.overrides, { type: "json" })) || {};
    if (overrides[id]) {
      delete overrides[id];
      await store.setJSON(k.overrides, overrides);
    }
    return { status: 200, body: { ok: true } };
  }
  // slide base: registra a ocultação publicada (sem duplicar)
  const hidden = (await store.get(k.hidden, { type: "json" })) || [];
  if (hidden.indexOf(id) === -1) {
    hidden.push(id);
    await store.setJSON(k.hidden, hidden);
  }
  return { status: 200, body: { ok: true } };
}

export async function handleSaveContent(slug, body, store) {
  const id = body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  const patch = (body && body.patch) || {};
  const k = keys(slug);
  const overrides = (await store.get(k.overrides, { type: "json" })) || {};
  const cur = overrides[id] || {};
  for (const field of EDITABLE) {
    if (!(field in patch)) continue;
    const val = patch[field];
    if (val === null) delete cur[field];   // null = voltar ao base
    else cur[field] = val;
  }
  if (Object.keys(cur).length === 0) delete overrides[id];
  else overrides[id] = cur;
  await store.setJSON(k.overrides, overrides);
  return { status: 200, body: { ok: true, overrides } };
}

export async function handleSaveImage(slug, body, store) {
  const id = body.slideId;
  const up = body && body.imageUpload;
  if (!id || !up || !up.dataBase64 || !up.contentType) {
    return { status: 400, body: { error: "upload inválido" } };
  }
  if (!ALLOWED_UPLOAD_TYPES.has(up.contentType)) {
    return { status: 400, body: { error: "tipo de arquivo não permitido" } };
  }
  const bytes = Buffer.from(up.dataBase64, "base64");
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const key = keys(slug).imagesPrefix + id + "-" + hash;
  await store.set(key, bytes, { metadata: { contentType: up.contentType } });
  return {
    status: 200,
    body: { ok: true, imageUrl: `/api/deck-content/${slug}/image?key=${encodeURIComponent(key)}` }
  };
}

export async function handleGetImage(slug, key, store) {
  const prefix = keys(slug).imagesPrefix;
  if (!key || key.indexOf(prefix) !== 0 || key.indexOf("..") !== -1) {
    return { status: 400, contentType: null, data: null };
  }
  const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!res || !res.data) return { status: 404, contentType: null, data: null };
  const contentType = (res.metadata && res.metadata.contentType) || "application/octet-stream";
  return { status: 200, contentType, data: res.data };
}
