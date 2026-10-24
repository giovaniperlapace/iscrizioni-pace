"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { pairKey } from "@/lib/data-quality/duplicates";

const DuplicateListContext = createContext<{
  dismissed: Set<string>;
  dismiss: (left: string, right: string) => void;
} | null>(null);

export function DuplicateListProvider({ children, pendingPairs }: {
  children: ReactNode;
  pendingPairs: string[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  function dismiss(left: string, right: string) {
    const pair = pairKey(left, right);
    if (!pendingPairs.includes(pair)) return;
    setDismissed(previous => previous.has(pair) ? previous : new Set([...previous, pair]));
  }
  return <DuplicateListContext.Provider value={{ dismissed, dismiss }}>
    {dismissed.size > 0 && <p role="status">Persone distinte: segnalazione rimossa dai duplicati da verificare.</p>}
    {children}
  </DuplicateListContext.Provider>;
}

export function useDismissDuplicatePair() {
  return useContext(DuplicateListContext)?.dismiss;
}

export function DuplicatePairRows({ pair, children }: { pair: string; children: ReactNode }) {
  const state = useContext(DuplicateListContext);
  return state?.dismissed.has(pair) ? null : children;
}

export function DuplicateListCount({ value, excluded = false, label = false }: {
  value: number; excluded?: boolean; label?: boolean;
}) {
  const state = useContext(DuplicateListContext);
  const count = value + (excluded ? 1 : -1) * (state?.dismissed.size ?? 0);
  return <>{count}{label ? (count === 1 ? " coppia" : " coppie") : null}</>;
}

export function DuplicateListEmpty({ pairs }: { pairs: string[] }) {
  const state = useContext(DuplicateListContext);
  if (pairs.some(pair => !state?.dismissed.has(pair))) return null;
  return <tr><td colSpan={7} className="p-5 text-[var(--peace-muted)]">
    Nessun caso in questa vista.
  </td></tr>;
}
