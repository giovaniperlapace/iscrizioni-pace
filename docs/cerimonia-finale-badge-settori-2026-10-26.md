# Cerimonia finale: tre settori e badge — 26 ottobre 2026

## Stato

Commit, push e rilascio production autorizzati esplicitamente dall’utente dopo
il backup. Invii dei tre nuovi settori da mantenere disattivati fino ai testi
definitivi. Il controllo iniziale (revisione 15) non trovava dati operativi;
prima del rilascio il piano è invece alla revisione 20: Sant’Andrea ha ricevuto
20 posti in B e 30 in C, con una nomina attiva, due bozze già pubblicate e
quattro email già accettate da Postmark. L’utente ha esplicitamente richiesto di
revocare queste assegnazioni e ripartire dai tre settori vuoti. La revoca passa
dalla RPC canonica; righe originali e revocate, bozze e configurazione storica
sono archiviate integralmente nell’audit prima di togliere le righe dal registro
operativo dei vecchi settori. Le quattro email e le ricevute restano intatte.
Una fotografia esatta di revisioni, ID, quantità e stati impedisce di estendere
la revoca ad assegnazioni sopraggiunte. Nessuna comunicazione di revoca aggiunta.

La nuova richiesta supera la precedente geometria A–E/esterno/prato e la
riserva protocollo: tre settori a riempimento, tutti i posti assegnabili.

| Settore | Badge | Posti |
| --- | --- | ---: |
| Chiesa Basilica inferiore | Arancione | 200 |
| Piazza inferiore | Viola | 1.100 |
| Prato Basilica superiore | Verde | 2.200 |
| Totale | | 3.500 |

Orario conservato: **27 ottobre 2026, 16:15–19:30 Europe/Rome**.
Overbooking iniziale zero. I simboli indicano quantità, non file o sedie
individuali. Il colore del badge è indicato nell’intestazione; la legenda dei
posti mantiene distinti libero, bozza, nominale e gruppo da abbinare.

## Badge, sito e scanner

- Riutilizzati i tre asset versionati già presenti, corrispondenti ai badge
  forniti. Nome e cognome canonici nella fascia bianca, senza gruppo aggiunto.
- Email personale con **PDF allegato scaricabile** e JPEG incorporato tramite
  CID. Ogni adulto/minore esplicitamente assegnato ha il proprio badge; più
  membri della stessa famiglia hanno filename e CID distinti.
- Badge visibile nella sezione cerimonie della propria iscrizione, con download
  PDF. Il capogruppo trova il download nelle assegnazioni nominali del settore.
  Etichette e colori nelle sette lingue supportate.
- Endpoint privato `/dashboard/ceremonies/badge`: identità autenticata, RPC
  service-only con controllo dell’evento, titolarità o scope corrente del gruppo
  (oppure Admin/Manager), nomina e iscrizione attive; nessun nome accettato dal
  browser. Cache disabilitata, revoca immediatamente effettiva sui download.
- Il QR personale esistente conserva il token opaco. La proiezione server
  restituisce il codice canonico del badge; scanner finale mostra settore e
  colore per adulto e minori. Nessun ingresso implicito aggiunto.

## Invii e report

Le pubblicazioni Manager/Admin continuano ad accodare una notifica per
iscrizione/famiglia e un riepilogo per capogruppo sulle quantità pubblicate.
Le bozze non sono visibili ai destinatari e non generano email.

L’abbinamento nominale del capogruppo accoda ora la notifica nella stessa
transazione della RPC canonica. Lotti atomici, revisione, incarichi, minori e
ricevute idempotenti restano attivi. Retry o fallimenti di capacità non creano
messaggi duplicati o parziali. L’inaugurazione mantiene il comportamento precedente.

Al claim si ricontrollano nomine, minori, iscrizioni, contatto personale e scope:

1. Con email personale non delegata: stesso messaggio e badge del percorso
   Manager, anche se il contatto è stato aggiunto dopo l’abbinamento.
2. Senza email personale: report cumulativo al capogruppo ancora autorizzato
   (preferenza per chi ha eseguito l’abbinamento, altrimenti referente corrente).
   Contiene nomi, settori, colori, istruzioni e fotografia temporale esplicita.
   Le notifiche pendenti dello stesso referente vengono raccolte nel report;
   le righe sorgenti conservano il suo identificativo per la verifica dell’esito.
   Nessun limite applicativo alle prime 1.000 persone. I badge sono scaricabili
   dalla dashboard; il report non allega migliaia di PDF.
3. Senza contatto personale né capogruppo corrente utilizzabile: fallimento
   esplicito, senza inventare un destinatario.

Il report gestionale include anche gli abbinamenti del capogruppo, oltre alle
pubblicazioni delle bozze. Accettazione Postmark e consegna restano distinte;
incerti e falliti non vengono riaccodati automaticamente. Il report cumulativo
può includere assegnazioni già presenti: serve al capogruppo come elenco aggiornato,
non come conteggio di sole nuove nomine.

## Istruzioni ancora da ricevere

Migration `20261026160000_closing_ceremony_badges.sql`: tabella protetta con
interruttore **disattivato**. Assenza di configurazione equivale a invii bloccati
per il nuovo layout; anche i riepiloghi di gruppo restano in coda.

La RPC Admin `set_closing_badge_delivery` richiede evento corrente, revisione,
lock e testi non vuoti italiano/inglese per tutti e tre i codici
`CLOSING_ORANGE`, `CLOSING_PURPLE`, `CLOSING_GREEN`. Attivazione e testi sono
registrati nell’audit. Nessun testo di accesso reale è stato inventato o attivato:
le frasi usate nei test sono marcate sintetiche e non entrano nella configurazione.

