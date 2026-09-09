// netlify/functions/deck-auth.mjs
import { getStore } from "@netlify/blobs";
import { handleGetEntry } from "./_lib/deck-registry-handlers.mjs";
import { issueToken, checkPassword } from "./_lib/deck-auth-handlers.mjs";

function registryStore() { return getStore({ name: "palestra-registry", consistency: "strong" }); }

export default async (req, context) => {
  if (req.method !== "POST") return Response.json({ error: "método não permitido" }, { status: 405 });
  const slug = context.params.slug;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }

  const entry = await handleGetEntry(slug, registryStore());
  if (!entry) return Response.json({ error: "palestra não encontrada" }, { status: 404 });
  if (!entry.senhaHash) return Response.json({ ok: true, token: null });

  const secret = process.env.PALESTRA_EDIT_KEY;
  if (!checkPassword(body && body.senha, entry.senhaHash, secret)) {
    return Response.json({ error: "senha incorreta" }, { status: 401 });
  }
  return Response.json({ ok: true, token: issueToken(slug, secret) });
};

export const config = { path: "/api/deck-auth/:slug" };
