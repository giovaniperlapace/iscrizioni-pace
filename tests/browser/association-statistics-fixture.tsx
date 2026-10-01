import { StatisticsSection } from "@/app/dashboard/statistics-section";
import { buildEventStatisticsSnapshot } from "@/lib/registrations/event-statistics";
const statistics = buildEventStatisticsSnapshot({ participants: [], groups: [], attendanceChoices: [] });
export default async function Fixture({ searchParams }: { searchParams: Promise<{ dashboard?: string; empty?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto min-w-0 max-w-6xl p-4"><StatisticsSection statistics={statistics} dashboard={params.dashboard === "admin" ? "admin" : "manager"} navMode="full" associationStatistics={{ people: params.empty ? [] : [
    { registrationId: "one", name: "Anna Rossi", association: "Associazione di prova\nTesto dichiarato <script>sicuro</script>", attendance: "24 ott 2026 (Pomeriggio); 25 ott 2026 (Mattina)" },
    { registrationId: "two", name: "Nome non disponibile", association: "Associazione " + "lunga".repeat(50), attendance: "Da comunicare" },
  ] }} /></main>;
}
