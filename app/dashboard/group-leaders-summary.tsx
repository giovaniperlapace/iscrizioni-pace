import type { GroupLeaderSummary } from "@/lib/groups/leader-summary";

export function GroupLeadersSummary({ leaders, legacyName }: {
  leaders: GroupLeaderSummary[];
  legacyName: string | null;
}) {
  if (leaders.length === 0) return <span>{legacyName?.trim() || "Da assegnare"}</span>;

  const primary = leaders.filter((leader) => leader.isPrimary);
  const secondary = leaders.filter((leader) => !leader.isPrimary);
  return (
    <div className="grid max-w-xs gap-1 break-words leading-5">
      {primary.length > 0 ? (
        <p>
          <span className="text-xs text-[var(--peace-muted)]">{primary.length === 1 ? "Principale: " : "Principali: "}</span>
          {primary.map((leader) => leader.name).join(" · ")}
        </p>
      ) : null}
      {secondary.length > 0 ? (
        <p className="text-xs text-[var(--peace-muted)]">
          <span>{secondary.length === 1 ? "Secondario: " : "Secondari: "}</span>
          {secondary.map((leader) => leader.name).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
