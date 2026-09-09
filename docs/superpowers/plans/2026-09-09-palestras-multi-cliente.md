# Sessão "PALESTRAS" multi-cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the Portobello single-client slide deck into a multi-client system under `/palestra/:slug`, backed by a Netlify Blobs registry, with a public listing page, an admin panel to add/remove/edit decks, and optional per-deck password protection — plus a new "PALESTRAS" nav item.

**Architecture:** One shared static deck engine (`public/palestra/_deck/`) served for any slug via a Netlify redirect rewrite; all per-client state (registry entries, slide content, backups) lives in Netlify Blobs with slug-prefixed keys inside shared stores, replacing today's per-client duplicated folders/stores. Netlify Functions expose `/api/deck-registry`, `/api/deck-content/:slug`, `/api/deck-backup/:slug`, `/api/deck-auth/:slug`.

**Tech Stack:** Vite + React + React Router, Netlify Functions (mix of `.mjs` v2 path-routed and `.ts` classic Handler), Netlify Blobs, vitest.

Spec: [`docs/superpowers/specs/2026-09-09-palestras-multi-cliente-design.md`](../specs/2026-09-09-palestras-multi-cliente-design.md)

---

## Task 1: Shared edit-key helper + slide-content handlers (generalized for slug)

**Files:**
- Create: `netlify/functions/_lib/edit-key.mjs`
- Create: `netlify/functions/_lib/deck-content-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/deck-content-handlers.test.ts`

- [ ] **Step 1: Create the generic edit-key + HMAC helper**

```js
// netlify/functions/_lib/edit-key.mjs
import { createHmac, timingSafeEqual } from "node:crypto";

// fail closed: sem chave de edição configurada, nenhuma escrita passa.
export function isValidEditKey(provided, expected) {
  return typeof expected === "string" && expected.length > 0 &&
    typeof provided === "string" && provided === expected;
}

export function hmacHex(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hmacEquals(a, b) {
  const bufA = Buffer.from(a || "", "hex");
  const bufB = Buffer.from(b || "", "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

- [ ] **Step 2: Write the failing tests for the content handlers**

```ts
// netlify/functions/_lib/__tests__/deck-content-handlers.test.ts
import { describe, it, expect } from "vitest";
import {
  handleSeedBase, handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide, handleSaveOrder
} from "../deck-content-handlers.mjs";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const meta = new Map<string, unknown>();
  return {
    data, meta,
    async get(key: string, opts?: { type?: string }) {
      if (!opts || opts.type !== "json") throw new Error("fake: get com { type: 'json' }");
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key: string, val: unknown) { data.set(key, val); },
    async set(key: string, val: unknown, opts?: { metadata?: unknown }) {
      data.set(key, val); if (opts?.metadata) meta.set(key, opts.metadata);
    },
    async getWithMetadata(key: string) {
      if (!data.has(key)) return null;
      return { data: data.get(key), metadata: meta.get(key) ?? {} };
    },
    async delete(key: string) { data.delete(key); meta.delete(key); },
  };
}

