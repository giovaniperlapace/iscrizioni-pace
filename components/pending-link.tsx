"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { WorkStatus } from "@/components/work-status";
import { ButtonProgress, useButtonProgressEnabled } from "@/components/button-progress";

function LinkStatus() {
  const { pending } = useLinkStatus();
  const progressEnabled = useButtonProgressEnabled();
  return <>
    {pending ? <span data-link-pending="true"><WorkStatus spinner={!progressEnabled} className={progressEnabled ? "sr-only" : "link-work-status"} /></span> : null}
    <ButtonProgress pending={pending} />
  </>;
}

// Keep Next's navigation, prefetching, modified clicks and cancellation semantics.
export default function PendingLink({ children, className = "", ...props }: ComponentProps<typeof NextLink>) {
  const progressEnabled = useButtonProgressEnabled();
  return <NextLink {...props} data-button-progress={progressEnabled ? "true" : undefined} className={`pending-link ${className}`}>
    {children}<LinkStatus />
  </NextLink>;
}
