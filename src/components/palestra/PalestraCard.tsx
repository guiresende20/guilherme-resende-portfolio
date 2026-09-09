import { useEffect, useState } from "react";
import { fetchPalestraFirstSlide, type PalestraEntry, type PalestraSlidePreview } from "../../lib/palestra/api";

const ACCENT_GRADIENTS: Record<string, string> = {
  green: "from-emerald-900 via-emerald-950 to-black",
  violet: "from-violet-900 via-violet-950 to-black",
  pink: "from-pink-900 via-pink-950 to-black",
  cyan: "from-cyan-900 via-cyan-950 to-black",
};

export default function PalestraCard({ deck }: { deck: PalestraEntry }) {
  const [preview, setPreview] = useState<PalestraSlidePreview | null>(null);

  useEffect(() => {
    if (deck.thumbnail) return; // thumbnail manual tem prioridade, evita fetch à toa
    fetchPalestraFirstSlide(deck.slug).then(setPreview).catch(() => setPreview(null));
  }, [deck.slug, deck.thumbnail]);

  const gradient = ACCENT_GRADIENTS[preview?.accent || "violet"] || ACCENT_GRADIENTS.violet;

  return (
    <a
      href={`/palestra/${deck.slug}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-neon/40"
    >
      {deck.thumbnail ? (
        <img
          src={deck.thumbnail}
          alt={deck.titulo}
          className="aspect-video w-full object-cover transition group-hover:scale-105"
        />
      ) : preview?.image ? (
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={preview.image}
            alt={preview.title || deck.titulo}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="font-display text-sm text-white">{preview.title}</p>
          </div>
        </div>
      ) : (
        <div className={`flex aspect-video w-full flex-col justify-center gap-1 bg-gradient-to-br ${gradient} p-5`}>
          {preview?.kicker && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/60">
              {preview.kicker}
            </span>
          )}
          <p className="font-display text-lg leading-tight text-white">
            {preview?.title || deck.titulo}
          </p>
          {preview?.subtitle && (
            <p className="line-clamp-2 text-xs text-white/70">{preview.subtitle}</p>
          )}
        </div>
      )}
      <div className="p-4">
        <h3 className="font-display text-lg text-foreground">{deck.titulo}</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-foreground/60">
          {[deck.cliente, deck.data].filter(Boolean).join(" · ")}
        </p>
      </div>
    </a>
  );
}
