# Inaugurazione: sala collegata F da 400 a 500 posti

Richiesta del 24 ottobre 2026. Applicata e registrata in produzione dopo
conferma esplicita dell’utente, backup verificato e collaudo della procedura.
Commit e push autorizzati; nessun invio email di prova.

La migration `20261024140000_opening_relay_capacity_500.sql` aggiorna soltanto
il piano di apertura dell'evento corrente con layout `assisi-opening-2026`:
capienza F, limite assegnabile e quota Partecipanti passano da 400 a 500.
Capienza del momento e della sede: 3.540 → 3.640; totale quote: 3.250 → 3.350.
I 290 posti protocollo restano invariati. La UI usa già la capienza canonica
per titolo e quadratini, quindi non richiede modifiche applicative.

Usa il lock evento delle assegnazioni, incrementa la revisione e registra un
audit. Rifiuta configurazioni inattese e sedi condivise con altri momenti.
Una seconda applicazione sullo stato finale non incrementa revisione o audit.
Non modifica assegnazioni, nomine, bozze, email, identità delle sedie o mappe.
L'inizializzatore storico resta invariato: è manutenzione del piano esistente,
non una nuova configurazione generale per eventi futuri.

Verifiche completate:

- `npm test`: 1.119 test passati.
- `node tests/sql/run-opening-ceremony.mjs`: regressioni SQL e concorrenza su
  PostgreSQL temporaneo passate, compreso il nuovo scenario con assegnazioni
  pubblicate e bozza F conservate integralmente.
- Disponibilità +100; 500 posti accettati, 501 rifiutati; revisione precedente
  rifiutata; retry migration senza doppio audit; configurazione alterata provoca
  rollback. Mappe, nomine, claim, riserve, bozze e coda email confrontati integralmente.
- `git diff --check`: passato. Nessuna modifica TypeScript o UI da compilare.

Per l'applicazione remota seguire `docs/supabase-workflow.md`: concordare
esplicitamente production, verificare backup e stato reale prima della migration,
poi controllare capienze, conteggi e conservazione dei dati operativi. Non ridurre
automaticamente a 400 dopo nuove assegnazioni: potrebbe superare la capienza.

## Applicazione in produzione — 24 ottobre 2026

Backup completo sul server, permessi 600:
`/root/backups/iscrizioni-pace/production-before-opening-relay-500-1792854531.dump`.
Dimensione: 23.612.242 byte. SHA-256:
`93155304baed0ef8b6d25d5cb113102b337568f9b03b63ce2c3d0c480b24f05a`.
Indice e decodifica completa del dump verificati con `pg_restore`.

La procedura di rilascio aggiunge controlli temporanei attorno alla migration,
collaudati tramite `--relay-guard` nel runner SQL. Nella stessa transazione:
74 tabelle, 237.541 righe originarie, 239 definizioni/ACL delle funzioni,
policy, trigger e permessi confrontati. Le sole modifiche ammesse sono i
campi di capienza previsti, la revisione e un nuovo audit; storico audit,
assegnazioni, bozze, mappe, coda email e dati estranei conservati.

Migration `20261024140000` registrata atomicamente. Lettura finale READ ONLY:
F capienza/limite/quota 500; momento e sede 3.640; quote complessive 3.350;
revisione 101 → 102; un solo audit. Nessuna modifica al codice applicativo:
le schermate leggono già la nuova capienza dal database.
