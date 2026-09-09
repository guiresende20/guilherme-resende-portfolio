// netlify/functions/deck-registry.mjs
import { getStore } from "@netlify/blobs";
import {
  handleListRegistry, handleAddDeck, handleUpdateDeck, handleRemoveDeck
} from "./_lib/deck-registry-handlers.mjs";
import { isValidEditKey, hmacHex } from "./_lib/edit-key.mjs";

function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }
function contentStore() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }

export default async (req, context) => {
  const slug = context.params && context.params.slug;

  if (req.method === "GET") {
    const { status, body } = await handleListRegistry(registryStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
    return Response.json({ error: "chave incorreta" }, { status: 401 });
  }

  if (req.method === "POST") {
    const senhaHash = body.senha ? hmacHex(body.senha, process.env.PALESTRA_EDIT_KEY) : null;
    const { status, body: out } = await handleAddDeck({ ...body, senhaHash }, registryStore(), contentStore());
    return Response.json(out, { status });
  }

  if (req.method === "PATCH") {
    if (!slug) return Response.json({ error: "slug ausente" }, { status: 400 });
    const patch = { ...body };
    if (typeof body.senha === "string") {
      patch.senhaHash = body.senha ? hmacHex(body.senha, process.env.PALESTRA_EDIT_KEY) : null;
    }
    const { status, body: out } = await handleUpdateDeck(slug, patch, registryStore());
    return Response.json(out, { status });
  }

  if (req.method === "DELETE") {
    if (!slug) return Response.json({ error: "slug ausente" }, { status: 400 });
    const { status, body: out } = await handleRemoveDeck(slug, registryStore(), contentStore(), backupStore());
    return Response.json(out, { status });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: ["/api/deck-registry", "/api/deck-registry/:slug"] };
