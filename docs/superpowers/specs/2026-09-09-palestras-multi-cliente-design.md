# Sessão "PALESTRAS" — deck multi-cliente — Design

**Data:** 2026-09-09
**Status:** aprovado pelo owner (v1)

## Objetivo

Generalizar o deck de slides hoje exclusivo da Portobello (`/portobello`, ver
[2026-07-17-portobello-deck-design.md](2026-07-17-portobello-deck-design.md)) para um
sistema multi-cliente, com uma nova sessão **"PALESTRAS"** no menu do portfólio que
leva a uma listagem pública dos decks, e um painel simples para criar/remover/editar
decks sem precisar de commit/deploy.

Escopo confirmado com o owner (v1):

- **Entra:** rota dinâmica `/palestra/:slug` reaproveitando uma única engine de deck
  genérica; listagem pública `/palestra`; painel `/palestra/admin` (add/remover/editar
  status e senha); senha de acesso opcional por deck; migração do deck Portobello para
  o novo sistema; item "PALESTRAS" no menu.
- **Sai (fica pra v2 se necessário):** UI para editar conteúdo dos slides pelo painel
  admin (a edição de slides continua sendo feita dentro do próprio deck, no modo
  edição já existente); chaves de edição por cliente (fica uma única global);
  geração automática de thumbnail.

## Abordagem

**Uma engine estática compartilhada + registro em Netlify Blobs**, ao invés de
duplicar a pasta `public/portobello/` a cada cliente novo (padrão hoje, herdado do
deck "Caixa" original). Alternativas descartadas:

- **Continuar duplicando pastas por cliente** — zero refactor, mas todo cliente novo
  exige cópia manual de ~10 arquivos JS/CSS e uma rodada de deploy; foi a causa raiz
  do pedido de um sistema melhor.
- **Migrar o deck pra dentro do React** — reescreveria do zero a engine de slides
  (navegação, export PDF/PPTX, edição, shader) sem ganho real; o deck já funciona bem
  como SPA estática isolada.

## Estrutura de arquivos

```
public/palestra/
  _deck/                  engine genérica (ex-public/portobello/, sem nada
                           hardcoded pro cliente): index.html, css/styles.css,
                           js/deck.js, js/shader-bg.js, js/gradient-bg.js,
                           js/starfield.js, js/lib/, js/vendor/, assets/
src/pages/
  Palestras.tsx           listagem pública /palestra
  PalestraAdmin.tsx        painel /palestra/admin
```

`js/deck.js` passa a ler o slug do cliente a partir do path da URL
(`location.pathname.split("/")[2]`) e usa esse slug em toda chamada de API
(`/api/deck-content/<slug>`, `/api/deck-backup/<slug>`, `/api/deck-tts`).

## Roteamento

- `netlify.toml`: regra de rewrite `/palestra/:slug/*  /palestra/_deck/index.html  200`
  (splat), servindo a engine compartilhada para qualquer slug, mantendo a URL visível.
- `/portobello` → redirect 301 para `/palestra/portobello` (preserva o link já
  compartilhado com o cliente).
- React Router (`src/App.tsx`): rotas `/palestra` (listagem) e `/palestra/admin`
  (painel) — só essas duas passam pelo React; `/palestra/:slug` é interceptado pelo
  rewrite do Netlify antes de chegar no SPA React.

## Registro de decks (Netlify Blobs)

Store `palestra-registry`, uma chave (`registry`) contendo um array JSON:

```json
[
  {
    "slug": "portobello",
    "titulo": "Da Prancheta ao Prompt",
    "cliente": "Portobello",
    "data": "2026-07-17",
    "thumbnail": "/palestra/_deck/assets/portobello-thumb.png",
    "status": "publicado",
    "senhaHash": null
  }
]
```

- `status`: `"publicado"` (aparece em `/palestra`) ou `"nao-listado"` (só acessível
  via link direto `/palestra/<slug>`).
- `senhaHash`: `null`/ausente = deck aberto; string = `HMAC-SHA256(senha, PALESTRA_EDIT_KEY)`
  em hex (via `node:crypto`, sem dependência nova) da senha de acesso do cliente. Não é
  segurança de alto risco (gating informal para clientes verem um deck de
  apresentação, não dados sensíveis) — dispensa bcrypt/scrypt.

## Conteúdo dos slides (Netlify Blobs)

Store `deck-content`, chaves namespaced por slug (substitui os arquivos estáticos
`slides.json` por cliente e os stores hoje hardcoded `portobello-deck-content` /
`portobello-deck-backups`):

- `<slug>:base` — conteúdo base dos slides (era o `slides.json` estático).
- `<slug>:overrides`, `<slug>:added`, `<slug>:hidden`, `<slug>:order` — iguais ao
  esquema atual do Portobello, só que namespaced.
- Backups: store `deck-backups`, chave `<slug>:snapshots`.

Criar uma palestra nova = escrever entrada no registro + semear `<slug>:base` com um
único slide placeholder vazio (mesmo template que a Portobello usou na v1 do deck).

