# Wow Quick Wins (#1 + #2 + #3) — Design Spec

**Date:** 2026-05-19
**Status:** Draft — pending user review
**Author:** Claude + Guilherme
**Related:** `docs/superpowers/specs/2026-05-16-portfolio-roadmap-design.md` (parent roadmap, items 1–3)

## Goal

Adicionar três efeitos visuais de "wow factor" no portfolio sem regredir performance nem a11y:

1. **Magnetic cursor** — cursor customizado que é atraído por CTAs principais, com rastro de partículas neon.
2. **Scroll hue shift** — cor das partículas do `HeroScene3D` gira pelo círculo cromático conforme o scroll.
3. **View Transitions API** — crossfade nativo entre rotas (`/` ↔ `/blog` ↔ `/blog/:slug` ↔ `/blog/tag/:tag` ↔ `/404`).

Entregues juntos em uma única branch / PR / Deploy Preview.

## Non-Goals

- Não vamos adicionar libs novas (motion/gsap/etc.). Tudo com APIs do browser + canvas 2D + Three.js já presente.
- Não vamos tocar nos ScanPlanes do `HeroScene3D` nesta versão (mantém atuais — neon central + electric nas pontas — pra contraste). Pode entrar em iteração futura.
- Não vamos animar transição entre seções da home (apenas entre rotas reais do react-router).
- Não vamos cobrir efeitos visuais com testes de integração (canvas/WebGL/View Transitions). Validação visual fica no Deploy Preview. Helpers puros têm unit tests.
- Não vamos adicionar fallback animado pra Firefox/Safari (View Transitions API ainda incompleta lá). Degrada pra navigation sem crossfade — mesmo comportamento de hoje.

## Background

Brainstorm pausou em 2026-05-19 (4 perguntas respondidas, Seção 1/5 aprovada) e retomou na mesma data. Decisões settled:

| # | Pergunta | Escolha |
|---|---|---|
| Q1 | Cursor magnético | **B** — círculo outline + dot interno + rastro de ~8 partículas, magnético moderado (raio 80px), canvas 2D fixed full-screen |
| Q2 | Scroll hue shift | **A** — tint via `material.color.setHSL()` em `useFrame`; `(0.4 + p) % 1`; ~20 linhas |
| Q3 | View Transitions | **A** — só em rotas reais; crossfade 250ms via `document.startViewTransition`; degrada em FF/Safari; estabilizar `BlogPost.tsx` (flash branco hoje) |
| Q4 | Estratégia de entrega | **A** — 1 branch única `feat/wow-quick-wins-1-2-3` + 1 PR + Deploy Preview + smokes + squash-merge |

## Architecture Overview

Três features independentes, sem dependência de runtime entre elas. Compartilham apenas um módulo de detecção de preferência do usuário.

```
src/lib/motion/
  ├─ useMotionEnabled.ts       (novo)  — false se reduced-motion OU pointer:coarse
  ├─ usePrefersReducedMotion.ts (novo) — movido de HeroScene3D.tsx
  ├─ viewTransition.ts         (novo)  — navigateWithTransition(navigate, to)
  └─ hue.ts                    (novo)  — hueFromProgress(p)

src/components/
  ├─ MagneticCursor.tsx        (novo)  — monta uma vez em App.tsx
  └─ TransitionLink.tsx        (novo)  — wrapper de <Link> do react-router

Modificados:
  ├─ App.tsx                            — monta <MagneticCursor />
  ├─ HeroScene3D.tsx                    — scroll listener + useFrame com setHSL; reexport de usePrefersReducedMotion
  ├─ BlogPost.tsx                       — fix do flash branco (não setar post=null); se houver Links pra outros slugs, substituir por <TransitionLink>
  ├─ Navbar.tsx, PostCard.tsx, BlogTag.tsx — <Link> → <TransitionLink> em pontos auditados
  └─ src/index.css                      — regras ::view-transition-*
```

**Boundary contract — `useMotionEnabled`:**
- Retorna `false` se `prefers-reduced-motion: reduce` OU `pointer: coarse` (matchMedia).
- Reage a mudanças de media query em runtime.
- Itens #1 e #2 consultam este hook.
- Item #3 consulta apenas `prefers-reduced-motion` (touch OK pra crossfade nativo) — check inline em `navigateWithTransition`.

## Feature 1 — Magnetic Cursor

**Componente:** `src/components/MagneticCursor.tsx`
**Monta em:** `App.tsx` (uma vez, topo da árvore).

**Stack:**
- `<canvas>` `position: fixed`, full-screen, `pointer-events: none`, z-index acima do app.
- RAF loop ativa apenas quando `useMotionEnabled() === true`. Quando muda pra false, cancela RAF e limpa canvas.

**Visual:**
- Círculo outline neon `#00ff87`, raio 12px, stroke 1.5px.
- Dot interno sólido neon, raio 2px.
- Rastro: últimas 8 posições do cursor (após magnetism aplicado). Para cada `i` em 0..7:
  - `opacity = (1 - i/8) * 0.6`
  - `raio = 12 - i`
