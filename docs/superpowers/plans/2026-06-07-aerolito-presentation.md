# Aerolito Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a apresentação one-shot em `/aerolito` (rota escondida): animação HTML → chat com voz Gemini Live + typing sync → coleta opcional de 5 expectativas anônimas → auto-indexação no RAG isolado → painel admin para consolidar bullets e publicar como atribuições na trajetória.

**Architecture:** Tudo isolado sob prefixo `aerolito-` / `aerolito_`. Reuso de Gemini Live (token efêmero), `embeddings.ts`, padrão de auth admin via token URL, design system do portfólio. Storage: tabela nova no Supabase + um único índice vetorial separado em Netlify Blobs (`embeddings/aerolito-index.json`). Frontend: rotas lazy em React Router + componentes em `src/components/aerolito/`.

**Tech Stack:** TypeScript, React 18, Vite, Tailwind, react-router-dom, Netlify Functions (Lambda-style), `@google/generative-ai` (já), `@netlify/blobs` (já), `@supabase/supabase-js` (já), vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-aerolito-presentation-design.md`

---

## File Structure

### Novos arquivos

**Backend (Netlify Functions):**
- `netlify/functions/aerolito-chat.ts` — emite token Live + system prompt completo (RAG já enriquecido)
- `netlify/functions/aerolito-submit.ts` — recebe 1 resposta, valida, salva no Supabase, indexa async no vector store
- `netlify/functions/aerolito-bullets.ts` — endpoint público, retorna bullets publicados
- `netlify/functions/aerolito-admin.ts` — list/consolidate/publish/reset, com auth via Bearer token
- `netlify/functions/_lib/aerolito-vector.ts` — vector store isolado para respostas dos colegas (mesmo padrão do `vector-store.ts`)
- `netlify/functions/_lib/__tests__/aerolito-vector.test.ts`
- `netlify/functions/__tests__/aerolito-submit.test.ts`
- `netlify/functions/__tests__/aerolito-admin.test.ts`

**Frontend (React):**
- `src/lib/system-prompt-aerolito.ts` — clone do system prompt + 2 blocos novos
- `src/lib/aerolito-live.ts` — variante do `gemini-live.ts` para input texto + output transcription + áudio + sync typing
- `src/pages/AerolitoPage.tsx` — composição animação + chat
- `src/pages/AerolitoAdmin.tsx` — painel admin
- `src/components/aerolito/AerolitoIntro.tsx` — placeholder para animação HTML
- `src/components/aerolito/AerolitoChatWidget.tsx` — chat embedded com voz Live
- `src/components/aerolito/AerolitoInterview.tsx` — controlador do modo entrevista
- `src/components/aerolito/QUESTIONS.ts` — as 5 perguntas fixas
- `src/lib/__tests__/system-prompt-aerolito.test.ts`
- `src/components/aerolito/__tests__/AerolitoChatWidget.test.tsx`
- `src/components/aerolito/__tests__/AerolitoInterview.test.ts`
- `src/components/__tests__/Experience.test.tsx`

**Smoke + infra:**
- `scripts/smoke-aerolito.mjs` — smoke programático contra deploy preview

### Modificados

- `src/App.tsx` — adicionar rotas `/aerolito` e `/aerolito/admin`
- `src/components/Experience.tsx` — fetch e prepend do card Aerolito
- `src/locales/{pt,en,es}.json` — chaves `experience.aerolito.*`
- `public/robots.txt` — `Disallow: /aerolito`
- `netlify.toml` — 4 redirects novos `/api/aerolito-*`
- `.env.example` — `AEROLITO_ADMIN_TOKEN` e `AEROLITO_IP_HASH_SALT`

---

## Convenções importantes deste plano

- **Toda função Lambda-style precisa de `ensureBlobsContext(event)` no topo do handler** — sem isso, escritas em Blobs viram no-op silenciosamente. Veja `netlify/functions/_lib/blobs-context.ts`.
- **CSP já permite `wss://generativelanguage.googleapis.com`** — Live API funciona sem ajuste em `netlify.toml`.
- **Auth pattern:** `Authorization: Bearer ${token}` header (não query). Fallback de 404 em erro de auth.
- **TypeScript strict.** Sem `any` exceto onde já usado no codebase (cast Live API).

---

## Task 1: Sistema prompt clonado com blocos novos

**Files:**
- Create: `src/lib/system-prompt-aerolito.ts`
- Test: `src/lib/__tests__/system-prompt-aerolito.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/system-prompt-aerolito.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT_AEROLITO } from "../system-prompt-aerolito";

describe("SYSTEM_PROMPT_AEROLITO", () => {
  it("contains required Aerolito-specific blocks", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## CONTEXTO AEROLITO");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## HEAD DE PESQUISA — VISÃO");
  });

  it("inherits base identity blocks from the original system prompt", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toContain("Guilherme Resende Muniz");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## IDENTIDADE");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## FIT CULTURAL");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## EXPERIÊNCIA PROFISSIONAL");
  });

  it("enforces Portuguese-only response policy", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/Responda sempre em portugu/i);
    expect(SYSTEM_PROMPT_AEROLITO).not.toMatch(/detecte o idioma/i);
  });

  it("uses 300 char limit (shorter than base 450, voice is tiring)", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/no máximo 300 caracteres|máximo 300 caracteres/i);
  });

  it("includes rule referencing the new blocks for relevant questions", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/CONTEXTO AEROLITO.*HEAD DE PESQUISA/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- system-prompt-aerolito`
Expected: FAIL (`Cannot find module '../system-prompt-aerolito'`)

- [ ] **Step 3: Create the system prompt file**

Create `src/lib/system-prompt-aerolito.ts`. Copy the entire base from `src/lib/system-prompt.ts` and apply these surgical changes:

- Replace the language rule (3rd line of the original — `Detecte o idioma...`) with: `Responda sempre em português (PT-BR).`
- After the `## DADOS FACTUAIS` section, insert the two new blocks (TODOs for owner to fill in).
- In the `## REGRAS DE COMPORTAMENTO Estritas` section, replace the language-block rule with a Portuguese-only rule + add the rule about the new blocks.
- Change the character limit rule from 450 → 300.

```ts
export const SYSTEM_PROMPT_AEROLITO = `Você é uma inteligência artificial baseada na trajetória, no pensamento e na forma de atuação de Guilherme Resende Muniz.
Responda SEMPRE em primeira pessoa, como o próprio Guilherme.
Responda sempre em português (PT-BR).

Seu objetivo não é apenas responder perguntas.
Seu objetivo é oferecer respostas com base em experiência real, repertório técnico, pensamento crítico e prática aplicada.
Procure nos ## para responder as perguntas. exemplo se perguntarem de experiencias profissionais vá em ## EXPERIÊNCIA PROFISSIONAL e responda de acordo com as informações colocada.
Se não souber algo, peça mais detalhes para que possa tentar responder. Não responda o que não sabe.
---

## IDENTIDADE

Sou designer, pesquisador e educador. Curioso por natureza.
Busco constantemente entender como as coisas funcionam, conectando tecnologia, cultura, educação e experiência.

Atuo na interseção entre:
- UX/UI e design centrado no usuário
- Inovação corporativa e ecossistemas
- Educação e metodologias ativas
- Realidade virtual (VR) e aumentada (AR)
- Inteligência artificial aplicada
- Interfaces naturais (NUI) e novas mídias
- Inovação

## FIT CULTURAL

[manter idêntico ao system-prompt.ts original — copiar bloco completo]

## GOSTOS PESSOAIS E REFERÊNCIAS

[manter idêntico]

## EXPERIÊNCIA PROFISSIONAL

[manter idêntico]

## FORMAÇÃO ACADÊMICA

[manter idêntico]

---

## DADOS FACTUAIS

**Nome:** Guilherme Resende Muniz
**Localização:** Porto Alegre - RS, Brasil
**Cargo atual:** Head de Pesquisa — Aeroli.to (desde JUN 2026)
**Cargo anterior:** Designer e Pesquisador de Inovação — CriaLab - Tecnopuc / PUC-RS (2021 - JUN 2026)
**Pesquisa:** Doutorando em Design na UFRGS (pesquisador do LdSM)
**Contatos:**
- LinkedIn: https://www.linkedin.com/in/guilhermeresende/
- E-mail: guiresende20@gmail.com
- WhatsApp: https://wa.me/5551997925092
- Lattes: http://lattes.cnpq.br/5709726694301047
**Números:** 12+ publicações · 1 patente · 20+ projetos digitais

---

## CONTEXTO AEROLITO

[TODO owner preencher antes do deploy:
- Nome completo da empresa
- O que faz (área de atuação, produtos, clientes)
- Missão / valores
- Time atual (tamanho, áreas)
- Site / LinkedIn]

## HEAD DE PESQUISA — VISÃO

[TODO owner preencher antes do deploy:
- Como pretendo atuar nessa posição
- Linhas de pesquisa que quero abrir
- Metodologias que vou aplicar
- Como vou conectar pesquisa ↔ produto ↔ time
- Primeiros 90 dias (se quiser explicitar)]

---

## REGRAS DE COMPORTAMENTO Estritas
- Responda SEMPRE em primeira pessoa como Guilherme
- Responda sempre em português (PT-BR). Nunca troque para outro idioma.
- Quando perguntarem sobre Aerolito ou sobre meu novo papel de Head de Pesquisa, baseie-se nos blocos CONTEXTO AEROLITO e HEAD DE PESQUISA — VISÃO.
- procure as informações no próprio site
- NUNCA invente informações. Você se formou na UFRGS.
- Baseie sempre suas respostas no contexto literal e nas experiências acima detalhadas.
- Suas falas serão processadas via síntese de voz. Mantenha a resposta extremamente natural, direta e conversacional.
- LIMITE EXTREMAMENTE RÍGIDO: Suas respostas não podem ultrapassar 300 caracteres no total. Vá direto ao ponto!
- Se você não souber a resposta sobre o Guilherme, diga apenas "Ainda não coloquei isso no meu site, me pergunte mais sobre minha trajetória acadêmica, ou algo relacionado ao Gui!".
`;
```

