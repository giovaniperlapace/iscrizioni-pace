import { StatisticsSection } from "@/app/dashboard/statistics-section";
import { buildEventStatisticsSnapshot } from "@/lib/registrations/event-statistics";
import { accessibilitySummary, declaredAccessibilityDifficulties } from "@/lib/registrations/accessibility-summary";
const groups = [
  { id: "it", name: "Italia", nodeType: "country", parentGroupId: null },
  { id: "roma", name: "Roma", nodeType: "city", parentGroupId: "it" },
  { id: "g1", name: "Gruppo di prova", nodeType: "group", parentGroupId: "roma" },
].map(g => ({ ...g, eventId: "test", isAssignable: true }));
const statistics = buildEventStatisticsSnapshot({ groups, attendanceChoices: [], participants: [
  { registrationId: "p1", name: "Anna Esempio", currentGroupId: "g1", currentGroupName: "Gruppo di prova" },
  { registrationId: "p2", name: "Bruno Esempio", currentGroupId: "roma", currentGroupName: "Roma" },
  { registrationId: "p3", name: "Carla Esempio", currentGroupId: null, currentGroupName: null },
].map(p => ({ ...p, eventId: "test", eventTitle: "Evento di prova", country: null, city: null })) });
const disabilityStatistics = { people: statistics.people.map(p => ({ ...p, difficultyKeys: declaredAccessibilityDifficulties(p.registrationId === "p1" ? { hearing: true, walkingOrSteps: true } : { wheelchairOrMobilityAid: true }).map(item => item.key), declaredDifficulties: accessibilitySummary(p.registrationId === "p1" ? { hearing: true, walkingOrSteps: true } : { wheelchairOrMobilityAid: true }) })) };
export default async function Fixture({ searchParams }: { searchParams: Promise<{ dashboard?: string }> }) {
  const { dashboard } = await searchParams;
  return <main className="mx-auto min-w-0 max-w-6xl p-4"><StatisticsSection statistics={statistics} report="disability" canViewDisability disabilityStatistics={disabilityStatistics} dashboard={dashboard === "admin" ? "admin" : "manager"} navMode="mini" /></main>;
}
