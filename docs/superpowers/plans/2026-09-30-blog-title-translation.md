# Blog Title/Excerpt Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blog post titles and excerpts automatically translate to the site's active UI language (en/es) on the `/blog` listing, `/blog/tag/:tag`, and the post detail page's H1 — with no button click, reusing the existing per-post body-translation banner unchanged.

**Architecture:** `GET /api/blog/list` gains an optional `?lang=en|es` query param. On that branch it batch-translates every eligible post's title+excerpt in a single Gemini call, caches the result (`posts/list/translation/:lang`, 24h TTL, cleared by `/api/blog/revalidate`), and merges it into the existing `PostMeta[]` response. The frontend passes the active `useLocale()` value into `fetchPostList`, and `BlogPost.tsx` reuses the same endpoint/cache to get just its own post's translated title for the H1 — no second translation mechanism.

**Tech Stack:** Netlify Functions (TypeScript), `@google/generative-ai` (`gemini-3.1-flash-lite`, same model as `blog-translate.ts`), Netlify Blobs cache, React + `react-i18next` (`useLocale()`), Vitest.

Spec: `docs/superpowers/specs/2026-09-30-blog-title-translation-design.md`

---

### Task 1: `mergeTranslatedTitles` — pure merge logic

**Files:**
- Create: `netlify/functions/_lib/blog-list-translate.ts`
- Test: `netlify/functions/_lib/__tests__/blog-list-translate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// netlify/functions/_lib/__tests__/blog-list-translate.test.ts
import { describe, it, expect } from "vitest";
import { mergeTranslatedTitles, type TranslatedTitle } from "../blog-list-translate";
import type { PostMeta } from "../../../../src/lib/blog/frontmatter";

function meta(partial: Partial<PostMeta>): PostMeta {
  return {
    slug: "a",
    title: "Título original",
    date: "2026-01-01",
    lang: "pt",
    tags: [],
    excerpt: "Resumo original",
    draft: false,
    featured: false,
    readingTimeMin: 1,
    ...partial,
  };
}

describe("mergeTranslatedTitles", () => {
  it("replaces title and excerpt for a slug present in translations", () => {
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title", excerpt: "Original summary" }],
    ]);
    const [result] = mergeTranslatedTitles([meta({ slug: "a" })], translations);
    expect(result.title).toBe("Original title");
    expect(result.excerpt).toBe("Original summary");
  });

  it("leaves meta unchanged when slug is not in translations", () => {
    const [result] = mergeTranslatedTitles([meta({ slug: "b" })], new Map());
    expect(result.title).toBe("Título original");
    expect(result.excerpt).toBe("Resumo original");
  });

  it("falls back to the original excerpt when the translated entry has none", () => {
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title" }],
    ]);
    const [result] = mergeTranslatedTitles([meta({ slug: "a" })], translations);
    expect(result.title).toBe("Original title");
    expect(result.excerpt).toBe("Resumo original");
  });

  it("does not mutate the input metas array", () => {
    const original = meta({ slug: "a" });
    const translations = new Map<string, TranslatedTitle>([
      ["a", { title: "Original title" }],
    ]);
    mergeTranslatedTitles([original], translations);
    expect(original.title).toBe("Título original");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-list-translate.test.ts`
Expected: FAIL — `Cannot find module '../blog-list-translate'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// netlify/functions/_lib/blog-list-translate.ts
import type { PostMeta } from "../../../src/lib/blog/frontmatter";

export interface TranslatableItem {
  slug: string;
  title: string;
  excerpt?: string;
}

export interface TranslatedTitle {
  title: string;
  excerpt?: string;
}

export function mergeTranslatedTitles(
  metas: PostMeta[],
  translations: Map<string, TranslatedTitle>
): PostMeta[] {
  return metas.map((meta) => {
    const translated = translations.get(meta.slug);
    if (!translated) return meta;
    return {
      ...meta,
      title: translated.title,
      excerpt: translated.excerpt ?? meta.excerpt,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-list-translate.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/blog-list-translate.ts netlify/functions/_lib/__tests__/blog-list-translate.test.ts
git commit -m "feat(blog): add pure mergeTranslatedTitles helper"
```

---

### Task 2: `translateTitles` — batched Gemini call

