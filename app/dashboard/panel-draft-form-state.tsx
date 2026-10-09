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
  scheduleConflict: boolean;
  setCapacityExceeded: Dispatch<SetStateAction<boolean>>;
  setScheduleConflict: Dispatch<SetStateAction<boolean>>;
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
  const [scheduleConflict, setScheduleConflict] = useState(false);
  const value = useMemo(
    () => ({
      capacityExceeded,
      scheduleConflict,
      setCapacityExceeded,
      setScheduleConflict,
    }),
    [capacityExceeded, scheduleConflict]
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
  const { capacityExceeded, scheduleConflict } = usePanelDraftFormState();
  const tooltipId = useId();
  const saveBlocked = capacityExceeded || scheduleConflict;
  const blockerMessage = capacityExceeded
    ? scheduleConflict
      ? "La somma dei posti supera la capienza e l'orario si sovrappone a un altro panel. Correggi entrambi i problemi per salvare il panel."
      : "La somma dei posti delle sezioni supera la capienza della location. Riduci i posti assegnati per salvare il panel."
    : "L'orario si sovrappone a un altro panel nella stessa location. Modifica orario o location per salvare il panel.";

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
        tabIndex={saveBlocked ? 0 : undefined}
        aria-describedby={saveBlocked ? tooltipId : undefined}
      >
        <PendingSubmitButton
          disabled={saveBlocked}
          className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#7890a8]"
        >
          {submitLabel}
        </PendingSubmitButton>
        {saveBlocked ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-2 w-72 rounded-md bg-[var(--peace-blue-950)] px-3 py-2 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
          >
            {blockerMessage}
          </span>
        ) : null}
      </span>
    </div>
  );
}
