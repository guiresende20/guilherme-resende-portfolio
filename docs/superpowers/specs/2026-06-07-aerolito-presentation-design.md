# Aerolito Presentation — Spec

**Data:** 2026-06-07
**Origem:** Owner assumiu novo cargo de Head de Pesquisa na Aeroli.to. Quer uma apresentação personalizada do RAG acessada via `/aerolito` para uso one-shot com o time da empresa. A apresentação tem 3 partes integradas: (1) animação HTML de abertura, (2) chat com voz da IA personalizada, (3) coleta colaborativa de 5 expectativas que viram atribuições da nova posição na trajetória.

## Objetivo

Criar uma experiência one-shot em `/aerolito` (rota escondida, `noindex`) que:

1. Recebe o colega Aeroli.to com uma animação HTML (referência será fornecida)
2. Apresenta uma versão personalizada do RAG do Guilherme (clone do system prompt + blocos novos sobre Aerolito + visão como Head de Pesquisa)
3. A IA fala (Gemini Live API) com typing sincronizado em toda resposta
4. Coleta 5 expectativas via toggle opcional "Contribuir como colega Aerolito"
5. Salva e auto-indexa as respostas no RAG (vector store isolado)
6. Permite ao owner consolidar as respostas em bullets via painel admin e publicar como atribuições na trajetória pública
7. Pode ser totalmente resetado (com backup) para teste antes do uso real

## Princípios de arquitetura

- **Isolamento total:** todo código novo prefixado `aerolito-` / `aerolito_`. Zero modificação no `ChatWidget`, `chat.ts`, `system-prompt.ts` ou no RAG existente do blog/drive
- **Reuso onde faz sentido:** `retrieveRelevantChunks`, `embeddings.ts`, design system (cores, fontes), infra do Gemini Live, padrão de admin com token via URL (igual `blog-reindex`)
- **One-shot:** preferência por simplicidade sobre robustez de longo prazo (apresentação acontece uma vez)
- **Fácil de remover depois:** deletar arquivos `aerolito-*` + linha da rota = portfólio volta ao estado anterior

## Decisões já tomadas (todas validadas com owner)

| # | Decisão |
|---|---|
| 1 | Rota lazy `/aerolito`, escondida do menu, `Disallow: /aerolito` no robots.txt + meta `noindex,nofollow` |
| 2 | Sequência vertical: animação HTML → chat embedded full-width |
| 3 | Input do colega é só texto (sem mic) |
| 4 | Voz da IA via Gemini Live em **toda** resposta (welcome, normal, entrevista) |
| 5 | Typing animado sincronizado com fala via `outputTranscription` |
| 6 | System prompt clone + 2 blocos novos: `## CONTEXTO AEROLITO` e `## HEAD DE PESQUISA — VISÃO` (com TODOs para owner preencher) |
| 7 | Idioma do `/aerolito`: só português (sem detecção en/es) |
| 8 | Toggle "🤝 Contribuir como colega Aerolito" entra em modo entrevista; padrão é modo normal |
| 9 | 5 perguntas fixas (lista abaixo), anônimas, sem identificação |
| 10 | Respostas salvas no Supabase + auto-indexadas em vector store isolado (`rag/aerolito_responses/*`) |
| 11 | Admin via `/aerolito/admin?token=XXX` com auth via `Authorization: Bearer` (404 se inválido) |
| 12 | Consolidação via IA: botão "Gerar proposta de bullets" → editor inline → publish |
| 13 | Card "Head de Pesquisa" na trajetória oculto até publicação; aparece em todas as 3 locales com bullets em PT + disclaimer em en/es |
| 14 | Reset exporta backup JSON antes de deletar (Supabase + Blobs `rag/aerolito_responses/*` + `aerolito/published-bullets.json`) |
| 15 | Card metadata: role="Head de Pesquisa", org="Aeroli.to", period="JUN 2026 — presente", loc="Porto Alegre, RS", type="Profissional" |

## As 5 perguntas (fixas, hardcoded no frontend)

