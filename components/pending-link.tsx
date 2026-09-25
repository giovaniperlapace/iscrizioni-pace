"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { WorkStatus } from "@/components/work-status";
import { ButtonProgress } from "@/components/button-progress";

function LinkStatus() {
  const { pending } = useLinkStatus();
  return <>
    {pending ? <span data-link-pending="true" className="sr-only"><WorkStatus spinner={false} /></span> : null}
    <ButtonProgress pending={pending} />
  </>;
}

// Keep Next's navigation, prefetching, modified clicks and cancellation semantics.
export default function PendingLink({ children, className = "", ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} data-button-progress="true" className={`pending-link ${className}`}>
    {children}<LinkStatus />
  </NextLink>;
}
