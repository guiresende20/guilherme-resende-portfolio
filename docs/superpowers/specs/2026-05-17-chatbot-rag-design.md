# Chatbot RAG — Design Spec

**Date:** 2026-05-17
**Status:** Draft — pending user review
**Author:** Claude + Guilherme
**Related:** `docs/superpowers/specs/2026-05-16-blog-section-design.md` (parent feature)

## Goal

Permitir que o chatbot do site responda usando o **conteúdo completo dos posts do blog** (não só título e excerpt como hoje), via RAG (Retrieval-Augmented Generation) com busca vetorial. O bot deve conseguir citar trechos específicos como "no post X, escrevi que Y...", e continuar funcionando sem degradação visível mesmo quando o RAG falhar.

## Non-Goals

- Não vamos implementar hybrid search (vetorial + keyword/BM25). YAGNI no corpus atual (1 post hoje, projeção <30 em 1 ano). Plugável depois sem retrabalho.
- Não vamos migrar pra Supabase pgvector agora. Netlify Blobs é suficiente até ~500 chunks (~50-100 posts longos). Reversível se ficar grande.
- Não vamos indexar posts em `blog/drafts/` (futura subpasta da Phase 6 — Google Docs). Drafts ficam invisíveis ao bot, por design.
- Não vamos criar dashboard/UI de admin. Reindex é via curl no endpoint protegido.
- Não vamos cobrir o `chat.ts` em si com testes — sem suite hoje, fora de escopo.

## Background

Hoje o chatbot usa `getPostsForPrompt()` em `netlify/functions/chat.ts` pra montar um índice curto com `slug — título — excerpt` (uma linha por post). O bot **sabe que o post existe** e pode recomendar o link, mas **não conhece o conteúdo** — não dá pra responder "o que o Guilherme diz sobre X no post Y?", nem extrair citações, nem combinar informações de vários posts numa resposta.

O post `por-tras-do-blog` (publicado 2026-05-17) promete explicitamente RAG completo como feature futura. Este spec implementa essa promessa.

## Architecture Overview

Two flows: **indexação** (offline, dispara em mudanças no post) e **consulta** (online, a cada mensagem do chat).

### Fluxo de indexação
```
Post .md no Drive
   ↓
[blog-revalidate.ts] (já existe — recebe ?slug=foo)
   ↓
1. Busca Drive ➜ baixa MD
2. parsePost() ➜ extrai body sem frontmatter
3. chunker.ts ➜ quebra em ~6-15 chunks de ~500 tokens c/ overlap de ~80
4. embeddings.ts ➜ chama Gemini text-embedding-004 (1 chamada batch)
5. vector-store.ts ➜ atualiza posts-index.json no Netlify Blobs
                     (remove chunks antigos do slug, insere novos)
```

### Fluxo de consulta
```
Usuário manda mensagem
   ↓
[chat.ts]
   ↓
1. getPostsForPrompt() ← JÁ EXISTE (índice curto: título+excerpt)
2. retrieveRelevantChunks(message):
     a. embeddings.ts ➜ embed da query (1 chamada Gemini)
     b. vector-store.ts ➜ carrega posts-index.json do Blobs (cache em mem)
     c. cosine similarity contra todos os vetores
     d. retorna top-K chunks (K=5) com score acima de threshold (0.6)
3. Monta system prompt em 3 camadas:
     SYSTEM_PROMPT
       + postsSummary  (índice curto, sempre)
       + retrievedChunks  (corpo, condicional ao score)
4. Gemini gera resposta normal
```

### Storage layout no Netlify Blobs (store `blog` existente)
```
embeddings/
  posts-index.json    ← { chunks: [{ slug, chunkIdx, text, vector, sourceTitle, headingPath }] }
  meta.json           ← { lastIndexedAt, modelVersion, dimension: 768 }
```

### Princípios de design