**Files:**
- Modify: `netlify/functions/_lib/blog-list-translate.ts`
- Modify: `netlify/functions/_lib/__tests__/blog-list-translate.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the top of the test file (before the existing `describe("mergeTranslatedTitles"...)`):

```typescript
const generateContentMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});
```

And change the `import` line at the top to include `vi, beforeEach`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeTranslatedTitles, translateTitles, type TranslatedTitle } from "../blog-list-translate";
```

Add this new `describe` block (translateTitles must be imported dynamically per test, same pattern as `embeddings.test.ts`, since `GEMINI_API_KEY` is read at call time, not import time — plain `import` at the top works fine here since the check happens inside the function body on each call, not at module load):

```typescript
describe("translateTitles", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns an empty map and never calls the API for empty input", async () => {
    const result = await translateTitles([], "en");
    expect(result.size).toBe(0);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns an empty map when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("parses a valid JSON array response into a Map keyed by slug", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify([
            { slug: "a", title: "Original title", excerpt: "Original summary" },
          ]),
      },
    });
    const result = await translateTitles(
      [{ slug: "a", title: "Título", excerpt: "Resumo" }],
      "en"
    );
    expect(result.get("a")).toEqual({ title: "Original title", excerpt: "Original summary" });
  });

  it("omits excerpt when the model response doesn't include one", async () => {
    generateContentMock.mockResolvedValue({
      response: { text: () => JSON.stringify([{ slug: "a", title: "Original title" }]) },
    });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.get("a")).toEqual({ title: "Original title", excerpt: undefined });
  });

  it("extracts the JSON array even if the model wraps it in commentary", async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => 'Here you go:\n```json\n[{"slug":"a","title":"Original title"}]\n```',
      },
    });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.get("a")?.title).toBe("Original title");
  });

  it("returns an empty map when the model response is not valid JSON", async () => {
    generateContentMock.mockResolvedValue({ response: { text: () => "not json at all" } });
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
  });

  it("returns an empty map when the API call rejects", async () => {
    generateContentMock.mockRejectedValue(new Error("429 quota"));
    const result = await translateTitles([{ slug: "a", title: "Título" }], "en");
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-list-translate.test.ts`
Expected: FAIL — `translateTitles is not exported` / `is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `netlify/functions/_lib/blog-list-translate.ts` (above `mergeTranslatedTitles`):

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT_PREFIX = (targetLang: "en" | "es") => `You are a translator. Translate the following blog post titles and excerpts from Portuguese to ${targetLang === "en" ? "English" : "Spanish"}.

Rules:
- Keep proper nouns (people, brands, project names) untouched.
- Match the author's tone — first-person, conversational when the original is.
- Return ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
  [{"slug": "...", "title": "...", "excerpt": "..."}]
- Include every slug from the input, in the same order.
- Omit "excerpt" from an item's output if that item had no "excerpt" in the input.

Input:
`;

export async function translateTitles(
  items: TranslatableItem[],
  lang: "en" | "es"
): Promise<Map<string, TranslatedTitle>> {
  if (items.length === 0) return new Map();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("blog-list-translate: GEMINI_API_KEY not configured");
    return new Map();
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
    const result = await model.generateContent(PROMPT_PREFIX(lang) + JSON.stringify(items));
    const raw = result.response.text().trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const clean = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) throw new Error("expected a JSON array");

    const map = new Map<string, TranslatedTitle>();
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as Record<string, unknown>).slug !== "string" ||
        typeof (entry as Record<string, unknown>).title !== "string"
      ) {
        continue;
      }
      const e = entry as { slug: string; title: string; excerpt?: unknown };
      map.set(e.slug, {
        title: e.title,
        excerpt: typeof e.excerpt === "string" ? e.excerpt : undefined,
      });
    }
    return map;
  } catch (err) {
    console.error("blog-list-translate: translation failed", err);
    return new Map();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-list-translate.test.ts`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/blog-list-translate.ts netlify/functions/_lib/__tests__/blog-list-translate.test.ts
git commit -m "feat(blog): add batched Gemini title/excerpt translation"
```

---

### Task 3: Wire `?lang=` into `blog-list.ts`

**Files:**
- Modify: `netlify/functions/blog-list.ts`

- [ ] **Step 1: Replace the handler body**

Replace the full contents of `netlify/functions/blog-list.ts` with:

```typescript
import type { Handler } from "@netlify/functions";
import { listFolder } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { ensureBlobsContext } from "./_lib/blobs-context";
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
import { translateTitles, mergeTranslatedTitles, type TranslatedTitle } from "./_lib/blog-list-translate";
import type { PostMeta } from "../../src/lib/blog/frontmatter";
import { corsHeaders, getRequestOrigin, isOriginAllowed } from "./_lib/security";

