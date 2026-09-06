"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";

export function DuplicateReviewDialog({
  children,
  closePath,
  excluding = false,
}: {
  children: ReactNode;
  closePath: string;
  excluding?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="duplicate-dialog-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-xl bg-white p-0 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        router.replace(closePath, { scroll: false });
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
        <h2 id="duplicate-dialog-title" className="text-xl font-semibold">
          {excluding ? "Escludi segnalazione" : "Confronto duplicati"}
        </h2>
        <Link
          href={closePath}
          scroll={false}
          prefetch={false}
          aria-label="Chiudi confronto duplicati"
          className="btn-secondary inline-flex min-h-11 min-w-11 items-center justify-center"
        >
          <X size={18} aria-hidden />
        </Link>
      </header>
      <div className="max-h-[calc(90dvh-6rem)] overflow-y-auto p-4 sm:p-5">
        {excluding && (
          <p className="mb-4 text-sm text-[var(--peace-muted)]">
            Escludi questa coppia dai possibili duplicati solo se si tratta di
            persone distinte. Indica il motivo dopo aver confrontato le schede.
            Entrambe le iscrizioni resteranno attive.
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
