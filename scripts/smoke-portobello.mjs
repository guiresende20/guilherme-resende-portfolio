#!/usr/bin/env node
// Smoke programático para /portobello.
// Uso: node scripts/smoke-portobello.mjs <BASE_URL> [EDIT_KEY]
// Ex.: node scripts/smoke-portobello.mjs https://deploy-preview-XX--guiresende20.netlify.app

import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.argv[2];
const editKey = process.argv[3];

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-portobello.mjs <BASE_URL> [EDIT_KEY]");
  process.exit(1);
}

let pass = 0, fail = 0;
function ok(label) { console.log(`  ✓ ${label}`); pass++; }
function bad(label, err) { console.log(`  ✗ ${label} → ${err}`); fail++; }
async function check(label, fn) {
  try { await fn(); ok(label); }
  catch (e) { bad(label, e?.message ?? String(e)); }
}

async function main() {
  console.log(`Smoke /portobello @ ${baseUrl}\n`);

  await check("GET /portobello redireciona para /portobello/ e serve o deck", async () => {
    const r = await fetch(`${baseUrl}/portobello`, { redirect: "follow" });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    if (!html.includes("deck-stage")) throw new Error("HTML sem #deck-stage (caiu no SPA?)");
    if (html.includes('id="login"')) throw new Error("bloco de login ainda presente");
  });

  await check("GET /portobello/slides.json é o deck portobello", async () => {
    const r = await fetch(`${baseUrl}/portobello/slides.json`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    if (data.meta?.deck !== "portobello") throw new Error(`meta.deck = ${data.meta?.deck}`);
  });

  await check("GET /api/portobello-content retorna overrides/added/hidden", async () => {
    const r = await fetch(`${baseUrl}/api/portobello-content`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    for (const k of ["overrides", "added", "hidden"]) {
      if (!(k in data)) throw new Error(`campo ${k} ausente`);
    }
  });

  await check("POST sem chave → 401 (content)", async () => {
    const r = await fetch(`${baseUrl}/api/portobello-content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideId: "intro", patch: { title: "hack" } }),
    });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  await check("POST sem chave → 401 (backup)", async () => {
    const r = await fetch(`${baseUrl}/api/portobello-backup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "manual" }),
    });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  if (editKey) {
    await check("POST verify com chave válida → 200", async () => {
      const r = await fetch(`${baseUrl}/api/portobello-content`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", key: editKey }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
    });
  }

  await check("Render: slide intro visível e navegação por teclado responde", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/portobello/`, { waitUntil: "networkidle" });
      await page.waitForSelector(".slide-intro.is-current", { timeout: 15000 });
      const title = await page.textContent(".slide-intro .intro-title");
      if (!title || !title.includes("Portobello")) throw new Error(`intro-title = "${title}"`);
      // Esc abre o índice (grade de miniaturas)
      await page.keyboard.press("Escape");
      await page.waitForSelector("#overview:not([hidden])", { timeout: 5000 });
    } finally {
      await browser.close();
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
