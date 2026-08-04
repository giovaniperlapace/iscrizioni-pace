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
      `Name: ${firstName}`,
      `Surname: ${lastName || "Not provided"}`,
      `Group: ${groupName}`,
      `ID: ${input.participantId}`,
      `Mail: ${participantEmail}`,
      "",
      "Message",
      input.message,
    ].join("\n"),
    html: [
      "<h2>Participant details</h2>",
      "<dl>",
      `<dt><strong>Name</strong></dt><dd>${escapeHtml(firstName)}</dd>`,
      `<dt><strong>Surname</strong></dt><dd>${escapeHtml(
        lastName || "Not provided"
      )}</dd>`,
      `<dt><strong>Group</strong></dt><dd>${escapeHtml(groupName)}</dd>`,
      `<dt><strong>ID</strong></dt><dd>${escapeHtml(input.participantId)}</dd>`,
      `<dt><strong>Mail</strong></dt><dd>${escapeHtml(participantEmail)}</dd>`,
      "</dl>",
      "<h2>Message</h2>",
      `<p>${escapeHtml(input.message).replaceAll("\n", "<br />")}</p>`,
    ].join(""),
  };
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
