"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  title,
  children,
}: {
  closeHref: string;
  closeLabel: string;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
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
      <dialog
        ref={dialogRef}
        aria-label={title}
        onCancel={event => { event.preventDefault(); router.replace(closeHref, { scroll: false }); }}
        className={`participant-dashboard-overlay fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm sm:p-7${closing ? " dashboard-modal-closing" : ""}`}
      >
        <button
          type="button"
          onClick={() => router.replace(closeHref, { scroll: false })}
          aria-label={closeLabel}
          title={closeLabel}
          className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full text-[var(--peace-muted)] transition hover:bg-[var(--peace-sky-100)] focus-visible:outline-2"
        >
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </dialog>
    </OverlayContext.Provider>
  );
}
