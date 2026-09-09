/* Registro dos decks de /palestra/:slug — store "palestra-registry", uma única
   chave "registry" com o array de decks. Cria/edita/remove entradas e (no add)
   semeia o conteúdo base vazio no store de conteúdo. Handlers puros (stores
   injetados), { status, body }. */
const REGISTRY_KEY = "registry";
const SLUG_RE = /^[a-z0-9-]+$/;

function emptyBase(titulo) {
  return {
    meta: { deck: "palestra", title: titulo },
    slides: [
      { id: "intro", layout: "cover", title: titulo, subtitle: "" }
    ]
  };
}

export async function readRegistry(store) {
  return (await store.get(REGISTRY_KEY, { type: "json" })) || [];
}

export async function handleListRegistry(store, includePrivate) {
  const decks = await readRegistry(store);
  if (includePrivate) return { status: 200, body: { decks } };
  const publicDecks = decks
    .filter((d) => d.status === "publicado")
    .map((d) => {
      const { senhaHash, ...rest } = d;
      return rest;
    });
  return { status: 200, body: { decks: publicDecks } };
}

export async function handleGetEntry(slug, store) {
  const registry = await readRegistry(store);
  return registry.find((d) => d.slug === slug) || null;
}

export async function handleAddDeck(body, store, contentStore) {
  const slug = body && body.slug;
  const titulo = body && body.titulo;
  if (!slug || typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return { status: 400, body: { error: "slug inválido (use letras minúsculas, números e hífen)" } };
  }
  if (!titulo || typeof titulo !== "string") {
    return { status: 400, body: { error: "título obrigatório" } };
  }
  const registry = await readRegistry(store);
  if (registry.some((d) => d.slug === slug)) {
    return { status: 409, body: { error: "slug já existe" } };
  }
  const entry = {
    slug,
    titulo,
    cliente: body.cliente || "",
    data: body.data || "",
    thumbnail: body.thumbnail || "",
    status: body.status === "publicado" ? "publicado" : "nao-listado",
    senhaHash: body.senhaHash || null
  };
  registry.push(entry);
  await store.setJSON(REGISTRY_KEY, registry);
  await contentStore.setJSON(`${slug}:base`, emptyBase(titulo));
  return { status: 200, body: { ok: true, deck: entry } };
}

export async function handleUpdateDeck(slug, body, store) {
  const registry = await readRegistry(store);
  const idx = registry.findIndex((d) => d.slug === slug);
  if (idx === -1) return { status: 404, body: { error: "palestra não encontrada" } };
  const entry = registry[idx];
  if (typeof body.titulo === "string") entry.titulo = body.titulo;
  if (typeof body.cliente === "string") entry.cliente = body.cliente;
  if (typeof body.data === "string") entry.data = body.data;
  if (typeof body.thumbnail === "string") entry.thumbnail = body.thumbnail;
  if (body.status === "publicado" || body.status === "nao-listado") entry.status = body.status;
  if ("senhaHash" in body) entry.senhaHash = body.senhaHash;
  registry[idx] = entry;
  await store.setJSON(REGISTRY_KEY, registry);
  return { status: 200, body: { ok: true, deck: entry } };
}

export async function handleRemoveDeck(slug, store, contentStore, backupStore) {
  const registry = await readRegistry(store);
  const idx = registry.findIndex((d) => d.slug === slug);
  if (idx === -1) return { status: 404, body: { error: "palestra não encontrada" } };
  registry.splice(idx, 1);
  await store.setJSON(REGISTRY_KEY, registry);
  for (const k of ["base", "overrides", "added", "hidden", "order"]) {
    try { await contentStore.delete(`${slug}:${k}`); } catch { /* best-effort */ }
  }
  try { await backupStore.delete(`${slug}:index`); } catch { /* best-effort */ }
  return { status: 200, body: { ok: true } };
}
