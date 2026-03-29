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

export default i18n;
