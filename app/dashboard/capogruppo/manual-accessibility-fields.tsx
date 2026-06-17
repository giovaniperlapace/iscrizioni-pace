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
    <fieldset className="grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[#3c4b40]">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-[#5e6d63]">
        {copy.help}
      </p>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
                className="flex min-h-14 items-start gap-3 rounded-md border border-[#d8dece] bg-white p-3 text-sm text-[#38453c]"
              >
                <input
                  name={`accessibility_${difficulty.key}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#315c44]"
                />
                <span>{difficulty.label[locale] ?? difficulty.label.en}</span>
              </label>
            ))}
          </div>
          <label className="flex gap-3 rounded-md border border-[#d8dece] bg-white p-3 text-sm font-medium text-[#39483f]">
            <input
              name="needsOperationalSupport"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#315c44]"
            />
            {copy.needsSupport}
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            {copy.notes}
            <textarea
              name="accessibilityNotes"
              rows={3}
              className="min-h-20 rounded-md border border-[#cfd8c4] bg-white px-3 py-2 text-sm font-normal text-[#1c241f] outline-none transition focus:border-[#56745d]"
            />
          </label>
        </>
      ) : null}
    </fieldset>
  );
}
