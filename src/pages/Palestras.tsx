import { useEffect, useState } from "react";
import { fetchPalestras, type PalestraEntry } from "../lib/palestra/api";
import PalestraCard from "../components/palestra/PalestraCard";

export default function Palestras() {
  const [decks, setDecks] = useState<PalestraEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPalestras().then(setDecks).catch((e) => setError(String(e.message || e)));
  }, []);

  const publicados = decks ? decks.filter((d) => d.status === "publicado") : null;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Palestras</span>
          <h1 className="font-display text-5xl text-foreground mt-2">Apresentações</h1>
        </div>
        <a
          href="/palestra/admin"
          className="mt-1 shrink-0 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/50 transition hover:border-white/30 hover:text-foreground/80"
        >
          Admin
        </a>
      </header>

      {error && <p className="text-foreground/70">{error}</p>}
      {!error && !publicados && <p className="text-foreground/70">Carregando…</p>}
      {!error && publicados && publicados.length === 0 && (
        <p className="text-foreground/70">Nenhuma palestra publicada ainda.</p>
      )}
      {!error && publicados && publicados.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((deck) => (
            <PalestraCard key={deck.slug} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}
