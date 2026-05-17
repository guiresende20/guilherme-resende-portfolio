import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPost, type PostResponse } from "../lib/blog/api";
import MarkdownRenderer from "../components/blog/MarkdownRenderer";
import { formatDate, formatReadingTime, useLocale } from "../lib/blog/format";
import BlogLayout from "../components/blog/BlogLayout";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const lang = useLocale();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPost(null);
    setNotFound(false);
    setError(null);
    fetchPost(slug)
      .then((p) => {
        if (!p) setNotFound(true);
        else setPost(p);
      })
      .catch((e) => setError(String(e)));
  }, [slug]);

  if (error) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-16 text-foreground">
          <p className="text-red-400">Erro: {error}</p>
          <Link to="/blog" className="text-neon underline mt-4 inline-block">
            ← Voltar para o blog
          </Link>
        </div>
      </BlogLayout>
    );
  }

  if (notFound) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-24 text-foreground text-center">
          <h1 className="font-display text-4xl mb-4">Post não encontrado</h1>
          <p className="text-muted-foreground mb-8">
            O post "{slug}" não existe ou foi removido.
          </p>
          <Link to="/blog" className="text-neon underline">
            ← Voltar para o blog
          </Link>
        </div>
      </BlogLayout>
    );
  }

  if (!post) {
    return (
      <BlogLayout>
        <div className="container mx-auto px-6 py-16 text-muted-foreground">
          Carregando…
        </div>
      </BlogLayout>
    );
  }

  return (
    <BlogLayout>
    <div className="container mx-auto px-6 py-16 max-w-3xl">
      <Link
        to="/blog"
        className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon transition-colors"
      >
        ← blog
      </Link>

      <header className="mt-8 mb-12">
        <h1 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
          {post.meta.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{formatDate(post.meta.date, lang)}</span>
          <span>·</span>
          <span>{formatReadingTime(post.meta.readingTimeMin, lang)}</span>
          <span>·</span>
          <span>{post.meta.lang}</span>
          {post.meta.tags.length > 0 && (
            <>
              <span>·</span>
              {post.meta.tags.map((t) => (
                <Link
                  key={t}
                  to={`/blog/tag/${encodeURIComponent(t)}`}
                  className="hover:text-neon"
                >
                  #{t}
                </Link>
              ))}
            </>
          )}
        </div>
      </header>

      <MarkdownRenderer body={post.body} />
    </div>
    </BlogLayout>
  );
}
