# Google Docs como source do blog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escrever posts em Google Docs no `blog/` do Drive, lado a lado com `.md`, convergindo pra `ParsedPost` num único ponto de branch sem regredir os 7 consumidores.

**Architecture:** Server-side export on demand. Novo `fetchAndParse(f)` encapsula `mimeType` → escolhe `downloadText+parsePost` (`.md`) ou `exportDocAsMarkdown+parseDocPost` (Doc). Consumers usam `isBlogPostSource(f)` no filtro de listing. `drafts/` é filtrado naturalmente porque `listFolder` não recursa.

**Tech Stack:** TypeScript, Netlify Functions (Lambda-style com `Handler`/`HandlerEvent`), `googleapis` SDK (`google.drive`), vitest pra unit tests, `@netlify/blobs` (cache via `blob-cache.ts` existente).

**Spec:** `docs/superpowers/specs/2026-05-18-google-docs-source-design.md`

---

## File Structure

**New files:**
- `netlify/functions/_lib/blog-source.ts` — `isBlogPostSource(f)`, `fetchAndParse(f)`
- `src/lib/blog/__tests__/slugify.test.ts`
- `src/lib/blog/__tests__/parse-doc-post.test.ts`
- `netlify/functions/_lib/__tests__/blog-source.test.ts`

**Modified files (foundation):**
- `netlify/functions/_lib/drive.ts` — add `createdTime` to `DriveFile` interface and `fields:` of `listFolder`; add `exportDocAsMarkdown(fileId)` helper
- `src/lib/blog/frontmatter.ts` — add `slugify(s)` helper, add `parseDocPost(raw, name, createdTime)` function

**Modified files (consumers — minimal changes):**
- `netlify/functions/chat.ts` (`getPostsForPrompt`)
- `netlify/functions/blog-list.ts`
- `netlify/functions/blog-post.ts`
- `netlify/functions/blog-rss.ts`
- `netlify/functions/sitemap.ts`
- `netlify/functions/blog-reindex.ts`
- `netlify/functions/blog-translate.ts`

**Modified docs:**
- `docs/blog-setup.md` — new sections 5.2 (Google Doc), 7 (Drafts), 8 (md vs Doc), 9 (Limitações); bonus fix de `text-embedding-004` → `gemini-embedding-001`

---

## Task 1: Extend `DriveFile` with `createdTime`

`parseDocPost` precisa de `createdTime` mas o `DriveFile` atual só expõe `modifiedTime`. Mudança trivial mas precisa vir primeiro pra outras tarefas referenciarem.

**Files:**
- Modify: `netlify/functions/_lib/drive.ts:21-26` (interface), `:30-34` (fields)

- [ ] **Step 1: Edit the `DriveFile` interface to add `createdTime`**

Edit `netlify/functions/_lib/drive.ts`. Find:
```ts
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}
```

Replace with:
```ts
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
}
```

- [ ] **Step 2: Update `listFolder` fields query**

In the same file, find:
```ts
fields: "files(id, name, mimeType, modifiedTime)",
```

Replace with:
```ts
fields: "files(id, name, mimeType, modifiedTime, createdTime)",
```

- [ ] **Step 3: Build to confirm no type errors**