- `globalCompositeOperation = 'lighter'` para soma aditiva (efeito glow).

**Magnetic targets:**
- Selector central: `'a[href], button, [role="button"], [data-magnetic]'`.
- Filtro opt-out: elementos com `data-magnetic="off"`.
- Aplicar `data-magnetic="off"` em: language dropdown items, hamburger button, links dentro do mobile menu overlay.

**Lógica magnetism:**
- A cada frame:
  1. Pega rect de todos os targets visíveis.
  2. Calcula centro de cada rect.
  3. Acha o mais próximo do mouse real dentro de raio 80px.
  4. Se houver: cursor renderizado lerpa de sua posição atual pra `lerp(currentPos, target.center, 0.18)`.
  5. Se não: cursor lerpa pra mouse real (`lerp(currentPos, mouse, 0.4)` — suavização base).

**Helpers puros (exportados pra teste):**
- `findClosestTarget(rects: DOMRect[], mouse: Point, radius: number): { rect: DOMRect, distance: number } | null`
- `lerp(a: number, b: number, t: number): number`
- `decayedTrail(positions: Point[], count: number): Array<{ x: number, y: number, opacity: number, radius: number }>`

**Lifecycle:**
- `useEffect` no mount: cria canvas, adiciona listeners (`mousemove`, `resize`), inicia RAF se `motionEnabled`.
- Cleanup: cancela RAF, remove listeners, remove canvas.
- Se `motionEnabled` muda em runtime, RAF inicia/para; canvas permanece montado mas limpo.

**Testing:**
- 1 suite vitest sobre os 3 helpers puros.
- Sem teste de canvas (validação visual via Deploy Preview).

## Feature 2 — Scroll Hue Shift

**Local:** dentro do `PointCloud` em `HeroScene3D.tsx`.

**Source do progresso:**
- `progress = clamp01(scrollY / (documentElement.scrollHeight - innerHeight))`
- Listener `scroll` passive em `window`, atualiza um `useRef` (não state — evita re-render).
- Listener removido no cleanup.

**Aplicação no Three.js:**
- `useFrame` dentro de `PointCloud`:
  - Se `useMotionEnabled() === false`: skipa (não chama `setHSL`).
  - Senão: `pointsMaterial.color.setHSL(hueFromProgress(progressRef.current), 0.85, 0.55)`.
- Mesmo tint aplicado em `lineBasicMaterial.color` das LineSegments existentes.
- ScanPlanes: não tocar (decisão de Seção 5 do brainstorm).

**Helper puro:**
- `hueFromProgress(p: number): number` em `src/lib/motion/hue.ts`.
- Implementação: `((0.4 + clamp01(p)) % 1)`. Hue inicial 0.4 ≈ verde-cyan `#00ff87`.
- Unit test trivial (entradas 0, 0.3, 0.6, 1.0, valores fora de [0,1] clampados).

**Gotcha conhecido — `vertexColors: true`:**

`PointsMaterial` está configurado com `vertexColors: true` (cores per-vertex no buffer). Setar `material.color` resulta em multiplicação contra a cor do vértice. Esperado: tint funciona corretamente, multiplicando cada cor original pelo hue atual.

**Gate de implementação:** consultar Context7 (three.js docs sobre `PointsMaterial` + `vertexColors` + `material.color` multiplicação) ANTES de escrever a primeira linha do `setHSL`. Confirmar comportamento.

Plano B (se houver gotcha): desabilitar `vertexColors` durante o hue shift (mas perde variação per-vertex — não ideal). Plano C: migrar pra `ShaderMaterial` com uniform `uTint` (mais código, mas controle total). Decidir durante implementação se necessário.

**A11y / mobile:**
- `useMotionEnabled() === false` → skipa `setHSL`. `material.color` permanece no default (branco), `vertexColors:true` mantém aparência original do buffer.

**Performance:**
- 1 `setHSL` por frame em material existente.
- 1 scroll listener passive.
- Sem alocação por frame (reusa `material.color`).
- Negligível.

## Feature 3 — View Transitions

**Wrapper:** `src/lib/motion/viewTransition.ts`

```ts
import type { NavigateFunction } from 'react-router-dom'

export function navigateWithTransition(navigate: NavigateFunction, to: string) {
  const supported = 'startViewTransition' in document
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (supported && !reduced) {
    ;(document as Document & {
      startViewTransition: (cb: () => void) => void
    }).startViewTransition(() => navigate(to))
  } else {
    navigate(to)
  }
}
```

**Componente consumidor:** `src/components/TransitionLink.tsx`

Wrapper de `<Link>` que faz `e.preventDefault()` e chama `navigateWithTransition`. API idêntica ao `<Link>` original — substituição 1:1 nos pontos auditados.

**Pontos de substituição (grep-auditável):**
- `Navbar.tsx` — link `/blog`, links de seções da home, hamburger menu links.
- `PostCard.tsx` — link pro post.
- `BlogTag.tsx` — links pra outros posts da tag.
- `BlogPost.tsx` — se houver links pra outros slugs (auditável; hoje provavelmente não há "related posts").