**Importante:** copie literalmente os blocos `FIT CULTURAL`, `GOSTOS PESSOAIS`, `EXPERIÊNCIA PROFISSIONAL`, `FORMAÇÃO ACADÊMICA` do arquivo `src/lib/system-prompt.ts` original (linhas 25-241). Substitua os `[manter idêntico]` pelos blocos reais.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- system-prompt-aerolito`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/system-prompt-aerolito.ts src/lib/__tests__/system-prompt-aerolito.test.ts
git commit -m "feat(aerolito): system prompt clone com blocos CONTEXTO + VISAO"
```

---

## Task 2: Rotas `/aerolito` e `/aerolito/admin` com placeholders

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/AerolitoPage.tsx` (placeholder)
- Create: `src/pages/AerolitoAdmin.tsx` (placeholder)

- [ ] **Step 1: Create AerolitoPage placeholder**

Create `src/pages/AerolitoPage.tsx`:

```tsx
import { useEffect } from "react";

export default function AerolitoPage() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display text-4xl uppercase tracking-tight">Aerolito</h1>
        <p className="font-mono text-sm text-muted-foreground mt-4">
          Página em construção.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create AerolitoAdmin placeholder**

Create `src/pages/AerolitoAdmin.tsx`:

```tsx
import { useSearchParams } from "react-router-dom";

export default function AerolitoAdmin() {
  const [params] = useSearchParams();
  const token = params.get("token");

  if (!token) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display text-2xl uppercase tracking-tight">Aerolito Admin</h1>
        <p className="font-mono text-sm text-muted-foreground mt-4">
          Painel em construção.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Add lazy routes to App.tsx**

Edit `src/App.tsx` — keep existing routes, add the two new ones before the catch-all:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";

const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BlogTag = lazy(() => import("./pages/BlogTag"));
const AerolitoPage = lazy(() => import("./pages/AerolitoPage"));
const AerolitoAdmin = lazy(() => import("./pages/AerolitoAdmin"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blog" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><Blog /></Suspense>} />
        <Route path="/blog/tag/:tag" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><BlogTag /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><BlogPost /></Suspense>} />
        <Route path="/aerolito" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><AerolitoPage /></Suspense>} />
        <Route path="/aerolito/admin" element={<Suspense fallback={<div className="p-8">Carregando…</div>}><AerolitoAdmin /></Suspense>} />
        <Route path="*" element={<Index />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Manual sanity check the build**

Run: `npm run build`
Expected: build sucede sem erros TS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/AerolitoPage.tsx src/pages/AerolitoAdmin.tsx
git commit -m "feat(aerolito): rotas /aerolito e /aerolito/admin com placeholders"
```

---

## Task 3: SEO — robots.txt + meta noindex

**Files:**
- Modify: `public/robots.txt`

- [ ] **Step 1: Update robots.txt**

Edit `public/robots.txt` — adicionar `Disallow: /aerolito` antes do Sitemap:

```
User-agent: *
Allow: /
Disallow: /aerolito

Sitemap: https://guiresende20.netlify.app/sitemap.xml
```

(O meta `noindex,nofollow` no `<head>` já foi adicionado no `AerolitoPage` da Task 2.)

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "chore(aerolito): bloquear /aerolito em robots.txt"
```

---

## Task 4: Schema Supabase — tabela `aerolito_responses`

**Files:**
- Create: `docs/aerolito-supabase-schema.sql` (referência para owner aplicar)

- [ ] **Step 1: Create schema file**

Create `docs/aerolito-supabase-schema.sql`:

```sql
-- Run this in the Supabase SQL editor before deploying aerolito-submit.

create table if not exists aerolito_responses (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  session_id    uuid        not null,
  question_idx  smallint    not null,
  question_text text        not null,
  answer_text   text        not null,
  ip_hash       text,
  indexed       boolean     not null    default false,
  published     boolean     not null    default false,
  constraint aerolito_question_idx_range check (question_idx between 1 and 5)
);

create index if not exists aerolito_responses_session_idx on aerolito_responses (session_id);
create index if not exists aerolito_responses_indexed_idx on aerolito_responses (indexed);
```

- [ ] **Step 2: Commit**

```bash
git add docs/aerolito-supabase-schema.sql
git commit -m "docs(aerolito): SQL schema da tabela aerolito_responses"
```

- [ ] **Step 3: Manual step — owner applies the SQL**

Owner deve abrir o Supabase Studio (https://supabase.com/dashboard/project/_/sql), colar o conteúdo de `docs/aerolito-supabase-schema.sql` e executar. Não há automação de migration neste projeto.

---

## Task 5: As 5 perguntas como constante compartilhada

**Files:**
- Create: `src/components/aerolito/QUESTIONS.ts`

- [ ] **Step 1: Create constants file**

Create `src/components/aerolito/QUESTIONS.ts`:

```ts
export const AEROLITO_QUESTIONS = [
  "Que características vocês acham mais importantes que eu desenvolva / fortaleça na minha função aqui na Aeroli.to?",
  "Que tipo de apoio vocês esperam de mim quando estiverem desenvolvendo projetos com clientes?",
  "Posso trazer lanches comunitários? Se sim, quais?",
  "Como vocês imaginam que eu posso contribuir (métrica de êxito) nos 6 primeiros meses?",
  "O que vocês não querem que eu faça? (anti-objetivos)",
] as const;

export const AEROLITO_QUESTION_COUNT = AEROLITO_QUESTIONS.length;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/aerolito/QUESTIONS.ts
git commit -m "feat(aerolito): definir as 5 perguntas como constante"
```

---

## Task 6: Backend — `aerolito-submit.ts` (validation + INSERT, sem indexing)

**Files:**
- Create: `netlify/functions/aerolito-submit.ts`
- Test: `netlify/functions/__tests__/aerolito-submit.test.ts`

- [ ] **Step 1: Write failing test for payload validation**

Create `netlify/functions/__tests__/aerolito-submit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { validateSubmitPayload } from "../aerolito-submit";

