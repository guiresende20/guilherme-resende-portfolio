# Light Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o site inteiro (homepage + blog + componentes globais) do tema dark atual (`#0a0a0f`) pra um tema light (off-white `#fafafa`), incluindo ajuste do canvas 3D, cards translúcidos, e todos os componentes.

**Architecture:** Substituição completa (não toggle). Tokens HSL no `index.css` + `tailwind.config.ts`. Migração component-by-component validada por smoke Playwright (`scripts/smoke-hero-scene.mjs` + uma extensão pra blog/projects). Branch nova `feat/light-theme`; merge só depois de todos os critérios da spec validados.

**Tech Stack:** TailwindCSS 3 + custom CSS variables, React 18, three.js (canvas 3D), Disqus embed, rehype-highlight.

**Spec:** `docs/superpowers/specs/2026-05-20-light-theme-redesign-design.md` (ler antes — contém decisões críticas que o owner deve verificar antes de começar).

---

## Pre-flight (owner valida antes do Task 1)

Antes de qualquer task, **owner precisa confirmar/ajustar:**

1. Paleta exata da spec (HSL values) — checar visualmente se os greens/blues propostos passam vibe certa
2. Decisão sobre identidade neon — manter `hsl(150 90% 30%)` ou pedir variação?
3. Style de card (translúcido com blur vs opaco com shadow) — eu recomendei translúcido pra preservar feature #6 (cena 3D contextual)

Se owner pedir mudança, editar **spec primeiro**, depois cascatear pro plan (Task 1 e Task 4 são os mais afetados).

---

## Task 0: Setup branch + discovery de hardcoded colors

