// Match standard markdown image syntax outside fenced code blocks.
// Strategy: split on fence boundaries, only transform odd-indexed (outside) chunks.
const FENCE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const IMG = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isAbsolute(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//") ||
    url.startsWith("data:") ||
    url.startsWith("/")
  );
}

export function rewriteImagePaths(markdown: string): string {
  const parts = markdown.split(FENCE);
  return parts
    .map((chunk, i) => {
      // Odd indices are the fenced code blocks themselves (kept untouched).
      if (i % 2 === 1) return chunk;
      return chunk.replace(IMG, (match, alt, url) => {
        if (isAbsolute(url)) return match;
        return `![${alt}](/api/blog/image/${url})`;
      });
    })
    .join("");
}
