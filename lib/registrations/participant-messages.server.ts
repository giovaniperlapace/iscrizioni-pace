export const PARTICIPANT_MESSAGE_RECIPIENT =
  "registrationspeace@santegidio.org";

export type ParticipantOrganizerMessageEmailInput = {
  firstName: string;
  lastName: string;
  groupName: string | null;
  participantId: string;
  email: string | null;
  message: string;
};

export function renderParticipantOrganizerMessageEmail(
  input: ParticipantOrganizerMessageEmailInput
): { subject: string; text: string; html: string } {
  const firstName = normalizeHeaderValue(input.firstName) || "Participant";
  const lastName = normalizeHeaderValue(input.lastName);
  const participantName = [firstName, lastName].filter(Boolean).join(" ");
  const groupName = input.groupName?.trim() || "Not assigned";
  const participantEmail = input.email?.trim() || "Not provided";

  return {
    subject: `Participant Message - ${participantName}`,
    text: [
      "Participant details",
      `Participant name: ${firstName}`,
      `Participant surname: ${lastName || "Not provided"}`,
      `Participant group: ${groupName}`,
      `Participant ID: ${input.participantId}`,
      `Participant email: ${participantEmail}`,
      "",
      "Message",
      input.message,
    ].join("\n"),
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45;color:#222222;">',
      '<h2 style="margin:0 0 16px;font-size:22px;line-height:1.25;">Participant details</h2>',
      renderDetailLine("Participant name", firstName),
      renderDetailLine("Participant surname", lastName || "Not provided"),
      renderDetailLine("Participant group", groupName),
      renderDetailLine("Participant ID", input.participantId),
      renderDetailLine(
        "Participant email",
        participantEmail,
        input.email?.trim() ? `mailto:${participantEmail}` : null
      ),
      '<h2 style="margin:24px 0 8px;font-size:22px;line-height:1.25;">Message</h2>',
      `<p style="margin:0;">${escapeHtml(input.message).replaceAll(
        "\n",
        "<br />"
      )}</p>`,
      "</div>",
    ].join(""),
  };
}

function renderDetailLine(
  label: string,
  value: string,
  href: string | null = null
): string {
  const escapedValue = escapeHtml(value);
  const renderedValue = href
    ? `<a href="${escapeHtml(href)}" style="color:#0b57d0;text-decoration:underline;">${escapedValue}</a>`
    : escapedValue;

  return `<p style="margin:0 0 4px;"><strong>${escapeHtml(
    label
  )}:</strong> ${renderedValue}</p>`;
}

function normalizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