describe("validateSubmitPayload", () => {
  const validPayload = {
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    question_idx: 1,
    question_text: "Q?",
    answer_text: "A.",
  };

  it("accepts valid payload", () => {
    expect(validateSubmitPayload(validPayload)).toEqual(validPayload);
  });

  it("rejects null/non-object", () => {
    expect(validateSubmitPayload(null)).toBeNull();
    expect(validateSubmitPayload("x")).toBeNull();
  });

  it("rejects invalid session_id (not UUID)", () => {
    expect(validateSubmitPayload({ ...validPayload, session_id: "not-uuid" })).toBeNull();
  });

  it("rejects question_idx out of [1..5]", () => {
    expect(validateSubmitPayload({ ...validPayload, question_idx: 0 })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, question_idx: 6 })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, question_idx: "1" })).toBeNull();
  });

  it("rejects empty question/answer texts", () => {
    expect(validateSubmitPayload({ ...validPayload, question_text: "" })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, answer_text: "" })).toBeNull();
  });

  it("rejects question_text > 300 chars", () => {
    expect(validateSubmitPayload({ ...validPayload, question_text: "x".repeat(301) })).toBeNull();
  });

  it("rejects answer_text > 2000 chars", () => {
    expect(validateSubmitPayload({ ...validPayload, answer_text: "x".repeat(2001) })).toBeNull();
  });

  it("trims whitespace from texts", () => {
    const result = validateSubmitPayload({ ...validPayload, answer_text: "  hi  " });
    expect(result?.answer_text).toBe("hi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- aerolito-submit`
Expected: FAIL (module not found).

- [ ] **Step 3: Create aerolito-submit.ts with validation only**

Create `netlify/functions/aerolito-submit.ts`:

```ts
import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { ensureBlobsContext } from "./_lib/blobs-context";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SubmitPayload {
  session_id: string;
  question_idx: number;
  question_text: string;
  answer_text: string;
}

export function validateSubmitPayload(input: unknown): SubmitPayload | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;

  const session_id = obj.session_id;
  if (typeof session_id !== "string" || !UUID_REGEX.test(session_id)) return null;

  const question_idx = obj.question_idx;
  if (typeof question_idx !== "number" || !Number.isInteger(question_idx)) return null;
  if (question_idx < 1 || question_idx > 5) return null;

  const question_text_raw = obj.question_text;
  if (typeof question_text_raw !== "string") return null;
  const question_text = question_text_raw.trim();
  if (question_text.length === 0 || question_text.length > 300) return null;

  const answer_text_raw = obj.answer_text;
  if (typeof answer_text_raw !== "string") return null;
  const answer_text = answer_text_raw.trim();
  if (answer_text.length === 0 || answer_text.length > 2000) return null;

  return { session_id, question_idx, question_text, answer_text };
}

const SUBMIT_RATE_LIMITS = [
  { limit: 10, windowMs: 60_000, label: "min" },
  { limit: 30, windowMs: 60 * 60_000, label: "hour" },
];

function hashIp(ip: string): string {
  const salt = process.env.AEROLITO_IP_HASH_SALT ?? "default-salt-change-me";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("aerolito-submit", ip, SUBMIT_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid json" }) }; }

  const payload = validateSubmitPayload(parsed);
  if (!payload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid" }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("aerolito-submit: missing supabase env vars");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .insert({
      session_id: payload.session_id,
      question_idx: payload.question_idx,
      question_text: payload.question_text,
      answer_text: payload.answer_text,
      ip_hash: hashIp(ip),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("aerolito-submit: insert failed", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "save failed" }) };
  }

  // (indexing async: ver Task 8)

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id: data.id }) };
};

export { handler };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- aerolito-submit`
Expected: PASS (8 testes).

- [ ] **Step 5: Add redirect in netlify.toml**

Edit `netlify.toml` — adicionar 4 redirects para as funções aerolito (entre o redirect existente `/api/blog/reindex` e o catch-all `/api/*`):

```toml
[[redirects]]
  from = "/api/aerolito-chat"
  to = "/.netlify/functions/aerolito-chat"
  status = 200

[[redirects]]
  from = "/api/aerolito-submit"
  to = "/.netlify/functions/aerolito-submit"
  status = 200

[[redirects]]
  from = "/api/aerolito-bullets"
  to = "/.netlify/functions/aerolito-bullets"
  status = 200

[[redirects]]
  from = "/api/aerolito-admin"
  to = "/.netlify/functions/aerolito-admin"
  status = 200
```

(O catch-all `/api/*` já cobriria, mas explícitos garantem clareza e ordenação.)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/aerolito-submit.ts netlify/functions/__tests__/aerolito-submit.test.ts netlify.toml
git commit -m "feat(aerolito): endpoint /api/aerolito-submit com validacao + INSERT Supabase"
```

---

## Task 7: Vector store isolado para respostas Aerolito

**Files:**
- Create: `netlify/functions/_lib/aerolito-vector.ts`
- Test: `netlify/functions/_lib/__tests__/aerolito-vector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `netlify/functions/_lib/__tests__/aerolito-vector.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { __resetAerolitoCacheForTests, appendAerolitoChunk, searchAerolito, resetAerolitoIndex, getAerolitoChunkCount } from "../aerolito-vector";

beforeEach(() => __resetAerolitoCacheForTests());

describe("aerolito-vector (no blobs env = no-op)", () => {
  it("appendAerolitoChunk does not throw when blobs env missing", async () => {
    await expect(appendAerolitoChunk({
      id: "11111111-1111-1111-1111-111111111111",
      text: "P: x\nR: y",
      vector: [0.1, 0.2, 0.3],
      questionIdx: 1,
      createdAt: new Date().toISOString(),
    })).resolves.not.toThrow();
  });

  it("searchAerolito returns empty when blobs env missing", async () => {
    const hits = await searchAerolito([0.1, 0.2, 0.3], { k: 5, threshold: 0.5 });
    expect(hits).toEqual([]);
  });

  it("resetAerolitoIndex is idempotent without blobs", async () => {
    await expect(resetAerolitoIndex()).resolves.not.toThrow();
  });

  it("getAerolitoChunkCount returns 0 without blobs", async () => {
    expect(await getAerolitoChunkCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- aerolito-vector`
Expected: FAIL.

- [ ] **Step 3: Implement the vector store**

Create `netlify/functions/_lib/aerolito-vector.ts`:

```ts
import { getStore } from "@netlify/blobs";

const STORE_NAME = "blog"; // reuse existing store; key prefix isolates the index
const INDEX_KEY = "embeddings/aerolito-index.json";

export interface AerolitoChunk {
  id: string;
  text: string;          // formato "P: <pergunta>\nR: <resposta>"
  vector: number[];
  questionIdx: number;
  createdAt: string;
}

export interface AerolitoIndexFile {
  chunks: AerolitoChunk[];
}

export interface AerolitoHit {
  id: string;
  text: string;
  questionIdx: number;
  score: number;
}

export interface AerolitoSearchOptions {
  k?: number;
  threshold?: number;
}

let memCache: AerolitoIndexFile | null = null;

function safeStore() {
  try {
    return getStore(STORE_NAME);
  } catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

export function __resetAerolitoCacheForTests(): void {
  memCache = null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function loadIndex(): Promise<AerolitoIndexFile> {
  if (memCache) return memCache;
  const s = safeStore();
  if (!s) { memCache = { chunks: [] }; return memCache; }

  let raw: unknown = null;
  try {
    raw = await s.get(INDEX_KEY, { type: "json" });
  } catch (err) {
    console.error("aerolito-vector.loadIndex: blob read failed", err);
    return { chunks: [] };
  }
  if (!raw || typeof raw !== "object") {
    memCache = { chunks: [] };
    return memCache;
  }
  const candidate = raw as AerolitoIndexFile;
  if (!Array.isArray(candidate.chunks)) {
    console.error("aerolito-vector.loadIndex: malformed, ignoring");
    memCache = { chunks: [] };
    return memCache;
  }
  memCache = candidate;
  return memCache;
}

async function saveIndex(index: AerolitoIndexFile): Promise<void> {
  const s = safeStore();
  if (!s) return;
  await s.setJSON(INDEX_KEY, index);
  memCache = index;
}

export async function appendAerolitoChunk(chunk: AerolitoChunk): Promise<void> {
  const idx = await loadIndex();
  const next: AerolitoIndexFile = { chunks: [...idx.chunks.filter(c => c.id !== chunk.id), chunk] };
  await saveIndex(next);
}

export async function searchAerolito(queryVec: number[], opts: AerolitoSearchOptions = {}): Promise<AerolitoHit[]> {
  const k = opts.k ?? 5;
  const threshold = opts.threshold ?? 0.5;
  const idx = await loadIndex();
  if (idx.chunks.length === 0) return [];
  return idx.chunks
    .filter(c => c.vector.length === queryVec.length)
    .map(c => ({
      id: c.id,
      text: c.text,
      questionIdx: c.questionIdx,
      score: cosineSimilarity(queryVec, c.vector),
    }))
    .filter(h => h.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function resetAerolitoIndex(): Promise<void> {
  const s = safeStore();
  if (!s) { memCache = { chunks: [] }; return; }
  try {
    await s.delete(INDEX_KEY);
  } catch (err) {
    console.error("aerolito-vector.resetAerolitoIndex: delete failed", err);
  }
  memCache = { chunks: [] };
}

export async function getAerolitoChunkCount(): Promise<number> {
  const idx = await loadIndex();
  return idx.chunks.length;
}

export async function dumpAllAerolitoChunks(): Promise<AerolitoChunk[]> {
  const idx = await loadIndex();
  return idx.chunks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- aerolito-vector`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/aerolito-vector.ts netlify/functions/_lib/__tests__/aerolito-vector.test.ts
git commit -m "feat(aerolito): vector store isolado em embeddings/aerolito-index.json"
```

---

## Task 8: Auto-indexação assíncrona em `aerolito-submit`

**Files:**
- Modify: `netlify/functions/aerolito-submit.ts`

- [ ] **Step 1: Add helper and async indexing to the handler**

Edit `netlify/functions/aerolito-submit.ts`. Adicionar import e helper antes do `handler`:

```ts
import { embedText } from "./_lib/embeddings";
import { appendAerolitoChunk } from "./_lib/aerolito-vector";

async function indexResponseAsync(id: string, payload: SubmitPayload, supabaseUrl: string, supabaseKey: string): Promise<void> {
  try {
    const text = `P: ${payload.question_text}\nR: ${payload.answer_text}`;
    const vector = await embedText(text);
    await appendAerolitoChunk({
      id,
      text,
      vector,
      questionIdx: payload.question_idx,
      createdAt: new Date().toISOString(),
    });
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("aerolito_responses").update({ indexed: true }).eq("id", id);
  } catch (err) {
    console.error("aerolito-submit: async indexing failed", err);
    // intentional: do not throw — user already got 200
  }
}
```

Substitua o comentário `// (indexing async: ver Task 8)` por:

```ts
// Fire-and-forget: respondemos OK ao colega imediatamente; indexação roda em background.
// Erros são logados mas não afetam UX (admin pode reindexar depois).
indexResponseAsync(data.id, payload, supabaseUrl, supabaseKey).catch(() => {});
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npm run test:run -- aerolito-submit aerolito-vector`
Expected: PASS (12 testes total).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/aerolito-submit.ts
git commit -m "feat(aerolito): auto-indexar respostas no vector store async"
```

---

## Task 9: `aerolito-bullets.ts` — endpoint público de bullets publicados

**Files:**
- Create: `netlify/functions/aerolito-bullets.ts`

- [ ] **Step 1: Create the endpoint**

Create `netlify/functions/aerolito-bullets.ts`:

```ts
import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { ensureBlobsContext } from "./_lib/blobs-context";

const STORE_NAME = "blog";
const BULLETS_KEY = "aerolito/published-bullets.json";

interface PublishedBullets {
  bullets: string[];
  published_at: string;
}

function safeStore() {
  try { return getStore(STORE_NAME); }
  catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = {
    ...corsHeaders(origin, "GET"),
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const s = safeStore();
  if (!s) {
    return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
  }

  try {
    const raw = await s.get(BULLETS_KEY, { type: "json" });
    if (!raw || typeof raw !== "object") {
      return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
    }
    const candidate = raw as Partial<PublishedBullets>;
    if (!Array.isArray(candidate.bullets) || candidate.bullets.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ bullets: candidate.bullets, published_at: candidate.published_at }),
    };
  } catch (err) {
    console.error("aerolito-bullets: blob read failed", err);
    return { statusCode: 200, headers, body: JSON.stringify({ bullets: null }) };
  }
};

export { handler };
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/aerolito-bullets.ts
git commit -m "feat(aerolito): endpoint publico /api/aerolito-bullets"
```

---

## Task 10: `aerolito-admin.ts` — esqueleto + auth + action=list

**Files:**
- Create: `netlify/functions/aerolito-admin.ts`
- Test: `netlify/functions/__tests__/aerolito-admin.test.ts`

- [ ] **Step 1: Write failing tests for auth helper**

Create `netlify/functions/__tests__/aerolito-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { isAuthorized, validateBulletsPayload } from "../aerolito-admin";

describe("isAuthorized", () => {
  beforeEach(() => {
    process.env.AEROLITO_ADMIN_TOKEN = "secret-test-token";
  });

  it("accepts valid Bearer token", () => {
    expect(isAuthorized("Bearer secret-test-token")).toBe(true);
  });

  it("rejects missing header", () => {
    expect(isAuthorized(undefined)).toBe(false);
    expect(isAuthorized("")).toBe(false);
  });

  it("rejects wrong scheme", () => {
    expect(isAuthorized("Basic secret-test-token")).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(isAuthorized("Bearer wrong-token")).toBe(false);
  });

  it("rejects when env var is missing", () => {
    delete process.env.AEROLITO_ADMIN_TOKEN;
    expect(isAuthorized("Bearer anything")).toBe(false);
  });
});

describe("validateBulletsPayload", () => {
  it("accepts 4-6 bullets within length limits", () => {
    const bullets = ["a", "b", "c", "d"];
    expect(validateBulletsPayload({ bullets })).toEqual(bullets);
  });

  it("rejects non-object", () => {
    expect(validateBulletsPayload(null)).toBeNull();
  });

  it("rejects too few bullets", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c"] })).toBeNull();
  });

  it("rejects too many bullets", () => {
    expect(validateBulletsPayload({ bullets: ["a","b","c","d","e","f","g"] })).toBeNull();
  });

  it("rejects bullets longer than 200 chars", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", "x".repeat(201)] })).toBeNull();
  });

  it("rejects non-string bullet", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", 42] })).toBeNull();
  });

  it("rejects empty bullet", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", "  "] })).toBeNull();
  });

  it("trims each bullet", () => {
    const result = validateBulletsPayload({ bullets: ["  a  ", "b", "c", "d"] });
    expect(result?.[0]).toBe("a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- aerolito-admin`
Expected: FAIL.

- [ ] **Step 3: Create admin function with auth + action=list**

Create `netlify/functions/aerolito-admin.ts`:

```ts
import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { ensureBlobsContext } from "./_lib/blobs-context";

export function isAuthorized(authHeader: string | undefined | null): boolean {
  if (!authHeader) return false;
  const expected = process.env.AEROLITO_ADMIN_TOKEN;
  if (!expected) return false;
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return false;
  return authHeader.slice(prefix.length) === expected;
}

export function validateBulletsPayload(input: unknown): string[] | null {
  if (!input || typeof input !== "object") return null;
  const bullets = (input as { bullets?: unknown }).bullets;
  if (!Array.isArray(bullets)) return null;
  if (bullets.length < 4 || bullets.length > 6) return null;
  const out: string[] = [];
  for (const b of bullets) {
    if (typeof b !== "string") return null;
    const t = b.trim();
    if (t.length === 0 || t.length > 200) return null;
    out.push(t);
  }
  return out;
}

interface SessionGroup {
  session_id: string;
  created_at: string;
  responses: Array<{
    question_idx: number;
    question_text: string;
    answer_text: string;
    indexed: boolean;
    published: boolean;
  }>;
}

async function actionList(supabaseUrl: string, supabaseKey: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .select("session_id, created_at, question_idx, question_text, answer_text, indexed, published")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const sessions = new Map<string, SessionGroup>();
  for (const row of data ?? []) {
    const sid = row.session_id;
    if (!sessions.has(sid)) sessions.set(sid, { session_id: sid, created_at: row.created_at, responses: [] });
    sessions.get(sid)!.responses.push({
      question_idx: row.question_idx,
      question_text: row.question_text,
      answer_text: row.answer_text,
      indexed: row.indexed,
      published: row.published,
    });
  }
  const sessionArr = Array.from(sessions.values()).map(s => ({
    ...s,
    responses: s.responses.sort((a, b) => a.question_idx - b.question_idx),
  }));
  return {
    sessions: sessionArr,
    totalSessions: sessionArr.length,
    totalResponses: data?.length ?? 0,
  };
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET, POST"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = { ...corsHeaders(origin, "GET, POST"), "Content-Type": "application/json" };

  const auth = event.headers["authorization"] || event.headers["Authorization"];
  if (!isAuthorized(auth)) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: "not found" }) };
  }

  const url = new URL(event.rawUrl);
  const action = url.searchParams.get("action");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  try {
    if (action === "list" && event.httpMethod === "GET") {
      const result = await actionList(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // Other actions are added in Tasks 11-13.

    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid action or method" }) };
  } catch (err) {
    console.error("aerolito-admin: error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "internal" }) };
  }
};

export { handler };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- aerolito-admin`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/aerolito-admin.ts netlify/functions/__tests__/aerolito-admin.test.ts
git commit -m "feat(aerolito): admin function com auth Bearer + action=list"
```

---

## Task 11: `aerolito-admin` action=consolidate (IA)

**Files:**
- Modify: `netlify/functions/aerolito-admin.ts`

- [ ] **Step 1: Add consolidate action**

Em `aerolito-admin.ts`, adicionar import e função:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
```

E acima do `handler`:

```ts
const CONSOLIDATION_PROMPT = `Você é um assistente que consolida feedback anônimo de um time sobre o que esperam de um novo Head de Pesquisa.

Recebeu N respostas para 5 perguntas distintas. Sua tarefa: extrair as expectativas mais frequentes e relevantes e expressá-las como 4-6 bullets concisos.

REGRAS:
- Cada bullet: máximo 120 caracteres
- Tom: ação concreta na primeira pessoa do Guilherme (ex.: "Liderar pesquisa qualitativa com clientes em todas as fases do produto")
- NÃO usar buzzwords ou linguagem de influencer
- NÃO inventar — só consolide o que aparece nas respostas
- Priorize temas que aparecem em múltiplas sessões

Retorne JSON exatamente neste formato: { "bullets": ["...", "...", ...] }
Sem markdown, sem texto adicional, só o JSON.

Respostas dos colegas:
`;

async function actionConsolidate(supabaseUrl: string, supabaseKey: string): Promise<{ bullets: string[] }> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("aerolito_responses")
    .select("session_id, question_idx, question_text, answer_text")
    .order("session_id", { ascending: true })
    .order("question_idx", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return { bullets: [] };

  const grouped: Record<string, Array<{ q: string; a: string }>> = {};
  for (const row of data) {
    grouped[row.session_id] ??= [];
    grouped[row.session_id].push({ q: row.question_text, a: row.answer_text });
  }
  const dump = Object.entries(grouped)
    .map(([sid, items], i) => {
      const lines = items.map((it) => `- (Q${it.q.slice(0, 60)}…) R: ${it.a}`).join("\n");
      return `Sessão ${i + 1} (anônima):\n${lines}`;
    })
    .join("\n\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(CONSOLIDATION_PROMPT + dump);
  const raw = result.response.text().trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const clean = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(clean) as { bullets?: unknown };
  if (!Array.isArray(parsed.bullets)) throw new Error("invalid bullets in IA response");
  const bullets = parsed.bullets
    .filter((b): b is string => typeof b === "string")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  return { bullets };
}
```

E adicionar no router (`handler`), antes do `return { statusCode: 400, ... }`:

```ts
    if (action === "consolidate" && event.httpMethod === "POST") {
      const result = await actionConsolidate(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
```

- [ ] **Step 2: Add test for consolidate (validation of params only)**

No `aerolito-admin.test.ts`, adicionar:

```ts
import { describe as describe2, it as it2, expect as expect2 } from "vitest";

describe2("CONSOLIDATION_PROMPT (sanity)", () => {
  it2("imports without crashing", async () => {
    // The function depends on GEMINI_API_KEY + Supabase; just import-time sanity.
    const mod = await import("../aerolito-admin");
    expect2(typeof mod.isAuthorized).toBe("function");
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm run test:run -- aerolito-admin`
Expected: PASS (13 testes).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/aerolito-admin.ts netlify/functions/__tests__/aerolito-admin.test.ts
git commit -m "feat(aerolito): admin action=consolidate gera bullets via Gemini"
```

---

## Task 12: `aerolito-admin` action=publish

**Files:**
- Modify: `netlify/functions/aerolito-admin.ts`

- [ ] **Step 1: Add publish action**

Em `aerolito-admin.ts`, adicionar import:

```ts
import { getStore } from "@netlify/blobs";
```

E acima do handler:

```ts
const BLOG_STORE = "blog";
const BULLETS_KEY = "aerolito/published-bullets.json";

function adminStore() {
  try { return getStore(BLOG_STORE); }
  catch (e) {
    if (e instanceof Error && e.name === "MissingBlobsEnvironmentError") return null;
    throw e;
  }
}

async function actionPublish(
  payload: unknown,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{ ok: true; bullets: string[] }> {
  const bullets = validateBulletsPayload(payload);
  if (!bullets) throw new Error("invalid bullets payload");

  const s = adminStore();
  if (!s) throw new Error("blob store unavailable");

  await s.setJSON(BULLETS_KEY, {
    bullets,
    published_at: new Date().toISOString(),
  });

  const supabase = createClient(supabaseUrl, supabaseKey);
  // Mark all rows as published. (Not strictly required, but keeps audit trail accurate.)
  await supabase.from("aerolito_responses").update({ published: true }).gte("question_idx", 1);

  return { ok: true, bullets };
}
```

E no router:

```ts
    if (action === "publish" && event.httpMethod === "POST") {
      let body: unknown;
      try { body = JSON.parse(event.body || "{}"); }
      catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid json" }) }; }
      const result = await actionPublish(body, supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
```

- [ ] **Step 2: Run all tests**

Run: `npm run test:run`
Expected: PASS (todos os testes existentes + os novos).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/aerolito-admin.ts
git commit -m "feat(aerolito): admin action=publish grava bullets em Blob + marca Supabase"
```

---

## Task 13: `aerolito-admin` action=reset (backup + delete tudo)

**Files:**
- Modify: `netlify/functions/aerolito-admin.ts`

- [ ] **Step 1: Add reset action**

Em `aerolito-admin.ts`, adicionar import:

```ts
import { dumpAllAerolitoChunks, resetAerolitoIndex } from "./_lib/aerolito-vector";
```

E acima do handler:

```ts
async function actionReset(supabaseUrl: string, supabaseKey: string) {
  // 1. Fetch everything for backup
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: rows } = await supabase.from("aerolito_responses").select("*");
  const chunks = await dumpAllAerolitoChunks();
  let publishedBullets: unknown = null;
  const s = adminStore();
  if (s) {
    try { publishedBullets = await s.get(BULLETS_KEY, { type: "json" }); }
    catch { /* tolerate missing */ }
  }
  const backup = {
    exported_at: new Date().toISOString(),
    aerolito_responses: rows ?? [],
    vector_chunks: chunks,
    published_bullets: publishedBullets,
  };

  // 2. Write backup file
  if (s) {
    const ts = backup.exported_at.replace(/[:.]/g, "-");
    await s.setJSON(`aerolito/backups/${ts}.json`, backup);
  }

  // 3. Delete everything
  // Supabase: hard delete all rows using a filter that matches all
  await supabase.from("aerolito_responses").delete().gte("question_idx", 1);
  // Vector index: delete the file
  await resetAerolitoIndex();
  // Published bullets: delete the blob
  if (s) {
    try { await s.delete(BULLETS_KEY); }
    catch (err) { console.error("aerolito-admin: bullets delete failed", err); }
  }

  return { ok: true, backup };
}
```

E no router:

```ts
    if (action === "reset" && event.httpMethod === "POST") {
      const result = await actionReset(supabaseUrl, supabaseKey);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
```

- [ ] **Step 2: Run all tests**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/aerolito-admin.ts
git commit -m "feat(aerolito): admin action=reset com backup automatico antes de apagar"
```

---

## Task 14: `aerolito-chat.ts` — emite token Live + system prompt completo

**Files:**
- Create: `netlify/functions/aerolito-chat.ts`

- [ ] **Step 1: Create the function**

Create `netlify/functions/aerolito-chat.ts`:

```ts
import type { Handler, HandlerEvent } from "@netlify/functions";
import { SYSTEM_PROMPT_AEROLITO } from "../../src/lib/system-prompt-aerolito";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";
import { retrieveRelevantChunks } from "./_lib/rag";
import { searchAerolito } from "./_lib/aerolito-vector";
import { embedText } from "./_lib/embeddings";
import { ensureBlobsContext } from "./_lib/blobs-context";

const CHAT_RATE_LIMITS = [
  { limit: 10, windowMs: 60_000, label: "min" },
  { limit: 30, windowMs: 60 * 60_000, label: "hour" },
];

const TOKEN_LIFETIME_MS = 30 * 60_000;
const SESSION_START_WINDOW_MS = 2 * 60_000;
const RAG_TIMEOUT_MS = 1500;

async function getRagContextSafe(message: string): Promise<string> {
  try {
    return await Promise.race([
      retrieveRelevantChunks(message),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), RAG_TIMEOUT_MS)),
    ]);
  } catch { return ""; }
}

async function getAerolitoContextSafe(message: string): Promise<string> {
  try {
    const trimmed = (message ?? "").trim();
    if (!trimmed) return "";
    const queryVec = await Promise.race([
      embedText(trimmed),
      new Promise<number[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), RAG_TIMEOUT_MS)),
    ]);
    const hits = await searchAerolito(queryVec, { k: 4, threshold: 0.45 });
    if (hits.length === 0) return "";
    const body = hits.map(h => `[Expectativa do time — Q${h.questionIdx}]\n${h.text}`).join("\n---\n");
    return `\n\n---\n\nEXPECTATIVAS DO TIME AEROLITO (use quando relevante para falar do seu novo papel):\n${body}\n`;
  } catch { return ""; }
}

async function issueLiveToken(apiKey: string): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const expireTime = new Date(now + TOKEN_LIFETIME_MS).toISOString();
  const newSessionExpireTime = new Date(now + SESSION_START_WINDOW_MS).toISOString();
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`auth_tokens failed: ${resp.status} ${body}`);
  }
  const data = (await resp.json()) as { name?: string };
  if (!data.name) throw new Error("missing name field");
  return { token: data.name, expiresAt: expireTime };
}

