import type { PostMeta } from "../../../src/lib/blog/frontmatter";

export interface TranslatableItem {
  slug: string;
  title: string;
  excerpt?: string;
}

export interface TranslatedTitle {
  title: string;
  excerpt?: string;
}

export function mergeTranslatedTitles(
  metas: PostMeta[],
  translations: Map<string, TranslatedTitle>
): PostMeta[] {
  return metas.map((meta) => {
    const translated = translations.get(meta.slug);
    if (!translated) return meta;
    return {
      ...meta,
      title: translated.title,
      excerpt: translated.excerpt ?? meta.excerpt,
    };
  });
}
