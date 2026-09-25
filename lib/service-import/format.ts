export const SERVICE_IMPORT_COLUMNS = ["nome", "cognome", "servizio"] as const;
export const SERVICE_IMPORT_STATUS = {
  updated: "Servizio attribuito",
  unchanged: "Servizio già assegnato",
  not_found: "Partecipante non trovato",
  ambiguous: "Nominativo ambiguo",
  invalid_service: "Servizio non riconosciuto o non attivo",
  invalid_row: "Riga non valida",
  conflict: "Servizi contrastanti nel file",
  duplicate: "Riga ripetuta",
} as const;
export type ServiceImportStatus = keyof typeof SERVICE_IMPORT_STATUS;
export type ServiceImportRow = {
  row: number;
  firstName: string;
  lastName: string;
  service: string;
  error: string;
};
export type ServiceImportResultRow = ServiceImportRow & {
  status: ServiceImportStatus;
  registrationId: string | null;
};
export type ServiceImportResult = {
  rows: ServiceImportResultRow[];
  replayed: boolean;
};
export function serviceImportSummary(rows: ServiceImportResultRow[]) {
  const counts = Object.fromEntries(
    Object.keys(SERVICE_IMPORT_STATUS).map((status) => [status, 0]),
  ) as Record<ServiceImportStatus, number>;
  for (const row of rows) counts[row.status]++;
  return counts;
}
export function serviceImportDetail(row: ServiceImportResultRow) {
  switch (row.status) {
    case "updated": return "Servizio assegnato; l’eventuale servizio precedente è stato aggiornato.";
    case "unchanged": return "Nessuna modifica necessaria.";
    case "not_found": return "Nessuna iscrizione non eliminata con questo nome e cognome nell’evento corrente. Nessun partecipante creato.";
    case "ambiguous": return "Più iscrizioni con lo stesso nome e cognome. Verifica manualmente le schede.";
    case "invalid_service": return "Usa il nome esatto di un servizio attivo del catalogo nel modello.";
    case "invalid_row": return row.error || "Compila nome, cognome e servizio con testo semplice.";
    case "conflict": return "Questo nominativo compare con servizi diversi: nessuna delle righe è stata applicata.";
    case "duplicate": return "La stessa associazione compare già nel file; applicata soltanto una volta.";
  }
}
