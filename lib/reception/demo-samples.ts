import type { DutyOption } from "./event-duties.ts";

// Deliberately synthetic identifiers and tokens, never registered in the database.
export const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEMO_EVENT = demoId(1);
export const DEMO_FORUM_ONE = demoId(2);
export const DEMO_FORUM_TWO = demoId(3);
export const DEMO_OPTION = demoId(4);
export const DEMO_DUTIES: DutyOption[] = [
  {key: DEMO_FORUM_ONE, title: "Forum 1 · Prova", room: "Sala A fittizia", kind: "panel"},
  {key: DEMO_FORUM_TWO, title: "Forum 2 · Prova", room: "Sala B fittizia", kind: "panel"},
  {key: "opening", title: "Cerimonia d’apertura · Prova", room: "Sede fittizia", kind: "ceremony"},
  {key: "closing", title: "Cerimonia finale · Prova", room: "Sede fittizia", kind: "ceremony"},
];

const cases = [
  {code:"F001", name:"Anna", scenario:"Prenotazione corretta", instruction:"Scegli Forum 1: verifica il nome e conferma la presenza.", forum:DEMO_FORUM_ONE},
  {code:"F002", name:"Bruno", scenario:"Forum sbagliato", instruction:"Scegli Forum 1: compare il rinvio al Forum 2. Passa al Forum 2 e ripeti la scansione.", forum:DEMO_FORUM_TWO},
  {code:"F003", name:"Carla", scenario:"Senza prenotazione", instruction:"Scegli Forum 1: compare il rinvio alla postazione iscrizioni. In modalità Computer puoi prenotare, rileggere e confermare l’ingresso."},
  {code:"F004", name:"Diego", scenario:"Già presente", instruction:"Scegli Forum 1: la presenza è già confermata. Puoi provare anche la rimozione esplicita.", forum:DEMO_FORUM_ONE, entered:true},
  {code:"F005", name:"Elena", scenario:"Adulto e minore", instruction:"Scegli Forum 1: Elena e il minore Luca sono prenotati. Selezionali separatamente per confermare le presenze.", forum:DEMO_FORUM_ONE, child:true},
  {code:"F006", name:"Fabio", scenario:"Biglietti cerimonie", instruction:"Scegli apertura: Settore Blu, fila A, posto 12. Scegli finale: Settore Verde, fila B, posto 8.", ceremony:true},
  {code:"F007", name:"Gaia", scenario:"Senza biglietto cerimonia", instruction:"Scegli apertura: nessun biglietto valido. In modalità Computer puoi assegnare un biglietto fittizio e poi rileggere."},
  {code:"F008", name:"Irene", scenario:"QR non valido", instruction:"In qualsiasi incarico viene mostrato codice non valido. Non è possibile prenotare o registrare presenze.", invalid:true},
  {code:"F009", name:"Marco", scenario:"Accoglienza generale mancante", instruction:"Scegli Forum 1: prenotazione presente, ma occorre prima passare dall’accoglienza generale. Non puoi confermare l’ingresso.", forum:DEMO_FORUM_ONE, eventMissing:true},
];
export const DEMO_SAMPLES = cases.map((sample,index) => ({
  forum:undefined as string|undefined, entered:false, child:false, ceremony:false, invalid:false, eventMissing:false,
  ...sample, id:demoId(100+index), childId:demoId(200+index),
  token:`DEMO_FORUM_EVENTS_${sample.code}_`.padEnd(43,"X"),
  image:`/collaudo-forum-eventi/${sample.code}.png`,
}));
