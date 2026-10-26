export type PublicationNotice = {
  id: string;
  claim: string;
  eventId: string;
  userId: string | null;
  registrationId: string | null;
  destinationEmail?: string | null;
  payload: {
    badgeWorkflow?: boolean;
    noticeType?: "leader_contacts";
    snapshotAt?: string;
    instructions?: Record<string, { it: string; en: string }>;
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
      badgeCode?: string;
      groupName?: string | null;
      communicationDelegated?: boolean;
    }[];
  };
};
const copy: Record<
  "it" | "en",
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
) {
  const leader = !!notice.userId;
  const url = new URL(
    `/dashboard/${leader ? "capogruppo" : "partecipante"}/cerimonie${leader ? `?kind=${notice.payload.kind}` : ""}`,
    appUrl,
  );
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("invalid_site_url");
  // Every recipient receives both languages in one notification, independent of
  // their dashboard language. Keep the same assignment data in both sections.
  const sections = (["it", "en"] as const).map((locale) => {
    const t = copy[locale];
    const ceremony = notice.payload.kind === "opening" ? t.opening : t.closing;
    const label = locale === "it" ? "Italiano" : "English";
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
      text: [label, ...paragraphs, `${t.open}: ${url.href}`].join("\n\n"),
      html:
        `<section lang="${locale}"><h2>${label}</h2>` +
        paragraphs.map((p) => `<p>${escape(p)}</p>`).join("") +
        `<p><a href="${escape(url.href)}">${escape(t.open)}</a></p></section>`,
    };
  });
  return {
    subject: sections.map((section) => section.subject).join(" / "),
    text: sections.map((section) => section.text).join("\n\n---\n\n"),
    html: sections.map((section) => section.html).join("<hr>"),
  };
}
