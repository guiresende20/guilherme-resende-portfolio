# Google Docs como source do blog — Design Spec

**Date:** 2026-05-18
**Status:** Draft — pending user review
**Author:** Claude + Guilherme
**Related:** `docs/superpowers/specs/2026-05-16-blog-section-design.md` (parent blog feature), `docs/superpowers/specs/2026-05-17-chatbot-rag-design.md` (RAG, herda este source)

## Goal

Permitir que o owner escreva posts do blog **diretamente em Google Docs** na pasta `blog/` do Drive, em adição ao fluxo existente de arquivos `.md`. O sistema lê os dois formatos lado a lado, convergindo para o mesmo `ParsedPost`, sem regressão nos consumidores (BlogPost, RSS, sitemap, RAG, chatbot summary).

## Non-Goals

- Não vamos sincronizar imagens embedadas no Doc. Se o usuário quiser imagem, sobe pra `blog/images/` e referencia por nome no body (mesmo fluxo do `.md` hoje).
- Não vamos suportar metadata rica em Docs (cover, featured, draft toggle, excerpt explícito, slug override). Vai ser "mínimo + tags". Se precisar de override, use `.md`.
- Não vamos criar preview de drafts via endpoint. Drafts ficam em `blog/drafts/` e são invisíveis ao sistema; preview = mover pra `blog/`.
- Não vamos auto-extrair conteúdo do site HTML pra o chat (idéia surgiu em conversa paralela — fica pra discussão futura, fora deste spec).
- Não vamos cobrir os handlers Netlify (`chat.ts`, `blog-list.ts`, etc.) com testes — sem suite hoje, fora de escopo. Cobertura ficará na lógica pura (parsers, slugify, source detection).

## Background

Hoje, posts do blog são `.md` no Drive, parseados via `gray-matter` (YAML frontmatter + body). O fluxo é robusto, mas obriga o owner a editar markdown num editor externo. Pra posts curtos de prosa, isso é overhead — Google Docs é mais natural (WYSIWYG, mobile, sem sintaxe).

Brainstorming desta feature aconteceu em duas sessões (2026-05-17 PM começou, 2026-05-18 fechou). Decisões settled:

| # | Pergunta | Escolha |
|---|---|---|
| Q1 | Nível de metadata | **B — Mínimo + tags** (title do nome, date do createdTime, sem YAML) |
| Q2 | Convenção de tags | **A — Primeira linha do body** (`Tags: ia, blog, meta`) |
| Q3 | Imagens embedadas | **A — Sem imagens no Doc** (upload separado em `blog/images/`) |
| Q4 | Drafts | **A — Subpasta `blog/drafts/`** (sistema ignora) |
| Q5 | Backward compat | **A — Mantém os dois** (`.md` E Docs, escolha por post) |
| Q6 | Date source | **A — `createdTime`** (estável, typo fix não muda data) |

Approach escolhido: **A — server-side export on demand**. Rejeitado B (Apps Script mirror) por gerar arquivos auto-gerados poluindo `blog/`, ser caixa-preta sem version control, e criar ambiguidade Doc-vs-`.md` como source-of-truth. Rejeitado C (build-time export) por exigir rebuild a cada edição de Doc.

## Architecture Overview

Um único ponto de divergência por mimeType, convergindo pra `ParsedPost`:

```
GET /api/blog/post/<slug>
  ↓
[handler — sem mudança no shape]
  ↓
resolveBlogFolders() → folder ID
  ↓
listFolder(folderId) → DriveFile[]
  ↓
[FILTRO] isBlogPostSource(f)        ← novo helper
  ↓
[BRANCH único em fetchAndParse(f)]  ← novo helper
  ├─ text/markdown          → downloadText        → parsePost      (existente)
  └─ vnd.google-apps.document
                            → exportDocAsMarkdown → parseDocPost   (novo)
  ↓
ParsedPost { meta, body }   ← fronteira contratual
  ↓
cache em posts/{slug}       (existente, sem mudança)
  ↓
render markdown pipeline    (existente, sem mudança)
```

Princípios:
- **Branch em 1 lugar, não 7.** `fetchAndParse(f)` encapsula a divergência. Consumers (chat.ts, blog-list, blog-post, blog-rss, sitemap, blog-reindex, blog-translate) trocam 2 linhas cada: filtro + chamada.
- **`ParsedPost` é o contrato.** Tudo downstream é indiferente à source.
- **`drafts/` é filtrado naturalmente.** `listFolder` não recursa em subpastas; folder mimeType é excluído por `isBlogPostSource`. Zero código novo pra drafts.

