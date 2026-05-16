# Portfolio Roadmap — Wow-factor + Technical Playground

**Data:** 2026-05-16
**Branch:** codex/three-frontend-experiment
**Autor:** Guilherme Resende (via brainstorming colaborativo)

## Objetivo

Definir a próxima leva de features do portfólio pessoal, com foco em duas
dimensões complementares:

- **Wow-factor visual** — interações e visuais que façam o site parecer
  produzido por estúdio premiado, reforçando a tese de "portfólio como
  produto, não currículo".
- **Playground técnico** — pretexto pra experimentar tecnologias novas
  (WebGPU, edge AI, RAG no browser) que viram material de blog/conversa
  com recrutador.

Os dois reforçam-se: o playground gera a matéria-prima visual; o wow dá
audiência pra tese técnica.

## Restrições

- **Stack atual fica:** React 18 + Vite + TypeScript + Tailwind +
  Netlify Functions + Gemini API. Sem migração de framework.
- **Free tier de Netlify e Gemini** continua como teto de custo.
- **Bundle size** é métrica de saúde — qualquer adição pesada exige
  lazy-load ou justificativa de wow.
- **A11y e perf** não regridem: Lighthouse ≥ 95 em todas as categorias.

## Princípios

- **Cada feature é independente** — pode ser construída e mergeada sem
  bloquear as outras. Dependências explícitas marcadas abaixo.
- **Effort tags são estimativas** pra Guilherme solo, contando que código
  é escrito em janelas curtas (noite/fim de semana).
- **YAGNI** — features descritas com escopo mínimo viável. Polimento e
  expansão ficam pra issues separadas depois de cada merge.

## Roadmap

Itens organizados por esforço crescente. A coluna "Tema" usa:
**A** = wow-factor, **D** = playground técnico, **A+D** = ambos.

> Numeração não-sequencial (sem item 4) preserva os IDs usados durante
> o brainstorming. O item 4 original (Konami easter egg) foi descartado
> e seu ID não foi reutilizado para evitar confusão em conversas futuras.

### Quick wins — 1-3 dias

#### 1. Magnetic cursor + cursor trail neon — Tema: A

Cursor custom que se atrai pra elementos interativos (botões, links,
cards) e deixa rastro neon combinando com a paleta do hero.

- **Stack:** `pointermove` + canvas 2D ou DOM puro. Zero biblioteca.
- **Por que importa:** primeira impressão do site. Já comunica
  "estúdio premiado" antes do scroll.
- **Risco:** UX em touch — desabilitar quando `pointer: coarse`.
- **Critério de pronto:** funciona em desktop, ignorado em mobile,
  respeita `prefers-reduced-motion`.

#### 2. Scroll-driven hue shift no hero 3D — Tema: A+D

As partículas do `HeroScene3D` mudam de matiz conforme o scroll progride.
Reforça sensação de que a cena reage ao usuário.

- **Stack:** uniform já existente no shader + listener de `scrollY`
  normalizado.
- **Por que importa:** wow barato — segundos de implementação, efeito
  perceptível.
- **Dependência:** nenhuma.
- **Critério de pronto:** transição suave entre 3+ matizes, sem
  flickering em scroll rápido.

#### 3. View Transitions API entre seções — Tema: A+D

Transições nativas (crossfade/slide) ao clicar nos links da navbar,
usando a View Transitions API.

- **Stack:** `document.startViewTransition` + CSS de transição. Polyfill
  zero — degrada pra scroll normal em browsers sem suporte.
- **Por que importa:** API ainda nova em 2026, mostra que o autor
  acompanha plataforma. Ganho visual sem peso.
- **Critério de pronto:** Chrome/Edge animado, Firefox/Safari sem
  regressão.

#### 5. OG image dinâmica — Tema: D

Endpoint `/share?section=projects` retorna PNG gerado com o título da
seção sobre o visual do hero. Cada link compartilhado vira preview único.

- **Stack:** Netlify Edge Function + `@vercel/og` (ou `satori`) puro
  ESM. Roda em Deno runtime.
- **Por que importa:** marketing orgânico — links no LinkedIn ficam
  visualmente distintos.
- **Dependência:** nenhuma.
- **Critério de pronto:** preview do LinkedIn, Twitter e WhatsApp
  renderizando a imagem correta pra 3 seções diferentes.

### Médios — ~1 semana cada

#### 6. Cena 3D contextual à seção — Tema: A+D

Conforme o usuário rola entre seções, as partículas do hero (ou uma
versão fixa em background) reagrupam-se em formas relacionadas ao
conteúdo: wireframe de cadeira em "Patente", constelação de tags em
"Skills", ondas de áudio em "Voz com IA".

- **Stack:** morph entre buffer geometries via GSAP ou easing manual no
  `useFrame`. `IntersectionObserver` dispara mudanças de target.
- **Por que importa:** integra o hero com o resto do site — hoje a cena
  3D é um cartão de visita isolado.
- **Dependência:** ideal depois do item 2 (já mexeu nos uniforms).
- **Critério de pronto:** 4 formas reconhecíveis, transição suave (<1s),
  cena pausa quando fora do viewport.

#### 7. GPGPU particles com física no mouse — Tema: D

Migrar a `Points` cloud atual pra simulação em compute (TSL no
three.js webgpu, ou transform feedback em WebGL2) com atração/repulsão
pelo cursor.

- **Stack:** three.js TSL ou GPUComputationRenderer. Fallback CPU pra
  hardware sem suporte.
- **Por que importa:** prova de força técnica — sai do "tutorial padrão"
  e mostra domínio de pipeline gráfico.
