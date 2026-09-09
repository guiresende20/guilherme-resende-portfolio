import type { PalestraEntry } from "../../lib/palestra/api";

export default function PalestraCard({ deck }: { deck: PalestraEntry }) {
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
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-white/5 text-foreground/40">
          {deck.titulo}
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
