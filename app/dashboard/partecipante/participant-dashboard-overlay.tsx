"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const CLOSE_ANIMATION_MS = 280;

type OverlayContextValue = {
  scheduleClose: (delayMs: number) => () => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useParticipantDashboardOverlay() {
  return useContext(OverlayContext);
}

export function ParticipantDashboardOverlay({
  closeHref,
  closeLabel,
  children,
}: {
  closeHref: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = useCallback(
    (delayMs: number) => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      closeTimerRef.current = setTimeout(() => {
        setClosing(true);
        navigationTimerRef.current = setTimeout(() => {
          router.replace(closeHref, { scroll: false });
        }, CLOSE_ANIMATION_MS);
      }, delayMs);

      return () => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
        if (navigationTimerRef.current) {
          clearTimeout(navigationTimerRef.current);
        }
      };
    },
    [closeHref, router]
  );

  const contextValue = useMemo(() => ({ scheduleClose }), [scheduleClose]);

  return (
    <OverlayContext.Provider value={contextValue}>
      <div
        className={`dashboard-modal participant-dashboard-overlay fixed inset-0 z-50 grid place-items-center modal-backdrop px-4 py-5 backdrop-blur-sm sm:px-6${
          closing ? " dashboard-modal-closing" : ""
        }`}
      >
        <section
          role="dialog"
          aria-modal="true"
          className="relative mx-auto grid max-h-[calc(100vh-2.5rem)] w-full max-w-4xl gap-5 overflow-y-auto rounded-lg border border-[var(--peace-border)] bg-white p-5 shadow-2xl sm:p-6"
        >
          <Link
            href={closeHref}
            aria-label={closeLabel}
            title={closeLabel}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-[var(--peace-border-strong)] text-xl font-semibold text-[var(--peace-ink)] hover:bg-[var(--peace-sky-100)]"
          >
            ×
          </Link>
          <div className="pr-9">{children}</div>
        </section>
      </div>
    </OverlayContext.Provider>
  );
}
