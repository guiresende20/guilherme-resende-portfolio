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
