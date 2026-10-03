export const STATISTICS_REPORTS = [
  { key: "territory", label: "Gruppi e partecipanti" },
  { key: "attendance", label: "Presenze" },
  { key: "age", label: "Fasce di età" },
  { key: "registrations", label: "Iscrizioni per settimana" },
  { key: "disability", label: "Disabilità e difficoltà" },
] as const;

export type StatisticsReport = typeof STATISTICS_REPORTS[number]["key"];

export function resolveStatisticsReport(value: string | undefined): StatisticsReport {
  return STATISTICS_REPORTS.find(report => report.key === value)?.key ?? "territory";
}
