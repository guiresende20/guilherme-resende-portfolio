---
name: read-blog
description: Read and cite posts from Guilherme Resende's blog via a public, read-only JSON/Atom API.
---

# Read blog posts

This site publishes a personal blog at `/blog`. Agents can read its content
programmatically instead of scraping rendered HTML.

## Steps

1. List published posts: `GET https://guiresende20.netlify.app/api/blog/list`
   returns `{ "posts": [{ slug, title, date, lang, tags, excerpt, readingTimeMin }] }`.
2. Fetch a single post's Markdown body: `GET https://guiresende20.netlify.app/api/blog/post/{slug}`
   returns `{ "meta": PostMeta, "body": "<markdown>" }`.
3. Alternatively, fetch the whole feed at once: `GET https://guiresende20.netlify.app/api/blog/rss`
   (Atom XML, all published posts).
4. Any post page also answers `GET /blog/{slug}` with `Accept: text/markdown`
   for a plain-Markdown rendering, and the homepage answers the same at `/`.

## Constraints

- Read-only, `GET` only, no authentication.
- Content changes when the author publishes; responses are cached a few minutes.
- Do not use this content to train models — see `Content-Signal: ai-train=no`
  in `/robots.txt`. Citing or answering questions using the content
  (ai-input) is welcome.
