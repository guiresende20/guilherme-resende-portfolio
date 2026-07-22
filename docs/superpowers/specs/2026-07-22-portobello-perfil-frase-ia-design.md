# Design — Relayout do slide de perfil + novo layout "Frase + IA" (deck /portobello)

Data: 2026-07-22
Deck: `public/portobello/` (Portobello/Eletromec)

## Objetivo

Duas mudanças no deck de slides:

1. **Relayout** do slide de perfil "Guilherme Resende Muniz" (`id: sobre-guilherme`):
   informações maiores, layout organizado, retrato maior, sem o rótulo de
   numeração, e um link para o repositório 3D da UFRGS.
2. **Novo layout `frase-ia`** ("Frase + IA"): a frase-manifesto fica visível e um
   botão dispara uma resposta da IA do portfólio, digitada inline abaixo da frase.

## Parte A — Relayout do slide de perfil

Arquivos: `public/portobello/js/deck.js`, `public/portobello/css/styles.css`,
`public/portobello/slides.json`.

### Comportamento

- **Remover o eyebrow "SLIDE 01/02"**: em `buildSlide`, não renderizar
  `panel-eyebrow` quando `isProfile` (`s.portrait` presente). O slide continua
  sendo um "território" (aparece no índice normalmente); só o rótulo some.
- **Retrato maior**: `clamp(120px, 16vw, 220px)` (hoje ~104px).
- **Nome grande**: `clamp(40px, 6vw, 92px)`.
- **Corpo maior e em duas colunas**: Formação | Experiência lado a lado, texto em
  `clamp(14px, 1.2vw, 20px)` (hoje ~11px), container largo `min(1100px, 88vw)`,
  sem o cartão estreito atual (fundo/painel mais amplo, respiro maior).
- **Chip de link do repositório 3D**: novo conceito `links` no slide, renderizado
  como âncora `.chip-link` que abre em **nova aba** (`target="_blank"
  rel="noopener noreferrer"`). Os chips atuais (`items`) continuam.
  - Slide: `"links": [{ "label": "Repositório 3D — UFRGS", "url": "https://www.ufrgs.br/ldsm/3d/" }]`

### Modelo de dados (adições)

- `links?: Array<{ label: string; url: string }>` em qualquer slide clássico.
  Renderiza chips-âncora abrindo em nova aba. Independente de `items`
  (chips que abrem diálogo interno).

## Parte B — Novo layout "Frase + IA" (`frase-ia`)

Arquivos: `public/portobello/js/deck.js`, `public/portobello/css/styles.css`,
`public/portobello/js/lib/print-doc.mjs`, `public/portobello/slides.json`.

### Comportamento

- **Base visual = frase-manifesto**: a frase grande e centralizada é o `s.title`.
  Reusa o estilo `slide--manifesto` (mesma diagramação da frase).
- **Botão "▶ Perguntar à IA"** logo abaixo da frase (label padrão; a frase fica
  sempre visível).
- **Ao clicar**:
  1. A frase **permanece visível** (não é re-digitada).
  2. Abaixo, abre uma área de resposta com indicador de carregando.
  3. Chamada `POST /api/chat` com corpo `{ message, history: [] }`, onde
     `message = INSTRUCAO + "\n\n\"" + frase + "\""`.
     - `INSTRUCAO` padrão: *"Reaja a esta frase e amplie a ideia em 2–3
       parágrafos curtos, conectando com a trajetória e a visão do Guilherme.
       Responda em português."*
  4. `/api/chat` responde JSON `{ text, actions }` (não-streaming). O `text` é
     **digitado** (efeito máquina de escrever, ~palavra a palavra) na área de
     resposta. Um clique na área durante a digitação revela tudo de imediato.
- **Tipografia da resposta**: **Times New Roman** (`font-family: "Times New
  Roman", Times, serif`), **tamanho médio** `clamp(16px, 1.4vw, 22px)`,
  `line-height` confortável, largura máx. ~70ch, centralizado sob a frase.
- **Estados/erros**: botão desabilita enquanto carrega; em erro/limite (429/500/
  rede), mensagem inline amigável ("Não consegui responder agora — tente de
  novo") e botão reabilita. Permite perguntar de novo (substitui a resposta).

### Modelo de dados

- `layout: "frase-ia"`, `title` = a frase.
- `aiInstruction?: string` (opcional, override da instrução padrão; não exposto
  na UI de edição na v1 — editável via JSON).
- `aiButtonLabel?: string` (opcional; padrão "Perguntar à IA").

### Registro / integração

- Adicionar `"frase-ia": 1` em `LAYOUTS`.
- Adicionar ao seletor de templates (modo edição): `{ value: "frase-ia", name:
  "Frase + IA", desc: "Frase-manifesto + resposta da IA" }`.
- No editor, comporta-se como manifesto (edita a frase; sem corpo/chips).
- Criação por template (`createFromTemplate`): base com `layout: "frase-ia"` e
  uma frase-placeholder.
- **PDF** (`print-doc.mjs`): `case "frase-ia": return manifestoPageHTML(slide)`
  (só a frase; a parte de IA é interativa, não vai ao PDF).
- **Slide de exemplo** no `slides.json`: 1 slide `frase-ia` com uma frase
  editável, para ficar demonstrável.

## Segurança / restrições

- CSP do site já permite `connect-src 'self'` → `/api/chat` (mesma origem) funciona.
- Rate limit de `/api/chat`: 10/min, 50/h. Suficiente para demo ao vivo.
- Sanitização: a resposta da IA é inserida como **texto** (não HTML) na digitação
  (`textContent`), evitando injeção. Quebras de parágrafo tratadas com nós/`<br>`
  a partir de texto escapado.

## Verificação (sem teste manual do owner)

- **Smoke Playwright local** (serve `public/`, sem functions):
  - Perfil: retrato com largura ≥120px, `panel-eyebrow` ausente, chip-âncora
    "Repositório 3D — UFRGS" com `href` correto e `target="_blank"`.
  - Frase-ia: frase (title) + botão presentes; `page.route('**/api/chat', ...)`
    devolve `{ text }` canned; após clique, a resposta aparece digitada, em
    Times New Roman (checa `font-family` computado), sem erros de JS.
- **Prod (pós-deploy)**: 1 clique real no botão confirmando resposta não-vazia
  (tolerante a limite/falha) + checagens estáticas (layout servido).

## Entrega

- Feature → **branch + PR** com deploy preview; smokes verdes antes do merge.

## Fora de escopo (YAGNI)

- Histórico de conversa multi-turno no slide (cada clique é 1 pergunta isolada).
- Editar a instrução da IA pela UI de edição.
- Streaming real (o `/api/chat` é JSON; digitação é simulada no cliente).
