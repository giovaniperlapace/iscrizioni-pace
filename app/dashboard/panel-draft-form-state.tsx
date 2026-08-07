"use client";

import Link from "next/link";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";

type PanelDraftFormState = {
  capacityExceeded: boolean;
  setCapacityExceeded: Dispatch<SetStateAction<boolean>>;
};

const PanelDraftFormContext = createContext<PanelDraftFormState | null>(null);

export function PanelDraftFormProvider({
  children,
  initialCapacityExceeded,
}: {
  children: ReactNode;
  initialCapacityExceeded: boolean;
}) {
  const [capacityExceeded, setCapacityExceeded] = useState(
    initialCapacityExceeded
  );
  const value = useMemo(
    () => ({ capacityExceeded, setCapacityExceeded }),
    [capacityExceeded]
  );

  return (
    <PanelDraftFormContext.Provider value={value}>
      {children}
    </PanelDraftFormContext.Provider>
  );
}

export function usePanelDraftFormState() {
  const context = useContext(PanelDraftFormContext);

  if (!context) {
    throw new Error(
      "usePanelDraftFormState must be used inside PanelDraftFormProvider"
    );
  }

  return context;
}

export function PanelDraftFormActions({
  closePath,
  submitLabel,
}: {
  closePath: string;
  submitLabel: string;
}) {
  const { capacityExceeded } = usePanelDraftFormState();
  const tooltipId = useId();

  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--peace-border)] px-5 py-4">
      <Link
        href={closePath}
        scroll={false}
        className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold"
      >
        Annulla
      </Link>
      <span
        className="group relative inline-flex"
        tabIndex={capacityExceeded ? 0 : undefined}
        aria-describedby={capacityExceeded ? tooltipId : undefined}
      >
        <PendingSubmitButton
          disabled={capacityExceeded}
          className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#7890a8]"
        >
          {submitLabel}
        </PendingSubmitButton>
        {capacityExceeded ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-2 w-72 rounded-md bg-[var(--peace-blue-950)] px-3 py-2 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
          >
            La somma dei posti delle sezioni supera la capienza della location.
            Riduci i posti assegnati per salvare il panel.
          </span>
        ) : null}
      </span>
    </div>
  );
}
