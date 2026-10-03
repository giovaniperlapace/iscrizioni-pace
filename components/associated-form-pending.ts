"use client";

import { useCallback, useSyncExternalStore } from "react";

// Controls outside their form cannot use useFormStatus. ReliableForm exposes
// its actual transition on aria-busy; observe only that associated form.
function useAssociatedFormAttribute(formId: string, attribute: string) {
  const subscribe = useCallback((notify: () => void) => {
    const form = document.getElementById(formId);
    if (!form) return () => {};
    const observer = new MutationObserver(notify);
    observer.observe(form, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  }, [formId, attribute]);
  const getSnapshot = useCallback(() => document.getElementById(formId)?.getAttribute(attribute) === "true", [formId, attribute]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useAssociatedFormPending(formId: string) {
  return useAssociatedFormAttribute(formId, "aria-busy");
}

export function useAssociatedFormFailed(formId: string) {
  return useAssociatedFormAttribute(formId, "data-form-error");
}