**Files:**
- Create: branch `feat/light-theme` baseada em `main` (após merge do PR #8)
- Modify: nada ainda

- [ ] **Step 1: Garantir que PR #8 está mergeado em main**

Run:
```bash
gh pr view 8 --json state,mergeCommit
```

Se state ≠ "MERGED", parar e mergear PR #8 primeiro. Light theme depende do canvas 3D estável.

- [ ] **Step 2: Criar branch**

Run:
```bash
git checkout main && git pull && git checkout -b feat/light-theme
```

- [ ] **Step 3: Grep amplo de cores hardcoded (output base pra Task 0 de cada componente)**

Run (pelo Grep tool, não Bash):
```
Pattern: #[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)
Files: src/**/*.{ts,tsx,css}
```

Salvar resultados em `docs/superpowers/notes/2026-05-20-hardcoded-colors-audit.md`. Esse arquivo serve de checklist pras tasks de componente — cada cor hardcoded vira "verificar se precisa mudar".

- [ ] **Step 4: Smoke baseline (screenshots dark) pra comparar depois**

Run:
```bash
npm run build && npm run preview -- --port 4180 --strictPort
```

Em outro terminal:
```bash
node scripts/smoke-hero-scene.mjs
cp -r scripts/.smoke-out scripts/.smoke-out-baseline-dark
```

Garante screenshots do tema dark como referência.

- [ ] **Step 5: Commit inicial**

```bash
git add docs/superpowers/specs/2026-05-20-light-theme-redesign-design.md docs/superpowers/plans/2026-05-20-light-theme-redesign.md docs/superpowers/notes/2026-05-20-hardcoded-colors-audit.md
git commit -m "docs(light-theme): spec + plan + hardcoded color audit"
```

---

## Task 1: Swap dos CSS variables principais (index.css)

**Files:**
- Modify: `src/index.css` (variables block `:root` ~linhas 5-30)

- [ ] **Step 1: Ler estado atual**

Read: `src/index.css` linhas 1-50. Identificar bloco `:root { ... }` com variáveis HSL.

- [ ] **Step 2: Substituir bloco de variáveis**

Replace o bloco atual por:

```css
:root {
  --background: 0 0% 98%;
  --foreground: 240 10% 12%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 12%;
  --primary: 150 90% 30%;
  --primary-foreground: 0 0% 98%;
  --secondary: 220 80% 45%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 4% 92%;
  --muted-foreground: 240 4% 42%;
  --accent: 150 90% 38%;
  --accent-foreground: 0 0% 98%;
  --border: 240 4% 85%;
  --input: 240 4% 90%;
  --ring: 150 90% 30%;
  --destructive: 0 84% 50%;
  --destructive-foreground: 0 0% 98%;
  --radius: 0.5rem;
}
```

(Manter `--radius` se já existir.)

- [ ] **Step 3: Substituir cores hardcoded em selectors globais**

Procurar no mesmo `index.css`:
- `::selection { background: rgba(0,255,135,0.2); color: #e8e8e8; }` → trocar pra `rgba(11,152,88,0.25)` e color `#0a0a0f`
- `::-webkit-scrollbar-track { background: #0a0a0f; }` → trocar pra `#e5e5e5`
- `::-webkit-scrollbar-thumb { background: #2a2a35; }` → trocar pra `#999`
- `.bg-grid` linear-gradient `rgba(255,255,255,0.03)` → trocar pra `rgba(0,0,0,0.04)` (grade escura sutil sobre branco)
- `.neon-line` gradient `transparent → #2a2a35 → #00ff87 → #2a2a35 → transparent` → trocar pra `transparent → #ccc → #0b9858 → #ccc → transparent`
- Qualquer outro `linear-gradient` com cores hardcoded — adaptar

Use Grep first pra listar todas as ocorrências, depois Edit pra cada uma.

- [ ] **Step 4: Build + smoke**

Run:
```bash
npm run build && node scripts/smoke-hero-scene.mjs
```

Esperar quebras visuais óbvias (botões/cards ainda com texto branco sobre branco). É esperado nesta task — vamos corrigir nos componentes.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(light-theme): swap CSS variables to light palette"
```

---

## Task 2: Swap das custom colors no Tailwind config

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Ler estado atual**

Read: `tailwind.config.ts`. Identificar bloco `extend.colors` com `neon`, `electric`, `dim`, `outline`, etc.

- [ ] **Step 2: Substituir custom colors**

Trocar valores hardcoded:
- `neon: "#00ff87"` → `neon: "hsl(150 90% 30%)"` (ou usar `var(--primary)`)
- `electric: "#4d8cff"` → `electric: "hsl(220 80% 45%)"`
- `dim: "#2a2a35"` → `dim: "hsl(240 4% 75%)"` (light gray, era cinza-escuro)
- Qualquer cor `#666680` ou similar — adaptar pra light analógico

Verificar se classes tipo `text-outline` referenciam essas cores via custom class no `index.css` — se sim, adaptar lá também.

- [ ] **Step 3: Verificar `text-outline` class**

Grep:
```
Pattern: \.text-outline
Files: src/**/*.css
```

Se for `-webkit-text-stroke: 1.5px #666680;` — trocar pra `#ccc` ou cor light apropriada.

- [ ] **Step 4: Build + smoke**

Run: `npm run build && node scripts/smoke-hero-scene.mjs`

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/index.css
git commit -m "feat(light-theme): swap tailwind custom colors to light palette"
```

---

## Task 3: Canvas 3D — partículas + linhas + ScanPlanes

**Files:**
- Modify: `src/components/HeroScene3D.tsx`

- [ ] **Step 1: Atualizar `buildColors()` (linhas ~14-28)**

Read função `buildColors`. As cores atuais:
```ts
const neon = new THREE.Color("#00ff87");
const electric = new THREE.Color("#4d8cff");
const muted = new THREE.Color("#666680");
```

Trocar pra:
```ts
const neon = new THREE.Color("#0b9858");
const electric = new THREE.Color("#2b5fb8");
const muted = new THREE.Color("#9999a8");
```

- [ ] **Step 2: Atualizar `lineBasicMaterial` color (~linha 178)**

Atual: `<lineBasicMaterial ref={lineMaterialRef} color="#00ff87" transparent opacity={0.12} />`

Trocar pra: `color="#2b5fb8" opacity={0.15}` (azul escuro, levemente mais visível).

- [ ] **Step 3: Atualizar `ScanPlanes` cores (linhas ~185-203)**

Atual:
```tsx
<meshBasicMaterial color={i === 1 ? "#00ff87" : "#4d8cff"} ... />
```

Trocar pra:
```tsx
<meshBasicMaterial color={i === 1 ? "#0b9858" : "#2b5fb8"} ... />
```

- [ ] **Step 4: Atualizar lógica de `hueFromProgress` (em `src/lib/motion/hue.ts`)**

A função `hueFromProgress(progress)` calcula um hue dinâmico baseado no scroll. Verificar se o valor inicial (0.4 = green) ainda faz sentido pra paleta light. Provavelmente sim, mas a `setHSL(hue, 0.85, 0.55)` no useFrame pode ter saturação/lightness inadequadas pra fundo branco. Tentar `setHSL(hue, 0.75, 0.35)` (mais escuro, menos saturado).

Editar `HeroScene3D.tsx` no `useFrame`:
```ts
pointsMaterialRef.current.color.setHSL(hue, 0.75, 0.35);
lineMaterialRef.current.color.setHSL(hue, 0.75, 0.35);
```

- [ ] **Step 5: Build + smoke**

Run: `npm run build && node scripts/smoke-hero-scene.mjs`

Validar que partículas estão visíveis nas screenshots `01-hero-top.png` e `02-projetos.png`. Se sumiram, ajustar lightness mais baixa (`0.25` ou `0.2`).

- [ ] **Step 6: Commit**

```bash
git add src/components/HeroScene3D.tsx src/lib/motion/hue.ts
git commit -m "feat(light-theme): adapt canvas 3D particle colors for light background"
```

---

## Task 4: Hero — text-outline, botões, marquee

**Files:**
- Modify: `src/components/Hero.tsx`

- [ ] **Step 1: Ler estado atual**

Read: `src/components/Hero.tsx` inteiro. Identificar:
- Top fade gradient (adicionado em PR #8 commit `4c2d99b`): `<div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/85 to-transparent..." />` — com `from-background/85`, no light theme isso vira `from-white/85`. Verificar se ainda faz sentido (atenuar canvas no topo) ou remover.
- Texto principal `GUILHERME RESENDE MUNIZ` com cores `text-foreground`, `text-outline`, `text-neon` — confirmar que vão renderizar bem no light. `text-foreground` será dark (12% lightness), `text-neon` será dark green, `text-outline` será o stroke ajustado em Task 2.
- Foto: `border-2 border-neon/30` — `neon/30` no light theme = green escuro com alpha 30% — verificar contraste contra foto.
- Botões CTA (3): "Ver projetos", "Falar com IA", "Contato" — todos têm `bg-neon text-background`. `bg-neon` agora = green escuro, `text-background` = branco. Inverteu naturalmente. Verificar.
- Marquee: `border-b border-white/[0.03]` — trocar `border-white` pra `border-foreground/[0.05]` ou similar (linha sutil).
- Contadores/stats: `text-foreground` (vira dark) + `text-neon` pra "+" — OK por token.

- [ ] **Step 2: Editar com ajustes mínimos**

Identificar quais classes precisam mudar (provavelmente poucas porque a maioria usa tokens semânticos). Casos típicos:
- `border-white/[0.03]` → `border-foreground/[0.05]`
- Qualquer `bg-white` literal → `bg-card` ou `bg-background`
- Qualquer `text-white` literal → `text-foreground`

- [ ] **Step 3: Build + smoke**

Run: `npm run build && node scripts/smoke-hero-scene.mjs`

Verificar:
- Texto GUILHERME visível (dark) ✓
- RESENDE em verde escuro ✓
- MUNIZ no outline (light gray stroke) ✓
- Botões com bom contraste ✓
- Top fade do navbar ainda atenua canvas (se necessário; senão remover)

- [ ] **Step 4: Commit**

```bash
git add src/components/Hero.tsx
git commit -m "feat(light-theme): adapt Hero text and CTAs"
```

---

## Task 5: Navbar (transparent/scrolled states)

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Ler estado atual**

Read: `src/components/Navbar.tsx`. Identificar:
- `background: scrolled ? "rgba(10,10,15,0.85)" : "transparent"` — trocar `rgba(10,10,15...)` pra `rgba(250,250,250,0.92)` (light bg semi-opaque)
- `borderBottom: scrolled ? "1px solid rgba(42,42,53,0.5)" : "1px solid transparent"` — trocar pra `rgba(0,0,0,0.08)`
- Mobile menu bg: `bg-background/95` (token, OK)
- Links: `text-muted-foreground hover:text-foreground` (token, OK)
- Logo: `text-foreground` + `.` em `text-neon` (token, OK)
- Underline animado: `bg-neon` (token, OK)

- [ ] **Step 2: Editar inline styles**

Substituir cores hardcoded no `style={{ background: ..., borderBottom: ... }}`.

- [ ] **Step 3: Build + smoke (incluir scroll pra ativar `scrolled=true`)**

O smoke atual já scrolla. Verificar screenshot quando navbar tá em estado `scrolled`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(light-theme): adapt Navbar scrolled background"
```

---

## Task 6: About + Experience + Education + Skills + Contact sections

**Files:**
- Modify: `src/components/About.tsx`, `Experience.tsx`, `Education.tsx`, `Skills.tsx`, `Contact.tsx`

Esses 5 são similares: `relative` section + `bg-grid` overlay + cards internos. Pra cada um:

- [ ] **Step 1: Ler arquivo, identificar:**
  - `bg-card`, `bg-card/30`, `border-border` — todos tokens, devem propagar OK
  - Hardcoded colors (`#...`, `rgba(...)`, `hsl(...)`) — listar
  - Texts: `text-foreground`, `text-muted-foreground`, `text-neon` — tokens, OK
  - Hover states com cores hardcoded — atualizar

- [ ] **Step 2: Editar hardcoded colors**

Substituir caso a caso. Padrões comuns:
- `border-white/[0.05]` → `border-foreground/[0.08]`
- `bg-white/5` → `bg-foreground/5` ou `bg-card`
- Gradient com `#0a0a0f` ou similar — usar `hsl(var(--background))`

- [ ] **Step 3: Build + smoke ampliado**

O smoke atual cobre só `inicio`/`projetos`. Adicionar screenshots pras outras sections (extender `scripts/smoke-hero-scene.mjs`). Cobrir cada section_id: `sobre`, `experiencia`, `educacao`, `skills`, `contato`.

- [ ] **Step 4: Commit por seção**

```bash
git commit -m "feat(light-theme): adapt About section"
git commit -m "feat(light-theme): adapt Experience section"
... etc
```

(Um commit por seção pra granularidade.)

---

## Task 7: Projects — cards + modal

**Files:**
- Modify: `src/components/Projects.tsx`

- [ ] **Step 1: Ler arquivo**

Read: `src/components/Projects.tsx`. Identificar:
- `.project-card` class: `bg-card border border-border` — tokens, OK. Mas owner pediu **transparência mais leve** pros cards. Adicionar:
  - Mudar pra `bg-card/85 backdrop-blur-md` pra permitir canvas mostrar através
  - Ou mais opaco: `bg-card shadow-md` se a cena 3D não precisar transparecer atrás

- [ ] **Step 2: Editar classe dos cards (decisão da spec #3)**

Se owner aprovou **translúcido com blur** na spec:
```tsx
<div className="project-card group bg-card/85 backdrop-blur-md border border-border rounded-md p-6 ...">
```

Se aprovou **opaco com shadow**:
```tsx
<div className="project-card group bg-card border border-border shadow-sm rounded-md p-6 ...">
```

- [ ] **Step 3: Ajustar `ProjectModal`**

No mesmo arquivo, identificar `<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" ...` — trocar `bg-black/70` pra `bg-foreground/40` ou `bg-black/30` (overlay mais leve no light theme).

E `<div className="fixed inset-4 ... bg-card border border-border ...">` — token, OK; mas verificar shadow/border pra dar definição contra overlay claro.

- [ ] **Step 4: Verificar tags chips**

`border-neon/25 px-2.5 py-1` — `neon/25` no light theme = green escuro com alpha 25% — visível mas tênue. OK.

- [ ] **Step 5: Build + smoke**

Run: `npm run build && node scripts/smoke-hero-scene.mjs`

Verificar screenshot `02-projetos.png`. Cards devem ter definição clara contra fundo branco. Grid 3D ainda lê (através das transparências dos cards).

- [ ] **Step 6: Commit**

```bash
git add src/components/Projects.tsx
git commit -m "feat(light-theme): adapt Projects cards and modal"
```

---

## Task 8: ChatWidget + ScrollProgress + Footer + SectionHeader

**Files:**
- Modify: `src/components/ChatWidget.tsx`, `ScrollProgress.tsx`, `Footer.tsx`, `SectionHeader.tsx`

- [ ] **Step 1: ChatWidget**

Read e identificar:
- Bubble bg, message bubbles (user vs assistant), input bg, scrollbar
- Provavelmente já usa tokens. Validar e ajustar hardcodes.

- [ ] **Step 2: ScrollProgress**

Read. Provavelmente é uma `<div className="fixed top-0 h-0.5 bg-neon" ... />` — token, OK. Verificar se contraste é bom contra hero/sections.

- [ ] **Step 3: Footer**

Read. Verificar bg, link colors, social icons.

- [ ] **Step 4: SectionHeader**

Read. A classe `.text-outline` usa stroke — já ajustado em Task 2. Mas re-verificar visualmente nos smokes.

- [ ] **Step 5: Build + smoke + commit**

Um commit cobrindo os 4:
```bash
git commit -m "feat(light-theme): adapt ChatWidget, ScrollProgress, Footer, SectionHeader"
```

---

## Task 9: Blog — layout, post cards, markdown, TOC

**Files:**
- Modify: `src/pages/Blog.tsx`, `BlogPost.tsx`, `BlogTag.tsx`
- Modify: `src/components/blog/BlogLayout.tsx`, `MarkdownRenderer.tsx`, `PostCard.tsx`, `PostTOC.tsx`, `ShareButtons.tsx`, `TranslateBanner.tsx`

- [ ] **Step 1: BlogLayout + páginas**

Verificar cada `.tsx` em busca de:
- `bg-background`, `bg-card`, `bg-muted` — tokens, OK
- Hardcoded cores em links, headings — substituir
- `prose-invert` (TailwindCSS Typography) — trocar pra `prose` (light) ou `prose-zinc` etc.

- [ ] **Step 2: MarkdownRenderer + rehype-highlight**

Em `MarkdownRenderer.tsx`:
- Identificar como o tema de syntax highlight é importado. Provavelmente algo tipo `import 'highlight.js/styles/github-dark.css'`
- Trocar pra `github-light.css` ou `atom-one-light.css`

- [ ] **Step 3: PostCard**

Verificar bg do card, hover state, tag chips. Aplicar mesma direção de Task 7 (translúcido com blur ou opaco com shadow — consistência).

- [ ] **Step 4: ShareButtons, PostTOC, TranslateBanner**

Cada um: verificar bg, borders, hover, accent colors.

- [ ] **Step 5: Smoke estendido pra blog**

Adicionar ao smoke uma navegação pra `/blog` e capturar:
- Lista de posts (blog index)
- Um post individual aberto (URL com slug)

Em `scripts/smoke-hero-scene.mjs`, adicionar:
```js
await page.goto(`${URL}blog`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/04-blog-index.png` });
// ... abrir um post e screenshot
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(light-theme): adapt Blog pages and components"
```

---

## Task 10: Disqus theme switch

**Files:**
- Modify: `src/components/blog/DisqusEmbed.tsx`

- [ ] **Step 1: Ler arquivo**

Read: `src/components/blog/DisqusEmbed.tsx`. Identificar o `disqus_config` ou theme parameter.

- [ ] **Step 2: Switch theme**

Disqus suporta themes via `colorScheme` ou similar. Pode estar como:
```js
disqus_config = function () {
  this.colorScheme = 'dark';
}
```

Trocar pra `'auto'` ou `'light'`.

Se a integração não suportar troca limpa, considerar:
- Custom CSS override (Disqus permite via Settings)
- Iframe wrapper com filter (não ideal)
- Remover Disqus do light theme e migrar pra alternativa (giscus, utterances)

- [ ] **Step 3: Verificar visualmente em um post**

Abrir um post no preview, scrollar até comentários, conferir que Disqus tá em light.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(light-theme): switch Disqus theme to light"
```

