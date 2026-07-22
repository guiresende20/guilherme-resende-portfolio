# Perfil relayout + layout "Frase + IA" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relayout do slide de perfil (maior/organizado, retrato maior, sem rótulo de numeração, chip do repositório 3D) e um novo layout `frase-ia` que dispara uma resposta da IA do portfólio digitada inline sob a frase-manifesto.

**Architecture:** Tudo no deck estático `public/portobello/` (vanilla JS + CSS + JSON). O layout `frase-ia` reusa a diagramação do `manifesto` e adiciona um botão que faz `POST /api/chat` (mesma origem, já permitido pelo CSP) e digita a resposta no cliente (a função responde JSON, não streaming). Verificação por smoke Playwright (o deck não tem testes unitários; a verificação de comportamento é via browser headless, com `/api/chat` stubbado localmente).

**Tech Stack:** JS ES5 (deck.js), CSS, Playwright (smoke), Netlify Function `chat.ts` (Gemini).

---

## File Structure

- `public/portobello/js/deck.js` — registro do layout, render do perfil (links-chips, sem eyebrow), UI + lógica do `frase-ia`.
- `public/portobello/css/styles.css` — estilos maiores do perfil, chip-âncora, layout `frase-ia` (botão + resposta Times New Roman).
- `public/portobello/js/lib/print-doc.mjs` — `case "frase-ia"` no PDF.
- `public/portobello/slides.json` — `links` no perfil + 1 slide `frase-ia` de exemplo.
- `scripts/smoke-portobello-features.mjs` — smoke local (perfil + frase-ia com `/api/chat` stubbado).

---

## Task 0: Branch

- [ ] **Step 1: Criar branch de feature**

Run:
```bash
git checkout -b feat/portobello-perfil-frase-ia
```
Expected: `Switched to a new branch 'feat/portobello-perfil-frase-ia'`

---

## Task 1: Smoke (test primeiro — deve falhar)

**Files:**
- Create: `scripts/smoke-portobello-features.mjs`

- [ ] **Step 1: Escrever o smoke (perfil + frase-ia)**

Create `scripts/smoke-portobello-features.mjs`:

```js
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
```

- [ ] **Step 2: Rodar o smoke e confirmar que FALHA**

Run: `node scripts/smoke-portobello-features.mjs`
Expected: falhas em "chip 3D", "slide--frase-ia", "botão", "resposta" (features ainda não existem).

- [ ] **Step 3: Commit do smoke**

```bash
git add scripts/smoke-portobello-features.mjs
git commit -m "test(portobello): smoke do relayout do perfil + layout frase-ia"
```

---

## Task 2: Relayout do slide de perfil

**Files:**
- Modify: `public/portobello/js/deck.js` (buildSlide: eyebrow p/ perfil, links-chips)
- Modify: `public/portobello/css/styles.css` (bloco `.slide--profile`)
- Modify: `public/portobello/slides.json` (campo `links` no perfil)

- [ ] **Step 1: deck.js — não renderizar eyebrow no perfil**

Em `public/portobello/js/deck.js`, mover a definição de `isProfile` para ANTES do `eyebrowHtml` e condicionar o eyebrow. Substituir a linha:

```js
    var eyebrowHtml = isTerritorySlide(s) ? '<p class="panel-eyebrow"></p>' : "";
```
por:
```js
    // perfil não recebe o rótulo "Slide NN / NN"
    var eyebrowHtml = (isTerritorySlide(s) && !s.portrait) ? '<p class="panel-eyebrow"></p>' : "";
```

- [ ] **Step 2: deck.js — chips-âncora (`links`) que abrem em nova aba**

No `buildSlide`, logo após o bloco que monta `var chips = ...` (termina em `.join("");` por volta da linha 152), adicionar:

```js
    // links externos (abrem em nova aba) — distintos dos chips de sinal (items)
    var linkChips = (s.links || []).map(function (lk) {
      if (!lk || !lk.url) return "";
      return '<li><a class="chip chip-link" href="' + esc(lk.url) + '" ' +
        'target="_blank" rel="noopener noreferrer">' + esc(lk.label || lk.url) + "</a></li>";
    }).join("");
```

E na montagem do `el.innerHTML`, trocar:
```js
        '<ul class="chips">' + chips + "</ul>" +
```
por:
```js
        '<ul class="chips">' + chips + linkChips + "</ul>" +
```

- [ ] **Step 3: css — bloco maior/organizado do perfil**

Em `public/portobello/css/styles.css`, substituir o bloco atual do perfil (de `/* ---------- 3b) slide de perfil ... */` até antes de `/* ---------- 4) frase-manifesto ---------- */`) por:

