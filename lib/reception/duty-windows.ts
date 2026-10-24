import type { DutyOption } from "./event-duties.ts";

export function dutyWindow(duty: DutyOption) {
  const from = Date.parse(duty.availableFrom ?? "");
  const until = Date.parse(duty.availableUntil ?? "");
  return Number.isFinite(from) && Number.isFinite(until) && until > from ? { from, until } : null;
}

export function isDutyAvailable(duty: DutyOption, now: number) {
  if (duty.key === "registration_check" && duty.kind === "verification") return true;
  const window = dutyWindow(duty);
  return !!window && now >= window.from && now < window.until;
}

export function nextDutyWindow(choices: DutyOption[], now: number) {
  return choices.flatMap(duty => {
    const window = dutyWindow(duty);
    return window && window.from > now ? [{ duty, from: window.from }] : [];
  }).sort((a, b) => a.from - b.from)[0] ?? null;
}

export function nextDutyBoundary(choices: DutyOption[], now: number) {
  const boundaries = choices.flatMap(duty => {
    const window = dutyWindow(duty);
    return window ? [window.from, window.until].filter(time => time > now) : [];
  });
  return boundaries.length ? Math.min(...boundaries) : null;
}

export function formatDutyWindowTime(time: number) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(time);
}
