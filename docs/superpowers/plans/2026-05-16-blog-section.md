# Blog Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/blog` section to the portfolio fed by `.md` files in a Google Drive folder, with AI on-demand translation (PT → EN/ES) via the existing Gemini integration. Publishing happens by saving a file to Drive — no redeploy required.

**Architecture:** Drive holds source-of-truth `.md` files (Service Account, readonly). Netlify Functions read from Drive and cache in Netlify Blobs (10 min TTL for posts, permanent for translations). React frontend lazy-loads markdown libs only on `/blog*` routes. Translation endpoint is locked to `{slug, lang}` with whitelist + cache + rate-limit (cannot be abused to drain Gemini quota).

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + `react-router-dom` (already in deps, currently unused) + Netlify Functions + `@netlify/blobs` + `googleapis` + `gray-matter` + `react-markdown` + `remark-gfm` + `rehype-shiki` + `@tailwindcss/typography` + Gemini API + Disqus + Vitest (new, for pure helpers).

**Spec:** `docs/superpowers/specs/2026-05-16-blog-section-design.md`

**Phasing:** 6 phases, each mergeable to `main` on its own. Phase 3 yields a working read-only PT blog. Phase 4 adds translation. Phase 5 adds polish.

---

## Phase 0 — Setup

Adds dependencies, env vars, routing, and the test framework. Ends with no user-visible change; just infrastructure.

### Task 0.1: Install new dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install gray-matter react-markdown remark-gfm rehype-shiki @netlify/blobs googleapis
```

Expected: deps added under `dependencies`. Lockfile updated.

- [ ] **Step 2: Install dev deps (Tailwind plugin + Vitest)**

Run:
```bash
npm install -D @tailwindcss/typography vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

Expected: deps added under `devDependencies`.

- [ ] **Step 3: Wire Tailwind typography plugin**

Modify: `tailwind.config.{js,ts}` — add to `plugins: []`:

```js
plugins: [
  require("tailwindcss-animate"),
  require("@tailwindcss/typography"),
],
```

(If `tailwindcss-animate` already exists, just add the typography line alongside it.)

- [ ] **Step 4: Add Vitest scripts to package.json**

Modify: `package.json` `"scripts"`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 5: Create Vitest config**

Create: `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

Create: `vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Smoke test the framework**

Create: `src/lib/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test:run`
Expected: 1 test passes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tailwind.config.* vitest.config.ts vitest.setup.ts src/lib/__tests__/smoke.test.ts
git commit -m "chore(blog): install deps + vitest + typography plugin"
```

### Task 0.2: Introduce router without breaking current page

Currently `App.tsx` renders `<Index />` directly. We need routes `/`, `/blog`, `/blog/:slug`, `/blog/tag/:tag` without changing the look of `/`.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/Blog.tsx` (placeholder)
- Create: `src/pages/BlogPost.tsx` (placeholder)
- Create: `src/pages/BlogTag.tsx` (placeholder)
- Modify: `src/main.tsx` (if Router needs to wrap there — verify)

- [ ] **Step 1: Read current main.tsx and App.tsx to confirm structure**

Read both files. Confirm `main.tsx` mounts `<App />` and `App.tsx` renders `<Index />`.

- [ ] **Step 2: Create placeholder Blog pages**

Create: `src/pages/Blog.tsx`
```tsx
export default function Blog() {
  return <div className="container mx-auto p-8 text-foreground">Blog (em construção)</div>;
}
```

Create: `src/pages/BlogPost.tsx`
```tsx
import { useParams } from "react-router-dom";

export default function BlogPost() {
  const { slug } = useParams();
  return <div className="container mx-auto p-8 text-foreground">Post: {slug}</div>;
}
```

Create: `src/pages/BlogTag.tsx`
```tsx
import { useParams } from "react-router-dom";

export default function BlogTag() {
  const { tag } = useParams();
  return <div className="container mx-auto p-8 text-foreground">Tag: {tag}</div>;
}
```

- [ ] **Step 3: Replace App.tsx with router**

Modify: `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";

const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BlogTag = lazy(() => import("./pages/BlogTag"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route
          path="/blog"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <Blog />
            </Suspense>
          }
        />
        <Route
          path="/blog/tag/:tag"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <BlogTag />
            </Suspense>
          }
        />
        <Route
          path="/blog/:slug"
          element={
            <Suspense fallback={<div className="p-8">Carregando…</div>}>
              <BlogPost />
            </Suspense>
          }
        />
        <Route path="*" element={<Index />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify the existing site still works**

Run: `npm run dev`
Open: `http://localhost:5173/`
Expected: existing site renders exactly as before.

Open: `http://localhost:5173/blog`
Expected: "Blog (em construção)" text shown.

Open: `http://localhost:5173/blog/hero-3d`
Expected: "Post: hero-3d" shown.

- [ ] **Step 5: Check Netlify SPA redirect still covers new routes**

Read: `netlify.toml`. Confirm presence of:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This already routes all paths to the SPA. No change needed.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/Blog.tsx src/pages/BlogPost.tsx src/pages/BlogTag.tsx
git commit -m "feat(blog): scaffold /blog routes (placeholders)"
```

### Task 0.3: Document the Service Account creation procedure

The engineer can't create this for the owner. Document the manual steps the owner needs to do once.

**Files:**
- Create: `docs/blog-setup.md`

- [ ] **Step 1: Write the setup doc**

Create: `docs/blog-setup.md`

````markdown
# Blog — Initial Setup

This is a one-time setup performed by the portfolio owner (Guilherme).
The engineer implementing the blog feature does not need access to this
Google account.

## 1. Create Google Cloud project

1. Open https://console.cloud.google.com/
2. Create a new project named `portfolio-blog`.
3. Enable the Google Drive API:
   - APIs & Services → Library → search "Google Drive API" → Enable.

## 2. Create Service Account

1. APIs & Services → Credentials → Create Credentials → Service Account.
2. Name: `blog-reader`. Skip optional steps.
3. After creation, open the service account → Keys tab → Add Key →
   Create new key → JSON. Download the file. **Treat as a secret.**
4. Copy the service account email (looks like
   `blog-reader@portfolio-blog.iam.gserviceaccount.com`).

## 3. Create blog folder in Drive

1. In Drive, create a top-level folder named `blog`.
2. Inside, create a subfolder `images`.
3. Right-click `blog` → Share → paste the service account email →
   set role to **Viewer** → Send (uncheck "Notify people").
4. Note the folder ID: it's the long string in the folder URL after
   `/folders/`. Example URL: `https://drive.google.com/drive/folders/1AbCdEf...`
   → folder ID is `1AbCdEf...`.

## 4. Configure Netlify env vars

1. Open Netlify dashboard → Site settings → Environment variables.
2. Add:
   - `GOOGLE_DRIVE_SA_JSON` — paste the entire content of the JSON key
     file (single value, multi-line). Mark as secret.
   - `GOOGLE_DRIVE_BLOG_FOLDER_ID` — paste the folder ID from step 3.
   - `BLOG_REVALIDATE_TOKEN` — generate any random string (e.g.
     `openssl rand -hex 32`). Save it; you'll use it from your phone to
     bust cache after publishing.
   - `DISQUS_SHORTNAME` — your Disqus account shortname (from
     disqus.com admin URL).

3. Trigger a redeploy for the env vars to apply.

## 5. Write your first post

Save a file `hello.md` to the `blog` folder in Drive:

```markdown
---
title: "Hello World"
date: 2026-05-16
lang: pt
tags: [meta]
excerpt: "Primeiro post do blog."
---

# Olá

Este é o primeiro post.
```

Visit `https://guiresende20.netlify.app/blog`. Within 10 min the post
appears. To make it appear instantly, run:

```bash
curl -X POST "https://guiresende20.netlify.app/api/blog/revalidate?slug=hello" \
  -H "X-Revalidate-Token: <your BLOG_REVALIDATE_TOKEN>"
```

## 6. Rotating the key

If `GOOGLE_DRIVE_SA_JSON` ever leaks: in Google Cloud Console →
service account → Keys → delete old key, create new key, update
Netlify env var, redeploy.
````

- [ ] **Step 2: Commit**

```bash
git add docs/blog-setup.md
git commit -m "docs(blog): one-time setup guide for owner"
```

---

## Phase 1 — Drive + Cache foundation (`_lib/`)

Pure-server primitives: read files/folders from Drive, cache in Netlify Blobs. Heavily testable with mocks but we keep it simple: thin wrappers with manual smoke testing via a small CLI script.

### Task 1.1: Drive client wrapper

**Files:**
- Create: `netlify/functions/_lib/drive.ts`

- [ ] **Step 1: Write the wrapper**

Create: `netlify/functions/_lib/drive.ts`

