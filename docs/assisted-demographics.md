# Nazionalità, paesi e sesso interno negli inserimenti assistiti

Rilascio autorizzato tramite commit/push su main il 29 settembre 2026. Migration
applicata e registrata atomicamente in produzione prima del push. Nessuna modifica
di dati reali o email di collaudo.

## Moduli e schede

Il modulo condiviso Capogruppo/Manager/Admin aggiunge quattro campi facoltativi:
nazionalità, paese / luogo di nascita, paese di residenza abituale e sesso
(Maschio/Femmina, oppure non indicato). I testi sono disponibili in sette lingue.
La nazionalità propone lo stesso catalogo del pubblico. I paesi offrono
suggerimenti, ma consentono il testo dichiarato anche fuori catalogo.

Nazionalità e nascita usano le chiavi esistenti del questionario `nationality`
e `birthPlace`. Quest'ultima contiene storicamente paese e città: non viene
scomposta, dedotta o sovrascritta automaticamente. La residenza dichiarata viene
salvata in `participants.country_other`; nelle nuove iscrizioni non viene più
copiata dal gruppo. I record preesistenti non cambiano.

La nuova sezione delle schede operative consente di modificare questi tre dati
anche quando la scheda storica è incompleta. Il paese è spostato qui per evitare
due campi modificabili della stessa informazione. Il vecchio aggiornamento dei
contatti/identità conserva il paese se il campo non è inviato. Una lettura fallita
non diventa un modulo vuoto. Snapshot, lock e confronto dei valori impediscono
salvataggi obsoleti (PT409); il questionario conserva le altre risposte.

La sezione usa ReliableForm, feedback, refresh e componenti condivisi; nessuna
modifica alla navigazione delle modali, chiusura locale, focus o scroll.
Il sesso è registrabile solo all'inserimento assistito, non nella scheda personale
né nel nuovo editor dei tre dati geografici.

## Separazione del sesso

Migration revisionabile: `20260929120000_assisted_demographics.sql`.

- Nuova relazione `registration_internal_demographics`, inizialmente vuota,
  collegata all'iscrizione; nessuna colonna aggiunta a partecipanti o questionari.
- RLS abilitata, nessuna policy per gli utenti, privilegi revocati ad anon e
  authenticated. RPC solo service_role, attore sempre dalla sessione server.
- RPC ricontrollano evento corrente, iscrizione viva, Manager/Admin oppure
  gerarchia attiva del capogruppo. Viewer puro, partecipante, accoglienza e
  gruppi estranei esclusi; ruoli cumulativi conservano il proprio scope.
- Inserimento del sesso solo per il creatore dell'iscrizione assistita. Reinvio
  dello stesso valore idempotente; valore diverso rifiutato. Audit senza valore.
- Nessun sesso in questionari, snapshot pubblici, email, QR, statistiche o loader
  delle dashboard. Nessuna inferenza da nome, nazionalità o altri campi.
- La colonna facoltativa usa un caricamento separato solo quando visibile:
  massimo 200 ID per richiesta, verifica DB di ogni ID, nessun risultato parziale
  in caso di errore, cancellazione degli aggiornamenti UI dopo chiusura/nascondimento.
  Le viste figli ed eliminati non caricano il sesso. Nessun valore nel localStorage.
- L'export della tabella include il dato soltanto se la colonna è selezionata,
  con identica autorizzazione DB; le richieste Viewer sono respinte.

La creazione assistita mantiene il flusso multi-scrittura preesistente. La RPC
interna viene eseguita dopo l'assegnazione del gruppo e prima dell'email; un suo
errore impedisce successo e invio. Il flusso complessivo non diventa una singola
transazione: prima del rilascio è necessaria la migration, e un eventuale errore
intermedio va gestito verificando l'iscrizione già creata, senza reinserirla alla
cieca. Le nuove modifiche dei dati geografici, invece, sono atomiche con l'audit.

## Tabelle e verifiche

Nazionalità è una colonna facoltativa comune, con preferenze e ordinamento
esistenti. Il loader paginato legge solo la proiezione della nazionalità, prendendo
l'ultimo questionario; un valore nullo recente non recupera risposte più vecchie.
Export operativo e capogruppo seguono le colonne selezionate.

Test dedicati: `tests/assisted-demographics.test.mts`, estensione del test della
creazione assistita e `tests/sql/assisted-demographics.sql`. Il test SQL si esegue
solo in PostgreSQL temporaneo: comprende scope, ruoli, permessi diretti, record
eliminati, batch misti, dati storici, conflitti, idempotenza e rollback con audit
fallito. Non usare il fixture SQL sul database reale.

Fixture browser: `tests/browser/assisted-demographics.mjs`, trasporto sintetico
senza accesso ai dati reali. Verifica i due moduli in sette lingue, desktop/mobile,
editor storico e conflitti, colonne, caricamento su selezione e Viewer. Le route
provvisorie vengono rimosse; eseguire prima della suite che verifica le route.

Prima del rilascio: revisione/applicazione atomica della migration e registrazione
nel ledger secondo la procedura del repository, poi il normale rilascio del codice.
La migration non modifica partecipanti, risposte storiche, ruoli o policy esistenti.

Verificati 587 test, lint, TypeScript e build production in copia pulita con
`npm ci` dal lockfile. PostgreSQL temporaneo e fixture browser superati: 14
combinazioni lingua/ruolo per gli inserimenti, sette lingue per l'editor,
conflitto/salvataggio, colonne Capogruppo e Manager, Viewer e mobile. Nessuna
fixture di prova rimane sotto `app/`.

## Applicazione in produzione — 29 settembre 2026

Migration e ledger confermati nella stessa transazione. Impronte dei dati e
configurazione RLS/grant delle 38 tabelle preesistenti invariati, così come le
23 routine pubbliche esistenti e le 90 policy. Nuova relazione vuota; verificati
RLS e privilegi delle cinque nuove RPC (solo service_role). Backup dello schema
riservato sul server in `/root/pace-release-20260929-assisted-demographics/`.
Il primo tentativo è stato annullato integralmente da un'ambiguità di alias nel
controllo finale delle impronte; corretto il controllo, la transazione completa
è riuscita. Nessuna scrittura di collaudo su partecipanti o invio email.
