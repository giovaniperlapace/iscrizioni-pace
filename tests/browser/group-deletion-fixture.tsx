"use client";
import { GroupDeleteButton } from "@/app/dashboard/group-delete-button";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { GroupDeletionResult } from "@/lib/groups/deletion";

export async function manageGroupDeletion(_id: string, expected?: string): Promise<GroupDeletionResult> {
  const params = new URLSearchParams(window.location.search);
  document.body.dataset.calls = String(Number(document.body.dataset.calls ?? 0) + 1);
  await new Promise(resolve => setTimeout(resolve, 100));
  if (expected && params.get("scenario") === "conflict") return { error: "conflict" };
  if (params.get("scenario") === "error") return { error: "failed" };
  if (expected) { document.body.dataset.deleted = "true"; return { deleted: true }; }
  return { preview: { name: "Gruppo esempio Roma", expected: "a".repeat(32), children: params.get("scenario") === "children" ? 2 : 0, assignments: 1205, currentAssignments: 1001, memberships: 2, links: 1, rules: 0 } };
}
export default function Fixture({ locale }: { locale: SupportedLocale }) {
  const [filter, setFilter] = useState("Roma");
  return <main className="p-6"><h1 className="text-xl">Gruppi</h1><form className="mt-4 grid gap-4" onChange={() => { document.body.dataset.filterChanged = "true"; }} onSubmit={e => { e.preventDefault(); document.body.dataset.submitted = "true"; }}>
    <label>Filtro<input className="field" value={filter} onChange={e => setFilter(e.target.value)} /></label>
    <GroupDeleteButton groupId="11111111-1111-4111-8111-111111111111" groupName="Gruppo esempio Roma" locale={locale} />
  </form></main>;
}
