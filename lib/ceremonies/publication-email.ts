import { normalizeLocale, type SupportedLocale } from "../i18n/config.ts";
export type PublicationNotice = {
  id: string;
  claim: string;
  eventId: string;
  userId: string | null;
  registrationId: string | null;
  payload: {
    kind: "opening" | "closing";
    title: string;
    startsAt: string;
    location: string;
    lines: {
      name: string;
      sector: string;
      quantity?: number;
      groupId?: string;
      nomineeId?: string;
    }[];
  };
};
const copy: Record<
  SupportedLocale,
  {
    opening: string;
    closing: string;
    personal: string;
    leader: string;
    body: string;
    groupBody: string;
    sector: string;
    places: string;
    open: string;
  }
> = {
  it: {
    opening: "Inaugurazione",
    closing: "Cerimonia finale",
    personal: "Il tuo settore per la cerimonia",
    leader: "Posti alle cerimonie da assegnare",
    body: "È stata pubblicata la seguente assegnazione. Il settore è disponibile anche nella tua area personale.",
    groupBody:
      "Sono stati pubblicati nuovi posti per i tuoi gruppi. Accedi a «Posti alle cerimonie» e assegnali nominalmente alle tue persone, scegliendo esplicitamente gli eventuali minori.",
    sector: "Settore",
    places: "posti",
    open: "Apri Posti alle cerimonie",
  },
  en: {
    opening: "Opening ceremony",
    closing: "Closing ceremony",
    personal: "Your ceremony sector",
    leader: "Ceremony places to assign",
    body: "The following assignment has been published. Your sector is also available in your personal area.",
    groupBody:
      "New places have been published for your groups. Open “Ceremony places” and assign them to your members, explicitly selecting any children.",
    sector: "Sector",
    places: "places",
    open: "Open Ceremony places",
  },
  fr: {
    opening: "Cérémonie d’ouverture",
    closing: "Cérémonie de clôture",
    personal: "Votre secteur pour la cérémonie",
    leader: "Places aux cérémonies à attribuer",
    body: "L’attribution suivante a été publiée. Votre secteur est également disponible dans votre espace personnel.",
    groupBody:
      "De nouvelles places ont été publiées pour vos groupes. Ouvrez « Places aux cérémonies » et attribuez-les à vos membres, en sélectionnant explicitement les enfants.",
    sector: "Secteur",
    places: "places",
    open: "Ouvrir Places aux cérémonies",
  },
  de: {
    opening: "Eröffnungsfeier",
    closing: "Abschlussfeier",
    personal: "Ihr Bereich für die Zeremonie",
    leader: "Plätze für Zeremonien zuweisen",
    body: "Die folgende Zuweisung wurde veröffentlicht. Ihr Bereich ist auch in Ihrem persönlichen Bereich verfügbar.",
    groupBody:
      "Neue Plätze für Ihre Gruppen wurden veröffentlicht. Öffnen Sie „Plätze für Zeremonien“ und weisen Sie diese Ihren Mitgliedern zu. Wählen Sie Kinder ausdrücklich aus.",
    sector: "Bereich",
    places: "Plätze",
    open: "Plätze für Zeremonien öffnen",
  },
  es: {
    opening: "Ceremonia de apertura",
    closing: "Ceremonia de clausura",
    personal: "Tu sector para la ceremonia",
    leader: "Plazas para las ceremonias por asignar",
    body: "Se ha publicado la siguiente asignación. El sector también está disponible en tu área personal.",
    groupBody:
      "Se han publicado nuevas plazas para tus grupos. Abre « Plazas para las ceremonias » y asígnalas a tus miembros, seleccionando explícitamente a los menores.",
    sector: "Sector",
    places: "plazas",
    open: "Abrir Plazas para las ceremonias",
  },
  nl: {
    opening: "Openingsceremonie",
    closing: "Slotceremonie",
    personal: "Je vak voor de ceremonie",
    leader: "Ceremonieplaatsen om toe te wijzen",
    body: "De volgende toewijzing is gepubliceerd. Je vak is ook beschikbaar in je persoonlijke omgeving.",
    groupBody:
      "Er zijn nieuwe plaatsen voor je groepen gepubliceerd. Open “Ceremonieplaatsen” en wijs ze toe aan je leden. Selecteer eventuele kinderen uitdrukkelijk.",
    sector: "Vak",
    places: "plaatsen",
    open: "Ceremonieplaatsen openen",
  },
  uk: {
    opening: "Церемонія відкриття",
    closing: "Заключна церемонія",
    personal: "Ваш сектор на церемонії",
    leader: "Місця на церемонії для розподілу",
    body: "Опубліковано наведене нижче призначення. Сектор також доступний у вашому особистому кабінеті.",
    groupBody:
      "Для ваших груп опубліковано нові місця. Відкрийте «Місця на церемонії» та призначте їх учасникам, окремо вибравши дітей.",
    sector: "Сектор",
    places: "місць",
    open: "Відкрити місця на церемонії",
  },
};
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function renderPublicationEmail(
  notice: PublicationNotice,
  appUrl: string,
  language: string | null,
) {
  const locale = normalizeLocale(language) ?? "it",
    t = copy[locale],
    leader = !!notice.userId;
  const ceremony = notice.payload.kind === "opening" ? t.opening : t.closing;
  const url = new URL(
    `/dashboard/${leader ? "capogruppo" : "partecipante"}/cerimonie${leader ? `?kind=${notice.payload.kind}` : ""}`,
    appUrl,
  );
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("invalid_site_url");
  const paragraphs = [
    ceremony,
    new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    }).format(new Date(notice.payload.startsAt)) +
      " · " +
      notice.payload.location,
    leader ? t.groupBody : t.body,
    ...notice.payload.lines.map(
      (line) =>
        `${line.name} · ${t.sector} ${line.sector}${line.quantity === undefined ? "" : ` · ${line.quantity} ${t.places}`}`,
    ),
  ];
  return {
    subject: `${leader ? t.leader : t.personal} — ${ceremony}`,
    text: paragraphs.join("\n\n") + "\n\n" + url.href,
    html:
      paragraphs.map((p) => `<p>${escape(p)}</p>`).join("") +
      `<p><a href="${escape(url.href)}">${escape(t.open)}</a></p>`,
  };
}
