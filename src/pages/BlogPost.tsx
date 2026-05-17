import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPost, type PostResponse } from "../lib/blog/api";
import MarkdownRenderer from "../components/blog/MarkdownRenderer";
import { formatDate, formatReadingTime, useLocale } from "../lib/blog/format";
import BlogLayout from "../components/blog/BlogLayout";
import TranslateBanner from "../components/blog/TranslateBanner";
import DisqusEmbed from "../components/blog/DisqusEmbed";
import ShareButtons from "../components/blog/ShareButtons";
import PostTOC from "../components/blog/PostTOC";

function blogPostingJsonLd(meta: { slug: string; title: string; date: string; lang: string; excerpt?: string; cover?: string }) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    datePublished: `${meta.date}T00:00:00Z`,
    dateModified: `${meta.date}T00:00:00Z`,
    inLanguage: meta.lang,
    description: meta.excerpt,
    image: meta.cover
      ? `https://guiresende20.netlify.app/api/blog/image/${meta.cover}`
      : "https://guiresende20.netlify.app/guilherme-foto.webp",
    url: `https://guiresende20.netlify.app/blog/${meta.slug}`,
    author: {
      "@type": "Person",
      name: "Guilherme Resende Muniz",
      url: "https://guiresende20.netlify.app/",
    },
  }).replace(/<\//g, "<\\/");
}

function pickTranslationTarget(userLang: string, postLang: string): "en" | "es" | null {
  if (postLang !== "pt") return null;
  if (userLang.startsWith("en")) return "en";
  if (userLang.startsWith("es")) return "es";
  return null;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const userLang = useLocale();
  const [post, setPost] = useState<PostResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPost(null);
    setNotFound(false);
    setError(null);
    setTranslatedBody(null);
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
        <div className="container mx-auto px-6 py-24 text-foreground text-center max-w-xl">
          <h1 className="font-display text-4xl mb-4">Post não encontrado</h1>
          <p className="text-muted-foreground mb-8">
            O post "{slug}" não existe ou foi removido. Quer perguntar sobre o assunto?
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/blog" className="font-mono text-xs uppercase tracking-[0.1em] border border-border text-foreground px-4 py-2">
              ← Voltar para o blog
            </Link>
            <a href="/#chat" className="font-mono text-xs uppercase tracking-[0.1em] border border-neon text-neon px-4 py-2 hover:bg-neon/10">
              Falar com a IA
            </a>
          </div>
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

  const target = pickTranslationTarget(userLang, post.meta.lang);
  const bodyToRender = translatedBody ?? post.body;

  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto lg:max-w-none lg:flex lg:items-start lg:justify-center">
          <div className="max-w-3xl mx-auto lg:mx-0">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post.meta) }}
            />
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
                <span>{formatDate(post.meta.date, userLang)}</span>
                <span>·</span>
                <span>{formatReadingTime(post.meta.readingTimeMin, userLang)}</span>
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

            {target && (
              <TranslateBanner
                slug={post.meta.slug}
                targetLang={target}
                onTranslated={setTranslatedBody}
                onReset={() => setTranslatedBody(null)}
                showingTranslation={translatedBody !== null}
              />
            )}

            <MarkdownRenderer body={bodyToRender} />

            <ShareButtons
              url={`https://guiresende20.netlify.app/blog/${post.meta.slug}`}
              title={post.meta.title}
            />

            {import.meta.env.VITE_DISQUS_SHORTNAME && (
              <DisqusEmbed
                shortname={import.meta.env.VITE_DISQUS_SHORTNAME}
                identifier={`post-${post.meta.slug}`}
                title={post.meta.title}
                url={`https://guiresende20.netlify.app/blog/${post.meta.slug}`}
              />
            )}
          </div>
          <PostTOC body={bodyToRender} />
        </div>
      </div>
    </BlogLayout>
  );
}
