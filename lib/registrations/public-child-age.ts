/** Inclusive birth-date bounds for accompanied minors (age today, not at the event). */
export function publicChildBirthDateBounds(today = new Date().toISOString().slice(0, 10)) {
  const [year, month, day] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year - 18, month - 1, day));
  // On 29 February the non-leap cutoff rolls to 1 March, already the first
  // allowed birthday. Otherwise the eighteenth birthday itself is excluded.
  if (cutoff.getUTCMonth() === month - 1) {
    cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  }
  return { min: cutoff.toISOString().slice(0, 10), max: today };
}
