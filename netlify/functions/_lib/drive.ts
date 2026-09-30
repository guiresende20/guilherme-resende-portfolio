import { google, docs_v1 } from "googleapis";

let cachedDrive: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (cachedDrive) return cachedDrive;

  const raw = process.env.GOOGLE_DRIVE_SA_JSON;
  if (!raw) throw new Error("GOOGLE_DRIVE_SA_JSON missing");

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

let cachedDocs: ReturnType<typeof google.docs> | null = null;

function getDocs() {
  if (cachedDocs) return cachedDocs;

  const raw = process.env.GOOGLE_DRIVE_SA_JSON;
  if (!raw) throw new Error("GOOGLE_DRIVE_SA_JSON missing");

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });

  cachedDocs = google.docs({ version: "v1", auth });
  return cachedDocs;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, createdTime)",
    pageSize: 1000,
  });
  return (res.data.files ?? []) as DriveFile[];
}

export async function downloadText(fileId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return res.data as string;
}

export async function exportDocAsMarkdown(fileId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.export(
    { fileId, mimeType: "text/markdown" },
    { responseType: "text" }
  );
  return res.data as string;
}

export async function downloadBinary(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export interface DocInlineImage {
  dataUri: string;
}

// O export markdown do Drive (exportDocAsMarkdown) downscala bastante as
// imagens embutidas no Doc. Esta função busca as imagens na resolução real
// via Docs API, na mesma ordem em que aparecem no corpo do documento — ordem
// que corresponde à numeração image1, image2, ... usada pelo export markdown.
// contentUri é uma URL assinada de curta duração, por isso baixamos na hora.
export async function getDocInlineImagesInOrder(fileId: string): Promise<DocInlineImage[]> {
  const docs = getDocs();
  const res = await docs.documents.get({ documentId: fileId });
  const inlineObjects = res.data.inlineObjects || {};

  const orderedIds: string[] = [];
  function walk(elements: docs_v1.Schema$StructuralElement[] | undefined) {
    if (!elements) return;
    for (const el of elements) {
      if (el.paragraph?.elements) {
        for (const pe of el.paragraph.elements) {
          if (pe.inlineObjectElement?.inlineObjectId) {
            orderedIds.push(pe.inlineObjectElement.inlineObjectId);
          }
        }
      }
      if (el.table?.tableRows) {
        for (const row of el.table.tableRows) {
          for (const cell of row.tableCells || []) walk(cell.content);
        }
      }
    }
  }
  walk(res.data.body?.content);

  const images: DocInlineImage[] = [];
  for (const id of orderedIds) {
    const uri = inlineObjects[id]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
    if (!uri) continue;
    const r = await fetch(uri);
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get("content-type") || "image/png";
    images.push({ dataUri: `data:${contentType};base64,${buf.toString("base64")}` });
  }
  return images;
}

export async function findChildFolder(
  parentId: string,
  childName: string
): Promise<string | null> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${childName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}
