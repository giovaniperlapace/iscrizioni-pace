# Apertura Forum dalle impostazioni Admin — 20 ottobre 2026

## Comportamento

In Admin → Impostazioni → Evento, la scheda dell’evento corrente pubblicato
include il toggle «Iscrizioni ai Forum». È separato dall’apertura delle
iscrizioni all’evento.

- Attivazione: da `internal` o `catalog` a `open`, con catalogo pubblico e
  prenotazioni personali/capogruppo abilitate per i Forum pubblicati.
- Disattivazione: da `open` (o dallo stato storico `catalog`) a `internal`: i
  Forum vengono nascosti dal sito e le prenotazioni vengono chiuse insieme.
  La home mostra i Forum e i metadati del programma soltanto in modalità `open`,
  anche se viene incontrato lo stato storico `catalog`. I link diretti
  `/forum/[id]` mantengono il controllo `open` già presente.
- Le prenotazioni, i minori selezionati e il flag scuole non sono modificati.
  Restano valide le regole preesistenti della lista d’attesa: la chiusura può
  far scadere/annullare le offerte attraverso il normale elaboratore.
- Lo stato del toggle è quello salvato; durante la richiesta il controllo
  è disabilitato. Errori richiedono di aggiornare la pagina e verificare lo stato.

## Autorizzazione e salvataggio

Server Action con autenticazione e ruolo Admin globale; RPC autenticata
`set_forum_bookings_open` con verifica autonoma dell’Admin nel database.
Nessun accesso Manager/Viewer/anonimo. La RPC blocca ruolo ed evento,
controlla l’evento corrente pubblicato e lo stato atteso; modifica e audit
sono atomici. Il retry di un comando già completato non duplica l’audit.

Migration: `20261020220000_admin_forum_opening.sql`.
Crea soltanto la funzione e i relativi privilegi: non cambia l’apertura.
Va applicata prima di pubblicare il frontend.

## Verifiche

- Suite applicativa: 984 test superati, inclusi i 3 della nuova Server
  Action (ruoli, input, chiamata autenticata, gestione errori).
- Lint, TypeScript e build production in copia senza credenziali con `npm ci`.
- `node tests/sql/run-forum-waitlist.mjs`: tutte le migration su PostgreSQL
  temporaneo, nuovo test `admin-forum-opening.sql` e regressioni della coda,
  minori, presenze necessarie, ritiro Forum e concorrenza.
- Verificati nel DB: Admin/revoca, esclusione Manager/Viewer/anon, transizioni,
  richiesta superata, retry, input non validi, audit e conservazione esatta
  delle scelte, coda e accesso scuole. Tutto su fixture sintetica.
- Browser: componente originale e form condiviso in copia isolata, azione
  sintetica con ritardo/errore; desktop 1440 e telefono 390, tastiera,
  apertura/chiusura, stato conservato dopo errore, nessun overflow o errore JS.
  Immagini in `/tmp/forum-toggle-390.png` e `/tmp/forum-toggle-1440.png`.
  Il test browser non costituisce verifica di una sessione Admin production.

## Verifica della visibilità pubblica

La richiesta successiva dell’utente supera il precedente comportamento di
chiusura in `catalog`: visibilità e prenotazioni devono seguire lo stesso toggle.
`tests/browser/forum-opening-visibility.mjs` verifica home e route originali
contro un servizio sintetico locale: desktop/telefono, `open` visibile,
`internal` e `catalog` nascosti senza caricare il catalogo, link diretti 404
a prenotazioni chiuse, riapertura visibile. Screenshot
`/tmp/forum-visibility-{open,internal,catalog}-{390,1440}.png`.
Ripetuti con successo suite applicativa, SQL, lint, TypeScript e build pulita.

La pagina live è stata letta senza modifiche: nessuna sezione `panel-program`,
presente il modulo email. Questa osservazione non equivale al rilascio del toggle.

## Rilascio autorizzato

Migration `20261020220000_admin_forum_opening` applicata e registrata atomicamente
in produzione dopo backup custom verificato (catalogo e lettura completa):
`/root/backups/iscrizioni-pace/production-before-forum-toggle-20261020.dump`.
SHA-256: `102ac72529ebff28b1972b3bee175fbce5b16703fd86e9a98f00a26e7148ab23`.

Confronto nella transazione: 67 tabelle, 135.492 righe e 201 funzioni
preesistenti (definizione, proprietario e ACL) invariati. Confermati `internal`
e accesso scuole attivo. Nessuna apertura, email o prenotazione di collaudo.

L’identificativo iniziale `20261020160000` era già occupato da
`manager_bulk_operations`: il primo tentativo è stato interamente annullato.
Rinominata la migration e rieseguita con successo l’intera suite SQL prima
dell’applicazione. Il codice è stato pubblicato su `main` con commit `178b18c` e deployment
production READY `dpl_94XPUqoRtDnNqY8SbY2WD2wCM7Gh`, associato al dominio
`registrationspeace.santegidio.org` (build 48 secondi).

Verifica browser dopo READY: home con modulo email e Forum nascosti;
`/dashboard/admin?section=impostazioni` senza sessione reindirizza al login.
Il toggle autenticato è stato collaudato sinteticamente; non è stato azionato
su produzione e non è stata creata una sessione Admin per questa verifica.

Scope Vercel corrente verificato: `giovaniperlapaces-projects`; il riferimento
storico `stefano-orlandos-projects-de2d57cb` non è disponibile per l’account
attuale. Usata cache npm separata per evitare un errore della cache CLI locale.
