"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { WorkStatus } from "@/components/work-status";

function LinkStatus() {
  const { pending } = useLinkStatus();
  return pending ? <span data-link-pending="true"><WorkStatus className="link-work-status" /></span> : null;
}

// Keep Next's navigation, prefetching, modified clicks and cancellation semantics.
export default function PendingLink({ children, className = "", ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} className={`pending-link ${className}`}>
    {children}<LinkStatus />
  </NextLink>;
}
