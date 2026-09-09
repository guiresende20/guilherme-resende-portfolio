export type PalestraEntry = {
  slug: string;
  titulo: string;
  cliente: string;
  data: string;
  thumbnail: string;
  status: "publicado" | "nao-listado";
  senhaHash: string | null;
};

export async function fetchPalestras(): Promise<PalestraEntry[]> {
  const res = await fetch("/api/deck-registry", { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível carregar as palestras.");
  const data = await res.json();
  return Array.isArray(data.decks) ? data.decks : [];
}
