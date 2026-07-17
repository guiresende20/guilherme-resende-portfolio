# Deck de slides em /portobello — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reaproveitar a lógica de exibição+edição de slides do deck `temp/caixa` como sub-site estático em `/portobello`, esvaziado de conteúdo Caixa, sem login e sem votação, com edição gateada por `PORTOBELLO_EDIT_KEY`.

**Architecture:** Cópia estática em `public/portobello/` (Vite copia `public/` → `dist/` intacto; o deck vanilla roda sem integração com o React). Duas Netlify Functions modernas (`Request`/`Response` + `config.path`) com Blobs stores próprios (`portobello-deck-content`, `portobello-deck-backups`). Handlers puros em `netlify/functions/_lib/` testados com vitest.

**Tech Stack:** HTML/CSS/JS vanilla (deck), Netlify Functions (.mjs, runtime moderno), Netlify Blobs, vitest, Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-07-17-portobello-deck-design.md`

**Nota (desvio do spec):** a chave viaja em `body.key` (não em header `x-edit-key`) — é o mecanismo que o deck original já usa no `backupPost` (`PRESENTER_KEY`), então o diff fica menor e o cliente/servidor ficam consistentes. Semântica idêntica à do spec: POST sem chave válida → 401.

**Fonte:** todos os arquivos originais estão em `temp/caixa/` (não versionado no repo do portfólio — não modificar, só copiar).

---

### Task 1: Branch + cópia estática do deck

**Files:**
- Create: `public/portobello/` (árvore copiada de `temp/caixa/`)

- [ ] **Step 1: Criar branch**

```powershell
git checkout -b feat/portobello-deck
```

- [ ] **Step 2: Copiar só os arquivos que ficam**

NÃO copiar: `login.js`, `vote.js`, `constellation.js`, `vendor/qrcode.js`, `vote.html`, `slides.json` (será reescrito), `assets/login/`, `assets/ref caixa_plataforma.pdf`, `design.md`, `README.md`, `netlify/`, `tests/`, `node_modules/`.

```powershell
New-Item -ItemType Directory -Force public\portobello\js\lib, public\portobello\js\vendor, public\portobello\css, public\portobello\assets
Copy-Item temp\caixa\index.html public\portobello\
Copy-Item temp\caixa\css\styles.css public\portobello\css\
Copy-Item temp\caixa\js\deck.js, temp\caixa\js\starfield.js, temp\caixa\js\particles.js public\portobello\js\
Copy-Item temp\caixa\js\lib\print-doc.mjs, temp\caixa\js\lib\pptx-doc.mjs public\portobello\js\lib\
Copy-Item temp\caixa\js\vendor\html-to-image.js, temp\caixa\js\vendor\pptxgen.bundle.js public\portobello\js\vendor\
Copy-Item temp\caixa\assets\favicon.png, temp\caixa\assets\logo-aero.png public\portobello\assets\
```

- [ ] **Step 3: Conferir a árvore**

Run: `Get-ChildItem public\portobello -Recurse -File | Select-Object FullName`
Expected: exatamente 11 arquivos: index.html, css/styles.css, js/deck.js, js/starfield.js, js/particles.js, js/lib/print-doc.mjs, js/lib/pptx-doc.mjs, js/vendor/html-to-image.js, js/vendor/pptxgen.bundle.js, assets/favicon.png, assets/logo-aero.png.

- [ ] **Step 4: Commit**

```powershell
git add public/portobello
git commit -m "feat(portobello): copia estatica do deck (sem login/votacao/conteudo caixa)"
```

---

### Task 2: index.html limpo + slides.json placeholder

**Files:**
- Modify: `public/portobello/index.html` (reescrever por completo)
- Create: `public/portobello/slides.json`

- [ ] **Step 1: Reescrever index.html**

Conteúdo completo (remove o bloco `#login`, os scripts `qrcode.js`/`constellation.js`/`login.js`, e atualiza title/description/aria-label):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Aeroli.to · Portobello</title>
<meta name="description" content="Apresentação Aeroli.to — Portobello.">
<meta name="theme-color" content="#000000">

<!-- favicon: logo Aerolito -->
<link rel="icon" type="image/png" href="assets/favicon.png">

<!-- tipografia: corpo em Times New Roman (sistema); wordmark da capa em Manrope -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&display=swap" rel="stylesheet">

<link rel="stylesheet" href="css/styles.css">
</head>
<body>

<!-- atmosfera global -->
<canvas id="starfield" aria-hidden="true"></canvas>
<canvas id="index-particles" class="particle-bg" aria-hidden="true"></canvas>

