import { getForumRelayRoom } from "./assisi-2026-relay-rooms.ts";
import type { SupportedLocale } from "../i18n/config.ts";

// Assisi 2026, printed programme received 20 October 2026, pages 6–52.
// SHA-256: d7c8fdfe7806c77e9bf1571a188006ea6a0f7f40b92238544f4afebed06de761
// Use immutable panel IDs, never infer languages from titles, numbers or venues.
const languagesByPanel: Readonly<Record<string, readonly string[]>> = {
  "fc9f3085-dabf-4e2d-b01b-7ccaf1b984da": ["it", "en", "fr", "es", "ar"], // Forum 1
  "23ae1817-c26e-4263-aed0-2f52a5bfdbc3": ["it", "en", "fr", "de"], // Forum 2
  "2eb7bdd0-72b3-4c94-9db2-064be7d37caa": ["it", "en", "fr", "ar"], // Forum 3
  "2b3f7d74-95cc-409a-b939-79815870316d": ["it", "en"], // Forum 4
  "f8c22637-2975-4a76-a3b3-6b4f164fc7c1": ["it", "en", "fr", "ar", "ja"], // Forum 5
  "b67db8d1-81fe-42fb-b326-ece3dc1a6bb2": ["it", "en", "ja"], // Forum 6
  "bd1efcd1-172b-42d1-8ef8-db75612c6fd4": ["it", "en", "de", "uk"], // Forum 7
  "2b24ac02-480c-4251-84eb-e40bb8ac2e24": ["it", "en", "fr", "es", "de"], // Forum 8
  "e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f": ["it", "en", "es", "de"], // Forum 9
  "db14374f-3297-4aab-b325-4b4a5506a8dc": ["it", "en", "ja"], // Forum 10
  "50c854a9-23f2-4a52-9f89-20f0ddfe0cef": ["it", "en", "fr", "de"], // Forum 11
  "effc4ac3-130c-4cb1-9258-2c1901df2f38": ["it", "en", "fr", "ar"], // Forum 12
  "6f1146d0-88b6-4bfa-a69e-dd332699a50f": ["it", "en", "es", "ar"], // Forum 13
  "7e46d601-db01-43d0-b9ef-58cbdc2fc640": ["it", "en", "fr", "de"], // Forum 14
  "6d1f10a9-c407-45e8-85ac-11a22df319b2": ["it", "en", "fr", "ar"], // Forum 15
  "85623739-3a57-4287-84d7-eedb25da1fc6": ["it", "en", "fr", "ar", "ja"], // Forum 16
  "1f6b096d-a2a6-41fe-aadf-672902a0b74a": ["it", "en", "fr"], // Forum 17
  "20aa5c45-1e8c-4f8d-a757-cb1b0624e959": ["it", "en", "uk"], // Forum 18
  "fbfd9fbe-aebc-4438-8b88-a4e379e00e3c": ["it", "en", "fr", "es"], // Forum 19
  "dc42c648-f8fa-4cf3-8ea0-0b2b21c6aabd": ["it", "en", "fr", "ar"], // Forum 20
  "de36f695-3142-4221-a4ee-b481a410561e": ["it", "en", "ja"], // Forum 21
  "bf87813c-5387-4951-9fb5-68183aeaeb58": ["it", "en", "fr", "de", "ja"], // Forum 22
  "3b81eba7-7919-46fa-a1bd-b21f35abe97d": ["it", "en", "fr", "de"], // Forum 23
  "21135541-c02e-4fc3-8dd3-0492505da66b": ["it", "en", "fr", "es", "ar"], // Forum 24
};

const labels: Record<SupportedLocale, string> = {
  it: "Lingue", en: "Languages", fr: "Langues", de: "Sprachen",
  es: "Idiomas", nl: "Talen", uk: "Мови",
};

export function getForumLanguagesLabel(panelId: string, locale: SupportedLocale): string | null {
  if (getForumRelayRoom(panelId)) return `${labels[locale]}: ${new Intl.DisplayNames([locale], { type: "language" }).of("it")}`;
  if (!Object.hasOwn(languagesByPanel, panelId)) return null;
  const names = new Intl.DisplayNames([locale], { type: "language" });
  return `${labels[locale]}: ${languagesByPanel[panelId].map(code => names.of(code) ?? code).join(", ")}`;
}
