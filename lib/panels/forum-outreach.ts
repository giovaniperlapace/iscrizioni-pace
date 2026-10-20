export type ForumOutreach = "without_forum" | "waiting_without_booking";
export function parseForumOutreach(value: unknown): ForumOutreach | null {
  return value === "without_forum" || value === "waiting_without_booking" ? value : null;
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
