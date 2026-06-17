"use client";

import { useState } from "react";

import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";

export function ManualAccessibilityFields() {
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState("unknown");

  return (
    <fieldset className="grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[#3c4b40]">
        Accessibilità e supporto
      </legend>
      <p className="text-sm leading-6 text-[#5e6d63]">
        Compila solo le informazioni che conosci. Potranno essere completate
        più avanti.
      </p>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        La persona ha bisogni di accessibilità?
        <select
          name="hasAccessibilityNeeds"
          className="field"
          value={hasAccessibilityNeeds}
          onChange={(event) => setHasAccessibilityNeeds(event.target.value)}
        >
          <option value="unknown">Non so / da verificare</option>
          <option value="no">No</option>
          <option value="yes">Sì</option>
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
                <span>{difficulty.label.it}</span>
              </label>
            ))}
          </div>
          <label className="flex gap-3 rounded-md border border-[#d8dece] bg-white p-3 text-sm font-medium text-[#39483f]">
            <input
              name="needsOperationalSupport"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#315c44]"
            />
            Serve ricontattare la persona o organizzare un supporto pratico.
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Indicazioni pratiche
            <textarea
              name="accessibilityNotes"
              rows={3}
              className="min-h-20 rounded-md border border-[#cfd8c4] bg-white px-3 py-2 text-sm font-normal text-[#1c241f] outline-none transition focus:border-[#56745d]"
              placeholder="Per esempio accompagnatore, mobilità, orari di contatto, esigenze operative."
            />
          </label>
        </>
      ) : null}
    </fieldset>
  );
}
