import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.SMOKE_URL ?? "http://localhost:4180/";
const OUT = "scripts/.smoke-out";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: "no-preference",
  hasTouch: false,
});
const page = await ctx.newPage();

const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => window.scrollBy(0, 1));
await page.mouse.move(640, 400);
await page.waitForTimeout(4000);

await page.screenshot({ path: `${OUT}/01-hero-top.png`, clip: { x: 600, y: 0, width: 680, height: 800 } });

await page.evaluate(() => {
  document.getElementById("projetos")?.scrollIntoView({ behavior: "instant", block: "start" });
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/02-projetos.png` });
await page.screenshot({ path: `${OUT}/02b-projetos-right.png`, clip: { x: 600, y: 0, width: 680, height: 800 } });

const morphState = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const rect = canvas?.getBoundingClientRect();
  const fixedAncestor = canvas?.closest("div[class*='fixed']");
  return {
    canvasRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    canvasParentClass: canvas?.parentElement?.className,
    fixedAncestorClass: fixedAncestor?.className ?? null,
  };
});
console.log("MORPH STATE:", JSON.stringify(morphState, null, 2));

await page.evaluate(() => {
  document.getElementById("inicio")?.scrollIntoView({ behavior: "instant", block: "start" });
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/03-back-to-hero.png`, clip: { x: 600, y: 0, width: 680, height: 800 } });

writeFileSync(`${OUT}/report.json`, JSON.stringify({ logs }, null, 2));
console.log(JSON.stringify({ logs }, null, 2));

await browser.close();
