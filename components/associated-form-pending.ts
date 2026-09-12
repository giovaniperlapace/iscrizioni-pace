"use client";

import { useCallback, useSyncExternalStore } from "react";

// Controls outside their form cannot use useFormStatus. ReliableForm exposes
// its actual transition on aria-busy; observe only that associated form.
export function useAssociatedFormPending(formId: string) {
  const subscribe = useCallback((notify: () => void) => {
    const form = document.getElementById(formId);
    if (!form) return () => {};
    const observer = new MutationObserver(notify);
    observer.observe(form, { attributes: true, attributeFilter: ["aria-busy"] });
    return () => observer.disconnect();
  }, [formId]);
  const getSnapshot = useCallback(() => document.getElementById(formId)?.getAttribute("aria-busy") === "true", [formId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