## Components

### Novos

**`netlify/functions/_lib/drive.ts`** (modify — adicionar 1 função)
```ts
export async function exportDocAsMarkdown(fileId: string): Promise<string>
```
Wrapper sobre `drive.files.export({ fileId, mimeType: 'text/markdown' })`. Mesma auth service-account já em uso. ~15 linhas.

**`src/lib/blog/frontmatter.ts`** (modify — adicionar 1 função e helper interno)
```ts
export function parseDocPost(
  raw: string,
  driveName: string,
  createdTime: string,
): ParsedPost

// helper interno, exportar pra testes
export function slugify(s: string): string
```
`parseDocPost` não usa `gray-matter`. Reusa `readingTime` já existente.

**`netlify/functions/_lib/blog-source.ts`** (novo)
```ts
export function isBlogPostSource(f: DriveFile): boolean
export async function fetchAndParse(f: DriveFile): Promise<ParsedPost>
```
- `isBlogPostSource` → true pra `.md`/`.MD` extension, mimeType `text/markdown`, ou mimeType `application/vnd.google-apps.document`
- `fetchAndParse` → branch interno baseado em mimeType. Propaga erros (consumer trata com try/catch existente).

### Modificados (consumers)

Cada um troca 2 linhas: o filtro de listing e a chamada de fetch+parse.

- `netlify/functions/chat.ts` (`getPostsForPrompt`)
- `netlify/functions/blog-list.ts`
- `netlify/functions/blog-post.ts`
- `netlify/functions/blog-rss.ts`
- `netlify/functions/sitemap.ts`
- `netlify/functions/blog-reindex.ts`
- `netlify/functions/blog-translate.ts` (com nuance: tem filtro adicional "lang === pt" pré-existente)

### Não mudam

- `_lib/blog-folders.ts` — drafts/ é filtrado naturalmente
- `_lib/blob-cache.ts` — cache key `posts/{slug}` é transparente à source
- `_lib/rag.ts`, `_lib/vector-store.ts`, `_lib/chunker.ts`, `_lib/embeddings.ts` — recebem `body`, indiferentes à source
- `blog-revalidate.ts` — só invalida cache, não conhece sources
- `blog-image.ts` — fluxo separado de imagens
- Front-end (`BlogPost.tsx`, blog list page, etc.) — consome `ParsedPost`

### Tamanho total

- 2 arquivos novos (~70 linhas combinadas)
- 1 função nova em `drive.ts` (~15 linhas)
- 1 função + 1 helper em `frontmatter.ts` (~50 linhas)
- 7 consumers, ~2 linhas cada (~14 linhas modificadas)

**Total: ~100 linhas novas, ~50 modificadas.**

## Metadata Extraction (parseDocPost)

| Campo | Source | Notas |
|---|---|---|
| `slug` | `slugify(driveName)` | Unicode-safe (NFD + strip diacriticals + lowercase + `[^a-z0-9]+` → `-`). Slug vazio → log error + skip |
| `title` | `driveName` | Sem stripar extensão (Docs não têm) |
| `date` | `createdTime` slice 0-10 | Estável; typo fix não muda. Re-publicar = duplicar o Doc |
| `lang` | `"pt"` hardcoded | Sem override |
| `tags` | Primeira linha matching `/^Tags?\s*:\s*(.+)$/i` | Split por `,`, trim, filter falsy. Linha removida do body após match. Sem match → tags = `[]`, body intacto |
| `excerpt` | Primeiro parágrafo do body (pós-strip de tags) | Trunca em 200 chars no word boundary, com `…` |
| `draft`, `featured` | `false` sempre | |
| `cover` | `undefined` sempre | |
| `readingTimeMin` | `readingTime(body)` | Função existente, sem mudança |

Regex de tags: `/^Tags?\s*:\s*(.+)$/i`. Casos:
- `"Tags: ia, blog, meta"` → tags `["ia", "blog", "meta"]`, linha removida
- `"Tag: solo"` → `["solo"]`
- `"TAGS:stuff"` → `["stuff"]`
- `"Tags: a, b ,, c, "` → `["a", "b", "c"]`
- `"Tags:"` (vazio) → tags `[]`, linha ainda removida
- Sem match na primeira linha → tags `[]`, body intacto

Slugify: ~8 linhas, sem dep nova. `"Por trás do blog"` → `"por-tras-do-blog"`, `"100% Java"` → `"100-java"`.

Risco aceito: post de prosa que literalmente comece com "Tags: ..." em sentido natural terá essa linha stripada. Documentado no setup doc como gotcha.