- **Two-layer fallback**: se RAG falhar (Blobs vazio, Gemini embed timeout, etc.), o índice curto sempre injetado garante que o bot ainda funciona. Resposta degrada de "cita trecho" para "só recomenda o link" — nunca quebra.
- **Indexação acoplada ao revalidate**: o owner já bate em `/api/blog/revalidate?slug=foo` quando atualiza um post. RAG segue o mesmo trigger — zero workflow novo.
- **Cache em memória dentro da função**: `posts-index.json` é carregado 1x por instância serverless e mantido entre invocações (warm starts). Cold start = +1 leitura de Blob (~50ms).
- **Threshold de score**: se nenhum chunk passa do threshold (0.6), não injeta nada. Evita despejar conteúdo irrelevante quando a pergunta é off-topic ("oi, tudo bem?" não puxa post nenhum).

## Components

### Arquivos novos

| Arquivo | Responsabilidade | Tamanho aprox |
|---|---|---|
| `netlify/functions/_lib/embeddings.ts` | Wrapper fino sobre Gemini `text-embedding-004`. Exporta `embedText(text)` e `embedBatch(texts[])`. Retry leve em 429/503. | ~60 linhas |
| `netlify/functions/_lib/chunker.ts` | Quebra markdown em chunks. Estratégia: split por parágrafos (`\n\n`), agrupa até atingir ~500 tokens, gera overlap de ~80 tokens. Preserva headings como contexto no início do chunk. NÃO quebra dentro de code blocks. | ~80 linhas |
| `netlify/functions/_lib/vector-store.ts` | CRUD sobre `embeddings/posts-index.json` no Blobs. Funções: `loadIndex()` (com cache em memória), `replacePostChunks(slug, chunks)`, `removePost(slug)`, `searchSimilar(queryVector, { k, threshold, maxPerPost })`. Cosine similarity em JS puro. | ~120 linhas |
| `netlify/functions/_lib/rag.ts` | Fachada que orquestra. Exporta `indexPost(slug, body, meta)` (chunker → embed → store) e `retrieveRelevantChunks(query)` (embed → search → format). Camada onde `chat.ts` e `blog-revalidate.ts` plugam — eles não tocam embeddings/chunker/store direto. | ~80 linhas |
| `netlify/functions/blog-reindex.ts` | Endpoint admin protegido por `BLOG_REVALIDATE_TOKEN` (mesmo token do revalidate). `POST` sem args = reindexa tudo. Necessário no bootstrap (primeira indexação) e como botão de pânico se o índice corromper. | ~70 linhas |

### Arquivos modificados

| Arquivo | Mudança | Diff aprox |
|---|---|---|
| `netlify/functions/blog-revalidate.ts` | Após `deleteCached("posts/...")` por slug, chamar `indexPost(slug, body, meta)` (precisa baixar + parsear o post; helper pequeno). No modo `?all=true`, também chamar `indexPost` num loop. | +30-50 linhas |
| `netlify/functions/chat.ts` | Após `getPostsForPrompt()`, chamar `retrieveRelevantChunks(message)` com `Promise.race` timeout 1.5s. Concatenar resultado ao `fullSystemPrompt` sob header `TRECHOS RELEVANTES DO BLOG:`. Try/catch para nunca quebrar a chamada principal. | +20 linhas |
| `netlify.toml` | Redirect `/api/blog/reindex` → `/.netlify/functions/blog-reindex`. | +1 linha |
| `docs/blog-setup.md` | Nova seção "RAG no chatbot": como bootstrappear, troubleshooting, custo, limitações conhecidas. | +60 linhas |

### Arquivos NÃO tocados (intencional)

- `src/lib/blog/frontmatter.ts` — parsing fica idêntico; o chunker recebe `body` já limpo
- `netlify/functions/blog-list.ts`, `blog-post.ts`, `blog-rss.ts`, `sitemap.ts` — RAG é invisível pra eles
- Tudo do frontend (`BlogPost.tsx`, `ChatWidget.tsx`, etc.) — zero mudança visual

### Por que essa separação

