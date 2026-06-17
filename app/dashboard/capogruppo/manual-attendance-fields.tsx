"use client";

import { useState } from "react";

type ManualAttendanceFieldsProps = {
  eventDays: Array<{ value: string; label: string }>;
};

export function ManualAttendanceFields({ eventDays }: ManualAttendanceFieldsProps) {
  const [availabilityUnknown, setAvailabilityUnknown] = useState(true);
  const [selectedEventDays, setSelectedEventDays] = useState<string[]>([]);

  return (
    <fieldset className="grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[#3c4b40]">
        Presenza
      </legend>
      <p className="text-sm leading-6 text-[#5e6d63]">
        Se conosci già i giorni di presenza, selezionali. Altrimenti lascia
        indicato che saranno confermati più avanti.
      </p>

      {eventDays.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {eventDays.map((day) => (
            <label
              key={day.value}
              className={`flex min-h-14 items-center gap-3 rounded-md border p-3 text-sm transition ${
                availabilityUnknown
                  ? "border-[#e1e5da] bg-[#f5f6f1] text-[#7a867b]"
                  : "border-[#d8dece] bg-white text-[#38453c]"
              }`}
            >
              <input
                name="availabilityDays"
                type="checkbox"
                value={day.value}
                checked={selectedEventDays.includes(day.value)}
                disabled={availabilityUnknown}
                className="h-4 w-4 accent-[#315c44]"
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
        <p className="rounded-md border border-[#e1e6da] bg-white p-3 text-sm text-[#5e6d63]">
          Date dell&apos;evento non disponibili.
        </p>
      )}

      <label className="flex min-h-14 items-center gap-3 rounded-md border border-[#d8dece] bg-white p-3 text-sm text-[#38453c]">
        <input
          name="availabilityUnknown"
          type="checkbox"
          checked={availabilityUnknown}
          className="h-4 w-4 accent-[#315c44]"
          onChange={(event) => {
            setAvailabilityUnknown(event.target.checked);
            if (event.target.checked) {
              setSelectedEventDays([]);
            }
          }}
        />
        <span>Non lo so ancora, sarà confermato più avanti</span>
      </label>
    </fieldset>
  );
}
