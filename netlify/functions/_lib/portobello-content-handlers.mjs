/* Núcleo da edição de slides do deck /portobello — recebe o store (Blobs ou
   fake) injetado. Overrides ficam num único blob "overrides":
   { "<slideId>": { title?, subtitle?, body?, image?, items?, ... } }.
   Funções puras retornando { status, body }. Adaptado do deck Caixa,
   sem a allowlist clientVisible. */
import { createHash } from "node:crypto";

const OVERRIDES_KEY = "overrides";
const ADDED_KEY = "added";     // slides novos criados pelo editor (lista)
const HIDDEN_KEY = "hidden";   // ids de slides ocultados (publicado, lista)
const EDITABLE = ["title", "subtitle", "body", "image", "items", "gallery", "video", "media"];
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"
]);

export async function handleGetContent(store) {
  const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  const hidden = (await store.get(HIDDEN_KEY, { type: "json" })) || [];
  return { status: 200, body: { overrides, added, hidden } };
}

export async function handleAddSlide(body, store) {
  const slide = body && body.slide;
  if (!slide || !slide.id || typeof slide.id !== "string") {
    return { status: 400, body: { error: "slide sem id" } };
  }
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  added.push(slide);
  await store.setJSON(ADDED_KEY, added);
  return { status: 200, body: { ok: true, slide } };
}

export async function handleHideSlide(body, store) {
  const id = body && body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  // se for um slide adicionado pelo editor, deletar = removê-lo da lista added
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  const idx = added.findIndex((s) => s && s.id === id);
  if (idx !== -1) {
    added.splice(idx, 1);
    await store.setJSON(ADDED_KEY, added);
    // limpa o override do slide novo p/ não deixar entrada órfã
    const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
    if (overrides[id]) {
      delete overrides[id];
      await store.setJSON(OVERRIDES_KEY, overrides);
    }
    return { status: 200, body: { ok: true } };
  }
  // slide base: registra a ocultação publicada (sem duplicar)
  const hidden = (await store.get(HIDDEN_KEY, { type: "json" })) || [];
  if (hidden.indexOf(id) === -1) {
    hidden.push(id);
    await store.setJSON(HIDDEN_KEY, hidden);
  }
  return { status: 200, body: { ok: true } };
}

export async function handleSaveContent(body, store) {
  const id = body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  const patch = (body && body.patch) || {};
  const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
  const cur = overrides[id] || {};
  for (const field of EDITABLE) {
    if (!(field in patch)) continue;
    const val = patch[field];
    if (val === null) delete cur[field];   // null = voltar ao base
    else cur[field] = val;
  }
  if (Object.keys(cur).length === 0) delete overrides[id];
  else overrides[id] = cur;
  await store.setJSON(OVERRIDES_KEY, overrides);
  return { status: 200, body: { ok: true, overrides } };
}

export async function handleSaveImage(body, store) {
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
  const key = "images/" + id + "-" + hash;
  await store.set(key, bytes, { metadata: { contentType: up.contentType } });
  return { status: 200, body: { ok: true, imageUrl: "/api/portobello-content/image?key=" + encodeURIComponent(key) } };
}

export async function handleGetImage(key, store) {
  if (!key || key.indexOf("images/") !== 0 || key.indexOf("..") !== -1) {
    return { status: 400, contentType: null, data: null };
  }
  const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!res || !res.data) return { status: 404, contentType: null, data: null };
  const contentType = (res.metadata && res.metadata.contentType) || "application/octet-stream";
  return { status: 200, contentType, data: res.data };
}
