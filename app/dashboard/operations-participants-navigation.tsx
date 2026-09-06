"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, UserRoundSearch, Users } from "lucide-react";

export function OperationsParticipantsNavigation({
  dashboard,
  navMode,
}: {
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  return (
    <nav
      aria-label="Sezioni partecipanti"
      className="sticky top-3 z-20 flex flex-wrap gap-2 rounded-xl border border-[var(--peace-border)] bg-white p-2"
    >
      {[
        { key: "all", label: "Partecipanti", icon: Users },
        { key: "duplicates", label: "Duplicati", icon: Copy },
        { key: "without-group", label: "Senza gruppo", icon: UserRoundSearch },
      ].map(({ key, label, icon: Icon }) => {
        const active =
          key === "all"
            ? view !== "duplicates" && view !== "without-group"
            : view === key;
        const params = new URLSearchParams(searchParams.toString());
        params.set("section", "iscritti");
        params.set("nav", navMode);
        if (key === "all") params.delete("view");
        else params.set("view", key);
        // Each queue starts complete, without hidden filters from another view.
        for (const param of [
          "edit",
          "import",
          "q",
          "contact",
          "group",
          "service",
          "tag",
          "status",
          "stat",
          "duplicatePair",
          "duplicateShow",
          "duplicatePage",
          "duplicateAction",
        ])
          params.delete(param);
        return (
          <Link
            key={key}
            href={`/dashboard/${dashboard}?${params}`}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${active ? "bg-[var(--peace-blue-800)] text-white" : "text-[var(--peace-muted)] hover:bg-[var(--peace-sky-100)] hover:text-[var(--peace-blue-800)]"}`}
          >
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
