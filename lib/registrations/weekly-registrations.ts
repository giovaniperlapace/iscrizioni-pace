export type RegistrationWeek = {
  start: string;
  end: string;
  count: number;
  current: boolean;
  historical?: boolean;
};

const DAY = 86_400_000;
const romeDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
});

function monday(date: Date): number {
  const parts = romeDate.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  return day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY;
}
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);

// Calendar arithmetic uses UTC after converting the timestamp to its Rome date,
// so DST changes never shorten or lengthen the calendar weeks.
export function buildRegistrationWeeks(
  timestamps: Array<string | null | undefined>,
  now = new Date(),
  weeklyFrom?: string,
): { weeks: RegistrationWeek[]; undated: number } {
  const current = monday(now);
  const counts = new Map<number, number>();
  let undated = 0;
  for (const timestamp of timestamps) {
    const date = timestamp ? new Date(timestamp) : null;
    if (!date || !Number.isFinite(date.getTime()) || date > now) {
      undated += 1;
      continue;
    }
    const start = monday(date);
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  if (!counts.size) return { weeks: [], undated };
  const weeks: RegistrationWeek[] = [];
  const first = Math.min(...counts.keys());
  const cutoff = weeklyFrom ? Date.parse(`${weeklyFrom}T00:00:00Z`) : first;
  if (!Number.isFinite(cutoff) || new Date(cutoff).getUTCDay() !== 1) {
    throw new Error("Weekly start must be a valid Monday");
  }
  if (first < cutoff) {
    const count = [...counts].reduce((sum, [start, value]) => sum + (start < cutoff ? value : 0), 0);
    weeks.push({ start: dateKey(first), end: dateKey(cutoff - DAY), count, current: false, historical: true });
  }
  for (let start = cutoff; start <= current; start += 7 * DAY) {
    weeks.push({ start: dateKey(start), end: dateKey(start + 6 * DAY), count: counts.get(start) ?? 0, current: start === current });
  }
  return { weeks, undated };
}
