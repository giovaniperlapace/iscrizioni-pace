# Coda e fasce Forum — 14 ottobre 2026

## Rilascio autorizzato — 14 ottobre 2026

L’utente autorizza esplicitamente migration production, commit e push su main,
mantenendo la home attuale e le iscrizioni ai Forum chiuse. Questa richiesta
supera i limiti della preparazione locale descritta sotto. Staging escluso.

Migration `20261014150000_forum_waitlist` applicata e registrata nella stessa
transazione, con reload PostgREST al commit. PostgreSQL production 15.8; tutte
le dipendenze presenti nel registro. La migration dati storica
`20260726120000_stop_unselected_group_auto_assignment` resta esclusa/non registrata.

Backup custom completo sul server, verificato con `pg_restore --list`, permessi
600 (8.627.129 byte): `/tmp/iscrizioni-pace-production-before-forum-waitlist-20261014-1791979829006.dump`.
SHA-256 `7b1e43a44b8f90814286a027a339debc6745f32f25fd549c07fa6639038622b5`.

Confronto repeatable-read prima/dopo, nella transazione di applicazione: tutte
le colonne e impronte ordinate delle 61 tabelle pubbliche preesistenti,
84.410 righe invariate. Le 132 policy restano identiche; confrontate anche
le 155 funzioni preesistenti e 337 voci di privilegi. Modificate soltanto le
funzioni dichiarate nella migration. Conservati i grant service_role preesistenti;
revocato volutamente il vecchio grant anon del catalogo personale, accessibile
ad authenticated soltanto per la propria iscrizione. Un primo confronto che
non distingueva questa revoca prevista è terminato interamente in rollback.

Schema verificato dopo il commit: coda vuota, singleton scheduler presente,
worker solo service_role, catalogo pubblico vuoto, modalità `internal` invariata.
Il Forum già configurato con `is_public=true` non è stato alterato: la chiusura
continua a dipendere dal gate dell’evento. Nessuna iscrizione, presenza, token,
ruolo/account o email di prova modificati/creati. Timer systemd email attivo,
ultimo servizio concluso con successo; variabili Vercel production richieste
presenti. Nessuna configurazione del timer o delle variabili modificata.

Il push autorizzato su main avvia il normale deployment Git Vercel del progetto
`giovaniperlapaces-projects/iscrizioni-pace`. Al termine controllare la revisione
pubblicata, lo stato READY, l’alias `registrationspeace.santegidio.org`, il testo
visibile della home, i redirect di Forum/scuole e il gate DB. Il risultato del
controllo deployment viene riportato nella chat del rilascio.

Preparazione iniziale locale su `main`, su richiesta dell’utente. Identificatori panel
conservati; testi operativi Forum. Home pubblica e modalità `internal` invariati.
Nessun commit/push, deployment, SQL remoto, modifica di dati reali o invio email
eseguito durante la preparazione iniziale; autorizzazione e applicazione
production documentate sopra.

## Regole

- Un Forum per giorno e fascia, nel fuso Europe/Rome: inizi prima delle 12 nella
  mattina, dalle 12 nel pomeriggio. I Forum delle 16 e delle 17 appartengono
  alla stessa fascia anche quando gli intervalli non si sovrappongono. Rimane
  anche il divieto preesistente di sovrapporre intervalli che attraversano fasce.
  Controlli server, catalogo individuale, azioni capogruppo e constraint DB.
- La regola compare nel riepilogo e subito prima della conferma nella scheda,
  anche quando si arriva dal collegamento diretto di un Forum.
- Forum pieno: **Mettiti in coda per questo Forum**. Iscrizione alla coda
  esplicita, idempotente, una voce attiva per iscrizione/Forum. La posizione è
  calcolata nella coda in attesa; nessuna identità altrui è esposta.
- La coda non impedisce di prenotare un altro Forum nella stessa fascia.
  Coda e offerte su Forum diversi restano indipendenti.
- Il controllo automatico assegna i posti disponibili in FIFO, per quota
  individuale. I minori conservano la scelta del genitore e consumano posti:
  prima di invitare il nucleo devono esserci tutti i posti necessari. Un nucleo
  più piccolo non scavalca quello che lo precede.
- Un posto individuale liberato dalla disiscrizione, dalla cancellazione/
  eliminazione dell’iscrizione o dall’aumento della quota diventa assegnabile.
  Una sala più grande permette di aumentare la quota individuale nel gestionale;
  la capienza fisica non sostituisce le quote esplicite. La quota scuole rimane
  separata: diminuirla libera assegnazione fisica, e i posti individuali aumentano
  quando il Manager aggiorna la relativa quota. Il totale resta vincolato alla sala.
- Avviso Postmark transazionale in sette lingue: titolo, data/ora e luogo,
  scadenza esatta a Roma e collegamento al Forum. Destinatario: account Auth
  proprietario che ha chiesto di entrare in coda; ricontrollato prima dell’invio.
  Nessun account Auth o magic link creato dal worker; login ordinario se necessario.
- I posti sono riservati realmente. L’invito concede 30 minuti dal tentativo
  iniziale di invio, con scadenza persistita prima di contattare il provider.
  Non è una garanzia sull’istante di recapito nella casella del destinatario.
- L’accettazione è un POST autenticato esplicito. Nel medesimo commit il sistema
  consuma la riserva, cancella le scelte incompatibili e crea la scelta canonica.
  Se fallisce qualsiasi controllo, la prenotazione precedente rimane valida.
  L’avviso del cambio è visibile prima del pulsante. Retry idempotenti.