```css
/* ---------- 3b) slide de perfil (bio com retrato ao lado do nome) ---------- */
/* fundo neutro com leve halo do acento — a foto vira retrato, não fundo. */
.slide--profile {
  background:
    radial-gradient(120% 120% at 14% 0%,
      color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 55%),
    linear-gradient(160deg, #0b1310 0%, var(--bg-base, #050505) 62%);
}
.slide--profile > .slide-scrim { display: none; }
/* painel largo e arejado (sem o card estreito) */
.slide--profile > .panel {
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(1100px, 88vw);
  max-width: none;
  padding: clamp(28px, 4vw, 56px);
  background: color-mix(in srgb, var(--bg-elevated) 60%, transparent);
}
/* nome + retrato lado a lado */
.panel-headline {
  display: flex;
  align-items: center;
  gap: clamp(18px, 2.2vw, 34px);
  margin-bottom: clamp(18px, 2.4vw, 30px);
}
.panel-headline .panel-title {
  margin-bottom: 0;
  font-size: clamp(40px, 6vw, 92px);
}
.slide--profile .panel-portrait {
  flex: none;
  width: clamp(120px, 16vw, 220px);
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--accent);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5);
}
.slide--profile .panel-subtitle {
  font-size: clamp(16px, 1.6vw, 24px);
  max-width: 60ch;
}
/* Formação | Experiência em duas colunas, texto maior */
.slide--profile .panel-copy {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(20px, 3vw, 48px);
  align-items: start;
}
.slide--profile .panel-body {
  font-size: clamp(14px, 1.2vw, 20px);
  line-height: 1.5;
  max-width: none;
  margin-bottom: 0;
}
.slide--profile .panel-subhead {
  font-size: clamp(13px, 1vw, 15px);
  margin-bottom: 12px;
}
@media (max-width: 760px) {
  .slide--profile .panel-copy { grid-template-columns: 1fr; }
  .slide--profile .panel-headline { flex-direction: column; text-align: center; }
}
/* chip-âncora (link externo) */
.chip-link { text-decoration: none; }
```

> Observação: no `.panel-copy` em grid, cada `### subhead` e o parágrafo seguinte
> caem em células. Com 2 subheads + 2 parágrafos, a ordem natural preenche as
> colunas (Formação/corpo, Experiência/corpo). Para garantir "Formação" e
> "Experiência" no topo de cada coluna, o `slides.json` mantém a ordem
> subhead→corpo→subhead→corpo (Task 2 Step 4) e o grid usa fluxo por linhas — o
> resultado fica Formação(col1)+Experiência(col2) na 1ª linha e os corpos na 2ª.
> Se preferir cada bloco (subhead+corpo) junto numa coluna, agrupar via
> `.panel-subhead { grid-column: ... }` não é necessário nesta v1.

- [ ] **Step 4: slides.json — adicionar `links` ao perfil**

Em `public/portobello/slides.json`, no slide `sobre-guilherme`, após o campo `items`, adicionar:

```json
      "links": [
        { "label": "Repositório 3D — UFRGS", "url": "https://www.ufrgs.br/ldsm/3d/" }
      ]
```
(lembrar da vírgula após `"items": [...]`).

- [ ] **Step 5: Rodar o smoke — checagens do perfil passam**

Run: `node scripts/smoke-portobello-features.mjs`
Expected: "perfil sem eyebrow", "retrato maior", "chip 3D: href + target=_blank" agora ✓. (frase-ia ainda falha.)

- [ ] **Step 6: Commit**

```bash
git add public/portobello/js/deck.js public/portobello/css/styles.css public/portobello/slides.json
git commit -m "feat(portobello): relayout maior do slide de perfil + chip do repositório 3D"
```

---

## Task 3: Layout `frase-ia` — registro + UI + lógica

**Files:**
- Modify: `public/portobello/js/deck.js` (LAYOUTS, LAYOUT_CHOICES, template, constante, buildSlide UI + askAI)
- Modify: `public/portobello/css/styles.css` (frase-ia)
- Modify: `public/portobello/js/lib/print-doc.mjs` (case)
- Modify: `public/portobello/slides.json` (slide exemplo)

- [ ] **Step 1: deck.js — registrar o layout**

Em `LAYOUTS` (linha ~28), adicionar `"frase-ia": 1`:
```js
  var LAYOUTS = { grid: 1, wordmark: 1, hero: 1, "hero-static": 1, manifesto: 1, "frase-ia": 1, video: 1, media: 1 };
```

