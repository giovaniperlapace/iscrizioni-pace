"use client";

import { useEffect, useRef, type ComponentProps } from "react";

// Decorative estimated progress, not a measured percentage. Only the real
// pending state can finish it; no timer releases controls or submits anything.
export function ButtonProgress({ pending, failed = false }: { pending: boolean; failed?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef<number | null>(null);

  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;

    if (pending) {
      if (started.current === null) {
        started.current = performance.now();
        overlay.dataset.state = "reset";
        overlay.style.transform = "scaleX(0)";
        // Commit the reset before a new attempt, including a rapid retry.
        void overlay.offsetWidth;
      }
      overlay.dataset.state = "pending";
      const update = () => {
        const elapsed = performance.now() - started.current!;
        // Move visibly during sub-second requests, then slow down below 100%.
        const progress = Math.min(0.9, 0.18 + 0.72 * (1 - Math.exp(-elapsed / 500)));
        overlay.style.transform = `scaleX(${progress})`;
      };
      update();
      const timer = window.setInterval(update, 50);
      return () => window.clearInterval(timer);
    }

    if (started.current !== null) {
      started.current = null;
      if (failed) {
        overlay.dataset.state = "idle";
        return;
      }
      overlay.dataset.state = "complete";
      overlay.style.transform = "scaleX(1)";
      const timer = window.setTimeout(() => { overlay.dataset.state = "idle"; }, 130);
      return () => window.clearTimeout(timer);
    }
    overlay.dataset.state = "idle";
  }, [pending, failed]);

  return <span ref={ref} className="button-progress-overlay" aria-hidden="true" />;
}

type ProgressButtonProps = ComponentProps<"button"> & {
  progressError?: boolean;
  "data-pending"?: string;
};

export function ProgressButton({ children, progressError = false, ...props }: ProgressButtonProps) {
  const pending = props["aria-busy"] === true || props["aria-busy"] === "true" || props["data-pending"] === "true";
  return <button {...props} data-button-progress="true">
    {children}
    <ButtonProgress pending={pending} failed={progressError} />
  </button>;
}
