import { calculateAge } from "./event-statistics.ts";
import type { OperationsParticipantRow } from "./operations-types.ts";

export function buildChildrenOverview(
  participants: OperationsParticipantRow[],
  eventId: string | null,
  eventStartsOn: string | null,
) {
  const active = participants.filter(
    (row) => !row.deletedAt && eventId !== null && row.eventId === eventId,
  );
  const children = active.flatMap((parent) =>
    parent.children.map((child) => ({
      id: `${parent.registrationId}:${child.id}`,
      name: `${child.first_name} ${child.last_name}`.trim(),
      birthDate: child.birth_date,
      age: calculateAge(child.birth_date, eventStartsOn),
      parent,
    })),
  ).sort((a, b) =>
    (a.parent.name ?? "").localeCompare(b.parent.name ?? "", "it") ||
    a.parent.registrationId.localeCompare(b.parent.registrationId) ||
    a.name.localeCompare(b.name, "it") ||
    a.id.localeCompare(b.id),
  );
  const independent = active.flatMap((participant) => {
    const age = calculateAge(participant.birthDate, eventStartsOn);
    return age !== null && age < 15 ? [{ participant, age }] : [];
  });
  return {
    children,
    independent,
    parentsCount: new Set(children.map((child) => child.parent.registrationId))
      .size,
    childrenUnder15: children.filter(
      (child) => child.age !== null && child.age < 15,
    ).length,
    unknownAges: active.filter(
      (row) => calculateAge(row.birthDate, eventStartsOn) === null,
    ).length,
  };
}
