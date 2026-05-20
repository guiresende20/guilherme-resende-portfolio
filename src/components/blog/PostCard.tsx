import TransitionLink from "../TransitionLink";
import type { PostMeta } from "../../lib/blog/frontmatter";
import { formatDate, formatReadingTime, useLocale } from "../../lib/blog/format";

interface PostCardProps {
  post: PostMeta;
}

export default function PostCard({ post }: PostCardProps) {
  const lang = useLocale();
  return (
    <TransitionLink
      to={`/blog/${post.slug}`}
      className="group block border border-border bg-card hover:border-neon/40 transition-colors overflow-hidden"
    >
      {post.cover && (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={`/api/blog/image/${post.cover}`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{formatDate(post.date, lang)}</span>
          <span>·</span>
          <span>{formatReadingTime(post.readingTimeMin, lang)}</span>
          {post.featured && <span className="text-neon">· destacado</span>}
        </div>
        <h3 className="font-display text-xl text-foreground group-hover:text-neon transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
        )}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {post.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="font-mono text-[9px] uppercase tracking-[0.08em] border border-border px-1.5 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </TransitionLink>
  );
}