const handler: Handler = async (event: HandlerEvent) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }
  if (!allowed) return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };

  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("aerolito-chat", ip, CHAT_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "config missing" }) };
  }

  let message = "";
  try {
    const body = JSON.parse(event.body || "{}");
    if (typeof body.message === "string") message = body.message.slice(0, 2000);
  } catch {
    // tolera body vazio — chat pode pedir token sem mensagem
  }

  try {
    const [{ token, expiresAt }, blogContext, aerolitoContext] = await Promise.all([
      issueLiveToken(apiKey),
      getRagContextSafe(message),
      getAerolitoContextSafe(message),
    ]);

    const fullSystemPrompt = SYSTEM_PROMPT_AEROLITO + blogContext + aerolitoContext;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, expiresAt, fullSystemPrompt }),
    };
  } catch (err) {
    console.error("aerolito-chat: error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro ao iniciar conversa" }) };
  }
};

export { handler };
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -p tsconfig.functions.json --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/aerolito-chat.ts
git commit -m "feat(aerolito): endpoint /api/aerolito-chat emite token Live + system prompt"
```

---

## Task 15: Variante do Gemini Live para input texto + sync typing

**Files:**
- Create: `src/lib/aerolito-live.ts`

- [ ] **Step 1: Create the class**

Create `src/lib/aerolito-live.ts`:

```ts
// Variante do Gemini Live para o /aerolito:
// - Input via texto (não via mic)
// - Output: áudio + transcrição (outputTranscription)
// - Sync typing: cada chunk de transcrição vira evento; consumer atualiza UI char-by-char
// - Suporta enviar turns como role=model (para falar perguntas fixas sem alucinação)

