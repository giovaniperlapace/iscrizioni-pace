import type { SupportedLocale } from "../i18n/config";

export const NEXT_EDITION_COPY = {
  it: { title: "Ci vediamo a Genova!", description: "La prossima edizione sarà a Genova." },
  en: { title: "See you in Genoa!", description: "The next edition will take place in Genoa." },
  fr: { title: "Rendez-vous à Gênes !", description: "La prochaine édition aura lieu à Gênes." },
  de: { title: "Wir sehen uns in Genua!", description: "Die nächste Ausgabe findet in Genua statt." },
  es: { title: "¡Nos vemos en Génova!", description: "La próxima edición tendrá lugar en Génova." },
  nl: { title: "Tot ziens in Genua!", description: "De volgende editie vindt plaats in Genua." },
  uk: { title: "До зустрічі в Генуї!", description: "Наступна зустріч відбудеться в Генуї." },
} satisfies Record<SupportedLocale, { title: string; description: string }>;
