"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DuplicateReviewDialog } from "./review-dialog";
import { DuplicateDeletePanel, ReviewPanel } from "./panels";
import type { DuplicateReview } from "@/lib/data-quality/review";

export function DuplicateReviewLoader({ dashboard }: { dashboard: "admin" | "manager" }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const pair = params.get("duplicatePair");
  if (!pair || params.has("edit")) return null;
  const close = new URLSearchParams(params.toString());
  for (const key of ["duplicatePair", "duplicateAction", "duplicateDelete"]) close.delete(key);
  const action = params.get("duplicateAction");
  return (
    <DuplicateReviewDialog closePath={`${pathname}?${close}`} excluding={action === "exclude"}
      title={action === "delete" ? "Elimina iscrizione" : undefined}>
      <ReviewContent key={`${pair}:${action}:${params.get("duplicateDelete")}`} pair={pair} action={action}
        deleting={params.get("duplicateDelete")} dashboard={dashboard} returnTo={`${pathname}?${close}`} />
    </DuplicateReviewDialog>
  );
}

function ReviewContent({ pair, action, deleting, dashboard, returnTo }: {
  pair: string; action: string | null; deleting: string | null;
  dashboard: "admin" | "manager"; returnTo: string;
}) {
  const [data, setData] = useState<DuplicateReview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/dashboard/participants/data-quality/review?${new URLSearchParams({ pair })}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Confronto non disponibile.");
      if (!controller.signal.aborted) setData(result);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Confronto non disponibile.");
    });
    return () => controller.abort();
  }, [pair, attempt]);
  if (error) return <div className="grid gap-3"><p role="alert">{error}</p>
    <button className="btn-secondary" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Ricarica confronto</button></div>;
  if (!data) return <p role="status" aria-live="polite">Caricamento delle due schede…</p>;
  if (action === "delete") {
    const person = [data.left, data.right].find(person => person.id === deleting);
    return person && data.canWrite ? <DuplicateDeletePanel person={person} dashboard={dashboard} returnTo={returnTo} /> : <p>Eliminazione non disponibile.</p>;
  }
  return <ReviewPanel {...data} excludeOnly={action === "exclude"}
    mode={action === "exclude" ? "exclude" : "compare"} returnTo={returnTo} />;
}
