import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptTranslation from '../locales/pt.json';
import enTranslation from '../locales/en.json';
import esTranslation from '../locales/es.json';

const resources = {
  pt: {
    translation: ptTranslation
  },
  en: {
    translation: enTranslation
  },
  es: {
    translation: esTranslation
  }
};

const HTML_LANG_MAP: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt', // idioma nativo padrão
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Mantém <html lang> sincronizado com o idioma ativo (a11y, SEO multilíngue)
const syncHtmlLang = (lng: string) => {
  const code = HTML_LANG_MAP[lng] || lng;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = code;
  }
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
