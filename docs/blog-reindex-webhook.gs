/**
 * Blog auto-reindex — Google Apps Script
 *
 * Poll da pasta `blog/` no Drive a cada N minutos. Se detectar arquivo
 * novo/editado/removido, chama POST /api/blog/reindex no site pra
 * regenerar o índice RAG do chatbot automaticamente — sem precisar
 * lembrar de rodar o curl manual depois de publicar um post.
 *
 * Setup: ver docs/blog-setup.md, seção "Automação do reindex (Apps Script)".
 */

function checkAndReindexBlog() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("BLOG_FOLDER_ID");
  const token = props.getProperty("BLOG_REVALIDATE_TOKEN");
  const siteUrl = props.getProperty("SITE_URL") || "https://guiresende20.netlify.app";

  if (!folderId || !token) {
    throw new Error(
      "Script Properties faltando: configure BLOG_FOLDER_ID e BLOG_REVALIDATE_TOKEN " +
        "(Project Settings > Script Properties)."
    );
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles(); // apenas children diretos — não desce em drafts/ ou images/

  const snapshot = {};
  while (files.hasNext()) {
    const f = files.next();
    snapshot[f.getId()] = f.getLastUpdated().toISOString() + "|" + f.getName();
  }
  const snapshotStr = JSON.stringify(snapshot, Object.keys(snapshot).sort());

  const lastSnapshotStr = props.getProperty("LAST_SNAPSHOT") || "";
  if (snapshotStr === lastSnapshotStr) {
    return; // nada mudou, não gasta chamada de reindex/embedding à toa
  }

  const res = UrlFetchApp.fetch(siteUrl + "/api/blog/reindex", {
    method: "post",
    headers: { "X-Revalidate-Token": token },
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code === 200) {
    props.setProperty("LAST_SNAPSHOT", snapshotStr);
    Logger.log("Reindex OK: " + res.getContentText());
  } else {
    Logger.log("Reindex FALHOU (" + code + "): " + res.getContentText());
    notifyFailure(code, res.getContentText());
    // não salva o snapshot — tenta de novo na próxima execução
  }
}

function notifyFailure(code, body) {
  try {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      "[blog] Reindex automático falhou",
      "Status " + code + "\n\n" + body
    );
  } catch (e) {
    Logger.log("Falha ao enviar email de alerta: " + e);
  }
}

/**
 * Rodar esta função UMA VEZ manualmente (Run > installTrigger) para criar
 * o trigger de tempo. Depois disso o checkAndReindexBlog roda sozinho.
 */
function installTrigger() {
  // remove triggers antigos do mesmo handler pra evitar duplicar
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "checkAndReindexBlog") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("checkAndReindexBlog")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("Trigger instalado: checkAndReindexBlog a cada 15min.");
}
