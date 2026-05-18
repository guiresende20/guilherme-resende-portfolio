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

---

## RAG no chatbot

### O que é

O chatbot do site usa RAG (Retrieval-Augmented Generation) sobre os posts do blog. A cada mensagem, ele recupera os trechos mais relevantes dos posts e usa como contexto para responder. Isso permite respostas como "no post X, escrevi que Y..." com citação real do conteúdo — não só recomendação do link.

### Como funciona

Quando um post é publicado/atualizado e você bate em `/api/blog/revalidate?slug=foo`, o sistema também gera embeddings vetoriais do conteúdo (via Gemini `text-embedding-004`) e armazena num índice JSON no Netlify Blobs (`embeddings/posts-index.json`). Quando alguém manda mensagem no chat, a pergunta é convertida em vetor e os top-5 trechos mais similares (cosine ≥ 0.6, no máximo 2 por post) são injetados no prompt.

### Bootstrap inicial (rodar 1 vez após primeiro deploy)

```bash
curl -X POST https://guiresende20.netlify.app/api/blog/reindex \
  -H "X-Revalidate-Token: $BLOG_REVALIDATE_TOKEN"
```

Esperado: `200 { total: N, indexed: N, failed: 0 }`.

### Quando reindexar manualmente

- Após criar um post novo: acontece automático via `/api/blog/revalidate?slug=<novo>`.
- Após editar um post: idem.
- **Botão de pânico**: se as respostas começarem a ficar estranhas (ou após mudar configurações), rodar `POST /api/blog/reindex` para regenerar tudo.

### Custo

- Indexação: ~1 chamada de embedding por post (em batch). Free tier do Gemini cobre folgado (1500 req/dia).
- Consulta: 1 chamada de embedding por mensagem do chat. ~$0.000015 por pergunta — desprezível.
- Storage: ~5KB por post no Blobs. 100 posts = 500KB. Free tier.

### Como verificar se está funcionando

- No painel Blobs do Netlify: existem `embeddings/posts-index.json` e `embeddings/meta.json`.
- Pergunta de teste no chat: "o que você escreveu sobre [tópico de um post]?" — a resposta deve citar trecho específico, não apenas recomendar o link.
- Logs da function `chat` (painel Functions do Netlify): linha `rag.retrieveRelevantChunks: ... hits=N topScore=0.XX`.

### Troubleshooting

| Sintoma | Diagnóstico | Fix |
|---|---|---|
| Chatbot só recomenda links, nunca cita trechos | Índice vazio | `POST /api/blog/reindex` |
| Chatbot cita trechos errados pra perguntas off-topic | Threshold muito baixo | Subir `THRESHOLD` de 0.6 → 0.7 em `netlify/functions/_lib/rag.ts` |
| Latência do chat aumentou >800ms | Embedding API lenta | Verificar status do Gemini; threshold do timeout interno é 1.5s (degrada gracioso) |
| Erro `"vector store write failed"` no log | Blobs sem permissão / contexto | Verificar que a function roda em contexto Netlify (não local sem `netlify dev`) |
| 401 no `/api/blog/reindex` | Token errado ou ausente | Conferir env var `BLOG_REVALIDATE_TOKEN` e header `X-Revalidate-Token` |

### Limitações conhecidas

- Indexação é síncrona dentro do revalidate. Post muito longo (>50 chunks) pode levar 2-3s — aceitável pra blog pessoal.
- Drafts (`meta.draft === true`) e quaisquer posts em subpastas NÃO são indexados, por design.
- Cache em memória da function pode ficar até ~1min defasado após reindex (warm function pode segurar índice velho). Não é problema em prática.
