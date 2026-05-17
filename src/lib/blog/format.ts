import { useTranslation } from "react-i18next";

export function formatReadingTime(min: number, lang: string): string {
  if (lang.startsWith("en")) return `${min} min read`;
  if (lang.startsWith("es")) return `${min} min de lectura`;
  return `${min} min de leitura`;
}

export function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang || "pt-BR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language;
}
