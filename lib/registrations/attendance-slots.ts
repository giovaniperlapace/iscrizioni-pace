export type AttendancePart = "morning" | "afternoon";

export type AttendanceSlot = {
  day: string;
  part: AttendancePart;
};

export type AttendanceDayColumn = {
  day: string;
  label: string;
  parts: AttendancePart[];
};

export const ATTENDANCE_PARTS: Array<{
  value: AttendancePart;
  label: Record<string, string>;
}> = [
  {
    value: "morning",
    label: {
      it: "Mattina",
      en: "Morning",
      fr: "Matin",
      de: "Vormittag",
      es: "Mañana",
      nl: "Ochtend",
      uk: "Ранок",
    },
  },
  {
    value: "afternoon",
    label: {
      it: "Pomeriggio",
      en: "Afternoon",
      fr: "Après-midi",
      de: "Nachmittag",
      es: "Tarde",
      nl: "Middag",
      uk: "Після обіду",
    },
  },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SLOT_SEPARATOR = "__";

export function encodeAttendanceSlot(slot: AttendanceSlot): string {
  return `${slot.day}${SLOT_SEPARATOR}${slot.part}`;
}

export function parseAttendanceSlot(value: string): AttendanceSlot | null {
  const [day, part] = value.split(SLOT_SEPARATOR);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) {
    return null;
  }

  if (part !== "morning" && part !== "afternoon") {
    return null;
  }

  return { day, part };
}

export function attendanceSlotKey(slot: AttendanceSlot): string {
  return encodeAttendanceSlot(slot);
}

export function buildAttendanceDayColumns(
  startsOn: string | null,
  endsOn: string | null,
  locale = "it"
): AttendanceDayColumn[] {
  if (!startsOn) {
    return [];
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  });
  const columns: AttendanceDayColumn[] = [];
  const arrivalDay = new Date(start.getTime() - DAY_IN_MS);

  columns.push({
    day: arrivalDay.toISOString().slice(0, 10),
    label: formatter.format(arrivalDay),
    parts: ["afternoon"],
  });

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    columns.push({
      day: cursor.toISOString().slice(0, 10),
      label: formatter.format(cursor),
      parts: ["morning", "afternoon"],
    });
  }

  return columns;
}

export function buildAllowedAttendanceSlotKeys(
  startsOn: string | null,
  endsOn: string | null
): Set<string> {
  return new Set(
    buildAttendanceDayColumns(startsOn, endsOn).flatMap((column) =>
      column.parts.map((part) => encodeAttendanceSlot({ day: column.day, part }))
    )
  );
}

export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}
