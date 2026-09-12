const dateFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

export function formatDuplicateRegistrationDate(value?: string | null) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? dateFormat.format(timestamp) : "—";
}
