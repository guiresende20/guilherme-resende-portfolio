import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

// Placeholder até a referência HTML chegar.
// Quando a referência chegar: substituir conteúdo deste componente pelo HTML real,
// e disparar onDone() quando a animação acabar (timer, evento, ou scroll).
export default function AerolitoIntro({ onDone }: Props) {
  const [phase, setPhase] = useState<"intro" | "ready">("intro");

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-2xl px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-neon mb-4">guilherme · aerolito</p>
        <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tight leading-none">
          Head de <span className="text-neon">Pesquisa</span>
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-6">
          JUN 2026 · Aeroli.to · Porto Alegre
        </p>
      </div>

      {phase === "ready" && (
        <button
          onClick={onDone}
          className="relative z-10 mt-12 font-mono text-[11px] uppercase tracking-[0.1em] text-neon border border-neon/40 px-4 py-2 rounded-sm hover:bg-neon/10 transition-all animate-fade-up"
        >
          ↓ Conhecer melhor (chat com a IA)
        </button>
      )}
    </section>
  );
}
