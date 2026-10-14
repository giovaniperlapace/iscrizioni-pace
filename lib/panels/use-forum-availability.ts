"use client";

import { useEffect, useState } from "react";
import type { ParticipantPanelCatalogRow } from "@/app/dashboard/partecipante/participant-panel-bookings";

export const FORUM_AVAILABILITY_INTERVAL_MS = 5 * 60 * 1000;

export function useForumAvailability(registrationId: string, initialRows: ParticipantPanelCatalogRow[]) {
  const [snapshot, setSnapshot] = useState({ source: initialRows, rows: initialRows });
  const [error, setError] = useState<"failed" | "forbidden" | null>(null);
  useEffect(() => {
    let pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/dashboard/partecipante/forum-availability?registrationId=${encodeURIComponent(registrationId)}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (response.redirected || response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) {
            setSnapshot({ source: initialRows, rows: [] });
            setError("forbidden");
          }
          return;
        }
        if (!response.ok) throw new Error("Forum availability read failed");
        const data = await response.json();
        if (!Array.isArray(data.rows)) throw new Error("Invalid Forum availability response");
        if (!controller.signal.aborted) {
          setSnapshot({ source: initialRows, rows: data.rows });
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) setError("failed");
      } finally { pending = false; }
    }
    // The server already provided the initial catalog. Only this view refreshes every five minutes.
    const timer = window.setInterval(() => { void refresh(); }, FORUM_AVAILABILITY_INTERVAL_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [registrationId, initialRows]);
  return { rows: snapshot.source === initialRows ? snapshot.rows : initialRows, error };
}
