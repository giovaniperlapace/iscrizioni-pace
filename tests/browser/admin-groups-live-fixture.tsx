import { AdminGroupsTable } from "@/app/dashboard/admin/admin-groups-table";
export default async function Fixture({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const groups = [
    { id: "1", name: "Assemblea di Trastevere", nodeType: "group", isAssignable: true, isPublicCatalog: true, searchText: "assemblea di trastevere roma mario etichetta" },
    { id: "2", name: "Roma", nodeType: "city", isAssignable: false, isPublicCatalog: false, searchText: "roma" },
    { id: "3", name: "Gruppo riservato", nodeType: "group", isAssignable: true, isPublicCatalog: false, searchText: "gruppo riservato lucia" },
  ];
  return <main className="p-5"><AdminGroupsTable key={JSON.stringify(params)}
    initialFilters={{ q: params.groupQ ?? "", eventId: params.groupEvent ?? "all", nodeType: params.groupType ?? "all", visibility: params.groupVisibility ?? "all" }}
    linkCount={2} rows={groups.map(group => ({ ...group, eventId: "event", content: <tr key={group.id}><td>{group.name}</td><td /><td /><td /><td><button>Modifica</button></td></tr> }))} /></main>;
}