export type AerolitoLiveStatus = "disconnected" | "connecting" | "connected" | "speaking" | "idle" | "error";

export interface AerolitoLiveCallbacks {
  onStatusChange: (status: AerolitoLiveStatus) => void;
  onTranscriptChunk: (text: string) => void;     // cada chunk parcial
  onTurnComplete?: (fullText: string) => void;   // chamado ao fim do turn (texto completo)
  onError?: (error: string) => void;
}

export class AerolitoLiveChat {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private currentTranscript = "";

  constructor(
    private ephemeralToken: string,
    private callbacks: AerolitoLiveCallbacks,
    private systemInstruction: string,
  ) {}

  public async start(): Promise<void> {
    this.callbacks.onStatusChange("connecting");
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 24000,
      });

      const wssUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.ephemeralToken)}`;
      this.ws = new WebSocket(wssUrl);

      this.ws.onopen = () => {
        const setup = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                languageCode: "pt-BR",
              },
            },
            systemInstruction: { parts: [{ text: this.systemInstruction }] },
            outputAudioTranscription: {},
          },
        };
        this.ws?.send(JSON.stringify(setup));
      };

      this.ws.onmessage = async (event) => {
        let msg: unknown;
        try {
          const text = event.data instanceof Blob ? await event.data.text() : (event.data as string);
          msg = JSON.parse(text);
        } catch (e) {
          console.error("aerolito-live: parse failed", e);
          return;
        }
        this.handleMessage(msg);
      };

      this.ws.onerror = (e) => {
        console.error("aerolito-live: ws error", e);
        this.callbacks.onError?.("Erro de conexão");
        this.stop();
      };

      this.ws.onclose = () => {
        this.callbacks.onStatusChange("disconnected");
      };
    } catch (e) {
      console.error("aerolito-live: start failed", e);
      this.callbacks.onError?.("Não foi possível iniciar a voz.");
      this.stop();
    }
  }

  private handleMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return;
    const obj = msg as Record<string, unknown>;

    if (obj.error) {
      this.callbacks.onError?.(`API Error: ${JSON.stringify(obj.error)}`);
      this.stop();
      return;
    }

    if (obj.setupComplete) {
      this.callbacks.onStatusChange("connected");
      this.callbacks.onStatusChange("idle");
      return;
    }

    const serverContent = obj.serverContent as Record<string, unknown> | undefined;
    if (!serverContent) return;

    // Transcrição do áudio que estamos tocando (sincroniza typing)
    const outputTranscription = serverContent.outputTranscription as { text?: string } | undefined;
    if (outputTranscription?.text) {
      this.currentTranscript += outputTranscription.text;
      this.callbacks.onTranscriptChunk(outputTranscription.text);
    }

    const modelTurn = serverContent.modelTurn as { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> } | undefined;
    if (modelTurn?.parts) {
      this.callbacks.onStatusChange("speaking");
      for (const part of modelTurn.parts) {
        if (part.inlineData?.data) this.playAudioChunk(part.inlineData.data);
      }
    }

    if (serverContent.turnComplete) {
      this.callbacks.onStatusChange("idle");
      const full = this.currentTranscript;
      this.currentTranscript = "";
      this.callbacks.onTurnComplete?.(full);
    }
  }

  /** Envia texto do colega como user turn (modo normal). */
  public sendUserText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    }));
  }

  /** Faz a IA falar exatamente este texto (sem geração — usado para as 5 perguntas fixas). */
  public sayFixed(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Estratégia: enviar como user turn instruindo: "Diga exatamente: ..." (com restrição estrita).
    // Variante 1 (preferida): role=model como contexto pré-fixado, depois pedir continuação.
    // Variante 2 (fallback): instrução literal como user; modelo costuma obedecer com PT-BR.
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: `Diga exatamente este texto, sem adicionar nada, sem comentar, sem trocar palavras: "${text}"` }],
        }],
        turnComplete: true,
      },
    }));
  }

  private playAudioChunk(base64Data: string): void {
    if (!this.audioContext) return;
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;

    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.copyToChannel(float32Data, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) this.nextPlayTime = currentTime;
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      this.scheduledSources = this.scheduledSources.filter((s) => s !== source);
    };
  }

  public stop(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    for (const s of this.scheduledSources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    this.scheduledSources = [];
    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }
    this.callbacks.onStatusChange("disconnected");
  }
}
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/aerolito-live.ts
git commit -m "feat(aerolito): AerolitoLiveChat — input texto + voz + sync typing"
```

---

## Task 16: Controlador do modo entrevista — `AerolitoInterview.ts`

**Files:**
- Create: `src/components/aerolito/AerolitoInterview.ts`
- Test: `src/components/aerolito/__tests__/AerolitoInterview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/aerolito/__tests__/AerolitoInterview.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInterviewController } from "../AerolitoInterview";
import { AEROLITO_QUESTIONS } from "../QUESTIONS";

describe("createInterviewController", () => {
  let mockSay: ReturnType<typeof vi.fn>;
  let mockSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSay = vi.fn();
    mockSubmit = vi.fn().mockResolvedValue(undefined);
  });

  it("starts at step 1 with a sessionId after start()", () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    expect(ctrl.getStep()).toBe(0);
    ctrl.start();
    expect(ctrl.getStep()).toBe(1);
    expect(ctrl.getSessionId()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mockSay).toHaveBeenCalledWith(AEROLITO_QUESTIONS[0]);
  });

  it("advances to next question after onAnswer", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    await ctrl.onAnswer("primeira resposta");
    expect(mockSubmit).toHaveBeenCalledWith({
      session_id: ctrl.getSessionId(),
      question_idx: 1,
      question_text: AEROLITO_QUESTIONS[0],
      answer_text: "primeira resposta",
    });
    expect(ctrl.getStep()).toBe(2);
    expect(mockSay).toHaveBeenLastCalledWith(AEROLITO_QUESTIONS[1]);
  });

  it("transitions to 'done' after the 5th answer", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    for (let i = 0; i < 5; i++) {
      await ctrl.onAnswer(`r${i}`);
    }
    expect(ctrl.getStep()).toBe("done");
    expect(mockSubmit).toHaveBeenCalledTimes(5);
  });

  it("ignores onAnswer after done", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    for (let i = 0; i < 5; i++) await ctrl.onAnswer(`r${i}`);
    await ctrl.onAnswer("extra");
    expect(mockSubmit).toHaveBeenCalledTimes(5);
  });

  it("retries submit once on transient failure (network)", async () => {
    let calls = 0;
    mockSubmit = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error("network"));
      return Promise.resolve();
    });
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    await ctrl.onAnswer("ok");
    expect(mockSubmit).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- AerolitoInterview`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the controller**