## Autenticação

Dois mecanismos independentes, reaproveitando o padrão existente
(`portobello-edit-key.mjs`):

1. **Edição de slides + painel admin** — chave única `PALESTRA_EDIT_KEY` (renomeia
   `PORTOBELLO_EDIT_KEY`). Mesmo fluxo de hoje: atalho `E`/`?edit=1` → prompt → header
   `x-edit-key` em todo POST → função valida, 401 fail-closed se errada/ausente.
   `/palestra/admin` usa o mesmo prompt antes de renderizar a lista.
2. **Senha de acesso do cliente** (opcional, por deck) — só protege a
   **leitura** do conteúdo, não a edição. Se `senhaHash` estiver definido:
   - `/palestra/<slug>` mostra um prompt de senha antes de montar o deck.
   - Função `deck-auth` (`POST /api/deck-auth/<slug>` com a senha em texto) compara
     contra `senhaHash`; se bater, retorna um token HMAC assinado com
     `PALESTRA_EDIT_KEY` como segredo, validade 24h.
   - `GET /api/deck-content/<slug>` exige esse token (header) quando o deck tem senha;
     sem senha cadastrada, GET continua público como hoje.
   - Token guardado em `localStorage`, evita repedir a senha a cada slide/refresh
     dentro da validade.
   - Deck em modo edição (chave de admin válida) ignora a senha de cliente — o dono
     sempre acessa.

## Painel `/palestra/admin`

Página React protegida pela `PALESTRA_EDIT_KEY` (mesmo prompt do modo edição). Lista
todos os decks do registro com:

- **Adicionar** — formulário (slug, título, cliente, data, thumbnail, status, senha
  opcional) → `POST /api/deck-registry` cria entrada + semeia conteúdo vazio.
- **Remover** — `DELETE /api/deck-registry/<slug>` com confirmação; apaga entrada do
  registro e as chaves de conteúdo/backup daquele slug.
- **Editar** — alterna `status` publicado/não-listado, define/remove senha
  (`PATCH /api/deck-registry/<slug>`).
- Link "abrir em modo edição" por linha, indo direto pra `/palestra/<slug>?edit=1`.

Nova função `netlify/functions/deck-registry.mjs` (GET público — usado também pela
listagem —, POST/PATCH/DELETE gateados pela `PALESTRA_EDIT_KEY`, mesmo padrão fail-
closed do `portobello-edit-key.mjs`).

## Página de listagem `/palestra`

Lista os decks com `status: "publicado"` do registro (título, cliente, data,
thumbnail, link para `/palestra/<slug>`). Decks `"nao-listado"` não aparecem aqui.
Layout simples de cards, consistente com o design system do resto do portfólio (não
com o visual do deck em si).

## Menu

`src/components/Navbar.tsx`: novo item no array `LINKS`, entre "Projetos" e "Blog"
(mesma posição relativa pedida: logo antes de Blog), rota `to: "/palestra"`, label via
`t("navbar.links.palestras")` — chave nova em `src/locales/*.json` com o texto
**"PALESTRAS"** (plural no rótulo do menu; a URL/slug interno permanece singular
`/palestra`, seguindo o padrão já usado no restante do site).

## Migração do deck Portobello

1. Migrar `public/portobello/{css,js,assets}` → `public/palestra/_deck/`, removendo
   qualquer texto/nome literal "portobello" do código da engine.
2. Ler `public/portobello/slides.json` + overrides atuais do Blob
   `portobello-deck-content` e escrever em `deck-content` com chaves `portobello:*`.
3. Criar entrada `slug: "portobello"` no novo `palestra-registry` com
   `status: "publicado"`, sem senha.
4. Renomear/adaptar `netlify/functions/portobello-content.mjs`,
   `portobello-backup.mjs`, `portobello-tts.ts` e seus handlers em `_lib/` para as
   versões genéricas por slug (`deck-content.mjs`, `deck-backup.mjs`, `deck-tts.ts`).
5. Ajustar `netlify.toml`: substituir o redirect fixo de `/portobello` por
   301 → `/palestra/portobello`, e adicionar a regra de rewrite genérica
   `/palestra/:slug/*`.
6. Validar em produção (deck abre, edição funciona, export PDF/PPTX funciona) antes de
   apagar os arquivos/functions antigos hardcoded.

## Testes e verificação

- Handlers puros (`deck-registry`, `deck-content`, `deck-auth`) testados com vitest,
  padrão do portfólio: CRUD do registro, 401 sem chave de edição em write, GET público
  respeita `status`/senha, deck-auth aceita senha certa e rejeita errada, token HMAC
  expira depois de 24h.
- Smoke Playwright programático: `/palestra` lista só decks publicados,
  `/palestra/portobello` renderiza o conteúdo migrado, `/palestra/<slug-com-senha>`
  bloqueia sem senha e libera com senha certa, `/palestra/admin` exige chave de edição.
- Nenhum teste manual exigido do owner (preferência registrada).