const TTL_MS = 24 * 60 * 60_000; // 24h — conteúdo é invalidado explicitamente via /api/blog/revalidate

function parseLang(value: string | null): "en" | "es" | null {
  return value === "en" || value === "es" ? value : null;
}

export const handler: Handler = async (event) => {
  ensureBlobsContext(event);
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "GET"), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const headers: Record<string, string> = {
    ...(allowed ? corsHeaders(origin, "GET") : {}),
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
  };

  const lang = parseLang(new URL(event.rawUrl).searchParams.get("lang"));

  const cacheKey = "posts/list";
  const cachedList = await getCached<PostMeta[]>(cacheKey);

  let metas: PostMeta[];
  let listWasCached: boolean;

  if (cachedList) {
    metas = cachedList;
    listWasCached = true;
  } else {
    const folders = await resolveBlogFolders();
    const files = await listFolder(folders.rootId);
    const sources = files.filter(isBlogPostSource);

    // Busca e parseia todos os arquivos em paralelo (não em série) e sem buscar
    // imagens em alta resolução — esta rota só usa meta, nunca body/imagens.
    const results = await Promise.allSettled(
      sources.map((file) => fetchAndParse(file, { withImages: false }))
    );

    const built: PostMeta[] = [];
    const seen = new Set<string>();
    results.forEach((result, i) => {
      const file = sources[i];
      if (result.status === "rejected") {
        console.error("blog: skipping", { name: file.name, id: file.id, err: result.reason });
        return;
      }
      const { meta } = result.value;
      if (meta.draft) return;
      if (seen.has(meta.slug)) {
        console.error("blog: duplicate slug, skipping", { slug: meta.slug, name: file.name });
        return;
      }
      seen.add(meta.slug);
      built.push(meta);
    });

    built.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.date.localeCompare(a.date);
    });

    await setCached(cacheKey, built, TTL_MS);
    metas = built;
    listWasCached = false;
  }

  if (!lang) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: metas, cached: listWasCached }),
    };
  }

  const translationCacheKey = `posts/list/translation/${lang}`;
  const cachedTranslations = await getCached<Array<[string, TranslatedTitle]>>(translationCacheKey);

  let translations: Map<string, TranslatedTitle>;
  let translationWasCached: boolean;
  if (cachedTranslations) {
    translations = new Map(cachedTranslations);
    translationWasCached = true;
  } else {
    const eligible = metas
      .filter((m) => m.lang === "pt")
      .map((m) => ({ slug: m.slug, title: m.title, excerpt: m.excerpt }));
    translations = await translateTitles(eligible, lang);
    await setCached(translationCacheKey, Array.from(translations.entries()), TTL_MS);
    translationWasCached = false;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      posts: mergeTranslatedTitles(metas, translations),
      cached: listWasCached && translationWasCached,
    }),
  };
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.functions.json --noEmit`
Expected: no errors

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npm run test:run`
Expected: all tests pass (existing suite + the 11 new ones from Task 1/2)

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-list.ts
git commit -m "feat(blog): accept ?lang= on /api/blog/list to translate titles/excerpts"
```

---

### Task 4: Invalidate translation cache on revalidate

**Files:**
- Modify: `netlify/functions/blog-revalidate.ts:94-96`
- Create: `netlify/functions/__tests__/blog-revalidate.test.ts`

`blog-revalidate.ts`'s handler pulls together Blobs cache, Drive, and RAG
indexing — no existing test mocks all of that (no test file exists for it
today). Rather than skip coverage for this change, extract the list of cache
keys to clear into its own pure, testable function.

- [ ] **Step 1: Write the failing test**

```typescript
// netlify/functions/__tests__/blog-revalidate.test.ts
import { describe, it, expect } from "vitest";
import { keysToInvalidateForSlug } from "../blog-revalidate";