## Data Flow

### Path A — Markdown (sem mudança)

```
DriveFile { mimeType: "text/markdown", name: "foo.md", ... }
  → isBlogPostSource → true (extension match)
  → downloadText(id)  [1 Drive API call]
  → parsePost(raw, name)
    → gray-matter parse YAML
    → slug, title, date, tags, body, etc.
  → ParsedPost
```

### Path B — Google Doc (novo)

```
DriveFile { mimeType: "application/vnd.google-apps.document", name: "Pensando em X", ... }
  → isBlogPostSource → true (Doc mimeType match)
  → exportDocAsMarkdown(id)  [1 Drive API call: files.export?mimeType=text/markdown]
  → parseDocPost(raw, name, createdTime)
    → strip e parse linha de tags
    → slugify(name)
    → derive date from createdTime
    → ParsedPost
```

### Convergência

Idêntico ao path atual. Cache em `posts/{slug}` (sem mudança), consumer-specific render.

### Latência

- `.md`: ~200-500ms por post (download)
- Doc: ~400-900ms por post (export, mais lento por causa da renderização server-side do Drive)
- Cache anula a diferença em hits subsequentes (TTL 10min)

## Drafts Handling

`listFolder` lista apenas children diretos da pasta `blog/`. Subpastas (incluindo `drafts/`, `images/`, qualquer outra) aparecem na listagem com mimeType `application/vnd.google-apps.folder`, que **não** é matched por `isBlogPostSource`. Resultado:

- `blog/foo.md` → publicado
- `blog/Foo Doc` → publicado
- `blog/drafts/foo.md` → invisível
- `blog/drafts/Foo Doc` → invisível
- `blog/2026/foo.md` → invisível (princípio geral: nested folders são ignorados)

Convenção do nome `drafts/` é só pra leitor humano — sistema não inspeciona o nome.

Documentar no setup doc: "apenas children diretos de `blog/` são considerados".

## Error Handling

Regra mestra: **uma source ruim não derruba o feed**.

| Stage | Failure | Tratamento |
|---|---|---|
| `listFolder` | SA auth, Drive 5xx | Sem mudança vs hoje. Propaga; handler retorna 500 ou degrada gracioso (chat) |
| `fetchAndParse` | 404 mid-flight (Doc deletado) | Throw; consumer per-file try/catch loga e skipa |
| `fetchAndParse` | 429 Drive Export quota | Throw; skip + log; próximo refresh re-tenta |
| `fetchAndParse` | 5xx Drive | Throw; skip + log; próximo refresh re-tenta |
| `parseDocPost` | Slug vazio, body malformado | Throw; skip + log |
| Cache write | Sem permissão Blobs | `safeStore` já trata (no-op) |

Pattern universal nos consumers (já estabelecido por `getPostsForPrompt:80-82`, `blog-rss.ts`, `sitemap.ts`):

```ts
for (const f of files.filter(isBlogPostSource)) {
  try {
    const parsed = await fetchAndParse(f);
    // ...
  } catch (err) {
    console.error("blog: skipping", { name: f.name, id: f.id, error: err });
  }
}
```

**Sem retry.** Drive quota reseta em ~100s; próximo hit refaz. Retry síncrono adiciona complexidade sem ganho.

Fragilidades do Drive Export (não-erros, documentar):
- Code blocks: use Insert > Building blocks > Code block. Inline `code` pré-2024 vira texto.
- Nested lists 3+ embaralham indentação.
- Imagens embedadas: não fazer (Q3 settled). Se feito por engano, render quebra.

## Testing

Sem teste manual. Validação via vitest + smoke programático que Claude roda pós-deploy.

### Unit tests (vitest)

**`src/lib/blog/__tests__/slugify.test.ts`** (~10 casos): acentos, especiais, vazios, só-especiais, espaços, hífens nas pontas, unicode.

**`src/lib/blog/__tests__/parse-doc-post.test.ts`** (~15 casos): cobertura completa de tags line (Tags/Tag/TAGS, espaços, vazio, sem match), body (vazio, só tags, único parágrafo, múltiplos, prosa-tipo-tags), excerpt (short/long/whitespace), slug deriva, date deriva.

**`netlify/functions/_lib/__tests__/is-blog-post-source.test.ts`** (~8 casos): `.md`, `.MD`, mimeType markdown, mimeType Doc, folder, jpg, txt, sem extensão.

**`netlify/functions/_lib/__tests__/fetch-and-parse.test.ts`** (~4 casos, com `vi.mock("../drive")`): branch `.md`, branch Doc, downloadText throw, exportDocAsMarkdown throw.

