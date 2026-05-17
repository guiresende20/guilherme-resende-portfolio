import { useState } from "react";
import { translatePost } from "../../lib/blog/api";

interface TranslateBannerProps {
  slug: string;
  targetLang: "en" | "es";
  onTranslated: (translatedBody: string) => void;
  onReset: () => void;
  showingTranslation: boolean;
}

const LABELS = {
  en: {
    offer: "This post was written in Portuguese. Translate to English?",
    action: "Translate",
    loading: "Translating…",
    revert: "Show original (PT)",
    disclaimer: "Auto-translated by AI.",
  },
  es: {
    offer: "Este post fue escrito en portugués. ¿Traducir al español?",
    action: "Traducir",
    loading: "Traduciendo…",
    revert: "Ver original (PT)",
    disclaimer: "Traducido automáticamente por IA.",
  },
};

export default function TranslateBanner({
  slug,
  targetLang,
  onTranslated,
  onReset,
  showingTranslation,
}: TranslateBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labels = LABELS[targetLang];

  async function handleTranslate() {
    setLoading(true);
    setError(null);
    try {
      const cached = sessionStorage.getItem(`translation:${slug}:${targetLang}`);
      if (cached) {
        onTranslated(cached);
      } else {
        const translated = await translatePost(slug, targetLang);
        sessionStorage.setItem(`translation:${slug}:${targetLang}`, translated);
        onTranslated(translated);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-electric/40 bg-electric/5 px-4 py-3 mb-8 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-foreground">
        {showingTranslation ? labels.disclaimer : labels.offer}
      </p>
      <div className="flex gap-2">
        {showingTranslation ? (
          <button
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-foreground px-3 py-1.5"
          >
            {labels.revert}
          </button>
        ) : (
          <button
            onClick={handleTranslate}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-[0.1em] border border-neon text-neon hover:bg-neon/10 px-3 py-1.5 disabled:opacity-50"
          >
            {loading ? labels.loading : labels.action}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  );
}