- **`_lib/rag.ts` como fachada**: `chat.ts` e `blog-revalidate.ts` só conhecem `indexPost` e `retrieveRelevantChunks`. Se amanhã trocar vector store de Blobs pra Supabase pgvector, mexe-se em 1 arquivo (`vector-store.ts`) — fachada e callers ficam intactos.
- **`embeddings.ts` isolado do `chunker.ts`**: cada um testável separado. `chunker` é determinístico (sem rede), `embeddings` é onde se mocka em testes.
- **Endpoint `blog-reindex` separado do `blog-revalidate`**: separa "bust cache + reindex pontual" (uso normal) de "reindex tudo do zero" (uso raro/admin). Evita acionar acidentalmente o caro.

### Variáveis de ambiente

Nenhuma nova. Reusa `GEMINI_API_KEY` (embeddings) e `BLOG_REVALIDATE_TOKEN` (autenticação do reindex).

## Data Flow Details

### A) Indexação — `POST /api/blog/revalidate?slug=por-tras-do-blog`

```
1. blog-revalidate.ts recebe request
   ├─ valida X-Revalidate-Token (já existe)
   ├─ deleteCached("posts/list")
   ├─ deleteCached("posts/por-tras-do-blog")
   └─ deleteCached("posts/prompt-summary")  ← follow-up de Phase 5 agendado

2. Busca o post atualizado:
   ├─ resolveBlogFolders() ➜ root folder id
   ├─ listFolder() ➜ acha file por nome slug.md  (NB: ver "Open Questions" abaixo)
   ├─ downloadText(file.id) ➜ raw markdown
   └─ parsePost(raw, file.name) ➜ { meta, body }

3. Se meta.draft === true:
   ├─ rag.removePost(slug)  ← garante limpeza
   └─ return 200

4. Indexa:
   ├─ rag.indexPost(slug, body, meta) chama internamente:
   │  ├─ chunks = chunker.chunk(body, { targetTokens: 500, overlap: 80 })
   │  │   ➜ array de { idx, text, headingPath: "## Por trás > ### IA" }
   │  ├─ vectors = embeddings.embedBatch(chunks.map(c => c.text))
   │  │   ➜ 1 chamada Gemini (batch nativo)
   │  └─ vectorStore.replacePostChunks(slug, chunks com vectors anexados)
   │      ➜ load JSON ➜ filter out chunks com mesmo slug ➜ append novos ➜ save
   └─ return 200 com { revalidated: true, indexed: true, chunks: N }
```

### B) Consulta — `POST /api/chat`

```
1. chat.ts recebe POST (validação, rate limit já existem)

2. Constrói o prompt em 3 camadas:
   ├─ camada 1: SYSTEM_PROMPT  (sempre, ~5k tokens)
   ├─ camada 2: postsSummary = getPostsForPrompt()
   │            (índice curto, ~100 chars/post — JÁ EXISTE)
   └─ camada 3: ragContext = retrieveRelevantChunks(message)
                (top-K trechos, ~500 tokens cada)

3. retrieveRelevantChunks(message):
   ├─ queryVec = embeddings.embedText(message)        ← +1 chamada Gemini (~80ms)
   ├─ hits = vectorStore.searchSimilar(queryVec, {
   │             k: 5,
   │             threshold: 0.6,
   │             maxPerPost: 2
   │          })
   ├─ se hits.length === 0: retorna ""
   └─ formata:
       "\n\n---\n\nTRECHOS RELEVANTES DO BLOG (use quando responder):\n\n"
       + hits.map(h =>
           `[${h.sourceTitle} — ${h.headingPath}] (/blog/${h.slug})\n${h.text}\n`
         ).join("\n---\n")

4. fullSystemPrompt = SYSTEM_PROMPT + postsSummary + ragContext

5. Gemini chat normal (search mode OU JSON mode — RAG é injetado em ambos)
```

### C) Decisões de tunning embutidas

