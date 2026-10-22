export type ForumOutreach = "without_forum" | "waiting_without_booking" | "panel_confirmed" | "panel_waiting" | "panel_both";
export function parseForumOutreach(value: unknown): ForumOutreach | null {
  return value === "without_forum" || value === "waiting_without_booking" || value === "panel_confirmed" || value === "panel_waiting" || value === "panel_both" ? value : null;
}
export function findPeopleWithoutForum(
  registrations: { id: string; registration_children: { id: string }[] | null }[],
  choices: { registrationId: string; choice: string; registrationStatus: string; sectionId: string | null; selectedChildIds?: string[] }[],
) {
  const booked = new Set<string>();
  for (const choice of choices) {
    if (choice.choice !== "yes" || !choice.sectionId || !["submitted", "confirmed"].includes(choice.registrationStatus)) continue;
    booked.add(`adult:${choice.registrationId}`);
    for (const id of choice.selectedChildIds ?? []) booked.add(`child:${choice.registrationId}:${id}`);
  }
  const missing = new Set<string>();
  const registrationIds = new Set<string>();
  for (const registration of registrations) {
    const people = [`adult:${registration.id}`, ...(registration.registration_children ?? []).map(child => `child:${registration.id}:${child.id}`)];
    for (const person of people) if (!booked.has(person)) { missing.add(person); registrationIds.add(registration.id); }
  }
  return { peopleCount: missing.size, registrationIds };
}

export function findPanelCampaignTargets(
  panelId: string, mode: ForumOutreach,
  choices: { panelId: string; registrationId: string; choice: string; sectionId: string | null; registrationStatus: string }[],
  queue: { panel_id: string; registration_id: string; status: string; expires_at: string | null; registrations: { status: string; deleted_at: string | null } }[],
  now = Date.now(),
) {
  const ids = new Set<string>();
  if (mode !== "panel_waiting") for (const choice of choices) {
    if (choice.panelId === panelId && choice.choice === "yes" && choice.sectionId && ["submitted", "confirmed"].includes(choice.registrationStatus)) ids.add(choice.registrationId);
  }
  if (mode !== "panel_confirmed") for (const row of queue) {
    if (row.panel_id === panelId && row.registrations && !row.registrations.deleted_at && ["submitted", "confirmed"].includes(row.registrations.status) &&
      (row.status === "waiting" || (row.status === "offered" && Date.parse(row.expires_at ?? "") > now))) ids.add(row.registration_id);
  }
  return ids;
}
