export const DUPLICATE_ENGINE_VERSION = "1";
export type Identity = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
};
export const DUPLICATE_LABELS = {
  exact: "Corrispondenza esatta",
  likely: "Duplicato molto probabile",
  possible: "Possibile duplicato",
  dismissed: "Falso positivo già verificato",
} as const;
export type DuplicateMatch = {
  left: string;
  right: string;
  level: keyof typeof DUPLICATE_LABELS;
  signals: string[];
};
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");
}
export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = next;
  }
  return previous[b.length];
}
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}
export function identityFingerprint(person: Identity): string {
  return JSON.stringify([
    person.firstName,
    person.lastName,
    person.birthDate,
    person.email,
    person.phone,
    person.country,
    person.city,
  ]);
}
function prepareIdentity(person: Identity): Identity {
  return {
    ...person,
    firstName: normalizeText(person.firstName),
    lastName: normalizeText(person.lastName),
    email: person.email?.trim().toLowerCase() ?? null,
    phone: normalizePhone(person.phone),
    country: normalizeText(person.country),
    city: normalizeText(person.city),
  };
}
export function compareIdentities(
  a: Identity,
  b: Identity,
  dismissed = false,
): DuplicateMatch | null {
  return comparePrepared(prepareIdentity(a), prepareIdentity(b), dismissed);
}
function comparePrepared(
  a: Identity,
  b: Identity,
  dismissed: boolean,
): DuplicateMatch | null {
  if (a.id === b.id) return null;
  const firstA = a.firstName ?? "",
    firstB = b.firstName ?? "";
  const lastA = a.lastName ?? "",
    lastB = b.lastName ?? "";
  const same = (x: string | null | undefined, y: string | null | undefined) =>
    Boolean(x && y && x === y);
  const email = same(a.email, b.email);
  const phone = same(a.phone, b.phone);
  const birth = same(a.birthDate, b.birthDate);
  const birthConflict = Boolean(
    a.birthDate && b.birthDate && a.birthDate !== b.birthDate,
  );
  const names = same(firstA, firstB) && same(lastA, lastB);
  const close = (x: string, y: string) =>
    Boolean(
      x &&
      y &&
      (x === y ||
        (Math.min(x.length, y.length) >= 4 &&
          Math.abs(x.length - y.length) <= 2 &&
          levenshtein(x, y) <=
            Math.min(2, Math.floor(Math.max(x.length, y.length) * 0.2)))),
    );
  const nearNames = close(firstA, firstB) && close(lastA, lastB);
  const country = same(a.country, b.country);
  const city = same(a.city, b.city);
  let level: DuplicateMatch["level"] | null = null;
  if (names && birth && (email || phone)) level = "exact";
  else if (
    !birthConflict &&
    ((names && (birth || email || phone)) ||
      (nearNames && birth && (email || phone)))
  )
    level = "likely";
  else if (
    names ||
    (nearNames && (birth || email || phone || (country && city))) ||
    email ||
    phone
  )
    level = "possible";
  if (!level) return null;
  return {
    left: a.id,
    right: b.id,
    level: dismissed ? "dismissed" : level,
    signals: [
      names
        ? "Nome e cognome uguali"
        : nearNames
          ? "Nome e cognome simili (Levenshtein)"
          : "Nomi diversi",
      ...(email ? ["Email uguale"] : []),
      ...(phone ? ["Telefono uguale"] : []),
      ...(birth ? ["Data di nascita uguale"] : []),
      ...(birthConflict ? ["Date di nascita diverse"] : []),
      ...(country ? ["Paese uguale"] : []),
      ...(city ? ["Città uguale"] : []),
    ],
  };
}
export function findDuplicates(
  people: Identity[],
  dismissed = new Set<string>(),
): DuplicateMatch[] {
  const prepared = people.map(prepareIdentity);
  const buckets = new Map<string, number[]>();
  const matches: DuplicateMatch[] = [];
  // Every accepted tier requires one of these keys. Blocking avoids comparing
  // unrelated people while retaining name-only homonyms and fuzzy-name signals.
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    const keys = [
      p.firstName && p.lastName ? `n:${p.firstName}|${p.lastName}` : "",
      p.email ? `e:${p.email}` : "",
      p.phone ? `p:${p.phone}` : "",
      p.birthDate ? `b:${p.birthDate}` : "",
      p.country && p.city ? `g:${p.country}|${p.city}` : "",
    ].filter(Boolean);
    const candidates = new Set(keys.flatMap((key) => buckets.get(key) ?? []));
    for (const j of candidates) {
      const match = comparePrepared(
        prepared[j],
        p,
        dismissed.has(pairKey(prepared[j].id, p.id)),
      );
      if (match) matches.push(match);
    }
    for (const key of keys) {
      const bucket = buckets.get(key) ?? [];
      bucket.push(i);
      buckets.set(key, bucket);
    }
  }
  return matches;
}
