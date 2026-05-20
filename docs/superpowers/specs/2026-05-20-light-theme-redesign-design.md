# Light Theme Redesign — Spec

**Data:** 2026-05-20 (sessão pausada por créditos)
**Origem:** owner pediu inversão completa do tema (dark → light) depois da feature #6 cena 3D contextual. Cards "pretos" precisam virar translúcidos mais leves. Como mudança afeta tudo, optou-se por planejar agora e executar na próxima sessão.

## Objetivo

Migrar TODO o site (homepage + blog + componentes globais) do tema dark atual (`#0a0a0f`) pra um tema light (off-white). Sem manter toggle entre temas — é substituição completa.

## Decisões propostas (owner verifica antes de iniciar execução)

### 1. Paleta exata

Sigma proposto (verificar se OK ou ajustar antes de começar):

```css
/* index.css :root */
--background:        0 0% 98%;        /* near-white, #fafafa */
--foreground:        240 10% 12%;      /* near-black */
--card:              0 0% 100%;        /* pure white pra cards */
--card-foreground:   240 10% 12%;
--popover:           0 0% 100%;
--popover-foreground:240 10% 12%;
--primary:           150 90% 30%;      /* darker green pra contraste — era 150 100% 50% (#00ff87) */
--primary-foreground:0 0% 98%;
--secondary:         220 80% 45%;      /* electric blue ajustado */
--secondary-foreground:0 0% 98%;
--muted:             240 4% 92%;       /* light gray bg */
--muted-foreground:  240 4% 42%;       /* gray text legível */
--accent:            150 90% 38%;
--accent-foreground: 0 0% 98%;
--border:            240 4% 85%;
--input:             240 4% 90%;
--ring:              150 90% 30%;
--destructive:       0 84% 50%;
--destructive-foreground:0 0% 98%;
```

E os custom utility colors no tailwind.config.ts:

```ts
neon:     "hsl(150 90% 30%)",   /* era #00ff87 */
electric: "hsl(220 80% 45%)",   /* era #4d8cff */
dim:      "hsl(240 4% 75%)",
```

### 2. Estratégia de accent (verde neon)

`#00ff87` (verde neon brilhante) tem **contraste péssimo** com branco (1.4:1, falha WCAG). Proposta: usar verde escuro/floresta `hsl(150 90% 30%)` ≈ `#0b9858` (contraste 4.7:1 com branco, passa AA pra texto normal). Mantém o nome semântico "neon" no código mas visualmente é emerald/forest green.

**Risco:** perde-se a vibe "cyberpunk/neon" do site original. Owner verificar se essa identidade visual era importante. Alternativas se for: usar accent só pra hover/active states + manter contraste via dark text.

### 3. Estilo dos cards translúcidos

Owner falou "transparência mais leve". 2 direções possíveis:

- **Card opaco branco com sombra:** `bg-white border-gray-200 shadow-sm` — clean, sem partículas mostrando através
- **Card translúcido com blur:** `bg-white/85 backdrop-blur-md border-gray-200/60` — partículas do canvas filtram através, mantém a vibe "tem algo atrás"

