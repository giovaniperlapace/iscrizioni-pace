"use client";

import { useState } from "react";

import {
  ATTENDANCE_PARTS,
  encodeAttendanceSlot,
  type AttendanceDayColumn,
} from "@/lib/registrations/attendance-slots";

type ManualAttendanceFieldsProps = {
  eventDays: AttendanceDayColumn[];
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
  const [selectedAttendanceSlots, setSelectedAttendanceSlots] = useState<string[]>([]);
  const gridTemplateColumns = `minmax(7rem, 0.7fr) repeat(${eventDays.length}, minmax(5.5rem, 1fr))`;

  return (
    <fieldset className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        {copy.help}
      </p>

      {eventDays.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[var(--peace-border)] bg-white">
          <div
            className="grid bg-[#f7fbfe] text-center text-xs font-semibold uppercase text-[var(--peace-muted)]"
            style={{ gridTemplateColumns }}
          >
            <div className="border-r border-[var(--peace-border)] px-3 py-3 text-left">
              Fascia
            </div>
            {eventDays.map((day) => (
              <div
                key={day.day}
                className="border-r border-[var(--peace-border)] px-3 py-3 last:border-r-0"
              >
                {day.label}
              </div>
            ))}
          </div>
          {ATTENDANCE_PARTS.map((part) => (
            <div
              key={part.value}
              className="grid border-t border-[var(--peace-border)]"
              style={{ gridTemplateColumns }}
            >
              <div className="border-r border-[var(--peace-border)] bg-[#fbfdff] px-3 py-3 text-sm font-medium text-[var(--peace-ink)]">
                {part.label.it}
              </div>
              {eventDays.map((day) => {
                const slotAvailable = day.parts.includes(part.value);
                const slotValue = encodeAttendanceSlot({
                  day: day.day,
                  part: part.value,
                });

                return (
                  <label
                    key={`${day.day}-${part.value}`}
                    className={`flex min-h-14 items-center justify-center border-r border-[var(--peace-border)] px-3 py-2 last:border-r-0 ${
                      slotAvailable
                        ? availabilityUnknown
                          ? "bg-[#eef5fa] text-[#718196]"
                          : "bg-white text-[var(--peace-ink)]"
                        : "bg-[#f3f6f9] text-[#9aa8b8]"
                    }`}
                  >
                    {slotAvailable ? (
                      <input
                        name="availabilitySlots"
                        type="checkbox"
                        value={slotValue}
                        checked={selectedAttendanceSlots.includes(slotValue)}
                        disabled={availabilityUnknown}
                        className="h-4 w-4 accent-[var(--peace-blue-800)]"
                        aria-label={`${part.label.it} ${day.label}`}
                        onChange={(event) => {
                          setSelectedAttendanceSlots((current) =>
                            event.target.checked
                              ? [...current, slotValue]
                              : current.filter((value) => value !== slotValue)
                          );
                        }}
                      />
                    ) : (
                      <span aria-hidden="true">-</span>
                    )}
                  </label>
                );
              })}
            </div>
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
              setSelectedAttendanceSlots([]);
            }
          }}
        />
        <span>{copy.unknown}</span>
      </label>
    </fieldset>
  );
}
