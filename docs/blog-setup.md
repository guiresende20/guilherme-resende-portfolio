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