```ts
import { google } from "googleapis";

let cachedDrive: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (cachedDrive) return cachedDrive;

  const raw = process.env.GOOGLE_DRIVE_SA_JSON;
  if (!raw) throw new Error("GOOGLE_DRIVE_SA_JSON missing");

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime)",
    pageSize: 1000,
  });
  return (res.data.files ?? []) as DriveFile[];
}

export async function downloadText(fileId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return res.data as string;
}

export async function downloadBinary(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function findChildFolder(
  parentId: string,
  childName: string
): Promise<string | null> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${childName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_lib/drive.ts
git commit -m "feat(blog): drive readonly wrapper (Service Account)"
```

### Task 1.2: Netlify Blobs cache wrapper

**Files:**
- Create: `netlify/functions/_lib/blob-cache.ts`

- [ ] **Step 1: Write the wrapper**

Create: `netlify/functions/_lib/blob-cache.ts`

```ts
import { getStore } from "@netlify/blobs";

interface CachedEntry<T> {
  value: T;
  expiresAt: number | null; // null = never expires
}

const STORE_NAME = "blog";

function store() {
  return getStore(STORE_NAME);
}

export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await store().get(key, { type: "json" });
  if (!raw) return null;
  const entry = raw as CachedEntry<T>;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.value;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlMs: number | null
): Promise<void> {
  const entry: CachedEntry<T> = {
    value,
    expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
  };
  await store().setJSON(key, entry);
}

export async function getCachedBinary(key: string): Promise<Buffer | null> {
  const buf = await store().get(key, { type: "arrayBuffer" });
  return buf ? Buffer.from(buf) : null;
}

export async function setCachedBinary(
  key: string,
  data: Buffer
): Promise<void> {
  await store().set(key, data);
}

export async function deleteCached(key: string): Promise<void> {
  await store().delete(key);
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  const { blobs } = await store().list({ prefix });
  await Promise.all(blobs.map((b) => store().delete(b.key)));
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_lib/blob-cache.ts
git commit -m "feat(blog): netlify blobs cache wrapper with ttl"
```

### Task 1.3: Frontmatter parser helper (pure, tested)

**Files:**
- Create: `src/lib/blog/frontmatter.ts`
- Create: `src/lib/blog/__tests__/frontmatter.test.ts`

This helper is **isomorphic** — used by both the Netlify Function (parsing markdown from Drive) and the frontend (no, actually frontend gets pre-parsed JSON; only server uses this). But unit-testable pure function nonetheless.

- [ ] **Step 1: Write the failing test**

Create: `src/lib/blog/__tests__/frontmatter.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parsePost } from "../frontmatter";

describe("parsePost", () => {
  it("extracts frontmatter and body", () => {
    const raw = `---
title: Hello World
date: 2026-05-16
lang: pt
tags: [a, b]
draft: false
---

# Hello