<!-- ============ DECK ============ -->
<main id="deck" aria-roledescription="apresentação" aria-label="Portobello">
  <div id="deck-stage"></div>

  <!-- progresso de leitura (acompanha o slide atual) -->
  <div class="deck-progress" role="progressbar" aria-label="Progresso da apresentação"
       aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
    <span id="deck-progress-bar" class="deck-progress-bar"></span>
  </div>

  <!-- marca Aerolito (canto superior direito) -->
  <div class="deck-logo" aria-hidden="true">
    <img src="assets/logo-aero.png" alt="Aerolito">
  </div>

  <!-- controles -->
  <nav id="deck-controls" class="deck-controls" aria-label="Navegação dos slides" hidden>
    <button id="nav-index" class="nav-btn" type="button" aria-label="Índice" title="Índice (Esc)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button id="nav-prev" class="nav-btn" type="button" aria-label="Slide anterior" title="Anterior (←)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <span class="deck-counter" aria-live="polite">
      <span id="counter-cur" class="cur">1</span> / <span id="counter-tot">1</span>
    </span>
    <button id="nav-next" class="nav-btn" type="button" aria-label="Próximo slide" title="Próximo (→)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button id="nav-full" class="nav-btn" type="button" aria-label="Tela cheia" title="Tela cheia (F)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </nav>

  <!-- índice / visão geral (grade de miniaturas) — abre no Esc ou no botão índice -->
  <div id="overview" class="overview" hidden>
    <div class="overview-head">
      <div class="overview-headings">
        <span class="overview-title">Índice</span>
        <span class="overview-hint">arraste as miniaturas para reordenar</span>
      </div>
      <button id="overview-close" class="nav-btn" type="button" aria-label="Fechar índice" title="Fechar (Esc)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div id="overview-grid" class="overview-grid" role="list"></div>
  </div>

  <!-- painel de sinal (abre ao clicar num chip) -->
  <aside id="signal-panel" class="signal-panel" role="dialog" aria-modal="true" aria-label="Detalhe do sinal" tabindex="-1" hidden>
    <button id="signal-close" class="nav-btn signal-close" type="button" aria-label="Fechar painel" title="Fechar (Esc)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <p class="signal-kicker">Sinal <span id="signal-pos"></span></p>
    <h3 id="signal-title" class="signal-title"></h3>
    <p id="signal-desc" class="signal-desc"></p>
    <a id="signal-link" class="signal-link" target="_blank" rel="noopener noreferrer" hidden>visitar site ↗</a>
    <p class="signal-hint">← → navega entre os sinais · Esc fecha</p>
  </aside>
</main>

