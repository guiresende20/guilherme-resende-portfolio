import { downloadText, exportDocAsMarkdown, type DriveFile } from "./drive";
import { parsePost, parseDocPost, type ParsedPost } from "../../../src/lib/blog/frontmatter";

const DOC_MIMETYPE = "application/vnd.google-apps.document";
const MD_MIMETYPE = "text/markdown";

export function isBlogPostSource(f: DriveFile): boolean {
  if (f.mimeType === DOC_MIMETYPE) return true;
  if (f.mimeType === MD_MIMETYPE) return true;
  if (/\.md$/i.test(f.name)) return true;
  return false;
}

export async function fetchAndParse(f: DriveFile): Promise<ParsedPost> {
  if (f.mimeType === DOC_MIMETYPE) {
    const raw = await exportDocAsMarkdown(f.id);
    return parseDocPost(raw, f.name, f.createdTime);
  }
  const raw = await downloadText(f.id);
  return parsePost(raw, f.name);
}
