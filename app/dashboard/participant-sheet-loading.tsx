"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ParticipantSheetSection = "qr" | "reception" | "attendance" | "demographics" | "association" | "accessibility" | "presence";
export const ParticipantSheetLoadingContext = createContext<((section: ParticipantSheetSection) => void) | null>(null);

// Only the initial read participates. Later saves/refreshes must keep the form
// mounted and visible, including any fields the operator has not saved yet.
export function useParticipantSheetSection(section: ParticipantSheetSection, settled: boolean) {
  const complete = useContext(ParticipantSheetLoadingContext);
  useEffect(() => { if (settled) complete?.(section); }, [complete, section, settled]);
}

export function useParticipantSheetPreparation(required: readonly ParticipantSheetSection[]) {
  const key = required.join(",");
  const [state, setState] = useState<{ done: ParticipantSheetSection[]; ready: boolean }>(() => ({ done: [], ready: required.length === 0 }));
  const [expired, setExpired] = useState(false);
  const complete = useCallback((section: ParticipantSheetSection) => {
    setState(previous => {
      if (previous.ready || previous.done.includes(section)) return previous;
      const done = [...previous.done, section];
      return { done, ready: key.split(",").every(value => done.includes(value as ParticipantSheetSection)) };
    });
  }, [key]);
  const ready = state.ready || required.every(section => state.done.includes(section));
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setExpired(true), 25_000);
    return () => window.clearTimeout(timer);
  }, [ready]);
  return { ready: ready && !expired, expired, complete };
}
