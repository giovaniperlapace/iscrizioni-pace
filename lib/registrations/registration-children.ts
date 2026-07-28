export const MAX_REGISTRATION_CHILDREN = 10;

export type RegistrationChildInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
};

export type RegistrationChildRow = {
  id?: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position?: number;
};

export function parseAccompanyingChildren(
  formData: FormData,
  participatesWithChildren: boolean
): RegistrationChildInput[] {
  if (!participatesWithChildren) {
    return [];
  }

  const count = Number(formData.get("childrenCount"));

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_REGISTRATION_CHILDREN
  ) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => ({
    firstName: normalizeChildName(formData.get(`child_${index}_firstName`)),
    lastName: normalizeChildName(formData.get(`child_${index}_lastName`)),
    birthDate: normalizeChildBirthDate(formData.get(`child_${index}_birthDate`)),
  }));
}

export function validateAccompanyingChildren(input: {
  participatesWithChildren: boolean;
  children: RegistrationChildInput[];
}): string[] {
  if (!input.participatesWithChildren) {
    return input.children.length === 0
      ? []
      : ["I dati dei figli non sono coerenti con la risposta selezionata."];
  }

  if (
    input.children.length < 1 ||
    input.children.length > MAX_REGISTRATION_CHILDREN
  ) {
    return ["Indica con quanti figli partecipi, da 1 a 10."];
  }

  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  input.children.forEach((child, index) => {
    const label = `figlio ${index + 1}`;

    if (!child.firstName) {
      errors.push(`Inserisci il nome del ${label}.`);
    }

    if (!child.lastName) {
      errors.push(`Inserisci il cognome del ${label}.`);
    }

    if (!isIsoDate(child.birthDate) || child.birthDate > today) {
      errors.push(`Inserisci una data di nascita valida per il ${label}.`);
    }
  });

  return errors;
}

export function toRegistrationChildRows(
  registrationId: string,
  children: RegistrationChildInput[]
) {
  return children.map((child, index) => ({
    registration_id: registrationId,
    position: index + 1,
    first_name: child.firstName,
    last_name: child.lastName,
    birth_date: child.birthDate,
  }));
}

export function mapRegistrationChildCounts(
  rows: Array<{ registration_id: string }>
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.registration_id, (counts.get(row.registration_id) ?? 0) + 1);
  }

  return counts;
}

export function mapRegistrationChildren(
  rows: Array<RegistrationChildRow & { registration_id: string }>
): Map<string, RegistrationChildRow[]> {
  const children = new Map<string, RegistrationChildRow[]>();

  for (const row of rows) {
    const registrationChildren = children.get(row.registration_id) ?? [];
    registrationChildren.push(row);
    children.set(row.registration_id, registrationChildren);
  }

  for (const registrationChildren of children.values()) {
    registrationChildren.sort(
      (first, second) => (first.position ?? 0) - (second.position ?? 0)
    );
  }

  return children;
}

export function sameRegistrationChildren(
  left: RegistrationChildInput[],
  right: RegistrationChildInput[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (child, index) =>
        child.firstName === right[index]?.firstName &&
        child.lastName === right[index]?.lastName &&
        child.birthDate === right[index]?.birthDate
    )
  );
}

function normalizeChildName(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeChildBirthDate(value: FormDataEntryValue | null): string {
  const normalized = String(value ?? "").trim();
  return isIsoDate(normalized) ? normalized : "";
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
