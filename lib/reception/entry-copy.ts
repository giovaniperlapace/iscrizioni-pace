// Forum/ceremony desks describe admissions, while general reception keeps its
// existing vocabulary. Apply only to interface copy, never participant data.
const entries: [string, string][] = [
  ['Partecipazione non confermata', 'Ingresso non confermato'],
  ['Partecipazione confermata', 'Ingresso confermato'],
  ['Conferma partecipazione', 'Conferma ingresso'],
  ['Rimuovi presenze selezionate', 'Rimuovi ingressi selezionati'],
  ['Rimuovi presenza', 'Rimuovi ingresso'],
  ['Gestisci Presenze', 'Gestisci ingressi'],
  ['Nessuna presenza modificata', 'Nessun ingresso modificato'],
  ['Presenza già rimossa', 'Ingresso già rimosso'],
  ['Presenze già registrate', 'Ingressi già registrati'],
  ['Presenze della scuola', 'Ingressi della scuola'],
  ['Modifica presenze', 'Modifica ingressi'],
  ['Registra presenze', 'Registra ingressi'],
  ['Salva presenze', 'Salva ingressi'],
  ['della presenza', 'dell’ingresso'],
  ['la sua presenza', 'il suo ingresso'],
  ['le presenze correnti', 'gli ingressi correnti'],
  ['le presenze sono cambiati', 'gli ingressi sono cambiati'],
  ['le presenze', 'gli ingressi'],
  ['delle presenze indicate', 'degli ingressi indicati'],
  ['le persone realmente presenti', 'le persone da ammettere'],
  ['Non ancora presente', 'Ingresso non registrato'],
  ['Già presente', 'Ingresso già registrato'],
  ['✓ Presente', '✓ Ingresso confermato'],
  ['Presenti:', 'Entrati:'],
  ['presenti', 'entrati'],
];
// Resolve longer phrases before their substrings (including Italian articles).
entries.sort(([a], [b]) => b.length - a.length);
export function receptionEntryCopy(value: string, enabled: boolean): string {
  return enabled ? entries.reduce((text, [from, to]) => text.replaceAll(from, to), value) : value;
}
