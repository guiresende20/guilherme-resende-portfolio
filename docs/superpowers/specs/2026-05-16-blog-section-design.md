# Blog Section — Drive-Backed with AI On-Demand Translation

**Data:** 2026-05-16
**Branch alvo:** `main` (via branch de feature dedicada)
**Autor:** Guilherme Resende (via brainstorming colaborativo)

## Objetivo

Adicionar uma seção `/blog` ao portfólio que permita publicar posts
**sem precisar fazer deploy** — escrita acontece no Google Drive em
arquivos `.md`, o site puxa em runtime via Netlify Function.

Tradução para inglês e espanhol é oferecida **on-demand** pelo agente
Gemini que já existe, com cache permanente da primeira tradução pra
nunca pagar Gemini duas vezes pelo mesmo par `(post, idioma)`.

## Motivação

- Postar texto não deve gastar minutos de build do Netlify nem misturar
  histórico de código com histórico de conteúdo.
- Escrita em qualquer dispositivo (Drive funciona em web/desktop/mobile).
- Mantém a tese "portfólio como produto de IA": tradução AI aplicada,
  agente conhece os posts, recomenda leituras.

## Restrições

- Stack existente: React 18 + Vite + TypeScript + Tailwind + Netlify
  Functions + Gemini API. Sem migração.
- Free tier de Netlify e Gemini continua como teto.
- Não pode regredir: Lighthouse ≥ 95, i18n PT/EN/ES, a11y.
- Bundle delta documentado no PR.

## Arquitetura

### Fluxo de dados

```
Você (qualquer dispositivo)
      │ edita .md
      ▼
┌─────────────────────────┐
│ Google Drive pasta blog/│  Service Account, scope drive.readonly
└─────────────────────────┘
      │ Drive API (server-side, env var)
      ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│ Netlify Function        │ ←→ │ Netlify Blobs (cache)   │
│  blog-list              │    │  posts/list/{lang}      │
│  blog-post              │    │  posts/{slug}           │
│  blog-translate         │    │  posts/{slug}/          │
│  blog-image             │    │    translation/{lang}   │
│  blog-revalidate        │    │  posts/images/{file}    │
└─────────────────────────┘    └─────────────────────────┘
      │ JSON (markdown + meta) ou binário (imagem)
      ▼
┌─────────────────────────┐
│ Site React              │  prose customizada,
│  /blog (lista)          │  TranslateBanner, Disqus
│  /blog/:slug (post)     │
│  /blog/tag/:tag         │
└─────────────────────────┘
```

### Ciclo de vida de um post

1. Você escreve/edita `.md` no Drive (qualquer dispositivo).
2. Salva — arquivo está pronto no Drive imediatamente.
3. Próximo visitante após cache expirar (10 min) dispara
   `blog-list` ou `blog-post`, que busca via Drive API e atualiza o
   cache no Netlify Blobs.
4. Pra publicar instantaneamente sem esperar TTL: chamar
   `POST /api/blog/revalidate?slug=xxx` com token secreto (atalho do
   celular, bookmarklet, ou app simples).

## Componentes

### Frontend (`src/`)

| Arquivo | Responsabilidade |
|---|---|
| `pages/Blog.tsx` | Rota `/blog`. Grid 3 colunas desktop / 1 mobile (mesmo padrão de `Projects.tsx`). Featured no topo, restante por data desc. Filtro por tag (chips). |
| `pages/BlogPost.tsx` | Rota `/blog/:slug`. Renderiza post, mostra `TranslateBanner` se idioma do usuário ≠ lang do post, Disqus no fim (lazy), share buttons. |
| `pages/BlogTag.tsx` | Rota `/blog/tag/:tagname`. Reutiliza listagem filtrada. |
| `components/blog/PostCard.tsx` | Cover, título, data, tags, excerpt, reading time. |
| `components/blog/MarkdownRenderer.tsx` | `react-markdown` + `remark-gfm` + `rehype-shiki` (syntax highlight com tema VS Code dark). Classe `prose` customizada. Reescreve paths de imagem pra `/api/blog/image/...`. |
| `components/blog/TranslateBanner.tsx` | Banner com call-to-action "Traduzir para {lang}". Dispara `/api/blog/translate`. Streama resposta caractere a caractere (igual chat hoje). Disclaimer "Tradução por IA · ver original em PT" depois de renderizar. |
| `components/blog/DisqusEmbed.tsx` | Lazy-load via `IntersectionObserver` — só carrega o script quando o usuário rola até a área de comentários. Tema dark custom. |
| `components/blog/ShareButtons.tsx` | LinkedIn, X, copiar link. |
| `lib/blog-cache.ts` | Cache local (localStorage) de traduções nessa sessão pra não pedir de novo. |
| `lib/reading-time.ts` | Palavras ÷ 200, retorna `"3 min de leitura"`. |

