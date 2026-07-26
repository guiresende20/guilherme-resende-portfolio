import { downloadText, exportDocAsMarkdown, getDocInlineImagesInOrder, type DriveFile } from "./drive";
import { parsePost, parseDocPost, type ParsedPost } from "../../../src/lib/blog/frontmatter";
import { upgradeDocImages } from "./doc-image-upgrade";

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
    let upgraded = raw;
    try {
      const images = await getDocInlineImagesInOrder(f.id);
      upgraded = upgradeDocImages(raw, images);
    } catch (err) {
      // best-effort: mantém as imagens em baixa resolução do export markdown
      // em vez de quebrar o post inteiro.
      console.error("blog: falha ao buscar imagens em alta resolução do Doc", { name: f.name, id: f.id, err });
    }
    return parseDocPost(upgraded, f.name, f.createdTime);
  }
  const raw = await downloadText(f.id);
  return parsePost(raw, f.name);
}