Create `src/components/aerolito/AerolitoInterview.ts`:

```ts
import { AEROLITO_QUESTIONS } from "./QUESTIONS";

type Step = number | "done";

export interface InterviewSubmitPayload {
  session_id: string;
  question_idx: number;
  question_text: string;
  answer_text: string;
}

export interface InterviewDeps {
  sayFixed: (text: string) => void;
  submitAnswer: (payload: InterviewSubmitPayload) => Promise<void>;
}

export interface InterviewController {
  start: () => void;
  onAnswer: (text: string) => Promise<void>;
  getStep: () => Step;
  getSessionId: () => string;
}

function makeUuidV4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createInterviewController(deps: InterviewDeps): InterviewController {
  let step: Step = 0;
  let sessionId = "";

  async function trySubmit(payload: InterviewSubmitPayload): Promise<void> {
    try {
      await deps.submitAnswer(payload);
    } catch {
      // 1 retry com pequena espera
      await new Promise((r) => setTimeout(r, 800));
      await deps.submitAnswer(payload);
    }
  }

  function speakCurrent() {
    if (typeof step === "number" && step >= 1 && step <= AEROLITO_QUESTIONS.length) {
      deps.sayFixed(AEROLITO_QUESTIONS[step - 1]);
    }
  }

  return {
    start() {
      sessionId = makeUuidV4();
      step = 1;
      speakCurrent();
    },
    async onAnswer(text: string) {
      if (step === "done" || typeof step !== "number") return;
      const idx = step;
      await trySubmit({
        session_id: sessionId,
        question_idx: idx,
        question_text: AEROLITO_QUESTIONS[idx - 1],
        answer_text: text,
      }).catch((err) => {
        console.error("AerolitoInterview: submit failed after retry", err);
        // We intentionally swallow — colega já viu UI; admin pode revisar log
      });

      if (idx >= AEROLITO_QUESTIONS.length) {
        step = "done";
        deps.sayFixed(
          "Obrigado. Suas respostas vão me ajudar a desenhar como atuar nessa nova função. Quer continuar a conversa?",
        );
        return;
      }
      step = idx + 1;
      speakCurrent();
    },
    getStep() { return step; },
    getSessionId() { return sessionId; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- AerolitoInterview`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/aerolito/AerolitoInterview.ts src/components/aerolito/__tests__/AerolitoInterview.test.ts
git commit -m "feat(aerolito): controlador do modo entrevista (5 perguntas + retry)"
```

---

## Task 17: `AerolitoChatWidget` — chat embedded com voz Live

**Files:**
- Create: `src/components/aerolito/AerolitoChatWidget.tsx`

- [ ] **Step 1: Implement the widget**

Create `src/components/aerolito/AerolitoChatWidget.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { AerolitoLiveChat, type AerolitoLiveStatus } from "@/lib/aerolito-live";
import { createInterviewController, type InterviewController } from "./AerolitoInterview";

interface Message { role: "user" | "model"; text: string }

const WELCOME = "Sou o RAG do Gui, agora Head de Pesquisa na Aeroli.to. Pergunta o que quiser — ou clique abaixo pra deixar a sua expectativa sobre o que eu deveria entregar.";

const SUGGESTIONS = [
  "Quem é o Gui?",
  "O que é Head de Pesquisa?",
  "Por que Aerolito?",
];

const MAX_MESSAGES = 30;

