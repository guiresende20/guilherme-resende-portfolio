// netlify/functions/deck-backup.mjs
import { getStore } from "@netlify/blobs";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "./_lib/deck-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/edit-key.mjs";

function contentStore() { return getStore({ name: "deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "deck-backups", consistency: "strong" }); }

export default async (req, context) => {
  const slug = context.params.slug;

  if (req.method === "GET") {
    const { status, body } = await handleListBackups(slug, backupStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PALESTRA_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "restore") {
      const { status, body: out } = await handleRestoreBackup(slug, body, contentStore(), backupStore());
      return Response.json(out, { status });
    }
    if (body.action === "export") {
      const { status, body: out } = await handleExportBundle(slug, contentStore());
      return Response.json(out, { status });
    }
    if (body.action === "manual") {
      const { status, body: out } = await handleCaptureSnapshot(slug, contentStore(), backupStore(), "manual");
      return Response.json(out, { status });
    }
    return Response.json({ error: "ação desconhecida" }, { status: 400 });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: "/api/deck-backup/:slug" };
