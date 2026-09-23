"use client";

import { useId, useState } from "react";
import { RequiredIndicator } from "./required-indicator";
import { birthDateNeedsReview } from "@/lib/registrations/birth-date";
import { BIRTH_DATE_COPY } from "@/lib/registrations/birth-date-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

export function ParticipantBirthDateField({ label, locale, value, defaultValue = "", onValueChange }: {
  label: string;
  locale: SupportedLocale;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const date = value ?? localValue;
  const id = useId();
  const review = birthDateNeedsReview(date);
  const copy = BIRTH_DATE_COPY[locale];
  return <div className="grid gap-2">
    <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
      <span>{label}<RequiredIndicator /></span>
      <input name="birthDate" type="date" required max={new Date().toISOString().slice(0, 10)}
        value={date} data-field="birthDate" className="field bg-white font-normal"
        aria-describedby={review ? `${id}-warning` : undefined}
        onChange={event => { setLocalValue(event.target.value); onValueChange?.(event.target.value); }} />
    </label>
    {review && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p id={`${id}-warning`} role="status">{copy.warning}</p>
    </div>}
  </div>;
}