Manter `<Link>` cru em:
- Hash anchors da home (`#contact`, `#projects` — não dispara navigation).
- Links externos.
- Voltar do 404.

**CSS:** `src/index.css`

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 250ms;
  animation-timing-function: ease-out;
}
```

Default do browser já é crossfade — é o desejado.

**BlogPost flash fix (pré-requisito):**

Hoje `BlogPost.tsx` faz `setPost(null)` no `useEffect` quando o slug muda → entra no branch `if (!post) return <Loading />` → flash branco antes do body novo chegar. Isso quebra qualquer crossfade visualmente.

**Estratégia (do mais simples pro mais robusto):**

- **Opção A (preferida):** Não setar `null` no slug change. Manter `post` antigo no state; adicionar flag `loading`. Renderizar post antigo com `opacity: 0.4` enquanto `loading === true`. Crossfade do View Transition cobre a transição de conteúdo.
- **Opção B (fallback se A fica feia):** `React.useTransition` em volta do fetch — defer o update até o data chegar.

Começar pela A, escalar pra B se necessário durante implementação.

**Degradação:**
- Firefox/Safari sem `startViewTransition`: cai no `navigate(to)` direto. Mesmo comportamento de hoje.
- prefers-reduced-motion: idem.

**Testing:**
- Unit test de `navigateWithTransition` (vitest + jsdom; mock de `document.startViewTransition` e `matchMedia`). Verifica que chama com/sem transition conforme suporte e preferência.

**Risco:**
- Flash fix mexe em código existente sensível (carregamento de `.md` e Google Doc, scroll-to-top, etc.). Mitigação: ler arquivo inteiro antes de mexer; smoke manual no Deploy Preview navegando `/blog/teste-de-audio`.

## Cross-Cutting

### A11y — prefers-reduced-motion

Todas as 3 features respeitam `prefers-reduced-motion: reduce`:
- #1 e #2 via `useMotionEnabled`.
- #3 via check inline em `navigateWithTransition`.

Item #1 tem critério adicional de `pointer: coarse` (sem cursor pra ser magnético em touch).

### Mobile (`pointer: coarse`)

- #1: desabilitado.
- #2: ativo. Gate de Lighthouse mobile no Deploy Preview.
- #3: ativo. View Transitions funciona em mobile sem ajuste.

### Testing

3 suites vitest:
- `src/lib/motion/__tests__/cursor-helpers.test.ts` — `findClosestTarget`, `lerp`, `decayedTrail`.
- `src/lib/motion/__tests__/hue.test.ts` — `hueFromProgress`.
- `src/lib/motion/__tests__/viewTransition.test.ts` — `navigateWithTransition` (com mocks).

Sem teste de integração visual.

### Gates de PR

- `tsc --noEmit` verde.
- `eslint` verde.
- `vitest run` verde.
- `npm run build` verde.
- Lighthouse perf + a11y ≥ 95 no Deploy Preview (mobile + desktop).
- Bundle delta documentado no PR (esperado <5KB gzip).

### Smokes pós-Deploy Preview

Programáticos (Claude roda):
1. `GET /` → 200, contém marca do site no HTML.
2. `GET /blog` → 200, lista de posts presente.
3. `GET /blog/teste-de-audio` → 200, body do post presente.
4. `npx lighthouse <preview-url> --only-categories=performance,accessibility --form-factor=mobile` → ambos ≥95.
5. Bundle delta: comparar `dist/assets/*.js` antes/depois.

Visuais (owner verifica no Deploy Preview):
- Cursor magnético atrai pra link da navbar.
- Hue rotaciona ao scrollar a home.
- Crossfade visível em `/` → `/blog` → `/blog/teste-de-audio`.

### Estratégia de entrega

- Branch única: `feat/wow-quick-wins-1-2-3`.
- Commits incrementais por feature + 1 commit final de cross-cutting (a11y wiring, CSS de view transitions, gates).
- 1 PR no GitHub, Deploy Preview automático.
- Smokes programáticos + visuais.
- Squash-merge em `main`.

## Risks Summary

| Risco | Mitigação |
|---|---|
| `material.color` com `vertexColors:true` ter comportamento inesperado | Consultar Context7 (three.js docs) antes de implementar Feature #2 |
| `BlogPost` flash fix regredir fluxo de carregamento de posts (`.md` + Google Doc) | Ler arquivo inteiro antes de mexer; smoke manual no Deploy Preview com `teste-de-audio` |
| Cursor magnético atrapalhar UX em desktop com mouse lento | Magnetic strength moderado (lerp 0.18, raio 80px) — valores fixos do design. Ajustes só após feedback do owner no Deploy Preview, se houver |
| Bundle delta exceder 5KB | Sem libs novas no design; se exceder, revisar implementação |
| Lighthouse perf cair abaixo de 95 | Item #2 tem 1 setHSL/frame (negligível); item #1 ativa só quando motionEnabled; item #3 é nativo browser |

## Open Questions

Nenhuma. Todas as decisões settled no brainstorming (ver tabela em Background).
