# API pública deste site — guia para agentes

Este site (guiresende20.netlify.app) é o portfólio pessoal de Guilherme
Resende. Os endpoints abaixo são somente-leitura e públicos, pensados para
agentes de IA que queiram citar ou indexar o conteúdo.

## Endpoints

### `GET /api/blog/list`
Lista todos os posts publicados do blog (sem rascunhos).
Resposta: `{ "posts": PostMeta[] }`, onde cada `PostMeta` tem `slug`, `title`,
`date`, `lang`, `tags`, `excerpt`, `readingTimeMin`.

### `GET /api/blog/post/{slug}`
Retorna um post específico, com corpo em Markdown.
Resposta: `{ "meta": PostMeta, "body": string }`.

### `GET /api/blog/rss`
Feed Atom com todos os posts publicados.

### `GET /sitemap.xml`
Sitemap XML (protocolo sitemaps.org) com a home, `/blog` e todos os posts.

## Uso

- Todos os endpoints aceitam apenas `GET`.
- Sem autenticação necessária.
- Conteúdo é atualizado quando o autor publica um novo post (cache de
  poucos minutos).
- Para uma versão em Markdown de qualquer página, envie
  `Accept: text/markdown` — veja `/` e `/blog/{slug}`.