1. Que características vocês acham mais importantes que eu desenvolva / fortaleça na minha função aqui na Aeroli.to?
2. Que tipo de apoio vocês esperam de mim quando estiverem desenvolvendo projetos com clientes?
3. Posso trazer lanches comunitários? Se sim, quais?
4. Como vocês imaginam que eu posso contribuir (métrica de êxito) nos 6 primeiros meses?
5. O que vocês não querem que eu faça? (anti-objetivos)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React/Vite)                                                │
│                                                                      │
│  /aerolito                          /  (Index, blog, etc.)           │
│  ├── AerolitoPage.tsx               ├── ChatWidget.tsx  (inalterado) │
│  │   ├── AerolitoIntro (animação)   ├── Experience.tsx  (estendido)  │
│  │   └── AerolitoChatWidget         │   └── lê published-bullets     │
│  │       ├── modo normal (RAG)      │       (esconde card sem dados) │
│  │       └── modo entrevista (5Qs)  │                                │
│  └── /aerolito/admin?token=XXX                                       │
│      └── AerolitoAdmin (list + publish + reset)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ NETLIFY FUNCTIONS                                                    │
│                                                                      │
│  aerolito-chat.ts        ── emite token Live + envia system prompt   │
│  aerolito-submit.ts      ── salva 1 resposta + indexa no vector st.  │
│  aerolito-admin.ts       ── list / consolidate / publish / reset     │
│  aerolito-bullets.ts     ── retorna bullets publicados (público)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STORAGE                                                              │
│                                                                      │
│  Supabase                       Netlify Blobs                        │
│  └── aerolito_responses         ├── rag/aerolito_responses/<id>      │
│      (durable, audit log)       │   (vector chunks p/ retrieval)     │
│                                 ├── aerolito/published-bullets.json  │
│                                 │   (atribuições confirmadas)        │
│                                 └── aerolito/backups/<ts>.json       │
│                                     (backups do reset)               │
└─────────────────────────────────────────────────────────────────────┘
```

## Componentes do frontend

### Roteamento — `src/App.tsx`

Adicionar duas rotas lazy:

```tsx
const AerolitoPage = lazy(() => import("./pages/AerolitoPage"));
const AerolitoAdmin = lazy(() => import("./pages/AerolitoAdmin"));

