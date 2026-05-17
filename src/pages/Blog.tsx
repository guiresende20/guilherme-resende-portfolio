import { useEffect, useState, useMemo } from "react";
import type { PostMeta } from "../lib/blog/frontmatter";
import { fetchPostList } from "../lib/blog/api";
import PostCard from "../components/blog/PostCard";

const PAGE_SIZE = 15;

export default function Blog() {
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchPostList()
      .then(setPosts)
      .catch((e) => setError(String(e)));
  }, []);

  const allTags = useMemo(() => {
    if (!posts) return [];
    const set = new Set<string>();
    posts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (!activeTag) return posts;
    return posts.filter((p) => p.tags.includes(activeTag));
  }, [posts, activeTag]);

  if (error) {
    return (
      <div className="container mx-auto px-6 py-16 text-foreground">
        <p className="text-red-400">Erro ao carregar posts: {error}</p>
      </div>
    );
  }

  if (!posts) {
    return (
      <div className="container mx-auto px-6 py-16 text-foreground">
        <p className="text-muted-foreground">Carregando posts…</p>
      </div>
    );
  }

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Blog</span>
        <h1 className="font-display text-5xl text-foreground mt-2">Escritos</h1>
      </header>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => {
              setActiveTag(null);
              setVisible(PAGE_SIZE);
            }}
            className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-3 py-1.5 transition-colors ${
              activeTag === null
                ? "border-neon text-neon"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            todos
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveTag(tag);
                setVisible(PAGE_SIZE);
              }}
              className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-3 py-1.5 transition-colors ${
                activeTag === tag
                  ? "border-neon text-neon"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-muted-foreground">Nenhum post ainda. Volte em breve.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="font-mono text-xs uppercase tracking-[0.1em] border border-neon text-neon px-6 py-3 hover:bg-neon/10 transition-colors"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