describe("deck content handlers", () => {
  it("GET sem base cadastrada retorna 404", async () => {
    const res = await handleGetContent("acme", fakeStore());
    expect(res.status).toBe(404);
  });

  it("GET com base cadastrada retorna base + defaults vazios", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: { title: "Acme" }, slides: [] }, store);
    const res = await handleGetContent("acme", store);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      base: { meta: { title: "Acme" }, slides: [] },
      overrides: {}, added: [], hidden: [], order: []
    });
  });

  it("dois slugs diferentes não colidem no mesmo store", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    await handleSeedBase("globex", { meta: {}, slides: [] }, store);
    await handleSaveContent("acme", { slideId: "s1", patch: { title: "Acme title" } }, store);
    const acme = await handleGetContent("acme", store);
    const globex = await handleGetContent("globex", store);
    expect(acme.body.overrides).toEqual({ s1: { title: "Acme title" } });
    expect(globex.body.overrides).toEqual({});
  });

  it("saveOrder valida array de strings", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    const bad = await handleSaveOrder("acme", { order: "nope" }, store);
    expect(bad.status).toBe(400);
    const ok = await handleSaveOrder("acme", { order: ["s2", "s1"] }, store);
    expect(ok.status).toBe(200);
    const res = await handleGetContent("acme", store);
    expect(res.body.order).toEqual(["s2", "s1"]);
  });

  it("hideSlide de um slide adicionado remove de added + limpa override", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    await handleAddSlide("acme", { slide: { id: "novo", title: "X" } }, store);
    await handleSaveContent("acme", { slideId: "novo", patch: { title: "Y" } }, store);
    const res = await handleHideSlide("acme", { slideId: "novo" }, store);
    expect(res.status).toBe(200);
    const content = await handleGetContent("acme", store);
    expect(content.body.added).toEqual([]);
    expect(content.body.overrides).toEqual({});
  });

  it("saveImage rejeita tipo não permitido e aceita tipo permitido com URL namespaced", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    const bad = await handleSaveImage("acme", {
      slideId: "s1", imageUpload: { dataBase64: "AAAA", contentType: "application/pdf" }
    }, store);
    expect(bad.status).toBe(400);
    const ok = await handleSaveImage("acme", {
      slideId: "s1", imageUpload: { dataBase64: "AAAA", contentType: "image/png" }
    }, store);
    expect(ok.status).toBe(200);
    expect(ok.body.imageUrl).toMatch(/^\/api\/deck-content\/acme\/image\?key=acme%3Aimages%2F/);
  });

  it("getImage recusa key fora do namespace do slug", async () => {
    const store = fakeStore();
    const res = await handleGetImage("acme", "globex:images/s1-abc", store);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:run -- deck-content-handlers`
Expected: FAIL — `Cannot find module '../deck-content-handlers.mjs'`

- [ ] **Step 4: Implement `deck-content-handlers.mjs`**

```js
// netlify/functions/_lib/deck-content-handlers.mjs
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- deck-content-handlers`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/edit-key.mjs netlify/functions/_lib/deck-content-handlers.mjs netlify/functions/_lib/__tests__/deck-content-handlers.test.ts
git commit -m "feat(palestra): slug-namespaced deck content handlers"
```

---

## Task 2: Backup handlers (generalized for slug)

**Files:**
- Create: `netlify/functions/_lib/deck-backup-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/deck-backup-handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/__tests__/deck-backup-handlers.test.ts
import { describe, it, expect } from "vitest";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "../deck-backup-handlers.mjs";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const meta = new Map<string, unknown>();
  return {
    data, meta,
    async get(key: string, opts?: { type?: string }) {
      if (!opts || opts.type !== "json") throw new Error("fake: get com { type: 'json' }");
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key: string, val: unknown) { data.set(key, val); },
    async set(key: string, val: unknown, opts?: { metadata?: unknown }) {
      data.set(key, val); if (opts?.metadata) meta.set(key, opts.metadata);
    },
    async getWithMetadata(key: string) {
      if (!data.has(key)) return null;
      return { data: data.get(key), metadata: meta.get(key) ?? {} };
    },
    async list({ prefix }: { prefix: string }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    async delete(key: string) { data.delete(key); meta.delete(key); },
  };
}

describe("deck backup handlers", () => {
  it("captura snapshot e ignora se estado for igual ao topo do índice", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    const backups = fakeStore();
    const first = await handleCaptureSnapshot("acme", content, backups, "manual");
    expect(first.body.snapshot).toBeDefined();
    const second = await handleCaptureSnapshot("acme", content, backups, "manual");
    expect(second.body.skipped).toBe(true);
  });

  it("backups de slugs diferentes não colidem", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    await content.setJSON("globex:overrides", { s1: { title: "B" } });
    const backups = fakeStore();
    await handleCaptureSnapshot("acme", content, backups, "manual");
    await handleCaptureSnapshot("globex", content, backups, "manual");
    const acmeList = await handleListBackups("acme", backups);
    const globexList = await handleListBackups("globex", backups);
    expect(acmeList.body.backups).toHaveLength(1);
    expect(globexList.body.backups).toHaveLength(1);
  });

  it("restore recupera o estado do snapshot e cria um pre-restore antes", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    const backups = fakeStore();
    const snap = await handleCaptureSnapshot("acme", content, backups, "manual");
    await content.setJSON("acme:overrides", { s1: { title: "B" } });
    const res = await handleRestoreBackup("acme", { id: snap.body.snapshot.id }, content, backups);
    expect(res.status).toBe(200);
    expect(res.body.content.overrides).toEqual({ s1: { title: "A" } });
    const list = await handleListBackups("acme", backups);
    expect(list.body.backups.some((e: { reason: string }) => e.reason === "pre-restore")).toBe(true);
  });

  it("export inclui apenas imagens do namespace do slug", async () => {
    const content = fakeStore();
    await content.set("acme:images/s1-abc", Buffer.from("x"), { metadata: { contentType: "image/png" } });
    await content.set("globex:images/s1-abc", Buffer.from("y"), { metadata: { contentType: "image/png" } });
    const bundle = await handleExportBundle("acme", content);
    expect(bundle.body.images).toHaveLength(1);
    expect(bundle.body.images[0].key).toBe("acme:images/s1-abc");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- deck-backup-handlers`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `deck-backup-handlers.mjs`**

```js
// netlify/functions/_lib/deck-backup-handlers.mjs
/* Backup do sistema /palestra/:slug — handlers puros (store injetado), { status, body }.
   Snapshots dos 3 JSONs de conteúdo (imagens são imutáveis; ficam de fora do
   histórico e só entram no export completo). Chaves namespaced por slug dentro
   dos stores compartilhados "deck-content"/"deck-backups". */
import { createHash } from "node:crypto";

export const MAX_SNAPSHOTS = 20;

function keys(slug) {
  return {
    overrides: `${slug}:overrides`,
    added: `${slug}:added`,
    hidden: `${slug}:hidden`,
    index: `${slug}:index`,
    snapPrefix: `${slug}:snap/`,
    imagesPrefix: `${slug}:images/`
  };
}

// stringify canônico (chaves ordenadas) p/ hash estável independente da ordem.
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort()
    .map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}

export function hashContent(content) {
  return createHash("sha1").update(stableStringify(content)).digest("hex");
}

async function readContentState(slug, contentStore) {
  const k = keys(slug);
  const overrides = (await contentStore.get(k.overrides, { type: "json" })) || {};
  const added = (await contentStore.get(k.added, { type: "json" })) || [];
  const hidden = (await contentStore.get(k.hidden, { type: "json" })) || [];
  return { overrides, added, hidden };
}

function counts(content) {
  return {
    overrides: Object.keys(content.overrides || {}).length,
    added: (content.added || []).length,
    hidden: (content.hidden || []).length
  };
}

// captura o estado atual como snapshot; dedupe por hash; poda aos MAX_SNAPSHOTS.
export async function handleCaptureSnapshot(slug, contentStore, backupStore, reason) {
  const k = keys(slug);
  const content = await readContentState(slug, contentStore);
  const hash = hashContent(content);
  const index = (await backupStore.get(k.index, { type: "json" })) || [];
  if (index[0] && index[0].hash === hash) {
    return { status: 200, body: { skipped: true } };
  }
  const id = String(Date.now()) + "-" + hash.slice(0, 8);
  const at = new Date().toISOString();
  await backupStore.setJSON(k.snapPrefix + id, { at, hash, content });
  const entry = { id, at, hash, counts: counts(content), reason: reason || "auto" };
  index.unshift(entry);
  const removed = index.splice(MAX_SNAPSHOTS);
  for (const e of removed) {
    try { await backupStore.delete(k.snapPrefix + e.id); } catch { /* best-effort */ }
  }
  await backupStore.setJSON(k.index, index);
  return { status: 200, body: { snapshot: entry } };
}

export async function handleListBackups(slug, backupStore) {
  const index = (await backupStore.get(keys(slug).index, { type: "json" })) || [];
  return { status: 200, body: { backups: index } };
}

export async function handleRestoreBackup(slug, body, contentStore, backupStore) {
  const id = body && body.id;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "id ausente" } };
  const k = keys(slug);
  const index = (await backupStore.get(k.index, { type: "json" })) || [];
  if (!index.some((e) => e.id === id)) return { status: 404, body: { error: "snapshot não encontrado" } };
  const snap = await backupStore.get(k.snapPrefix + id, { type: "json" });
  if (!snap || !snap.content) return { status: 404, body: { error: "snapshot não encontrado" } };
  // torna o restore reversível: snapshota o estado atual antes de sobrescrever.
  await handleCaptureSnapshot(slug, contentStore, backupStore, "pre-restore");
  const restored = snap.content;
  await contentStore.setJSON(k.overrides, restored.overrides || {});
  await contentStore.setJSON(k.added, restored.added || []);
  await contentStore.setJSON(k.hidden, restored.hidden || []);
  return { status: 200, body: { ok: true, content: restored } };
}

export async function handleExportBundle(slug, contentStore) {
  const content = await readContentState(slug, contentStore);
  const imagesPrefix = keys(slug).imagesPrefix;
  const { blobs } = await contentStore.list({ prefix: imagesPrefix });
  const images = [];
  for (const b of blobs) {
    const res = await contentStore.getWithMetadata(b.key, { type: "arrayBuffer" });
    if (!res || !res.data) continue;
    const contentType = (res.metadata && res.metadata.contentType) || "application/octet-stream";
    images.push({ key: b.key, contentType, dataBase64: Buffer.from(res.data).toString("base64") });
  }
  return { status: 200, body: { version: 1, at: new Date().toISOString(), content, images } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- deck-backup-handlers`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/deck-backup-handlers.mjs netlify/functions/_lib/__tests__/deck-backup-handlers.test.ts
git commit -m "feat(palestra): slug-namespaced deck backup handlers"
```

---

## Task 3: Registry handlers (add/remove/edit decks)

**Files:**
- Create: `netlify/functions/_lib/deck-registry-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/deck-registry-handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/__tests__/deck-registry-handlers.test.ts
import { describe, it, expect } from "vitest";
import {
  handleListRegistry, handleGetEntry, handleAddDeck, handleUpdateDeck, handleRemoveDeck
} from "../deck-registry-handlers.mjs";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key: string, opts?: { type?: string }) {
      if (!opts || opts.type !== "json") throw new Error("fake: get com { type: 'json' }");
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key: string, val: unknown) { data.set(key, val); },
    async delete(key: string) { data.delete(key); },
  };
}

