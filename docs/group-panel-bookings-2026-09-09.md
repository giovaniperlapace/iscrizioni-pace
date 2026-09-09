# Iscrizioni multiple ai panel — verifica staging

Implementazione: `3a69e69`, sul branch `codex/panel-p0-p10`, dopo il merge
`eab29a7` da `origin/main`. Preview verificata READY:
`dpl_HPKnBqBhffjdFCvfuZ9xMgq3dZnP`.

## Esito

- 291 test applicativi passati; lint e typecheck senza errori; build staging
  completata, inclusa la route `/dashboard/capogruppo/panel`.
- `tests/sql/group-panel-bookings-rollback-check.sql` eseguito sul database
  staging con rollback finale: scope ricorsivo, selezione esplicita, rifiuto
  fuori scope, nessun salvataggio parziale, conteggio minori, quota piena,
  sovrapposizioni, deduplicazione, retry idempotente, blocco anonimi/nonleader,
  manager_viewer con membership e iscrizioni eliminate.
- Concorrenza reale: due connessioni PostgreSQL separate, due adulti e una
  sezione temporanea da un posto. Una transazione ha confermato un posto;
  l'altra ha ricevuto `panel section is full`. La fixture temporanea e le
  relative scelte sono state rimosse dopo il controllo.
- Browser sulla preview con account capogruppo sintetico: il collegamento
  dalla dashboard apre la nuova pagina; filtro per nome e selezione generale
  filtrata mantengono le persone selezionate fuori vista; il riepilogo mostra
  due iscrizioni e tre posti; la conferma salva entrambi gli adulti e il minore
  collegato, riducendo la quota da 50 a 47. Le righe risultano `Già iscritto`.
- Passando al panel contemporaneo, gli stessi due adulti risultano
  `Panel sovrapposto` con checkbox disabilitate. Carla e Davide restano
  disponibili per ulteriori prove dell'utente.
- Layout verificato desktop e viewport mobile 390×844: controlli utilizzabili,
  tabella con scorrimento orizzontale, riepilogo e pulsanti su più righe.
  Nessun errore o warning nella console browser. Viewport ripristinato.

## Confini

Solo staging: nessun merge su main, nessun deploy o migration production,
nessuna email inviata. Le prenotazioni sintetiche su `Dialogo tra generazioni`
restano visibili per la revisione. Per la diagnosi DNS e la migration dati non
applicabile alla fixture, vedere la sezione del 2026-09-09 in `AGENTS.md`.
