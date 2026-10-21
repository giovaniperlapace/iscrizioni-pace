# Accoglienza forum ed eventi — 21 ottobre 2026

## Comportamento richiesto e implementato

Un solo ruolo visibile, «Accoglienza forum ed eventi», rappresenta gli incarichi
specifici nell’evento corrente. Admin e Manager li assegnano nella sezione
Utenti e ruoli, anche a chi ha già altri ruoli, e li modificano nella stessa
finestra. Selezione multipla, Seleziona tutto e riepilogo «Tutti gli incarichi».
La selezione completa riguarda il catalogo corrente: un Forum aggiunto in seguito
richiede assegnazione esplicita. Le modifiche rilevano un elenco atteso superato.
Il ruolo non concede Accoglienza generale, Manager o gestione delle cerimonie.

La nuova dashboard `/dashboard/accoglienza-forum-eventi` propone la postazione
Telefono/Computer e la scelta ricercabile dell’incarico prima della fotocamera.
Con un solo incarico non richiede una scelta ridondante. Cambia incarico e Cambia
modalità svuotano la scheda precedente; sono sospesi durante scritture o esiti
incerti. La fotocamera si avvia esplicitamente, come nell’Accoglienza esistente.

Telefono: QR, verifica e conferma esplicita semplice della presenza. Messaggi
vicino alla scansione indicano prenotazione assente o altro Forum nella stessa
fascia, con nome e sala pertinenti. Non esiste un comando di ammissione senza
prenotazione. Le scuole conservano il percorso delle quantità effettive.
Computer: codice manuale o scanner USB, verifica disponibilità e nuova prenotazione
al Forum assegnato o biglietto per la cerimonia. La prenotazione non registra
l’ingresso; si rilegge il codice e si conferma separatamente. Per gli utenti anche
Manager/Admin sono disponibili i collegamenti a gestione e nuovo partecipante.

Le prenotazioni rispettano apertura, capienza, minori esplicitamente selezionati,
presenza dichiarata, incompatibilità di fascia e lista d’attesa. Nessuno scavalco
della coda o sostituzione implicita di un’altra prenotazione. Statistiche del solo
incarico: prenotati/assegnatari e ingressi registrati; questi ultimi non misurano
le persone ancora nella sala. Aggiornamento manuale e dopo le operazioni riuscite.

Cerimonie: incarichi apertura/finale assegnabili anche prima della configurazione.
Lettura dei biglietti, settore, eventuale posto e stato di revisione; persone e
minori distinti. Gli ingressi sono separati da quelli generali e dei Forum.
La postazione assegna il biglietto al titolare del codice; le assegnazioni dei
minori restano nella distribuzione della cerimonia, indicato esplicitamente.
Non sono state inventate sedi, capienze o assegnazioni reali.

## Implementazione e confini

Migration `20261021120000_forum_event_reception`: riuso degli incarichi Forum,
nuovi incarichi cerimonia e RPC dedicate. Nessuna aggiunta all’enum dei ruoli
operativi generali. Controlli freschi lato server/DB su evento corrente e incarico,
lock di autorizzazione, token canonici, audit e richieste idempotenti. Le RPC di
comando sono service-only; il catalogo autenticato restituisce soltanto gli
incarichi dell’utente, oppure il catalogo completo a Manager/Admin per assegnarli.
Letture HTTP private/no-store, controllo same-origin, timeout e ripetizione dello
stesso comando in caso di esito incerto. Nessuna persistenza browser dei QR.

## Verifiche

- Pull iniziale fast-forward `76d8720` → `0af0f20`; conservato il successivo
  aggiornamento del collega `b8dbf0f`. Fetch finale: main allineato al remoto.
- 1.007 test applicativi, TypeScript e lint completo superati.
- Build production riuscita in copia senza credenziali, dipendenze da `npm ci`.
- Suite SQL canonica Forum/coda e nuova suite PostgreSQL temporanea: scope,
  Manager/Admin/Viewer, revoca, modifica concorrente, selezione minori, retry,
  separazione prenotazione/ingresso, cerimonie, annullamenti e ACL. Due postazioni
  sull’ultimo posto: un salvataggio e un rifiuto per capienza, nessun overbooking.
- Browser Chrome desktop e viewport telefono con pagina, componenti, Server Action
  e route originali, trasporto Auth/PostgREST sintetico e SQL temporaneo: modifica
  incarichi, seleziona tutto, riepilogo compatto, prenotazione, conferma ingresso,
  Forum sbagliato, cambio incarico, revoca, origine/evento errati e assenza overflow.
  QR decodificato dal componente fotocamera originale da stream canvas sintetico.
- Runner riproducibile: `node tests/browser/run-forum-event-reception.mjs`, con
  `PLAYWRIGHT_MODULE` se Playwright non è installato nel normale percorso Node.
  Usa PostgreSQL 17 Homebrew, Chrome macOS, porte locali 3198/55490 e socket 55489;
  crea una copia senza credenziali e una route fixture esclusivamente temporanea.
- Nessun invio reale, stampa fisica, assegnazione ruolo a persone reali o scrittura
  di prenotazioni/presenze remote di collaudo. Revisione autenticata online con
  persone e sedi reali ancora da svolgere.

## Migration production

Applicata e registrata atomicamente dopo backup custom, catalogo e lettura completa
verificati. Backup remoto da 17.060.584 byte:
`/root/backups/iscrizioni-pace/production-before-forum-events-1792576771672.dump`.
SHA-256 `565b265b266e130f2ce90d96e975f1fde134ce836d23873edf9adf084e0bf13d`.

Guard verificato prima su PostgreSQL temporaneo; nella transazione production
confrontate 67 tabelle e 173.487 righe invariate, 2.854 voci catalogo preesistenti.
Sola definizione preesistente modificata: `has_panel_reception_duty`; proprietari,
ACL, RLS e dati conservati. Nessun incarico reale creato. Confermati `open` e
`school_link_enabled=true`, già presenti prima del rilascio.

Codice pronto per il rilascio su main; esito deployment registrato a seguire.
