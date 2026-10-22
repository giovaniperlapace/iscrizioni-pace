"use client";
import type {
  SectorDirectoryQuery,
  SectorReadResult,
} from "@/lib/ceremonies/sector-desk";
export async function readCeremonySector(
  query: SectorDirectoryQuery,
): Promise<SectorReadResult> {
  const params = new URLSearchParams({
    planId: query.planId,
    groupId: query.groupId ?? "",
    withoutGroup: String(query.withoutGroup),
    search: query.search,
    page: String(query.page),
  });
  const response = await fetch(`/dashboard/ceremonies/sectors?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("unavailable");
  return response.json();
}
