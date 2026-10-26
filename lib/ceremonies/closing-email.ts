import type { PublicationNotice } from "./publication-email.ts";
import { closingBadgeSector, closingBadgeColor } from "./closing-badges.ts";
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function renderClosingBadgeEmail(notice: PublicationNotice, appUrl: string) {
  if (!notice.payload.badgeWorkflow || notice.payload.kind !== "closing") throw Error("invalid_closing_notice");
  const report = notice.payload.noticeType === "leader_contacts";
  const leader = !!notice.userId;
  const url = new URL(`/dashboard/${leader ? "capogruppo" : "partecipante"}/cerimonie${leader ? "?kind=closing" : ""}`, appUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw Error("invalid_site_url");
  const badges = notice.payload.lines.map(line => {
    const badge = closingBadgeSector(line.badgeCode);
    if (!badge) throw Error("closing_badge_sector_missing");
    return badge;
  });
  if (!leader && !report) {
    if (!notice.payload.lines.length) throw Error("invalid_badge_identity");
    const sections = (["it", "en"] as const).map(locale => {
      const it = locale === "it";
      const parts = notice.payload.lines.map((line, index) => {
        const greeting = it ? `Ciao ${line.name},` : `Hello ${line.name},`;
        const body = it
          ? `l'immagine qui sotto è il biglietto di ingresso per partecipare alla cerimonia finale, lo trovi anche scaricabile in allegato a questa mail. Ti è stato assegnato il settore ${line.sector}. L’accesso sarà consentito entro le 14:30.`
          : `the image below is your admission ticket for the closing ceremony. You can also download it from the attachment to this email. You have been assigned the sector ${line.sector}. Entry will be permitted until 14:30.`;
        const farewell = it ? "Buona cerimonia finale!" : "Enjoy the closing ceremony!";
        const seating = line.badgeCode === "CLOSING_GREEN"
          ? it ? "Anche nel settore Prato Basilica superiore ci saranno posti a sedere." : "Seating will also be available in the Prato Basilica superiore sector."
          : null;
        return {
          text: [greeting, body, ...(seating ? [seating] : []), farewell].join("\n\n"),
          html: `<p>${escape(greeting)}</p><p>${escape(body)}</p>${seating ? `<p>${escape(seating)}</p>` : ""}<p><img src="cid:closing-badge-${index}@iscrizioni-pace" width="270" alt="${escape(`${it ? "Biglietto di ingresso" : "Admission ticket"} · ${line.name} · ${line.sector}`)}" style="display:block;max-width:100%;height:auto"></p><p>${farewell}</p>`,
        };
      });
      return { text: parts.map(p => p.text).join("\n\n"), html: `<section lang="${locale}">${parts.map(p => p.html).join("")}</section>` };
    });
    return { subject: "Il tuo badge per la cerimonia finale / Your closing ceremony badge",
      text: sections.map(s => s.text).join("\n\n---\n\n"), html: sections.map(s => s.html).join("<hr>") };
  }
  const sections = (["it", "en"] as const).map(locale => {
    const it = locale === "it";
    const label = it ? "Italiano" : "English";
    const title = it ? "Cerimonia finale" : "Closing ceremony";
    const intro = report
      ? it ? "Queste persone non hanno un indirizzo email personale. Sei incaricato di contattarle o cercarle di persona, consegnare il badge e comunicare le istruzioni di accesso, che arriveranno con una mail separata. Puoi scaricare i badge dalla dashboard capogruppo. Il riepilogo comprende le assegnazioni attive al momento indicato." : "These people do not have a personal email address. Please contact them or find them in person, provide their badge and share the entry instructions, which will arrive in a separate email. Download their badges from the group leader dashboard. This report includes active assignments at the indicated time."
      : leader ? it ? "Sono stati pubblicati posti per il tuo gruppo. Accedi alla dashboard capogruppo e assegnali nominalmente alle persone del gruppo, scegliendo esplicitamente gli eventuali minori." : "Places have been published for your group. Open the group leader dashboard and assign them to your members, explicitly selecting any children."
      : it ? "Ti è stato assegnato l’accesso al settore indicato. Trovi il badge personale in allegato PDF, da scaricare e mostrare all’ingresso, e nella tua iscrizione sul sito. La sistemazione nel settore è a riempimento." : "You have been assigned access to the sector shown below. Download your personal badge from the attached PDF and show it at the entrance. It is also available in your registration on the website. Places within the sector are filled on arrival.";
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" });
    const paragraphs = [title, `${date.format(new Date(notice.payload.startsAt))} · ${notice.payload.location}`, intro];
    if (report && notice.payload.lines.some(line => line.communicationDelegated === true)) paragraphs.push(it
      ? "Per le persone che ti hanno delegato le comunicazioni trovi un PDF allegato per ogni settore interessato, con badge nominativi orizzontali. Gli allegati includono soltanto le persone con delega attiva nei tuoi gruppi."
      : "For people who delegated their communications to you, a PDF is attached for each relevant sector, with horizontal personal badges. Attachments include only people with an active delegation in your groups.");
    if (report) {
      if (!notice.payload.snapshotAt) throw Error("report_snapshot_missing");
      paragraphs.push(`${it ? "Riepilogo aggiornato al" : "Snapshot as of"} ${date.format(new Date(notice.payload.snapshotAt))} (Roma)`);
    }
    const lines = notice.payload.lines.map((line, i) => `${line.name}${line.groupName ? ` · ${line.groupName}` : ""} · ${line.sector} · Badge ${closingBadgeColor(badges[i].code, locale)}${line.quantity === undefined ? "" : ` · ${line.quantity} ${it ? "posti" : "places"}`}`);
    let html = `<section lang="${locale}"><h2>${label}</h2>${paragraphs.map(p => `<p>${escape(p)}</p>`).join("")}<ul>${lines.map(p => `<li>${escape(p)}</li>`).join("")}</ul>`;
    const text = [label, ...paragraphs, ...lines];
    const open = it ? "Apri Posti alle cerimonie" : "Open Ceremony places";
    html += `<p><a href="${escape(url.href)}">${open}</a></p></section>`;
    text.push(`${open}: ${url.href}`);
    return { text: text.join("\n\n"), html };
  });
  return { subject: report ? "Cerimonia finale: persone da contattare / Closing ceremony: people to contact"
    : leader ? "Cerimonia finale: posti da assegnare / Closing ceremony: places to assign"
    : "Il tuo badge per la cerimonia finale / Your closing ceremony badge",
    text: sections.map(s => s.text).join("\n\n---\n\n"), html: sections.map(s => s.html).join("<hr>") };
}
