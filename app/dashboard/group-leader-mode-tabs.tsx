"use client";

import { type ReactNode, useState } from "react";

type GroupLeaderMode = "existing" | "new";

type GroupLeaderModeTabsProps = {
  existingForm: ReactNode;
  newForm: ReactNode;
};

const tabs: Array<{ value: GroupLeaderMode; label: string }> = [
  { value: "existing", label: "Partecipante già iscritto" },
  { value: "new", label: "Nuovo utente" },
];

export function GroupLeaderModeTabs({
  existingForm,
  newForm,
}: GroupLeaderModeTabsProps) {
  const [activeTab, setActiveTab] = useState<GroupLeaderMode>("existing");

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--peace-blue-800)] text-white shadow-sm"
                  : "text-[var(--peace-blue-800)] hover:bg-white"
              }`}
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "existing" ? existingForm : newForm}
    </div>
  );
}