- **Dependência:** ideal depois ou junto do item 11 (WebGPU), pra não
  reescrever duas vezes.
- **Critério de pronto:** 60fps em desktop médio com 50k+ partículas,
  fallback transparente em GPU velha.

#### 8. Live mode: tour guiado automático — Tema: A+D

Botão "Quer um tour de 60s?" no hero. Ao aceitar, o agente Gemini Live
narra cada seção em áudio enquanto o site faz scroll programático.

- **Stack:** reusa `gemini-live.ts`. Adiciona controlador que casa
  timestamps do áudio com `scrollIntoView`.
- **Por que importa:** transforma visitante passivo em audiência.
  Bate exatamente na tese "portfólio como produto de IA".
- **Risco:** UX de interrupção (visitante rola sozinho durante o tour).
- **Critério de pronto:** tour completo de 60-90s, possível pausar e
  retomar, encerra ao chegar no contato.

#### 9. Job-match com vaga — Tema: A+D

Visitante cola a descrição da vaga; agente devolve análise visual:
radar chart de skills × requisitos, gaps destacados, CV em PDF
otimizado pra essa vaga.

- **Stack:** prompt estruturado (já tem framework de fichinha JSON +
  botões), nova ação que renderiza um `<RadarChart>` no chat. CV
  reusa `generateCV.ts` com seção destacada.
- **Por que importa:** diferenciação direta pra recrutador — não
  existe portfólio que faça isso hoje.
- **Risco:** custo de tokens — limitar tamanho da JD colada (~3k tokens).
- **Critério de pronto:** match score 0-100, lista de 3 gaps, CV
  customizado em <10s.

#### 10. Lighthouse 100 badge ao vivo — Tema: A

Badge animado no footer que faz fetch da última run real via
PageSpeed Insights API e mostra os 4 scores.

- **Stack:** Netlify Function que faz cache (1h) da resposta da API.
  Componente React simples no footer.
- **Por que importa:** prova social barata. Perf vira selo verificável.
- **Critério de pronto:** scores atualizam diariamente, mostra
  fallback elegante se API falhar.

### Ambiciosos — 1 mês+ (cada um é case study)

#### 11. Portfolio-as-WebGPU-shader — Tema: A+D

Reescrever o hero usando WebGPU (compute shader pra física de fluido
nas partículas) com fallback automático pra WebGL2.

- **Stack:** three.js WebGPURenderer + TSL. Detecção de suporte e
  fallback transparente.
- **Por que importa:** WebGPU é a história gráfica de 2026 — vira post
  de blog + conversa técnica em entrevista.
- **Dependência:** absorve o item 7.
- **Critério de pronto:** funciona em Chrome/Edge desktop com WebGPU
  ativo, fallback idêntico em capacidade visual no resto, sem regressão
  de Lighthouse.

#### 12. RAG local sobre os papers — Tema: D

Embeddings dos PDFs publicados (Aula 360°, patente, etc.) rodando
in-browser com transformers.js + IndexedDB. O agente Gemini passa de
"decorado via system prompt" pra "cita trecho exato com referência".

- **Stack:** transformers.js com modelo de embedding pequeno
  (all-MiniLM ou similar), IndexedDB pra vetores, busca cosine no
  cliente. Indexação acontece no build (script Node) ou no primeiro
  load com worker.
- **Por que importa:** RAG sem servidor extra — bom case técnico e
  reduz alucinação do agente.
- **Risco:** primeiro load pesado (~30MB do modelo). Mitigar com cache
  agressivo e indicador de progresso.
- **Critério de pronto:** agente cita pelo menos 3 trechos com
  referência ao paper de origem, latência de busca <500ms após primeira
  carga.

#### 13. Voz com lip-sync de avatar 3D — Tema: A+D

Substituir (ou complementar) a foto do hero por avatar 3D estilizado
que sincroniza boca com o áudio do Gemini Live durante chamadas de voz.

- **Stack:** Ready Player Me ou avatar low-poly custom em Blender +
  three.js. Lip-sync via análise de amplitude/formantes do PCM que já
  passa pelo `gemini-live.ts`.
- **Por que importa:** maior threshold de "uau" do roadmap. Fala por
  si só em entrevista.
- **Risco:** se mal feito, cai no uncanny valley. Começar estilizado.
- **Critério de pronto:** voz sincronizada com pelo menos 5 visemas,
  fallback pra foto se WebGL falhar, peso adicional ≤ 2MB.

#### 14. Multiplayer cursors no hero — Tema: A+D

Visitantes simultâneos veem os cursores uns dos outros (com bandeira
do país via geo) em tempo real sobre o hero.

- **Stack:** WebSocket via Netlify Edge Function ou Liveblocks/
  PartyKit (free tier).
- **Por que importa:** sensação de "site vivo". Vira surpresa para
  visitantes que voltam.
- **Risco:** privacidade — não coletar nada além de cursor + país.
- **Critério de pronto:** suporta até 50 cursores simultâneos, degrada
  pra solo se conexão WS falha, opt-out em 1 click.

## Critérios de qualidade transversais

Toda feature antes de merge precisa:

- Lighthouse ≥ 95 em Performance, Accessibility, Best Practices, SEO.
- `prefers-reduced-motion` respeitado em qualquer animação.
- Funciona em mobile (ou degrada de forma intencional e documentada).
- Não regride i18n PT/EN/ES.
- Bundle delta documentado no PR.

## Próximos passos

1. Guilherme escolhe o primeiro item a executar.
2. Item escolhido vira spec próprio + plano de implementação via
   skill `writing-plans`.
3. Cada feature mergeada atualiza este documento marcando o item como
   ✅ done com link pro PR.