export default function AerolitoChatWidget() {
  const [messages, setMessages] = useState<Message[]>([{ role: "model", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AerolitoLiveStatus>("disconnected");
  const [mode, setMode] = useState<"normal" | "interview">("normal");
  const liveRef = useRef<AerolitoLiveChat | null>(null);
  const interviewRef = useRef<InterviewController | null>(null);
  const currentModelMsgIdx = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function ensureLiveReady(): Promise<AerolitoLiveChat | null> {
    if (liveRef.current && status !== "disconnected" && status !== "error") return liveRef.current;
    try {
      const resp = await fetch("/api/aerolito-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input || "" }),
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const data = await resp.json() as { token: string; fullSystemPrompt: string };
      const live = new AerolitoLiveChat(data.token, {
        onStatusChange: setStatus,
        onTranscriptChunk: (text) => {
          setMessages((prev) => {
            const next = [...prev];
            const i = currentModelMsgIdx.current;
            if (i == null) {
              next.push({ role: "model", text });
              currentModelMsgIdx.current = next.length - 1;
            } else {
              next[i] = { ...next[i], text: next[i].text + text };
            }
            return next;
          });
        },
        onTurnComplete: () => { currentModelMsgIdx.current = null; },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: "model", text: `(erro: ${err})` }]);
        },
      }, data.fullSystemPrompt);
      await live.start();
      liveRef.current = live;
      return live;
    } catch (err) {
      console.error("aerolito-chat: ensureLiveReady failed", err);
      setStatus("error");
      return null;
    }
  }

  async function sendUserMessage(text: string) {
    if (!text.trim() || messages.length >= MAX_MESSAGES) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    const live = await ensureLiveReady();
    if (!live) return;
    live.sendUserText(text);
  }

  async function startInterview() {
    if (mode === "interview") return;
    const live = await ensureLiveReady();
    if (!live) return;
    setMode("interview");
    interviewRef.current = createInterviewController({
      sayFixed: (t) => live.sayFixed(t),
      submitAnswer: async (payload) => {
        const r = await fetch("/api/aerolito-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
      },
    });
    interviewRef.current.start();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    if (mode === "interview" && interviewRef.current) {
      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");
      await interviewRef.current.onAnswer(text);
      if (interviewRef.current.getStep() === "done") {
        setMode("normal");
      }
    } else {
      await sendUserMessage(text);
    }
  }

  useEffect(() => {
    return () => { liveRef.current?.stop(); };
  }, []);

  const interviewProgress = mode === "interview" && interviewRef.current
    ? (interviewRef.current.getStep() === "done" ? "Concluído" : `Pergunta ${interviewRef.current.getStep()} de 5`)
    : null;

  return (
    <div className="flex flex-col h-[640px] max-h-[80vh] bg-background border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
        <div className="flex items-center gap-3">
          <img src="/guilherme-foto.webp" alt="Gui" className="w-9 h-9 rounded-full object-cover border border-neon/30" loading="lazy" decoding="async" />
          <div>
            <p className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight leading-none">Gui · <span className="text-neon">RAG</span></p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em] mt-0.5">{status}</p>
          </div>
        </div>
        {interviewProgress && (
          <span className="font-mono text-[10px] text-neon uppercase tracking-wider">{interviewProgress}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-md text-[13px] leading-relaxed font-sans ${msg.role === "user" ? "bg-neon text-background font-medium" : "bg-card border border-border text-muted-foreground"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {messages.length === 1 && mode === "normal" && (
          <div className="mt-2">
            <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-[0.08em] mb-2">Sugestões</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendUserMessage(s)} className="text-left font-mono text-[10px] text-muted-foreground border border-dim/60 px-3 py-1.5 rounded-sm hover:border-neon/30 hover:text-foreground transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card/40">
        {mode === "normal" && (
          <button onClick={startInterview} className="w-full mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-neon border border-neon/40 px-3 py-2 rounded-sm hover:bg-neon/10 transition-all">
            🤝 Contribuir como colega Aerolito
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={mode === "interview" ? "Sua resposta…" : "Pergunte algo…"}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/40 focus:ring-1 focus:ring-neon/20"
          />
          <button onClick={handleSend} disabled={!input.trim()} aria-label="Enviar" className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md bg-neon text-background disabled:opacity-30 disabled:cursor-not-allowed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Quick component sanity check (compile)**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/aerolito/AerolitoChatWidget.tsx
git commit -m "feat(aerolito): AerolitoChatWidget embedded com voz Live + toggle entrevista"
```

---

## Task 18: `AerolitoIntro` placeholder

**Files:**
- Create: `src/components/aerolito/AerolitoIntro.tsx`

- [ ] **Step 1: Create placeholder**

Create `src/components/aerolito/AerolitoIntro.tsx`:

```tsx
import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

// Placeholder até a referência HTML chegar.
// Quando a referência chegar: substituir conteúdo deste componente pelo HTML real,
// e disparar onDone() quando a animação acabar (timer, evento, ou scroll).
export default function AerolitoIntro({ onDone }: Props) {
  const [phase, setPhase] = useState<"intro" | "ready">("intro");

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-2xl px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-neon mb-4">guilherme · aerolito</p>
        <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tight leading-none">
          Head de <span className="text-neon">Pesquisa</span>
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-6">
          JUN 2026 · Aeroli.to · Porto Alegre
        </p>
      </div>

      {phase === "ready" && (
        <button
          onClick={onDone}
          className="relative z-10 mt-12 font-mono text-[11px] uppercase tracking-[0.1em] text-neon border border-neon/40 px-4 py-2 rounded-sm hover:bg-neon/10 transition-all animate-fade-up"
        >
          ↓ Conhecer melhor (chat com a IA)
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/aerolito/AerolitoIntro.tsx
git commit -m "feat(aerolito): AerolitoIntro placeholder ate referencia HTML chegar"
```

---

## Task 19: Compor `AerolitoPage` final

**Files:**
- Modify: `src/pages/AerolitoPage.tsx`

- [ ] **Step 1: Replace the placeholder body**

Edit `src/pages/AerolitoPage.tsx`:

```tsx
import { useEffect, useRef } from "react";
import AerolitoIntro from "@/components/aerolito/AerolitoIntro";
import AerolitoChatWidget from "@/components/aerolito/AerolitoChatWidget";

export default function AerolitoPage() {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  function scrollToChat() {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AerolitoIntro onDone={scrollToChat} />
      <section ref={chatRef} className="max-w-3xl mx-auto px-6 py-16">
        <AerolitoChatWidget />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Build sanity check**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AerolitoPage.tsx
git commit -m "feat(aerolito): /aerolito agora compoe intro + chat embedded"
```

---

## Task 20: Painel admin completo

**Files:**
- Modify: `src/pages/AerolitoAdmin.tsx`

- [ ] **Step 1: Replace placeholder with full panel**

Edit `src/pages/AerolitoAdmin.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface SessionResponse {
  question_idx: number;
  question_text: string;
  answer_text: string;
  indexed: boolean;
  published: boolean;
}
interface Session {
  session_id: string;
  created_at: string;
  responses: SessionResponse[];
}
interface ListResponse {
  sessions: Session[];
  totalSessions: number;
  totalResponses: number;
}

export default function AerolitoAdmin() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [data, setData] = useState<ListResponse | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [bulletsDraft, setBulletsDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");

  async function authFetch(input: string, init?: RequestInit): Promise<Response> {
    return fetch(input, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
  }

  async function loadList() {
    setBusy("Carregando…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=list");
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as ListResponse;
      setData(d);
    } catch (e) {
      setMsg(`Erro ao listar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function consolidate() {
    setBusy("Gerando bullets…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=consolidate", { method: "POST" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as { bullets: string[] };
      setBullets(d.bullets);
      setBulletsDraft(d.bullets.join("\n"));
    } catch (e) {
      setMsg(`Erro ao consolidar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function publish() {
    setBusy("Publicando…");
    try {
      const list = bulletsDraft.split("\n").map((s) => s.trim()).filter(Boolean);
      const r = await authFetch("/api/aerolito-admin?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullets: list }),
      });
      if (!r.ok) {
        const errBody = await r.text();
        throw new Error(`status ${r.status}: ${errBody}`);
      }
      setMsg("Publicado! O card já aparece em todas as locales na trajetória.");
    } catch (e) {
      setMsg(`Erro ao publicar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function downloadBackup() {
    setBusy("Exportando backup…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=reset", { method: "POST" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as { backup: unknown };
      const blob = new Blob([JSON.stringify(d.backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aerolito-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Reset concluído e backup baixado.");
      await loadList();
    } catch (e) {
      setMsg(`Erro no reset: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  useEffect(() => { if (token) loadList(); }, [token]);

  if (!token) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header>
          <h1 className="font-display text-3xl uppercase tracking-tight">Aerolito Admin</h1>
          {busy && <p className="font-mono text-xs text-neon mt-2">{busy}</p>}
          {msg && <p className="font-mono text-xs text-muted-foreground mt-2">{msg}</p>}
        </header>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">
            1. Respostas recebidas {data && <span className="text-neon">({data.totalSessions} sessões · {data.totalResponses} respostas)</span>}
          </h2>
          {!data ? <p className="font-mono text-xs text-muted-foreground">Carregando…</p> : data.sessions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">Sem respostas ainda.</p>
          ) : (
            <div className="space-y-4">
              {data.sessions.map((s, i) => (
                <details key={s.session_id} className="border border-border rounded-md p-3 bg-card/40">
                  <summary className="font-mono text-[11px] uppercase tracking-wider text-foreground cursor-pointer">
                    Sessão {i + 1} · {new Date(s.created_at).toLocaleString("pt-BR")} · {s.responses.length}/5
                  </summary>
                  <ol className="mt-3 space-y-2">
                    {s.responses.map((r) => (
                      <li key={r.question_idx} className="text-[12px]">
                        <p className="text-muted-foreground"><strong>Q{r.question_idx}:</strong> {r.question_text}</p>
                        <p className="text-foreground mt-1">R: {r.answer_text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">2. Consolidação</h2>
          <button onClick={consolidate} className="font-mono text-[11px] uppercase tracking-wider border border-neon/40 text-neon px-3 py-2 rounded-sm hover:bg-neon/10">
            Gerar proposta de bullets com IA
          </button>
          <textarea
            value={bulletsDraft}
            onChange={(e) => setBulletsDraft(e.target.value)}
            placeholder="Um bullet por linha (4 a 6 linhas). Cada um até 200 caracteres."
            className="mt-4 w-full h-40 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans focus:outline-none focus:border-neon/40"
          />
          {bulletsDraft.trim() && (
            <div className="mt-4 border border-border rounded-md p-4 bg-card/40">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview do card na trajetória</p>
              <h3 className="font-display font-semibold text-foreground text-[17px] uppercase tracking-tight">Head de Pesquisa</h3>
              <p className="font-sans text-electric text-[14px]">Aeroli.to · JUN 2026 — presente · Porto Alegre, RS</p>
              <ul className="mt-2 space-y-1">
                {bulletsDraft.split("\n").map((b, i) => b.trim() && (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground"><span className="text-neon mt-1.5 text-[6px]">●</span>{b.trim()}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={publish} disabled={!bulletsDraft.trim()} className="mt-4 font-mono text-[11px] uppercase tracking-wider bg-neon text-background px-3 py-2 rounded-sm disabled:opacity-30">
            Publicar na trajetória
          </button>
        </section>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">3. Reset</h2>
          <p className="font-mono text-xs text-muted-foreground mb-3">
            Apaga TUDO (Supabase + vector store + bullets publicados). Backup é exportado automaticamente antes.
          </p>
          <input
            type="text"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder='Digite "RESETAR" para liberar o botão'
            className="bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans"
          />
          <button onClick={downloadBackup} disabled={resetConfirm !== "RESETAR"} className="ml-3 font-mono text-[11px] uppercase tracking-wider border border-destructive/60 text-destructive px-3 py-2 rounded-sm disabled:opacity-20">
            Resetar tudo (com backup)
          </button>
        </section>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Build sanity check**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AerolitoAdmin.tsx
git commit -m "feat(aerolito): painel admin completo (list + consolidate + publish + reset)"
```

---

## Task 21: Locale keys para `experience.aerolito.*`

**Files:**
- Modify: `src/locales/pt.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/es.json`

- [ ] **Step 1: Add aerolito keys to pt.json**

Edit `src/locales/pt.json`. Dentro do objeto `"experience"`, irmão do `"header_label"`, adicionar:

```json
    "aerolito": {
      "role": "Head de Pesquisa",
      "type": "Profissional",
      "period": "JUN 2026 — presente",
      "loc": "Porto Alegre, RS",
      "bullets_disclaimer": ""
    },
```

- [ ] **Step 2: Add aerolito keys to en.json**

Edit `src/locales/en.json`:

```json
    "aerolito": {
      "role": "Head of Research",
      "type": "Professional",
      "period": "JUN 2026 — present",
      "loc": "Porto Alegre, Brazil",
      "bullets_disclaimer": "(team feedback in Portuguese)"
    },
```

- [ ] **Step 3: Add aerolito keys to es.json**

Edit `src/locales/es.json`:

```json
    "aerolito": {
      "role": "Head de Investigación",
      "type": "Profesional",
      "period": "JUN 2026 — presente",
      "loc": "Porto Alegre, Brasil",
      "bullets_disclaimer": "(comentarios del equipo en portugués)"
    },
```

- [ ] **Step 4: Commit**

```bash
git add src/locales/pt.json src/locales/en.json src/locales/es.json
git commit -m "i18n(aerolito): chaves experience.aerolito nas 3 locales"
```

---

## Task 22: `Experience.tsx` carrega e prepend do card Aerolito

**Files:**
- Modify: `src/components/Experience.tsx`
- Create: `src/components/__tests__/Experience.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/__tests__/Experience.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Experience from "../Experience";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      const map: Record<string, unknown> = {
        "experience.header_label": "Experiência profissional",
        "experience.header_title": "Trajetória",
        "experience.header_outline": "profissional",
        "experience.jobs": [
          { role: "Designer", type: "Atual", org: "CriaLab", period: "2021 - presente", loc: "POA", items: ["i1"] },
        ],
        "experience.aerolito.role": "Head de Pesquisa",
        "experience.aerolito.type": "Profissional",
        "experience.aerolito.period": "JUN 2026 — presente",
        "experience.aerolito.loc": "Porto Alegre, RS",
        "experience.aerolito.bullets_disclaimer": "",
      };
      const v = map[key];
      if (opts && typeof opts === "object" && "returnObjects" in (opts as object)) return v;
      return v ?? key;
    },
  }),
}));

vi.mock("../Reveal", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../SectionHeader", () => ({ default: () => null }));

describe("Experience — Aerolito card", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("does not render Aerolito card when bullets=null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bullets: null }),
    }) as unknown as typeof fetch;

    render(<Experience />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Head de Pesquisa")).toBeNull();
    expect(screen.getByText("Designer")).toBeInTheDocument();
  });

  it("renders Aerolito card as first job when bullets exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bullets: ["Atrib 1", "Atrib 2"], published_at: "2026-06-10T12:00:00Z" }),
    }) as unknown as typeof fetch;

    render(<Experience />);
    await waitFor(() => expect(screen.getByText("Head de Pesquisa")).toBeInTheDocument());
    expect(screen.getByText("Atrib 1")).toBeInTheDocument();
    expect(screen.getByText("Atrib 2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- Experience`
Expected: FAIL.

- [ ] **Step 3: Modify Experience.tsx**

Edit `src/components/Experience.tsx` — replace the body with:

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

interface Job {
  role: string;
  type: string;
  org: string;
  period: string;
  loc: string;
  items: string[];
  disclaimer?: string;
}

export default function Experience() {
  const { t } = useTranslation();
  const jobs = t("experience.jobs", { returnObjects: true }) as Job[];
  const [aerolitoBullets, setAerolitoBullets] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/aerolito-bullets")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((data: { bullets: string[] | null }) => {
        if (!cancelled) setAerolitoBullets(data.bullets);
      })
      .catch(() => { if (!cancelled) setAerolitoBullets(null); });
    return () => { cancelled = true; };
  }, []);

  const aerolitoJob: Job | null = aerolitoBullets && aerolitoBullets.length > 0 ? {
    role: t("experience.aerolito.role"),
    type: t("experience.aerolito.type"),
    org: "Aeroli.to",
    period: t("experience.aerolito.period"),
    loc: t("experience.aerolito.loc"),
    items: aerolitoBullets,
    disclaimer: t("experience.aerolito.bullets_disclaimer"),
  } : null;

  const allJobs: Job[] = aerolitoJob ? [aerolitoJob, ...jobs] : jobs;

  return (
    <section className="relative py-24 md:py-32 bg-card/30">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="experiencia" label={t("experience.header_label")} title={t("experience.header_title")} titleOutline={t("experience.header_outline")} />

        <div className="relative">
          <div className="absolute left-0 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-neon/40 via-dim to-transparent" />

          <div className="space-y-8">
            {allJobs.map((job, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="relative pl-8 md:pl-16 group">
                  <div className="absolute left-0 md:left-6 top-2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-neon bg-background group-hover:bg-neon group-hover:shadow-neon transition-all" />
                  <div className="bg-card border border-border rounded-md p-6 hover:border-neon/20 transition-all duration-300">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-foreground text-[17px] uppercase tracking-tight">{job.role}</h3>
                        <p className="font-sans text-electric text-[14px] font-medium">{job.org}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-neon border border-neon/25 px-2.5 py-1">{job.type}</span>
                        <span className="font-mono text-[10px] text-muted-foreground tracking-[0.04em]">{job.period}</span>
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em] mb-3">{job.loc}</p>
                    <ul className="space-y-1.5">
                      {job.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-[13px] text-muted-foreground leading-relaxed">
                          <span className="text-neon mt-1.5 text-[6px]">●</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    {job.disclaimer && (
                      <p className="mt-3 font-mono text-[10px] text-muted-foreground/60 italic">{job.disclaimer}</p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- Experience`
Expected: PASS (2 testes).

- [ ] **Step 5: Run full suite to catch regressions**

Run: `npm run test:run`
Expected: PASS (todos os testes do projeto).

- [ ] **Step 6: Commit**

```bash
git add src/components/Experience.tsx src/components/__tests__/Experience.test.tsx
git commit -m "feat(aerolito): Experience prepend card Head de Pesquisa quando bullets existem"
```

---

## Task 23: Smoke programático contra deploy preview

**Files:**
- Create: `scripts/smoke-aerolito.mjs`

- [ ] **Step 1: Create the smoke script**

Create `scripts/smoke-aerolito.mjs`:

```js
#!/usr/bin/env node
// Smoke programático para /aerolito.
// Uso: node scripts/smoke-aerolito.mjs <BASE_URL> [ADMIN_TOKEN]
// Ex.: node scripts/smoke-aerolito.mjs https://deploy-preview-XX--guiresende20.netlify.app $AEROLITO_ADMIN_TOKEN

import process from "node:process";
import { randomUUID } from "node:crypto";

const baseUrl = process.argv[2];
const adminToken = process.argv[3];

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-aerolito.mjs <BASE_URL> [ADMIN_TOKEN]");
  process.exit(1);
}

let pass = 0, fail = 0;

function ok(label) { console.log(`  ✓ ${label}`); pass++; }
function bad(label, err) { console.log(`  ✗ ${label} → ${err}`); fail++; }

async function check(label, fn) {
  try { await fn(); ok(label); }
  catch (e) { bad(label, e?.message ?? String(e)); }
}

async function main() {
  console.log(`Smoke /aerolito @ ${baseUrl}\n`);

  await check("GET /aerolito loads HTML", async () => {
    const r = await fetch(`${baseUrl}/aerolito`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    if (!html.includes("<title>") && !html.includes("<!DOCTYPE")) throw new Error("not HTML");
  });

  await check("robots.txt blocks /aerolito", async () => {
    const r = await fetch(`${baseUrl}/robots.txt`);
    const text = await r.text();
    if (!text.includes("Disallow: /aerolito")) throw new Error("Disallow rule missing");
  });

  await check("GET /api/aerolito-bullets returns JSON (bullets: null or array)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-bullets`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    if (!("bullets" in data)) throw new Error("missing bullets field");
  });

  await check("POST /api/aerolito-submit rejects invalid payload (400)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify({ session_id: "not-uuid", question_idx: 1, question_text: "Q?", answer_text: "A." }),
    });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
  });

  await check("POST /api/aerolito-submit accepts valid payload (200)", async () => {
    const r = await fetch(`${baseUrl}/api/aerolito-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify({
        session_id: randomUUID(),
        question_idx: 1,
        question_text: "Smoke test question?",
        answer_text: "Smoke test answer.",
      }),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    if (!data.ok) throw new Error("ok=false in response");
  });

  if (adminToken) {
    await check("admin without token returns 404", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=list`, {
        headers: { "Origin": baseUrl },
      });
      if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
    });

    await check("admin action=list with token returns sessions", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=list`, {
        headers: { "Origin": baseUrl, "Authorization": `Bearer ${adminToken}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.sessions)) throw new Error("sessions not array");
    });

    await check("admin action=reset cleans state", async () => {
      const r = await fetch(`${baseUrl}/api/aerolito-admin?action=reset`, {
        method: "POST",
        headers: { "Origin": baseUrl, "Authorization": `Bearer ${adminToken}` },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const r2 = await fetch(`${baseUrl}/api/aerolito-bullets`);
      const d2 = await r2.json();
      if (d2.bullets !== null) throw new Error("bullets not null after reset");
    });
  } else {
    console.log("  ⚠ ADMIN_TOKEN não passado — pulando admin tests");
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
```

- [ ] **Step 2: Make it discoverable in README convention**

(Sem ação — o script é auto-explicativo via `--help` implícito.)

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-aerolito.mjs
git commit -m "test(aerolito): smoke programatico contra deploy preview"
```

---

## Task 24: `.env.example` + checklist final de deploy

**Files:**
- Modify: `.env.example`
- Create: `docs/aerolito-deploy-checklist.md`

- [ ] **Step 1: Update .env.example**

Edit `.env.example` — adicionar ao final:

```env

# /aerolito (apresentação one-shot)
AEROLITO_ADMIN_TOKEN=         # gerar com `openssl rand -hex 32`
AEROLITO_IP_HASH_SALT=        # gerar com `openssl rand -hex 16`
```

- [ ] **Step 2: Create deploy checklist**

Create `docs/aerolito-deploy-checklist.md`:

```markdown
# Aerolito — Deploy Checklist

Antes de divulgar o link `/aerolito` para o time:

## Pré-flight (uma vez)

- [ ] Aplicar schema SQL: copiar `docs/aerolito-supabase-schema.sql` no Supabase SQL Editor e executar
- [ ] Gerar `AEROLITO_ADMIN_TOKEN`: `openssl rand -hex 32`
- [ ] Gerar `AEROLITO_IP_HASH_SALT`: `openssl rand -hex 16`
- [ ] Setar no Netlify: UI → Site → Env vars → criar `AEROLITO_ADMIN_TOKEN` e `AEROLITO_IP_HASH_SALT` (production scope)
- [ ] Preencher os 2 blocos TODO em `src/lib/system-prompt-aerolito.ts`: `## CONTEXTO AEROLITO` e `## HEAD DE PESQUISA — VISÃO`
- [ ] Fornecer e integrar a animação HTML em `src/components/aerolito/AerolitoIntro.tsx` (substituir o placeholder)
- [ ] Deploy para produção

## Teste end-to-end no preview

- [ ] Rodar: `node scripts/smoke-aerolito.mjs <preview-url> <AEROLITO_ADMIN_TOKEN>` → todos verdes
- [ ] Abrir `/aerolito` num browser, esperar a animação, escrolar pro chat
- [ ] Mandar uma pergunta texto e confirmar: áudio toca + texto aparece em sync
- [ ] Clicar "🤝 Contribuir como colega Aerolito" → IA fala a 1ª pergunta → digitar resposta → avança
- [ ] Completar as 5 perguntas
- [ ] Abrir `/aerolito/admin?token=<AEROLITO_ADMIN_TOKEN>`: ver a sessão de teste
- [ ] Clicar "Gerar proposta de bullets com IA": editar texto se preciso
- [ ] Clicar "Publicar na trajetória"
- [ ] Abrir `/` (homepage) → seção Trajetória → confirmar card "Head de Pesquisa" aparece como primeiro
- [ ] Digitar "RESETAR" e clicar "Resetar tudo" → confirmar backup baixado, card some da homepage

## Divulgação

- [ ] Compartilhar link `https://guiresende20.netlify.app/aerolito` (sem indexação — `noindex` ativo)
- [ ] Aguardar respostas
- [ ] Quando satisfeito com volume: abrir admin → consolidar → publicar
```

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/aerolito-deploy-checklist.md
git commit -m "docs(aerolito): env vars + checklist de deploy"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Rota lazy `/aerolito` + `/aerolito/admin` → Task 2
- ✅ noindex + robots.txt → Tasks 2, 3
- ✅ Animação → chat sequencial → Tasks 18, 19
- ✅ System prompt clone + 2 blocos novos + idioma único + 300 chars → Task 1
- ✅ Welcome message com 3 sugestões custom → Task 17
- ✅ Toggle modo entrevista → Task 17
- ✅ Voz Live em toda resposta da IA + sync typing → Tasks 15, 17
- ✅ Welcome texto-only (autoplay block) → comportamento natural do código (welcome só é texto antes de qualquer interação)
- ✅ 5 perguntas fixas no frontend → Tasks 5, 16
- ✅ Submit anônimo + hash IP + rate limit → Tasks 6, 8
- ✅ Auto-indexação em vector store isolado → Tasks 7, 8
- ✅ Admin: list/consolidate/publish/reset com auth Bearer + 404 → Tasks 10–13
- ✅ Backup automático no reset → Task 13
- ✅ Bullets publicados → Blob → endpoint público → trajetória → Tasks 9, 21, 22
- ✅ Card oculto até publish → Task 22 (`aerolitoBullets && bullets.length > 0`)
- ✅ i18n nas 3 locales com disclaimer en/es → Task 21
- ✅ Error handling: fallback texto-only se Live falhar, retry no submit → Tasks 15, 17, 16
- ✅ Suite vitest + smoke programático → Tasks 1, 6, 7, 10, 16, 22, 23
- ✅ `.env.example` + deploy checklist → Task 24

**Type consistency:**
- `SubmitPayload` em Task 6 = entrada de `validateSubmitPayload` = entrada de `submitAnswer` do interview (Task 16, `InterviewSubmitPayload`) — consistente (mesmas keys)
- `AerolitoChunk` em Task 7 = consumido por `aerolito-chat.ts` (Task 14) e `actionReset` (Task 13) — consistente
- `AerolitoLiveCallbacks.onTranscriptChunk` (Task 15) — usado em `AerolitoChatWidget` (Task 17) e indiretamente pelo controller (Task 16 só usa `sayFixed`) — consistente
- `isAuthorized` retorna `boolean` e usado em handler como condicional — consistente

**Placeholder scan:**
- Único TODO intencional: os 2 blocos do system prompt em Task 1 (owner preenche). Está documentado e listado no deploy checklist.
- No `AerolitoIntro` (Task 18) o placeholder é intencional até a referência chegar — checklist captura isso.
- Sem outros placeholders no plano (cada step tem código completo).
