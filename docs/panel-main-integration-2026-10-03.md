# Riallineamento panel con main — 3 ottobre 2026

## Perimetro

Integrazione richiesta dall’utente di `origin/main` a `0b7e4d1` nella base
panel `388d05f`, sul branch esistente `codex/panel-p0-p10`. Al fetch iniziale:
68 commit esclusivi di main, 53 esclusivi di panel; entrambi i branch locali
allineati ai rispettivi upstream. Merge ordinario, senza riscrittura della storia.
Nessun push, deployment, applicazione SQL remota o invio email in questa attività.

La nota locale preesistente di `AGENTS.md` sulle migration production del
3 ottobre è conservata separatamente nello stash denominato
`main: nota migration produzione 2026-10-03 preservata prima del merge panel`.
Non è parte del merge e va ripristinata su main quando si riprende quel lavoro.

## Risoluzione

14 file in conflitto: memoria operativa, API campagne, dashboard admin/manager
e capogruppo, sezione email, navigazione e tabella partecipanti, statistiche,
package/lockfile e tre fixture/test. Conservate entrambe le evoluzioni:

- controlli di ruolo di main prima dei loader panel; viewer conserva statistiche,
  esportazioni e partecipanti in sola lettura, con sezione Panel riservata ai manager;
- categorie statistiche, associazioni, disabilità, esportazioni e ruoli cumulativi
  di main insieme al report panel e agli ingressi effettivi P13;
- figli sempre visibili ed editor operativi di main con stato ingresso individuale
  per adulto/minore; stessa UI condivisa, estesa con contenuto facoltativo per figlio;
- campagne paginate e coda Postmark con destinatari docenti e filtri panel,
  controlli evento e identificativo scuola conservati;
- rinnovo attività dopo Magic Link insieme al collegamento dell’identità docente;
- scanner P11/P12 e prenotazioni P0–P10 conservati, senza riprogettazione del flusso.

Dipendenze allineate al lockfile production di main (Next 16.2.9, React 19.2.4),
con la sola aggiunta di `jsqr` 1.4.0 già necessaria allo scanner. Rimossi dal ramo
integrato i pacchetti SMTP nodemailer superati dall’implementazione Postmark.
Comandi di staging e Postmark conservati; installazione verificata con `npm ci`.

Le fixture ora rispettano i figli sempre visibili e l’apertura delle schede tramite
URL. La regressione scanner aggiunge `tests/browser/reception-playwright.mjs`, con
la fixture sintetica esistente e controlli su desktop, mobile e schermi bassi.
Il driver agent-browser ha avuto timeout intermittenti durante le interazioni;
la prova Playwright usa il runtime già disponibile e Chrome locale, senza
installare dipendenze nel progetto. La fixture agent-browser preesistente resta
invariata. Aggiornati i mock alle firme effettive delle funzioni, senza rimuovere
i controlli di autorizzazione o paginazione.

## Migration e staging

Nessuna migration esistente riscritta e nessuna nuova migration introdotta.
Il merge importa questi 18 file da main, invariati:

- `20260912180000_postmark_campaign_queue.sql`
- `20260914140000_operations_attendance.sql`
- `20260915160000_group_assignment_reports.sql`
- `20260916120000_email_campaign_recovery.sql`
- `20260921120000_operational_children.sql`
- `20260922120000_participant_supported_locales.sql`
- `20260922153000_nonretryable_stale_conflicts.sql`
- `20260922180000_group_deletion.sql`
- `20260922190000_operational_registration_additions.sql`
- `20260922200000_deleted_registration_email_reuse.sql`
- `20260922210000_self_registration_cancellation.sql`
- `20260923180000_operational_group_geography.sql`
- `20260923210000_group_multiple_cities.sql`
- `20260925180000_operational_role_management.sql`
- `20260925210000_service_excel_import.sql`
- `20260929120000_assisted_demographics.sql`
- `20261002120000_operational_tags_managers_only.sql`
- `20261002140000_operational_association.sql`

Questo è un inventario Git, non una certificazione dello stato del DB staging:
prima della pubblicazione confrontare il registro remoto e applicare solo le
migration effettivamente mancanti dopo autorizzazione. La migration P13
`20260930180000_reception_operational_report.sql` resta documentata come non
applicata allo staging. Le migration della coda richiedono inoltre configurazione
coerente del provider e del worker prima dell’attivazione delle campagne.

Conservata l’assenza preesistente sul branch panel della migration ridondante
`20260728120000_single_active_group_registration_link.sql`, già documentata nel
bootstrap panel. Non reintrodotta né rimossa da main in questa attività.

## Verifiche

- 743 test applicativi superati con `TZ=Europe/Rome npm test`.
- `npm run lint`, `npm run typecheck` e `npm run build:staging` superati dopo
  installazione dal lockfile. Readiness staging superata; build ottimizzata
  con Next 16.2.9. Nessuna route temporanea di collaudo inclusa nella build.
- Scanner completo con `tests/browser/reception-playwright.mjs`: ingressi singoli,
  famiglie parziali, correzioni/annullamenti, scuole, cronologia, retry con stesso UUID,
  errore QR, fotocamera negata/ripresa/rilascio, revoca sessione e layout desktop/mobile.
  Nessun errore runtime. Avvio con `PLAYWRIGHT_MODULE` verso il runtime disponibile
  e `PLAYWRIGHT_CHANNEL=chrome` per il browser locale già installato.
- File migration confrontati byte per byte con entrambi i genitori del merge:
  55 del branch panel e 57 di main invariati (esclusione storica ridondante sopra).

- Suite SQL su PostgreSQL 17 temporaneo: migration canoniche combinate in ordine,
  check-in storico conservato, P11/P12/P13, RLS, revoche, retry e concorrenza.
  Esclusa la sola migration dati `20260813170000_rename_anziani_and_amici_groups.sql`,
  perché richiede i gruppi reali assenti nella fixture, come nel runner precedente.
- Browser presenze: desktop/mobile, adulti/minori/scuole, filtri del report,
  form aperti conservati durante polling/annullamenti, errori e revoche.
- Nuova regressione worker: destinatari docenti processati con identità scuola
  attraverso la coda Postmark, con esiti individuali del batch sintetico.

I collaudi locali non certificano il database remoto né le prove con telefoni,
fotocamere o stampanti reali. P13 resta aperta; nessun avanzamento a P14/P15.
