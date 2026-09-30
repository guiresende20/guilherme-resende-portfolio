import { downloadText, exportDocAsMarkdown, getDocInlineImagesInOrder, type DriveFile, type DocInlineImage } from "./drive";
import { parsePost, parseDocPost, type ParsedPost } from "../../../src/lib/blog/frontmatter";
import { upgradeDocImages } from "./doc-image-upgrade";
import { getCached, setCached } from "./blob-cache";

const DOC_MIMETYPE = "application/vnd.google-apps.document";
const MD_MIMETYPE = "text/markdown";

export function isBlogPostSource(f: DriveFile): boolean {
  if (f.mimeType === DOC_MIMETYPE) return true;
  if (f.mimeType === MD_MIMETYPE) return true;
  if (/\.md$/i.test(f.name)) return true;
  return false;
}

// blog-list/blog-post/blog-translate todos escaneiam os mesmos arquivos do
// Drive. Sem isso, visitantes concorrentes (ou tráfego cruzando com o
// scan) disparam exports simultâneos do MESMO arquivo — e o export do
// Drive fica ~10x mais lento (medido: 600ms -> 7-8s) quando o mesmo
// arquivo é exportado por requisições sobrepostas. A chave inclui
// modifiedTime, então se invalida sozinha quando o Doc é editado.
async function getRawContent(f: DriveFile): Promise<string> {
  const cacheKey = `raw/${f.id}/${f.modifiedTime}`;
  const cached = await getCached<string>(cacheKey);
  if (cached !== null) return cached;
  const raw =
    f.mimeType === DOC_MIMETYPE ? await exportDocAsMarkdown(f.id) : await downloadText(f.id);
  await setCached(cacheKey, raw, null);
  return raw;
}

async function getImages(f: DriveFile): Promise<DocInlineImage[]> {
  const cacheKey = `images/${f.id}/${f.modifiedTime}`;
  const cached = await getCached<DocInlineImage[]>(cacheKey);
  if (cached !== null) return cached;
  const images = await getDocInlineImagesInOrder(f.id);
  await setCached(cacheKey, images, null);
  return images;
}

export interface FetchAndParseOptions {
  // Busca e faz upgrade das imagens embutidas em Docs para alta resolução.
  // Custa uma chamada de rede sequencial por imagem — pular quando o
  // chamador só precisa do frontmatter/meta ou não renderiza imagens.
  withImages?: boolean;
}

export async function fetchAndParse(
  f: DriveFile,
  opts: FetchAndParseOptions = {}
): Promise<ParsedPost> {
  const withImages = opts.withImages ?? true;
  if (f.mimeType === DOC_MIMETYPE) {
    const raw = await getRawContent(f);
    let upgraded = raw;
    if (withImages) {
      try {
        const images = await getImages(f);
        upgraded = upgradeDocImages(raw, images);
      } catch (err) {
        // best-effort: mantém as imagens em baixa resolução do export markdown
        // em vez de quebrar o post inteiro.
        console.error("blog: falha ao buscar imagens em alta resolução do Doc", { name: f.name, id: f.id, err });
      }
    }
    return parseDocPost(upgraded, f.name, f.createdTime);
  }
  const raw = await getRawContent(f);
  return parsePost(raw, f.name);
}