### Backend (`netlify/functions/`)

| Função | Endpoint | Responsabilidade |
|---|---|---|
| `blog-list.ts` | `GET /api/blog/list?lang=pt` | Lista metadata dos posts visíveis (filtra `draft: true` e pasta `_drafts/`). Cache 10 min. |
| `blog-post.ts` | `GET /api/blog/post/:slug` | Markdown + metadata de 1 post. Cache 10 min. |
| `blog-translate.ts` | `POST /api/blog/translate` body `{slug, lang}` | Camadas 1+2+3 de proteção. Cache permanente em `posts/{slug}/translation/{lang}`. Streaming response. |
| `blog-image.ts` | `GET /api/blog/image/:filename` | Serve imagem do Drive via Netlify Image CDN (otimização automática). Cache 1h em Blobs + `Cache-Control: max-age=31536000, immutable` no header. |
| `blog-revalidate.ts` | `POST /api/blog/revalidate?slug=xxx` | Limpa cache de 1 post. Requer header `X-Revalidate-Token` com secret. |
| `blog-rss.ts` | `GET /api/blog/rss` | Atom feed dos posts publicados. |
| `_lib/drive.ts` | (interno) | Wrapper isolado da Drive API. Auth via Service Account JSON em env var. |
| `_lib/blog-cache.ts` | (interno) | Wrapper do Netlify Blobs com TTL configurável. |

### Reuso de código existente

- `_lib/ratelimit.ts` — limita `/api/blog/translate` a 10 req/IP/hora.
- `_lib/security.ts` — headers padrão de segurança.
- `lib/i18n.ts` — detecção do idioma do usuário, decide se mostra
  `TranslateBanner`.
- `lib/system-prompt.ts` — recebe lista de posts (título + slug +
  excerpt) pra o agente recomendar leituras na conversa.
- Logger / CSP em `netlify.toml` — adicionar `connect-src` pra
  `googleapis.com` se necessário; verificar no momento da implementação.

### Navegação

- Item "Blog" novo na `Navbar.tsx`, entre "Projetos" e "Formação".
- Link rápido no `Footer.tsx`.
- `<link rel="alternate" type="application/atom+xml" href="/api/blog/rss">`
  no `index.html`.

## Modelo de dados

### Estrutura no Drive

```
blog/                       ← pasta compartilhada com Service Account
├── hero-3d.md
├── gesture-keys-patent.md
├── images/
│   ├── hero-3d-cover.webp
│   ├── hero-3d-diagram.png
│   └── gesture-keys-cover.webp
└── _drafts/                ← ignorada por blog-list
    └── proximo-post.md
```

### Frontmatter

```markdown
---
title: "Como construí o hero 3D em Three.js"
slug: hero-3d               # opcional, default = nome do arquivo sem .md
date: 2026-05-16            # ISO, ordenação
lang: pt                    # pt | en | es
tags: [three.js, webgl, performance]
cover: hero-3d-cover.webp   # path relativo a images/
excerpt: "Da nuvem de partículas neon ao fallback pra prefers-reduced-motion."
draft: false                # se true, oculto da listagem
featured: false             # se true, pinned no topo da lista
---

# Conteúdo do post em Markdown padrão
```

### Resolução de paths de imagem

Markdown:
```markdown
![Diagrama do shader](hero-3d-diagram.png)
```

Renderizado:
```html
<img src="/api/blog/image/hero-3d-diagram.png" alt="Diagrama do shader" />
```

Que internamente passa pelo Netlify Image CDN com transformações
(`?w=1200&fm=webp`), otimizando por viewport e formato suportado.

### Cache no Netlify Blobs

| Key | TTL | Conteúdo |
|---|---|---|
| `posts/list/{lang}` | 10 min | Array de metadata visíveis nesse idioma |
| `posts/{slug}` | 10 min | Markdown + metadata de 1 post |
| `posts/{slug}/translation/{lang}` | sem TTL — invalidação manual | Markdown traduzido por Gemini |
| `posts/images/{filename}` | 1 hora | Binário (servido com `Cache-Control` longo no edge) |

