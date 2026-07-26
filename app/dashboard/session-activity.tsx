"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/auth/session-persistence";

const ACTIVITY_SYNC_INTERVAL_MS = 60_000;

export function SessionActivity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSyncRef = useRef(0);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncActivity = useCallback(async (force = false) => {
    const now = Date.now();

    if (!force && now - lastSyncRef.current < ACTIVITY_SYNC_INTERVAL_MS) {
      return;
    }

    lastSyncRef.current = now;
    const path = `${window.location.pathname}${window.location.search}`;
    const response = await fetch("/api/auth/activity", {
      method: "POST",
      body: JSON.stringify({ path }),
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => null);

    if (response?.status === 401) {
      window.location.replace("/login?error=inactive");
    }
  }, []);

  const scheduleAutomaticLogout = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = setTimeout(() => {
      void syncActivity(true);
    }, SESSION_IDLE_TIMEOUT_MS);
  }, [syncActivity]);

  useEffect(() => {
    void syncActivity(true);
    scheduleAutomaticLogout();
  }, [pathname, searchParams, scheduleAutomaticLogout, syncActivity]);

  useEffect(() => {
    const recordActivity = () => {
      scheduleAutomaticLogout();
      void syncActivity();
    };
    const events: Array<keyof WindowEventMap> = [
      "keydown",
      "pointerdown",
      "scroll",
      "touchstart",
    ];

    for (const event of events) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, recordActivity);
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, [scheduleAutomaticLogout, syncActivity]);

  return null;
}
