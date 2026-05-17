import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function PostTOC({
  articleSelector = "article",
  body,
}: {
  articleSelector?: string;
  body: string;
}) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Build TOC after markdown renders.
  useEffect(() => {
    const article = document.querySelector(articleSelector);
    if (!article) return;
    const h2s = Array.from(article.querySelectorAll("h2"));
    const list: Heading[] = h2s.map((h) => {
      const text = h.textContent ?? "";
      let id = h.id;
      if (!id) {
        id = slugify(text);
        h.id = id;
      }
      return { id, text };
    });
    setHeadings(list);
  }, [articleSelector, body]);

  // Track which heading is currently in view.
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden lg:block sticky top-24 self-start w-56 ml-12 shrink-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-3">
        Neste post
      </p>
      <ul className="space-y-2 border-l border-border pl-3">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-xs transition-colors ${
                activeId === h.id ? "text-neon" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
