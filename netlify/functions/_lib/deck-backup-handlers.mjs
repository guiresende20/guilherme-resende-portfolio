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
