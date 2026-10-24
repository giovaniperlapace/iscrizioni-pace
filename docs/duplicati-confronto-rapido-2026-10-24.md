# Duplicati: confronto e conferma circoscritti — 24 ottobre 2026

## Problema e correzione

I link «Non sono duplicati», «Confronta» ed «Elimina questa iscrizione»
navigavano nuovamente alla pagina server: caricamento di tutte le iscrizioni,
contatti, gruppi, servizi, tag e figli, ricerca globale dei duplicati e Forum.
Il confronto eseguiva inoltre due `quality_event_version`: la versione includeva
l'intero evento. Una modifica a qualunque altro iscritto, alle presenze o a
un'altra revisione rendeva inutilizzabile la conferma della coppia.

I tre link ora aggiornano localmente l'URL; il dialog compare subito con lo
stato di caricamento e richiede soltanto le due schede. La lettura HTTP dedicata
è privata/no-store, senza polling, con ruolo/evento ricalcolati lato server,
filtri prima della paginazione, riferimenti ai soli servizi/tag della coppia.
Chiusura, cambio coppia/azione/destinatario annullano le letture precedenti;
errori con possibilità di ricaricare, URL diretti e cronologia conservati.

La lista completa dei duplicati continua a essere ricalcolata entrando nella
vista e dopo un salvataggio; questo intervento elimina il suo ricalcolo dalle
aperture/chiusure dei dialog, non introduce cache condivise di dati personali.
La conferma riuscita chiude subito il dialog e aggiorna la lista in background.

## Database e protezioni

Migration `20261024120000_duplicate_pair_review.sql`, aggiuntiva: due funzioni
service-only, nessun backfill, modifica alle tabelle, RLS o dati operativi.

- `quality_duplicate_pair_version`: digest dei dati delle sole due schede,
  iscrizioni attive nell'evento, con contatti primari, assegnazioni correnti,
  servizi/tag, figli e riferimenti geografici/catalogo pertinenti.
- `dismiss_participant_duplicate`: solo persone distinte; ruolo riletto,
  motivazione, fingerprint e versione verificati, revisione/audit atomici.
  Brevi lock SHARE sulle relazioni lette impediscono modifiche/insert concorrenti
  fra controllo e salvataggio; attesa massima lock di tre secondi, errore con
  invito a riprovare. Nessun lock su Forum, presenze o check-in. Advisory lock
  della coppia e controllo dell'esito già scritto evitano doppio audit sui retry.
- Token cifrato `review-v1` con scope `pair-v1`, attore/evento/scadenza di venti
  minuti; non utilizzabile per unire iscrizioni. Merge/import legacy mantengono
  le rispettive verifiche globali. Una modifica effettiva alla coppia resta
  bloccante; attività estranea non invalida la decisione.
- «Elimina questa iscrizione» usa il nuovo caricamento, ma il salvataggio resta
  la RPC canonica `set_registration_deleted`: non aveva il controllo globale
  difettoso. Conferma, motivazione, ID preciso, soft delete, QR/storico e ruoli
  restano quelli esistenti. Nessuna eliminazione reale di prova.

La migration è stata applicata prima del codice dopo autorizzazione esplicita;
vedi il verbale di rilascio sotto.

## Verifiche

- 1.119 test del checkout passati; TypeScript passato.
- Lint dei file modificati passato. Lint generale: tre `no-explicit-any` e un
  avviso già presenti in `tests/ceremony-navigation.test.mts`.
- Build production Webpack in copia isolata, senza credenziali operative,
  riuscita; versioni installate confrontate con lockfile: zero divergenze.
- `tests/duplicate-pair-review.test.mts`: due iscrizioni lette su 15.002,
  nessun catalogo globale, input malformati, scope vuoto, dati cambiati/mancanti,
  errori di lettura e token legato ad attore/evento.
- `node tests/sql/run-duplicate-pair-review.mjs`: PostgreSQL temporaneo, regressioni
  import/merge/eliminazione, cambiamenti estranei consentiti, identità/contatto/
  figli cambiati rilevati, eliminati esclusi, scope/Viewer/anon, rollback audit,
  conferme concorrenti e retry senza duplicazioni.
- Benchmark SQL locale su 15.000 iscritti aggiuntivi: digest coppia circa 3 ms,
  vecchio digest evento circa 104 ms. Non è una misura della latenza live:
  il principale risparmio sul click è evitare tutte le letture della lista.
- Collaudo browser: `node tests/browser/run-duplicate-pair.mjs`, copia isolata
  e risposte sintetiche alle API, componenti originali. Il test verifica
  caricamento immediato senza nuova richiesta della pagina, salvataggio/esito
  cambiato con motivazione conservata, eliminazione del solo ID selezionato,
  retry lettura, Escape/X, risposte tardive, confronto sola lettura e dimensioni
  desktop 1440px/mobile 390px. Le scritture sono simulate nel browser; le RPC
  reali vengono verificate separatamente sul database temporaneo.


## Rilascio autorizzato — 24 ottobre 2026

Richiesta esplicita: backup, migration production, commit/push dei soli duplicati,
senza le modifiche Accoglienza. `main` allineato a `origin/main` (`dacf5ec`) prima
del rilascio. Index selettivo di 19 file; in `AGENTS.md` incluso soltanto il nuovo
paragrafo duplicati. I 20 file estranei della working tree sono conservati e
confrontati con SHA-256, comprese le migration Accoglienza ancora non applicate.

Verifica della copia esatta dell'index, con `npm ci` e senza credenziali operative:
1.113 test, TypeScript e build production Webpack superati. Il totale è diverso
dai 1.119 del checkout perché esclude i test locali delle modifiche Accoglienza.

Backup production completo conservato esclusivamente sul server, permessi 600,
elenco archivio e decodifica integrale riusciti:
`/root/backups/iscrizioni-pace/production-before-duplicate-pair-1792842537.dump`.
Dimensione 23.108.679 byte; SHA-256
`bf50ff591cf3e20986f59dfc781dd1dfda9aa54f7ded46d1c4cfcfd819e815aa`.

Migration `20261024120000` applicata e registrata atomicamente con lo script del
repository, corpo SQL canonico circondato da guardie già collaudate in PostgreSQL
temporaneo. Conservate 74 tabelle e 232.460 righe canoniche; definizioni/ACL delle
237 funzioni esistenti, ACL/RLS delle tabelle, policy e trigger invariati.
Aggiunte soltanto le due funzioni previste, entrambe service-only. Nessuna
modifica o prova operativa su iscrizioni, revisioni duplicati, ingressi o email.
Le migration Accoglienza `20261023130000` e `20261023140000` restano escluse.
