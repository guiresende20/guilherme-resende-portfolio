import { useEffect } from "react";

export default function AerolitoPage() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display text-4xl uppercase tracking-tight">Aerolito</h1>
        <p className="font-mono text-sm text-muted-foreground mt-4">
          Página em construção.
        </p>
      </section>
    </main>
  );
}
