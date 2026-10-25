# Accoglienza: disponibilità della sala collegata dal Forum principale

## Comportamento

Nell’incarico del Forum principale, il riepilogo «Sala collegata · Solo in
italiano» compare **dopo la scheda completa del QR e le sue azioni**, prima
delle ultime letture. La posizione è la stessa per fotocamera, manuale e USB.
Prima della lettura rimane disponibile nella stessa sezione della pagina.

Mostra sede, posti rimanenti, ingressi registrati e capienza fisica. Il residuo
è `max(0, capienza − entrati)`: adulti e minori contano uno ciascuno, scuole
per studenti più accompagnatori; ingressi annullati esclusi. Non rappresenta
posti ancora prenotabili: serve per orientare gli operatori quando la sala
principale è piena. La nota richiama gli ingressi registrati e la necessità di
una prenotazione valida per la sala collegata. I controlli di ingresso sono
quelli già esistenti; questo riepilogo non autorizza trasferimenti o ingressi.

Capienza raggiunta segnalata esplicitamente; errore o capienza sconosciuta
non diventano mai zero posti. Nessun riepilogo per Forum senza collegamento,
incarico della sala collegata stessa, verifica iscrizione o cerimonie.

Aggiornamento all’apertura dell’incarico, con «Aggiorna conteggi» e dopo
operazioni di ingresso/rimozione/prenotazione riuscite. Nessun polling;
le variazioni registrate da altri operatori si rileggono con il pulsante.
Durante l’aggiornamento il vecchio residuo lascia posto allo stato di
caricamento; un errore secondario non cancella i contatori principali.
Scheda, selezioni e stream non vengono riavviati dai conteggi. Risposte di
incarichi o richieste precedenti scartate dalla pulizia dell’effetto React.

## Dati e autorizzazione

Nuova RPC `reception_relay_room_statistics(uuid,uuid,uuid)`: STABLE, sola
lettura, SECURITY DEFINER con search_path vuoto, eseguibile solo da service_role.
Rilegge evento corrente e incarico panel_entry dell’operatore. Il percorso
HTTP verifica sessione/evento/origine e autorizza prima le statistiche canoniche.
Risposte private/no-store, soltanto aggregati e dati della sede.

Relazione da `panel_relay_rooms`, non da titoli o ID cablati. Sala collegata
pubblicata nello stesso evento e intervallo del Forum; capienza da
`event_locations.max_capacity`, ingressi attivi da `check_ins`. Non cambia
funzioni operative, prenotazioni, ingressi, assegnazioni o dati personali.

## Verifiche

- 1.145 test e suite SQL passati sulla copia esatta preparata per il commit.
  Nella working tree, con il test locale degli incarichi anticipati: 1.146 test.
  TypeScript, lint mirato e build production riusciti in copia
  isolata con dipendenze installate tramite npm ci. Come nella verifica della
  fotocamera, il lockfile upstream è stato completato solo nella copia
  temporanea: nessuna modifica a manifest o lockfile del repository.
- Suite PostgreSQL temporanea: migrazioni, integrità dati/ACL, autorizzazione
  per evento/incarico, adulti/minori/scuole, annullamenti, relazione unidirezionale,
  sala non pubblicata, fascia errata e regressioni concorrenza passati.
- Browser originale desktop 1360px e mobile 390px, con QR sintetico tramite
  getUserMedia e decoder originali → endpoint reale → PostgreSQL temporaneo.
  Posizione sotto scheda/azioni e prima dello storico, totale principale
  separato, sala piena, errore RPC/retry, aggiornamento dopo ingresso,
  Forum senza collegamento, incarico collegato, fotocamera conservata e
  arresto/ripresa passati. Nessun overflow orizzontale o errore JavaScript.
- Anteprime locali: `/tmp/pace-relay-desktop.png`, `/tmp/pace-relay-mobile.png`.
- Il lint generale ha già tre errori preesistenti in
  `tests/ceremony-navigation.test.mts`; lint mirato superato.

Comandi dedicati:

```sh
node --test tests/reception-relay-statistics.test.mts
node tests/sql/run-forum-events.mjs
RELAY_STATS_ONLY=1 PLAYWRIGHT_MODULE=/percorso/playwright/index.mjs node tests/browser/run-forum-event-reception.mjs
```

## Rilascio

Migration `20261025190000` applicata e registrata in produzione, con refresh
dello schema PostgREST, dopo backup completo verificato con indice e decodifica:
`/root/backups/iscrizioni-pace/production-before-relay-statistics-1792949854434.dump`,
27.418.920 byte, permessi 600, SHA256
`f9f52e2111794b8c702f39e5a74877880b4dc019ac2fca3cad45603d81bbca52`.

Controlli atomici: 74 tabelle, 274.215 righe preesistenti e 242 funzioni/ACL
conservate, policy e trigger invariati. Unica aggiunta la RPC di lettura.
Nessun ingresso, prenotazione o invio reale di prova.

Lettura live confermata sui sei collegamenti per tutti i 57 operatori attuali
(342 incarichi principali): Domus Letitiae 156 e Serafico 110, ingressi zero
al controllo. Registro migration verificato.