| Decisão | Valor | Por quê |
|---|---|---|
| `targetTokens` por chunk | 500 | Sweet spot: granular pra ranking preciso, grande pra ter contexto coerente. ~75-100 palavras em pt-BR. |
| `overlap` entre chunks | 80 tokens | Evita cortar uma ideia no meio. Padrão da indústria (10-20% do chunk). |
| `k` (top chunks) | 5 | Cabe folgado no contexto (5 × 500 = 2.5k tokens). 2-3 ângulos diferentes da pergunta. |
| `threshold` (score mínimo) | 0.6 (cosine) | Tunable. Validar empiricamente no smoke test. |
| `maxPerPost` | 2 | Evita uma pergunta sobre o post X puxar só chunks do post X. Dá espaço pra outros posts. |
| Embedding model | `text-embedding-004` (Gemini) | 768 dims, free tier 1500 req/dia. Mesma API key. |
| Cache em memória | Sim, módulo-level `let cachedIndex` | Warm function reusa. Cold start = ~50ms read do Blob. |
| Invalidação do cache em mem | `meta.json` tem `lastIndexedAt` — releitura se diverge | Garante que após reindex de outra invocação, próxima consulta pega versão nova em <1min |
| Timeout interno do retrieve | 1.5s (Promise.race) | Bot responde sem RAG vs. travado. |

## Error Handling

Princípio geral: **RAG nunca pode quebrar o chat.** Qualquer falha vira degradação silenciosa pro próximo nível (chunks → índice curto → SYSTEM_PROMPT puro).

### A) Falhas durante consulta

| Falha | Tratamento | Efeito |
|---|---|---|
| Gemini embeddings timeout/429/503 | Try/catch → retorna `""`. Log `console.error`. | Bot responde só com índice curto. |
| Blobs read falha | Try/catch → retorna `""`. Log. | Idem. |
| Índice vazio (Blob inexistente) | `loadIndex` retorna `{chunks:[]}` → `searchSimilar` retorna `[]` | Idem. Acontece pré-bootstrap. |
| Nenhum chunk passa do threshold | Retrieve retorna `""` (intencional) | Bot ignora RAG nessa pergunta. |
| `JSON.parse` corrompido | Try/catch → log → retorna `{chunks:[]}`. NÃO auto-deleta o Blob (preserva pra inspeção). | Funciona sem RAG até admin rodar reindex. |
| Dimensão errada (model trocado) | `searchSimilar` valida dim. Ignora chunks divergentes. | Bot funciona sem RAG até reindex. |
| Latência total >1.5s | `Promise.race` com timeout → resolve `""` | Bot responde mais rápido sem RAG vs. travado. |

**Padrão no chat.ts:**
```ts
let ragContext = "";
try {
  ragContext = await Promise.race([
    retrieveRelevantChunks(message),
    new Promise<string>(r => setTimeout(() => r(""), 1500))
  ]);
} catch (err) {
  console.error("rag retrieve failed", err);
}
const fullSystemPrompt = SYSTEM_PROMPT + postsSummary + ragContext;
```

### B) Falhas durante indexação

Diferente da consulta, aqui **propagamos** o erro pro caller — admin precisa saber. Mas continuamos invalidando cache normalmente.

| Falha | Tratamento | Resposta |
|---|---|---|
| Drive download falha | Log, NÃO indexa, MAS cache do post já foi bustado | `200 { revalidated: true, indexed: false, error: "drive download failed" }` |
| Embeddings batch falha (rate limit) | 1 retry após 500ms. Se falhar de novo, abandona. | `200 { revalidated: true, indexed: false, error: "embeddings throttled" }` |
| Blobs write falha | Log, retorna erro. Mantém versão antiga (não escreve parcialmente). | `200 { revalidated: true, indexed: false, error: "vector store write failed" }` |
| Chunker retorna 0 chunks | Trata como `removePost(slug)` | `200 { revalidated: true, indexed: true, chunks: 0 }` |
| Slug não existe mais no Drive | `rag.removePost(slug)` | `200 { revalidated: true, removed: true }` |

**Por que 200 mesmo com erro de indexação?** Revalidate JÁ funcionou — usuário não deve achar que publicação falhou. RAG é "bônus" que pode ficar pra próxima tentativa. Erro vai no log + JSON da resposta.

### C) Falhas no endpoint admin (blog-reindex.ts)

Verbose, agregado:

| Falha | Tratamento |
|---|---|
| Token errado | `401`, sem detalhes |
| Drive list falha | `500 { error: "drive list failed" }` |
| 1 post falha individualmente | continua os outros, agrega erros no fim |
| Resposta final | `200 { total: 12, indexed: 11, failed: 1, errors: [{ slug, error }] }` |

