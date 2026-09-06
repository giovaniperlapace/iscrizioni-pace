# Assegnazioni operative e questionario — 2026-09-05

Il gruppo corrente è immediatamente operativo. `confirmed` resta il valore
tecnico per compatibilità con l'enum e le integrazioni esistenti; non significa
più che sia necessaria una conferma umana. L'interfaccia usa «gruppo assegnato».
La validità operativa e i conteggi dipendono dall'assegnazione corrente.

## Flusso

- Il capogruppo consulta tutte le assegnazioni correnti del proprio sottoalbero.
  Non esistono più coda Da confermare, conferma/non conferma, smistamento ai
  discendenti o lettura della notifica.
- La scheda conserva contatti, servizi, tag e note e offre l'eccezione
  `Non appartiene al mio gruppo`, con conferma esplicita della rimozione.
- La RPC `reject_group_assignment` controlla nuovamente evento corrente,
  membership capogruppo e scope attivo. Blocca la riga e rimuove l'assegnazione
  scrivendo `group_leader.assignment_rejected` nella stessa transazione.
  Non crea una riga nel padre. La persona compare nel filtro `Senza gruppo`
  di admin/manager, dove può essere riassegnata.
- La RPC è eseguibile solo da `service_role`; il server autentica prima
  l'operatore. Non cambiano le policy RLS delle tabelle.
- Nessuna email automatica ai capigruppo per nuova iscrizione/assegnazione.
  La conferma al partecipante, i magic link e le campagne restano disponibili.

## Questionario

Versione `2026-09-06-conditional-groups`, con sette lingue complete.
La domanda sugli eventi precedenti è obbligatoria: No mostra direttamente
l'associazione facoltativa; Sì mostra «Parteciperai alla Preghiera per la Pace
con un gruppo della Comunità?», obbligatoria solo in questo ramo. La seconda
risposta Sì apre la selezione gruppo, No mostra l'associazione.

Il primo No azzera risposta e selezioni del ramo gruppo. Anche passando dalla
seconda risposta Sì a No si azzerano le scelte del gruppo; il gruppo del link
riservato resta disponibile come preselezione soltanto nel ramo Sì/Sì.
L'associazione viene rimossa quando il suo campo scompare. Il payload esclude
i campi non pertinenti e il server normalizza il primo No come partecipazione
senza gruppo anche in presenza di valori residui. L'associazione facoltativa
vive in `registration_questionnaire_answers.answers.externalGroupAssociation`.
Gli snapshot storici conservano versione e contenuto; nessuna migration.

La selezione esplicita produce subito un gruppo operativo. Nessuna selezione,
`Non trovo il mio referente` o risposta No lasciano senza gruppo: i nodi
territoriali servono ancora per scope e catalogo, non come code automatiche.
Un link riservato preseleziona solo il gruppo: entrambe le risposte Sì restano
necessarie. Anche una membership operativa non prevale sulla risposta No.

## Migrazione e rilascio

SQL revisionabile: `supabase/migrations/20260905150000_operative_group_assignments.sql`.

Il backfill tratta solo assegnazioni correnti:

- rimuove assegnazioni automatiche ancora probabili e risalite ancora probabili;
- rimuove assegnazioni di persone che hanno dichiarato No, eccetto interventi
  espliciti con source admin/manager;
- disattiva eventuali assegnazioni correnti già rifiutate;
- rende operative le altre probabili, senza inventare confermante o data;
- conserva assegnazioni già confermate, salvo la regola del No indicata sopra;
- aggiunge un audit per ogni riga cambiata, senza riscrivere audit precedenti.

Il vecchio enum `probable` e i metadati di conferma/notifica restano per lo
storico. Nessun flusso applicativo legge o aggiorna la data di lettura;
l'indice della coda di lettura viene rimosso. Default e trigger normalizzano
le nuove assegnazioni correnti a `confirmed`; un vincolo impedisce che una
riga rifiutata resti corrente.

Coordinare codice e SQL nello stesso rilascio: la nuova azione di rifiuto
richiede la RPC. Applicare la migration dopo aver sospeso brevemente le
iscrizioni/azioni operative e prima di abilitare il nuovo codice; quindi
verificare l'app e riaprire. Evitare una finestra in cui il vecchio codice
possa rigenerare code territoriali. La migration è stata applicata e registrata in produzione il 2026-09-05;
il deployment compatibile è stato promosso immediatamente dopo.

Comando remoto eseguito:

```sh
npm run db:migrate:remote -- supabase/migrations/20260905150000_operative_group_assignments.sql
```

## Verifiche

- Test funzionali del questionario: rami condizionali, seconda risposta
  richiesta solo dopo il primo Sì, associazione facoltativa, campi residui ignorati.
- Matching: No/null non assegnano neppure quando esiste una selezione residua.
- PostgreSQL temporaneo: backfill, storico, override manager, null legacy,
  rifiuto da capogruppo padre, scope estraneo, privilegi RPC, ripetizione,
  normalizzazione vecchi client e rollback se fallisce l'audit.
- Browser: componente pubblico reale con dati sintetici, sette lingue, link
  ordinario/riservato, cambi di risposta e azzeramenti, associazione, desktop/mobile.
  Nessuna iscrizione o email di prova in produzione.

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
# Contro un dev server locale avviato:
node tests/browser/group-questionnaire.mjs http://localhost:3106
# Solo su database temporaneo vuoto:
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/operative-group-assignments.sql
```

Esito verificato: lint, TypeScript, 173 test automatici e build Next.js webpack
superati; fixture SQL PostgreSQL e prove browser completate senza errori.

Verifica del flusso condizionale il 2026-09-06: lint, TypeScript, 188 test
automatici e build webpack superati; browser su fixture sintetica in tutte
le sette lingue, con/senza link riservato, cambi di risposta e desktop/mobile,
senza errori browser.

## Rilascio production — 2026-09-05

- Codice: `8428cd6`, integrato in `main`.
- Deployment preparato con ambiente production e `--skip-domain`, poi promosso:
  `dpl_A5yZJpMgSHN5rdbcd4qrJUQZze85`.
- Dominio verificato: `https://registrationspeace.santegidio.org`.
- Migration `20260905150000` applicata, registrata e cache PostgREST ricaricata.
- Prima: 67 assegnazioni correnti (59 probabili, 8 confermate).
- Dopo: 44 correnti operative; 36 convertite e 23 spostate in Senza gruppo.
- Creati 59 audit di backfill. I 506 audit precedenti e i 68 snapshot sono
  identici al checkpoint precedente, verificati anche mediante hash aggregati.
  Nessuna iscrizione è stata eliminata (68 conservate).
- Vincolo validato, trigger presente, RLS conservata. RPC riservata a
  `service_role`, senza accesso diretto per `anon` o `authenticated`.
- PostgREST: HTTP 200 per le 44 assegnazioni correnti; RPC disponibile e
  richiesta sintetica con identificativo inesistente rifiutata senza mutazioni.
- Pausa e ripristino delle nuove iscrizioni registrati nell'audit; evento
  pubblicato e scadenza originaria `2026-10-24 23:59:59+00` ripristinata.
- Il successivo push su `main` mantiene il normale deployment automatico GitHub.
