type MagicLinkTemplateInput = {
  actionLink: string;
};

type RegistrationConfirmationInput = {
  firstName: string;
  lastName: string;
  participantCode: string;
  eventTitle: string;
  siteLink: string;
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
      "Puoi entrare nella tua dashboard tornando al sito dell'iscrizione e inserendo la stessa email usata per registrarti. Riceverai un link personale di accesso per riaprire e aggiornare la tua scheda.",
      input.siteLink,
      "",
      "Più avanti, quando sarà pubblicato il programma completo, dalla dashboard potrai anche scegliere i momenti a cui partecipare e scaricare il QR code per l'ingresso all'evento.",
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
      "<p>Puoi entrare nella tua dashboard tornando al sito dell'iscrizione e inserendo la stessa email usata per registrarti. Riceverai un link personale di accesso per riaprire e aggiornare la tua scheda.</p>",
      `<p><a href="${escapeHtml(input.siteLink)}">Apri il sito iscrizioni</a></p>`,
      "<p>Più avanti, quando sarà pubblicato il programma completo, dalla dashboard potrai anche scegliere i momenti a cui partecipare e scaricare il QR code per l'ingresso all'evento.</p>",
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
