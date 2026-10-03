export const PRESENCE_EXPORTS = [
  { key: "a", code: "A", title: "Presenze per comunità e gruppo", description: "Tutti i gruppi di appartenenza, suddivisi per zona, con subtotali e totale generale." },
  { key: "a2", code: "A/2", title: "Presenze per comunità e gruppo · riepilogo", description: "Accorpa i gruppi previsti dal raccordo: Anziani Roma, Comunità di Roma, comunità africane e dell’America Latina." },
  { key: "b", code: "B", title: "Presenze per gruppo e servizio", description: "Gli operatori sono contati nel gruppo collegato al tag. Gli altri partecipanti con un servizio assegnato sono contati nella sezione Servizi." },
  { key: "b2", code: "B/2", title: "Presenze per gruppo e servizio · riepilogo", description: "Applica le stesse precedenze del report B e accorpa i gruppi secondo il raccordo." },
] as const;

export function isPresenceVariant(value: unknown): value is typeof PRESENCE_EXPORTS[number]["key"] {
  return PRESENCE_EXPORTS.some(report => report.key === value);
}
