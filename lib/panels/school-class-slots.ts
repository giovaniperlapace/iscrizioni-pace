type SchoolPanelTime = { startsAt: string; endsAt: string };

// Same rule as app.panel_slot_key: Rome calendar day, morning before 12:00.
export function schoolPanelSlot(startsAt: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(startsAt));
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}:${Number(value("hour")) < 12 ? "morning" : "afternoon"}`;
}

export function schoolPanelsConflict(a: SchoolPanelTime, b: SchoolPanelTime): boolean {
  return schoolPanelSlot(a.startsAt) === schoolPanelSlot(b.startsAt)
    || (Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt));
}