### Whitelist de idiomas traduzíveis

```ts
const ALLOWED_TRANSLATION_LANGS = ['en', 'es']; // PT é o idioma fonte
```

Qualquer outro valor → `400 Bad Request` sem chamar Gemini.

**Direção da tradução no MVP:** sempre `pt → en` ou `pt → es`. Posts
escritos diretamente em EN ou ES (frontmatter `lang: en`) são suportados
e aparecem normalmente na listagem, mas o `TranslateBanner` só dispara
quando o post original é PT. Reverter (`en → pt`) fica fora do MVP.

## Modelo de segurança

### Autenticação ao Drive

- **Service Account** criado em projeto Google Cloud dedicado.
- Scope: `https://www.googleapis.com/auth/drive.readonly`.
- Pasta `blog/` compartilhada com email do Service Account, modo "Leitor".
- Chave JSON do Service Account em env var Netlify
  `GOOGLE_DRIVE_SA_JSON` (mesmo padrão da `GEMINI_API_KEY`).

### Blast radius se a chave vazar

- Atacante consegue ler **só** a pasta `blog/`. Posts são públicos
  mesmo. Sem acesso a nada mais do Drive pessoal.
- Mitigação: rotação da chave (regenerar no Google Cloud, atualizar
  env var, antiga é revogada).

### Proteção do endpoint `/api/blog/translate`

Camadas que evitam abuso (script malicioso esgotando quota Gemini):

1. **Endpoint não aceita texto livre.** Apenas `{slug, lang}` com `slug`
   validado contra a lista de posts existentes. Slug inexistente → 404.
2. **Cache permanente** em `posts/{slug}/translation/{lang}`.
   Combinações possíveis = `N posts × 2 idiomas`. Cada combinação chama
   Gemini exatamente uma vez na vida.
3. **Rate-limit** via `_lib/ratelimit.ts`: 10 traduções por IP a cada
   hora.
4. **Whitelist de lang** (`['en', 'es']`) impede driblar cache com
   variantes (`en-US`, `en-GB`, etc.).

Custo máximo plausível mesmo sob ataque dedicado: `~50 posts × 2
idiomas × $0.001` ≈ `$0.10` em toda a vida do blog. E mesmo isso fica
em $0 pelo free tier do Gemini Flash.

### Proteção do endpoint `/api/blog/revalidate`

- Requer header `X-Revalidate-Token` que bate com env var
  `BLOG_REVALIDATE_TOKEN`.
- Sem o token → 401.
- Sem efeitos colaterais além de limpar cache (idempotente).

## UX dos posts

### Layout da listagem `/blog`

- Grid de cards (3 col desktop, 2 tablet, 1 mobile), mesma estética
  de `Projects.tsx`.
- Posts com `featured: true` no topo, depois ordenado por `date` desc.
- Filtro por tag no header (chips clicáveis, exclusivos).
- **Sem busca textual no MVP.**
- **Sem paginação até 15 posts.** A partir do 16º, botão "Load more"
  carrega +15.
- Card mostra: cover, título, data formatada, reading time, 3 tags,
  excerpt (2 linhas com truncate).

### Layout do post `/blog/:slug`

- Header: título grande (Clash Display), meta-linha com data +
  reading time + tags + idioma do post.
- Se `lang do post ≠ lang do usuário`: `TranslateBanner` logo abaixo
  do header.
- Corpo: `prose` customizada herdando design tokens do site.
- Final: `ShareButtons` + bloco "Sobre o autor" pequeno + Disqus
  (lazy-load).
- Sidebar (desktop only): TOC sticky gerado dos `<h2>` automaticamente.

### Comentários

- Disqus embed com tema escuro custom matching paleta neon/electric.
- Conta Disqus do Guilherme (já existente).
- Lazy-load via `IntersectionObserver` pra não impactar Lighthouse.

### 404

- Página dedicada quando slug não existe.
- Sugere voltar pra `/blog` ou abrir o chatbot pra perguntar sobre o
  assunto.

## Mapeamento de classe `prose`

Plugin `@tailwindcss/typography` com customização que mapeia tokens
existentes do site:

| Elemento | Estilo |
|---|---|
| `h1` | Clash Display 48px, cor neon |
| `h2` | Clash Display 32px |
| `h3` | Clash Display 24px |
| `p` | Satoshi 16px, line-height 1.7 |
| `a` | underline neon no hover |
| `code` inline | JetBrains Mono, `bg-muted`, cor electric |
| `pre` block | JetBrains Mono, fundo escuro, syntax highlight via shiki tema "github-dark-dimmed" |
| `blockquote` | borda lateral neon, itálico Satoshi |
| `img` | `rounded-md`, otimizada pelo Netlify Image CDN |
| `hr` | linha neon fina |
| `ul/ol` | bullets/numbers cor electric |
| `table` | header `bg-muted`, bordas finas neon |

## SEO

- `sitemap.xml` passa a ser **dinâmico**: função
  `netlify/functions/sitemap.ts` que lê posts do Blob cache e injeta
  uma `<url>` por post. Build-time ficaria incoerente com o princípio
  "publicar sem deploy" do design.
- Cada post tem JSON-LD `BlogPosting` injetado no `<head>`.
- OG image: usa `cover` do frontmatter; fallback pro OG default do site.
- Combina com **item 16 do roadmap** (rotas estáticas por projeto +
  sitemap expandido) — blog posts entram no mesmo pipeline.

> Nota: tradução AI on-demand **não** indexa. Pra ranking em EN/ES
> seria preciso gerar URLs estáticas das traduções cacheadas
> (`/blog/en/hero-3d`). Fica fora do escopo deste MVP, pode virar
> item futuro.

## Critérios de qualidade

Antes do merge:

- Lighthouse ≥ 95 em todas categorias na rota `/blog` e em `/blog/:slug`.
- `prefers-reduced-motion` respeitado.
- Funciona em mobile.
- Bundle delta: novos pacotes (`react-markdown`, `remark-gfm`,
  `rehype-shiki`, `gray-matter`) devem ser lazy-loaded só na rota `/blog*`.
- Chave Service Account fora do Git.
- Endpoints novos respondem em <500ms quando cache hit.

## Defaults assumidos

1. **Layout `/blog`**: grid 3 col, igual `Projects.tsx`.
2. **Ordenação**: featured > date desc.
3. **Filtros**: tag chips, sem busca textual.
4. **Paginação**: sem paginação até 15 posts; "Load more" a partir do 16º.
5. **Página de tag**: rota dedicada reusando componente da lista.
6. **Reading time**: calculado, mostrado em card e header do post.
7. **Share buttons**: LinkedIn, X, copiar link.
8. **RSS**: Atom feed em `/api/blog/rss`.
9. **Agente Gemini conhece os posts**: lista vai pro system prompt.
10. **Blog no hero**: fora do MVP.
11. **Dark mode**: único modo (site é só dark).
12. **Disqus tema**: dark custom matching neon/electric.
13. **Rota base**: `/blog`.
14. **404 de post**: página dedicada sugerindo `/blog` ou chatbot.

## Out of scope (não fazer agora)

- URLs estáticas pra traduções AI (otimização SEO multilíngue).
- Busca textual em posts.
- Newsletter / form de inscrição por email.
- Likes / reactions além do Disqus.
- Editor in-browser ("admin").
- Posts protegidos por senha / paywall.
- Imagens em formatos exóticos (HEIC, AVIF input — só WebP/PNG/JPG).

## Variáveis de ambiente novas

| Nome | Onde | Pra quê |
|---|---|---|
| `GOOGLE_DRIVE_SA_JSON` | Netlify env | JSON inteiro do Service Account (multilinha) |
| `GOOGLE_DRIVE_BLOG_FOLDER_ID` | Netlify env | ID da pasta `blog/` no Drive |
| `BLOG_REVALIDATE_TOKEN` | Netlify env | Secret pro endpoint de cache bust |
| `DISQUS_SHORTNAME` | Netlify env (ou hardcoded) | Identificador da conta Disqus |

## Dependências novas (npm)

- `react-markdown` — renderização markdown
- `remark-gfm` — tabelas, task lists, autolinks
- `rehype-shiki` — syntax highlight em blocos de código
- `gray-matter` — parse de frontmatter YAML
- `googleapis` ou `@googleapis/drive` — Drive API (verificar bundle size; pode ser melhor implementar com `fetch` direto)
- `@netlify/blobs` — já vem com Netlify, importar

Todas as deps frontend lazy-loaded só nas rotas `/blog*` pra não pesar
o bundle do hero.

## Próximos passos

1. Spec aprovado pelo usuário.
2. Invocar skill `writing-plans` pra gerar plano de implementação
   detalhado por etapa (com TDD onde aplicável).
3. Implementar em branch dedicada
   (`feat/blog-section`), PR pra `main`.