---

## Task 11: Verificação final + WCAG audit

**Files:**
- Create: `docs/superpowers/notes/2026-05-20-light-theme-wcag-audit.md`

- [ ] **Step 1: Smoke completo final**

Run: `npm run build && node scripts/smoke-hero-scene.mjs`

Comparar screenshots novos com `.smoke-out-baseline-dark/` (do Task 0). Garantir:
- Layout idêntico (só cores mudaram)
- Sem texto invisível
- Sem partículas sumindo
- Cards visíveis
- Disqus em light

- [ ] **Step 2: WCAG contrast checks**

Pra cada par foreground/background crítico, calcular contraste:
- `text-foreground` sobre `bg-background`: deve passar AA (4.5:1)
- `text-muted-foreground` sobre `bg-background`: deve passar AA (4.5:1)
- `text-neon` sobre `bg-background`: deve passar AA-large (3:1)
- `text-foreground` sobre `bg-card`: AA

Usar ferramenta tipo https://webaim.org/resources/contrastchecker/ ou plugin de browser. Documentar resultados.

Se algum par falhar, ajustar HSL na spec/index.css e re-rodar smoke.

- [ ] **Step 3: Browser compat**

Testar manualmente em Chrome + Firefox (mínimo) — focar em backdrop-blur dos cards (Firefox às vezes renderiza diferente).

