"use client";

import { useState } from "react";

import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";
import type { SupportedLocale } from "@/lib/i18n/config";

type ManualAccessibilityFieldsProps = {
  locale: SupportedLocale;
  copy: {
    title: string;
    help: string;
    question: string;
    unknown: string;
    no: string;
    yes: string;
    needsSupport: string;
    notes: string;
  };
};

export function ManualAccessibilityFields({
  locale,
  copy,
}: ManualAccessibilityFieldsProps) {
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState("unknown");

  return (
    <fieldset className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        {copy.help}
      </p>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.question}
        <select
          name="hasAccessibilityNeeds"
          className="field"
          value={hasAccessibilityNeeds}
          onChange={(event) => setHasAccessibilityNeeds(event.target.value)}
        >
          <option value="unknown">{copy.unknown}</option>
          <option value="no">{copy.no}</option>
          <option value="yes">{copy.yes}</option>
        </select>
      </label>

      {hasAccessibilityNeeds === "yes" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {ACCESSIBILITY_DIFFICULTIES.map((difficulty) => (
              <label
                key={difficulty.key}
                className="flex min-h-14 items-start gap-3 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm text-[var(--peace-ink)]"
              >
                <input
                  name={`accessibility_${difficulty.key}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--peace-blue-800)]"
                />
                <span>{difficulty.label[locale] ?? difficulty.label.en}</span>
              </label>
            ))}
          </div>
          <label className="flex gap-3 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm font-medium text-[var(--peace-ink)]">
            <input
              name="needsOperationalSupport"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--peace-blue-800)]"
            />
            {copy.needsSupport}
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.notes}
            <textarea
              name="accessibilityNotes"
              rows={3}
              className="min-h-20 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 py-2 text-sm font-normal text-[var(--peace-ink)] outline-none transition focus:border-[var(--peace-sky-400)]"
            />
          </label>
        </>
      ) : null}
    </fieldset>
  );
}
