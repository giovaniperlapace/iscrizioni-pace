import { normalizeText, normalizePhone, type Identity } from "./duplicates.ts";
export const FORMAT_VERSION = "pace-partecipanti-v1";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
export const COLUMNS = [
  "nome",
  "cognome",
  "data_nascita",
  "email",
  "telefono",
  "paese",
  "citta",
  "gruppo",
  "servizio",
  "stato_servizio",
  "tag",
  "stato",
  "consenso_privacy",
  "versione_privacy",
  "data_consenso",
] as const;
export type ExcelRow = Record<(typeof COLUMNS)[number], string>;
export type Catalog = {
  groups: { id: string; label: string }[];
  services: { id: string; label: string }[];
  tags: { id: string; label: string }[];
};
export type ValidatedRow = {
  row: number;
  values: ExcelRow;
  errors: string[];
  identity: Identity;
  groupId: string | null;
  serviceId: string | null;
  tagIds: string[];
};
export const FORMAT_INSTRUCTIONS = [
  "Compila il foglio Partecipanti. Esempi e Istruzioni non vengono importati. Non cambiare le intestazioni e non aggiungere colonne o fogli.",
  "Obbligatori: nome e cognome (2–120 caratteri), consenso_privacy=si, versione_privacy e data_consenso. Almeno uno tra email e telefono. Le date sono testo AAAA-MM-GG; data di nascita facoltativa, senza date future.",
  "Telefono come testo con prefisso internazionale, ad esempio +393331234567. Email senza spazi. Paese e città sono testo libero (massimo 120 caratteri).",
  "Gruppo e servizio: UUID dal foglio Cataloghi oppure nome esatto univoco nell’evento corrente. Gruppi strutturali/inattivi e servizi inattivi non sono assegnabili. Tag: nomi univoci o UUID separati da punto e virgola. Nessuna creazione automatica di cataloghi.",
  "stato: submitted, confirmed oppure cancelled; se vuoto viene usato submitted. stato_servizio: assigned, preference_pending, proposal_pending o declined; se vuoto con servizio presente viene usato assigned. I tag sono interni e non vengono mostrati al partecipante.",
  "Riporta soltanto consensi già raccolti: versione dell’informativa accettata e data originale. La conferma dell’operatore attesta la disponibilità del consenso, non sostituisce quello della persona. Non inserire dati di accessibilità nel file.",
  "Ogni riga crea una nuova iscrizione individuale; non aggiorna persone esistenti. Presenze inizialmente da confermare. Minori accompagnati, questionari, consensi aggiuntivi e dati sensibili si gestiscono nei flussi dedicati.",
  "Massimo 500 righe e 2 MiB per file .xlsx. Formule, macro, collegamenti esterni, colonne inattese e file compressi anomali sono rifiutati. Scrivi valori semplici, senza formule.",
  "Il caricamento genera solo un’anteprima, valida per 20 minuti. Gli errori richiedono correzione o scarto esplicito della riga. I possibili duplicati richiedono scarto o motivazione di persona distinta. Nessuna unione automatica.",
  "La conferma salva tutte le righe selezionate in una sola transazione, con audit degli scarti. Se i dati cambiano, aggiorna l’anteprima. Un doppio invio della stessa conferma non crea copie.",
  "L’export contiene tutte le iscrizioni che corrispondono ai filtri, con fogli aggiuntivi di sola consultazione per minori e presenze. I consensi non vengono inventati: completa quelli mancanti prima di usare l’export per una nuova importazione. Un file già esportato può contenere oltre 500 righe.",
];
export function validDate(
  value: string,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1900-01-01" &&
    value <= today &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function validateExcelRow(
  values: ExcelRow,
  row: number,
  catalog: Catalog,
): ValidatedRow {
  const errors: string[] = [];
  const resolve = (
    value: string,
    list: Catalog["groups"],
    kind: string,
  ): string | null => {
    if (!value) return null;
    const matches = list.filter(
      (item) =>
        item.id === value || normalizeText(item.label) === normalizeText(value),
    );
    if (matches.length !== 1) {
      errors.push(`${kind} sconosciuto o ambiguo: ${value}`);
      return null;
    }
    return matches[0].id;
  };
  for (const field of COLUMNS) {
    values[field] = values[field]?.trim() ?? "";
    if (values[field].length > (field === "tag" ? 2000 : 254))
      errors.push(`${field}: valore troppo lungo`);
    if (
      /^[=\-@\t\r\n]/.test(values[field]) ||
      (values[field].startsWith("+") && field !== "telefono")
    )
      errors.push(`${field}: valore simile a formula non ammesso`);
  }
  for (const field of ["nome", "cognome"] as const)
    if (values[field].length < 2 || values[field].length > 120)
      errors.push(`${field}: obbligatorio, 2–120 caratteri`);
  for (const field of ["paese", "citta"] as const)
    if (values[field].length > 120)
      errors.push(`${field}: massimo 120 caratteri`);
  if (values.data_nascita && !validDate(values.data_nascita))
    errors.push("data_nascita: usa una data valida AAAA-MM-GG, non futura");
  values.email = values.email.toLowerCase();
  if (
    values.telefono &&
    !/^(?:\+|00)[1-9][\d ().-]{6,24}$/.test(values.telefono)
  )
    errors.push(
      "telefono: usa soltanto cifre, prefisso e separatori telefonici",
    );
  values.telefono = normalizePhone(values.telefono);
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.push("email non valida");
  if (values.telefono && !/^\+[1-9]\d{6,14}$/.test(values.telefono))
    errors.push(
      "telefono: serve il prefisso internazionale, formato +393331234567",
    );
  if (!values.email && !values.telefono)
    errors.push("Inserisci almeno email o telefono");
  values.stato ||= "submitted";
  if (!["submitted", "confirmed", "cancelled"].includes(values.stato))
    errors.push("stato: submitted, confirmed o cancelled");
  if (values.consenso_privacy !== "si")
    errors.push(
      "consenso_privacy: deve essere si per un consenso già raccolto",
    );
  if (!values.versione_privacy || values.versione_privacy.length > 120)
    errors.push("versione_privacy obbligatoria, massimo 120 caratteri");
  if (!validDate(values.data_consenso))
    errors.push("data_consenso: data originale valida AAAA-MM-GG, non futura");
  const groupId = resolve(values.gruppo, catalog.groups, "Gruppo");
  const serviceId = resolve(values.servizio, catalog.services, "Servizio");
  if (values.servizio && !values.stato_servizio)
    values.stato_servizio = "assigned";
  if (
    values.stato_servizio &&
    (![
      "assigned",
      "preference_pending",
      "proposal_pending",
      "declined",
    ].includes(values.stato_servizio) ||
      !values.servizio)
  )
    errors.push("stato_servizio: richiede un servizio e un valore ammesso");
  const tagIds = [
    ...new Set(
      values.tag
        .split(";")
        .filter(Boolean)
        .map((tag) => resolve(tag.trim(), catalog.tags, "Tag"))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return {
    row,
    values,
    errors,
    groupId,
    serviceId,
    tagIds,
    identity: {
      id: `row-${row}`,
      firstName: values.nome,
      lastName: values.cognome,
      birthDate: values.data_nascita || null,
      email: values.email || null,
      phone: values.telefono || null,
      country: values.paese || null,
      city: values.citta || null,
    },
  };
}