describe("keysToInvalidateForSlug", () => {
  it("includes the list, the post, the chatbot summary, and both title-translation caches", () => {
    expect(keysToInvalidateForSlug("meu-post")).toEqual([
      "posts/list",
      "posts/meu-post",
      "posts/prompt-summary",
      "posts/list/translation/en",
      "posts/list/translation/es",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/__tests__/blog-revalidate.test.ts`
Expected: FAIL — `keysToInvalidateForSlug` is not exported from `../blog-revalidate`

- [ ] **Step 3: Add the function and use it in the handler**

In `netlify/functions/blog-revalidate.ts`, add this exported function near the
top (after the existing imports, before `listMdFiles`):

```typescript
export function keysToInvalidateForSlug(slug: string): string[] {
  return [
    "posts/list",
    `posts/${slug}`,
    "posts/prompt-summary", // chatbot summary uses same source
    "posts/list/translation/en",
    "posts/list/translation/es",
  ];
}
```

Then find:

```typescript
  await deleteCached("posts/list");
  await deleteCached(`posts/${slug}`);
  await deleteCached("posts/prompt-summary"); // chatbot summary uses same source
```

Replace with:

```typescript
  for (const key of keysToInvalidateForSlug(slug)) {
    await deleteCached(key);
  }
```

(The `?all=true` branch already clears everything under `posts/` via `deleteByPrefix("posts/")`, so it needs no change — it already covers the two new translation keys.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/__tests__/blog-revalidate.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.functions.json --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/blog-revalidate.ts netlify/functions/__tests__/blog-revalidate.test.ts
git commit -m "fix(blog): clear title-translation cache on post revalidate"
```

---

### Task 5: `fetchPostList(lang?)` in the frontend API client

**Files:**
- Modify: `src/lib/blog/api.ts`
- Create: `src/lib/blog/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/blog/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPostList } from "../api";

describe("fetchPostList", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ posts: [], cached: true }),
      })
    );
  });

  it("calls /api/blog/list with no query string when lang is omitted", async () => {
    await fetchPostList();
    expect(fetch).toHaveBeenCalledWith("/api/blog/list");
  });

  it("calls /api/blog/list with no query string when lang is 'pt'", async () => {
    await fetchPostList("pt");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list");
  });

  it("appends ?lang=en when lang is 'en'", async () => {
    await fetchPostList("en");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list?lang=en");
  });

  it("appends ?lang=es when lang is 'es'", async () => {
    await fetchPostList("es");
    expect(fetch).toHaveBeenCalledWith("/api/blog/list?lang=es");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/blog/__tests__/api.test.ts`
Expected: FAIL — current `fetchPostList` takes no arguments, so the `?lang=` assertions fail (it always calls `fetch("/api/blog/list")`)

- [ ] **Step 3: Update `fetchPostList`**

In `src/lib/blog/api.ts`, replace:

```typescript
export async function fetchPostList(): Promise<PostMeta[]> {
  const res = await fetch("/api/blog/list");
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const data = (await res.json()) as ListResponse;
  return data.posts;
}
```

With:

```typescript
export async function fetchPostList(lang?: string): Promise<PostMeta[]> {
  const url = lang && lang !== "pt" ? `/api/blog/list?lang=${encodeURIComponent(lang)}` : "/api/blog/list";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const data = (await res.json()) as ListResponse;
  return data.posts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/blog/__tests__/api.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/api.ts src/lib/blog/__tests__/api.test.ts
git commit -m "feat(blog): fetchPostList accepts an optional lang param"
```

---

### Task 6: Auto-translate titles on `/blog`

**Files:**
- Modify: `src/pages/Blog.tsx:1-19`

- [ ] **Step 1: Wire in `useLocale()`**

In `src/pages/Blog.tsx`, replace:

```tsx
import { useEffect, useState, useMemo } from "react";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";

const PAGE_SIZE = 15;

export default function Blog() {
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchPostList()
      .then(setPosts)
      .catch((e) => setError(String(e)));
  }, []);
```

With:

```tsx
import { useEffect, useState, useMemo } from "react";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import { useLocale } from "../lib/blog/format";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";

const PAGE_SIZE = 15;

export default function Blog() {
  const lang = useLocale();
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchPostList(lang)
      .then(setPosts)
      .catch((e) => setError(String(e)));
  }, [lang]);
```

(No other changes needed — `posts` isn't reset to `null` before the fetch resolves, so the previous-language titles stay on screen with zero flash until the new ones arrive, per spec.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Blog.tsx
git commit -m "feat(blog): auto-translate post titles/excerpts on /blog when UI language changes"
```

---

### Task 7: Auto-translate titles on `/blog/tag/:tag`

**Files:**
- Modify: `src/pages/BlogTag.tsx:1-16`

- [ ] **Step 1: Wire in `useLocale()`**

In `src/pages/BlogTag.tsx`, replace:

```tsx
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";
import TransitionLink from "../components/TransitionLink";

export default function BlogTag() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPostList().then(setPosts).catch((e) => setError(String(e)));
  }, []);
```

With:

```tsx
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import { useLocale } from "../lib/blog/format";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";
import TransitionLink from "../components/TransitionLink";

export default function BlogTag() {
  const { tag } = useParams<{ tag: string }>();
  const lang = useLocale();
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPostList(lang).then(setPosts).catch((e) => setError(String(e)));
  }, [lang]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/BlogTag.tsx
git commit -m "feat(blog): auto-translate post titles/excerpts on /blog/tag when UI language changes"
```

---

### Task 8: Auto-translate the H1 title on the post page

**Files:**
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Import `fetchPostList` and add translated-title state**

In `src/pages/BlogPost.tsx`, change the import line:

```tsx
import { fetchPost, type PostResponse } from "../lib/blog/api";
```

to:

```tsx
import { fetchPost, fetchPostList, type PostResponse } from "../lib/blog/api";
```

Then, right after the existing translation-related state declarations:

```tsx
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
```

add:

```tsx
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
```

- [ ] **Step 2: Add the title-translation effect**

Right after the existing `useEffect` that fetches the post (the one calling `fetchPost(slug)`), add a new effect:

```tsx
  useEffect(() => {
    setTranslatedTitle(null);
    if (!post || post.meta.lang !== "pt") return;
    if (userLang !== "en" && userLang !== "es") return;
    let cancelled = false;
    fetchPostList(userLang)
      .then((list) => {
        if (cancelled) return;
        const match = list.find((p) => p.slug === post.meta.slug);
        if (match) setTranslatedTitle(match.title);
      })
      .catch(() => {
        // best-effort: mantém o título em português se a tradução falhar
      });
    return () => {
      cancelled = true;
    };
  }, [post, userLang]);
```

- [ ] **Step 3: Render the translated title**

Replace:

```tsx
              <h1 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
                {post.meta.title}
              </h1>
```

With:

```tsx
              <h1 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
                {translatedTitle ?? post.meta.title}
              </h1>
```

(Everything else — `blogPostingJsonLd`, `ShareButtons`, `DisqusEmbed`, the body-translate banner — keeps using `post.meta.title`/`bodyToRender` exactly as today. Only the visible H1 changes; JSON-LD/share/Disqus intentionally keep the canonical Portuguese title.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/BlogPost.tsx
git commit -m "feat(blog): auto-translate the post H1 title when UI language changes"
```

---

### Task 9: Full validation, deploy, production smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test:run`
Expected: all tests pass, including the new ones from Tasks 1, 2, 5

- [ ] **Step 2: Full typecheck**

Run: `npx tsc -b && npx tsc -p tsconfig.functions.json --noEmit`
Expected: no errors

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

- [ ] **Step 5: Wait for the Netlify deploy, then smoke-test in production**

Once deployed, run (I run this myself — no manual browser testing required of the user):

```bash
curl -s "https://guiresende20.netlify.app/api/blog/list?lang=en" | head -c 2000
```

Expected: JSON with `posts[].title` in English for every `lang: "pt"` post.

```bash
curl -s "https://guiresende20.netlify.app/api/blog/list?lang=es" | head -c 2000
```

Expected: same, in Spanish.

```bash
curl -s "https://guiresende20.netlify.app/api/blog/list" | head -c 500
```

Expected: unchanged — titles still in Portuguese, confirming the no-`lang` path is untouched.

- [ ] **Step 6: Confirm revalidate clears the new cache keys**

```bash
netlify blobs:get blog "posts/list/translation/en"
```

Expected: returns the cached translation JSON (proves Task 3 populated it during Step 5). Then, after triggering a revalidate for any existing slug (needs `BLOG_REVALIDATE_TOKEN`, or use `netlify blobs:delete` directly to simulate):

```bash
netlify blobs:delete blog "posts/list/translation/en"
netlify blobs:delete blog "posts/list/translation/es"
```

Then repeat Step 5's `?lang=en` curl and confirm it still returns translated titles (cache rebuilds transparently).
