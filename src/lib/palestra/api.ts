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

export type PalestraSlidePreview = {
  title: string;
  subtitle: string;
  kicker: string;
  accent: string;
  image: string | null;
};

type RawSlide = {
  id: string;
  title?: string;
  subtitle?: string;
  kicker?: string;
  accent?: string;
  image?: string;
};

// reproduz o merge base+overrides+added/hidden/order do deck.js, só o
// suficiente pra extrair o primeiro slide efetivo (capa) como preview.
export async function fetchPalestraFirstSlide(slug: string): Promise<PalestraSlidePreview | null> {
  const res = await fetch(`/api/deck-content/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const content = await res.json();
  const base: RawSlide[] = Array.isArray(content.base?.slides) ? content.base.slides : [];
  const overrides: Record<string, Partial<RawSlide>> = content.overrides || {};
  const added: RawSlide[] = Array.isArray(content.added) ? content.added : [];
  const hidden: string[] = Array.isArray(content.hidden) ? content.hidden : [];
  const order: string[] = Array.isArray(content.order) ? content.order : [];

  let slides = [...base, ...added]
    .filter((s) => !hidden.includes(s.id))
    .map((s) => ({ ...s, ...(overrides[s.id] || {}) }));

  if (order.length > 0) {
    const bySlug = new Map(slides.map((s) => [s.id, s]));
    slides = order.map((id) => bySlug.get(id)).filter((s): s is RawSlide => !!s);
  }

  const first = slides[0];
  if (!first) return null;
  return {
    title: first.title || "",
    subtitle: first.subtitle || "",
    kicker: first.kicker || "",
    accent: first.accent || "violet",
    // ignora qualquer variante (atual ou legada) do glifo-placeholder neutro —
    // ver LEGACY_PLACEHOLDERS em public/palestra/_deck/js/deck.js.
    image: first.image && !/placeholder\.svg$|logo-aero\.png$/.test(first.image) ? first.image : null,
  };
}
