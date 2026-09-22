# Errore iscrizioni con lingua diversa da italiano/inglese

Il 22 settembre 2026 è stato segnalato un errore sistematico nelle iscrizioni
in tedesco e olandese. La verifica in sola lettura sul database di produzione
ha trovato `participants_preferred_locale_check` ancora limitato a `it/en`,
come nella migration iniziale. `submitPublicRegistration` risolve invece la
lingua della richiesta e `createPublicRegistration` la scrive sul partecipante.
La prima INSERT viene quindi respinta con SQLSTATE 23514 per fr/de/es/nl/uk,
prima della creazione di contatti, iscrizione, QR e invio della conferma.

La riproduzione ha usato il vincolo estratto dal catalogo di produzione su una
tabella temporanea: it/en accettati, le altre cinque lingue respinte. Nessun
tentativo di iscrizione reale è stato inviato dal browser.

## Correzione e rilascio

`20260922120000_participant_supported_locales.sql` sostituisce soltanto il
CHECK della lingua sui partecipanti con l'elenco delle sette lingue supportate.
Non cambia default, valori esistenti, autorizzazioni o RLS. I vincoli di lingua
di profili ed eventi non appartengono alla scrittura pubblica e restano invariati.

Migration e registrazione in `supabase_migrations.schema_migrations` applicate
in un'unica transazione, con lock e timeout; conteggio e hash di tutte le righe
partecipanti confrontati prima/dopo: 1.919 righe invariate. Dopo il commit,
il vincolo riletto da produzione accetta tutte e sette le lingue nella stessa
prova su tabella temporanea. Non serve un deployment applicativo per attivare
questa correzione.

## Verifiche

- 423 test applicativi superati, inclusa l'azione pubblica nelle sette lingue.
- Regressione SQL su PGlite temporaneo, usando la definizione originale della
  tabella e la migration reale: errore pre-fix, INSERT/UPDATE in tutte le lingue,
  righe storiche e default invariati, lingue sconosciute e null respinti.
- ESLint del nuovo runner e typecheck in copia pulita superati. Il typecheck
  iniziale nel workspace incontrava file duplicati preesistenti in `.next/types`
  (`cache-life.d 3.ts`, `routes.d 3.ts`); conservati, verifica eseguita con tipi
  Next rigenerati in una copia temporanea.
- Nessuna email inviata e nessun dato reale creato per collaudo. Non è stato
  eseguito un invio completo dal browser con email reale.

Per ripetere la regressione, usare un'installazione esterna di PGlite:

```bash
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  node tests/sql/participant-supported-locales.mts
```

Il runner opera solo su un database effimero senza connessione alla produzione.
