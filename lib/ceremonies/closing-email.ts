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
  const sections = (["it", "en"] as const).map(locale => {
    const it = locale === "it";
    const label = it ? "Italiano" : "English";
    const title = it ? "Cerimonia finale" : "Closing ceremony";
    const intro = report
      ? it ? "Queste persone non hanno un indirizzo email personale. Sei incaricato di contattarle o cercarle di persona, comunicare le istruzioni del loro settore e consegnare il badge. Puoi scaricare i badge dalla dashboard capogruppo. Il riepilogo comprende le assegnazioni attive al momento indicato." : "These people do not have a personal email address. Please contact them or find them in person, explain the instructions for their sector and provide their badge. Download their badges from the group leader dashboard. This report includes active assignments at the indicated time."
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
    if (!leader || report) for (const code of [...new Set(badges.map(b => b.code))]) {
      const instructions = notice.payload.instructions?.[code]?.[locale]?.trim();
      if (!instructions) throw Error("closing_instructions_missing");
      const heading = `${it ? "Istruzioni di accesso" : "Entry instructions"} · ${closingBadgeSector(code)!.name} · ${closingBadgeColor(code, locale)}`;
      text.push(heading, instructions);
      html += `<h3>${escape(heading)}</h3><p>${escape(instructions).replaceAll("\n", "<br>")}</p>`;
    }
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
