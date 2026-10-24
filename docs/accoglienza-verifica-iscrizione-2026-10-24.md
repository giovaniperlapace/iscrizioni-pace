# Accoglienza: verifica iscrizione e cornice scanner

Richiesta del 24 ottobre 2026; commit e push su main richiesti esplicitamente.

«Verifica iscrizione» è il primo incarico della dashboard Accoglienza forum
ed eventi, disponibile a qualsiasi ora. È una capacità derivata dall'accesso
al ruolo, senza nuove assegnazioni persistenti e senza cambiare il catalogo
usato per assegnare o revocare Forum e cerimonie.

La scansione mostra nome e cognome del titolare del QR personale e uno dei
seguenti esiti, accompagnato da testo esplicito:

- Verde: iscrizione attiva, presenza generale confermata (badge ritirato).
- Giallo: iscrizione attiva, presenza generale assente o revocata (badge non ritirato).
- Rosso: codice invalido, revocato, scaduto, superato da un QR successivo,
  oppure iscrizione eliminata, annullata o di un altro evento.

La presenza generale è il criterio richiesto per il badge: non si usano
stampe richieste, presenze dichiarate, prenotazioni o ingressi ai Forum.
Il QR identifica il titolare adulto; non si attribuisce il suo stato ai figli.
I QR collettivi e scolastici non identificano una singola iscrizione personale.
Gli errori tecnici restano distinti dall'iscrizione non valida, con retry.

L'incarico non presenta prenotazioni, selezioni persone, conferme, correzioni,
revoche, stampe o conteggi di ingressi. Il contratto rifiuta ogni azione diversa
da `inspect`, anche se inviata direttamente. La sessione scanner non può
avviare scritture. La nuova RPC `reception_registration_check` è STABLE,
service-only, senza scritture, audit di scansione o lock sulle righe: rilegge
incarichi ed evento corrente, valida il QR più recente e restituisce soltanto
la proiezione personale. Non amplia i permessi dell'accoglienza generale.

HTTP privato/no-store; token hashato sul server, nessuna cache condivisa,
nessun polling o persistenza di nomi/QR nel browser. Scansioni consecutive
senza conferma manuale e latch del QR ancora inquadrato; stream fotocamera
conservato. Manuale, USB e ultime letture disponibili; dati riletti alla riapertura di
una scheda. Revoca del ruolo riconosciuta dal server anche a pagina aperta.

Per tutti gli incarichi Forum/cerimonie la cornice usa il gradiente blu e
`PeaceLineMark` della home. Intestazione e fascia esito conservano posizione e
altezza di 80px, testo bianco e conteggi centrati; il motivo decorativo è
confinato alla fascia inferiore della cornice. Su successiva richiesta,
nessun motivo decorativo dietro incarico e statistiche, sia in fotocamera sia
in manuale/USB. Contatori e aggiornamento restano al loro posto.
L'accoglienza generale mantiene la propria presentazione.

## Verifiche

- 1.123 test applicativi passati, inclusi contratto di sola lettura, sessione,
  server, derivazione attore/evento/hash e demo verde/giallo/rosso.
- TypeScript, lint mirato e build production in copia isolata da `npm ci` passati.
- PostgreSQL temporaneo: tutte le migration, test ruoli/ACL/evento/revoca,
  token invalidi/scaduti/sostituiti, soft delete, annullamento e badge revocato.
  Snapshot dei dati, funzioni/ACL, policy e trigger conservati dalla migration.
- Browser originale → API originale → PostgreSQL temporaneo: nome e tre
  esiti, desktop manuale/USB e telefono con QR decodificato da video sintetico,
  assenza di scritture e pulsanti operativi, cambio QR senza interazione,
  diniego Viewer, frame stabile e nessun overflow a 390/1440px.
- Regressioni Forum, cerimonie, scuole, contatori, ingressi, retry, concorrenza,
  collaudo fittizio e disponibilità temporale passate. Il nuovo incarico resta
  disponibile anche quando nessun Forum o cerimonia è aperto.

Collaudo pubblico esistente: scegliere Verifica iscrizione e usare F001
(verde), F009 (giallo), F008 (rosso). Tutto resta in memoria locale.
Nessuna iscrizione, presenza, prenotazione, stampa o email reale di prova.

## Rilascio

Migration `20261024160000_reception_registration_check.sql`, prima del codice.
Backup completo verificato tramite indice e decodifica `pg_restore`, permessi
600, conservato soltanto sul server:
`/root/backups/iscrizioni-pace/production-before-registration-verification-1792871645.dump`.
Dimensione 24.299.519 byte; SHA-256
`02d4f556deca63adda8f5dd9a7f7a7666012b27025ed6cec43cbcbffb97f4a41`.

La procedura avvolge la migration nelle guardie di conservazione collaudate
in `tests/sql/registration-verification-preservation-before.sql` e `-after.sql`.
Snapshot repeatable-read, senza bloccare le scritture operative: ogni riga
preesistente, funzione/ACL, policy e trigger deve rimanere invariato; una sola
funzione aggiunta, eseguibile soltanto da service role. Applicazione e
registrazione migration nella stessa transazione.

Migration applicata e registrata in produzione il 24 ottobre: guardie superate
su 74 tabelle / 244.199 righe originarie / 239 funzioni e ACL preesistenti.
Verifica finale in transazione READ ONLY riuscita sul database reale: funzione
STABLE/service-only e risultati coerenti per badge confermato, badge mancante
ed hash QR invalido, senza restituire identità nei log o scrivere dati.