Padrão "per-file try/catch + agregação" — já estabelecido em `blog-rss.ts`, `sitemap.ts`, `chat.ts:getPostsForPrompt`.

### D) Falhas silenciosas a prevenir ativamente

| Risco | Mitigação |
|---|---|
| Empty-string cache poisoning (mesmo bug do `getPostsForPrompt`) | `vector-store` nunca cacheia `{chunks:[]}` se a leitura falhou — apenas se for resultado legítimo de Blob vazio. |
| Dois requests concorrentes reindexando o mesmo slug | Aceitar: replace é idempotente por slug. Não vale o custo de um lock. |
| Drift de modelo (Gemini muda `text-embedding-004` silenciosamente) | `meta.json` registra `modelVersion`. Se na consulta o nome muda, loga warning + força reindex no próximo revalidate. |
| Custo descontrolado de embeddings | Hard cap no batch (`embedBatch` rejeita arrays > 100). Loga warning se post gera >50 chunks. |
| RAG injeta conteúdo sensível/draft | Indexação JÁ pula `meta.draft === true`. Belt-and-suspenders: `searchSimilar` opcionalmente filtra `slug` contra lista pública. |

### E) Observabilidade

Logs estruturados (Netlify Functions logs, sem dashboard novo):

- `rag.indexPost: slug=X chunks=N elapsedMs=M`
- `rag.retrieveRelevantChunks: query="..." hits=N topScore=0.XX elapsedMs=M`
- `rag.retrieveRelevantChunks: degraded reason=<embeddings_failed|blob_read_failed|timeout>`
- `vectorStore.loadIndex: cold=true|false sizeKB=N chunksTotal=N`

## Testing

### A) Unit tests (vitest)

| Arquivo | Cobertura |
|---|---|
| `netlify/functions/_lib/__tests__/chunker.test.ts` | Texto curto = 1 chunk sem overlap; texto longo = N chunks com overlap correto; preserva `headingPath`; body vazio = `[]`; NÃO quebra dentro de code blocks; trata bullets como parágrafos atômicos. |
| `netlify/functions/_lib/__tests__/vector-store.test.ts` | `searchSimilar` ordem desc; filtra threshold; respeita `maxPerPost`; `replacePostChunks` remove antigos do slug antes; `removePost` só remove o slug; cosine matemática (idêntico=1.0, ortogonal=0.0, oposto=-1.0); dim divergente é ignorada; `loadIndex` Blob null = `{chunks:[]}`; JSON corrompido = `{chunks:[]}` + log; cache em mem evita 2ª read. |
| `netlify/functions/_lib/__tests__/rag.test.ts` | `indexPost`: chunks gerados, embed mocked, store called; body vazio = `removePost`; `retrieveRelevantChunks` formato output; sem hits = `""`; embed falha = `""` (não throw); store falha = `""` (não throw). |

**Mocks**: `embeddings.ts` mockado com vetores determinísticos. `@netlify/blobs` mockado com Map em memória (replicar padrão do projeto se existir, ou criar simples).

### B) NÃO escrever

- E2E contra Gemini real (caro, flaky)
- Performance benchmarks (otimização prematura)
- Testes do `chat.ts` em si (escopo deliberadamente fora)

### C) Smoke test manual pós-deploy

1. **Bootstrap**: `POST /api/blog/reindex` com token → `{ indexed: N }`. Conferir `meta.json` + `posts-index.json` no Blobs panel.
2. **Pergunta com RAG**: chatbot recebe "o que você fala sobre Drive como CMS?" → cita trecho específico, não só link.
3. **Pergunta off-topic**: "qual seu jogo favorito?" → responde do SYSTEM_PROMPT, sem trecho irrelevante.
4. **Indexação on-publish**: editar post no Drive, bater `/api/blog/revalidate?slug=...`, perguntar sobre o texto novo → reflete novo.
5. **Degradação graciosa**: renomear `posts-index.json` no Blobs → chat continua respondendo sem RAG → restaurar.
6. **Latência**: medir resposta antes/depois. Aceitável: +100-400ms. Investigar se >800ms.
7. **Custo**: após 1 dia em prod, conferir Gemini console. Sanity check: sem rate limit.

