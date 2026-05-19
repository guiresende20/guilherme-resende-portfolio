import type { DriveFile } from "./drive";

const DOC_MIMETYPE = "application/vnd.google-apps.document";
const MD_MIMETYPE = "text/markdown";

export function isBlogPostSource(f: DriveFile): boolean {
  if (f.mimeType === DOC_MIMETYPE) return true;
  if (f.mimeType === MD_MIMETYPE) return true;
  if (/\.md$/i.test(f.name)) return true;
  return false;
}