## Compatibilità Postmark

- Metadata conservato: `ceremony_email_id`, entro 20 caratteri; validazione
  preventiva dei limiti 10 campi, chiave 20 e valore 80 caratteri.
- Un destinatario per chiamata; HTML e testo presenti, escaping dei contenuti,
  PDF `application/pdf`, immagini `image/jpeg`, `ContentID` con prefisso `cid:`.
- Massimo 6 MiB complessivi dei badge della famiglia. Il trasporto controlla
  anche corpo e JSON già codificato in Base64, con soglia prudenziale di 9 MB;
  allegati vuoti e payload troppo grandi vengono rifiutati prima della rete.
- Script `scripts/verify-closing-badges-postmark.mjs` usa esclusivamente
  `POSTMARK_API_TEST`: arancione, viola, verde, famiglia con tre PDF/CID,
  riepilogo gruppo e report di 1.005 persone **accettati con ErrorCode 0**,
  senza consegna e senza errore 300.

Riferimenti ufficiali verificati:
[errore 300](https://postmarkapp.com/support/article/1180-what-does-errorcode-300-mean),
[limiti di corpi e allegati](https://postmarkapp.com/support/article/1056-what-are-the-attachment-and-email-size-limits).

## Verifiche e limiti

- **1.202 test applicativi passati**, TypeScript, lint mirato e build production
  locali passati. Lint generale fermo ai tre errori `no-explicit-any` preesistenti
  in `tests/ceremony-navigation.test.mts` (file non modificato), più un warning.
- Test endpoint: autenticazione, attore non falsificabile, permessi, revoca,
  errori distinti, PDF allegato e risposta privata/no-store.
- PostgreSQL temporaneo: intera regressione cerimonie/concorrenza più sostituzione,
  tre capienze esatte e rifiuto di un posto ulteriore per settore, bozza invisibile,
  pubblicazione diretta, lotti capogruppo, retry, rollback completo, revoca minore,
  download e proiezione QR, ruoli e blocco invii senza istruzioni.
- Lotto SQL di 1.005 nomine: un contatto personale aggiunto successivamente
  riceve il messaggio diretto; 1.004 nomi confluiscono in un solo report,
  1.003 notifiche sorgenti vi sono collegate. Esiti incerti non reinviati.
- Concorrenza specifica finale: doppio invio dello stesso lotto accoda una sola
  notifica; ultimo posto di gruppo conteso con un solo vincitore; due processi
  concorrenti acquisiscono un solo report cumulativo, con sorgenti collegate.
- Browser dei componenti originali in copia isolata, con risposte API sintetiche:
  320/390/1024/1440px, 3.500 simboli, selezione, pulsanti disabilitati, nessun
  overflow, anteprime e tre download PDF; nessun errore JavaScript.
  Per il collaudo visivo il layout della copia usa il font di sistema e un
  endpoint sintetico; il vero endpoint è verificato separatamente con i suoi
  controlli di sessione e le RPC su PostgreSQL. Nessuna sessione reale usata.
- Asset dei tre badge e font locale presenti nel bundle production del download.
- Esempi sintetici in `output/closing-badges/`: PDF/JPEG e schermate responsive.

## Backup prima del rilascio

Backup completo sul server, permessi 600, verificato con `pg_restore --list` e
decodifica integrale: **31.688.768 byte**.

`/root/backups/iscrizioni-pace/production-before-closing-badges-1793039841649.dump`

SHA-256: `636357e9f924b276fdb1d9e40bedf9ee8f0e5c1379ad777236ce94c9abee4531`.

La copia pulita del rilascio esclude i promemoria Forum. `npm ci` ha rilevato
tre dipendenze transitive mancanti nel lockfile pubblicato: inclusa la correzione
locale già esistente, senza modifiche alle dipendenze dichiarate. **1.188 test**,
TypeScript e build production della copia pulita passati.

## Rilascio da completare

1. Commit/push e pubblicazione del codice autorizzati, conservando
   separatamente i lavori locali sui promemoria Forum.
2. Backup completo verificato prima delle operazioni SQL. Fotografare dati,
   funzioni, proprietari e ACL; nessun test operativo su iscritti reali.
3. Applicare/registrare la migration dei badge. Non è dipendente dalla migration
   locale dei promemoria Forum, che non va inclusa implicitamente.
4. Eseguire prima `scripts/archive-closing-assignments-before-badges-2026-10-26.sql`
   con `app.closing_reset_expected` uguale alla fotografia verificata delle sole
   assegnazioni autorizzate; poi
   `scripts/replace-closing-sectors-with-badges-2026-10-26.sql`, nella stessa
   singola transazione con `app.closing_event` e `app.closing_actor` Admin,
   timeout di lock/statement e verifica prima del commit. Il comando rifiuta
   qualunque ulteriore riga operativa e una seconda esecuzione; consente solo
   le notifiche storiche terminali dopo la revoca/archiviazione autorizzata.
5. Verificare tre settori, quote 200/1.100/2.200, totale 3.500, orario Roma,
   overbooking zero, inaugurazione invariata e invii ancora disattivati.
6. Solo dopo ricezione e approvazione dei testi, attivare con la RPC dedicata e
   controllare il report. Nessun ripristino globale del backup su un evento
   operativo e nessun reinvio automatico degli esiti incerti.
