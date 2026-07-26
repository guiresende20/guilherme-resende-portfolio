import type { DocInlineImage } from "./drive";

const IMAGE_DEFINITION = /^(\[image\d+\]:\s*<?)(data:[^>\n]+)(>?)$/gm;

// Substitui, em ordem de aparição, as definições de referência de imagem
// (`[image1]: <data:...>`) do markdown exportado do Google Docs pelas
// versões em resolução real buscadas via Docs API. Se a contagem não bater
// (ex: falha ao buscar alguma imagem), mantém o markdown original intacto
// em vez de arriscar trocar a imagem errada.
export function upgradeDocImages(markdown: string, images: DocInlineImage[]): string {
  if (images.length === 0) return markdown;

  const matches = markdown.match(IMAGE_DEFINITION) || [];
  if (matches.length !== images.length) return markdown;

  let i = 0;
  return markdown.replace(IMAGE_DEFINITION, (_match, prefix, _url, suffix) => {
    const upgraded = images[i++].dataUri;
    return `${prefix}${upgraded}${suffix}`;
  });
}
