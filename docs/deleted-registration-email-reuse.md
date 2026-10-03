# Riutilizzo email dopo eliminazione — 22 settembre 2026

> Aggiornamento rilascio 22 settembre 2026: migration applicata e registrata in
> produzione nella stessa transazione delle altre due attività, prima del push
> su main autorizzato. Controlli integrati: 439 test, lint, TypeScript, build,
> SQL e browser superati. Le indicazioni sotto sul mancato rilascio descrivono
> lo stato preparatorio. Verificate invarianza di 13 tabelle operative e RLS;
> la sola migration email ha scollegato 11 identità eliminate, con audit.
> Test incrociato: `psql -U postgres -v ON_ERROR_STOP=1 -f tests/sql/combined-operational-release.sql`
> esclusivamente in un database temporaneo vuoto.

## Comportamento

L'eliminazione logica libera l'email per una nuova iscrizione nello stesso evento.
Un'altra iscrizione attiva con quella email continua a bloccare l'inserimento.
La nuova scheda conserva identità, QR e dati separati dallo storico eliminato;
è possibile reiscrivere la stessa persona oppure una persona diversa.

Il controllo precedente includeva esplicitamente `deleted_at not null`.
Anche il controllo omonimi del capogruppo e l’anteprima Excel impedivano la
ricreazione. Tutti escludono ora gli eliminati. I controlli email sono paginati e interrompono
l'operazione se fallisce una lettura: un errore non equivale a email disponibile.

`email-identity.ts` esclude dalle identità riutilizzabili i partecipanti con sole
iscrizioni eliminate. Mantiene quelli ancora iscritti in altri eventi e quelli
operativi senza iscrizioni. Il filtro si applica a sincronizzazione nomi/account,
collegamento al login, ricerca referenti, suggerimenti e modifica contatti.
I contatti storici rimangono conservati ma non vengono usati per aggiornare o
ricollegare una persona eliminata quando l'indirizzo viene riutilizzato.

## Migrazione e rilascio

`20260922200000_deleted_registration_email_reuse.sql` aggiorna la RPC di ciclo
vita: dopo annullamento coda e audit esistenti, scollega l'account dalla scheda
che non ha più iscrizioni attive, con audit dedicato. Corregge anche le schede
già eliminate. L'account Auth e gli eventuali ruoli operativi rimangono: una
eliminazione di iscrizione non deve cancellare incarichi in altri gruppi/eventi.
Il nuovo partecipante può collegarsi all'account verificando la stessa casella.

Il ripristino amministrativo viene rifiutato con PT409 se l'email è stata
riutilizzata in una diversa iscrizione attiva dello stesso evento. Un ripristino
consentito non ripristina implicitamente il collegamento Auth; lo farà il login.
Grant, autorizzazioni, storico, figli, QR revocati e regole RLS restano invariati.
La cancellazione delle campagne avviene prima dello scollegamento Auth, perché
necessita del vecchio ID per individuare anche i destinatari per account.

Migrazione preparata e collaudata localmente, non applicata in produzione.
Distribuire migrazione e codice insieme, registrando la migration nella stessa
transazione del rilascio DB. Nessuna email o modifica su partecipanti reali
eseguita durante il collaudo. Il flusso di creazione mantiene le scritture
multiple preesistenti: questa patch non introduce una transazione complessiva
né una nuova garanzia di unicità per invii simultanei.

## Verifica

- `node --test tests/deleted-email-reuse.test.mts tests/account-access.test.mts`:
  email libera dopo eliminazione, blocco per iscrizione attiva, scope evento,
  ricreazione capogruppo senza deroga duplicati, storico non sovrascritto né
  ricollegato, paginazione oltre 1.000 contatti, errori di lettura.
- `psql -v ON_ERROR_STOP=1 -f tests/sql/deleted-email-reuse.sql` soltanto su un
  database PostgreSQL vuoto temporaneo: esegue anche la fixture preesistente
  `participant-operations.sql`, poi verifica migrazione delle eliminazioni
  pregresse, ripristino dopo riutilizzo, scollegamento ultima iscrizione,
  conservazione storico/account/ruoli e privilegi della RPC.
- 429 test, lint, typecheck e build production superati in export isolato con `npm ci`.
  Il workspace condiviso contiene altre modifiche in corso, non incluse nella
  copia di verifica di questa correzione.
