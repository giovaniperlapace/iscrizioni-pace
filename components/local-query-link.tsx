"use client";

import Link from "@/components/pending-link";
import type { ComponentProps } from "react";

/** For UI state already loaded on this page. Modified clicks still use the URL. */
export function LocalQueryLink({ href, replace = false, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  return <Link {...props} href={href} replace={replace} prefetch={false} onNavigate={(event) => {
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;
    event.preventDefault();
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
  }} />;
}