Run: `npm run build`
Expected: builds clean (consumers that don't use `createdTime` are unaffected; adding a required field on the interface might surface places that construct `DriveFile` literals — there should be none outside the file, but the build confirms).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/_lib/drive.ts
git commit -m "feat(drive): expose createdTime on DriveFile"
```

---

## Task 2: Add `exportDocAsMarkdown` to `drive.ts`

Thin wrapper sobre `drive.files.export`. Sem teste unitário (mockar googleapis SDK é overhead alto pra um wrapper de 5 linhas — vai ser exercitado por `fetchAndParse` tests com mocks de `drive.ts` inteiro, e pelo smoke pós-deploy).

**Files:**
- Modify: `netlify/functions/_lib/drive.ts` (add helper)

- [ ] **Step 1: Add the helper after `downloadText`**

Edit `netlify/functions/_lib/drive.ts`. Find `downloadText` function (lines 38-45). Add right after it:

```ts
export async function exportDocAsMarkdown(fileId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.export(
    { fileId, mimeType: "text/markdown" },
    { responseType: "text" }
  );
  return res.data as string;
}
```

- [ ] **Step 2: Build to confirm**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/_lib/drive.ts
git commit -m "feat(drive): add exportDocAsMarkdown helper"
```

---

## Task 3: Add `slugify` helper in `frontmatter.ts` (TDD)

Pure function. Unicode-safe (NFD + strip diacriticals). Exportar pra testes.

**Files:**
- Create: `src/lib/blog/__tests__/slugify.test.ts`
- Modify: `src/lib/blog/frontmatter.ts` (add helper)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/blog/__tests__/slugify.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "../frontmatter";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips Portuguese accents via NFD", () => {
    expect(slugify("Por trás do blog")).toBe("por-tras-do-blog");
    expect(slugify("João é ótimo")).toBe("joao-e-otimo");
    expect(slugify("Coração")).toBe("coracao");
  });

  it("replaces punctuation and special chars with hyphens", () => {
    expect(slugify("Hello, world!!!")).toBe("hello-world");
    expect(slugify("100% Java")).toBe("100-java");
    expect(slugify("a/b/c")).toBe("a-b-c");
  });

  it("collapses sequences of separators into a single hyphen", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
    expect(slugify("a , b , c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("!!hi!!")).toBe("hi");
  });

  it("returns empty string for input with no alphanumerics", () => {
    expect(slugify("???")).toBe("");
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("preserves digits", () => {
    expect(slugify("O que aprendi em 2024")).toBe("o-que-aprendi-em-2024");
  });

  it("handles unicode emoji by stripping", () => {
    expect(slugify("Hello 👋 world")).toBe("hello-world");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/blog/__tests__/slugify.test.ts`
Expected: FAIL with "Failed to resolve import" or "slugify is not a function" — the function doesn't exist yet.

- [ ] **Step 3: Implement `slugify` in `frontmatter.ts`**

Edit `src/lib/blog/frontmatter.ts`. After the existing imports/types (before `slugFromFilename`), add:

```ts
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacriticals
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/blog/__tests__/slugify.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/frontmatter.ts src/lib/blog/__tests__/slugify.test.ts
git commit -m "feat(blog): add unicode-safe slugify helper"
```

---

## Task 4: Add `parseDocPost` in `frontmatter.ts` (TDD)

Pure function. Convenção: primeira linha `Tags: ...` define tags; resto vira body. Title vem do `driveName`, slug é `slugify(driveName)`, date é `createdTime[0..10]`. Lang/draft/featured/cover hardcoded.

**Files:**
- Create: `src/lib/blog/__tests__/parse-doc-post.test.ts`
- Modify: `src/lib/blog/frontmatter.ts` (add function)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/blog/__tests__/parse-doc-post.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDocPost } from "../frontmatter";

const CREATED = "2026-05-18T10:30:00.000Z";

describe("parseDocPost — tags line", () => {
  it("extracts tags from first line and removes it from body", () => {
    const raw = "Tags: ia, blog, meta\n\nCorpo do post.";
    const r = parseDocPost(raw, "Meu post", CREATED);
    expect(r.meta.tags).toEqual(["ia", "blog", "meta"]);
    expect(r.body).toBe("Corpo do post.");
  });

  it("accepts 'Tag:' (singular)", () => {
    const raw = "Tag: solo\n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["solo"]);
  });

  it("accepts 'TAGS:' (uppercase)", () => {
    const raw = "TAGS: a, b\n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["a", "b"]);
  });

  it("tolerates spaces and trims values", () => {
    const raw = "Tags : a, b ,, c, \n\nCorpo.";
    expect(parseDocPost(raw, "x", CREATED).meta.tags).toEqual(["a", "b", "c"]);
  });

  it("with no Tags line, returns empty tags and intact body", () => {
    const raw = "Primeira linha sem tags.\n\nSegunda.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Primeira linha sem tags.\n\nSegunda.");
  });

  it("empty Tags value yields empty tags but still strips the line", () => {
    const raw = "Tags:\n\nCorpo.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Corpo.");
  });

  it("does not match Tags mid-body", () => {
    const raw = "Intro.\n\nTags: not real.";
    const r = parseDocPost(raw, "x", CREATED);
    expect(r.meta.tags).toEqual([]);
    expect(r.body).toBe("Intro.\n\nTags: not real.");
  });
});

describe("parseDocPost — derived fields", () => {
  it("uses driveName as title", () => {
    expect(parseDocPost("body", "Pensando em design", CREATED).meta.title).toBe(
      "Pensando em design"
    );
  });

  it("derives slug via slugify(driveName)", () => {
    expect(parseDocPost("body", "Por trás do blog", CREATED).meta.slug).toBe(
      "por-tras-do-blog"
    );
  });

  it("derives date from createdTime slice 0..10", () => {
    expect(parseDocPost("body", "x", "2026-05-18T10:30:00.000Z").meta.date).toBe(
      "2026-05-18"
    );
  });

  it("hardcodes lang to pt, draft/featured to false, cover undefined", () => {
    const m = parseDocPost("body", "x", CREATED).meta;
    expect(m.lang).toBe("pt");
    expect(m.draft).toBe(false);
    expect(m.featured).toBe(false);
    expect(m.cover).toBeUndefined();
  });

  it("computes readingTimeMin", () => {
    const words = Array.from({ length: 400 }, () => "palavra").join(" ");
    expect(parseDocPost(words, "x", CREATED).meta.readingTimeMin).toBe(2);
  });
});

describe("parseDocPost — excerpt", () => {
  it("uses first paragraph after stripping tags", () => {
    const raw = "Tags: a\n\nPrimeiro parágrafo curto.\n\nSegundo.";
    expect(parseDocPost(raw, "x", CREATED).meta.excerpt).toBe(
      "Primeiro parágrafo curto."
    );
  });

  it("truncates long excerpts at word boundary with ellipsis", () => {
    const long = "palavra ".repeat(50).trim();
    const r = parseDocPost(long, "x", CREATED);
    expect(r.meta.excerpt!.length).toBeLessThanOrEqual(201);
    expect(r.meta.excerpt!.endsWith("…")).toBe(true);
    expect(r.meta.excerpt!.endsWith(" …")).toBe(false);
  });

  it("uses whole body if no paragraph separator", () => {
    expect(parseDocPost("Linha única.", "x", CREATED).meta.excerpt).toBe(
      "Linha única."
    );
  });

  it("empty body yields empty excerpt", () => {
    expect(parseDocPost("", "x", CREATED).meta.excerpt).toBe("");
  });

  it("with only a tags line, excerpt is empty", () => {
    expect(parseDocPost("Tags: a", "x", CREATED).meta.excerpt).toBe("");
  });
});

describe("parseDocPost — error cases", () => {
  it("throws when slug derivation yields empty string", () => {
    expect(() => parseDocPost("body", "???", CREATED)).toThrow(/slug/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/blog/__tests__/parse-doc-post.test.ts`
Expected: FAIL — `parseDocPost` not defined.

- [ ] **Step 3: Implement `parseDocPost` in `frontmatter.ts`**

Edit `src/lib/blog/frontmatter.ts`. Add at the end of the file:

```ts
const TAGS_LINE_RE = /^Tags?\s*:\s*(.*)$/i;
const EXCERPT_MAX = 200;

function extractTagsAndStripLine(body: string): { tags: string[]; body: string } {
  const lines = body.split(/\r?\n/);
  // Find the first non-empty line
  let firstNonEmptyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      firstNonEmptyIdx = i;
      break;
    }
  }
  if (firstNonEmptyIdx === -1) return { tags: [], body };

  const match = TAGS_LINE_RE.exec(lines[firstNonEmptyIdx]);
  if (!match) return { tags: [], body };

  const rawTags = match[1] ?? "";
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Remove the matched line, plus any single blank line immediately following.
  const next = lines.slice(firstNonEmptyIdx + 1);
  if (next.length > 0 && next[0].trim() === "") next.shift();
  const newBody = [...lines.slice(0, firstNonEmptyIdx), ...next].join("\n").replace(/^\n+/, "");
  return { tags, body: newBody };
}

function makeExcerpt(body: string, max = EXCERPT_MAX): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  const firstPara = trimmed.split(/\n\s*\n/)[0].trim();
  if (firstPara.length <= max) return firstPara;
  const truncated = firstPara.slice(0, max).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const sliced = lastSpace > 0 ? truncated.slice(0, lastSpace).trimEnd() : truncated;
  return sliced + "…";
}

export function parseDocPost(
  raw: string,
  driveName: string,
  createdTime: string,
): ParsedPost {
  const slug = slugify(driveName);
  if (slug.length === 0) {
    throw new Error(`parseDocPost: invalid slug derived from name "${driveName}"`);
  }

  const { tags, body } = extractTagsAndStripLine(raw);
  const excerpt = makeExcerpt(body);
  const date = createdTime.slice(0, 10);

  const meta: PostMeta = {
    slug,
    title: driveName,
    date,
    lang: "pt",
    tags,
    cover: undefined,
    excerpt,
    draft: false,
    featured: false,
    readingTimeMin: readingTime(body),
  };
  return { meta, body };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/blog/__tests__/parse-doc-post.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Run full test suite to ensure no regression**

Run: `npm run test:run`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/blog/frontmatter.ts src/lib/blog/__tests__/parse-doc-post.test.ts
git commit -m "feat(blog): add parseDocPost for Google Docs source"
```

---

## Task 5: Create `blog-source.ts` with `isBlogPostSource` (TDD)

Helper que decide se um `DriveFile` é uma source de post válida (`.md` por extensão/mimeType OU Google Doc).

**Files:**
- Create: `netlify/functions/_lib/blog-source.ts`
- Create: `netlify/functions/_lib/__tests__/blog-source.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `netlify/functions/_lib/__tests__/blog-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isBlogPostSource } from "../blog-source";
import type { DriveFile } from "../drive";

function file(partial: Partial<DriveFile>): DriveFile {
  return {
    id: "id",
    name: "name",
    mimeType: "application/octet-stream",
    modifiedTime: "2026-01-01T00:00:00Z",
    createdTime: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("isBlogPostSource", () => {
  it("accepts .md by extension", () => {
    expect(isBlogPostSource(file({ name: "foo.md", mimeType: "application/octet-stream" }))).toBe(true);
  });

  it("accepts .MD (uppercase) by extension", () => {
    expect(isBlogPostSource(file({ name: "foo.MD" }))).toBe(true);
  });

  it("accepts text/markdown mimeType", () => {
    expect(isBlogPostSource(file({ name: "no-ext", mimeType: "text/markdown" }))).toBe(true);
  });

  it("accepts Google Doc mimeType", () => {
    expect(
      isBlogPostSource(file({ name: "Pensando em X", mimeType: "application/vnd.google-apps.document" }))
    ).toBe(true);
  });

  it("rejects folder mimeType", () => {
    expect(
      isBlogPostSource(file({ name: "drafts", mimeType: "application/vnd.google-apps.folder" }))
    ).toBe(false);
  });

  it("rejects image mimeType", () => {
    expect(isBlogPostSource(file({ name: "foo.jpg", mimeType: "image/jpeg" }))).toBe(false);
  });

  it("rejects .txt", () => {
    expect(isBlogPostSource(file({ name: "foo.txt", mimeType: "text/plain" }))).toBe(false);
  });

  it("rejects unknown mimeType without .md extension", () => {
    expect(isBlogPostSource(file({ name: "foo", mimeType: "application/octet-stream" }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-source.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `blog-source.ts` with `isBlogPostSource`**

Create `netlify/functions/_lib/blog-source.ts`:

```ts
import type { DriveFile } from "./drive";

const DOC_MIMETYPE = "application/vnd.google-apps.document";
const MD_MIMETYPE = "text/markdown";

export function isBlogPostSource(f: DriveFile): boolean {
  if (f.mimeType === DOC_MIMETYPE) return true;
  if (f.mimeType === MD_MIMETYPE) return true;
  if (/\.md$/i.test(f.name)) return true;
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-source.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/blog-source.ts netlify/functions/_lib/__tests__/blog-source.test.ts
git commit -m "feat(blog-source): add isBlogPostSource helper"
```

---

## Task 6: Add `fetchAndParse` to `blog-source.ts` (TDD with mocks)

Branch único por mimeType: Doc → export + parseDocPost; outro → downloadText + parsePost. Mocks via `vi.mock("../drive")`.

**Files:**
- Modify: `netlify/functions/_lib/blog-source.ts` (add function)
- Modify: `netlify/functions/_lib/__tests__/blog-source.test.ts` (add tests)

- [ ] **Step 1: Add failing tests for `fetchAndParse`**

Append to `netlify/functions/_lib/__tests__/blog-source.test.ts`:

```ts
import { vi } from "vitest";
import { fetchAndParse } from "../blog-source";

vi.mock("../drive", async () => {
  return {
    downloadText: vi.fn(),
    exportDocAsMarkdown: vi.fn(),
  };
});

import { downloadText, exportDocAsMarkdown } from "../drive";

describe("fetchAndParse", () => {
  beforeEach(() => {
    vi.mocked(downloadText).mockReset();
    vi.mocked(exportDocAsMarkdown).mockReset();
  });

  it("uses downloadText + parsePost for .md files", async () => {
    vi.mocked(downloadText).mockResolvedValue(
      "---\ntitle: From MD\ndate: 2026-01-15\ntags: [a]\n---\n\nCorpo do MD."
    );
    const f = file({ id: "md-id", name: "foo.md", mimeType: "text/markdown" });

    const parsed = await fetchAndParse(f);

    expect(vi.mocked(downloadText)).toHaveBeenCalledWith("md-id");
    expect(vi.mocked(exportDocAsMarkdown)).not.toHaveBeenCalled();
    expect(parsed.meta.title).toBe("From MD");
    expect(parsed.meta.tags).toEqual(["a"]);
  });

  it("uses exportDocAsMarkdown + parseDocPost for Google Docs", async () => {
    vi.mocked(exportDocAsMarkdown).mockResolvedValue(
      "Tags: ia, blog\n\nCorpo do Doc."
    );
    const f = file({
      id: "doc-id",
      name: "Pensando em design",
      mimeType: "application/vnd.google-apps.document",
      createdTime: "2026-05-18T10:30:00Z",
    });

    const parsed = await fetchAndParse(f);

    expect(vi.mocked(exportDocAsMarkdown)).toHaveBeenCalledWith("doc-id");
    expect(vi.mocked(downloadText)).not.toHaveBeenCalled();
    expect(parsed.meta.title).toBe("Pensando em design");
    expect(parsed.meta.slug).toBe("pensando-em-design");
    expect(parsed.meta.date).toBe("2026-05-18");
    expect(parsed.meta.tags).toEqual(["ia", "blog"]);
    expect(parsed.body).toBe("Corpo do Doc.");
  });

  it("propagates errors from downloadText", async () => {
    vi.mocked(downloadText).mockRejectedValue(new Error("404 not found"));
    const f = file({ id: "x", name: "foo.md", mimeType: "text/markdown" });
    await expect(fetchAndParse(f)).rejects.toThrow("404 not found");
  });

  it("propagates errors from exportDocAsMarkdown", async () => {
    vi.mocked(exportDocAsMarkdown).mockRejectedValue(new Error("429 quota"));
    const f = file({ id: "x", name: "Doc", mimeType: "application/vnd.google-apps.document" });
    await expect(fetchAndParse(f)).rejects.toThrow("429 quota");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-source.test.ts`
Expected: FAIL — `fetchAndParse` not defined.

- [ ] **Step 3: Implement `fetchAndParse` in `blog-source.ts`**

Edit `netlify/functions/_lib/blog-source.ts`. Add imports at top:

```ts
import { downloadText, exportDocAsMarkdown } from "./drive";
import { parsePost, parseDocPost, type ParsedPost } from "../../../src/lib/blog/frontmatter";
```

Then add the function at the end:

```ts
export async function fetchAndParse(f: DriveFile): Promise<ParsedPost> {
  if (f.mimeType === DOC_MIMETYPE) {
    const raw = await exportDocAsMarkdown(f.id);
    return parseDocPost(raw, f.name, f.createdTime);
  }
  const raw = await downloadText(f.id);
  return parsePost(raw, f.name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run netlify/functions/_lib/__tests__/blog-source.test.ts`
Expected: PASS — all 12 tests green (8 isBlogPostSource + 4 fetchAndParse).

- [ ] **Step 5: Run full test suite to ensure no regression**

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/blog-source.ts netlify/functions/_lib/__tests__/blog-source.test.ts
git commit -m "feat(blog-source): add fetchAndParse with mimeType branch"
```

---

## Task 7: Migrate consumers to use `isBlogPostSource` + `fetchAndParse`

7 consumers, mesma transformação. Cada um: trocar filter + trocar fetch+parse. Adicionar dedupe de slug nos 4 que enumeram todos os posts (`blog-list`, `blog-rss`, `sitemap`, `blog-reindex`). Sem testes novos (consumers não têm suite hoje, fora do escopo).

**Files:**
- Modify: `netlify/functions/chat.ts` (`getPostsForPrompt` only)
- Modify: `netlify/functions/blog-list.ts`
- Modify: `netlify/functions/blog-post.ts`
- Modify: `netlify/functions/blog-rss.ts`
- Modify: `netlify/functions/sitemap.ts`
- Modify: `netlify/functions/blog-reindex.ts`
- Modify: `netlify/functions/blog-translate.ts`

- [ ] **Step 1: Migrate `chat.ts:getPostsForPrompt`**

Edit `netlify/functions/chat.ts`. Find the import block (around lines 1-11) and add (preserving the order):

```ts
import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";
```

Remove the now-unused imports `listFolder` (kept — still used) and `downloadText` (remove if unused after this change), and `parsePost` (remove if unused after this change). Check usages in the file before removing.

Then find `getPostsForPrompt` (around lines 64-93). Replace the inner loop (lines 69-83) that looked like:

```ts
const folders = await resolveBlogFolders();
const files = await listFolder(folders.rootId);
const mds = files.filter((f) => f.mimeType === "text/markdown" || f.name.endsWith(".md"));
const lines: string[] = [];
for (const f of mds) {
  try {
    const raw = await downloadText(f.id);
    const { meta } = parsePost(raw, f.name);
    if (meta.draft) continue;
    const excerpt = meta.excerpt ?? "";
    lines.push(`- /blog/${meta.slug} — "${meta.title}" — ${excerpt}`);
  } catch (err) {
    console.error("getPostsForPrompt: skipping", f.name, err);
  }
}
```

With:

```ts
const folders = await resolveBlogFolders();
const files = await listFolder(folders.rootId);
const sources = files.filter(isBlogPostSource);
const lines: string[] = [];
const seen = new Set<string>();
for (const f of sources) {
  try {
    const { meta } = await fetchAndParse(f);
    if (meta.draft) continue;
    if (seen.has(meta.slug)) {
      console.error("blog: duplicate slug, skipping", { slug: meta.slug, name: f.name });
      continue;
    }
    seen.add(meta.slug);
    const excerpt = meta.excerpt ?? "";
    lines.push(`- /blog/${meta.slug} — "${meta.title}" — ${excerpt}`);
  } catch (err) {
    console.error("blog: skipping", { name: f.name, id: f.id, err });
  }
}
```

- [ ] **Step 2: Build to confirm no unused imports / type errors in chat.ts**

Run: `npm run build`
Expected: builds clean. If TS complains about unused imports of `downloadText` or `parsePost`, remove them.

- [ ] **Step 3: Migrate `blog-list.ts`**

Read the file first to locate the current filter/loop:

```bash
sed -n '1,80p' netlify/functions/blog-list.ts
```

Identify the imports, the filter, and the loop that downloads+parses. Apply the same transformation pattern as Step 1:
- Add: `import { isBlogPostSource, fetchAndParse } from "./_lib/blog-source";`
- Remove now-unused `downloadText` / `parsePost` imports if applicable.
- Replace the file filter with `files.filter(isBlogPostSource)`.
- Replace `const raw = await downloadText(f.id); const parsed = parsePost(raw, f.name);` with `const parsed = await fetchAndParse(f);`.
- Add slug dedupe with `seen` set inside the per-file try block.

- [ ] **Step 4: Migrate `blog-post.ts`**

Same pattern. `blog-post` looks up a single slug — slug dedupe is NOT needed here (first match wins). Keep the try/catch per file.

- [ ] **Step 5: Migrate `blog-rss.ts`**

Same pattern + slug dedupe.

- [ ] **Step 6: Migrate `sitemap.ts`**

Same pattern + slug dedupe.

- [ ] **Step 7: Migrate `blog-reindex.ts`**

Same pattern + slug dedupe.

- [ ] **Step 8: Migrate `blog-translate.ts`**

Same pattern, but preserve the existing extra filter: only translates posts with `lang === "pt"` and `!draft`. Today the file has a special filter that excludes `.md` files which got auto-converted to Google Docs by Drive — with this migration those become legitimate Doc posts via Path B. So that extra filter (`f.mimeType.startsWith("application/vnd.google-apps.")` skip) is removed. Translate by slug, so no dedupe needed.

After migration, the relevant section becomes:

```ts
const folders = await resolveBlogFolders();
const files = await listFolder(folders.rootId);

let originalBody: string | null = null;
for (const f of files.filter(isBlogPostSource)) {
  try {
    const parsed = await fetchAndParse(f);
    if (parsed.meta.slug === slug && !parsed.meta.draft && parsed.meta.lang === "pt") {
      originalBody = parsed.body;
      break;
    }
  } catch (err) {
    console.error("blog-translate: skipping", { name: f.name, id: f.id, err });
  }
}
```

- [ ] **Step 9: Build + run full test suite**

Run: `npm run build && npm run test:run`
Expected: builds clean, all tests pass (no new tests, but existing ones must not regress).

- [ ] **Step 10: Commit**

```bash
git add netlify/functions/chat.ts netlify/functions/blog-list.ts netlify/functions/blog-post.ts netlify/functions/blog-rss.ts netlify/functions/sitemap.ts netlify/functions/blog-reindex.ts netlify/functions/blog-translate.ts
git commit -m "refactor(blog): migrate all consumers to isBlogPostSource + fetchAndParse"
```

---

## Task 8: Update `docs/blog-setup.md`

Adicionar seções de Google Doc, Drafts, .md vs Doc, Limitações conhecidas. Mais bonus fix de `text-embedding-004` (já obsoleto desde o ship do RAG ontem).

**Files:**
- Modify: `docs/blog-setup.md`

- [ ] **Step 1: Update section 5 to have subsections 5.1 and 5.2**

Edit `docs/blog-setup.md`. Find the section starting with `## 5. Write your first post` and ending before `## 6. Rotating the key`. Replace it with:

```markdown
## 5. Write your first post

### 5.1 As a Markdown file

Save a file `hello.md` to the `blog` folder in Drive:

\`\`\`markdown
---
title: "Hello World"
date: 2026-05-16
lang: pt
tags: [meta]
excerpt: "Primeiro post do blog."
---

# Olá

Este é o primeiro post.
\`\`\`

Visit `https://guiresende20.netlify.app/blog`. Within 10 min the post
appears. To make it appear instantly, run:

\`\`\`bash
curl -X POST "https://guiresende20.netlify.app/api/blog/revalidate?slug=hello" \
  -H "X-Revalidate-Token: <your BLOG_REVALIDATE_TOKEN>"
\`\`\`

### 5.2 As a Google Doc

No Drive, dentro da pasta `blog`, crie um novo Google Doc (ou use um existente). **O nome do Doc vira o título do post.**

Conteúdo do Doc:

\`\`\`
Tags: meta, ia

Este é o body do post. Escreva normal — parágrafos, headings, listas, links, tudo funciona.
\`\`\`

A primeira linha `Tags: ...` é mágica: define as tags e é removida do render. Se não quiser tags, é só não escrever essa linha.

A data do post é o `createdTime` do Doc (não muda com edições posteriores). Se quiser republicar com data nova, duplique o Doc.

Em até 10min o post aparece em `/blog/<slug>`. Mesmo curl da revalidate funciona pra forçar agora.
```

(Note: replace `\`\`\`` with triple backticks when actually editing — the escape is only here in the plan markdown.)

- [ ] **Step 2: Add new sections 7, 8, 9 after section 6 (Rotating the key)**

Find the end of section 6 and the line `---` before "## RAG no chatbot". Insert before that `---`:

```markdown

## 7. Drafts

Posts em produção: arquivos `.md` ou Docs **diretamente em `blog/`**.

Drafts / WIPs: dentro de `blog/drafts/`. O sistema ignora qualquer coisa dentro dessa subpasta (vale pra `.md` e Doc).

Quando o draft estiver pronto: arraste/mova o arquivo de `blog/drafts/` pra `blog/` raiz.

Importante: **apenas children diretos de `blog/`** são considerados. Se você criar `blog/2026/foo.md` esperando organização por ano, o post ficará invisível. Não use nested folders pra posts (exceto `images/` que é convenção pra mídia, e `drafts/`).

## 8. Markdown vs Google Doc — quando usar

| Use `.md` quando | Use Doc quando |
|---|---|
| Post é code-heavy (muitos snippets) | Post é mostly prosa |
| Quer controle exato de markdown | Quer WYSIWYG, editar no celular |
| Quer override explícito de data (`date:` em frontmatter) | OK com data = criação do Doc |
| Quer override de slug, excerpt, cover, lang | OK com defaults (slug = slugify do nome, excerpt = primeiro parágrafo, lang = pt) |

Os dois formatos coexistem. Posts antigos não precisam migrar; novos posts podem ser qualquer um.

## 9. Limitações conhecidas do Google Doc como source

- **Linha "Tags:" é mágica.** Se o primeiro parágrafo do seu post literalmente começar com "Tags: ..." em prosa, o parser vai stripar essa linha. Reescreva o início pra evitar.
- **Renomear o Doc muda o slug** → links externos pro post antigo quebram. Pense duas vezes antes de renomear.
- **Data congelada em `createdTime`**: editar o Doc depois não muda a data exibida. Se quiser republicar com data nova, duplique o Doc.
- **Drive MD export tem fragilidades:**
  - Code blocks: use Insert > Building blocks > Code block. Inline `code` formatting da era pré-2024 pode virar texto puro.
  - Nested lists 3+ níveis podem embaralhar indentação.
  - Imagens embedadas no Doc: NÃO embede. Suba pra `blog/images/` e referencie por nome no body, igual o fluxo `.md`.
- **Editar durante render**: editar um Doc enquanto o sitemap/RSS está gerando pode produzir versão temporariamente desatualizada. Próxima geração corrige.

```

- [ ] **Step 3: Refine the "Limitações conhecidas" of the RAG section**

Find this line near the bottom of the file:
```
- Drafts (`meta.draft === true`) e quaisquer posts em subpastas NÃO são indexados, por design.
```

Replace with:
```
- Drafts (`meta.draft === true` em `.md`, ou arquivos em `blog/drafts/` pra qualquer formato) e quaisquer posts em outras subpastas NÃO são indexados, por design.
```

- [ ] **Step 4: Bonus — fix obsolete `text-embedding-004` reference**

Find this line in the RAG section:
```
Quando um post é publicado/atualizado e você bate em `/api/blog/revalidate?slug=foo`, o sistema também gera embeddings vetoriais do conteúdo (via Gemini `text-embedding-004`) e armazena num índice JSON no Netlify Blobs (`embeddings/posts-index.json`).
```

Replace `text-embedding-004` with `gemini-embedding-001` (com `outputDimensionality: 768`, modelo atual conforme `_lib/embeddings.ts:3`).

- [ ] **Step 5: Commit**

```bash
git add docs/blog-setup.md
git commit -m "docs(blog-setup): add Google Doc instructions + drafts/limitations sections"
```

---

## Task 9: Open PR, validate Deploy Preview, smoke test, merge

Branch já está sendo trabalhada (vai ser criada pelo subagent driver no início). Push, abre PR, espera Deploy Preview, roda smoke programático, decide merge.

**Pre-req (one-time, user does this BEFORE this task runs):** Owner cria 1 Google Doc de teste em `blog/` no Drive:
- Nome: `Teste do parser de Docs`
- Body:
  ```
  Tags: teste, sandbox

  Este é o conteúdo do post de teste para validar o parser de Google Docs.
  ```

Se o owner não tiver criado, o smoke do passo 6 vai falhar; nesse caso pedir pra ele criar e re-rodar.

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(blog): support Google Docs as post source (Phase 6)" --body "$(cat <<'EOF'
## Summary

Phase 6 do blog: posts agora podem ser escritos em Google Docs no `blog/` do Drive, lado a lado com `.md`. Ambos os formatos convergem pra `ParsedPost` num único ponto de branch em `_lib/blog-source.ts`. Consumers (chat, blog-list, blog-post, blog-rss, sitemap, blog-reindex, blog-translate) trocaram ~2 linhas cada.

Spec: `docs/superpowers/specs/2026-05-18-google-docs-source-design.md`
Plan: `docs/superpowers/plans/2026-05-18-google-docs-source.md`

## Test plan

- [x] Unit tests: ~37 novos (slugify, parseDocPost, isBlogPostSource, fetchAndParse com mocks)
- [x] Build clean, full suite green
- [ ] Deploy Preview: smoke programático (curl) valida que Doc de teste aparece em /api/blog/list, /api/blog/post/<slug>, /api/blog/rss, e que chat com pergunta sobre o body cita o conteúdo

## Doc updates

- `docs/blog-setup.md` ganha seções 5.2 (escrever como Doc), 7 (drafts), 8 (md vs Doc), 9 (limitações)
- Bonus: corrige referência obsoleta `text-embedding-004` → `gemini-embedding-001`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for Deploy Preview to become ready**

Run:
```bash
until npx netlify api listSiteDeploys --data '{"site_id":"a10414d3-0cea-42c0-93a4-a88da8b45517"}' 2>/dev/null | python -c "import sys, json; d=json.load(sys.stdin)[0]; print(d['state']); sys.exit(0 if d['state']=='ready' else 1)"; do sleep 15; done; echo "deploy ready"
```
Expected: prints state transitions until "ready".

- [ ] **Step 3: Smoke 1 — `/api/blog/list` includes the test Doc**

Run:
```bash
curl -sS 'https://deploy-preview-N--guiresende20.netlify.app/api/blog/list' -H 'Origin: https://deploy-preview-N--guiresende20.netlify.app' | python -m json.tool | grep -A2 "teste-do-parser-de-docs"
```
(Replace `N` with the actual PR number from `gh pr view`.)
Expected: shows the post entry with `title: "Teste do parser de Docs"` and `tags: ["teste", "sandbox"]`.

- [ ] **Step 4: Smoke 2 — `/api/blog/post/<slug>` returns body**

Run:
```bash
curl -sS 'https://deploy-preview-N--guiresende20.netlify.app/api/blog/post/teste-do-parser-de-docs' -H 'Origin: https://deploy-preview-N--guiresende20.netlify.app' | python -m json.tool
```
Expected: response contains body with "Este é o conteúdo do post de teste" and does NOT contain "Tags:" in the body.

- [ ] **Step 5: Smoke 3 — `/api/blog/rss` includes the test Doc**

Run:
```bash
curl -sS 'https://deploy-preview-N--guiresende20.netlify.app/api/blog/rss' | grep "teste-do-parser-de-docs"
```
Expected: at least 1 line of output (XML element referencing the test post).

- [ ] **Step 6: Smoke 4 — chat answers from the Doc content**

Run:
```bash
curl -sS -X POST 'https://deploy-preview-N--guiresende20.netlify.app/.netlify/functions/chat' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://deploy-preview-N--guiresende20.netlify.app' \
  -d '{"message":"o que diz no post de teste do parser de docs?","history":[]}'
```
Expected: response cites "conteúdo do post de teste" or similar phrase from the Doc body, confirming RAG indexed the Doc successfully (depends on whether reindex was triggered — see Step 7).

- [ ] **Step 7: (Optional) Trigger reindex if smoke 4 didn't pick up the Doc**

If owner has `BLOG_REVALIDATE_TOKEN` handy, run in their external terminal:
```bash
curl -sS -X POST 'https://deploy-preview-N--guiresende20.netlify.app/api/blog/reindex' \
  -H 'Authorization: Bearer <TOKEN>'
```
Expected: `{"indexed": N+1, "storedChunks": M, ...}` where N+1 accounts for the new Doc.

Then re-run Smoke 4.

- [ ] **Step 8: If smokes pass, squash merge to main**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull --ff-only origin main
```

- [ ] **Step 9: Wait for main deploy to be ready**

Run:
```bash
until npx netlify api listSiteDeploys --data '{"site_id":"a10414d3-0cea-42c0-93a4-a88da8b45517"}' 2>/dev/null | python -c "import sys, json; deploys=json.load(sys.stdin); d=next((x for x in deploys if x.get('branch')=='main'), None); print(d['state'] if d else 'no main'); sys.exit(0 if d and d['state']=='ready' else 1)"; do sleep 15; done; echo "prod deploy ready"
```

- [ ] **Step 10: Run the same 3-4 smokes against prod**

Repeat Steps 3, 4, 5, 6 with URL `https://guiresende20.netlify.app`. Report results in a table.

---

## Self-Review Notes

After writing this plan, I cross-checked against the spec:

- ✅ Architecture (Section 1) → Tasks 5-7 (`isBlogPostSource`, `fetchAndParse`, consumer migration)
- ✅ Components (Section 2) → Tasks 1-7 (every file listed maps to a task)
- ✅ Data flow (Section 3) → Tasks 5-6 implement the branch, Tasks 3-4 implement the parsers
- ✅ Metadata extraction (Section 4) → Task 4 (`parseDocPost` with full tags/slug/date/excerpt coverage in tests)
- ✅ Drafts (Section 5) → No code task — documented as natural filter behavior in setup doc (Task 8)
- ✅ Error handling (Section 6) → Per-file try/catch pattern in Task 7 (consumers)
- ✅ Testing (Section 7) → Tasks 3, 4, 5, 6 cover unit tests; Task 9 runs smoke
- ✅ Doc updates (Section 8) → Task 8
- ✅ Slug collision detection → Task 7 (each enumerator gets `seen` set)
- ✅ Bonus fix (`text-embedding-004` → `gemini-embedding-001`) → Task 8 step 4

No placeholders, no "TBD", no "similar to Task N" without showing code. Type names (`DriveFile`, `ParsedPost`, `PostMeta`) are consistent. Function signatures match: `slugify(s: string): string`, `parseDocPost(raw, driveName, createdTime)`, `isBlogPostSource(f: DriveFile): boolean`, `fetchAndParse(f: DriveFile): Promise<ParsedPost>`.
