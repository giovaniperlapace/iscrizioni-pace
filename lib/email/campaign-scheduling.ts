export const DAILY_CAMPAIGN_SEND_LIMIT = 300;
export const CAMPAIGN_TIME_ZONE = "Europe/Rome";

export type ScheduledCampaignRecipient = {
  recipientKey: string;
  scheduledFor: string;
};

export function getCampaignLocalDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: CAMPAIGN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function buildDailyRecipientSchedule(
  recipientKeys: Iterable<string>,
  reservedByDate: ReadonlyMap<string, number>,
  startDate = getCampaignLocalDate()
): ScheduledCampaignRecipient[] {
  const reservations = new Map(reservedByDate);
  const schedule: ScheduledCampaignRecipient[] = [];
  let date = startDate;

  for (const recipientKey of recipientKeys) {
    while ((reservations.get(date) ?? 0) >= DAILY_CAMPAIGN_SEND_LIMIT) {
      date = addIsoDays(date, 1);
    }

    schedule.push({ recipientKey, scheduledFor: date });
    reservations.set(date, (reservations.get(date) ?? 0) + 1);
  }

  return schedule;
}

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
