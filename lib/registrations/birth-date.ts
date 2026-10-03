/** Calendar date, including today, with no invented age or lower age limit. */
export function isValidBirthDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10);
}

export function birthDateNeedsReview(value: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!value || !isValidBirthDate(value)) return false;
  const firstBirthday = `${Number(value.slice(0, 4)) + 1}`.padStart(4, "0") + value.slice(4);
  return firstBirthday > today;
}
