"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const FORM_ATTRIBUTE = "data-preserve-dashboard-scroll";
const STORAGE_PREFIX = "iscrizioni-dashboard-scroll";

function storageKey(pathname: string): string {
  return `${STORAGE_PREFIX}:${pathname}`;
}

export function PreserveDashboardScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form?.hasAttribute(FORM_ATTRIBUTE)) {
        return;
      }

      sessionStorage.setItem(storageKey(window.location.pathname), String(window.scrollY));
    }

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem(storageKey(pathname));

    if (!savedScroll) {
      return;
    }

    const top = Number(savedScroll);

    if (!Number.isFinite(top)) {
      sessionStorage.removeItem(storageKey(pathname));
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: "auto" });
      window.setTimeout(() => window.scrollTo({ top, behavior: "auto" }), 100);
      sessionStorage.removeItem(storageKey(pathname));
    });
  }, [pathname, search]);

  return null;
}
