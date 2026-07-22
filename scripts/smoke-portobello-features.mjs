// Smoke local: relayout do perfil + layout frase-ia (serve public/, stub /api/chat).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve("public");
const MIME = { ".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",
  ".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp",".png":"image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, b) => {
    if (e) { res.statusCode = 404; return res.end("x"); }
    res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream");
    res.end(b);
  });
});

let pass = 0, fail = 0;
const ok = (l) => { console.log(`  ✓ ${l}`); pass++; };
const bad = (l, e) => { console.log(`  ✗ ${l} → ${e}`); fail++; };

await new Promise((r) => server.listen(8125, r));
const base = "http://localhost:8125";
console.log(`Smoke features @ ${base}/portobello/\n`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // stub do /api/chat: devolve texto canned p/ o typewriter
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ text: "Resposta simulada da IA em dois parágrafos.\n\nSegundo parágrafo aqui.", actions: [] }) }));

  await page.goto(`${base}/portobello/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.dispatchEvent(new Event("enter-deck")));
  await page.waitForSelector(".slide--profile", { state: "attached", timeout: 10000 });

  // --- Perfil ---
  const eyebrow = await page.$eval(".slide--profile .panel-eyebrow", (e) => e && e.textContent).catch(() => null);
  if (!eyebrow) ok("perfil sem eyebrow (rótulo removido)"); else bad("perfil sem eyebrow", `"${eyebrow}"`);

  const pw = await page.$eval(".slide--profile .panel-portrait", (i) => i.getBoundingClientRect().width);
  if (pw >= 120) ok(`retrato maior (${Math.round(pw)}px ≥ 120)`); else bad("retrato maior", `${Math.round(pw)}px`);

  const link = await page.$(".slide--profile .chip-link");
  if (link) {
    const href = await link.getAttribute("href");
    const target = await link.getAttribute("target");
    if (href === "https://www.ufrgs.br/ldsm/3d/" && target === "_blank") ok("chip 3D: href + target=_blank");
    else bad("chip 3D", `href=${href} target=${target}`);
  } else bad("chip 3D presente", "ausente");

  // --- Frase + IA ---
  await page.waitForSelector(".slide--frase-ia", { state: "attached", timeout: 5000 });
  const phrase = await page.$eval(".slide--frase-ia .panel-title", (e) => e.textContent.trim());
  if (phrase) ok(`frase-ia: frase visível ("${phrase.slice(0, 30)}...")`); else bad("frase-ia frase", "vazia");

  // navega até o slide frase-ia p/ ele virar is-current e poder clicar
  const total = await page.$$eval(".slide", (n) => n.length);
  for (let i = 0; i < total; i++) {
    const cur = await page.$(".slide--frase-ia.is-current");
    if (cur) break;
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
  }
  await page.waitForSelector(".slide--frase-ia.is-current", { timeout: 5000 });

  const askBtn = await page.$(".slide--frase-ia.is-current [data-ai-ask]");
  if (askBtn) ok("frase-ia: botão Perguntar à IA presente"); else bad("frase-ia botão", "ausente");
  await askBtn.click();
  await page.waitForFunction(() => {
    const a = document.querySelector(".slide--frase-ia.is-current [data-ai-answer]");
    return a && a.textContent.includes("Resposta simulada");
  }, { timeout: 8000 });
  ok("frase-ia: resposta da IA digitada inline");

  const ff = await page.$eval(".slide--frase-ia.is-current [data-ai-answer]",
    (e) => getComputedStyle(e).fontFamily);
  if (/times/i.test(ff)) ok(`resposta em Times New Roman (${ff})`); else bad("resposta Times New Roman", ff);

  if (errors.length) bad("sem erros de página JS", errors.join(" | ")); else ok("sem erros de página JS");
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
