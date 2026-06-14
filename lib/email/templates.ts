type MagicLinkTemplateInput = {
  actionLink: string;
};

type RegistrationConfirmationInput = {
  firstName: string;
  lastName: string;
  eventTitle: string;
  dashboardLink: string;
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
      "Quando vuoi rientrare nella tua area personale puoi usare il link di accesso dall'app.",
      input.dashboardLink,
      "",
      "Grazie.",
    ].join("\n"),
    html: [
      `<p>Ciao ${escapeHtml(input.firstName)},</p>`,
      `<p>abbiamo ricevuto l'iscrizione di <strong>${escapeHtml(
        participantName
      )}</strong> per <strong>${escapeHtml(input.eventTitle)}</strong>.</p>`,
      "<p>Quando vuoi rientrare nella tua area personale puoi usare il link di accesso dall'app.</p>",
      `<p><a href="${escapeHtml(input.dashboardLink)}">Apri l'app iscrizioni</a></p>`,
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
