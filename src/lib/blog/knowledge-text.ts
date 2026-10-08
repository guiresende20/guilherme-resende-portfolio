// Images stay in the published article; only textual evidence is indexed.
export function blogKnowledgeText(text: string): string {
  return text
    .replace(/^\s*\[[^\]\n]+\]:\s*<?data:image\/[^\n]*$/gim, "")
    .replace(/!\[([^\]\n]*)\]\([^\n)]*\)/g, "$1")
    .replace(/!\[([^\]\n]*)\]\[[^\]\n]*\]/g, "$1")
    .replace(/<img\b[^>]*>/gi, "")
    // Also clean partial image definitions carried by overlap in old chunks.
    .replace(/data:image\/[^\s<>"')]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
