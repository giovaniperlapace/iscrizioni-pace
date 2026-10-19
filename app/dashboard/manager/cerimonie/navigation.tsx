import { ArrowLeft, CalendarDays, LayoutGrid, MapPin, Users } from "lucide-react";
import Link from "@/components/pending-link";
import { ceremonyTitles, type CeremonyKind } from "@/lib/ceremonies/contracts";

const sections = [
  { key: "preparation", label: "1. Preparazione e quote", path: "", Icon: MapPin },
  { key: "people", label: "2. Assegnazioni alle persone", path: "/distribuzione", Icon: Users },
  { key: "map", label: "3. Posti numerati", path: "/mappa", Icon: LayoutGrid },
] as const;

export function CeremonyNavigation({ eventTitle, dashboard, kind, active }: {
  eventTitle: string;
  dashboard: "admin" | "manager";
  kind: CeremonyKind;
  active: typeof sections[number]["key"];
}) {
  const path = sections.find(section => section.key === active)!.path;
  return <header className="surface-card min-w-0 p-5 sm:p-6">
    <Link prefetch={false} href={`/dashboard/${dashboard}?section=panel`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--peace-blue-800)]">
      <ArrowLeft className="size-4" aria-hidden="true" />Torna ai Forum
    </Link>
    <p className="mt-3 text-sm text-[var(--peace-muted)]">{eventTitle}</p>
    <h1 className="mt-1 text-2xl font-semibold">Cerimonie</h1>
    <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">Scegli la cerimonia, prepara i posti disponibili e poi assegnali alle persone. La numerazione dei posti è facoltativa.</p>
    <nav aria-label="Scegli la cerimonia" className="mt-5 flex max-w-full flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--peace-border)] bg-white p-1.5 sm:w-fit">
      {(["opening", "closing"] as const).map(value => <Link key={value} prefetch={false} href={`/dashboard/manager/cerimonie${path}?kind=${value}`} aria-current={kind === value ? "page" : undefined}
        className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-semibold sm:flex-none ${kind === value ? "bg-[var(--peace-blue-800)] text-white shadow-sm" : "text-[var(--peace-muted)] hover:bg-[var(--peace-sky-100)] hover:text-[var(--peace-blue-900)]"}`}>
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />{ceremonyTitles[value]}
      </Link>)}
    </nav>
    <nav aria-label="Fasi delle cerimonie" className="mt-5 flex flex-col gap-1 border-b border-[var(--peace-border)] sm:flex-row sm:flex-wrap">
      {sections.map(({ key, label, path, Icon }) => <Link key={key} prefetch={false} href={`/dashboard/manager/cerimonie${path}?kind=${kind}`} aria-current={active === key ? "page" : undefined}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active === key ? "border-[var(--peace-blue-800)] text-[var(--peace-blue-800)]" : "border-transparent text-[var(--peace-muted)] hover:text-[var(--peace-blue-800)]"}`}>
        <Icon className="size-4" aria-hidden="true" />{label}
      </Link>)}
    </nav>
  </header>;
}