Body here.`;
    const result = parsePost(raw, "hello.md");
    expect(result.meta.title).toBe("Hello World");
    expect(result.meta.date).toBe("2026-05-16");
    expect(result.meta.lang).toBe("pt");
    expect(result.meta.tags).toEqual(["a", "b"]);
    expect(result.meta.draft).toBe(false);
    expect(result.meta.slug).toBe("hello");
    expect(result.body).toContain("# Hello");
  });

  it("uses filename as default slug", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "my-post.md");
    expect(result.meta.slug).toBe("my-post");
  });

  it("respects explicit slug", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\nslug: custom\n---\nbody`;
    const result = parsePost(raw, "different-filename.md");
    expect(result.meta.slug).toBe("custom");
  });

  it("defaults draft to false", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.draft).toBe(false);
  });

  it("defaults featured to false", () => {
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\nbody`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.featured).toBe(false);
  });

  it("computes reading time from body", () => {
    const words = "word ".repeat(400).trim();
    const raw = `---\ntitle: T\ndate: 2026-01-01\nlang: pt\n---\n${words}`;
    const result = parsePost(raw, "x.md");
    expect(result.meta.readingTimeMin).toBe(2); // 400 / 200 = 2
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- frontmatter`
Expected: FAIL with "parsePost is not a function" or import error.

- [ ] **Step 3: Implement the helper**

Create: `src/lib/blog/frontmatter.ts`

```ts
import matter from "gray-matter";

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  lang: string;
  tags: string[];
  cover?: string;
  excerpt?: string;
  draft: boolean;
  featured: boolean;
  readingTimeMin: number;
}

export interface ParsedPost {
  meta: PostMeta;
  body: string;
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/i, "");
}

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function parsePost(raw: string, filename: string): ParsedPost {
  const { data, content } = matter(raw);
  const meta: PostMeta = {
    slug: typeof data.slug === "string" ? data.slug : slugFromFilename(filename),
    title: data.title ?? "(sem título)",
    date: data.date ?? "1970-01-01",
    lang: data.lang ?? "pt",
    tags: Array.isArray(data.tags) ? data.tags : [],
    cover: data.cover,
    excerpt: data.excerpt,
    draft: data.draft === true,
    featured: data.featured === true,
    readingTimeMin: readingTime(content),
  };
  return { meta, body: content };
}
```

Note: `gray-matter` returns `data.date` as a Date object if YAML parsed it. Coerce in the function if necessary; for now we trust the YAML parser. If a test later fails because of Date vs string, normalize with `new Date(data.date).toISOString().slice(0, 10)`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- frontmatter`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/frontmatter.ts src/lib/blog/__tests__/frontmatter.test.ts
git commit -m "feat(blog): frontmatter parser with reading-time"
```

### Task 1.4: Markdown image-path rewriter (pure, tested)

When a post body has `![](hero-cover.webp)`, we need to rewrite it to `/api/blog/image/hero-cover.webp`. Pure function, easy to test.

**Files:**
- Create: `src/lib/blog/image-paths.ts`
- Create: `src/lib/blog/__tests__/image-paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create: `src/lib/blog/__tests__/image-paths.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { rewriteImagePaths } from "../image-paths";

describe("rewriteImagePaths", () => {
  it("rewrites relative image", () => {
    const input = "Look: ![alt](cover.webp) end.";
    const output = rewriteImagePaths(input);
    expect(output).toBe("Look: ![alt](/api/blog/image/cover.webp) end.");
  });

  it("leaves absolute https URLs untouched", () => {
    const input = "![x](https://example.com/img.png)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("leaves protocol-relative URLs untouched", () => {
    const input = "![x](//cdn.com/img.png)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("leaves data URIs untouched", () => {
    const input = "![x](data:image/png;base64,abc)";
    expect(rewriteImagePaths(input)).toBe(input);
  });

  it("handles multiple images in one document", () => {
    const input = "![a](one.png) and ![b](two.jpg)";
    expect(rewriteImagePaths(input)).toBe(
      "![a](/api/blog/image/one.png) and ![b](/api/blog/image/two.jpg)"
    );
  });

  it("ignores image-like text inside code fences", () => {
    const input = "```\n![not-an-image](x.png)\n```";
    expect(rewriteImagePaths(input)).toBe(input);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- image-paths`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create: `src/lib/blog/image-paths.ts`

```ts
// Match standard markdown image syntax outside fenced code blocks.
// Strategy: split on fence boundaries, only transform odd-indexed (outside) chunks.
const FENCE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const IMG = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isAbsolute(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//") ||
    url.startsWith("data:") ||
    url.startsWith("/")
  );
}

export function rewriteImagePaths(markdown: string): string {
  const parts = markdown.split(FENCE);
  return parts
    .map((chunk, i) => {
      // Odd indices are the fenced code blocks themselves (kept untouched).
      if (i % 2 === 1) return chunk;
      return chunk.replace(IMG, (match, alt, url) => {
        if (isAbsolute(url)) return match;
        return `![${alt}](/api/blog/image/${url})`;
      });
    })
    .join("");
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- image-paths`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/image-paths.ts src/lib/blog/__tests__/image-paths.test.ts
git commit -m "feat(blog): markdown image-path rewriter"
```

### Task 1.5: Drive folder resolver helper

We need to find the "images" subfolder ID once and cache it. Build a small helper that resolves both root and images folder IDs.

**Files:**
- Create: `netlify/functions/_lib/blog-folders.ts`

- [ ] **Step 1: Write the helper**

Create: `netlify/functions/_lib/blog-folders.ts`

```ts
import { findChildFolder } from "./drive";
import { getCached, setCached } from "./blob-cache";

const FOLDER_CACHE_TTL = 24 * 60 * 60_000; // 24h

export interface BlogFolders {
  rootId: string;
  imagesId: string | null;
}

export async function resolveBlogFolders(): Promise<BlogFolders> {
  const rootId = process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_BLOG_FOLDER_ID missing");

  const cacheKey = `meta/folders/${rootId}`;
  const cached = await getCached<BlogFolders>(cacheKey);
  if (cached) return cached;

  const imagesId = await findChildFolder(rootId, "images");
  const result: BlogFolders = { rootId, imagesId };
  await setCached(cacheKey, result, FOLDER_CACHE_TTL);
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/_lib/blog-folders.ts
git commit -m "feat(blog): resolve blog and images folder ids with cache"
```

---

## Phase 2 — Read endpoints

Endpoints that serve posts and images. At the end of this phase, a curl test can fetch a real post from Drive.

### Task 2.1: `blog-list` function

**Files:**
- Create: `netlify/functions/blog-list.ts`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/blog-list.ts`

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { parsePost, type PostMeta } from "../../src/lib/blog/frontmatter";
import { corsHeaders } from "./_lib/security";

const TTL_MS = 10 * 60_000; // 10 min

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const cacheKey = "posts/list";
  const cached = await getCached<PostMeta[]>(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), "content-type": "application/json", "cache-control": "public, max-age=60" },
      body: JSON.stringify({ posts: cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles = files.filter(
    (f: DriveFile) => f.mimeType === "text/markdown" || f.name.endsWith(".md")
  );

  const metas: PostMeta[] = [];
  for (const file of mdFiles) {
    try {
      const raw = await downloadText(file.id);
      const { meta } = parsePost(raw, file.name);
      if (!meta.draft) metas.push(meta);
    } catch (err) {
      console.error("Failed to parse", file.name, err);
    }
  }

  metas.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  await setCached(cacheKey, metas, TTL_MS);
  return {
    statusCode: 200,
    headers: { ...corsHeaders(event), "content-type": "application/json", "cache-control": "public, max-age=60" },
    body: JSON.stringify({ posts: metas, cached: false }),
  };
};
```

- [ ] **Step 2: Add the redirect from `/api/blog/list` to the function**

Modify: `netlify.toml` — confirm existing rule:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

(Already present per spec. `/api/blog/list` will hit `blog-list`. Function filename must be exactly `blog-list.ts`. No change needed.)

- [ ] **Step 3: Smoke test locally**

Run: `npx netlify dev`

Open in browser: `http://localhost:8888/api/blog/list`

Expected (assuming env vars set and at least one `.md` in Drive):
```json
{ "posts": [{ "slug": "hello", "title": "Hello", ... }], "cached": false }
```

If env vars not set, expect 500 with clear error message. Document this for the user to verify.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-list.ts
git commit -m "feat(blog): /api/blog/list endpoint with cache"
```

### Task 2.2: `blog-post` function

**Files:**
- Create: `netlify/functions/blog-post.ts`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/blog-post.ts`

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadText, type DriveFile } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { parsePost, type PostMeta } from "../../src/lib/blog/frontmatter";
import { rewriteImagePaths } from "../../src/lib/blog/image-paths";
import { corsHeaders } from "./_lib/security";

const TTL_MS = 10 * 60_000;

interface PostPayload {
  meta: PostMeta;
  body: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // Path: /api/blog/post/:slug  → after redirect: /.netlify/functions/blog-post/:slug
  const match = event.path.match(/blog-post\/([^/?]+)/);
  const slug = match?.[1];
  if (!slug) return { statusCode: 400, body: "slug required" };

  const cacheKey = `posts/${slug}`;
  const cached = await getCached<PostPayload>(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), "content-type": "application/json", "cache-control": "public, max-age=60" },
      body: JSON.stringify({ ...cached, cached: true }),
    };
  }

  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles = files.filter(
    (f: DriveFile) => f.mimeType === "text/markdown" || f.name.endsWith(".md")
  );

  let found: PostPayload | null = null;
  for (const file of mdFiles) {
    const raw = await downloadText(file.id);
    const parsed = parsePost(raw, file.name);
    if (parsed.meta.slug === slug && !parsed.meta.draft) {
      found = {
        meta: parsed.meta,
        body: rewriteImagePaths(parsed.body),
      };
      break;
    }
  }

  if (!found) {
    return {
      statusCode: 404,
      headers: { ...corsHeaders(event), "content-type": "application/json" },
      body: JSON.stringify({ error: "not_found", slug }),
    };
  }

  await setCached(cacheKey, found, TTL_MS);
  return {
    statusCode: 200,
    headers: { ...corsHeaders(event), "content-type": "application/json", "cache-control": "public, max-age=60" },
    body: JSON.stringify({ ...found, cached: false }),
  };
};
```

- [ ] **Step 2: Add redirect for slug parameter**

The default `/api/*` → `/.netlify/functions/:splat` redirect treats the entire `blog-post/hello` as the function name. We need a more specific rule.

Modify: `netlify.toml` — add ABOVE the generic `/api/*` rule:

```toml
[[redirects]]
  from = "/api/blog/post/*"
  to = "/.netlify/functions/blog-post/:splat"
  status = 200
```

- [ ] **Step 3: Smoke test**

Run: `npx netlify dev`

Open: `http://localhost:8888/api/blog/post/hello`
Expected: JSON with `meta` and `body` of the `hello.md` post.

Open: `http://localhost:8888/api/blog/post/nonexistent`
Expected: 404 with `{"error":"not_found","slug":"nonexistent"}`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-post.ts netlify.toml
git commit -m "feat(blog): /api/blog/post/:slug endpoint"
```

### Task 2.3: `blog-image` function

**Files:**
- Create: `netlify/functions/blog-image.ts`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/blog-image.ts`

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadBinary } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCachedBinary, setCachedBinary } from "./_lib/blob-cache";

const TTL_MS = 60 * 60_000; // 1h (used only for cache existence check; binary cache has no TTL key)

function contentTypeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const match = event.path.match(/blog-image\/([^/?]+)/);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!filename) return { statusCode: 400, body: "filename required" };

  // Reject path traversal attempts.
  if (filename.includes("/") || filename.includes("..")) {
    return { statusCode: 400, body: "invalid filename" };
  }

  const cacheKey = `images/${filename}`;
  const cached = await getCachedBinary(cacheKey);
  if (cached) {
    return {
      statusCode: 200,
      headers: {
        "content-type": contentTypeForName(filename),
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: cached.toString("base64"),
      isBase64Encoded: true,
    };
  }

  const folders = await resolveBlogFolders();
  if (!folders.imagesId) {
    return { statusCode: 404, body: "images folder not found" };
  }

  const files = await listFolder(folders.imagesId);
  const file = files.find((f) => f.name === filename);
  if (!file) return { statusCode: 404, body: "image not found" };

  const data = await downloadBinary(file.id);
  await setCachedBinary(cacheKey, data);

  return {
    statusCode: 200,
    headers: {
      "content-type": contentTypeForName(filename),
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: data.toString("base64"),
    isBase64Encoded: true,
  };
};
```

- [ ] **Step 2: Add redirect for image filename**

Modify: `netlify.toml` — add above the generic `/api/*` rule:

```toml
[[redirects]]
  from = "/api/blog/image/*"
  to = "/.netlify/functions/blog-image/:splat"
  status = 200
```

- [ ] **Step 3: Smoke test**

Run: `npx netlify dev`

Open: `http://localhost:8888/api/blog/image/hello-cover.webp` (or any image file you put in `blog/images/`).

Expected: image displays. Network tab shows correct `content-type` and `cache-control: ...immutable`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-image.ts netlify.toml
git commit -m "feat(blog): /api/blog/image/:filename endpoint with long cache"
```

### Task 2.4: Update CSP for googleapis (if needed)

The functions hit `googleapis.com` server-side, not client-side — CSP `connect-src` is for **browser** requests. The functions are server-side; CSP doesn't apply. Verify and skip unless needed.

- [ ] **Step 1: Verify no client-side change needed**

Read: `netlify.toml` CSP. Confirm none of the new endpoints expose Drive API URLs to the browser. Browser only calls `/api/blog/*` (same-origin) and `/api/blog/image/*` (same-origin).

Conclusion: no CSP change needed. Done.

---

## Phase 3 — Frontend list + post rendering

At the end of this phase, browsing `/blog` shows real posts from Drive in proper styling, and clicking one renders the markdown.

### Task 3.1: Markdown renderer component

**Files:**
- Create: `src/components/blog/MarkdownRenderer.tsx`

- [ ] **Step 1: Write the component**

Create: `src/components/blog/MarkdownRenderer.tsx`

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeShiki from "rehype-shiki";

interface MarkdownRendererProps {
  body: string;
}

export default function MarkdownRenderer({ body }: MarkdownRendererProps) {
  return (
    <article
      className="prose prose-invert max-w-none
                 prose-headings:font-display prose-headings:tracking-tight
                 prose-h1:text-4xl prose-h1:text-neon
                 prose-h2:text-2xl prose-h2:text-foreground
                 prose-h3:text-xl
                 prose-p:font-body prose-p:text-foreground prose-p:leading-relaxed
                 prose-a:text-electric prose-a:no-underline hover:prose-a:underline hover:prose-a:text-neon
                 prose-code:font-mono prose-code:text-electric prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                 prose-code:before:content-none prose-code:after:content-none
                 prose-pre:bg-card prose-pre:border prose-pre:border-border
                 prose-blockquote:border-l-neon prose-blockquote:text-muted-foreground prose-blockquote:italic
                 prose-img:rounded-md
                 prose-hr:border-neon/30
                 prose-li:marker:text-electric
                 prose-table:text-sm prose-th:bg-muted prose-th:border-border prose-td:border-border"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeShiki, { themes: { light: "github-dark-dimmed", dark: "github-dark-dimmed" } }],
        ]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
```

Note: the `prose-*` classes assume your font classes (`font-display`, `font-body`, `font-mono`) and color tokens (`text-neon`, `text-electric`, `bg-muted`) match the existing design system. Verify these names exist in `tailwind.config.*` and `index.css`. If named differently, substitute.

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/MarkdownRenderer.tsx
git commit -m "feat(blog): markdown renderer with prose tokens"
```

### Task 3.2: Reading-time helper (frontend display)

Already computed server-side in frontmatter. Just need a formatter.

**Files:**
- Create: `src/lib/blog/format.ts`

- [ ] **Step 1: Write the helpers**

Create: `src/lib/blog/format.ts`

```ts
import { useTranslation } from "react-i18next";

export function formatReadingTime(min: number, lang: string): string {
  if (lang.startsWith("en")) return `${min} min read`;
  if (lang.startsWith("es")) return `${min} min de lectura`;
  return `${min} min de leitura`;
}

export function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang || "pt-BR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/blog/format.ts
git commit -m "feat(blog): reading-time and date formatters"
```

### Task 3.3: PostCard component

**Files:**
- Create: `src/components/blog/PostCard.tsx`

- [ ] **Step 1: Write the component**

Create: `src/components/blog/PostCard.tsx`

```tsx
import { Link } from "react-router-dom";
import type { PostMeta } from "../../lib/blog/frontmatter";
import { formatDate, formatReadingTime, useLocale } from "../../lib/blog/format";

interface PostCardProps {
  post: PostMeta;
}

export default function PostCard({ post }: PostCardProps) {
  const lang = useLocale();
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block border border-border bg-card hover:border-neon/40 transition-colors overflow-hidden"
    >
      {post.cover && (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={`/api/blog/image/${post.cover}`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{formatDate(post.date, lang)}</span>
          <span>·</span>
          <span>{formatReadingTime(post.readingTimeMin, lang)}</span>
          {post.featured && <span className="text-neon">· destacado</span>}
        </div>
        <h3 className="font-display text-xl text-foreground group-hover:text-neon transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
        )}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {post.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="font-mono text-[9px] uppercase tracking-[0.08em] border border-border px-1.5 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/PostCard.tsx
git commit -m "feat(blog): post card component"
```

### Task 3.4: Blog list page with data fetching

**Files:**
- Modify: `src/pages/Blog.tsx`
- Create: `src/lib/blog/api.ts`

- [ ] **Step 1: Write the API client**

Create: `src/lib/blog/api.ts`

```ts
import type { PostMeta } from "./frontmatter";

export interface ListResponse {
  posts: PostMeta[];
  cached: boolean;
}

export async function fetchPostList(): Promise<PostMeta[]> {
  const res = await fetch("/api/blog/list");
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const data = (await res.json()) as ListResponse;
  return data.posts;
}

export interface PostResponse {
  meta: PostMeta;
  body: string;
  cached: boolean;
}

export async function fetchPost(slug: string): Promise<PostResponse | null> {
  const res = await fetch(`/api/blog/post/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
  return (await res.json()) as PostResponse;
}
```

- [ ] **Step 2: Replace Blog.tsx placeholder**

Modify: `src/pages/Blog.tsx`

```tsx
import { useEffect, useState, useMemo } from "react";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";

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

  const allTags = useMemo(() => {
    if (!posts) return [];
    const set = new Set<string>();
    posts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (!activeTag) return posts;
    return posts.filter((p) => p.tags.includes(activeTag));
  }, [posts, activeTag]);

  if (error) {
    return (
      <div className="container mx-auto px-6 py-16 text-foreground">
        <p className="text-red-400">Erro ao carregar posts: {error}</p>
      </div>
    );
  }

  if (!posts) {
    return (
      <div className="container mx-auto px-6 py-16 text-foreground">
        <p className="text-muted-foreground">Carregando posts…</p>
      </div>
    );
  }

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Blog</span>
        <h1 className="font-display text-5xl text-foreground mt-2">Escritos</h1>
      </header>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => {
              setActiveTag(null);
              setVisible(PAGE_SIZE);
            }}
            className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-3 py-1.5 transition-colors ${
              activeTag === null
                ? "border-neon text-neon"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            todos
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveTag(tag);
                setVisible(PAGE_SIZE);
              }}
              className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-3 py-1.5 transition-colors ${
                activeTag === tag
                  ? "border-neon text-neon"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-muted-foreground">Nenhum post ainda. Volte em breve.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="font-mono text-xs uppercase tracking-[0.1em] border border-neon text-neon px-6 py-3 hover:bg-neon/10 transition-colors"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual UI test**

Run: `npx netlify dev`
Open: `http://localhost:8888/blog`

Expected: grid of posts loads. Tag filter works. "Load more" appears only when posts > 15.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Blog.tsx src/lib/blog/api.ts
git commit -m "feat(blog): /blog list page with tag filter and pagination"
```

### Task 3.5: BlogPost page

**Files:**
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Replace BlogPost placeholder**

Modify: `src/pages/BlogPost.tsx`

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPost, type PostResponse } from "../lib/blog/api";
import MarkdownRenderer from "../components/blog/MarkdownRenderer";
import { formatDate, formatReadingTime, useLocale } from "../lib/blog/format";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const lang = useLocale();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPost(null);
    setNotFound(false);
    setError(null);
    fetchPost(slug)
      .then((p) => {
        if (!p) setNotFound(true);
        else setPost(p);
      })
      .catch((e) => setError(String(e)));
  }, [slug]);

  if (error) {
    return (
      <div className="container mx-auto px-6 py-16 text-foreground">
        <p className="text-red-400">Erro: {error}</p>
        <Link to="/blog" className="text-neon underline mt-4 inline-block">
          ← Voltar para o blog
        </Link>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-6 py-24 text-foreground text-center">
        <h1 className="font-display text-4xl mb-4">Post não encontrado</h1>
        <p className="text-muted-foreground mb-8">
          O post "{slug}" não existe ou foi removido.
        </p>
        <Link to="/blog" className="text-neon underline">
          ← Voltar para o blog
        </Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-6 py-16 text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <Link
        to="/blog"
        className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon transition-colors"
      >
        ← blog
      </Link>

      <header className="mt-8 mb-12">
        <h1 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
          {post.meta.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{formatDate(post.meta.date, lang)}</span>
          <span>·</span>
          <span>{formatReadingTime(post.meta.readingTimeMin, lang)}</span>
          <span>·</span>
          <span>{post.meta.lang}</span>
          {post.meta.tags.length > 0 && (
            <>
              <span>·</span>
              {post.meta.tags.map((t) => (
                <Link
                  key={t}
                  to={`/blog/tag/${encodeURIComponent(t)}`}
                  className="hover:text-neon"
                >
                  #{t}
                </Link>
              ))}
            </>
          )}
        </div>
      </header>

      <MarkdownRenderer body={post.body} />
    </div>
  );
}
```

- [ ] **Step 2: Manual UI test**

Run: `npx netlify dev`
Open: `http://localhost:8888/blog/hello` (assuming a `hello.md` exists).
Expected: post renders with prose styling, navbar back link, tags, dates.

Open: `http://localhost:8888/blog/does-not-exist`
Expected: 404 page with suggestion to go back.

- [ ] **Step 3: Commit**

```bash
git add src/pages/BlogPost.tsx
git commit -m "feat(blog): /blog/:slug page with markdown rendering"
```

### Task 3.6: Add "Blog" link to Navbar

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/locales/pt.json`, `en.json`, `es.json`

- [ ] **Step 1: Read Navbar.tsx**

Read: `src/components/Navbar.tsx`. Identify the array/list of nav items between "Projetos" and "Formação".

- [ ] **Step 2: Add Blog link**

Modify: `src/components/Navbar.tsx` — wherever the nav items live, add a "Blog" entry between "Projetos" and "Formação". Since `Navbar` is rendered inside `Index` (single page with anchor links), the Blog link needs special handling: it's a route, not an anchor. Use `react-router-dom`'s `Link` for it specifically:

```tsx
import { Link } from "react-router-dom";

// In the nav items list, add:
<Link
  to="/blog"
  className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon transition-colors"
>
  {t("navbar.links.blog")}
</Link>
```

- [ ] **Step 3: Add translations**

Modify: `src/locales/pt.json` — add `"blog": "Blog"` inside `navbar.links`.
Modify: `src/locales/en.json` — add `"blog": "Blog"`.
Modify: `src/locales/es.json` — add `"blog": "Blog"`.

- [ ] **Step 4: Manual test**

Run: `npx netlify dev`
Open: `/` — click the new "Blog" link, expect navigation to `/blog`.
Open: `/blog` — confirm Navbar still renders (the page already includes it? Verify by reading current Index.tsx structure).

- [ ] **Step 5: If Navbar isn't in BlogLayout, add it**

The `Index.tsx` page includes the Navbar. The blog pages don't. Decision: extract a `BlogLayout` that wraps Navbar + Footer around blog routes.

Create: `src/components/blog/BlogLayout.tsx`

```tsx
import type { ReactNode } from "react";
import Navbar from "../Navbar";
import Footer from "../Footer";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
```

Modify: `src/pages/Blog.tsx`, `src/pages/BlogPost.tsx`, `src/pages/BlogTag.tsx` — wrap returns in `<BlogLayout>...</BlogLayout>`.

Example for `Blog.tsx`:
```tsx
import BlogLayout from "../components/blog/BlogLayout";

export default function Blog() {
  // ...existing logic
  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16">
        {/* existing JSX */}
      </div>
    </BlogLayout>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx src/components/blog/BlogLayout.tsx src/pages/Blog.tsx src/pages/BlogPost.tsx src/pages/BlogTag.tsx src/locales/*.json
git commit -m "feat(blog): blog layout + navbar link"
```

### Task 3.7: Phase 3 acceptance smoke test

- [ ] **Step 1: Manual checklist**

Verify with `npx netlify dev` and a real Drive folder configured:
- [ ] `/blog` lists all non-draft posts
- [ ] Featured posts appear at top
- [ ] Tag filter works
- [ ] "Carregar mais" appears with > 15 posts
- [ ] Clicking a card opens `/blog/:slug`
- [ ] Post renders with prose styling
- [ ] Images load via `/api/blog/image/...`
- [ ] Navbar appears on blog pages
- [ ] `/blog/does-not-exist` shows 404 page
- [ ] Existing `/` page is unaffected

If any fail, fix before merging Phase 3.

- [ ] **Step 2: (Optional) Open PR for Phase 3**

```bash
git push origin <branch>
gh pr create --title "feat(blog): read-only PT blog backed by Drive" --body "Implements Phases 0-3 of the blog spec. Working read-only blog at /blog backed by Google Drive. Translation comes in Phase 4."
```

---

## Phase 4 — On-demand AI translation

Adds `/api/blog/translate` and `TranslateBanner` UI.

### Task 4.1: `blog-translate` function

**Files:**
- Create: `netlify/functions/blog-translate.ts`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/blog-translate.ts`

```ts
import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { listFolder, downloadText } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { parsePost } from "../../src/lib/blog/frontmatter";
import { corsHeaders, getClientIp } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";

const ALLOWED_LANGS = new Set(["en", "es"]);
const TRANSLATE_RATE_LIMITS = [
  { limit: 5, windowMs: 60_000, label: "min" },
  { limit: 10, windowMs: 60 * 60_000, label: "hour" },
];

interface TranslateRequest {
  slug: string;
  lang: string;
}

const SYSTEM_PROMPT = (targetLang: string) => `You are a translator. Translate the following Markdown post from Portuguese to ${targetLang === "en" ? "English" : "Spanish"}.

Rules:
- Preserve every Markdown construct exactly: headings, lists, blockquotes, links, image syntax, tables.
- Do NOT translate text inside fenced code blocks (\`\`\`...\`\`\`) — keep them byte-for-byte identical.
- Do NOT translate text inside inline code (\`...\`).
- Do NOT translate URLs or file paths.
- Keep proper nouns (people, brands, project names) untouched.
- Match the author's tone — first-person, conversational, technical when needed.
- Output ONLY the translated Markdown. No commentary, no "Here is the translation:" prefix.
- Do NOT include or repeat the YAML frontmatter — you receive only the body.`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body: TranslateRequest;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { slug, lang } = body;
  if (!slug || typeof slug !== "string") {
    return { statusCode: 400, body: "slug required" };
  }
  if (!lang || !ALLOWED_LANGS.has(lang)) {
    return { statusCode: 400, body: "lang must be one of: en, es" };
  }

  // Rate-limit by IP.
  const ip = getClientIp(event);
  const rate = checkRateLimits("translate", ip, TRANSLATE_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { "retry-after": String(rate.retryAfter) },
      body: "Rate limit exceeded",
    };
  }

  // Check translation cache (permanent).
  const cacheKey = `posts/${slug}/translation/${lang}`;
  const cached = await getCached<string>(cacheKey);
  if (cached !== null) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), "content-type": "application/json", "x-blog-cache": "hit" },
      body: JSON.stringify({ slug, lang, body: cached, cached: true }),
    };
  }

  // Validate slug exists (avoid pointless Gemini calls for bogus slugs).
  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles = files.filter((f) => f.mimeType === "text/markdown" || f.name.endsWith(".md"));

  let originalBody: string | null = null;
  for (const f of mdFiles) {
    const raw = await downloadText(f.id);
    const parsed = parsePost(raw, f.name);
    if (parsed.meta.slug === slug && !parsed.meta.draft && parsed.meta.lang === "pt") {
      originalBody = parsed.body;
      break;
    }
  }

  if (originalBody === null) {
    return { statusCode: 404, body: "Post not found or not translatable (must be lang: pt)" };
  }

  // Call Gemini.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "GEMINI_API_KEY not configured" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: SYSTEM_PROMPT(lang),
  });

  const result = await model.generateContent(originalBody);
  const translated = result.response.text();

  // Permanent cache (no TTL).
  await setCached(cacheKey, translated, null);

  return {
    statusCode: 200,
    headers: { ...corsHeaders(event), "content-type": "application/json", "x-blog-cache": "miss" },
    body: JSON.stringify({ slug, lang, body: translated, cached: false }),
  };
};
```

Note on the model name (`gemini-2.0-flash-exp`): verify the current model ID being used elsewhere in the codebase (`netlify/functions/chat.ts` should have it). Use the same one.

- [ ] **Step 2: Verify model name**

Read: `netlify/functions/chat.ts`. Note the model ID used in `getGenerativeModel({ model: "..." })`. Replace `gemini-2.0-flash-exp` in `blog-translate.ts` with the same value.

- [ ] **Step 3: Smoke test**

Run: `npx netlify dev`
Run in another terminal:
```bash
curl -X POST http://localhost:8888/api/blog/translate \
  -H "content-type: application/json" \
  -d '{"slug":"hello","lang":"en"}'
```
Expected: JSON with `body` containing English translation. Re-running returns `cached: true` and `x-blog-cache: hit` header.

Test rejections:
```bash
curl -X POST http://localhost:8888/api/blog/translate \
  -H "content-type: application/json" -d '{"slug":"hello","lang":"klingon"}'
```
Expected: 400 "lang must be one of: en, es".

```bash
curl -X POST http://localhost:8888/api/blog/translate \
  -H "content-type: application/json" -d '{"slug":"nonexistent","lang":"en"}'
```
Expected: 404.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-translate.ts
git commit -m "feat(blog): /api/blog/translate with cache + rate-limit + lang whitelist"
```

### Task 4.2: TranslateBanner UI component

**Files:**
- Create: `src/components/blog/TranslateBanner.tsx`
- Modify: `src/lib/blog/api.ts`

- [ ] **Step 1: Add translate API client**

Modify: `src/lib/blog/api.ts` — append:

```ts
export interface TranslateResponse {
  slug: string;
  lang: string;
  body: string;
  cached: boolean;
}

export async function translatePost(
  slug: string,
  lang: "en" | "es"
): Promise<string> {
  const res = await fetch("/api/blog/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, lang }),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
  const data = (await res.json()) as TranslateResponse;
  return data.body;
}
```

- [ ] **Step 2: Write the banner component**

Create: `src/components/blog/TranslateBanner.tsx`

```tsx
import { useState } from "react";
import { translatePost } from "../../lib/blog/api";

interface TranslateBannerProps {
  slug: string;
  targetLang: "en" | "es";
  onTranslated: (translatedBody: string) => void;
  onReset: () => void;
  showingTranslation: boolean;
}

const LABELS = {
  en: { offer: "This post was written in Portuguese. Translate to English?", action: "Translate", loading: "Translating…", revert: "Show original (PT)", disclaimer: "Auto-translated by AI." },
  es: { offer: "Este post fue escrito en portugués. ¿Traducir al español?", action: "Traducir", loading: "Traduciendo…", revert: "Ver original (PT)", disclaimer: "Traducido automáticamente por IA." },
};

export default function TranslateBanner({
  slug,
  targetLang,
  onTranslated,
  onReset,
  showingTranslation,
}: TranslateBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labels = LABELS[targetLang];

  async function handleTranslate() {
    setLoading(true);
    setError(null);
    try {
      const cached = sessionStorage.getItem(`translation:${slug}:${targetLang}`);
      if (cached) {
        onTranslated(cached);
      } else {
        const translated = await translatePost(slug, targetLang);
        sessionStorage.setItem(`translation:${slug}:${targetLang}`, translated);
        onTranslated(translated);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-electric/40 bg-electric/5 px-4 py-3 mb-8 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-foreground">
        {showingTranslation ? labels.disclaimer : labels.offer}
      </p>
      <div className="flex gap-2">
        {showingTranslation ? (
          <button
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-foreground px-3 py-1.5"
          >
            {labels.revert}
          </button>
        ) : (
          <button
            onClick={handleTranslate}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-[0.1em] border border-neon text-neon hover:bg-neon/10 px-3 py-1.5 disabled:opacity-50"
          >
            {loading ? labels.loading : labels.action}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Wire banner into BlogPost**

Modify: `src/pages/BlogPost.tsx` — add banner logic. Replace the file with:

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPost, type PostResponse } from "../lib/blog/api";
import MarkdownRenderer from "../components/blog/MarkdownRenderer";
import TranslateBanner from "../components/blog/TranslateBanner";
import BlogLayout from "../components/blog/BlogLayout";
import { formatDate, formatReadingTime, useLocale } from "../lib/blog/format";

function pickTranslationTarget(userLang: string, postLang: string): "en" | "es" | null {
  if (postLang !== "pt") return null;
  if (userLang.startsWith("en")) return "en";
  if (userLang.startsWith("es")) return "es";
  return null;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const userLang = useLocale();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPost(null);
    setNotFound(false);
    setError(null);
    setTranslatedBody(null);
    fetchPost(slug)
      .then((p) => (p ? setPost(p) : setNotFound(true)))
      .catch((e) => setError(String(e)));
  }, [slug]);

  if (error) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-16 text-foreground">
          <p className="text-red-400">Erro: {error}</p>
          <Link to="/blog" className="text-neon underline mt-4 inline-block">
            ← Voltar para o blog
          </Link>
        </div>
      </BlogLayout>
    );
  }

  if (notFound) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-24 text-foreground text-center">
          <h1 className="font-display text-4xl mb-4">Post não encontrado</h1>
          <p className="text-muted-foreground mb-8">
            O post "{slug}" não existe ou foi removido.
          </p>
          <Link to="/blog" className="text-neon underline">
            ← Voltar para o blog
          </Link>
        </div>
      </BlogLayout>
    );
  }

  if (!post) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-16 text-muted-foreground">Carregando…</div>
      </BlogLayout>
    );
  }

  const target = pickTranslationTarget(userLang, post.meta.lang);
  const bodyToRender = translatedBody ?? post.body;

  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <Link
          to="/blog"
          className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon transition-colors"
        >
          ← blog
        </Link>

        <header className="mt-8 mb-8">
          <h1 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
            {post.meta.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <span>{formatDate(post.meta.date, userLang)}</span>
            <span>·</span>
            <span>{formatReadingTime(post.meta.readingTimeMin, userLang)}</span>
            <span>·</span>
            <span>{post.meta.lang}</span>
            {post.meta.tags.length > 0 && (
              <>
                <span>·</span>
                {post.meta.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/blog/tag/${encodeURIComponent(t)}`}
                    className="hover:text-neon"
                  >
                    #{t}
                  </Link>
                ))}
              </>
            )}
          </div>
        </header>

        {target && (
          <TranslateBanner
            slug={post.meta.slug}
            targetLang={target}
            onTranslated={setTranslatedBody}
            onReset={() => setTranslatedBody(null)}
            showingTranslation={translatedBody !== null}
          />
        )}

        <MarkdownRenderer body={bodyToRender} />
      </div>
    </BlogLayout>
  );
}
```

- [ ] **Step 4: Manual test**

Run: `npx netlify dev`

Switch site language to EN via the language selector. Open `/blog/hello`. Expect:
- Banner appears offering English translation.
- Click "Translate". Loading state. Then post body changes to English.
- Click "Show original (PT)". Body switches back.
- Refresh page. Banner appears again (sessionStorage cache survives within session, click "Translate" — should be instant since cached locally).

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/TranslateBanner.tsx src/lib/blog/api.ts src/pages/BlogPost.tsx
git commit -m "feat(blog): TranslateBanner with session cache"
```

---

## Phase 5 — Polish

Disqus, share buttons, RSS, sitemap, revalidate endpoint, BlogTag page, agent integration, 404 link to chatbot.

### Task 5.1: Disqus embed (lazy)

**Files:**
- Create: `src/components/blog/DisqusEmbed.tsx`
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Write component**

Create: `src/components/blog/DisqusEmbed.tsx`

```tsx
import { useEffect, useRef, useState } from "react";

interface DisqusEmbedProps {
  shortname: string;
  identifier: string;
  title: string;
  url: string;
}

declare global {
  interface Window {
    disqus_config?: () => void;
    DISQUS?: { reset: (opts: { reload: boolean; config: () => void }) => void };
  }
}

export default function DisqusEmbed({ shortname, identifier, title, url }: DisqusEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: "200px" });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    window.disqus_config = function () {
      // @ts-expect-error disqus injects `this`
      this.page.url = url;
      // @ts-expect-error disqus injects `this`
      this.page.identifier = identifier;
      // @ts-expect-error disqus injects `this`
      this.page.title = title;
    };

    const existing = document.querySelector("script[data-disqus]");
    if (existing) {
      if (window.DISQUS) {
        window.DISQUS.reset({ reload: true, config: window.disqus_config });
      }
      return;
    }

    const s = document.createElement("script");
    s.src = `https://${shortname}.disqus.com/embed.js`;
    s.setAttribute("data-timestamp", String(Date.now()));
    s.setAttribute("data-disqus", "1");
    document.body.appendChild(s);
  }, [visible, shortname, identifier, title, url]);

  return (
    <div ref={ref} className="mt-16 pt-8 border-t border-border">
      <h2 className="font-display text-2xl text-foreground mb-6">Comentários</h2>
      <div id="disqus_thread" />
    </div>
  );
}
```

- [ ] **Step 2: Expose Disqus shortname to frontend**

Vite env vars need `VITE_` prefix. Add to `.env.example` (and remind user to set in Netlify):

Modify: `.env.example` (or create if missing)
```
VITE_DISQUS_SHORTNAME=your-disqus-shortname
```

Document: tell the user to also set `VITE_DISQUS_SHORTNAME` in Netlify env vars (it's exposed to browser, which is fine — Disqus shortnames are public).

- [ ] **Step 3: Add Disqus to BlogPost**

Modify: `src/pages/BlogPost.tsx` — at the end of the inner `<div>`, after `<MarkdownRenderer>`:

```tsx
{import.meta.env.VITE_DISQUS_SHORTNAME && (
  <DisqusEmbed
    shortname={import.meta.env.VITE_DISQUS_SHORTNAME}
    identifier={`post-${post.meta.slug}`}
    title={post.meta.title}
    url={`https://guiresende20.netlify.app/blog/${post.meta.slug}`}
  />
)}
```

Add import at top: `import DisqusEmbed from "../components/blog/DisqusEmbed";`

- [ ] **Step 4: Update CSP**

The Disqus script is loaded from `https://<shortname>.disqus.com`. Update CSP `script-src` and `frame-src`:

Modify: `netlify.toml` — in the `Content-Security-Policy` value:
- Add `https://*.disqus.com https://*.disquscdn.com` to `script-src`.
- Add `https://*.disqus.com` to `frame-src`.
- Add `https://*.disqus.com` to `connect-src`.

- [ ] **Step 5: Manual test**

Open: `/blog/hello`
Scroll to bottom. Expect Disqus to load when the comments section enters viewport.

- [ ] **Step 6: Commit**

```bash
git add src/components/blog/DisqusEmbed.tsx src/pages/BlogPost.tsx netlify.toml .env.example
git commit -m "feat(blog): lazy-loaded Disqus comments"
```

### Task 5.2: ShareButtons component

**Files:**
- Create: `src/components/blog/ShareButtons.tsx`
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Write the component**

Create: `src/components/blog/ShareButtons.tsx`

```tsx
import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const cls = "font-mono text-[10px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-neon hover:border-neon px-3 py-1.5 transition-colors";

  return (
    <div className="flex gap-2 mt-12 pt-8 border-t border-border">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground self-center mr-2">
        Compartilhar:
      </span>
      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        LinkedIn
      </a>
      <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        X
      </a>
      <button onClick={copyLink} className={cls}>
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add to BlogPost**

Modify: `src/pages/BlogPost.tsx` — between `<MarkdownRenderer>` and `<DisqusEmbed>`:

```tsx
<ShareButtons
  url={`https://guiresende20.netlify.app/blog/${post.meta.slug}`}
  title={post.meta.title}
/>
```

Import: `import ShareButtons from "../components/blog/ShareButtons";`

- [ ] **Step 3: Commit**

```bash
git add src/components/blog/ShareButtons.tsx src/pages/BlogPost.tsx
git commit -m "feat(blog): share buttons (LinkedIn, X, copy link)"
```

### Task 5.3: RSS feed endpoint

**Files:**
- Create: `netlify/functions/blog-rss.ts`
- Modify: `netlify.toml`
- Modify: `index.html`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/blog-rss.ts`

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadText } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";

const SITE_URL = "https://guiresende20.netlify.app";

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]!));
}

export const handler: Handler = async () => {
  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles = files.filter((f) => f.mimeType === "text/markdown" || f.name.endsWith(".md"));

  const entries: Array<{ slug: string; title: string; date: string; excerpt: string }> = [];
  for (const file of mdFiles) {
    const raw = await downloadText(file.id);
    const { meta } = parsePost(raw, file.name);
    if (meta.draft) continue;
    entries.push({
      slug: meta.slug,
      title: meta.title,
      date: meta.date,
      excerpt: meta.excerpt ?? "",
    });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));

  const updated = entries[0]?.date ?? new Date().toISOString().slice(0, 10);

  const items = entries
    .map(
      (e) => `  <entry>
    <title>${escapeXml(e.title)}</title>
    <link href="${SITE_URL}/blog/${encodeURIComponent(e.slug)}" />
    <id>${SITE_URL}/blog/${encodeURIComponent(e.slug)}</id>
    <updated>${e.date}T00:00:00Z</updated>
    <summary>${escapeXml(e.excerpt)}</summary>
  </entry>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Guilherme Resende — Blog</title>
  <link href="${SITE_URL}/blog" />
  <link href="${SITE_URL}/api/blog/rss" rel="self" />
  <id>${SITE_URL}/blog</id>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>Guilherme Resende Muniz</name></author>
${items}
</feed>`;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
    body: xml,
  };
};
```

- [ ] **Step 2: Add redirect**

Modify: `netlify.toml` — add above the generic `/api/*` rule:
```toml
[[redirects]]
  from = "/api/blog/rss"
  to = "/.netlify/functions/blog-rss"
  status = 200
```

- [ ] **Step 3: Add link in index.html**

Modify: `index.html` — inside `<head>`:
```html
<link rel="alternate" type="application/atom+xml" title="Blog" href="/api/blog/rss" />
```

- [ ] **Step 4: Smoke test**

Open: `http://localhost:8888/api/blog/rss`
Expected: valid Atom XML with entries.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/blog-rss.ts netlify.toml index.html
git commit -m "feat(blog): atom RSS feed at /api/blog/rss"
```

### Task 5.4: Dynamic sitemap (replacing static)

**Files:**
- Create: `netlify/functions/sitemap.ts`
- Modify: `netlify.toml`
- Delete (or empty): `public/sitemap.xml`

- [ ] **Step 1: Write the function**

Create: `netlify/functions/sitemap.ts`

```ts
import type { Handler } from "@netlify/functions";
import { listFolder, downloadText } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";

const SITE_URL = "https://guiresende20.netlify.app";

export const handler: Handler = async () => {
  const folders = await resolveBlogFolders();
  const files = await listFolder(folders.rootId);
  const mdFiles = files.filter((f) => f.mimeType === "text/markdown" || f.name.endsWith(".md"));

  const blogUrls: Array<{ loc: string; lastmod: string }> = [];
  for (const file of mdFiles) {
    const raw = await downloadText(file.id);
    const { meta } = parsePost(raw, file.name);
    if (meta.draft) continue;
    blogUrls.push({
      loc: `${SITE_URL}/blog/${encodeURIComponent(meta.slug)}`,
      lastmod: meta.date,
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
${blogUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
    body: xml,
  };
};
```

- [ ] **Step 2: Add redirect — make `/sitemap.xml` hit the function**

Modify: `netlify.toml` — add above the generic `/api/*` rule:
```toml
[[redirects]]
  from = "/sitemap.xml"
  to = "/.netlify/functions/sitemap"
  status = 200
```

- [ ] **Step 3: Remove static sitemap**

Run: `git rm public/sitemap.xml`

- [ ] **Step 4: Verify robots.txt still points correctly**

Read: `public/robots.txt`. Confirm `Sitemap:` line points to `https://guiresende20.netlify.app/sitemap.xml` (URL stays; redirect handles routing).

- [ ] **Step 5: Smoke test**

Open: `http://localhost:8888/sitemap.xml`
Expected: XML with `/`, `/blog`, and one `<url>` per post.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/sitemap.ts netlify.toml
git commit -m "feat(blog): dynamic sitemap.xml including blog posts"
```

### Task 5.5: Revalidate endpoint

**Files:**
- Create: `netlify/functions/blog-revalidate.ts`
- Modify: `netlify.toml`

- [ ] **Step 1: Write function**

Create: `netlify/functions/blog-revalidate.ts`

```ts
import type { Handler } from "@netlify/functions";
import { deleteCached, deleteByPrefix } from "./_lib/blob-cache";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const expectedToken = process.env.BLOG_REVALIDATE_TOKEN;
  if (!expectedToken) {
    return { statusCode: 500, body: "BLOG_REVALIDATE_TOKEN not configured" };
  }

  const provided = event.headers["x-revalidate-token"] || event.headers["X-Revalidate-Token"];
  if (provided !== expectedToken) {
    return { statusCode: 401, body: "Invalid or missing token" };
  }

  const url = new URL(event.rawUrl);
  const slug = url.searchParams.get("slug");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    await deleteByPrefix("posts/");
    return { statusCode: 200, body: JSON.stringify({ cleared: "posts/*" }) };
  }

  if (!slug) {
    return { statusCode: 400, body: "slug required (or pass ?all=true)" };
  }

  await deleteCached("posts/list");
  await deleteCached(`posts/${slug}`);
  // Keep translation cache — translations of unchanged-pt posts stay valid.

  return { statusCode: 200, body: JSON.stringify({ cleared: [`posts/list`, `posts/${slug}`] }) };
};
```

- [ ] **Step 2: Add redirect**

Modify: `netlify.toml` — add above generic `/api/*`:
```toml
[[redirects]]
  from = "/api/blog/revalidate"
  to = "/.netlify/functions/blog-revalidate"
  status = 200
```

- [ ] **Step 3: Smoke test**

```bash
curl -X POST "http://localhost:8888/api/blog/revalidate?slug=hello" \
  -H "X-Revalidate-Token: <token>"
```
Expected: `{"cleared":["posts/list","posts/hello"]}`.

Without token:
```bash
curl -X POST "http://localhost:8888/api/blog/revalidate?slug=hello"
```
Expected: 401.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/blog-revalidate.ts netlify.toml
git commit -m "feat(blog): /api/blog/revalidate cache buster (token-protected)"
```

### Task 5.6: BlogTag page

**Files:**
- Modify: `src/pages/BlogTag.tsx`

- [ ] **Step 1: Replace placeholder**

Modify: `src/pages/BlogTag.tsx`

```tsx
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";

export default function BlogTag() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPostList().then(setPosts).catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!posts || !tag) return [];
    return posts.filter((p) => p.tags.includes(tag));
  }, [posts, tag]);

  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16">
        <Link to="/blog" className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon">
          ← blog
        </Link>
        <header className="mt-8 mb-12">
          <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Tag</span>
          <h1 className="font-display text-5xl text-foreground mt-2">#{tag}</h1>
        </header>

        {error && <p className="text-red-400">Erro: {error}</p>}
        {!posts && !error && <p className="text-muted-foreground">Carregando…</p>}
        {posts && filtered.length === 0 && (
          <p className="text-muted-foreground">Nenhum post com essa tag.</p>
        )}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </div>
    </BlogLayout>
  );
}
```

- [ ] **Step 2: Manual test**

Open: `/blog/tag/three.js`
Expected: filtered list of posts.

- [ ] **Step 3: Commit**

```bash
git add src/pages/BlogTag.tsx
git commit -m "feat(blog): tag listing page"
```

### Task 5.7: 404 with chatbot suggestion

The current `BlogPost.tsx` 404 only links back to `/blog`. Add a chatbot CTA.

**Files:**
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Update 404 block**

Modify: `src/pages/BlogPost.tsx` — find the `if (notFound)` block. Replace with:

```tsx
if (notFound) {
  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-24 text-foreground text-center max-w-xl">
        <h1 className="font-display text-4xl mb-4">Post não encontrado</h1>
        <p className="text-muted-foreground mb-8">
          O post "{slug}" não existe ou foi removido. Quer perguntar sobre o assunto?
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/blog" className="font-mono text-xs uppercase tracking-[0.1em] border border-border text-foreground px-4 py-2">
            ← Voltar para o blog
          </Link>
          <a href="/#chat" className="font-mono text-xs uppercase tracking-[0.1em] border border-neon text-neon px-4 py-2 hover:bg-neon/10">
            Falar com a IA
          </a>
        </div>
      </div>
    </BlogLayout>
  );
}
```

The `/#chat` link assumes the chatbot is opened by an anchor or scroll-target on Index. Verify by reading `Index.tsx` and how chatbot is invoked. If the chatbot opens via a different mechanism (e.g., URL hash, query param), adjust accordingly.

- [ ] **Step 2: Commit**

```bash
git add src/pages/BlogPost.tsx
git commit -m "feat(blog): 404 page suggests chatbot"
```

### Task 5.8: Agent knows about blog posts

Inject post list into the system prompt so the chatbot can recommend posts.

**Files:**
- Modify: `src/lib/system-prompt.ts`
- Modify: `netlify/functions/chat.ts`

- [ ] **Step 1: Read current chat.ts to understand prompt construction**

Read: `netlify/functions/chat.ts`. Note where `SYSTEM_PROMPT` is defined and assembled. Note: chat.ts has the prompt inline; `src/lib/system-prompt.ts` is the duplicated frontend copy.

- [ ] **Step 2: Add helper to fetch post titles at function start**

Modify: `netlify/functions/chat.ts` — at the top:

```ts
import { listFolder, downloadText } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { getCached, setCached } from "./_lib/blob-cache";
import { parsePost } from "../../src/lib/blog/frontmatter";

const POST_LIST_TTL_MS = 10 * 60_000;

async function getPostsForPrompt(): Promise<string> {
  const cacheKey = "posts/prompt-summary";
  const cached = await getCached<string>(cacheKey);
  if (cached) return cached;
  try {
    const folders = await resolveBlogFolders();
    const files = await listFolder(folders.rootId);
    const mds = files.filter((f) => f.mimeType === "text/markdown" || f.name.endsWith(".md"));
    const lines: string[] = [];
    for (const f of mds) {
      const raw = await downloadText(f.id);
      const { meta } = parsePost(raw, f.name);
      if (meta.draft) continue;
      const excerpt = meta.excerpt ?? "";
      lines.push(`- /blog/${meta.slug} — "${meta.title}" — ${excerpt}`);
    }
    const summary = lines.length
      ? `\n\n---\n\nPOSTS DO BLOG (recomende quando relevante, com o link /blog/<slug>):\n${lines.join("\n")}`
      : "";
    await setCached(cacheKey, summary, POST_LIST_TTL_MS);
    return summary;
  } catch (err) {
    console.error("getPostsForPrompt failed", err);
    return "";
  }
}
```

- [ ] **Step 3: Append post summary to SYSTEM_PROMPT at request time**

Modify: `netlify/functions/chat.ts` — wherever the model is created with `systemInstruction`, build the prompt dynamically:

```ts
// Before creating the model:
const postsSummary = await getPostsForPrompt();
const fullSystemPrompt = SYSTEM_PROMPT + postsSummary;

// Then pass fullSystemPrompt where SYSTEM_PROMPT was used.
```

(Be sure not to break the existing prompt structure. If `SYSTEM_PROMPT` is mid-flow, append after closing newlines.)

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/chat.ts
git commit -m "feat(blog): chatbot knows about published posts (cache 10min)"
```

### Task 5.9: Add Blog link to footer

**Files:**
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Read Footer.tsx**

Read: `src/components/Footer.tsx`. Find the "quick links" list.

- [ ] **Step 2: Add Blog link**

Modify: add a `<Link to="/blog">` entry to the quick-links list using `react-router-dom`'s `Link`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat(blog): footer link to /blog"
```

### Task 5.10: JSON-LD BlogPosting on post pages

**Files:**
- Modify: `src/pages/BlogPost.tsx`

- [ ] **Step 1: Add helper**

Modify: `src/pages/BlogPost.tsx` — add helper at top of file:

```ts
function blogPostingJsonLd(meta: { slug: string; title: string; date: string; excerpt?: string; cover?: string }) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    datePublished: meta.date,
    dateModified: meta.date,
    description: meta.excerpt,
    image: meta.cover ? `https://guiresende20.netlify.app/api/blog/image/${meta.cover}` : undefined,
    url: `https://guiresende20.netlify.app/blog/${meta.slug}`,
    author: {
      "@type": "Person",
      name: "Guilherme Resende Muniz",
      url: "https://guiresende20.netlify.app/",
    },
  });
}
```

- [ ] **Step 2: Inject script when post loads**

Modify: `src/pages/BlogPost.tsx` — inside the rendered post JSX, add (before `<header>`):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post.meta) }}
/>
```

This is a child of the main `<div>` — React renders the script tag in body, which Google still indexes.

- [ ] **Step 3: Commit**

```bash
git add src/pages/BlogPost.tsx
git commit -m "feat(blog): JSON-LD BlogPosting on post pages"
```

### Task 5.11: Sticky TOC sidebar on post page (desktop only)

**Files:**
- Create: `src/components/blog/PostTOC.tsx`
- Modify: `src/pages/BlogPost.tsx`

The TOC is generated from `<h2>` elements in the rendered post.

- [ ] **Step 1: Write the TOC component**

Create: `src/components/blog/PostTOC.tsx`

```tsx
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function PostTOC({ articleSelector = "article" }: { articleSelector?: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Build TOC after markdown renders.
  useEffect(() => {
    const article = document.querySelector(articleSelector);
    if (!article) return;
    const h2s = Array.from(article.querySelectorAll("h2"));
    const list: Heading[] = h2s.map((h) => {
      const text = h.textContent ?? "";
      let id = h.id;
      if (!id) {
        id = slugify(text);
        h.id = id;
      }
      return { id, text };
    });
    setHeadings(list);
  }, [articleSelector]);

  // Track which heading is currently in view.
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden lg:block sticky top-24 self-start w-56 ml-12 shrink-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-3">
        Neste post
      </p>
      <ul className="space-y-2 border-l border-border pl-3">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-xs transition-colors ${
                activeId === h.id ? "text-neon" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 2: Wire TOC into BlogPost layout**

Modify: `src/pages/BlogPost.tsx` — change the post container to a flex layout that holds TOC + article side-by-side on desktop. Find the rendered post block (where `<MarkdownRenderer>` lives) and wrap:

```tsx
import PostTOC from "../components/blog/PostTOC";

// ...inside the returned BlogLayout:
<div className="container mx-auto px-6 py-16">
  <div className="max-w-3xl mx-auto lg:max-w-none lg:flex lg:items-start lg:justify-center">
    <div className="max-w-3xl mx-auto lg:mx-0">
      {/* back link, header, TranslateBanner, MarkdownRenderer, ShareButtons, DisqusEmbed */}
      {/* (move existing content here unchanged) */}
    </div>
    <PostTOC />
  </div>
