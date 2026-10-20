/** Numbered Forum titles precede unnumbered titles, independently of start time.
 * Stable ties preserve the existing order of audience sections for the same Forum. */
export function compareForums(left: { title: string }, right: { title: string }): number {
  const number = (title: string) => Number(title.match(/^\s*(?:(?:forum|panel|foro|форум)\s+[^\d–—:\-]*?)?(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return number(left.title) - number(right.title)
    || left.title.localeCompare(right.title, "it", { numeric: true, sensitivity: "base" });
}

export function sortForums<T extends { title: string }>(forums: readonly T[]): T[] {
  return [...forums].sort(compareForums);
}
