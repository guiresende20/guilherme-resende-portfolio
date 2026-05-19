import matter from "gray-matter";

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  lang: string;
  tags: string[];
  cover?: string;
  excerpt?: string;
  draft: boolean;
  featured: boolean;
  readingTimeMin: number;
}

export interface ParsedPost {
  meta: PostMeta;
  body: string;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacriticals
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/i, "");
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  return "1970-01-01";
}

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function parsePost(raw: string, filename: string): ParsedPost {
  const { data, content } = matter(raw);
  const meta: PostMeta = {
    slug: typeof data.slug === "string" ? data.slug : slugFromFilename(filename),
    title: data.title ?? "(sem título)",
    date: normalizeDate(data.date),
    lang: data.lang ?? "pt",
    tags: Array.isArray(data.tags) ? data.tags : [],
    cover: data.cover,
    excerpt: data.excerpt,
    draft: data.draft === true,
    featured: data.featured === true,
    readingTimeMin: readingTime(content),
  };
  return { meta, body: content };
}

const TAGS_LINE_RE = /^Tags?\s*:\s*(.*)$/i;
const EXCERPT_MAX = 200;

function extractTagsAndStripLine(body: string): { tags: string[]; body: string } {
  const lines = body.split(/\r?\n/);
  // Find the first non-empty line
  let firstNonEmptyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      firstNonEmptyIdx = i;
      break;
    }
  }
  if (firstNonEmptyIdx === -1) return { tags: [], body };

  const match = TAGS_LINE_RE.exec(lines[firstNonEmptyIdx]);
  if (!match) return { tags: [], body };

  const rawTags = match[1] ?? "";
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Remove the matched line, plus any single blank line immediately following.
  const next = lines.slice(firstNonEmptyIdx + 1);
  if (next.length > 0 && next[0].trim() === "") next.shift();
  const newBody = [...lines.slice(0, firstNonEmptyIdx), ...next].join("\n").replace(/^\n+/, "");
  return { tags, body: newBody };
}

function makeExcerpt(body: string, max = EXCERPT_MAX): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  const firstPara = trimmed.split(/\n\s*\n/)[0].trim();
  if (firstPara.length <= max) return firstPara;
  const truncated = firstPara.slice(0, max).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const sliced = lastSpace > 0 ? truncated.slice(0, lastSpace).trimEnd() : truncated;
  return sliced + "…";
}

export function parseDocPost(
  raw: string,
  driveName: string,
  createdTime: string,
): ParsedPost {
  const slug = slugify(driveName);
  if (slug.length === 0) {
    throw new Error(`parseDocPost: invalid slug derived from name "${driveName}"`);
  }

  const { tags, body } = extractTagsAndStripLine(raw);
  const excerpt = makeExcerpt(body);
  const date = createdTime.slice(0, 10);

  const meta: PostMeta = {
    slug,
    title: driveName,
    date,
    lang: "pt",
    tags,
    cover: undefined,
    excerpt,
    draft: false,
    featured: false,
    readingTimeMin: readingTime(body),
  };
  return { meta, body };
}
