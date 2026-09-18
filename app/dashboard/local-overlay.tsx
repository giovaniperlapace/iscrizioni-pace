"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** Keep the server-rendered detail, but closing it needs no server navigation. */
export function LocalOverlay({ parameter, value, children }: {
  parameter: string; value: string; children: ReactNode;
}) {
  const params = useSearchParams();
  return params.get(parameter) === value ? children : null;
}
