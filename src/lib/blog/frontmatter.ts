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
