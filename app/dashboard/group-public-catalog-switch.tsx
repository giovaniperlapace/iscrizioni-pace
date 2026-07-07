"use client";

import { useState } from "react";

type GroupPublicCatalogSwitchProps = {
  formId: string;
  groupName: string;
  isPublicCatalog: boolean;
};

export function GroupPublicCatalogSwitch({
  formId,
  groupName,
  isPublicCatalog,
}: GroupPublicCatalogSwitchProps) {
  const [optimisticValue, setOptimisticValue] = useState(isPublicCatalog);
  const [isSaving, setIsSaving] = useState(false);
  const label = optimisticValue ? "Visibile" : "Nascosto";

  return (
    <button
      aria-checked={optimisticValue}
      aria-label={`${groupName}: ${
        optimisticValue ? "nascondi dal form pubblico" : "mostra nel form pubblico"
      }`}
      className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full border border-[var(--peace-border-strong)] bg-white px-2 py-1 text-xs font-semibold text-[var(--peace-blue-800)] shadow-sm transition hover:bg-[var(--peace-sky-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)]"
      data-pending={isSaving ? "true" : "false"}
      form={formId}
      role="switch"
      type="submit"
      onClick={() => {
        setOptimisticValue((value) => !value);
        setIsSaving(true);
      }}
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-10 rounded-full transition-colors duration-200 ease-out ${
          optimisticValue ? "bg-[var(--peace-blue-800)]" : "bg-[#9fb5c8]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            optimisticValue ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-14 text-left transition-opacity duration-200">
        {isSaving ? "Salvo..." : label}
      </span>
    </button>
  );
}
