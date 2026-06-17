"use client";

import { useState } from "react";

type ManualAttendanceFieldsProps = {
  eventDays: Array<{ value: string; label: string }>;
  copy: {
    title: string;
    help: string;
    noDates: string;
    unknown: string;
  };
};

export function ManualAttendanceFields({
  eventDays,
  copy,
}: ManualAttendanceFieldsProps) {
  const [availabilityUnknown, setAvailabilityUnknown] = useState(true);
  const [selectedEventDays, setSelectedEventDays] = useState<string[]>([]);

  return (
    <fieldset className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        {copy.help}
      </p>

      {eventDays.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {eventDays.map((day) => (
            <label
              key={day.value}
              className={`flex min-h-14 items-center gap-3 rounded-md border p-3 text-sm transition ${
                availabilityUnknown
                  ? "border-[var(--peace-border)] bg-[#eef5fa] text-[#718196]"
                  : "border-[var(--peace-border)] bg-white text-[var(--peace-ink)]"
              }`}
            >
              <input
                name="availabilityDays"
                type="checkbox"
                value={day.value}
                checked={selectedEventDays.includes(day.value)}
                disabled={availabilityUnknown}
                className="h-4 w-4 accent-[var(--peace-blue-800)]"
                onChange={(event) => {
                  setSelectedEventDays((current) =>
                    event.target.checked
                      ? [...current, day.value]
                      : current.filter((value) => value !== day.value)
                  );
                }}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm text-[var(--peace-muted)]">
          {copy.noDates}
        </p>
      )}

      <label className="flex min-h-14 items-center gap-3 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm text-[var(--peace-ink)]">
        <input
          name="availabilityUnknown"
          type="checkbox"
          checked={availabilityUnknown}
          className="h-4 w-4 accent-[var(--peace-blue-800)]"
          onChange={(event) => {
            setAvailabilityUnknown(event.target.checked);
            if (event.target.checked) {
              setSelectedEventDays([]);
            }
          }}
        />
        <span>{copy.unknown}</span>
      </label>
    </fieldset>
  );
}
