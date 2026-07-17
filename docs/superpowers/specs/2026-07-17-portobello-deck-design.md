# Deck de slides em `/portobello` — Design

**Data:** 2026-07-17
**Status:** aprovado pelo owner (abordagem A)

## Objetivo

Reaproveitar a lógica de exibição de slides do projeto `temp/caixa` (deck Aeroli.to ·
Territórios de Futuros, vanilla HTML/CSS/JS sem build step) dentro do portfólio,
esvaziada de todo conteúdo da Caixa, acessível em
`https://guiresende20.netlify.app/portobello`.

Escopo confirmado com o owner:

- **Entra:** exibição (capa, slides, navegação, índice, painel de sinais, export
  PDF/PPTX) + edição runtime de slides.
- **Sai:** login, votação ao vivo, lógica de visibilidade `@caixa`.
- Marca Aerolito permanece (logo, starfield, visual); o que se apaga é o conteúdo.
- `/portobello` não aparece na navegação do portfólio — URL direta compartilhada.

## Abordagem

**Cópia estática em `public/portobello/`.** O deck não tem build step; o Vite copia
`public/` → `dist/` como está, então ele roda intacto como sub-site, sem integração
com o React. Alternativas descartadas: portar para React (semanas de retrabalho sem
benefício) e site Netlify separado com proxy (segundo site/deploy/env pra gerenciar).

## Estrutura de arquivos

```
public/portobello/
  index.html          capa + container do deck (sem bloco de login)
  slides.json         manifesto vazio (1 slide intro placeholder)
  css/styles.css      design system Aerolito intacto
  js/deck.js          núcleo de exibição + edição (limpo, ver "Limpeza")
  js/starfield.js     atmosfera
  js/particles.js     partículas do índice
  js/lib/             print-doc.mjs + pptx-doc.mjs (export PDF/PPTX)
  js/vendor/          pptxgen.bundle.js + html-to-image.js
  assets/             favicon.png + logo-aero.png (só isso)
```

## Limpeza (o que sai do código copiado)

- **Login inteiro:** `login.js`, bloco `#login` do HTML, `assets/login/` (~13 MB de
  vídeos), função `auth.mjs`. O deck monta direto no load, sem esperar evento de login.
- **Votação inteira:** `vote.html`, `vote.js`, `constellation.js`, `vendor/qrcode.js`,
  funções `vote`/`tally`/`state`, e os trechos de `deck.js` que renderizam o slide de
  votação e chamam `/api/tally` e `/api/state` (incl. `PRESENTER_KEY_STORE`).
- **Lógica `@caixa`:** allowlist `clientVisible` (visão cliente vs. plena) removida do
  deck.js e dos handlers. Sobra só o conceito "oculto": editor vê slides ocultos,
  público não.
- **Conteúdo Caixa:** `slides.json` novo com `meta.deck = "portobello"`, título
  "Aeroli.to · Portobello" e um único slide intro placeholder. `ref
  caixa_plataforma.pdf`, `design.md` e `README.md` do deck original não são copiados.
- **Mantido:** wording "Território/Sinal" (metodologia Aerolito, não conteúdo Caixa),
  export PDF/PPTX, índice com reordenação drag-and-drop, deep-links por hash,
  atalhos de teclado, swipe mobile, fullscreen.

## Edição com chave de admin

O flag `fullAccess` do deck.js deixa de vir do login (`sessionStorage "deck-full"`) e
passa a vir de uma chave:

- Atalho `E` (ou `?edit=1` na URL) → `prompt()` pede a chave → guardada em
  `sessionStorage` → controles de edição aparecem (botão editar, adicionar slide,
  ocultar, backups).
- Todo POST de edição envia header `x-edit-key`. A função valida contra a env var
  **`PORTOBELLO_EDIT_KEY`** e responde **401** se ausente/inválida. Um 401 limpa a
  chave guardada e desativa o modo edição no cliente.
- Isso corrige a falha do deck original, onde `/api/content` aceitava POST sem
  nenhuma autenticação.
- Visitante sem chave: deck somente-leitura, slides ocultos invisíveis.
- Env var `PORTOBELLO_EDIT_KEY` cadastrada pelo owner no painel Netlify após o deploy
  (única pendência manual da entrega).

## Netlify Functions e Blobs

Duas funções novas em `netlify/functions/` do portfólio, portadas de
`content.mjs`/`backup.mjs` + libs puras (`content-handlers.mjs`,
`backup-handlers.mjs`):

| Função | Rota | Papel |
|---|---|---|
| `portobello-content.mjs` | `/api/portobello-content` (+ `/image`) | GET público (overrides/added/hidden), POST com chave (salvar texto, adicionar/ocultar slide, upload de imagem/vídeo) |
| `portobello-backup.mjs` | `/api/portobello-backup` | snapshots pré-mutação + listagem/restore (POST gateado pela chave) |

- Blobs stores próprios: `portobello-deck-content` e `portobello-deck-backups` —
  sem colisão com blog/aerolito.
- Handlers modernos (Request/Response + `config.path`), então `connectLambda` não se
  aplica (só era necessário nos handlers Lambda-style do blog).
- `deck.js` atualizado para os novos endpoints (`/api/content` →
  `/api/portobello-content` etc.).

## Roteamento e CSP

- Redirect explícito `/portobello` → `/portobello/` (301) no `netlify.toml`, antes do
  catch-all do SPA. Arquivos estáticos em `dist/` vencem o catch-all `/*` →
  `/index.html` naturalmente (redirects 200 não-forçados só se aplicam quando o
  arquivo não existe).
- CSP global atual já cobre o deck: fonts Google permitidas em `style-src`/`font-src`,
  scripts todos self-hosted (`script-src 'self'`), `connect-src 'self'` cobre as
  chamadas de API same-origin. Sem mudança de headers.

## Testes e verificação

- Handlers puros de content/backup testados com **vitest** no padrão do portfólio
  (adaptados dos testes node:test do projeto original), incluindo: POST sem chave →
  401, POST com chave válida → grava no store fake, GET público funciona,
  add/hide/override round-trip, snapshot/restore.
- Smoke Playwright programático: `/portobello/` renderiza o slide intro placeholder,
  navegação por teclado responde, POST em `/api/portobello-content` sem chave
  retorna 401 em produção.
- Nenhum teste manual exigido do owner (preferência registrada).