### D) Critério qualitativo (5 perguntas plantadas)

| # | Pergunta | Expectativa |
|---|---|---|
| 1 | "Por que você fez o blog com Drive em vez de um CMS?" | Cita trecho específico do "porquê" |
| 2 | "Como funciona a tradução automática?" | Cita trecho sobre Gemini + cache |
| 3 | "Você tem post sobre VR?" (sem ter hoje) | Responde "ainda não" ou adjacentes; NÃO inventa |
| 4 | "O que é o MuseuVR?" (info no SYSTEM_PROMPT, não no blog) | Responde do SYSTEM_PROMPT — RAG não polui |
| 5 | "olá" | Saudação curta — RAG retorna `""` |

4 de 5 = aprovado. 2-3 falhas = tunar threshold/k. 4-5 falhas = revisitar chunking ou modelo.

### E) CI

- `npm run test:run` deve passar (com os novos testes)
- `npm run build` deve passar
- Sem mudança no pipeline CI

### F) Rollback

1. **Quick disable**: comentar `ragContext` em `chat.ts` e push. ~2min.
2. **Reindex limpo**: `POST /api/blog/reindex`. Útil se índice corrompeu.
3. **Tune threshold**: subir de 0.6 → 0.7 em `rag.ts`. Menos hits, mais precisos.

## Documentation

Único arquivo tocado: `docs/blog-setup.md`. Nova seção ao final, "RAG no chatbot", contendo:

1. **O que é** — 1 parágrafo explicando RAG sobre os posts.
2. **Como funciona** — 1 parágrafo de fluxo resumido.
3. **Bootstrap inicial** — comando curl pra rodar 1x.
4. **Quando reindexar manualmente** — automático via revalidate; manual como botão de pânico.
5. **Custo** — embeddings, storage; tudo dentro do free tier.
6. **Como verificar se está funcionando** — Blobs panel, pergunta de teste, logs.
7. **Troubleshooting** — tabela sintoma → diagnóstico → fix.
8. **Limitações conhecidas** — indexação síncrona; drafts não indexados; cache em mem pode ficar ~1min defasado.

Nada de README novo, nada de changelog. Spec doc (este arquivo) e setup doc cobrem.

## Open Questions / Decisões deixadas pra implementação

| Tema | Pergunta | Direção sugerida |
|---|---|---|
| Mapping slug → fileId | `blog-revalidate.ts` precisa achar o file no Drive a partir do slug. Hoje a lista de posts faz isso linearmente. Mantém? | Sim — reuse linear scan. Pequeno overhead, sem state extra. |
| Mock de `@netlify/blobs` em teste | Existe padrão de mock estabelecido no repo? | Investigar nos `_lib` tests existentes; se não, criar utilitário simples baseado em Map. |
| Concorrência em `replacePostChunks` | Dois revalidates simultâneos podem se sobrescrever | Aceitar (estado final é determinístico por slug). Documentar no código. |
| Estimativa de tokens no chunker | Gemini não expõe tokenizer; estimar com heurística (4 chars ≈ 1 token em pt-BR) | Aceitar erro de ±20% — não afeta qualidade material. |

## Implementation Effort

~4-6h focadas, padrão subagent-driven development (mesmo dos batches da Phase 5). Provavelmente 1 implementer + 2 reviewers por unidade + final batch reviewer. Branch + PR (ou direct-merge a critério do owner, igual Batches 3 e 4).

Quebra preliminar (writing-plans vai detalhar):

1. `_lib/chunker.ts` + testes
2. `_lib/embeddings.ts` + testes
3. `_lib/vector-store.ts` + testes
4. `_lib/rag.ts` + testes
5. `blog-reindex.ts` endpoint + redirect
6. Modificações em `blog-revalidate.ts`
7. Modificações em `chat.ts`
8. Update em `docs/blog-setup.md`
9. Bootstrap em prod + smoke test