// dentro de <Routes>:
<Route path="/aerolito" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><AerolitoPage /></Suspense>} />
<Route path="/aerolito/admin" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><AerolitoAdmin /></Suspense>} />
```

### `src/pages/AerolitoPage.tsx`

Layout vertical:
- `<AerolitoIntro />` no topo (full viewport)
- CTA "↓ Conhecer melhor (chat com IA)" ao final da animação faz smooth scroll
- `<AerolitoChatWidget />` na seção seguinte (embedded full-width, height fixo ~640px)
- `<head>` recebe `<meta name="robots" content="noindex,nofollow" />` via Helmet ou efeito direto no DOM
- Sem `<Navbar>` global (apresentação clean, sem distrações)
- Sem `<Footer>` global
- Sem `ChatWidget` floating (esse é só do portfolio)

### `src/components/aerolito/AerolitoIntro.tsx`

- Wrapper full-viewport com background do design system (dark + grid sutil)
- Slot para a referência HTML que o owner fornecerá depois (componente fica genérico no início — placeholder com título e CTA enquanto referência não chega)
- Detecção de fim da animação: timer fixo configurável OU evento custom `aerolitoIntroDone` OU scroll do usuário (decidir quando vier a referência — TODO no componente)
- CTA "↓ Conhecer melhor" anima após o fim da intro e leva (smooth scroll) ao chat

### `src/components/aerolito/AerolitoChatWidget.tsx`

Clone adaptado do `ChatWidget.tsx`:

- **Não floating**: embedded na página, full-width do container, `h-[640px]` (ou viewport menos a animação)
- **Welcome message customizada**: "Sou o RAG do Gui, agora Head de Pesquisa na Aeroli.to. Pergunta o que quiser — ou clique abaixo pra deixar a sua expectativa sobre o que eu deveria entregar."
- **Sugestões iniciais (3 botões)**: "Quem é o Gui?", "O que é Head de Pesquisa?", "Por que Aerolito?"
- **Toggle visível acima do input**: `🤝 Contribuir como colega Aerolito` (destaque neon)
- **Sem botão de mic** (input só texto)
- **Voz Gemini Live em toda resposta da IA pós-interação**: ao mandar pergunta, abre WebSocket Live, recebe audio + transcript, toca audio via AudioContext e digita texto char-by-char usando `outputTranscription` como fonte
- **Welcome message é exceção**: aparece como texto-only (sem voz) porque browsers bloqueiam autoplay de áudio antes da primeira interação do usuário. A primeira voz da IA toca depois que o colega: (a) clica uma sugestão, (b) envia uma pergunta, ou (c) clica o toggle de entrevista. Esses cliques contam como gesture de usuário e desbloqueiam o `AudioContext`
- Chama `/api/aerolito-chat` para obter token Live + system prompt completo (RAG já incluído no server-side)

### `src/components/aerolito/AerolitoInterview.tsx`

Componente / hook que controla o modo entrevista:

- Estado: `interviewStep: 0..5 | "done"` + `sessionId: UUID v4` (gerado na primeira ativação)
- Ao clicar toggle: cria `sessionId`, seta `interviewStep=1`, envia primeira pergunta via Live API como `clientContent` com role=`model` + `turnComplete=true` (isso faz a Live falar o texto fixo sem alucinação)
- Espera input do colega
- Ao enviar resposta: POST `/api/aerolito-submit` (paralelo, não bloqueia UI) + pede "acolhida curta" (max 80 chars) à IA via turn livre + avança para próxima pergunta
- Após pergunta 5: IA fala "Obrigado. Suas respostas vão me ajudar a desenhar como atuar nessa nova função. Quer continuar a conversa?" → volta para modo normal (toggle some)
- Persistência de rascunho: cada resposta enviada também vai pra `localStorage['aerolito_draft_<sessionId>']` para retry em caso de network drop

### `src/pages/AerolitoAdmin.tsx`

Lê `?token=XXX` da query string. Se ausente → renderiza "Não encontrado". Toda request à `aerolito-admin.ts` passa `Authorization: Bearer <token>`.

Três seções stacked:

1. **Respostas recebidas** — lista N sessões com 5 respostas cada, datas, indicadores `indexed`/`published`
2. **Consolidação** — botão "Gerar proposta de bullets com IA" → preenche textarea (1 bullet por linha) → preview do card como vai aparecer na trajetória → botão "Publicar na trajetória" (modal de confirmação)
3. **Reset** — botão "Exportar backup" baixa JSON; botão "Resetar tudo" exige digitar `RESETAR` + clique para confirmar

## System prompt — `src/lib/system-prompt-aerolito.ts`

Clone literal de `src/lib/system-prompt.ts` com as seguintes mudanças:

1. **Adicionar blocos após `## DADOS FACTUAIS`:**

```
## CONTEXTO AEROLITO

[TODO owner preencher antes de deploy:]
- Nome completo da empresa
- O que faz (área de atuação, produtos, clientes)
- Missão / valores
- Time atual (tamanho, áreas)
- Site / LinkedIn

## HEAD DE PESQUISA — VISÃO

[TODO owner preencher antes de deploy:]
- Como pretendo atuar nessa posição
- Linhas de pesquisa que quero abrir
- Metodologias que vou aplicar
- Como vou conectar pesquisa ↔ produto ↔ time
- Primeiros 90 dias (se quiser explicitar)
```

2. **Regra adicional** (em `## REGRAS DE COMPORTAMENTO Estritas`):
   - "Quando perguntarem sobre Aerolito ou sobre meu novo papel, baseie-se nos blocos CONTEXTO AEROLITO e HEAD DE PESQUISA — VISÃO."

3. **Idioma simplificado**: substituir regra de detecção pt/en/es por "Responda sempre em português (PT-BR)."

4. **Limite de caracteres**: `450` → `300` (voz é mais cansativa de ouvir que ler).

## Backend — funções Netlify

### `netlify/functions/aerolito-chat.ts`

`POST` recebe `{ message?, history? }`. Não chama Gemini diretamente; emite token Live efêmero e devolve system prompt completo (já enriquecido com RAG).

```
POST /api/aerolito-chat
Body: { message?: string }

Response:
  200 { token: string, fullSystemPrompt: string, expiresIn: number }
  500 { error: "..." }
```

