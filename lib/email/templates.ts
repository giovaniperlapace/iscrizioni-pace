type MagicLinkTemplateInput = {
  actionLink: string;
};

type RegistrationConfirmationInput = {
  firstName: string;
  lastName: string;
  participantCode: string;
  eventTitle: string;
  siteLink: string;
  qrCodeContentId?: string;
};

type GroupLeaderAssignmentNotificationInput = {
  leaderName: string;
  participantName: string;
  participantCode: string | null;
  groupName: string;
  eventTitle: string;
  dashboardLink: string;
};

type SchoolBookingConfirmationInput = {
  teacherFirstName: string;
  eventTitle: string;
  schoolName: string;
  classDescription: string;
  studentCount: number;
  companionCount: number;
  panelLines: string[];
  accessLink: string;
  qrCodeContentId?: string;
};

export function renderMagicLinkEmail(input: MagicLinkTemplateInput) {
  return {
    subject: "Accesso alla tua iscrizione",
    text: [
      "Ciao,",
      "",
      "usa questo link per accedere alla tua iscrizione:",
      input.actionLink,
      "",
      "Se non hai richiesto tu questo link, puoi ignorare questa email.",
    ].join("\n"),
    html: [
      "<p>Ciao,</p>",
      "<p>usa questo link per accedere alla tua iscrizione:</p>",
      `<p><a href="${escapeHtml(input.actionLink)}">Accedi alla tua iscrizione</a></p>`,
      "<p>Se non hai richiesto tu questo link, puoi ignorare questa email.</p>",
    ].join(""),
  };
}

export function renderRegistrationConfirmationEmail(
  input: RegistrationConfirmationInput
) {
  const participantName = `${input.firstName} ${input.lastName}`.trim();

  return {
    subject: `Iscrizione ricevuta - ${input.eventTitle}`,
    text: [
      `Ciao ${input.firstName},`,
      "",
      `abbiamo ricevuto l'iscrizione di ${participantName} per ${input.eventTitle}.`,
      `Il tuo codice partecipante è: ${input.participantCode}.`,
      "In allegato trovi anche il tuo QR code personale per l'accesso all'evento.",
      `Puoi entrare nella tua dashboard tornando su ${input.siteLink} e inserendo la stessa email usata per registrarti. Riceverai un link personale di accesso per riaprire e aggiornare la tua scheda.`,
      "",
      "Quando sarà pubblicato il programma completo, dalla dashboard potrai anche scegliere i momenti a cui partecipare.",
      "",
      "Grazie.",
    ].join("\n"),
    html: [
      `<p>Ciao ${escapeHtml(input.firstName)},</p>`,
      `<p>abbiamo ricevuto l'iscrizione di <strong>${escapeHtml(
        participantName
      )}</strong> per <strong>${escapeHtml(input.eventTitle)}</strong>.</p>`,
      `<p>Il tuo codice partecipante è: <strong>${escapeHtml(
        input.participantCode
      )}</strong>.</p>`,
      input.qrCodeContentId
        ? `<p><img src="cid:${escapeHtml(
            input.qrCodeContentId
          )}" alt="QR code personale" width="180" height="180" /></p>`
        : "",
      "<p>In allegato trovi anche il tuo QR code personale per l'accesso all'evento.</p>",
      `<p>Puoi entrare nella tua dashboard tornando su <a href="${escapeHtml(
        input.siteLink
      )}">${escapeHtml(
        input.siteLink
      )}</a> e inserendo la stessa email usata per registrarti. Riceverai un link personale di accesso per riaprire e aggiornare la tua scheda.</p>`,
      "<p>Quando sarà pubblicato il programma completo, dalla dashboard potrai anche scegliere i momenti a cui partecipare.</p>",
      "<p>Grazie.</p>",
    ].join(""),
  };
}

export function renderSchoolBookingConfirmationEmail(
  input: SchoolBookingConfirmationInput
) {
  const counts = `${input.studentCount} studenti, ${input.companionCount} accompagnatori`;
  return {
    subject: `Prenotazione scuola ricevuta - ${input.eventTitle}`,
    text: [
      `Ciao ${input.teacherFirstName},`, "",
      `abbiamo ricevuto la prenotazione di ${input.schoolName} (${input.classDescription}) per ${input.eventTitle}.`,
      `Gruppo: ${counts}.`, "", "Panel prenotati:", ...input.panelLines.map((line) => `- ${line}`), "",
      "In allegato trovi il QR code unico della classe.",
      "Usa il link personale qui sotto per consultare, correggere, ridurre o annullare la prenotazione:",
      input.accessLink, "", "Non inoltrare il link personale a terzi.",
    ].join("\n"),
    html: [
      `<p>Ciao ${escapeHtml(input.teacherFirstName)},</p>`,
      `<p>abbiamo ricevuto la prenotazione di <strong>${escapeHtml(input.schoolName)}</strong> (${escapeHtml(input.classDescription)}) per <strong>${escapeHtml(input.eventTitle)}</strong>.</p>`,
      `<p>Gruppo: ${escapeHtml(counts)}.</p>`,
      `<p>Panel prenotati:</p><ul>${input.panelLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
      input.qrCodeContentId ? `<p><img src="cid:${escapeHtml(input.qrCodeContentId)}" alt="QR code della classe" width="180" height="180" /></p>` : "",
      "<p>In allegato trovi il QR code unico della classe.</p>",
      `<p><a href="${escapeHtml(input.accessLink)}">Apri e gestisci le prenotazioni</a></p>`,
      "<p>Non inoltrare il link personale a terzi.</p>",
    ].join(""),
  };
}

export function renderGroupLeaderAssignmentNotificationEmail(
  input: GroupLeaderAssignmentNotificationInput
) {
  const participantCode = input.participantCode
    ? ` (${input.participantCode})`
    : "";

  return {
    subject: `Nuova persona da verificare - ${input.groupName}`,
    text: [
      `Ciao ${input.leaderName},`,
      "",
      `C'è una nuova persona da verificare per ${input.groupName}: ${input.participantName}${participantCode}.`,
      `Evento: ${input.eventTitle}.`,
      "",
      "Apri la dashboard capogruppo per confermare l'appartenenza, aggiungere una nota interna o rimandarla al livello superiore.",
      input.dashboardLink,
      "",
      "Grazie.",
    ].join("\n"),
    html: [
      `<p>Ciao ${escapeHtml(input.leaderName)},</p>`,
      `<p>C'è una nuova persona da verificare per <strong>${escapeHtml(
        input.groupName
      )}</strong>: <strong>${escapeHtml(
        input.participantName
      )}${escapeHtml(participantCode)}</strong>.</p>`,
      `<p>Evento: <strong>${escapeHtml(input.eventTitle)}</strong>.</p>`,
      "<p>Apri la dashboard capogruppo per confermare l'appartenenza, aggiungere una nota interna o rimandarla al livello superiore.</p>",
      `<p><a href="${escapeHtml(input.dashboardLink)}">Apri la dashboard capogruppo</a></p>`,
      "<p>Grazie.</p>",
    ].join(""),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