<script src="js/starfield.js"></script>
<script type="module" src="js/lib/print-doc.mjs"></script>
<script type="module" src="js/lib/pptx-doc.mjs"></script>
<script src="js/deck.js"></script>
<script src="js/particles.js"></script></body>
</html>
```

- [ ] **Step 2: Criar slides.json**

```json
{
  "meta": {
    "title": "Aeroli.to · Portobello",
    "deck": "portobello"
  },
  "slides": [
    {
      "id": "intro",
      "type": "intro",
      "eyebrow": "Aeroli.to",
      "title": "Portobello",
      "lead": "Deck em construção. Navegue pelas miniaturas ou gere o report completo em PDF.",
      "accent": "violet"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```powershell
git add public/portobello/index.html public/portobello/slides.json
git commit -m "feat(portobello): index.html sem login/votacao + slides.json placeholder"
```

---

### Task 3: deck.js — remover votação e trocar presenter-key por edit-key

**Files:**
- Modify: `public/portobello/js/deck.js`

Todas as referências de linha abaixo são do arquivo ORIGINAL (`temp/caixa/js/deck.js`, 2236 linhas com conteúdo + brancos = 2449 linhas físicas). Aplicar em ordem decrescente de linha evita deslocamento; alternativamente, usar as âncoras de texto (únicas no arquivo).

- [ ] **Step 1: Remover o dispatch de vote em buildSlide**

Remover a linha (âncora única):

```js
    if (s.type === "vote") return buildVoteSlide(s, i);
```

- [ ] **Step 2: Remover a função buildVoteSlide inteira**

De `function buildVoteSlide(s, i) {` até o `}` imediatamente antes do comentário `/* slide de introdução:` (bloco original linhas 230–278, inclui o QR code e o painel vote-admin).

- [ ] **Step 3: Substituir o bloco do apresentador pela chave de edição**

Substituir o bloco inteiro de:

```js
  /* ---------- apresentador: chave, revelar, reset, export ---------- */
  var PRESENTER_KEY_STORE = "caixa-presenter-key";
```

até o `}` que fecha `function stateAction(action) { ... }` (imediatamente antes de `function download(filename, text, type) {`) por:

```js
  /* ---------- edição: chave (validada no servidor via PORTOBELLO_EDIT_KEY) ---------- */
  var EDIT_KEY_STORE = "portobello-edit-key";

  function storedEditKey() {
    try { return sessionStorage.getItem(EDIT_KEY_STORE); } catch (_) { return null; }
  }

  function clearEditKey() {
    try { sessionStorage.removeItem(EDIT_KEY_STORE); } catch (_) {}
  }

  // pede a chave, valida no servidor e recarrega com o modo edição ativo.
  // O reload reconstrói o deck com fullAccess=true (controles de edição).
  function requestEditMode() {
    var k = window.prompt("Chave de edição:");
    if (!k) return;
    fetch("/api/portobello-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "verify", key: k })
    })
      .then(function (r) {
        if (r.status === 401) { window.alert("Chave incorreta."); throw new Error("401"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        try { sessionStorage.setItem(EDIT_KEY_STORE, k); } catch (_) {}
        // remove ?edit=1 da URL antes do reload (evita novo prompt)
        try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) {}
        location.reload();
      })
      .catch(function (err) {
        if (err && err.message === "401") return;
        window.alert("Erro ao validar a chave. Tente novamente.");
      });
  }
```

(`download()` logo abaixo permanece — é usado pelo export de backup.)

- [ ] **Step 4: Adaptar backupPost à edit-key e ao novo endpoint**

Em `function backupPost(action, extra)`, trocar:

```js
    var key = presenterKey(false);
    if (!key) return Promise.reject(new Error("no-key"));
    return fetch("/api/backup", {
```

por:

```js
    var key = storedEditKey();
    if (!key) return Promise.reject(new Error("no-key"));
    return fetch("/api/portobello-backup", {
```

E no handler de 401 dentro do mesmo `.then`, trocar:

```js
        try { sessionStorage.removeItem(PRESENTER_KEY_STORE); } catch (_) {}
```

por:

```js
        clearEditKey();
```

- [ ] **Step 5: Renomear o arquivo de export e o fetch da lista de backups**

Em `doExport()`: `"caixa-backup-" + stamp + ".json"` → `"portobello-backup-" + stamp + ".json"`.
Em `openBackupsPanel()`/`refresh()`: `fetch("/api/backup", { cache: "no-store" })` → `fetch("/api/portobello-backup", { cache: "no-store" })`.

- [ ] **Step 6: Remover exportResult e onAdminClick**

Remover as duas funções inteiras: de `function exportResult(format) {` até o `}` que fecha `function onAdminClick(e) { ... }` (bloco original 925–959, imediatamente antes de `function go(i, fromHash) {`).

- [ ] **Step 7: Remover a chamada de polling em go()**

Remover a linha `    syncVotePolling();` no fim de `go()`.

- [ ] **Step 8: Remover o bloco de polling da votação**

Remover de `/* ---------- votação: polling e estado ---------- */` até o `}` que fecha `function syncVotePolling() { ... }` (bloco original 1322–1389: `votePollTimer`, `lastTally`, `voteEls`, `renderVoteState`, `territoriesMeta`, `renderVoteUnavailable`, `pollAbort`, `pollTally`, `syncVotePolling`).

- [ ] **Step 9: Teclas — remover R (reveal) e adicionar E (edição)**

No `switch (e.key)` de `onKey`, substituir:

```js
      case "r": case "R":
        if (voteEls()) { e.preventDefault(); stateAction("reveal"); }
        break;
```

por:

```js
      case "e": case "E":
        e.preventDefault();
        if (!fullAccess) requestEditMode(); else toggleEdit();
        break;
```

- [ ] **Step 10: Remover syncAdminVisibility() de activate()**

Remover a linha `    syncAdminVisibility();` no fim de `activate()`.

- [ ] **Step 11: addNewSlide — inserir no fim (sem "antes da votação")**

Substituir:

```js
        // insere antes da votação (que é sempre o último slide), nunca depois dela
        var voteIdx = slides.findIndex(function (s) { return s.type === "vote"; });
        var i = voteIdx === -1 ? slides.length : voteIdx;
```

por:

```js
        var i = slides.length;
```

- [ ] **Step 12: buildDeck — fonte do fullAccess e remoção do sort da votação**

Trocar:

```js
    try { fullAccess = sessionStorage.getItem("deck-full") === "1"; } catch (_) { fullAccess = false; }
```

por:

```js
    fullAccess = !!storedEditKey();
```

E remover o bloco:

```js
    // a votação fica sempre por último, mesmo após reordenar ou adicionar territórios
    // (sort estável no V8: preserva a ordem relativa dos demais)
    slides.sort(function (a, b) {
      return (a.type === "vote" ? 1 : 0) - (b.type === "vote" ? 1 : 0);
    });
```

- [ ] **Step 13: postContent — endpoint novo + chave no payload + 401 limpa a chave**

Substituir a função inteira por:

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

- [ ] **Step 14: loadContent — endpoint novo**

Trocar `fetch("/api/content", { cache: "no-store" })` por `fetch("/api/portobello-content", { cache: "no-store" })`.

- [ ] **Step 15: ORDER_KEY e condições residuais de vote**

- `var ORDER_KEY = "caixa-deck-order-v2";` → `var ORDER_KEY = "portobello-deck-order-v1";`
- `isTerritorySlide`: `return !!s && s.type !== "intro" && s.type !== "vote" && !s.layout;` → `return !!s && s.type !== "intro" && !s.layout;`
- Em `buildOverview`, as DUAS condições `if (fullAccess && s.type !== "intro" && s.type !== "vote") {` → `if (fullAccess && s.type !== "intro") {`
- Em `toggleEdit`: `if (!s || s.type === "vote" || s.type === "intro") {` → `if (!s || s.type === "intro") {`

- [ ] **Step 16: Suporte a ?edit=1 no boot**

Logo APÓS a linha `if (!document.getElementById("login")) entered = true;` (que permanece — sem `#login` no HTML ela sempre ativa `entered`), inserir:

```js
  // ?edit=1: ativa o modo edição sem teclado (útil no mobile)
  try {
    if (new URLSearchParams(location.search).get("edit") === "1") {
      if (storedEditKey()) {
        history.replaceState(null, "", location.pathname + location.hash);
      } else {
        requestEditMode();
      }
    }
  } catch (_) {}
```

- [ ] **Step 17: Verificação de resíduos**

Run: `Select-String -Path public\portobello\js\deck.js -Pattern "vote|presenter|deck-full|tally|/api/state|/api/content\b|/api/backup\b" -CaseSensitive:$false`
Expected: nenhuma ocorrência, EXCETO `thumb-figure-vote` (classe CSS do fallback ✦ do índice — renomear para `thumb-figure-fallback`; o CSS antigo só perde o estilo do glifo, aceitável). Menções a "caixa"/"@caixa" em comentários são tratadas na Task 4.

- [ ] **Step 18: Commit**

```powershell
git add public/portobello/js/deck.js
git commit -m "feat(portobello): deck.js sem votacao; edicao via chave (E / ?edit=1)"
```

---

### Task 4: deck.js — remover lógica @caixa (clientVisible) + pptx-doc

**Files:**
- Modify: `public/portobello/js/deck.js`
- Modify: `public/portobello/js/lib/pptx-doc.mjs`

- [ ] **Step 1: Remover as variáveis de clientVisible**

Remover as três linhas:

```js
  var clientVisible = null;   // allowlist publicada (servidor): ids visíveis p/ @caixa; null = nunca salvo (usa seed)
  var clientVisPending = null;   // edição em memória: ids visíveis p/ cliente (null = ainda não semeado nesta sessão)
  var clientVisSave = null, clientVisRevert = null;   // botões no cabeçalho do índice
```

- [ ] **Step 2: buildOverview — remover seed e toggle do olho**

Remover o bloco:

```js
    if (fullAccess && clientVisPending === null) {
      clientVisPending = slides.filter(isClientVisible).map(idOf);
    }
```

E remover o bloco inteiro do olho (de `      // toggle de visibilidade p/ cliente (canto sup. esquerdo), só @aeroli.to e territórios` até o `}` que fecha esse `if` — original 1104–1123, termina com `b.appendChild(eye);` + `}`).

- [ ] **Step 3: buildEditControls — remover botões de visibilidade**

Remover o bloco de `      clientVisSave = document.createElement("button");` até `      updateClientVisBar();` inclusive (original 1587–1603). Manter as linhas anteriores (`ovHead.insertBefore(addWrap, closeBtn)` etc. do botão "+ Novo slide") — atenção: as duas linhas `ovHead.insertBefore(clientVisSave, addWrap);` e `ovHead.insertBefore(clientVisRevert, clientVisSave);` fazem parte do bloco removido.

- [ ] **Step 4: requestDeleteSlide — remover limpeza de clientVisPending**

Dentro do callback de sucesso, remover:

```js
            // território deletado sai do deck p/ todos: não deve sobrar id obsoleto
            // no pendente (evita "sujo" falso e payload com id inexistente ao salvar)
            if (clientVisPending) {
              var pi = clientVisPending.indexOf(s.id);
              if (pi !== -1) clientVisPending.splice(pi, 1);
              updateClientVisBar();
            }
```

- [ ] **Step 5: Remover saveClientVisible e revertClientVisible**

Remover as duas funções inteiras (de `function saveClientVisible() {` até o `}` que fecha `revertClientVisible`, imediatamente antes de `/* ---------- modal de confirmação reutilizável ---------- */`).

- [ ] **Step 6: Remover os helpers de visibilidade**

Remover de:

```js
  // visibilidade efetiva p/ o cliente @caixa: allowlist publicada, ou seed
```

até o `}` que fecha `function updateClientVisBar() { ... }` (original 2324–2360: `isClientVisible`, `idOf`, `savedClientVisibleIds`, `sameIds`, `applyEyeState`, `updateClientVisBar`).

- [ ] **Step 7: buildDeck — filtro simplificado**

Substituir:

```js
    slides = slides.filter(function (s) {
      // @caixa (fullAccess=false): só vê o que isClientVisible liberar (allowlist ou seed).
      // publishedHidden (deletar pelo índice): some para todos, inclusive @aeroli.to.
      return (fullAccess || isClientVisible(s)) &&
        publishedHidden.indexOf(s.id) === -1;
    });
```

por:

```js
    slides = slides.filter(function (s) {
      // hidden publicado (deletar pelo índice): some para todos
      return publishedHidden.indexOf(s.id) === -1;
    });
```

- [ ] **Step 8: applyContent — sem clientVisible**

Remover a linha:

```js
    clientVisible = Array.isArray(content.clientVisible) ? content.clientVisible : null;
```

- [ ] **Step 9: exportPPTX — sem regra de cliente**

Trocar:

```js
    var sel = window.PptxDoc.selectPptxSlides(slides, isClientVisible, publishedHidden);
```

por:

```js
    var sel = window.PptxDoc.selectPptxSlides(slides, null, publishedHidden);
```

(`selectPptxSlides` já trata não-função como "todos visíveis".)

- [ ] **Step 10: pptx-doc.mjs — fallback do nome do arquivo**

Em `pptxFileName`, trocar as duas ocorrências de `"aerolito-caixa"` por `"aerolito-portobello"`.

- [ ] **Step 10b: Atualizar comentários órfãos que citam @caixa/login**

Em `buildSlide`, substituir o comentário:

```js
    // botão X (canto sup. esquerdo): volta para o índice (visão geral).
    // só o perfil completo (@aeroli.to) recebe o botão, e em todos os slides;
    // @caixa não recebe o botão em nenhum.
```

por:

```js
    // botão X (canto sup. esquerdo): volta para o índice — só no modo edição.
```

E na declaração de `fullAccess`, substituir:

```js
  var fullAccess = false;   // perfil @aeroli.to (login): vê todos os slides + controles de edição
```

por:

```js
  var fullAccess = false;   // chave de edição na sessão: controles de edição visíveis
```

- [ ] **Step 11: Verificação de resíduos**

Run: `Select-String -Path public\portobello\js\deck.js -Pattern "clientVis|isClientVisible|applyEyeState|savedClientVisibleIds|sameIds|updateClientVisBar|idOf|@caixa|caixa"`
Expected: nenhuma ocorrência.

Run: `node --check public\portobello\js\deck.js`
Expected: sem erro de sintaxe.

- [ ] **Step 12: Commit**

```powershell
git add public/portobello/js/deck.js public/portobello/js/lib/pptx-doc.mjs
git commit -m "feat(portobello): remove logica de visibilidade @caixa do deck"
```

---

### Task 5: content-handlers (lib pura) — TDD

**Files:**
- Create: `netlify/functions/_lib/portobello-content-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts`

É o `temp/caixa/netlify/functions/lib/content-handlers.mjs` sem `clientVisible`/`handleSetClientVisible` e com a URL de imagem apontando pro novo endpoint.

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts
import { describe, it, expect } from "vitest";
import {
  handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide
} from "../portobello-content-handlers.mjs";

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

describe("portobello content handlers", () => {
  it("GET vazio retorna overrides/added/hidden default", async () => {
    const res = await handleGetContent(fakeStore());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ overrides: {}, added: [], hidden: [] });
  });

  it("saveContent grava patch e GET reflete", async () => {
    const store = fakeStore();
    const r = await handleSaveContent(
      { slideId: "s1", patch: { title: "Novo", body: ["a", "b"] } }, store);
    expect(r.status).toBe(200);
    const got = await handleGetContent(store);
    expect((got.body.overrides as any)["s1"]).toEqual({ title: "Novo", body: ["a", "b"] });
  });

  it("patch sem slideId é 400", async () => {
    expect((await handleSaveContent({ patch: { title: "z" } }, fakeStore())).status).toBe(400);
  });

  it("campo null remove o override; override vazio apaga a entrada", async () => {
    const store = fakeStore();
    await handleSaveContent({ slideId: "s", patch: { title: "T" } }, store);
    await handleSaveContent({ slideId: "s", patch: { title: null } }, store);
    const got = await handleGetContent(store);
    expect((got.body.overrides as any)["s"]).toBeUndefined();
  });

  it("addSlide + hideSlide de slide adicionado o remove da lista", async () => {
    const store = fakeStore();
    await handleAddSlide({ slide: { id: "novo-1", title: "X" } }, store);
    let got = await handleGetContent(store);
    expect((got.body.added as any[]).length).toBe(1);
    await handleHideSlide({ slideId: "novo-1" }, store);
    got = await handleGetContent(store);
    expect((got.body.added as any[]).length).toBe(0);
    expect(got.body.hidden).toEqual([]);   // added deletado não vira hidden
  });

  it("hideSlide de slide base registra em hidden (sem duplicar)", async () => {
    const store = fakeStore();
    await handleHideSlide({ slideId: "base-1" }, store);
    await handleHideSlide({ slideId: "base-1" }, store);
    const got = await handleGetContent(store);
    expect(got.body.hidden).toEqual(["base-1"]);
  });

  it("saveImage devolve imageUrl no endpoint portobello e getImage a serve", async () => {
    const store = fakeStore();
    const b64 = Buffer.from("fake-image-bytes").toString("base64");
    const r = await handleSaveImage(
      { slideId: "s1", imageUpload: { dataBase64: b64, contentType: "image/jpeg" } }, store);
    expect(r.status).toBe(200);
    expect(r.body.imageUrl).toMatch(/^\/api\/portobello-content\/image\?key=images%2F/);
    const key = decodeURIComponent(String(r.body.imageUrl).split("key=")[1]);
    const img = await handleGetImage(key, store);
    expect(img.status).toBe(200);
    expect(img.contentType).toBe("image/jpeg");
  });

  it("saveImage rejeita content-type não permitido", async () => {
    const r = await handleSaveImage(
      { slideId: "s1", imageUpload: { dataBase64: "aGk=", contentType: "application/pdf" } },
      fakeStore());
    expect(r.status).toBe(400);
  });

  it("getImage barra path traversal e prefixo errado", async () => {
    expect((await handleGetImage("../secrets", fakeStore())).status).toBe(400);
    expect((await handleGetImage("other/abc", fakeStore())).status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts`
Expected: FAIL (módulo `../portobello-content-handlers.mjs` não existe).

- [ ] **Step 3: Implementar a lib**

```js
// netlify/functions/_lib/portobello-content-handlers.mjs
/* Núcleo da edição de slides do deck /portobello — recebe o store (Blobs ou
   fake) injetado. Overrides ficam num único blob "overrides":
   { "<slideId>": { title?, subtitle?, body?, image?, items?, ... } }.
   Funções puras retornando { status, body }. Adaptado do deck Caixa,
   sem a allowlist clientVisible. */
import { createHash } from "node:crypto";

const OVERRIDES_KEY = "overrides";
const ADDED_KEY = "added";     // slides novos criados pelo editor (lista)
const HIDDEN_KEY = "hidden";   // ids de slides ocultados (publicado, lista)
const EDITABLE = ["title", "subtitle", "body", "image", "items", "gallery", "video", "media"];
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"
]);

export async function handleGetContent(store) {
  const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  const hidden = (await store.get(HIDDEN_KEY, { type: "json" })) || [];
  return { status: 200, body: { overrides, added, hidden } };
}

export async function handleAddSlide(body, store) {
  const slide = body && body.slide;
  if (!slide || !slide.id || typeof slide.id !== "string") {
    return { status: 400, body: { error: "slide sem id" } };
  }
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  added.push(slide);
  await store.setJSON(ADDED_KEY, added);
  return { status: 200, body: { ok: true, slide } };
}

export async function handleHideSlide(body, store) {
  const id = body && body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  // se for um slide adicionado pelo editor, deletar = removê-lo da lista added
  const added = (await store.get(ADDED_KEY, { type: "json" })) || [];
  const idx = added.findIndex((s) => s && s.id === id);
  if (idx !== -1) {
    added.splice(idx, 1);
    await store.setJSON(ADDED_KEY, added);
    // limpa o override do slide novo p/ não deixar entrada órfã
    const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
    if (overrides[id]) {
      delete overrides[id];
      await store.setJSON(OVERRIDES_KEY, overrides);
    }
    return { status: 200, body: { ok: true } };
  }
  // slide base: registra a ocultação publicada (sem duplicar)
  const hidden = (await store.get(HIDDEN_KEY, { type: "json" })) || [];
  if (hidden.indexOf(id) === -1) {
    hidden.push(id);
    await store.setJSON(HIDDEN_KEY, hidden);
  }
  return { status: 200, body: { ok: true } };
}

export async function handleSaveContent(body, store) {
  const id = body.slideId;
  if (!id || typeof id !== "string") return { status: 400, body: { error: "slideId ausente" } };
  const patch = (body && body.patch) || {};
  const overrides = (await store.get(OVERRIDES_KEY, { type: "json" })) || {};
  const cur = overrides[id] || {};
  for (const field of EDITABLE) {
    if (!(field in patch)) continue;
    const val = patch[field];
    if (val === null) delete cur[field];   // null = voltar ao base
    else cur[field] = val;
  }
  if (Object.keys(cur).length === 0) delete overrides[id];
  else overrides[id] = cur;
  await store.setJSON(OVERRIDES_KEY, overrides);
  return { status: 200, body: { ok: true, overrides } };
}

export async function handleSaveImage(body, store) {
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
  const key = "images/" + id + "-" + hash;
  await store.set(key, bytes, { metadata: { contentType: up.contentType } });
  return { status: 200, body: { ok: true, imageUrl: "/api/portobello-content/image?key=" + encodeURIComponent(key) } };
}

export async function handleGetImage(key, store) {
  if (!key || key.indexOf("images/") !== 0 || key.indexOf("..") !== -1) {
    return { status: 400, contentType: null, data: null };
  }
  const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!res || !res.data) return { status: 404, contentType: null, data: null };
  const contentType = (res.metadata && res.metadata.contentType) || "application/octet-stream";
  return { status: 200, contentType, data: res.data };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```powershell
git add netlify/functions/_lib/portobello-content-handlers.mjs netlify/functions/_lib/__tests__/portobello-content-handlers.test.ts
git commit -m "feat(portobello): content-handlers puros (sem clientVisible) + testes"
```

---

### Task 6: backup-handlers (lib pura) — TDD

**Files:**
- Create: `netlify/functions/_lib/portobello-backup-handlers.mjs`
- Test: `netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts`

Adaptado de `temp/caixa/netlify/functions/lib/backup-handlers.mjs`, snapshot cobre 3 JSONs (`overrides`, `added`, `hidden` — sem `clientVisible`).

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts
import { describe, it, expect } from "vitest";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup,
  handleExportBundle, hashContent, MAX_SNAPSHOTS
} from "../portobello-backup-handlers.mjs";

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
    async list({ prefix }: { prefix: string }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

describe("portobello backup handlers", () => {
  it("snapshot captura o estado e lista", async () => {
    const content = fakeStore({ overrides: { s1: { title: "X" } } });
    const backup = fakeStore();
    const r = await handleCaptureSnapshot(content, backup, "teste");
    expect(r.status).toBe(200);
    expect((r.body as any).snapshot.reason).toBe("teste");
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.length).toBe(1);
  });

  it("snapshot idêntico consecutivo é dedupado", async () => {
    const content = fakeStore();
    const backup = fakeStore();
    await handleCaptureSnapshot(content, backup, "a");
    const r2 = await handleCaptureSnapshot(content, backup, "b");
    expect((r2.body as any).skipped).toBe(true);
    expect((await handleListBackups(backup)).body.backups.length).toBe(1);
  });

  it("hash é estável independente da ordem das chaves", () => {
    expect(hashContent({ overrides: { a: 1, b: 2 }, added: [], hidden: [] }))
      .toBe(hashContent({ hidden: [], added: [], overrides: { b: 2, a: 1 } }));
  });

  it("restore reaplica os 3 JSONs e snapshota o estado atual antes", async () => {
    const content = fakeStore({ overrides: { s1: { title: "v1" } } });
    const backup = fakeStore();
    const snap = await handleCaptureSnapshot(content, backup, "v1");
    const id = (snap.body as any).snapshot.id;
    await content.setJSON("overrides", { s1: { title: "v2" } });
    const r = await handleRestoreBackup({ id }, content, backup);
    expect(r.status).toBe(200);
    expect(content.data.get("overrides")).toEqual({ s1: { title: "v1" } });
    // pre-restore do estado v2 entrou no índice
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.some((b: any) => b.reason === "pre-restore")).toBe(true);
  });

  it("restore de id inexistente é 404; sem id é 400", async () => {
    expect((await handleRestoreBackup({ id: "nope" }, fakeStore(), fakeStore())).status).toBe(404);
    expect((await handleRestoreBackup({}, fakeStore(), fakeStore())).status).toBe(400);
  });

  it("export inclui conteúdo e imagens em base64", async () => {
    const content = fakeStore({ overrides: {} });
    await content.set("images/s1-abc", Buffer.from("img"), { metadata: { contentType: "image/png" } });
    const r = await handleExportBundle(content);
    expect(r.status).toBe(200);
    expect((r.body as any).images.length).toBe(1);
    expect((r.body as any).images[0].contentType).toBe("image/png");
  });

  it("poda além de MAX_SNAPSHOTS", async () => {
    const content = fakeStore();
    const backup = fakeStore();
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      await content.setJSON("overrides", { n: i });   // muda o hash a cada volta
      await handleCaptureSnapshot(content, backup, "loop");
    }
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.length).toBe(MAX_SNAPSHOTS);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar a lib**

```js
// netlify/functions/_lib/portobello-backup-handlers.mjs
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```powershell
git add netlify/functions/_lib/portobello-backup-handlers.mjs netlify/functions/_lib/__tests__/portobello-backup-handlers.test.ts
git commit -m "feat(portobello): backup-handlers puros (3 JSONs) + testes"
```

---

### Task 7: Endpoints — portobello-content.mjs e portobello-backup.mjs

**Files:**
- Create: `netlify/functions/_lib/portobello-edit-key.mjs`
- Create: `netlify/functions/portobello-content.mjs`
- Create: `netlify/functions/portobello-backup.mjs`
- Test: `netlify/functions/_lib/__tests__/portobello-edit-key.test.ts`

A validação da chave vive em `_lib` (não numa das functions) para as duas functions importarem o mesmo helper sem uma bundlar a outra.

- [ ] **Step 1: Escrever o teste da validação de chave (falhando)**

```ts
// netlify/functions/_lib/__tests__/portobello-edit-key.test.ts
import { describe, it, expect } from "vitest";
import { isValidEditKey } from "../portobello-edit-key.mjs";

describe("isValidEditKey", () => {
  it("aceita quando a chave bate com a env", () => {
    expect(isValidEditKey("s3gr3do", "s3gr3do")).toBe(true);
  });
  it("rejeita chave errada, ausente ou não-string", () => {
    expect(isValidEditKey("errada", "s3gr3do")).toBe(false);
    expect(isValidEditKey(undefined, "s3gr3do")).toBe(false);
    expect(isValidEditKey(123 as unknown as string, "s3gr3do")).toBe(false);
  });
  it("rejeita TUDO quando a env não está configurada (fail closed)", () => {
    expect(isValidEditKey("qualquer", undefined)).toBe(false);
    expect(isValidEditKey("", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-edit-key.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o helper de chave**

```js
// netlify/functions/_lib/portobello-edit-key.mjs
// fail closed: sem PORTOBELLO_EDIT_KEY configurada, nenhuma escrita passa.
export function isValidEditKey(provided, expected) {
  return typeof expected === "string" && expected.length > 0 &&
    typeof provided === "string" && provided === expected;
}
```

Run: `npx vitest run netlify/functions/_lib/__tests__/portobello-edit-key.test.ts`
Expected: PASS.

- [ ] **Step 4: Implementar portobello-content.mjs**

```js
// netlify/functions/portobello-content.mjs
import { getStore } from "@netlify/blobs";
import {
  handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide
} from "./_lib/portobello-content-handlers.mjs";
import { handleCaptureSnapshot } from "./_lib/portobello-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/portobello-edit-key.mjs";

function store() { return getStore({ name: "portobello-deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "portobello-deck-backups", consistency: "strong" }); }

export default async (req) => {
  const url = new URL(req.url);

  // GET /api/portobello-content/image?key=images/... (público)
  if (url.pathname.endsWith("/image")) {
    if (req.method !== "GET") return Response.json({ error: "método não permitido" }, { status: 405 });
    const { status, contentType, data } = await handleGetImage(url.searchParams.get("key"), store());
    if (status !== 200) return Response.json({ error: "imagem não encontrada" }, { status });
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }
    });
  }

  // GET /api/portobello-content — overrides/added/hidden (leitura pública)
  if (req.method === "GET") {
    const { status, body } = await handleGetContent(store());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  // POST — toda escrita exige a chave de edição (body.key)
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PORTOBELLO_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "verify") return Response.json({ ok: true });

    let fn = handleSaveContent;
    let mutatesState = true;  // upload de imagem não muda os 3 JSONs → não snapshota
    if (body.imageUpload) { fn = handleSaveImage; mutatesState = false; }
    else if (body.action === "addSlide") fn = handleAddSlide;
    else if (body.action === "hideSlide") fn = handleHideSlide;
    const cStore = store();
    if (mutatesState) {
      // captura o estado PRE-save como ponto de rollback, antes de aplicar a mutação.
      // best-effort: nunca bloqueia a edição se o backup falhar.
      try { await handleCaptureSnapshot(cStore, backupStore(), body.action || "saveContent"); }
      catch (e) { console.error("backup snapshot falhou (ignorado):", e); }
    }
    const { status, body: out } = await fn(body, cStore);
    return Response.json(out, { status });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: ["/api/portobello-content", "/api/portobello-content/image"] };
```

- [ ] **Step 5: Implementar portobello-backup.mjs**

```js
// netlify/functions/portobello-backup.mjs
import { getStore } from "@netlify/blobs";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "./_lib/portobello-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/portobello-edit-key.mjs";

function contentStore() { return getStore({ name: "portobello-deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "portobello-deck-backups", consistency: "strong" }); }

export default async (req) => {
  // GET /api/portobello-backup — lista (só metadados; público)
  if (req.method === "GET") {
    const { status, body } = await handleListBackups(backupStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  // POST — restore | export | manual (gated por PORTOBELLO_EDIT_KEY)
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PORTOBELLO_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "restore") {
      const { status, body: out } = await handleRestoreBackup(body, contentStore(), backupStore());
      return Response.json(out, { status });
    }
    if (body.action === "export") {
      const { status, body: out } = await handleExportBundle(contentStore());
      return Response.json(out, { status });
    }
    if (body.action === "manual") {
      const { status, body: out } = await handleCaptureSnapshot(contentStore(), backupStore(), "manual");
      return Response.json(out, { status });
    }
    return Response.json({ error: "ação desconhecida" }, { status: 400 });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: "/api/portobello-backup" };
```

- [ ] **Step 6: Rodar todos os testes**

Run: `npx vitest run`
Expected: PASS geral (suítes novas + existentes, sem regressão).

- [ ] **Step 7: Commit**

```powershell
git add netlify/functions/_lib/portobello-edit-key.mjs netlify/functions/portobello-content.mjs netlify/functions/portobello-backup.mjs netlify/functions/_lib/__tests__/portobello-edit-key.test.ts
git commit -m "feat(portobello): functions content+backup com edit-key (fail closed)"
```

---

### Task 8: Roteamento, robots e build

**Files:**
- Modify: `netlify.toml`
- Modify: `public/robots.txt`

- [ ] **Step 1: Redirect /portobello → /portobello/ no netlify.toml**

Inserir ANTES do catch-all `[[redirects]] from = "/*"`:

```toml
[[redirects]]
  from = "/portobello"
  to = "/portobello/"
  status = 301
```

(Os arquivos estáticos em `dist/portobello/` vencem o catch-all do SPA — redirects 200 não-forçados só se aplicam quando o arquivo não existe.)

- [ ] **Step 2: Bloquear indexação (URL direta, fora da navegação)**

Em `public/robots.txt`, adicionar junto ao bloco de Disallow existente:

```
Disallow: /portobello
```

- [ ] **Step 3: Build + conferência do dist**

Run: `npm run build`
Expected: build verde.

Run: `Get-ChildItem dist\portobello -Recurse -File | Measure-Object | Select-Object Count`
Expected: 12 arquivos (os 11 da cópia + slides.json).

- [ ] **Step 4: Commit**

```powershell
git add netlify.toml public/robots.txt
git commit -m "feat(portobello): redirect /portobello e robots noindex"
```

---

### Task 9: Smoke programático

**Files:**
- Create: `scripts/smoke-portobello.mjs`

Modelado em `scripts/smoke-aerolito.mjs`. Roda contra deploy preview ou prod; a parte de render usa Playwright (devDependency já instalada).

- [ ] **Step 1: Escrever o smoke**

```js
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
```

- [ ] **Step 2: Commit**

```powershell
git add scripts/smoke-portobello.mjs
git commit -m "feat(portobello): smoke programatico (fetch + playwright)"
```

---

### Task 10: Verificação local de ponta a ponta

- [ ] **Step 1: Suíte completa + build**

Run: `npx vitest run` e depois `npm run build`
Expected: tudo verde.

- [ ] **Step 2: Servir localmente com functions e rodar o smoke**

`netlify dev` serve o Vite + functions. Blobs local é sandbox — o GET de content funciona vazio.

```powershell
# terminal A (background):
npx netlify dev
# terminal B (a porta padrão do netlify dev é 8888):
$env:PORTOBELLO_EDIT_KEY = "smoke-local-key"   # opcional p/ o teste de verify local
node scripts/smoke-portobello.mjs http://localhost:8888
```

Expected: todos os checks ✓ (o de verify só roda se passar a chave como 2º argumento; localmente a env precisa estar no processo do `netlify dev`, então sem ela é aceitável pular).

Nota: no `netlify dev`, o redirect 301 de `/portobello` pode se comportar diferente do CDN; o check 1 segue redirects, então passa igual. Se `/portobello` sem barra falhar SÓ localmente mas `/portobello/` funcionar, seguir em frente e validar no deploy preview.

- [ ] **Step 3: Commit de eventuais ajustes**

Se o smoke exigir correção, corrigir e commitar com mensagem `fix(portobello): <o que foi>`.

---

### Task 11: PR + validação no deploy preview

- [ ] **Step 1: Push + PR**

```powershell
git push -u origin feat/portobello-deck
gh pr create --title "feat: deck de slides Aerolito em /portobello" --body @'
## O que é

A lógica de exibição+edição de slides do deck Aeroli.to (projeto Caixa) reaproveitada como sub-site estático em `/portobello`, esvaziada de todo conteúdo Caixa.

- `public/portobello/` — deck vanilla (capa, navegação, índice, export PDF/PPTX)
- Sem login e sem votação (removidos por completo)
- Edição runtime protegida por `PORTOBELLO_EDIT_KEY` (tecla `E` ou `?edit=1`); POST sem chave → 401 (fail closed)
- Functions `portobello-content` + `portobello-backup` com Blobs stores próprios
- Spec: `docs/superpowers/specs/2026-07-17-portobello-deck-design.md`

## Pendência pós-merge (manual)

Cadastrar `PORTOBELLO_EDIT_KEY` no painel Netlify (Site settings → Environment variables).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
```

- [ ] **Step 2: Smoke contra o deploy preview**

Aguardar o deploy preview do Netlify ficar pronto (via `gh pr checks` ou API do Netlify) e rodar:

```powershell
node scripts/smoke-portobello.mjs https://deploy-preview-<N>--guiresende20.netlify.app
```

Expected: todos os checks ✓ (sem a env no preview, o check de verify é pulado; o 401 fail-closed é exatamente o comportamento esperado sem env).

- [ ] **Step 3: Reportar ao owner**

Resumo com: link do PR, resultado do smoke, e o passo a passo da env var (`PORTOBELLO_EDIT_KEY` em Site settings → Environment variables, escopo Functions).
