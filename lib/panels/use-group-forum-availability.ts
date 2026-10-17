"use client";
import { useEffect, useState } from "react";
import type { GroupPanelView } from "./group-bookings";

export function useGroupForumAvailability(initialView: GroupPanelView, sectionId: string | null, paused: boolean) {
  const [snapshot, setSnapshot] = useState<{ source: GroupPanelView; view: GroupPanelView; error: "failed" | "forbidden" | null }>({ source: initialView, view: initialView, error: null });
  useEffect(() => {
    if (paused) return;
    let pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/dashboard/capogruppo/panel/availability${sectionId ? `?section=${encodeURIComponent(sectionId)}` : ""}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (response.redirected || response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) {
            setSnapshot({ source: initialView, view: { panels: [], participants: [] }, error: "forbidden" });
          }
          return;
        }
        if (!response.ok) throw new Error("Forum availability failed");
        const data = await response.json();
        if (!Array.isArray(data.view?.panels) || !Array.isArray(data.view?.participants)) throw new Error("Invalid Forum availability");
        if (!controller.signal.aborted) {
          setSnapshot({ source: initialView, view: data.view, error: null });
        }
      } catch {
        if (!controller.signal.aborted) setSnapshot(previous => ({ source: initialView, view: previous.source === initialView ? previous.view : initialView, error: "failed" }));
      } finally { pending = false; }
    }
    const timer = window.setInterval(() => { void refresh(); }, 5 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [initialView, sectionId, paused]);
  return { view: snapshot.source === initialView ? snapshot.view : initialView, error: snapshot.source === initialView ? snapshot.error : null };
}
