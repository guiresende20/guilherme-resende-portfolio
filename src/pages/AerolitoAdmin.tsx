import { useSearchParams } from "react-router-dom";

export default function AerolitoAdmin() {
  const [params] = useSearchParams();
  const token = params.get("token");

  if (!token) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display text-2xl uppercase tracking-tight">Aerolito Admin</h1>
        <p className="font-mono text-sm text-muted-foreground mt-4">
          Painel em construção.
        </p>
      </section>
    </main>
  );
}
