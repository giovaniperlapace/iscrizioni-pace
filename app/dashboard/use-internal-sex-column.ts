"use client";
import { useEffect, useState } from "react";
import { getVisibleInternalSexes } from "./operational-registration-actions";
import { internalSexText, type InternalSex } from "@/lib/registrations/assisted-demographics";
import { OPERATIONAL_ADDITIONS_COPY } from "@/lib/registrations/operational-additions-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

export function useInternalSexColumn(enabled: boolean, registrationIds: string[], locale: SupportedLocale) {
  const key = enabled ? [...new Set(registrationIds)].sort().join(",") : "";
  const [result, setResult] = useState<{ key: string; values: Record<string, InternalSex>; failed: boolean } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    async function load() {
      const ids = key.split(",");
      const values: Record<string, InternalSex> = {};
      try {
        for (let offset = 0; offset < ids.length; offset += 200) {
          if (cancelled) return;
          const response = await getVisibleInternalSexes(ids.slice(offset, offset + 200));
          if (response.status !== "success") throw new Error("Unavailable");
          Object.assign(values, response.values);
        }
        if (!cancelled) setResult({ key, values, failed: false });
      } catch { if (!cancelled) setResult({ key, values: {}, failed: true }); }
    }
    void load();
    return () => { cancelled = true; };
  }, [key]);
  return (id: string): string | null => {
    if (!enabled) return null;
    if (result?.key !== key) return OPERATIONAL_ADDITIONS_COPY[locale][3];
    if (result.failed) return OPERATIONAL_ADDITIONS_COPY[locale][4];
    return internalSexText(result.values[id], locale);
  };
}