Em `LAYOUT_CHOICES` (após a entrada `manifesto`, linha ~38), adicionar:
```js
    { value: "frase-ia",    name: "Frase + IA",                   desc: "Frase-manifesto + resposta da IA" },
```

- [ ] **Step 2: deck.js — constante da instrução da IA**

Logo após a definição de `ACCENTS` (linha ~15), adicionar:
```js
  // instrução fixa enviada junto com a frase ao /api/chat no layout "frase-ia"
  var FRASE_IA_INSTRUCTION =
    "Reaja a esta frase e amplie a ideia em 2–3 parágrafos curtos, " +
    "conectando com a trajetória e a visão do Guilherme. Responda em português.";
```

- [ ] **Step 3: deck.js — template do novo slide**

Em `makeNewSlideTemplate`, após o `case "manifesto": ... break;` (linha ~1448), adicionar:
```js
      case "frase-ia":
        base.layout = "frase-ia";
        base.title = "Uma frase-manifesto que a IA vai comentar.";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        break;
```

- [ ] **Step 4: deck.js — injetar UI do frase-ia no buildSlide**

No `buildSlide`, após o bloco do `titleHtml` (antes do `el.innerHTML = ...`), adicionar:
```js
    // bloco interativo do layout "frase-ia": botão + área de resposta digitada
    var fraseIaHtml = s.layout === "frase-ia" ?
      '<div class="frase-ia">' +
        '<button type="button" class="frase-ia-btn" data-ai-ask>' +
          '<span class="frase-ia-ico" aria-hidden="true">▶</span>' +
          esc(s.aiButtonLabel || "Perguntar à IA") +
        '</button>' +
        '<div class="frase-ia-answer" data-ai-answer hidden></div>' +
      "</div>" : "";
```

E incluir `fraseIaHtml` dentro do `.panel`, logo após a `<ul class="chips">...`:
```js
        '<ul class="chips">' + chips + linkChips + "</ul>" +
        fraseIaHtml +
      "</div>";
```

- [ ] **Step 5: deck.js — wire do clique + função askAI**

No `buildSlide`, após o wire dos `.chip-btn` (o bloco `Array.prototype.forEach.call(el.querySelectorAll(".chip-btn") ...)`), adicionar:
```js
    var askBtn = el.querySelector("[data-ai-ask]");
    if (askBtn) {
      var answerEl = el.querySelector("[data-ai-answer]");
      askBtn.addEventListener("click", function () { askAI(s, askBtn, answerEl); });
    }
```

E adicionar a função `askAI` no escopo do módulo (ex.: logo após `function buildSlide` fechar, antes de `buildIntroSlide`):
```js
  // frase-ia: envia (instrução + frase) ao /api/chat e digita a resposta.
  // Resposta inserida como TEXTO (textContent) — sem injeção de HTML.
  function askAI(s, btn, answerEl) {
    if (!answerEl || btn.disabled) return;
    btn.disabled = true;
    answerEl.hidden = false;
    answerEl.textContent = "Pensando…";
    var instr = s.aiInstruction || FRASE_IA_INSTRUCTION;
    var message = instr + "\n\n\"" + String(s.title || "") + "\"";
    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: message, history: [] }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then(function (j) {
        var text = (j && typeof j.text === "string") ? j.text : "";
        if (!text) throw new Error("resposta vazia");
        typeOut(answerEl, text, function () { btn.disabled = false; });
      })
      .catch(function () {
        answerEl.textContent = "Não consegui responder agora — tente de novo.";
        btn.disabled = false;
      });
  }

  // efeito máquina de escrever: revela `text` por palavras; clicar revela tudo.
  function typeOut(el, text, done) {
    el.textContent = "";
    var tokens = text.match(/\S+\s*|\s+/g) || [text];
    var i = 0, timer = null;
    function finish() {
      if (timer) { clearInterval(timer); timer = null; }
      el.textContent = text;
      el.removeEventListener("click", finish);
      if (done) done();
    }
    el.addEventListener("click", finish);
    timer = setInterval(function () {
      if (i >= tokens.length) { finish(); return; }
      el.textContent += tokens[i++];
    }, 45);
  }
```

- [ ] **Step 6: css — estilos do frase-ia (reusa manifesto) + resposta Times New Roman**

Em `public/portobello/css/styles.css`, incluir `frase-ia` nos grupos de seletores do manifesto e adicionar o bloco próprio. Fazer as seguintes edições:

