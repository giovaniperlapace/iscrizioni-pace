export type CeremonyKind = "opening" | "closing";
export type CeremonyPlan = {
  id: string;
  revision: number;
  state: "draft" | "validated";
  location: string;
  capacity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  attendancePart: "day" | "morning" | "afternoon";
};
export type CeremonySnapshot = {
  plan: CeremonyPlan | null;
  sectors: { id: string; name: string; capacity: number | null }[];
  quotas: {
    id: string;
    sectorId: string;
    category: string;
    quantity: number;
  }[];
  allocations: {
    id: string;
    quotaId: string;
    registrationId: string | null;
    groupId: string | null;
    quantity: number;
    name: string;
    review: boolean;
  }[];
  people: {
    id: string;
    name: string;
    code: string;
    children: { id: string; name: string }[];
    eligibility: "eligible" | "unknown" | "absent";
  }[];
  groups: { id: string; name: string; eligible: number }[];
};
export type CeremonyResult = { status: string };
export const ceremonyTitles = {
  opening: "Inaugurazione",
  closing: "Cerimonia finale",
};
export const eligibilityLabels = {
  eligible: "Presenza prevista",
  unknown: "Da verificare",
  absent: "Presenza non prevista",
};
export const ceremonyErrors: Record<string, string> = {
  seats_active: "Prima libera le sedute numerate nella piantina. Le assegnazioni esistenti restano conservate.",
  nominees_active: "Prima di revocare la dotazione, trasferisci o revoca le assegnazioni e le scelte dei minori nella vista Distribuzione nominale.",
  conflict:
    "La configurazione è cambiata. Aggiorna la pagina e verifica le disponibilità prima di riprovare.",
  capacity:
    "Posti insufficienti oppure capienza da definire. Non puoi ridurre capienze o quote sotto i posti già impegnati.",
  in_use:
    "Ci sono assegnazioni attive. Revocale esplicitamente prima di cambiare sede, orari, regola di presenza o categoria.",
  unconfigured:
    "L’admin deve completare e validare sede, orari e capienze prima delle assegnazioni.",
  ineligible:
    "La persona non ha una presenza prevista nella data/fascia scelta, oppure il gruppo non è più disponibile.",
  duplicate:
    "Esiste già un’assegnazione per questa persona o una dotazione per questo gruppo nella quota scelta.",
  forbidden: "Non hai i permessi per questa operazione.",
  date: "Indica inizio e fine nello stesso giorno, compreso nelle date dell’evento.",
  invalid: "Controlla i dati inseriti e i limiti indicati.",
  unavailable:
    "Salvataggio non confermato. Aggiorna la pagina per verificarne l’esito prima di riprovare.",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseCeremonyForm(form: FormData) {
  const get = (key: string) =>
    typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const kind = get("kind"),
    operation = get("operation"),
    revision = get("revision");
  if (
    !["opening", "closing"].includes(kind) ||
    !/^-?\d+$/.test(revision) ||
    Number(revision) < -1 ||
    Number(revision) > 2147483646
  )
    return null;
  const fields: Record<string, string[]> = {
    configure: [
      "location",
      "capacity",
      "startsAt",
      "endsAt",
      "attendancePart",
      "state",
    ],
    sector: ["id", "name", "capacity"],
    quota: ["id", "sectorId", "category", "quantity"],
    allocate: ["id", "quotaId", "registrationId", "groupId", "quantity"],
    revoke: ["id"],
  };
  if (!fields[operation]) return null;
  const data = Object.fromEntries(
    fields[operation].map((key) => [key, get(key)]),
  );
  for (const key of ["id", "sectorId", "quotaId"])
    if (key in data && !uuid.test(data[key])) return null;
  for (const key of ["registrationId", "groupId"])
    if (data[key] && !uuid.test(data[key])) return null;
  for (const key of ["capacity", "quantity"])
    if (
      key in data &&
      (data[key] || key === "quantity") &&
      (!/^\d+$/.test(data[key]) || Number(data[key]) > 1000000)
    )
      return null;
  if (operation === "configure") {
    if (
      !data.location ||
      data.location.length > 100 ||
      !["draft", "validated"].includes(data.state) ||
      !["day", "morning", "afternoon"].includes(data.attendancePart)
    )
      return null;
    for (const key of ["startsAt", "endsAt"])
      if (
        data[key] &&
        (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data[key]) ||
          !Number.isFinite(Date.parse(data[key])))
      )
        return null;
    if (
      Boolean(data.startsAt) !== Boolean(data.endsAt) ||
      (data.startsAt && data.endsAt <= data.startsAt)
    )
      return null;
  }
  if (operation === "sector" && (!data.name || data.name.length > 100))
    return null;
  if (operation === "quota" && (!data.category || data.category.length > 80))
    return null;
  if (
    operation === "allocate" &&
    (Boolean(data.registrationId) === Boolean(data.groupId) ||
      Number(data.quantity) < 1 ||
      (data.registrationId && data.quantity !== "1"))
  )
    return null;
  return {
    kind: kind as CeremonyKind,
    operation,
    revision: Number(revision),
    data,
  };
}
