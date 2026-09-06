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
export const IMPORT_GUIDE = [
  {
    title: "Parti dal modello",
    text: "Scarica il modello Excel e inserisci una persona per riga nel foglio Partecipanti. Lascia invariati i titoli delle colonne e i fogli. Il foglio Esempi mostra una riga compilata: serve solo come guida e non viene importato. Il file Esporta iscritti della tabella non è un modello di importazione.",
  },
  {
    title: "Compila i dati obbligatori",
    text: "Per ogni persona inserisci nome, cognome e almeno un recapito: email oppure telefono. Nome e cognome devono avere da 2 a 120 caratteri. Compila anche i tre campi del consenso indicati qui sotto. Data di nascita, paese e città sono facoltativi; paese e città possono avere fino a 120 caratteri.",
  },
  {
    title: "Riporta il consenso già raccolto",
    text: "In consenso_privacy scrivi si (senza accento). In versione_privacy riporta il nome o il codice della versione dell’informativa accettata dalla persona; in data_consenso scrivi la data in cui ha dato il consenso. Questi dati devono essere quelli originali: non copiarli dal foglio Esempi. La tua conferma finale attesta che il consenso è stato raccolto ed è disponibile.",
  },
  {
    title: "Scrivi date e telefoni come negli esempi",
    text: "Imposta le celle delle date e dei telefoni come Testo in Excel prima di compilarle. Per le date usa anno-mese-giorno: ad esempio 1990-05-20 per il 20 maggio 1990. Sono ammesse date dal 1900 a oggi. Per il telefono aggiungi il prefisso internazionale: ad esempio +393331234567. Scrivi l’email senza spazi.",
  },
  {
    title: "Scegli gruppo, servizio e tag dagli elenchi",
    text: "Questi campi sono facoltativi. Copia i nomi dal foglio Cataloghi del modello appena scaricato: contiene le opzioni disponibili per l’evento. Se ci sono nomi uguali, usa il codice riportato accanto al nome. Per più tag, separa i nomi con un punto e virgola, ad esempio Volontario; Accoglienza. I tag sono etichette interne e non sono visibili alla persona iscritta. Un nome non riconosciuto sarà segnalato nell’anteprima.",
  },
  {
    title: "Lascia vuoti gli stati se non hai esigenze particolari",
    text: "Puoi lasciare vuote le colonne stato e stato_servizio: la persona verrà iscritta e l’eventuale servizio indicato sarà assegnato. Se devi specificarli, stato accetta submitted (iscrizione inviata), confirmed (confermata) o cancelled (annullata). Con un servizio presente, stato_servizio accetta assigned (assegnato), preference_pending (preferenza da valutare), proposal_pending (proposta in attesa) o declined (rifiutato).",
  },
  {
    title: "Salva un file Excel con soli valori",
    text: "Usa il formato .xlsx, con un massimo di 500 persone e 2 MB per file. Inserisci solo testo e numeri, senza formule, macro o collegamenti ad altri file. Ogni riga aggiunge una nuova iscrizione individuale: non modifica quelle esistenti. Le presenze restano da confermare. Minori accompagnati, questionari, altri consensi e bisogni di accessibilità vanno gestiti nelle sezioni dedicate, non in questo file.",
  },
  {
    title: "Controlla l’anteprima, poi conferma",
    text: "Dopo aver scelto il file, premi Mostra anteprima: nessuna iscrizione viene ancora aggiunta. Se ci sono errori, correggi il file e caricalo di nuovo oppure scarta le righe interessate indicando il motivo. Se una persona sembra già iscritta, scarta la riga oppure spiega perché si tratta di una persona diversa. Nessuna scheda viene unita automaticamente. Solo Conferma importazione salva le righe scelte, tutte insieme. L’anteprima dura 20 minuti: se scade o i dati cambiano, carica di nuovo il file.",
  },
] as const;

// The website and the downloadable template share the same instructions.
export const FORMAT_INSTRUCTIONS = IMPORT_GUIDE.map(
  ({ title, text }) => `${title}. ${text}`,
);

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
