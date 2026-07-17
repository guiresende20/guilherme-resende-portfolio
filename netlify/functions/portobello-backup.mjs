import { getStore } from "@netlify/blobs";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "./_lib/portobello-backup-handlers.mjs";
import { isValidEditKey } from "./_lib/portobello-edit-key.mjs";

function contentStore() { return getStore({ name: "portobello-deck-content", consistency: "strong" }); }
function backupStore() { return getStore({ name: "portobello-deck-backups", consistency: "strong" }); }

export default async (req) => {
  // GET /api/portobello-backup — lista (só metadados; público)
  if (req.method === "GET") {
    const { status, body } = await handleListBackups(backupStore());
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }

  // POST — restore | export | manual (gated por PORTOBELLO_EDIT_KEY)
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!isValidEditKey(body && body.key, process.env.PORTOBELLO_EDIT_KEY)) {
      return Response.json({ error: "chave incorreta" }, { status: 401 });
    }
    if (body.action === "restore") {
      const { status, body: out } = await handleRestoreBackup(body, contentStore(), backupStore());
      return Response.json(out, { status });
    }
    if (body.action === "export") {
      const { status, body: out } = await handleExportBundle(contentStore());
      return Response.json(out, { status });
    }
    if (body.action === "manual") {
      const { status, body: out } = await handleCaptureSnapshot(contentStore(), backupStore(), "manual");
      return Response.json(out, { status });
    }
    return Response.json({ error: "ação desconhecida" }, { status: 400 });
  }

  return Response.json({ error: "método não permitido" }, { status: 405 });
};

export const config = { path: "/api/portobello-backup" };