(a) No grupo de fundo (linha ~397):
```css
.slide--wordmark,
.slide--manifesto,
.slide--frase-ia { background: var(--bg-base); }
```
(b) No grupo bg/scrim (linhas ~400-404): acrescentar
```css
.slide--frase-ia > .slide-bg { display: none; }
.slide--frase-ia > .slide-scrim { display: none; }
```
(c) No grupo do painel centralizado (linha ~407-409): acrescentar `.slide--frase-ia > .panel` à lista.
(d) No grupo do título (linha ~593) acrescentar `.slide--frase-ia .panel-title` à mesma regra do `.slide--manifesto .panel-title`.

Depois, ao final do bloco do manifesto (após linha ~609), adicionar:
```css
/* ---------- 4b) frase + IA ---------- */
.frase-ia {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(14px, 2vh, 24px);
  margin-top: clamp(20px, 3vh, 36px);
  width: 100%;
}
.frase-ia-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font: inherit; font-family: var(--font-brand); font-weight: 700;
  font-size: clamp(14px, 1.2vw, 17px);
  color: var(--bg-base);
  background: var(--accent);
  border: 0; border-radius: var(--radius-base);
  padding: 12px 22px; cursor: pointer;
  transition: opacity 0.2s var(--ease-ui), transform 0.2s var(--ease-ui);
}
.frase-ia-btn:hover:not(:disabled) { transform: translateY(-1px); }
.frase-ia-btn:disabled { opacity: 0.5; cursor: default; }
.frase-ia-ico { font-size: 0.8em; }
.frase-ia-answer[hidden] { display: none; }
.frase-ia-answer {
  font-family: "Times New Roman", Times, serif;
  font-size: clamp(16px, 1.4vw, 22px);
  line-height: 1.55;
  color: var(--text-primary, #fff);
  max-width: 70ch;
  white-space: pre-wrap;      /* preserva \n como quebras (typeOut usa textContent) */
  text-align: left;
  border-top: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  padding-top: clamp(14px, 2vh, 22px);
}
```

- [ ] **Step 7: print-doc.mjs — case do PDF**

Em `public/portobello/js/lib/print-doc.mjs`, no switch de `slidePageHTML`, após `case "manifesto": ...`, adicionar:
```js
    case "frase-ia":  return manifestoPageHTML(slide);
```

- [ ] **Step 8: slides.json — slide de exemplo**

Em `public/portobello/slides.json`, adicionar ao array `slides` (após o perfil) o objeto:
```json
    {
      "id": "frase-ia-exemplo",
      "layout": "frase-ia",
      "title": "Inovação real acontece quando design, pesquisa e tecnologia trabalham juntos.",
      "accent": "green"
    }
```
(lembrar da vírgula após o objeto do perfil).

- [ ] **Step 9: Rodar o smoke — tudo verde**

Run: `node scripts/smoke-portobello-features.mjs`
Expected: `N passed, 0 failed` (perfil + frase-ia incluindo resposta digitada em Times New Roman, sem erros JS).

- [ ] **Step 10: Commit**

```bash
git add public/portobello/js/deck.js public/portobello/css/styles.css public/portobello/js/lib/print-doc.mjs public/portobello/slides.json
git commit -m "feat(portobello): layout Frase + IA (frase-manifesto + resposta da IA digitada)"
```

---

## Task 4: PR + deploy + verificação em preview

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feat/portobello-perfil-frase-ia
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create --title "Portobello: relayout do perfil + layout Frase + IA" --body "Relayout maior/organizado do slide de perfil (retrato maior, sem rótulo, chip do repositório 3D da UFRGS) e novo layout frase-ia (frase-manifesto + botão que dispara resposta da IA do portfólio, digitada inline em Times New Roman). Smoke local verde.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Aguardar deploy preview e validar**

Obter a URL do deploy preview (Netlify) e rodar o smoke existente contra ela:
Run: `node scripts/smoke-portobello.mjs <PREVIEW_URL>`
Expected: `7 passed, 0 failed` (não quebrou o deck).

- [ ] **Step 4: Verificação real da IA no preview**

Playwright contra o preview: navegar até o slide frase-ia, clicar no botão e confirmar que aparece resposta **não-vazia** (chamada real ao Gemini; tolerante a 429). Se limite/timeout, registrar e não bloquear.

- [ ] **Step 5: Screenshot do perfil e do frase-ia (respondido) para o owner revisar.**

---

## Notas de execução
- O deck só monta os slides após `enter-deck` (a capa dispara; nos smokes forçamos o evento).
- `/api/chat` exige mesma origem (CSP `connect-src 'self'`); no preview/prod funciona, no smoke local é stubbado.
- `typeOut` usa `textContent` (nunca `innerHTML`) — resposta da IA não injeta HTML.
- Rate limit do `/api/chat`: 10/min — suficiente para demos; o botão desabilita durante a chamada.
