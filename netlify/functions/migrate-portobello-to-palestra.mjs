// Function TEMPORÁRIA de migração one-shot: copia o conteúdo do deck /portobello
// (stores antigos, únicos p/ esse cliente) para o novo sistema multi-cliente
// (stores compartilhados, chaves "portobello:*"). Roda dentro do runtime da
// própria Netlify Function, então usa getStore({name}) sem credenciais
// explícitas (mesmo padrão de todas as outras functions do site).
//
// Uso (uma única vez, depois do deploy):
//   curl -X POST https://guiresende20.netlify.app/api/migrate-portobello-to-palestra \
//     -H "content-type: application/json" -d '{"key":"<PALESTRA_EDIT_KEY>"}'
//
// Remover este arquivo depois de confirmar que a migração funcionou (Task 14).
import { getStore } from "@netlify/blobs";
import { isValidEditKey } from "./_lib/edit-key.mjs";

const SLUG = "portobello";

// última versão conhecida do slides.json base, capturada do git antes da Task 9
// remover o arquivo estático (público em public/palestra/_deck/slides.json até
// o commit c6100ad).
const BASE = {
  "meta": {
    "title": "Portobello/Eletromec",
    "deck": "portobello"
  },
  "slides": [
    {
      "id": "capa-palestra",
      "layout": "shader",
      "kicker": "Palestra · Portobello + Eletromec",
      "title": "Da Prancheta ao Prompt",
      "subtitle": "Como a IA está redesenhando o trabalho dos escritórios de arquitetura.",
      "quote": "Você não precisa aprender a programar. Precisa aprender a perguntar.",
      "byline": "Guilherme Resende Muniz",
      "accent": "green"
    },
    {
      "id": "intro",
      "type": "intro",
      "title": "Portobello/Eletromec",
      "lead": "Deck em construção. Navegue pelas miniaturas ou gere o report completo em PDF.",
      "accent": "violet"
    },
    {
      "id": "sobre-guilherme",
      "title": "Guilherme Resende Muniz",
      "subtitle": "Designer de Inovação · Pesquisador · Doutorando em Design (UFRGS)",
      "portrait": "/palestra/_deck/assets/guilherme.webp",
      "image": "/palestra/_deck/assets/guilherme.webp",
      "accent": "green",
      "body": [
        "### Formação Acadêmica",
        "**Doutorado em Design** — UFRGS · em andamento\n**Mestrado em Design e Tecnologia** — UFRGS · 2013–2015\n**Bacharelado em Comunicação Social / Publicidade** — UFRGS · 2004–2010",
        "### Experiência Profissional",
        "**Head de Pesquisa** — Aerolito · atual\n**Designer e Pesquisador de Inovação** — CriaLab / Tecnopuc · 2021–presente\n**Pesquisador** — UFRGS / LdSM · 2017–presente\n**Professor** — ESPM Porto Alegre · 2018–2022"
      ],
      "items": ["UX/UI", "VR/AR", "IA aplicada", "Design de Inovação"],
      "links": [
        { "label": "Repositório 3D — UFRGS", "url": "https://www.ufrgs.br/ldsm/3d/" }
      ]
    },
    {
      "id": "frase-ia-exemplo",
      "layout": "frase-ia",
      "title": "Inovação real acontece quando design, pesquisa e tecnologia trabalham juntos.",
      "accent": "green"
    },
    {
      "id": "pontos-diferenciais",
      "layout": "pontos",
      "title": "Título do slide",
      "accent": "green",
      "points": [
        { "icon": "eye",     "text": "Repertório e visão crítica" },
        { "icon": "bulb",    "text": "Conceitos autorais" },
        { "icon": "user",    "text": "Entendimento profundo do usuário" },
        { "icon": "code",    "text": "Domínio técnico e execução" },
        { "icon": "funnel",  "text": "Curadoria dos resultados da IA" },
        { "icon": "palette", "text": "Linguagem estética própria" },
        { "icon": "nodes",   "text": "Integração entre design, negócio e tecnologia" },
        { "icon": "target",  "text": "Foco em impacto real nas pessoas" }
      ]
    },
    {
      "id": "fecho-palestra",
      "layout": "shader",
      "role": "closing",
      "kicker": "Obrigado",
      "quote": "A IA desenha rápido. Só você sabe o que vale a pena desenhar.",
      "byline": "Guilherme Resende Muniz · Da Prancheta ao Prompt",
      "accent": "green"
    }
  ]
};

