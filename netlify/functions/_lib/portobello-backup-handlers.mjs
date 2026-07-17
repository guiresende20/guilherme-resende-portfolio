/* Backup do deck /portobello — handlers puros (store injetado), { status, body }.
   Snapshots dos 3 JSONs de conteúdo (imagens são imutáveis; ficam de fora do
   histórico e só entram no export completo). Índice em "index"; payloads em
   "snap/<id>". Adaptado do deck Caixa, sem clientVisible. */
import { createHash } from "node:crypto";

const OVERRIDES_KEY = "overrides";
const ADDED_KEY = "added";
const HIDDEN_KEY = "hidden";
const INDEX_KEY = "index";
const SNAP_PREFIX = "snap/";
const IMAGES_PREFIX = "images/";
export const MAX_SNAPSHOTS = 20;

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

// lê os 3 estados atuais do store de conteúdo (mesmos defaults de content-handlers).
async function readContentState(contentStore) {
  const overrides = (await contentStore.get(OVERRIDES_KEY, { type: "json" })) || {};
  const added = (await contentStore.get(ADDED_KEY, { type: "json" })) || [];
  const hidden = (await contentStore.get(HIDDEN_KEY, { type: "json" })) || [];
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
export async function handleCaptureSnapshot(contentStore, backupStore, reason) {
  const content = await readContentState(contentStore);
  const hash = hashContent(content);
  const index = (await backupStore.get(INDEX_KEY, { type: "json" })) || [];
  if (index[0] && index[0].hash === hash) {
    return { status: 200, body: { skipped: true } };
  }
  const id = String(Date.now()) + "-" + hash.slice(0, 8);
  const at = new Date().toISOString();
  await backupStore.setJSON(SNAP_PREFIX + id, { at, hash, content });
  const entry = { id, at, hash, counts: counts(content), reason: reason || "auto" };
  index.unshift(entry);
  const removed = index.splice(MAX_SNAPSHOTS); // mantém só os N mais recentes
  for (const e of removed) {
    try { await backupStore.delete(SNAP_PREFIX + e.id); } catch { /* best-effort */ }
  }
  await backupStore.setJSON(INDEX_KEY, index);
  return { status: 200, body: { snapshot: entry } };
}

export async function handleListBackups(backupStore) {
  const index = (await backupStore.get(INDEX_KEY, { type: "json" })) || [];
  return { status: 200, body: { backups: index } };
}

export async function handleRestoreBackup(body, contentStore, backupStore) {
  const id = body && body.id;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "id ausente" } };
  const index = (await backupStore.get(INDEX_KEY, { type: "json" })) || [];
  if (!index.some((e) => e.id === id)) return { status: 404, body: { error: "snapshot não encontrado" } };
  const snap = await backupStore.get(SNAP_PREFIX + id, { type: "json" });
  if (!snap || !snap.content) return { status: 404, body: { error: "snapshot não encontrado" } };
  // torna o restore reversível: snapshota o estado atual antes de sobrescrever.
  await handleCaptureSnapshot(contentStore, backupStore, "pre-restore");
  const restored = snap.content;
  await contentStore.setJSON(OVERRIDES_KEY, restored.overrides || {});
  await contentStore.setJSON(ADDED_KEY, restored.added || []);
  await contentStore.setJSON(HIDDEN_KEY, restored.hidden || []);
  return { status: 200, body: { ok: true, content: restored } };
}

export async function handleExportBundle(contentStore) {
  const content = await readContentState(contentStore);
  const { blobs } = await contentStore.list({ prefix: IMAGES_PREFIX });
  const images = [];
  for (const b of blobs) {
    const res = await contentStore.getWithMetadata(b.key, { type: "arrayBuffer" });
    if (!res || !res.data) continue;
    const contentType = (res.metadata && res.metadata.contentType) || "application/octet-stream";
    images.push({ key: b.key, contentType, dataBase64: Buffer.from(res.data).toString("base64") });
  }
  return { status: 200, body: { version: 1, at: new Date().toISOString(), content, images } };
}