describe("deck registry handlers", () => {
  it("lista vazia por padrão", async () => {
    const res = await handleListRegistry(fakeStore());
    expect(res.body.decks).toEqual([]);
  });

  it("adiciona um deck válido e semeia o conteúdo base", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const res = await handleAddDeck(
      { slug: "acme", titulo: "Acme Talk", status: "publicado" }, registry, content
    );
    expect(res.status).toBe(200);
    expect(res.body.deck.slug).toBe("acme");
    expect(res.body.deck.status).toBe("publicado");
    const base = await content.get("acme:base", { type: "json" });
    expect(base.slides).toHaveLength(1);
  });

  it("rejeita slug inválido ou duplicado", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const badSlug = await handleAddDeck({ slug: "Acme Co", titulo: "X" }, registry, content);
    expect(badSlug.status).toBe(400);
    await handleAddDeck({ slug: "acme", titulo: "X" }, registry, content);
    const dup = await handleAddDeck({ slug: "acme", titulo: "Y" }, registry, content);
    expect(dup.status).toBe(409);
  });

  it("atualiza status e senha de um deck existente", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    await handleAddDeck({ slug: "acme", titulo: "X", status: "nao-listado" }, registry, content);
    const res = await handleUpdateDeck("acme", { status: "publicado", senhaHash: "abc123" }, registry);
    expect(res.status).toBe(200);
    expect(res.body.deck.status).toBe("publicado");
    expect(res.body.deck.senhaHash).toBe("abc123");
    const notFound = await handleUpdateDeck("ghost", { status: "publicado" }, registry);
    expect(notFound.status).toBe(404);
  });

  it("remove um deck e limpa o conteúdo associado", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const backups = fakeStore();
    await handleAddDeck({ slug: "acme", titulo: "X" }, registry, content);
    await backups.setJSON("acme:index", [{ id: "1" }]);
    const res = await handleRemoveDeck("acme", registry, content, backups);
    expect(res.status).toBe(200);
    expect((await handleListRegistry(registry)).body.decks).toEqual([]);
    expect(await content.get("acme:base", { type: "json" })).toBeNull();
    expect(await backups.get("acme:index", { type: "json" })).toBeNull();
  });

  it("handleGetEntry retorna null se o slug não existir", async () => {
    const registry = fakeStore();
    expect(await handleGetEntry("ghost", registry)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- deck-registry-handlers`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `deck-registry-handlers.mjs`**

```js
// netlify/functions/_lib/deck-registry-handlers.mjs
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

export async function handleListRegistry(store) {
  const decks = await readRegistry(store);
  return { status: 200, body: { decks } };
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- deck-registry-handlers`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/deck-registry-handlers.mjs netlify/functions/_lib/__tests__/deck-registry-handlers.test.ts
git commit -m "feat(palestra): registry handlers for add/remove/edit decks"
```

---

## Task 4: Auth handlers (client-facing deck password)

**Files:**
- Create: `netlify/functions/_lib/deck-auth-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/deck-auth-handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/__tests__/deck-auth-handlers.test.ts
import { describe, it, expect, vi } from "vitest";
import { issueToken, verifyToken, checkPassword } from "../deck-auth-handlers.mjs";
import { hmacHex } from "../edit-key.mjs";

const SECRET = "test-secret";

describe("deck auth handlers", () => {
  it("checkPassword aceita a senha certa e rejeita a errada", () => {
    const hash = hmacHex("abrepalavra", SECRET);
    expect(checkPassword("abrepalavra", hash, SECRET)).toBe(true);
    expect(checkPassword("errada", hash, SECRET)).toBe(false);
    expect(checkPassword("", hash, SECRET)).toBe(false);
  });

  it("issueToken gera um token que verifyToken aceita para o slug certo", () => {
    const token = issueToken("acme", SECRET);
    expect(verifyToken("acme", token, SECRET)).toBe(true);
    expect(verifyToken("globex", token, SECRET)).toBe(false);
    expect(verifyToken("acme", token, "outro-secret")).toBe(false);
  });

  it("verifyToken rejeita token expirado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = issueToken("acme", SECRET);
    vi.setSystemTime(new Date("2026-01-02T01:00:00Z")); // +25h, TTL é 24h
    expect(verifyToken("acme", token, SECRET)).toBe(false);
    vi.useRealTimers();
  });

  it("verifyToken rejeita token malformado ou ausente", () => {
    expect(verifyToken("acme", "", SECRET)).toBe(false);
    expect(verifyToken("acme", "lixo-sem-ponto", SECRET)).toBe(false);
    expect(verifyToken("acme", null, SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- deck-auth-handlers`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `deck-auth-handlers.mjs`**

```js
// netlify/functions/_lib/deck-auth-handlers.mjs
/* Autenticação de acesso do cliente a um deck com senha (independente da chave
   de edição). Token = "<expiry>.<hmac>", assinado com PALESTRA_EDIT_KEY como
   segredo — sem necessidade de um segredo extra. TTL de 24h. */
import { hmacHex, hmacEquals } from "./edit-key.mjs";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function issueToken(slug, secret) {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const sig = hmacHex(`${slug}:${expiry}`, secret);
  return `${expiry}.${sig}`;
}

export function verifyToken(slug, token, secret) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return false;
  const [expiryStr, sig] = token.split(".");
  const expiry = Number(expiryStr);
  if (!expiry || Number.isNaN(expiry) || Date.now() > expiry) return false;
  const expected = hmacHex(`${slug}:${expiry}`, secret);
  return hmacEquals(sig, expected);
}

export function checkPassword(senha, senhaHash, secret) {
  if (!senha || typeof senha !== "string" || !senhaHash) return false;
  return hmacEquals(hmacHex(senha, secret), senhaHash);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- deck-auth-handlers`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/deck-auth-handlers.mjs netlify/functions/_lib/__tests__/deck-auth-handlers.test.ts
git commit -m "feat(palestra): token-based client password auth for decks"
```

---

## Task 5: Netlify Functions wiring (registry, content, backup, auth)

**Files:**
- Create: `netlify/functions/deck-registry.mjs`
- Create: `netlify/functions/deck-content.mjs`
- Create: `netlify/functions/deck-backup.mjs`
- Create: `netlify/functions/deck-auth.mjs`

- [ ] **Step 1: Create `deck-registry.mjs`**

```js
// netlify/functions/deck-registry.mjs
import { getStore } from "@netlify/blobs";
import {
  handleListRegistry, handleAddDeck, handleUpdateDeck, handleRemoveDeck
} from "./_lib/deck-registry-handlers.mjs";
import { isValidEditKey, hmacHex } from "./_lib/edit-key.mjs";

function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }
function contentStore() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }

export default async (req, context) => {
  const slug = context.params && context.params.slug;

  if (req.method === "GET") {
    const { status, body } = await handleListRegistry(registryStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
    return Response.json({ error: "chave incorreta" }, { status: 401 });
  }

  if (req.method === "POST") {
    const senhaHash = body.senha ? hmacHex(body.senha, process.env.PALESTRA_EDIT_KEY) : null;
    const { status, body: out } = await handleAddDeck({ ...body, senhaHash }, registryStore(), contentStore());
    return Response.json(out, { status });
  }

  if (req.method === "PATCH") {
    if (!slug) return Response.json({ error: "slug ausente" }, { status: 400 });
    const patch = { ...body };
    if (typeof body.senha === "string") {
      patch.senhaHash = body.senha ? hmacHex(body.senha, process.env.PALESTRA_EDIT_KEY) : null;
    }
    const { status, body: out } = await handleUpdateDeck(slug, patch, registryStore());
    return Response.json(out, { status });
  }

  if (req.method === "DELETE") {
    if (!slug) return Response.json({ error: "slug ausente" }, { status: 400 });
    const { status, body: out } = await handleRemoveDeck(slug, registryStore(), contentStore(), backupStore());
    return Response.json(out, { status });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: ["/api/deck-registry", "/api/deck-registry/:slug"] };
```

- [ ] **Step 2: Create `deck-content.mjs`**

```js
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
```

- [ ] **Step 3: Create `deck-backup.mjs`**

```js
// netlify/functions/deck-backup.mjs
import { getStore } from "@netlify/blobs";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "./_lib/deck-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/edit-key.mjs";

function contentStore() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }

export default async (req, context) => {
  const slug = context.params.slug;

  if (req.method === "GET") {
    const { status, body } = await handleListBackups(slug, backupStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "restore") {
      const { status, body: out } = await handleRestoreBackup(slug, body, contentStore(), backupStore());
      return Response.json(out, { status });
    }
    if (body.action === "export") {
      const { status, body: out } = await handleExportBundle(slug, contentStore());
      return Response.json(out, { status });
    }
    if (body.action === "manual") {
      const { status, body: out } = await handleCaptureSnapshot(slug, contentStore(), backupStore(), "manual");
      return Response.json(out, { status });
    }
    return Response.json({ error: "ação desconhecida" }, { status: 400 });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: "/api/deck-backup/:slug" };
```

- [ ] **Step 4: Create `deck-auth.mjs`**

```js
// netlify/functions/deck-auth.mjs
import { getStore } from "@netlify/blobs";
import { handleGetEntry } from "./_lib/deck-registry-handlers.mjs";
import { issueToken, checkPassword } from "./_lib/deck-auth-handlers.mjs";

function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }

export default async (req, context) => {
  if (req.method !== "POST") return Response.json({ error: "método não permitido" }, { status: 405 });
  const slug = context.params.slug;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }

  const entry = await handleGetEntry(slug, registryStore());
  if (!entry) return Response.json({ error: "palestra não encontrada" }, { status: 404 });
  if (!entry.senhaHash) return Response.json({ ok: true, token: null });

  const secret = process.env.PALESTRA_EDIT_KEY;
  if (!checkPassword(body && body.senha, entry.senhaHash, secret)) {
    return Response.json({ error: "senha incorreta" }, { status: 401 });
  }
  return Response.json({ ok: true, token: issueToken(slug, secret) });
};

export const config = { path: "/api/deck-auth/:slug" };
```

- [ ] **Step 5: Type-check the functions**

Run: `npx tsc -p tsconfig.functions.json`
Expected: no errors (these are plain `.mjs`, same as the existing portobello functions — `tsconfig.functions.json` only type-checks `.ts` files, this is a smoke check that nothing else broke)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/deck-registry.mjs netlify/functions/deck-content.mjs netlify/functions/deck-backup.mjs netlify/functions/deck-auth.mjs
git commit -m "feat(palestra): wire up deck-registry/content/backup/auth Netlify functions"
```

---

## Task 6: Rename `portobello-tts.ts` to `deck-tts.ts`

**Files:**
- Read: `netlify/functions/portobello-tts.ts`
- Create: `netlify/functions/deck-tts.ts` (copy with renamed log prefixes)
- Delete: `netlify/functions/portobello-tts.ts`

- [ ] **Step 1: Copy the file with generic naming**

```bash
git mv netlify/functions/portobello-tts.ts netlify/functions/deck-tts.ts
```

- [ ] **Step 2: Update internal references**

Open `netlify/functions/deck-tts.ts` and replace every occurrence of the string `"portobello-tts"` (log prefixes) with `"deck-tts"`, and update the comment that says "para o slide 'Frase + IA' do deck /portobello" to "para o slide 'Frase + IA' dos decks /palestra/:slug". This function takes no slug — it only synthesizes speech for arbitrary text sent by the client, so no other logic changes.

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.functions.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/deck-tts.ts
git commit -m "refactor(palestra): rename portobello-tts to deck-tts (no client tied to a single deck)"
```

---

## Task 7: `netlify.toml` routing

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Replace the `/portobello` redirect and add the `/palestra` rewrite rules**

Find this block (current lines ~92-95):

```toml
[[redirects]]
  from = "/portobello"
  to = "/portobello/"
  status = 301
```

Replace it with (order matters — these must come before the final SPA catch-all `/*` further down in the file, and the two `/palestra/admin` rules must come before the two `/palestra/:slug` rules so "admin" is never treated as a slug):

```toml
# link antigo compartilhado com o cliente Portobello — preserva compatibilidade
[[redirects]]
  from = "/portobello"
  to = "/palestra/portobello"
  status = 301

# painel admin e listagem passam pelo React normalmente (SPA)
[[redirects]]
  from = "/palestra/admin"
  to = "/index.html"
  status = 200
[[redirects]]
  from = "/palestra/admin/*"
  to = "/index.html"
  status = 200

# qualquer outro /palestra/<slug> é servido pela engine de deck compartilhada
[[redirects]]
  from = "/palestra/:slug"
  to = "/palestra/_deck/index.html"
  status = 200
[[redirects]]
  from = "/palestra/:slug/*"
  to = "/palestra/_deck/index.html"
  status = 200
```

- [ ] **Step 2: Verify the SPA catch-all is still last**

Confirm the file still ends with (unchanged):

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat(palestra): route /palestra/:slug to the shared deck engine"
```

---

## Task 8: Move the deck engine to a shared, slug-agnostic location

**Files:**
- Move: `public/portobello/{index.html,css,js,assets}` → `public/palestra/_deck/`
- Modify: `public/palestra/_deck/index.html`
- Modify: `public/palestra/_deck/js/deck.js` (lines 25, 28, 1028-1029 only in this task; content/behavior changes are Task 9)

- [ ] **Step 1: Move the folder**

```bash
git mv public/portobello public/palestra/_deck
```

`public/palestra/_deck/slides.json` will be removed in Task 9 once content is fully served from the API (kept for now so the move is a single clean rename).

- [ ] **Step 2: Fix `index.html` asset references to absolute paths**

In `public/palestra/_deck/index.html`, this file is now served via a 200 rewrite for any `/palestra/<slug>` URL, so relative paths (which resolved against the deck's own folder before) would resolve against `/palestra/<slug>/...` instead and 404. Replace:

```html
<link rel="icon" type="image/png" href="assets/favicon.png">
```
with
```html
<link rel="icon" type="image/png" href="/palestra/_deck/assets/favicon.png">
```

Replace:
```html
<link rel="stylesheet" href="css/styles.css">
```
with
```html
<link rel="stylesheet" href="/palestra/_deck/css/styles.css">
```

Replace:
```html
<script src="js/starfield.js"></script>
<script type="module" src="js/lib/print-doc.mjs"></script>
<script type="module" src="js/lib/pptx-doc.mjs"></script>
<script src="js/deck.js"></script>
<script src="js/gradient-bg.js"></script>
<script src="js/shader-bg.js"></script>
```
with
```html
<script src="/palestra/_deck/js/starfield.js"></script>
<script type="module" src="/palestra/_deck/js/lib/print-doc.mjs"></script>
<script type="module" src="/palestra/_deck/js/lib/pptx-doc.mjs"></script>
<script src="/palestra/_deck/js/deck.js"></script>
<script src="/palestra/_deck/js/gradient-bg.js"></script>
<script src="/palestra/_deck/js/shader-bg.js"></script>
```

(The `https://fonts.googleapis.com` preconnect/stylesheet lines are already absolute URLs and don't need changes.)

- [ ] **Step 3: Fix the two placeholder-image constants in `deck.js`**

In `public/palestra/_deck/js/deck.js`, replace:

```js
  var PLACEHOLDER_IMAGE = "assets/placeholder.svg";
  // valor antigo (logo Aerolito) que pode ter sido persistido em overrides/added
  // no servidor — normalizado para o placeholder atual ao montar o deck.
  var LEGACY_PLACEHOLDER = "assets/logo-aero.png";
```
with
```js
  var PLACEHOLDER_IMAGE = "/palestra/_deck/assets/placeholder.svg";
  // valor antigo (logo Aerolito) que pode ter sido persistido em overrides/added
  // no servidor — normalizado para o placeholder atual ao montar o deck.
  var LEGACY_PLACEHOLDER = "/palestra/_deck/assets/logo-aero.png";
```

- [ ] **Step 4: Fix the two lazy-loaded vendor script paths**

Replace:
```js
      window.htmlToImage ? Promise.resolve() : loadScript("js/vendor/html-to-image.js"),
      window.PptxGenJS ? Promise.resolve() : loadScript("js/vendor/pptxgen.bundle.js")
```
with
```js
      window.htmlToImage ? Promise.resolve() : loadScript("/palestra/_deck/js/vendor/html-to-image.js"),
      window.PptxGenJS ? Promise.resolve() : loadScript("/palestra/_deck/js/vendor/pptxgen.bundle.js")
```

- [ ] **Step 5: Confirm no other relative asset references remain**

Run:
```bash
grep -n '"assets/\|"css/\|"js/' public/palestra/_deck/js/deck.js
```
Expected: no output (all four occurrences from steps 3-4 were the only ones — already confirmed during planning).

- [ ] **Step 6: Commit**

```bash
git add public/palestra public/portobello
git commit -m "refactor(palestra): move deck engine to shared public/palestra/_deck, use absolute asset paths"
```

---

## Task 9: Generalize `deck.js` for any slug, add password gate

**Files:**
- Modify: `public/palestra/_deck/js/deck.js`
- Delete: `public/palestra/_deck/slides.json`

- [ ] **Step 1: Add slug detection near the top of the IIFE**

After the existing `PLACEHOLDER_IMAGE`/`LEGACY_PLACEHOLDER` declarations (around line 28), add:

```js
  // slug do cliente vem do path: /palestra/<slug>
  var DECK_SLUG = (function () {
    var parts = location.pathname.split("/").filter(Boolean);
    return parts[0] === "palestra" ? (parts[1] || "") : "";
  })();

  var DECK_TOKEN_STORE = "palestra-deck-token-" + DECK_SLUG;

  function storedDeckToken() {
    try { return sessionStorage.getItem(DECK_TOKEN_STORE); } catch (_) { return null; }
  }
  function storeDeckToken(t) {
    try { sessionStorage.setItem(DECK_TOKEN_STORE, t); } catch (_) {}
  }
```

- [ ] **Step 2: Rename the edit-key session storage key and update the API endpoints it calls**

Replace:
```js
  var EDIT_KEY_STORE = "portobello-edit-key";
```
with
```js
  var EDIT_KEY_STORE = "palestra-edit-key";
```

Replace the `requestEditMode` function's fetch target:
```js
    fetch("/api/portobello-content", {
```
with
```js
    fetch("/api/deck-content/" + DECK_SLUG, {
```

- [ ] **Step 3: Update the backup POST/GET endpoints**

Replace:
```js
    return fetch("/api/portobello-backup", {
```
with
```js
    return fetch("/api/deck-backup/" + DECK_SLUG, {
```

Replace:
```js
      return fetch("/api/portobello-backup", { cache: "no-store" })
```
with
```js
      return fetch("/api/deck-backup/" + DECK_SLUG, { cache: "no-store" })
```

- [ ] **Step 4: Update the TTS endpoint**

Replace:
```js
    return fetch("/api/portobello-tts", {
```
with
```js
    return fetch("/api/deck-tts", {
```

- [ ] **Step 5: Update `postContent` to send the edit-key header too (needed so edit mode bypasses the password gate) and hit the slug endpoint**

Replace:
```js
  function postContent(payload) {
    payload = Object.assign({ key: storedEditKey() }, payload);
    return fetch("/api/portobello-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 401) {
        clearEditKey();
        throw new Error("401");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
```
with
```js
  function postContent(payload) {
    payload = Object.assign({ key: storedEditKey() }, payload);
    return fetch("/api/deck-content/" + DECK_SLUG, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 401) {
        clearEditKey();
        throw new Error("401");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
```

- [ ] **Step 6: Replace the bootstrap block to fetch from the single slug-aware content endpoint, with the password-gate flow**

Replace the whole bootstrap block:

```js
  // conteúdo do servidor; falha de rede / dev sem functions => null (usa a base)
  function loadContent() {
    return fetch("/api/portobello-content", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  Promise.all([
    fetch("slides.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }),
    loadContent()
  ])
    .then(function (arr) { onData(applyContent(arr[0], arr[1])); })
    .catch(function (err) {
      stage.innerHTML =
        '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
        'justify-content:center;color:var(--text-secondary);font-size:14px;padding:24px;' +
        'text-align:center">Não foi possível carregar os slides (slides.json).<br>' +
        esc(err.message) + "</div>";
      loaded = true;      // mesmo em erro, ativa para mostrar a mensagem
      maybeActivate();
      console.error("[deck] erro ao carregar slides.json:", err);
    });
})();
```

with:

```js
  // busca o conteúdo completo (base + overrides/added/hidden/order) num único
  // endpoint namespaced por slug; 401 com passwordRequired => pede a senha do
  // cliente antes de tentar de novo.
  function fetchDeckContent() {
    var headers = {};
    var editKey = storedEditKey();
    var token = storedDeckToken();
    if (editKey) headers["x-edit-key"] = editKey;
    if (token) headers["x-deck-token"] = token;
    return fetch("/api/deck-content/" + DECK_SLUG, { cache: "no-store", headers: headers })
      .then(function (r) {
        if (r.status === 401) return r.json().then(function (j) { throw { passwordRequired: !!(j && j.passwordRequired) }; });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
  }

  function askDeckPassword() {
    var senha = window.prompt("Esta palestra tem acesso restrito. Senha:");
    if (!senha) return Promise.reject(new Error("sem senha"));
    return fetch("/api/deck-auth/" + DECK_SLUG, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ senha: senha })
    }).then(function (r) {
      if (!r.ok) { window.alert("Senha incorreta."); return askDeckPassword(); }
      return r.json();
    }).then(function (j) {
      if (j.token) storeDeckToken(j.token);
      return fetchDeckContent();
    });
  }

  function showLoadError(err) {
    stage.innerHTML =
      '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
      'justify-content:center;color:var(--text-secondary);font-size:14px;padding:24px;' +
      'text-align:center">Não foi possível carregar os slides.<br>' +
      esc(err.message || "erro desconhecido") + "</div>";
    loaded = true;      // mesmo em erro, ativa para mostrar a mensagem
    maybeActivate();
    console.error("[deck] erro ao carregar conteúdo:", err);
  }

  fetchDeckContent()
    .catch(function (err) {
      if (err && err.passwordRequired) return askDeckPassword();
      throw err;
    })
    .then(function (content) { onData(applyContent(content.base, content)); })
    .catch(showLoadError);
})();
```

- [ ] **Step 7: Delete the now-unused static content file**

```bash
git rm public/palestra/_deck/slides.json
```

- [ ] **Step 8: Manual smoke check in the browser (dev server + a real Netlify dev session is needed for the API to respond — covered by the Playwright smoke test in Task 14, this step is just a quick sanity read-through)**

Read back the full `js/deck.js` file end to end once to confirm no other `/api/portobello-*` or relative `assets/`/`css/`/`js/` references remain:
```bash
grep -n "portobello" public/palestra/_deck/js/deck.js public/palestra/_deck/index.html
```
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add public/palestra
git commit -m "feat(palestra): make deck.js slug-aware, add client password gate"
```

---

## Task 10: Nav item "PALESTRAS" + i18n

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/es.json`

- [ ] **Step 1: Add the locale keys**

In `src/locales/pt.json`, inside `navbar.links`, add (right after `"blog": "Blog",`):
```json
      "palestras": "Palestras",
```

In `src/locales/en.json`, inside `navbar.links`, add (right after `"blog": "Blog",`):
```json
      "palestras": "Talks",
```

In `src/locales/es.json`, inside `navbar.links`, add (right after `"blog": "Blog",`):
```json
      "palestras": "Charlas",
```

- [ ] **Step 2: Add the nav item, right before Blog**

In `src/components/Navbar.tsx`, replace:

```tsx
  const LINKS: NavLink[] = [
    { href: "#inicio", label: t("navbar.links.inicio") },
    { href: "#sobre", label: t("navbar.links.sobre") },
    { href: "#experiencia", label: t("navbar.links.experiencia") },
    { href: "#projetos", label: t("navbar.links.projetos") },
    { href: "#formacao", label: t("navbar.links.formacao") },
    { href: "#contato", label: t("navbar.links.contato") },
    { to: "/blog", label: t("navbar.links.blog") },
  ];
```
with
```tsx
  const LINKS: NavLink[] = [
    { href: "#inicio", label: t("navbar.links.inicio") },
    { href: "#sobre", label: t("navbar.links.sobre") },
    { href: "#experiencia", label: t("navbar.links.experiencia") },
    { href: "#projetos", label: t("navbar.links.projetos") },
    { href: "#formacao", label: t("navbar.links.formacao") },
    { href: "#contato", label: t("navbar.links.contato") },
    { to: "/palestra", label: t("navbar.links.palestras") },
    { to: "/blog", label: t("navbar.links.blog") },
  ];
```

Desktop and mobile render blocks both `.map(LINKS)` already, so no further changes are needed in `Navbar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx src/locales/pt.json src/locales/en.json src/locales/es.json
git commit -m "feat(palestra): add PALESTRAS nav item"
```

---

## Task 11: Listing page `/palestra`

**Files:**
- Create: `src/lib/palestra/api.ts`
- Create: `src/components/palestra/PalestraCard.tsx`
- Create: `src/pages/Palestras.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the fetch helper and shared type**

```ts
// src/lib/palestra/api.ts
export type PalestraEntry = {
  slug: string;
  titulo: string;
  cliente: string;
  data: string;
  thumbnail: string;
  status: "publicado" | "nao-listado";
  senhaHash: string | null;
};

export async function fetchPalestras(): Promise<PalestraEntry[]> {
  const res = await fetch("/api/deck-registry", { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível carregar as palestras.");
  const data = await res.json();
  return Array.isArray(data.decks) ? data.decks : [];
}
```

- [ ] **Step 2: Create the card component**

```tsx
// src/components/palestra/PalestraCard.tsx
import type { PalestraEntry } from "../../lib/palestra/api";

export default function PalestraCard({ deck }: { deck: PalestraEntry }) {
  return (
    <a
      href={`/palestra/${deck.slug}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-neon/40"
    >
      {deck.thumbnail ? (
        <img
          src={deck.thumbnail}
          alt={deck.titulo}
          className="aspect-video w-full object-cover transition group-hover:scale-105"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-white/5 text-foreground/40">
          {deck.titulo}
        </div>
      )}
      <div className="p-4">
        <h3 className="font-display text-lg text-foreground">{deck.titulo}</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-foreground/60">
          {[deck.cliente, deck.data].filter(Boolean).join(" · ")}
        </p>
      </div>
    </a>
  );
}
```

- [ ] **Step 3: Create the listing page**

```tsx
// src/pages/Palestras.tsx
import { useEffect, useState } from "react";
import { fetchPalestras, type PalestraEntry } from "../lib/palestra/api";
import PalestraCard from "../components/palestra/PalestraCard";

export default function Palestras() {
  const [decks, setDecks] = useState<PalestraEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPalestras().then(setDecks).catch((e) => setError(String(e.message || e)));
  }, []);

  const publicados = decks ? decks.filter((d) => d.status === "publicado") : null;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Palestras</span>
        <h1 className="font-display text-5xl text-foreground mt-2">Apresentações</h1>
      </header>

      {error && <p className="text-foreground/70">{error}</p>}
      {!error && !publicados && <p className="text-foreground/70">Carregando…</p>}
      {!error && publicados && publicados.length === 0 && (
        <p className="text-foreground/70">Nenhuma palestra publicada ainda.</p>
      )}
      {!error && publicados && publicados.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((deck) => (
            <PalestraCard key={deck.slug} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Register the route**

In `src/App.tsx`, add a lazy import next to the other page imports:
```tsx
const Palestras = lazy(() => import("./pages/Palestras"));
```
and a route inside the existing `<Routes>` block, alongside the other top-level routes (e.g. next to the `/blog` route):
```tsx
<Route
  path="/palestra"
  element={
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <Palestras />
    </Suspense>
  }
/>
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/palestra src/components/palestra src/pages/Palestras.tsx src/App.tsx
git commit -m "feat(palestra): public listing page at /palestra"
```

---

## Task 12: Admin panel `/palestra/admin`

**Files:**
- Create: `src/pages/PalestraAdmin.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the admin page**

```tsx
// src/pages/PalestraAdmin.tsx
import { useEffect, useState } from "react";
import type { PalestraEntry } from "../lib/palestra/api";

const EDIT_KEY_STORE = "palestra-edit-key";

type FormState = {
  slug: string;
  titulo: string;
  cliente: string;
  data: string;
  thumbnail: string;
  status: "publicado" | "nao-listado";
  senha: string;
};

const EMPTY_FORM: FormState = {
  slug: "", titulo: "", cliente: "", data: "", thumbnail: "", status: "nao-listado", senha: ""
};

export default function PalestraAdmin() {
  const [key, setKey] = useState<string | null>(() => sessionStorage.getItem(EDIT_KEY_STORE));
  const [decks, setDecks] = useState<PalestraEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadDecks() {
    const res = await fetch("/api/deck-registry", { cache: "no-store" });
    const data = await res.json();
    setDecks(Array.isArray(data.decks) ? data.decks : []);
  }

  useEffect(() => {
    if (key) loadDecks().catch((e) => setError(String(e.message || e)));
  }, [key]);

  async function requestKey() {
    const k = window.prompt("Chave de edição:");
    if (!k) return;
    const res = await fetch("/api/deck-registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: k, slug: "__verify__", titulo: "" }),
    });
    // slug inválido sempre retorna 400 com chave certa, ou 401 com chave errada —
    // então só o status 401 indica chave incorreta.
    if (res.status === 401) { window.alert("Chave incorreta."); return; }
    sessionStorage.setItem(EDIT_KEY_STORE, k);
    setKey(k);
  }

  async function addDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    const res = await fetch("/api/deck-registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, ...form }),
    });
    const out = await res.json();
    if (!res.ok) { window.alert(out.error || "Erro ao criar a palestra."); return; }
    setForm(EMPTY_FORM);
    loadDecks();
  }

  async function toggleStatus(deck: PalestraEntry) {
    if (!key) return;
    const nextStatus = deck.status === "publicado" ? "nao-listado" : "publicado";
    await fetch(`/api/deck-registry/${deck.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, status: nextStatus }),
    });
    loadDecks();
  }

  async function removeDeck(deck: PalestraEntry) {
    if (!key) return;
    if (!window.confirm(`Remover a palestra "${deck.titulo}"? Isso apaga o conteúdo dela também.`)) return;
    await fetch(`/api/deck-registry/${deck.slug}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    loadDecks();
  }

  if (!key) {
    return (
      <div className="container mx-auto px-6 py-16">
        <p className="text-foreground/70">Painel restrito.</p>
        <button
          onClick={requestKey}
          className="mt-4 rounded-md border border-white/20 px-4 py-2 text-sm text-foreground hover:border-neon/40"
        >
          Entrar com a chave de edição
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-foreground mb-8">Gerenciar palestras</h1>
      {error && <p className="text-foreground/70">{error}</p>}

      <form onSubmit={addDeck} className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input required placeholder="slug (ex: acme)" value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input required placeholder="título" value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="cliente" value={form.cliente}
          onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="data (2026-09-09)" value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="thumbnail (URL)" value={form.thumbnail}
          onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="senha de acesso (opcional)" value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <select value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground">
          <option value="nao-listado">Não-listado</option>
          <option value="publicado">Publicado</option>
        </select>
        <button type="submit"
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-foreground hover:border-neon/40">
          Adicionar palestra
        </button>
      </form>

      <ul className="divide-y divide-white/10">
        {(decks || []).map((deck) => (
          <li key={deck.slug} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-foreground">{deck.titulo} <span className="text-foreground/50">({deck.slug})</span></p>
              <p className="text-xs text-foreground/50">
                {deck.status}{deck.senhaHash ? " · com senha" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={`/palestra/${deck.slug}?edit=1`} className="text-sm text-neon hover:underline">editar</a>
              <button onClick={() => toggleStatus(deck)} className="text-sm text-foreground/70 hover:underline">
                {deck.status === "publicado" ? "despublicar" : "publicar"}
              </button>
              <button onClick={() => removeDeck(deck)} className="text-sm text-red-400 hover:underline">remover</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, add:
```tsx
const PalestraAdmin = lazy(() => import("./pages/PalestraAdmin"));
```
and:
```tsx
<Route
  path="/palestra/admin"
  element={
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <PalestraAdmin />
    </Suspense>
  }
/>
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PalestraAdmin.tsx src/App.tsx
git commit -m "feat(palestra): admin panel to add/remove/publish decks"
```

---

## Task 13: Migrate the existing Portobello content into the new system

**Files:**
- Create: `scripts/migrate-portobello-to-palestra.mjs`

This is a one-time production data migration (old `portobello-deck-content`/`portobello-deck-backups` Blobs stores → new `palestra-registry`/`deck-content`/`deck-backups` stores, namespaced under slug `portobello`). It must run against the live Netlify site's Blobs, using `@netlify/blobs`'s standalone mode (explicit `siteID`/`token`).

- [ ] **Step 1: Write the migration script**

```js
// scripts/migrate-portobello-to-palestra.mjs
// Uso: NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node scripts/migrate-portobello-to-palestra.mjs
// Copia o conteúdo do deck /portobello (stores antigos, únicos p/ esse cliente)
// para o novo sistema multi-cliente (stores compartilhados, chaves "portobello:*").
import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) {
  console.error("Defina NETLIFY_SITE_ID e NETLIFY_AUTH_TOKEN antes de rodar este script.");
  process.exit(1);
}

const oldContent = getStore({ name: "portobello-deck-content", siteID, token, consistency: "strong" });
const oldBackups = getStore({ name: "portobello-deck-backups", siteID, token, consistency: "strong" });
const registry = getStore({ name: "palestra-registry", siteID, token, consistency: "strong" });
const newContent = getStore({ name: "deck-content", siteID, token, consistency: "strong" });
const newBackups = getStore({ name: "deck-backups", siteID, token, consistency: "strong" });

const SLUG = "portobello";

async function main() {
  const base = JSON.parse(await readFile(new URL("../public/palestra/_deck/slides.json.bak", import.meta.url), "utf8").catch(async () => {
    // fallback: slides.json já foi removido do disco na Task 9 — leia do git history se necessário.
    throw new Error("public/palestra/_deck/slides.json.bak não encontrado — restaure o slides.json original do git antes de rodar a migração (git show <commit-antes-da-task-9>:public/portobello/slides.json > public/palestra/_deck/slides.json.bak)");
  }));

  const overrides = (await oldContent.get("overrides", { type: "json" })) || {};
  const added = (await oldContent.get("added", { type: "json" })) || [];
  const hidden = (await oldContent.get("hidden", { type: "json" })) || [];
  const order = (await oldContent.get("order", { type: "json" })) || [];

  await newContent.setJSON(`${SLUG}:base`, base);
  await newContent.setJSON(`${SLUG}:overrides`, overrides);
  await newContent.setJSON(`${SLUG}:added`, added);
  await newContent.setJSON(`${SLUG}:hidden`, hidden);
  await newContent.setJSON(`${SLUG}:order`, order);

  const { blobs } = await oldContent.list({ prefix: "images/" });
  for (const b of blobs) {
    const res = await oldContent.getWithMetadata(b.key, { type: "arrayBuffer" });
    if (!res || !res.data) continue;
    const newKey = `${SLUG}:${b.key}`;
    await newContent.set(newKey, Buffer.from(res.data), { metadata: res.metadata });
    console.log("imagem migrada:", b.key, "->", newKey);
  }

  const oldIndex = (await oldBackups.get("index", { type: "json" })) || [];
  await newBackups.setJSON(`${SLUG}:index`, oldIndex);
  for (const entry of oldIndex) {
    const snap = await oldBackups.get(`snap/${entry.id}`, { type: "json" });
    if (snap) await newBackups.setJSON(`${SLUG}:snap/${entry.id}`, snap);
  }

  const currentRegistry = (await registry.get("registry", { type: "json" })) || [];
  if (!currentRegistry.some((d) => d.slug === SLUG)) {
    currentRegistry.push({
      slug: SLUG,
      titulo: "Da Prancheta ao Prompt",
      cliente: "Portobello",
      data: "2026-07-17",
      thumbnail: "",
      status: "publicado",
      senhaHash: null
    });
    await registry.setJSON("registry", currentRegistry);
  }

  console.log("Migração concluída: overrides=%d added=%d hidden=%d order=%d imagens=%d backups=%d",
    Object.keys(overrides).length, added.length, hidden.length, order.length, blobs.length, oldIndex.length);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Restore the original `slides.json` as the migration input**

```bash
git log --oneline -- public/portobello/slides.json | tail -1
```
Find the last commit before Task 9's `git rm`, then:
```bash
git show <commit-hash>:public/portobello/slides.json > public/palestra/_deck/slides.json.bak
```

- [ ] **Step 3: Run the migration against production**

Get the site ID and a personal access token (owner action — `netlify status` for the site ID, `netlify login` / Netlify user settings for the token), then:
```bash
NETLIFY_SITE_ID=<site-id> NETLIFY_AUTH_TOKEN=<token> node scripts/migrate-portobello-to-palestra.mjs
```
Expected: prints "Migração concluída: ..." with non-zero counts matching what's live today on `/portobello`.

- [ ] **Step 4: Clean up the temporary input file and commit the script**

```bash
rm public/palestra/_deck/slides.json.bak
git add scripts/migrate-portobello-to-palestra.mjs
git commit -m "chore(palestra): one-time migration script for existing Portobello data"
```

---

## Task 14: Deploy, verify in production, then remove the old Portobello functions

**Files:**
- Delete: `netlify/functions/portobello-content.mjs`
- Delete: `netlify/functions/portobello-backup.mjs`
- Delete: `netlify/functions/_lib/portobello-content-handlers.mjs`
- Delete: `netlify/functions/_lib/portobello-backup-handlers.mjs`
- Delete: `netlify/functions/_lib/portobello-edit-key.mjs`
- Delete: `netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts`
- Delete: `netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts`

- [ ] **Step 1: Set the `PALESTRA_EDIT_KEY` environment variable**

Owner action: in the Netlify dashboard for this site, add an environment variable `PALESTRA_EDIT_KEY` with the same value currently used for `PORTOBELLO_EDIT_KEY` (so the existing edit flow keeps working without re-training anyone), then trigger a deploy.

- [ ] **Step 2: Push and deploy**

```bash
git push
```
Wait for the Netlify deploy to finish (owner confirms, or check the Netlify dashboard/CLI).

- [ ] **Step 3: Verify in production**

- `https://<site>/palestra` loads and lists the "portobello" deck (since it's `status: "publicado"`).
- `https://<site>/palestra/portobello` renders the migrated deck content identically to the old `/portobello`.
- `https://<site>/portobello` redirects (301) to `/palestra/portobello`.
- `https://<site>/palestra/admin` prompts for the edit key, and once entered, lists the "portobello" entry with working publish/unpublish and remove buttons (don't click remove on the real Portobello entry).
- Edit mode on `/palestra/portobello` (`?edit=1` or pressing `E`) still works: editing a slide's text persists on reload.

- [ ] **Step 4: Remove the old Portobello-specific functions**

```bash
git rm netlify/functions/portobello-content.mjs netlify/functions/portobello-backup.mjs \
  netlify/functions/_lib/portobello-content-handlers.mjs \
  netlify/functions/_lib/portobello-backup-handlers.mjs \
  netlify/functions/_lib/portobello-edit-key.mjs \
  netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts \
  netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts
```

- [ ] **Step 5: Run the full test suite**

Run: `npm run test:run`
Expected: PASS, no references to the deleted files remain.

- [ ] **Step 6: Commit and push**

```bash
git commit -m "chore(palestra): remove superseded portobello-specific functions"
git push
```

---

## Self-Review Notes

- **Spec coverage:** nav item (Task 10), `/palestra/:slug` engine (Tasks 8-9), registry in Blobs (Task 3, 5), admin panel (Task 12), password protection (Tasks 4-5, 9), listing page respecting `publicado`/`nao-listado` (Task 11), Portobello migration + redirect (Tasks 6, 13, 14) — all covered.
- **Type consistency:** all content/backup/registry handler signatures use `(slug, body, store)` (or `(slug, store)` for reads) consistently across Tasks 1-5; `senhaHash` is computed once in `deck-registry.mjs` and passed through as `senhaHash` everywhere (registry handlers never see a raw `senha`).
- **No manual owner testing burden beyond the required env var + production click-through in Task 14**, consistent with the "no manual testing" preference — everything else is covered by vitest.
