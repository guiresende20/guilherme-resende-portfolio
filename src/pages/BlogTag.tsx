import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";
import BlogLayout from "../components/blog/BlogLayout";

export default function BlogTag() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPostList().then(setPosts).catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!posts || !tag) return [];
    return posts.filter((p) => p.tags.includes(tag));
  }, [posts, tag]);

  return (
    <BlogLayout>
      <div className="container mx-auto px-6 py-16">
        <Link to="/blog" className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-neon">
          ← blog
        </Link>
        <header className="mt-8 mb-12">
          <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Tag</span>
          <h1 className="font-display text-5xl text-foreground mt-2">#{tag}</h1>
        </header>

        {error && <p className="text-red-400">Erro: {error}</p>}
        {!posts && !error && <p className="text-muted-foreground">Carregando…</p>}
        {posts && filtered.length === 0 && (
          <p className="text-muted-foreground">Nenhum post com essa tag.</p>
        )}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </div>
    </BlogLayout>
  );
}
