import { validDutyKey } from "./event-duties.ts";
import { parseReceptionCommand, type ReceptionLookup } from "./contracts.ts";
export type DeskRequest = { target: string; lookup: ReceptionLookup; operation: "preview" | "book"; option?: string; children?: string[]; request?: string };
export type DeskResult = { status: string; name?: string; options?: {id: string; label: string; available: number}[]; children?: {id: string; name: string}[] };
export function parseDeskRequest(input: unknown): DeskRequest | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const x = input as Record<string, unknown>;
  if (Object.keys(x).some(key => !["target","lookup","operation","option","children","request"].includes(key)) || !validDutyKey(x.target) || !["preview","book"].includes(String(x.operation))) return null;
  const command = parseReceptionCommand({duty: x.target === "opening" || x.target === "closing" ? "ceremony_entry" : "panel_entry", panelId:x.target,lookup:x.lookup,action:"inspect"});
  if (!command) return null;
  const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (x.operation === "preview" && [x.option,x.children,x.request].some(v => v !== undefined)) return null;
  if (x.operation === "book" && (!uuid(x.option) || !uuid(x.request) || !Array.isArray(x.children) || x.children.length>10 || !x.children.every(uuid) || new Set(x.children).size!==x.children.length || (["opening","closing"].includes(x.target) && x.children.length))) return null;
  return {...x,lookup:command.lookup} as DeskRequest;
}
export const DESK_MESSAGES: Record<string, string> = {
 invalid:"Codice non valido o iscrizione non disponibile.", forbidden:"Incarico non più autorizzato. Riapri la dashboard.",
 unavailable:"Esito non verificato. Riprova la stessa richiesta prima di proseguire.", invalid_request:"Controlla il codice e la selezione.",
 unconfigured:"La cerimonia non è ancora configurata e validata. Non è possibile assegnare biglietti.",
 panel_unavailable:"Forum non disponibile per le prenotazioni.", attendance_required:"Prima aggiorna e salva i giorni di presenza della persona nella gestione iscritti.",
 capacity_exceeded:"Posti esauriti per questa selezione. Aggiorna le disponibilità.", booking_conflict:"La persona è già prenotata a un altro Forum nella stessa fascia. Gestisci prima quella prenotazione.",
 waitlist:"È attiva una lista d’attesa: gestisci la prenotazione attraverso la coda esistente.", already_booked:"La persona ha già una prenotazione. Rileggi il codice per verificarla.",
 saved:"Prenotazione registrata. Rileggi il codice per confermare separatamente l’ingresso.",
};
