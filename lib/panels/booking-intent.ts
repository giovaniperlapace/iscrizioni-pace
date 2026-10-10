export function parseForumIntent(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export function forumBookingPath(value: unknown): string {
  const forum = parseForumIntent(value);
  return forum ? `/dashboard/partecipante?forum=${forum}#forum-${forum}` : "/dashboard/partecipante";
}

export function withForumIntent(path: string, value: unknown): string {
  const forum = parseForumIntent(value);
  if (!forum) return path;
  const url = new URL(path, "https://local.invalid");
  url.searchParams.set("forum", forum);
  return `${url.pathname}${url.search}${url.hash}`;
}
