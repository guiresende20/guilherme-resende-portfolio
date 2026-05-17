import { google } from "googleapis";

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

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime)",
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

export async function downloadBinary(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
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