Implementação:
1. Reuso de `getRagContextSafe(message ?? "")` para anexar contexto relevante
2. Reuso da lógica de token efêmero de `live-token.ts` (mesmo padrão)
3. `fullSystemPrompt = SYSTEM_PROMPT_AEROLITO + getPostsForPrompt() + ragContext`
4. Sem log de mensagem aqui (acontece no `log-voice.ts` existente quando Live API completa turn — reusar)

### `netlify/functions/aerolito-submit.ts`

```
POST /api/aerolito-submit
Body: { session_id, question_idx, question_text, answer_text }

Response:
  200 { ok: true }
  400 { error: "invalid" }
  429 { error: "rate limit" }
  500 { error: "..." }
```

Pipeline:
1. Validar payload: `session_id` é UUID, `question_idx` ∈ [1,5], `question_text.length ≤ 300`, `answer_text.length ≤ 2000`
2. Rate limit por IP: 10 req/min, 30 req/hora (reusar `_lib/ratelimit.ts`)
3. Hash do IP com salt em env var `AEROLITO_IP_HASH_SALT` (anti-spam sem PII)
4. INSERT no Supabase com `indexed=false`, `published=false`
5. Async (sem await): chama `indexAerolitoResponse(id, question_text, answer_text)`:
   - Gera embedding (reuso `embeddings.ts`)
   - Salva blob `rag/aerolito_responses/<id>.json` com `{ embedding, text: "P: ${question_text}\nR: ${answer_text}", metadata: { question_idx, created_at } }`
   - UPDATE `indexed=true` no Supabase
6. Retorna 200 sem aguardar indexação

### `netlify/functions/aerolito-admin.ts`

Uma função, vários endpoints via `?action=`. Auth: `Authorization: Bearer ${AEROLITO_ADMIN_TOKEN}`. Se falhar → 404 (sem revelar existência).

| Action | Method | Comportamento |
|---|---|---|
| `list` | GET | SELECT no Supabase, agrupa por `session_id`, retorna `{ sessions: [...], totalSessions, totalResponses }` |
| `consolidate` | POST | Chama Gemini com prompt definido abaixo. Retorna `{ bullets: string[] }` |
| `publish` | POST `{ bullets }` | Valida (4-6 itens, cada `length ≤ 200` — limite acima do gerado pela IA pra dar margem ao owner editar se quiser), salva blob `aerolito/published-bullets.json` com `{ bullets, published_at }`, UPDATE `published=true` em todas as rows |
| `reset` | POST | Exporta backup → salva em `aerolito/backups/<iso-ts>.json` E retorna no response. Depois: DELETE all rows do Supabase + DELETE blobs `rag/aerolito_responses/*` + DELETE blob `aerolito/published-bullets.json` |

**Prompt da consolidação:**

```
Você é um assistente que consolida feedback anônimo de um time sobre o que esperam de um novo Head de Pesquisa.

Recebeu N respostas para 5 perguntas distintas. Sua tarefa: extrair as expectativas mais frequentes e relevantes e expressá-las como 4-6 bullets concisos.

REGRAS:
- Cada bullet: máximo 120 caracteres
- Tom: ação concreta na primeira pessoa do Guilherme (ex.: "Liderar pesquisa qualitativa com clientes em todas as fases do produto")
- NÃO usar buzzwords ou linguagem de influencer
- NÃO inventar — só consolide o que aparece nas respostas
- Priorize temas que aparecem em múltiplas sessões

Retorne JSON: { "bullets": ["...", "...", ...] }

Respostas:
<dump das respostas agrupadas por session>
```

### `netlify/functions/aerolito-bullets.ts`

```
GET /api/aerolito-bullets

Response:
  200 { bullets: string[], published_at } se publicado
  200 { bullets: null } se não publicado
```

Sem auth. Cache CDN `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

## Mudança em `src/components/Experience.tsx`

Mudança mínima e aditiva (preserva comportamento atual quando não há bullets publicados):

```tsx
const [aerolitoBullets, setAerolitoBullets] = useState<string[] | null>(null);

useEffect(() => {
  fetch('/api/aerolito-bullets')
    .then(r => r.json())
    .then(data => setAerolitoBullets(data.bullets))
    .catch(() => setAerolitoBullets(null));
}, []);

