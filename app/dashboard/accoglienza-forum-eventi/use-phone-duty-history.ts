"use client";
import { useCallback, useRef, useSyncExternalStore } from "react";

const marker = "paceReceptionDuty";
const serverSnapshot = () => null;

// One same-document history entry per selected duty. No QR/person data in history.
export function usePhoneDutyHistory({ enabled, eventId, canSelect, isBlocked }: {
  enabled: boolean;
  eventId: string;
  canSelect: (key: string) => boolean;
  isBlocked: () => boolean;
}) {
  const notify = useRef<(() => void) | null>(null);
  const activeKey = useRef<string | null>(null);
  const stationUrl = useRef<string | null>(null);
  const returning = useRef(false);
  const read = useCallback((): string | null => {
    if (!enabled) return null;
    const entry = window.history.state?.[marker];
    return entry?.eventId === eventId && entry.url === window.location.href && typeof entry.key === "string" ? entry.key : null;
  }, [enabled, eventId]);
  const write = useCallback((key: string | null, push: boolean) => {
    const state = { ...window.history.state };
    if (key === null) delete state[marker];
    else state[marker] = { eventId, url: window.location.href, key };
    window.history[push ? "pushState" : "replaceState"](state, "");
  }, [eventId]);
  const subscribe = useCallback((listener: () => void) => {
    if (!enabled) return () => {};
    notify.current = listener;
    stationUrl.current = window.location.href;
    const restored = read();
    if (restored && !canSelect(restored)) write(null, false);
    activeKey.current = read();
    function onPop() {
      if (window.location.href !== stationUrl.current) return;
      returning.current = false;
      if (activeKey.current && isBlocked()) {
        // Restore the single duty entry, retaining the mounted operation and its retry ID.
        write(activeKey.current, true);
      } else {
        const target = read();
        if (target && !canSelect(target)) write(null, false);
        activeKey.current = read();
      }
      listener();
    }
    window.addEventListener("popstate", onPop);
    return () => {
      notify.current = null;
      window.removeEventListener("popstate", onPop);
    };
  }, [enabled, read, write, canSelect, isBlocked]);
  const selected = useSyncExternalStore(subscribe, read, serverSnapshot);
  const select = useCallback((key: string) => {
    if (!enabled || returning.current || isBlocked() || !canSelect(key) || read() === key) return;
    write(key, true);
    activeKey.current = key;
    notify.current?.();
  }, [enabled, isBlocked, canSelect, read, write]);
  const back = useCallback(() => {
    if (!enabled || returning.current || isBlocked() || read() === null) return;
    returning.current = true;
    window.history.back();
  }, [enabled, isBlocked, read]);
  return { selected, select, back };
}
