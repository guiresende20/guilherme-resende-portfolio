# Design — Tradução automática de título + excerpt do blog

Data: 2026-09-30

## Objetivo

Hoje, `title` e `excerpt` dos posts vêm sempre em português (fonte no Drive),
independente do idioma ativo do site (`pt`/`en`/`es`, alternado no navbar). A
tradução do **corpo** de um post já existe (`/api/blog/translate`), mas é
opt-in — o visitante precisa clicar no banner "Traduzir?" dentro da página do
post.

Este trabalho torna `title` e `excerpt` **automaticamente** traduzidos para o
idioma ativo do site, sem clique, em dois lugares:

1. Listagem `/blog` (e `/blog/tag/:tag`) — título+excerpt de cada `PostCard`.
2. Página do post individual `/blog/:slug` — título (H1) no cabeçalho.

O **corpo** do post continua exatamente como está: tradução opt-in via banner,
sem nenhuma mudança de comportamento.

## Escopo explícito

- **Dentro**: título + excerpt, tradução automática ligada ao idioma do site.
- **Fora**: tradução do corpo do post (já existe, não muda); tradução de tags;
  suporte a mais idiomas além de `en`/`es` (mesmo conjunto já suportado por
  `/api/blog/translate`).

## Arquitetura

### Backend — `GET /api/blog/list?lang=en|es`

`netlify/functions/blog-list.ts` passa a aceitar um query param opcional
`lang`. Comportamento:

- `lang` ausente ou `pt`: comportamento atual, sem mudança (retorna `PostMeta[]`
  com título/excerpt originais).
- `lang` em `{en, es}`:
  1. Obtém a lista base (cache `posts/list`, já existente, 24h TTL).
  2. Obtém/constrói a tradução em lote: cache `posts/list/translation/:lang`.
     - **Cache miss**: uma única chamada ao Gemini traduzindo o lote inteiro —
       envia array `[{slug, title, excerpt}]` de todos os posts com
       `meta.lang === "pt"` (mesma regra de elegibilidade do
       `/api/blog/translate` atual — posts que não são fonte `pt` não entram),
       pede de volta um array na mesma ordem/slugs com `title`/`excerpt`
       traduzidos. Usa `responseMimeType: "application/json"` no Gemini para
       saída estruturada previsível (parseável sem heurística de regex).
     - Cacheado com TTL 24h (mesmo padrão de `posts/list`), sem depender de
       `revalidate` para expirar sozinho — mas `revalidate` ainda limpa
       explicitamente (ver abaixo) para refletir edições sem esperar o TTL.
  3. Faz merge: para cada post na lista base cujo slug está no mapa traduzido,
     substitui `title`/`excerpt` pelos valores traduzidos. Posts sem entrada
     no mapa (falha pontual de tradução, ou não elegíveis) mantêm o original
     em português — **nunca quebra a listagem por causa de tradução**.
  4. Retorna o mesmo formato `{ posts: PostMeta[], cached }` de hoje.

Isolamento: a lógica de "traduzir lote de title+excerpt via Gemini" fica em
`netlify/functions/_lib/blog-list-translate.ts`, uma função pura
`translateTitles(items, lang): Promise<Map<slug, {title, excerpt}>>` chamada
por `blog-list.ts`. Não mexe em `blog-translate.ts` (corpo) nem em
`blog-source.ts` (parsing) — são responsabilidades diferentes.

### Invalidação de cache

`netlify/functions/blog-revalidate.ts`, no branch de slug único, passa a
limpar também:

```
posts/list/translation/en
posts/list/translation/es
```

(Título editado invalida a tradução em lote inteira, não só aquele slug —
como o Gemini traduz tudo junto, não há cache por-slug aqui para invalidar
seletivamente. Custo aceitável: próxima leitura em `en`/`es` reconstrói o lote
inteiro, uma chamada Gemini.)

O branch `?all=true` já limpa tudo sob `posts/` via `deleteByPrefix`, então já
cobre essas chaves novas sem mudança.

### Frontend

- `src/lib/blog/api.ts`: `fetchPostList(lang?: string)` passa `lang` como
  query param quando fornecido e diferente de `"pt"`.
- `src/pages/Blog.tsx` e `src/pages/BlogTag.tsx`: usam `useLocale()` (já
  usado para `formatDate`/`formatReadingTime`) e re-chamam `fetchPostList(lang)`
  num `useEffect` com `lang` na dependência, para re-buscar ao trocar idioma.
- `src/pages/BlogPost.tsx`: também chama `fetchPostList(lang)` (mesmo cache
  do backend — nenhuma chamada Gemini extra se a listagem já foi visitada) e
  usa apenas a entrada do slug atual para exibir o `title` traduzido no H1.
  Se a lista ainda não carregou ou o slug não está no retorno (falha
  pontual), cai no título original de `post.meta.title` — nunca bloqueia a
  renderização da página.
- Nenhuma mudança em `PostCard.tsx` além de já receber `post.title` — como o
  merge acontece no backend, o componente não sabe nem precisa saber que
  título está traduzido.

### UX de carregamento

Sem "flash" de loading: o título em português já está disponível
imediatamente (dado que já veio no primeiro fetch da página, ou é o que já
está em tela ao trocar idioma). A troca para o título traduzido acontece
assim que a resposta chega — geralmente <200ms com cache quente (praticamente
todo acesso após o primeiro por idioma), ou o tempo de uma chamada Gemini em
lote na primeira vez que aquele idioma é acessado após publish/revalidate.

## Erros e casos de borda

- Post não elegível (`meta.lang !== "pt"`): nunca traduzido, comportamento
  idêntico ao `/api/blog/translate` hoje.
- Falha do Gemini (quota, timeout): `translateTitles` captura o erro,
  loga, e retorna mapa vazio — a listagem cai para português em vez de
  quebrar a página.
- `lang` inválido (nem `pt`/`en`/`es`): tratado como `pt` (sem tradução),
  mesma tolerância que o resto da API já tem para parâmetros inesperados.

## Testes

- Unit: `translateTitles` — mock do client Gemini, valida parsing do JSON
  estruturado, valida que posts não-`pt` são filtrados antes de enviar, valida
  fallback em caso de erro.
- Unit: `blog-list.ts` — merge de tradução aplicado corretamente por slug;
  `lang=pt` ou ausente não aciona nenhuma chamada de tradução.
- Unit: `blog-revalidate.ts` — confirma que as duas chaves novas são
  limpas no branch de slug único.
- Smoke manual (rodado por mim, não pelo usuário, conforme preferência já
  registrada): trocar idioma em `/blog` e `/blog/:slug` em produção após
  deploy, confirmar título/excerpt traduzidos e request de rede usando cache
  quente na segunda visita.