const jobs = t('experience.jobs', { returnObjects: true }) as Job[];
const allJobs: Job[] = aerolitoBullets
  ? [
      {
        role: t('experience.aerolito.role'),
        type: t('experience.aerolito.type'),
        org: "Aeroli.to",
        period: t('experience.aerolito.period'),
        loc: t('experience.aerolito.loc'),
        items: aerolitoBullets,
      },
      ...jobs,
    ]
  : jobs;
```

E renderiza `allJobs` em vez de `jobs`. Para en/es, adicionar um pequeno disclaimer abaixo dos bullets do card Aerolito: "(team feedback in Portuguese)" / "(comentarios del equipo en portugués)".

## Storage — schemas

### Supabase

```sql
create table aerolito_responses (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  session_id    uuid        not null,
  question_idx  smallint    not null,
  question_text text        not null,
  answer_text   text        not null,
  ip_hash       text,
  indexed       boolean     not null    default false,
  published     boolean     not null    default false,
  constraint question_idx_range check (question_idx between 1 and 5)
);

create index aerolito_responses_session_idx on aerolito_responses (session_id);
create index aerolito_responses_indexed_idx on aerolito_responses (indexed);
```

### Netlify Blobs

| Key pattern | Conteúdo |
|---|---|
| `rag/aerolito_responses/<uuid>.json` | `{ embedding: number[], text: string, metadata: { question_idx, created_at } }` |
| `aerolito/published-bullets.json` | `{ bullets: string[], published_at: ISO timestamp }` |
| `aerolito/backups/<iso-ts>.json` | Backup completo gerado no reset |

## i18n

### Novas chaves em `src/locales/{pt,en,es}.json`

```json
"experience": {
  "aerolito": {
    "role": "...",            // pt: "Head de Pesquisa" / en: "Head of Research" / es: "Head de Investigación"
    "type": "...",            // pt: "Profissional" / en: "Professional" / es: "Profesional"
    "period": "JUN 2026 — presente",  // mesmo em todas
    "loc": "Porto Alegre, RS",         // mesmo em todas
    "bullets_disclaimer": "..."        // só em en/es: "(team feedback in Portuguese)"
  }
}
```

`/aerolito` em si é só PT — sem chaves novas.

## Variáveis de ambiente

Adicionar em `.env.example`:

```
AEROLITO_ADMIN_TOKEN=         # token de admin (gerar com `openssl rand -hex 32`)
AEROLITO_IP_HASH_SALT=        # salt para hash de IP (gerar com `openssl rand -hex 16`)
```

Setar mesmos valores em Netlify env (UI ou via `netlify env:set`).

## Error handling

| Cenário | Comportamento |
|---|---|
| Token Live API falha | Mensagem "Voz indisponível, mas você pode continuar lendo." Chat funciona em modo texto-only (sem audio, sem typing sync — resposta de uma vez) |
| WebSocket cai no meio do turn | Auto-reconnect 1x; se falhar → "Conexão instável, tente novamente" |
| Submit de resposta falha (rede) | Rascunho em `localStorage`, retry automático em 3s, indicador "Salvando…" → "Salvo ✓" / "Erro ao salvar" |
| Animação HTML quebra no render | Try/catch + fallback: título estático + CTA direto pro chat |
| Supabase down em `aerolito-submit` | 500, frontend faz retry |
| Embedding/indexing falha após INSERT | Resposta salva com `indexed=false`; admin tem botão "Reindexar não-indexadas" |
| Blob `published-bullets.json` corrompido | `aerolito-bullets.ts` retorna `null`; card permanece oculto; loga erro |
| Rate limit excedido | 429 com `Retry-After`; frontend mostra contagem regressiva |
| Admin token inválido / ausente | 404 em qualquer rota admin (sem revelar existência) |
| RAG retrieval atrasa | `getRagContextSafe` já tem timeout de 1500ms (reuso) |

## Testing

Owner não faz testes manuais — toda validação via vitest + smokes que Claude executa.

### Unit tests (vitest)

| Arquivo | Coverage |
|---|---|
| `src/lib/__tests__/system-prompt-aerolito.test.ts` | Snapshot + presença dos blocos `## CONTEXTO AEROLITO` e `## HEAD DE PESQUISA — VISÃO` + regra de idioma único |
| `netlify/functions/__tests__/aerolito-submit.test.ts` | Validação de payload, rate limit, hash de IP, retorno 400 em payloads inválidos |
| `netlify/functions/__tests__/aerolito-admin.test.ts` | Auth (token correto/errado/ausente), validação de bullets em publish, idempotência do reset |
| `src/components/aerolito/__tests__/AerolitoChatWidget.test.tsx` | Welcome message correta, 3 sugestões corretas, toggle aparece, fallback texto-only quando Live falha |
| `src/components/aerolito/__tests__/AerolitoInterview.test.ts` | Avança de step a step, encerra ao 5, envia POST a cada resposta, gera `sessionId` único |
| `src/components/__tests__/Experience.test.tsx` | Card Aerolito **não aparece** quando bullets=`null`; **aparece como primeiro** quando bullets têm conteúdo |