**Total: ~37 testes novos, < 1s pra rodar.**

### Smoke pós-deploy (Claude executa, owner não toca)

Pre-req único do owner: criar 1 Doc de teste no `blog/` com nome `Teste do parser de Docs` e body:
```
Tags: teste, sandbox

Conteúdo de teste pra validar o parser.
```

Após Deploy Preview ficar pronto, Claude roda:
1. `curl /api/blog/list` — verifica que slug `teste-do-parser-de-docs` aparece, tags `["teste", "sandbox"]`, title correto, date razoável.
2. `curl /api/blog/post/teste-do-parser-de-docs` — verifica body contém "Conteúdo de teste" e NÃO contém "Tags:".
3. `curl /api/blog/rss` — verifica post no XML.
4. `curl /api/blog/reindex` (se owner passar token) — verifica `storedChunks > 0` pro Doc.
5. `curl /api/chat` com pergunta sobre o conteúdo — verifica que cita o body.

Reporta resultado em tabela. Owner só lê.

### Não automatizável (call out explícito)

- **Fidelidade do Drive Export pra conteúdo real complexo** (code blocks, listas profundas, tables) — só inspecionando output. Mitigação: documentação + opt-in reportar e tratar caso a caso.
- **Render visual no browser** — daria pra automatizar com Playwright, fora deste spec. Owner descobre na primeira leitura de um post de Doc.

## Documentation Updates

Atualizar `docs/blog-setup.md`:

- **Renomear seção 5** pra ter `5.1 As a Markdown file` (conteúdo atual) e `5.2 As a Google Doc` (novo, em português, com instruções: criar Doc, nomear, primeira linha `Tags:`, escrever body, revalidate)
- **Nova seção 7 — Drafts**: convenção `blog/drafts/`, vale pra `.md` e Doc
- **Nova seção 8 — `.md` vs Doc**: tabela de quando usar cada
- **Nova seção 9 — Limitações conhecidas do Google Doc**: tags magic line, renomear muda slug, date congelada em createdTime, Drive Export quirks
- **Refinar linha ~132** (RAG section): mencionar `blog/drafts/` explicitamente como recomendado

**Bônus, mesmo commit (não-Phase 6, doc bug)**: corrigir linha 90 que ainda diz `text-embedding-004`; o modelo atual é `gemini-embedding-001` com `outputDimensionality: 768` (mudado no ship do RAG em 2026-05-18).

## Risks / Open Questions

- **Slug colisão**: Dois Docs com nomes que slugifiquem igual (`"Hello World"` e `"hello world"`) gerariam o mesmo slug. Tratamento: detecção fica no consumer que precisa enumerar todos os posts (`blog-list`, `blog-reindex`, `blog-rss`, `sitemap`). Pattern: ao iterar, manter `Set<string>` de slugs já vistos. Se um slug repete, `console.error("blog: duplicate slug, skipping", { slug, name, id })` e pular o segundo. O primeiro a aparecer (ordem do Drive listing — não-determinística) vence. Caso é raro o suficiente pra não justificar UI dedicada.
- **Drive renomear quebra inbound links**: trade-off aceito. Documentado.
- **Convenção `Tags:` em `.md` vs Doc é diferente**: `.md` usa YAML frontmatter (`tags: [a, b]`); Doc usa primeira linha (`Tags: a, b`). Intencionalmente diferente pra parsers ficarem independentes. Não tentar unificar.
- **Edição mid-render**: Doc em edição durante geração de feed pode produzir conteúdo desatualizado temporariamente. Próxima geração corrige. Sem mitigação.
- **`createdTime` pra Doc movido de drafts/**: se owner draftar em `blog/drafts/` por semanas e mover, date será a data do draft, não da publicação. Documentado. Workaround: duplicar Doc ao publicar.

## Migration / Rollout

- Sem feature flag. Mudança é puramente aditiva — `.md` continua funcionando sem código novo no caminho dele.
- Sem migração de dados — cache existente em `posts/{slug}` continua válido pra posts `.md`; posts Doc serão novos slugs.
- Deploy padrão: branch + PR + Deploy Preview com smoke automático que Claude roda. Squash merge.
- Rollback se quebrar: revert do PR. Fluxo `.md` não é tocado, mesmo no path crítico.

## Implementation Estimate

Pelo padrão das fases anteriores (Blog Section: 12 tasks ~8h, RAG: 9 tasks ~6h), esta feature: **5-7 tasks, 4-6h focused** com subagent-driven development se quiser paralelizar a parte de testes.