</div>
```

The article must keep its `<article>` tag (already in `MarkdownRenderer.tsx`) — that's the selector `PostTOC` uses.

- [ ] **Step 3: Manual test**

Open: `/blog/<post-with-multiple-h2>` on a wide desktop viewport.
Expected: TOC appears on the right, sticky, highlighting current section as you scroll. Hidden on mobile/tablet.

- [ ] **Step 4: Commit**

```bash
git add src/components/blog/PostTOC.tsx src/pages/BlogPost.tsx
git commit -m "feat(blog): sticky TOC sidebar (desktop only)"
```

### Task 5.12: Phase 5 acceptance smoke test

- [ ] **Step 1: Manual checklist**

With real env vars and at least 2 posts in Drive (one PT, one with `draft: true`, one with `featured: true`):

- [ ] `/blog` shows posts, featured at top, drafts excluded
- [ ] Tag filter works
- [ ] "Load more" appears past 15 posts
- [ ] Clicking a post renders markdown with prose styling
- [ ] Images in posts load via `/api/blog/image/...`
- [ ] Switching browser language to EN triggers TranslateBanner
- [ ] Translation succeeds, can revert to original
- [ ] Re-clicking translate is instant (session cache)
- [ ] Disqus loads after scroll, comments work
- [ ] Share buttons: LinkedIn/X open, copy link copies
- [ ] `/blog/tag/<tag>` filters correctly
- [ ] `/blog/does-not-exist` shows 404 with chat CTA
- [ ] `/sitemap.xml` includes blog posts
- [ ] `/api/blog/rss` returns valid Atom
- [ ] Chatbot mentions and links to a post when asked
- [ ] Lighthouse on `/blog`: ≥ 95 in all categories
- [ ] Lighthouse on `/blog/:slug`: ≥ 95 in all categories
- [ ] Existing `/` Lighthouse unchanged

If any fail, fix before merging.

- [ ] **Step 2: Push and open PR (or merge if working solo)**

```bash
git push origin <branch>
gh pr create --title "feat: blog section backed by Drive with AI translation" --body "Implements docs/superpowers/specs/2026-05-16-blog-section-design.md. See docs/blog-setup.md for one-time owner setup."
```

---

## Verification before completion

Before declaring done:

- [ ] `npm run test:run` passes (frontmatter, image-paths smoke).
- [ ] `npm run build` succeeds with no TypeScript errors.
- [ ] Manual acceptance from Task 5.11 all pass.
- [ ] `docs/blog-setup.md` followed by owner end-to-end at least once.

## Out-of-scope reminders

Items from the spec explicitly NOT in this plan (do not creep):
- Static URLs for AI translations (would require pre-rendering of cached translations).
- Full-text search.
- Newsletter / email subscription.
- Likes / reactions beyond Disqus.
- In-browser admin editor.
- Password-protected / paywalled posts.
- HEIC/AVIF input image support.