- [ ] **Step 4: Mobile responsive**

Smoke num viewport 375×667 (iPhone SE) — adicionar variant ao script.

- [ ] **Step 5: Disqus + chat + modals manuais**

Owner abre um post, abre o chat widget, abre um project modal. Confirma que tudo funciona e tá legível.

- [ ] **Step 6: Commit final + push branch**

```bash
git add docs/superpowers/notes/
git commit -m "docs(light-theme): WCAG audit + browser/mobile validation notes"
git push -u origin feat/light-theme
```

---

## Task 12: PR + merge

- [ ] **Step 1: Abrir PR**

```bash
gh pr create --title "feat: light theme redesign" --body "..."
```

Body do PR linka pra spec, plan, e WCAG audit doc.

- [ ] **Step 2: Verificar deploy preview do Netlify**

Mesmo padrão de validação visual + funcional.

- [ ] **Step 3: Owner aprova → merge**

Squash merge pra manter histórico limpo.

- [ ] **Step 4: Atualizar memória**

Salvar memória "Light theme SHIPPED em prod" com commit hash + lista do que mudou.

---

## Rollback plan

Se light theme não convencer depois de deploy em prod:

1. **Reverter o squash commit**: `git revert <merge-sha>` na main, push.
2. **Ou re-checkout do dark theme via tag**: criar tag `pre-light-theme` em main antes do merge.

Não há feature flag — substituição completa.

---

## Estimativa de tempo

- Task 0 (setup): 15 min
- Tasks 1-2 (tokens): 30 min
- Task 3 (canvas): 20 min
- Tasks 4-8 (componentes home): 1.5 h
- Task 9 (blog): 45 min
- Task 10 (Disqus): 15-45 min (depende se a integração coopera)
- Task 11 (verificação): 30 min
- Task 12 (PR): 15 min

**Total estimado: 4-5 horas de trabalho focado** + tempo de validação visual do owner.