Recomendo **translúcido com blur** pra preservar a feature da cena 3D contextual (#6). Owner verificar.

### 4. Canvas 3D (partículas)

Cores atuais das partículas: `#00ff87`, `#4d8cff`, `#666680` (todas escuras-meio sobre fundo escuro). No light theme essas mesmas cores ficam **invisíveis** (verde claro/azul claro sobre branco).

Proposta:
- `neon` partículas: `#0b9858` (verde escuro saturado)
- `electric` partículas: `#2b5fb8` (azul escuro saturado)
- `muted` partículas: `#9999a8` (gray médio)
- Linhas: usar `electric` em opacidade 0.15
- Opacidade geral das partículas pode subir de 0.9 → 0.95

### 5. Disqus theme

Atualmente carrega Disqus em theme dark (parâmetro `disqus_config`). Trocar pra light. Verificar se a integração já suporta — em `DisqusEmbed.tsx`.

## Componentes afetados (lista exaustiva)

### Globais
1. `src/index.css` — todas variáveis HSL
2. `tailwind.config.ts` — custom colors (neon, electric, dim, etc.)
3. `src/main.tsx` — checar se há classe `dark` em html/body que precise sumir

### Homepage
4. `src/components/Navbar.tsx` — bg quando scrolled, links, mobile menu
5. `src/components/Hero.tsx` — text-outline, botões neon, marquee, stats
6. `src/components/HeroScene3D.tsx` — cores das partículas + linhas + ScanPlanes
7. `src/components/About.tsx` — cards de áreas
8. `src/components/Experience.tsx` — timeline cards, bullet points
9. `src/components/Projects.tsx` — project cards + ProjectModal
10. `src/components/Education.tsx` — timeline cards
11. `src/components/Skills.tsx` — skill chips/bars
12. `src/components/Contact.tsx` — form se houver, social links
13. `src/components/Footer.tsx` — bg, links
14. `src/components/SectionHeader.tsx` — text-outline classe
15. `src/components/ScrollProgress.tsx` — barra de progresso (cor)
16. `src/components/Reveal.tsx` — só se tiver cor hardcoded
17. `src/components/TransitionLink.tsx` — só se tiver cor hardcoded
18. `src/components/ChatWidget.tsx` — bubble, mensagens, input

### Blog
19. `src/pages/Blog.tsx`
20. `src/pages/BlogPost.tsx`
21. `src/pages/BlogTag.tsx`
22. `src/components/blog/BlogLayout.tsx`
23. `src/components/blog/MarkdownRenderer.tsx` — prose styles, code blocks (rehype-highlight)
24. `src/components/blog/PostCard.tsx`
25. `src/components/blog/PostTOC.tsx`
26. `src/components/blog/ShareButtons.tsx`
27. `src/components/blog/TranslateBanner.tsx`
28. `src/components/blog/DisqusEmbed.tsx` — switch theme dark→light

### Assets / CSS externos
29. Logo SVG (se tiver cores hardcoded) — `public/`
30. OG image (se for regerada) — só pra blog
31. Favicon (se for adaptado) — opcional

## Critérios de sucesso

- [ ] Site inteiro com fundo branco uniforme (todas seções)
- [ ] Texto principal (foreground) com contraste ≥ 4.5:1 (WCAG AA)
- [ ] Accents (neon/electric) com contraste ≥ 3:1 contra background
- [ ] Cards visíveis com borda ou shadow (não somem no fundo)
- [ ] Canvas 3D ainda lê (partículas visíveis em todas seções)
- [ ] Hover states funcionam (não somem)
- [ ] Disqus em light theme
- [ ] Sem regressão funcional (chat, blog navigation, modals abrem)
- [ ] Smoke Playwright captura todas seções; comparar com baseline dark

## Fora do escopo

- Theme toggle (light/dark switcher) — owner pediu substituição completa
- Redesign de layout/typography — só inversão de cores
- Branding/logo redesign
- Imagens/screenshots dentro de blog posts (não afetadas pelo CSS)
- Compatibilidade com prefers-color-scheme do sistema (se quiser depois, é follow-up)

## Riscos

1. **Acabar com a identidade visual** — neon green é a personalidade do site. Verde-escuro pode parecer "corporativo". **Mitigação:** owner verifica decisão #2 antes de começar; pode pedir variação.
2. **Disqus theming** — se não suportar troca via JS, embed pode quebrar visualmente. **Mitigação:** testar primeiro, fallback é remover Disqus temporariamente.
3. **rehype-highlight code blocks** — usa CSS de highlight.js (dark theme). Vai precisar trocar pra theme light (github-light, atom-one-light, etc.). **Mitigação:** verificar qual tema atual + escolher light analógue.
4. **Hardcoded colors** — alguns componentes podem ter cores tipo `#00ff87` direto no JSX/CSS. **Mitigação:** grep amplo no Task 0 do plan pra mapear todos.
5. **Backwards-compat dos posts publicados no blog** — se algum post tem CSS inline com cores dark, vai ficar feio. **Mitigação:** revisão visual posts existentes após migração.