- Alla scadenza, la conferma è negata subito. Al prossimo controllo il posto
  passa alla nuova prima persona in attesa; a coda vuota torna disponibile.
  Una persona scaduta può rimettersi in coda, in fondo, con un nuovo clic.
  È possibile lasciare la coda o rifiutare il posto senza annullare l’altro Forum.
- I posti oltre quelli necessari per le persone in attesa rimangono prenotabili
  anche mentre esistono offerte riservate. Le prenotazioni ordinarie e capogruppo
  conteggiano le riserve e non scavalcano una voce FIFO che attende posti sufficienti.
- Aumento/diminuzione del numero dei minori durante un’offerta: prima uscire dalla
  coda. Questo evita di cambiare la quantità di posti già riservata; i controlli
  preesistenti sulle capienze delle iscrizioni confermate restano attivi.

## Controllo ogni cinque minuti

Riutilizzato `/api/cron/email-campaigns`, protetto da `CRON_SECRET`, chiamato dal
timer systemd esistente. I due worker si eseguono indipendentemente: un errore
nel worker Forum non interrompe le campagne. Il nuovo record singleton
`panel_waitlist_scheduler.next_run_at` limita l’assegnazione a un ciclo ogni
cinque minuti anche con richieste sovrapposte. L’effettiva partenza dipende dal
successivo giro del timer: i cinque minuti sono la cadenza minima, non una
promessa di esecuzione al millisecondo.

La schermata individuale aggiorna solo il catalogo Forum ogni 300.000 ms, senza
richieste concorrenti, con abort alla chiusura. La risposta autenticata è privata
no-store. Errori di lettura sono visibili; accesso revocato o chiusura rimuovono
le card. Nessun polling aggiunto alle Statistiche ingressi. Il click continua a
verificare disponibilità e scadenza nel DB, indipendentemente dai dati mostrati.

Prima del recapito, il worker acquisisce un claim persistente. Gli stati sending,
sent, failed e unknown non vengono riacquisiti automaticamente: timeout o esito
incerto non causano email duplicate. Un errore di salvataggio dopo l’invio conserva
sending. Il posto resta accessibile dal catalogo fino alla scadenza; per eventuali
anomalie di recapito serve riconciliazione operativa, non un reinvio cieco.

## Migration e rilascio

Nuova migration additive `20261014150000_forum_waitlist.sql`, inizialmente solo
locale e poi applicata in production con la successiva autorizzazione sopra. Tabelle coda/scheduler con RLS e nessun accesso diretto anon/auth;
RPC partecipante limitate alla propria iscrizione, worker esclusivamente service.
Gli iscritti restano in `moment_attendance_choices`: nessun duplicato modello
prenotazioni. Le offerte occupano capacità, ma non sono iscrizioni o presenze.
Nessuna rotazione QR o modifica degli scanner. Audit per entrata, uscita, offerta,
scadenza, accettazione e risultato invio; il cambio registra gli ID dei Forum rimossi.

Preflight della migration: eventuali scelte attive già nella stessa fascia
bloccano l’applicazione, senza annullarle automaticamente. Prima del rilascio
servono l’inventario migration dell’ambiente, backup/verifica schema, applicazione
autorizzata della nuova migration prima del codice e controllo del timer e delle
variabili Postmark/URL. Il codice non apre la home o le prenotazioni. Le autorizzazioni
per rilascio/migration di tranche precedenti non vengono riutilizzate.

## Verifiche

- Tutte le migration canoniche eseguite in PostgreSQL locale temporaneo, esclusa
  la migration dati storica priva dei gruppi sorgente nella fixture.
- Test SQL: mattina non sovrapposta, 16/17, giorni distinti, FIFO, uno/cinque
  posti, riassegnazione quota scuole, posti residui, blocco riduzioni, figli,
  proprietà/RLS, scadenza esatta, nuovo primo, retry, chiusura e invii incerti.
- Connessioni concorrenti: sei worker/una notifica, sei accettazioni/una sola
  iscrizione e contesa per l’ultimo posto.
- Browser desktop/mobile e sette lingue con trasporto sintetico/orologio virtuale:
  stati/pulsanti, testo cambio, aggiornamento al quinto minuto, revoca e CTA home.
- Browser reale → Server Action reale → trasporto Supabase sintetico → PostgreSQL
  locale reale → nuova scelta/cancellazione canoniche → card reale aggiornata.
  Nessun provider email chiamato da questo collaudo.
- 874 test applicativi, ESLint, TypeScript e build production da copia pulita con
  `npm ci` superati. Corretto il solo conteggio obsoleto di un test Statistiche:
  le sette categorie, inclusi gli ingressi già approvati, restano invariate.

Comandi: `node --test tests/forum-waitlist.test.mts`,
`node tests/sql/run-forum-waitlist.mjs`. Per il browser avviare Next locale con
Supabase sintetico `http://127.0.0.1:55485`, email in modalità log e URL applicativi
loopback; impostare `PLAYWRIGHT_MODULE` al runtime disponibile, quindi eseguire
`node tests/browser/forum-waitlist.mjs http://127.0.0.1:3164` e
`node tests/sql/run-forum-waitlist.mjs --browser`. Le route fixture vengono rimosse
al termine, non fanno parte del prodotto.