function contentStore() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }
function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }
function oldContentStore() { return getStore({ name: "portobello-deck-content", consistency: "strong" }); }
function oldBackupStore() { return getStore({ name: "portobello-deck-backups", consistency: "strong" }); }

export default async (req) => {
  if (req.method !== "POST") return Response.json({ error: "método não permitido" }, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
    return Response.json({ error: "chave incorreta" }, { status: 401 });
  }

  const oldContent = oldContentStore();
  const oldBackups = oldBackupStore();
  const newContent = contentStore();
  const newBackups = backupStore();
  const registry = registryStore();

  // reescreve URLs de imagem enviadas via editor (antigas, absolutas) para o
  // novo endpoint namespaced por slug — a mesma imagem é copiada abaixo com a
  // chave nova, então a URL referenciada dentro dos overrides/added precisa
  // apontar pro lugar certo, senão a foto quebra silenciosamente no deck migrado.
  function rewriteImageUrls(value) {
    const str = JSON.stringify(value)
      .split("/api/portobello-content/image?key=images%2F")
      .join(`/api/deck-content/${SLUG}/image?key=${SLUG}%3Aimages%2F`);
    return JSON.parse(str);
  }

  const rawOverrides = (await oldContent.get("overrides", { type: "json" })) || {};
  const rawAdded = (await oldContent.get("added", { type: "json" })) || [];
  const overrides = rewriteImageUrls(rawOverrides);
  const added = rewriteImageUrls(rawAdded);
  const hidden = (await oldContent.get("hidden", { type: "json" })) || [];
  const order = (await oldContent.get("order", { type: "json" })) || [];

  await newContent.setJSON(`${SLUG}:base`, BASE);
  await newContent.setJSON(`${SLUG}:overrides`, overrides);
  await newContent.setJSON(`${SLUG}:added`, added);
  await newContent.setJSON(`${SLUG}:hidden`, hidden);
  await newContent.setJSON(`${SLUG}:order`, order);

  let imagesMigrated = 0;
  const { blobs } = await oldContent.list({ prefix: "images/" });
  for (const b of blobs) {
    const res = await oldContent.getWithMetadata(b.key, { type: "arrayBuffer" });
    if (!res || !res.data) continue;
    const newKey = `${SLUG}:${b.key}`;
    await newContent.set(newKey, Buffer.from(res.data), { metadata: res.metadata });
    imagesMigrated++;
  }

  const oldIndex = (await oldBackups.get("index", { type: "json" })) || [];
  await newBackups.setJSON(`${SLUG}:index`, oldIndex);
  for (const entry of oldIndex) {
    const snap = await oldBackups.get(`snap/${entry.id}`, { type: "json" });
    if (snap) await newBackups.setJSON(`${SLUG}:snap/${entry.id}`, snap);
  }

  const currentRegistry = (await registry.get("registry", { type: "json" })) || [];
  if (!currentRegistry.some((d) => d.slug === SLUG)) {
    currentRegistry.push({
      slug: SLUG,
      titulo: "Da Prancheta ao Prompt",
      cliente: "Portobello",
      data: "2026-07-17",
      thumbnail: "",
      status: "publicado",
      senhaHash: null
    });
    await registry.setJSON("registry", currentRegistry);
  }

  return Response.json({
    ok: true,
    overrides: Object.keys(overrides).length,
    added: added.length,
    hidden: hidden.length,
    order: order.length,
    imagesMigrated,
    backups: oldIndex.length
  });
};

export const config = { path: "/api/migrate-portobello-to-palestra" };
