"use client";

import type { getOperationalAccessibility, getOperationalAssociation, getOperationalDemographics } from "./operational-registration-actions";
import type { ReceptionResult } from "@/lib/reception/contracts";
import type { LabelResult } from "@/lib/reception/qr-labels";

// Initial reads must not use the Server Action navigation protocol: a refreshed
// auth cookie can otherwise rerender/scroll the dashboard behind the open sheet.
async function read<T>(kind: string, registrationId: string, extra: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ kind, registrationId, ...extra });
  const response = await fetch(`/dashboard/participants/sheet?${query}`, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Participant sheet read failed");
  }
  return response.json() as Promise<T>;
}

export const readOperationalDemographics = (id: string) => read<Awaited<ReturnType<typeof getOperationalDemographics>>>("demographics", id);
export const readOperationalAssociation = (id: string) => read<Awaited<ReturnType<typeof getOperationalAssociation>>>("association", id);
export const readOperationalAccessibility = (id: string) => read<Awaited<ReturnType<typeof getOperationalAccessibility>>>("accessibility", id);
export const readParticipantReception = (eventId: string, id: string, code: string) => read<ReceptionResult>("reception", id, { eventId, code });
export const readParticipantLabels = (id: string) => read<LabelResult>("labels", id);
