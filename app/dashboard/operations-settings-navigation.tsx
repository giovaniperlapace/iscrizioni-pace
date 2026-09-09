import Link from "next/link";

export function OperationsSettingsNavigation({
  active,
  navMode,
  canManageEvent,
}: {
  active: "evento" | "servizi";
  navMode: "full" | "mini";
  canManageEvent: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Impostazioni</h2>
      {canManageEvent ? (
        <nav aria-label="Sezioni impostazioni" className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/admin?section=impostazioni&nav=${navMode}`}
            aria-current={active === "evento" ? "page" : undefined}
            className={active === "evento" ? "btn-primary inline-flex items-center justify-center px-4" : "btn-secondary inline-flex items-center justify-center px-4"}
          >
            Gestione evento
          </Link>
          <Link
            href={`/dashboard/manager?section=impostazioni&nav=${navMode}`}
            aria-current={active === "servizi" ? "page" : undefined}
            className={active === "servizi" ? "btn-primary inline-flex items-center justify-center px-4" : "btn-secondary inline-flex items-center justify-center px-4"}
          >
            Catalogo servizi
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