### Smoke programático (`scripts/smoke-aerolito.ts`)

Roda contra deploy preview do Netlify:

1. GET `/aerolito` → 200, HTML contém `<title>` esperado + meta `noindex`
2. GET `/aerolito/admin` (sem token) → painel mostra "Não encontrado"
3. GET `/api/aerolito-bullets` → 200 com `{ bullets: null }` (estado inicial limpo)
4. POST `/api/aerolito-submit` payload inválido → 400
5. POST `/api/aerolito-submit` payload válido → 200 (e SELECT no Supabase confirma row criada)
6. GET `/api/aerolito-admin?action=list` com token → 200 com sessão recém-inserida
7. POST `/api/aerolito-admin?action=reset` com token → 200 com backup no response
8. GET `/api/aerolito-bullets` → 200 com `{ bullets: null }` (reset funcionou)

### Playwright smoke (`tests/e2e/aerolito.spec.ts`)

- Navega para `/aerolito` → animação carrega → CTA visível
- Clica CTA → chat aparece, welcome message renderizada
- Clica toggle "Contribuir como colega Aerolito" → primeira pergunta aparece
- Digita resposta → próxima pergunta avança (mock do WebSocket Live API)
- Verifica que `aerolito-submit` foi chamado 1x

### Regressões

- `npm run test:run` (vitest) — toda suite atual deve continuar verde
- Verificar que `Experience` continua renderizando os 6 jobs existentes quando bullets=`null`

## Build / performance

- `/aerolito` lazy-loaded via Suspense → não infla bundle inicial do portfólio
- Animação HTML provavelmente pesada → inline crítico + defer do resto
- Voz Gemini Live → reuso da infra existente em `src/lib/gemini-live.ts`, zero dependências novas
- Cache CDN agressivo em `aerolito-bullets.ts` (60s + SWR 300s)

## Itens fora de escopo (yagni)

- **Painel admin não tem analytics** (quantas pessoas visitaram, taxa de conclusão das 5 perguntas) — apresentação é one-shot, não vale a pena
- **Sem suporte a edição de respostas individuais pelo admin** — só visualização + reset
- **Sem versionamento de bullets publicados** — publicação substitui o blob atual
- **Sem internacionalização da página `/aerolito`** — só PT
- **Sem integração com LinkedIn, e-mail ou outros canais** — convite distribuído pelo owner manualmente
- **Sem mic no chat** — só input texto

## Dependências externas validadas

- `@google/generative-ai` (já no projeto) — para embeddings + consolidação
- `@supabase/supabase-js` (já no projeto) — tabela nova
- `@netlify/blobs` (já no projeto) — vector store + bullets + backups
- Gemini Live API via WebSocket (já em uso via `gemini-live.ts`)

## Próximos passos (após aprovação deste spec)

1. Owner revisa spec e aprova / pede ajustes
2. Owner fornece referência HTML da animação (pode ser depois — design é genérico até lá)
3. Owner preenche blocos `## CONTEXTO AEROLITO` e `## HEAD DE PESQUISA — VISÃO` (pode ser durante a implementação)
4. Claude invoca skill `writing-plans` para gerar plano de execução
5. Implementação em fases (rota → chat com Live → 5 perguntas → admin → trajetória → animação real)
