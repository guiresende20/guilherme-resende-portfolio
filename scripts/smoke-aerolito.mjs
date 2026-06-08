#!/usr/bin/env node
// Smoke programático para /aerolito.
// Uso: node scripts/smoke-aerolito.mjs <BASE_URL> [ADMIN_TOKEN]
// Ex.: node scripts/smoke-aerolito.mjs https://deploy-preview-XX--guiresende20.netlify.app $AEROLITO_ADMIN_TOKEN

import process from "node:process";
import { randomUUID } from "node:crypto";

const baseUrl = process.argv[2];
const adminToken = process.argv[3];

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-aerolito.mjs <BASE_URL> [ADMIN_TOKEN]");
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
  console.log(`Smoke /aerolito @ ${baseUrl}\n`);

  await check("GET /aerolito loads HTML", async () => {
    const r = await fetch(`${baseUrl}/aerolito`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    if (!html.includes("<title>") && !html.includes("<!DOCTYPE")) throw new Error("not HTML");
  });

  await check("robots.txt blocks /aerolito", async () => {
    const r = await fetch(`${baseUrl}/robots.txt`);
    const text = await r.text();
    if (!text.includes("Disallow: /aerolito")) throw new Error("Disallow rule missing");
  });

  await check("GET /api/aerolito-bullets returns JSON (bullets: null or array)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-bullets`, { headers: { "Origin": baseUrl } });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    if (!("bullets" in data)) throw new Error("missing bullets field");
  });

  await check("POST /api/aerolito-submit rejects invalid payload (400)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify({ session_id: "not-uuid", question_idx: 1, question_text: "Q?", answer_text: "A." }),
    });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
  });

  await check("POST /api/aerolito-submit accepts valid payload (200)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify({
        session_id: randomUUID(),
        question_idx: 1,
        question_text: "Smoke test question?",
        answer_text: "Smoke test answer.",
      }),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    if (!data.ok) throw new Error("ok=false in response");
  });

  if (adminToken) {
    await check("admin without token returns 404", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=list`, {
        headers: { "Origin": baseUrl },
      });
      if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
    });

    await check("admin action=list with token returns sessions", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=list`, {
        headers: { "Origin": baseUrl, "Authorization": `Bearer ${adminToken}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.sessions)) throw new Error("sessions not array");
    });

    await check("admin action=reset cleans state", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=reset`, {
        method: "POST",
        headers: { "Origin": baseUrl, "Authorization": `Bearer ${adminToken}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const r2 = await fetch(`${baseUrl}/api/aerolito-bullets`);
      const d2 = await r2.json();
      if (d2.bullets !== null) throw new Error("bullets not null after reset");
    });
  } else {
    console.log("  ⚠ ADMIN_TOKEN não passado — pulando admin tests");
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
